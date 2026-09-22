import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Publish Ice Cream Bar updater assets to affanmustafa909-lgtm GitHub.
 *
 * Usage (after a signed ice-cream-bar build):
 *   node scripts/write-update-manifest.mjs ice-cream-bar
 *   node scripts/publish-ice-cream-update.mjs [version]
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const updatesDir = join(repoRoot, "dist-installers", "updates");
const version = (process.argv[2] ?? "").trim();
const owner = "basir2353";
const repo = "ice-cream-bar-updates";

const folders = existsSync(updatesDir)
  ? readdirSync(updatesDir).filter((name) => name.startsWith("ice-cream-v")).sort()
  : [];
const releaseDir = version
  ? join(updatesDir, `ice-cream-v${version}`)
  : folders.length
    ? join(updatesDir, folders.at(-1))
    : "";

if (!releaseDir || !existsSync(releaseDir)) {
  console.error("[publish-ice-cream] Missing update folder. Run write-update-manifest.mjs first.");
  process.exit(1);
}

const tag = releaseDir.split(/[/\\]/).at(-1);
const files = readdirSync(releaseDir)
  .filter((name) => !name.startsWith("."))
  .map((name) => join(releaseDir, name));
if (files.length === 0) {
  console.error(`[publish-ice-cream] No files in ${releaseDir}`);
  process.exit(1);
}

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
  console.error("[publish-ice-cream] GitHub credentials not found. Sign in to GitHub in Git, then retry.");
  process.exit(1);
}

const apiHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${auth.token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "ice-cream-bar-updater",
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

async function ensureRelease(releaseTag, makeLatest) {
  const existingUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${releaseTag}`;
  const createUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
  try {
    return await api("GET", existingUrl);
  } catch (err) {
    if (!String(err.message).includes("HTTP 404")) throw err;
  }
  return api(
    "POST",
    createUrl,
    JSON.stringify({
      tag_name: releaseTag,
      target_commitish: "main",
      name: `Scoops Ice Cream Bar ${tag.replace("ice-cream-", "")}`,
      body: "Ice Cream Bar only. Separate auto-update feed on affanmustafa909-lgtm.",
      draft: false,
      prerelease: false,
      make_latest: makeLatest ? "true" : "false",
    }),
    { "Content-Type": "application/json" },
  );
}

async function uploadAssets(release) {
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
    console.log(`[publish-ice-cream] uploaded ${name} → ${release.tag_name}`);
  }
}

console.log(`[publish-ice-cream] Publishing ${tag} to ${owner}/${repo} as ${auth.username}`);

try {
  const versioned = await ensureRelease(tag, true);
  await uploadAssets(versioned);
  const floating = await ensureRelease("ice-cream-latest", false);
  await uploadAssets(floating);
  console.log("[publish-ice-cream] Done.");
  console.log(`  latest json: https://github.com/${owner}/${repo}/releases/latest/download/latest-ice-cream-bar.json`);
} catch (err) {
  console.error("[publish-ice-cream]", err instanceof Error ? err.message : err);
  process.exit(1);
}
