import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Publish desktop updater assets to basir2353/pops-desktop-updates.
 * Ice Cream Bar stays on publish-ice-cream-update.mjs (separate repo/key).
 *
 * Usage (after signed build + write-update-manifest):
 *   node scripts/publish-desktop-update.mjs <edition> [version]
 *   node scripts/publish-desktop-update.mjs all [version]
 *
 * Editions: suite | restaurant | general-store | pharmacy | distribution | all
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const updatesDir = join(repoRoot, "dist-installers", "updates");
const editionArg = (process.argv[2] ?? "").trim();
const versionArg = (process.argv[3] ?? "").trim();

const DESKTOP_EDITIONS = ["suite", "restaurant", "general-store", "pharmacy", "distribution"];
const owner = "basir2353";
const repo = "pops-desktop-updates";

if (!editionArg || (editionArg !== "all" && !DESKTOP_EDITIONS.includes(editionArg))) {
  console.error(
    `Usage: node scripts/publish-desktop-update.mjs <${DESKTOP_EDITIONS.join("|")}|all> [version]`,
  );
  process.exit(1);
}

const editions = editionArg === "all" ? DESKTOP_EDITIONS : [editionArg];

function gitHubAuth() {
  const filled = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  if (filled.status !== 0) return null;
  const lines = (filled.stdout ?? "").split(/\r?\n/);
  const username = lines.find((l) => l.startsWith("username="))?.slice(9)?.trim();
  const token = lines.find((l) => l.startsWith("password="))?.slice(9)?.trim();
  if (!username || !token) return null;
  return { username, token };
}

const auth = gitHubAuth();
if (!auth) {
  console.error("[publish-desktop] GitHub credentials not found. Sign in to GitHub in Git, then retry.");
  process.exit(1);
}

const apiHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${auth.token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "pops-desktop-updater",
};

async function api(method, url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method,
    headers: { ...apiHeaders, ...extraHeaders },
    body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message ?? text.slice(0, 200);
    throw new Error(`${method} ${url} → HTTP ${res.status}: ${msg}`);
  }
  return json;
}

async function ensureRelease(releaseTag, name, body, makeLatest) {
  const existingUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${releaseTag}`;
  const createUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
  let release = null;
  try {
    release = await api("GET", existingUrl);
  } catch (err) {
    if (!String(err.message).includes("HTTP 404")) throw err;
  }
  if (!release) {
    release = await api(
      "POST",
      createUrl,
      JSON.stringify({
        tag_name: releaseTag,
        name,
        body,
        draft: false,
        prerelease: false,
        make_latest: makeLatest ? "true" : "false",
      }),
      { "Content-Type": "application/json" },
    );
  } else if (makeLatest) {
    // Existing releases keep prior make_latest unless we PATCH.
    release = await api(
      "PATCH",
      `https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`,
      JSON.stringify({
        name,
        body,
        make_latest: "true",
      }),
      { "Content-Type": "application/json" },
    );
  }
  return release;
}

async function fetchLatestRelease() {
  return api("GET", `https://api.github.com/repos/${owner}/${repo}/releases/latest`);
}

async function uploadFiles(release, files) {
  for (const filePath of files) {
    const name = basename(filePath);
    const stale = (release.assets ?? []).find((a) => a.name === name);
    if (stale?.id) {
      await api("DELETE", `https://api.github.com/repos/${owner}/${repo}/releases/assets/${stale.id}`);
    }
    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
    const bytes = readFileSync(filePath);
    await api("POST", uploadUrl, bytes, {
      "Content-Type": "application/octet-stream",
    });
    console.log(`[publish-desktop] uploaded ${name} → ${release.tag_name}`);
  }
}

/** Keep every edition's latest-*.json on the GitHub "latest" release so /releases/latest/download works. */
async function syncAllManifestsOntoLatest(latestRelease) {
  if (!existsSync(updatesDir)) return;
  const manifests = readdirSync(updatesDir)
    .filter((n) => /^latest-(suite|restaurant|general-store|pharmacy|distribution)\.json$/.test(n))
    .map((n) => join(updatesDir, n));
  if (manifests.length === 0) return;
  const fresh = await api(
    "GET",
    `https://api.github.com/repos/${owner}/${repo}/releases/${latestRelease.id}`,
  );
  await uploadFiles(fresh, manifests);
  console.log(`[publish-desktop] synced ${manifests.length} latest-*.json onto ${fresh.tag_name}`);
}

