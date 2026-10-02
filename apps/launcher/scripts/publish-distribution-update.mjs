import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Publish Distribution updater assets to basir2353/zivra-distribution-updates.
 *
 * Usage (after signed build + write-update-manifest distribution):
 *   node scripts/publish-distribution-update.mjs [version]
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const updatesDir = join(repoRoot, "dist-installers", "updates");
const versionArg = (process.argv[2] ?? "").trim();
const edition = "distribution";

const owner = "basir2353";
const repo = "zivra-distribution-updates";

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
  console.error(
    "[publish-distribution] GitHub credentials not found. Sign in to GitHub in Git, then retry.",
  );
  process.exit(1);
}

const apiHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${auth.token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "zivra-distribution-updater",
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
    console.log(`[publish-distribution] uploaded ${name} → ${release.tag_name}`);
  }
}

async function syncManifestOntoLatest(latestRelease) {
  const manifestPath = join(updatesDir, `latest-${edition}.json`);
  if (!existsSync(manifestPath)) return;
  const fresh = await api(
    "GET",
    `https://api.github.com/repos/${owner}/${repo}/releases/${latestRelease.id}`,
  );
  await uploadFiles(fresh, [manifestPath]);
  console.log(`[publish-distribution] synced latest-${edition}.json onto ${fresh.tag_name}`);
}

function resolvePackage() {
  const manifestPath = join(updatesDir, `latest-${edition}.json`);
  if (!existsSync(manifestPath)) {
    return { error: `Missing ${manifestPath}. Run write-update-manifest.mjs ${edition} first.` };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const version = versionArg || manifest.version;
  const releaseDir = join(updatesDir, `desktop-v${version}`);
  if (!existsSync(releaseDir)) {
    return { error: `Missing release folder ${releaseDir}` };
  }

  const files = [];
  const manifestInRelease = join(releaseDir, `latest-${edition}.json`);
  if (existsSync(manifestInRelease)) files.push(manifestInRelease);
  else files.push(manifestPath);

  const assetUrl = manifest?.platforms?.["windows-x86_64"]?.url ?? "";
  const assetName = assetUrl.split("/").pop();
  if (assetName) {
    for (const n of [assetName, `${assetName}.sig`]) {
      const p = join(releaseDir, n);
      if (existsSync(p) && !files.includes(p)) files.push(p);
    }
  }

  // Fallback: pick any distribution setup in the release folder.
  if (!assetName) {
    for (const name of readdirSync(releaseDir)) {
      if (/distribution/i.test(name) && (name.endsWith("-setup.exe") || name.endsWith("-setup.exe.sig"))) {
        const p = join(releaseDir, name);
        if (!files.includes(p)) files.push(p);
      }
    }
  }

  return { version, releaseDir, files: [...new Set(files)], manifest };
}

async function main() {
  const pkg = resolvePackage();
  if (pkg.error) {
    console.error(`[publish-distribution] ${pkg.error}`);
    process.exit(1);
  }

  console.log(`[publish-distribution] Publishing ${edition} ${pkg.version} as ${auth.username}`);

  const tag = `desktop-v${pkg.version}`;
  const release = await ensureRelease(
    tag,
    `Zivra Distribution ${pkg.version}`,
    "Zivra Distribution System auto-update assets (BARIQ ERP Solutions).",
    true,
  );
  const fresh = await api("GET", `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`);
  await uploadFiles(fresh ?? release, pkg.files);

  const latest = await fetchLatestRelease();
  await syncManifestOntoLatest(latest);

  console.log("[publish-distribution] Done.");
  console.log(
    `  latest-${edition}.json → https://github.com/${owner}/${repo}/releases/latest/download/latest-${edition}.json`,
  );
}

main().catch((err) => {
  console.error("[publish-distribution]", err instanceof Error ? err.message : err);
  process.exit(1);
});