function resolveEditionPackage(edition) {
  const manifestPath = join(updatesDir, `latest-${edition}.json`);
  if (!existsSync(manifestPath)) {
    return { edition, error: `Missing ${manifestPath}. Run write-update-manifest.mjs ${edition} first.` };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const version = versionArg || manifest.version;
  const releaseDir = join(updatesDir, `desktop-v${version}`);
  if (!existsSync(releaseDir)) {
    return { edition, error: `Missing release folder ${releaseDir}` };
  }
  const wanted = new Set([
    `latest-${edition}.json`,
  ]);
  const files = readdirSync(releaseDir)
    .filter((name) => {
      if (wanted.has(name)) return true;
      if (name.endsWith("-setup.exe") || name.endsWith("-setup.exe.sig")) {
        // Prefer assets listed in this edition's manifest URL.
        const url = manifest?.platforms?.["windows-x86_64"]?.url ?? "";
        return url.includes(name) || name.toLowerCase().includes(edition.replace(/-/g, ""));
      }
      return false;
    })
    .map((name) => join(releaseDir, name));

  // Always include the edition manifest from release dir (or root copy).
  const manifestInRelease = join(releaseDir, `latest-${edition}.json`);
  if (existsSync(manifestInRelease) && !files.includes(manifestInRelease)) {
    files.push(manifestInRelease);
  } else if (!existsSync(manifestInRelease)) {
    files.push(manifestPath);
  }

  // Include exe + sig from manifest URL basename when present.
  const assetUrl = manifest?.platforms?.["windows-x86_64"]?.url ?? "";
  const assetName = assetUrl.split("/").pop();
  if (assetName) {
    for (const n of [assetName, `${assetName}.sig`]) {
      const p = join(releaseDir, n);
      if (existsSync(p) && !files.includes(p)) files.push(p);
    }
  }

  return { edition, version, releaseDir, files: [...new Set(files)], manifest };
}

async function main() {
  const packages = editions.map(resolveEditionPackage);
  const failed = packages.filter((p) => p.error);
  for (const f of failed) {
    console.error(`[publish-desktop] ${f.edition}: ${f.error}`);
  }
  const ready = packages.filter((p) => !p.error);
  if (ready.length === 0) process.exit(1);

  console.log(`[publish-desktop] Publishing ${ready.map((p) => p.edition).join(", ")} as ${auth.username}`);

  // Group by version so one GitHub release can hold multiple edition assets.
  const byVersion = new Map();
  for (const pkg of ready) {
    const list = byVersion.get(pkg.version) ?? [];
    list.push(pkg);
    byVersion.set(pkg.version, list);
  }

  const versions = [...byVersion.keys()].sort();
  let lastRelease = null;
  for (const version of versions) {
    const pkgs = byVersion.get(version);
    const tag = `desktop-v${version}`;
    const allFiles = [...new Set(pkgs.flatMap((p) => p.files))];
    const release = await ensureRelease(
      tag,
      `POPS Desktop ${version}`,
      `Desktop auto-update assets for: ${pkgs.map((p) => p.edition).join(", ")}`,
      true,
    );
    // Refresh release after create so assets list is current
    const fresh = await api("GET", `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`);
    await uploadFiles(fresh ?? release, allFiles);
    lastRelease = fresh ?? release;
    console.log(`[publish-desktop] ${tag} ready`);
    for (const p of pkgs) {
      console.log(
        `  latest-${p.edition}.json → https://github.com/${owner}/${repo}/releases/latest/download/latest-${p.edition}.json`,
      );
    }
  }

  if (lastRelease) {
    // Always sync onto whatever GitHub currently considers "latest".
    const latest = await fetchLatestRelease();
    await syncAllManifestsOntoLatest(latest);
  }

  console.log("[publish-desktop] Done.");
}

main().catch((err) => {
  console.error("[publish-desktop]", err instanceof Error ? err.message : err);
  process.exit(1);
});
