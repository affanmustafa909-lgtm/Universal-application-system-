import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/**
 * After a signed Tauri build, write latest-{edition}.json for GitHub Releases.
 *
 * Usage:
 *   node scripts/write-update-manifest.mjs <edition> [version]
 *
 * Env:
 *   CARGO_TARGET_DIR — defaults to local src-tauri/target when NSIS exists
 *   TAURI_TARGET — e.g. i686-pc-windows-msvc (finds NSIS under that triple)
 *   UPDATE_DOWNLOAD_BASE — GitHub release asset base URL (no trailing slash)
 */

const edition = (process.argv[2] ?? "").trim();
const versionArg = (process.argv[3] ?? "").trim();
const VALID = new Set([
  "suite",
  "restaurant",
  "ice-cream-bar",
  "general-store",
  "pharmacy",
  "distribution",
  "education",
]);
if (!VALID.has(edition)) {
  console.error(`Usage: node scripts/write-update-manifest.mjs <${[...VALID].join("|")}> [version]`);
  process.exit(1);
}

const ICE_CREAM_REPO = "basir2353/ice-cream-bar-updates";
const DESKTOP_REPO = "basir2353/zivra-desktop-updates";
const DISTRIBUTION_REPO = "basir2353/zivra-distribution-updates";

const launcherRoot = process.cwd();
const localTarget = join(launcherRoot, "src-tauri", "target");
const tauriTarget = (process.env.TAURI_TARGET ?? "").trim();
const cargoTarget =
  process.env.CARGO_TARGET_DIR?.trim() ||
  (existsSync(join(localTarget, "release", "bundle", "nsis")) ||
  existsSync(join(localTarget, "i686-pc-windows-msvc", "release", "bundle", "nsis"))
    ? localTarget
    : join(process.env.TEMP || process.env.TMP || "/tmp", "pops-launcher-cargo-target"));

function resolveNsisDir() {
  const candidates = tauriTarget
    ? [join(cargoTarget, tauriTarget, "release", "bundle", "nsis")]
    : [
        join(cargoTarget, "release", "bundle", "nsis"),
        join(cargoTarget, "i686-pc-windows-msvc", "release", "bundle", "nsis"),
      ];
  return candidates.find((dir) => existsSync(dir)) ?? candidates.at(-1);
}

const nsisDir = resolveNsisDir();
if (!existsSync(nsisDir)) {
  console.error(`[write-update-manifest] Missing NSIS dir: ${nsisDir}`);
  process.exit(1);
}

const setupFiles = readdirSync(nsisDir).filter((f) => f.endsWith("-setup.exe"));
if (setupFiles.length === 0) {
  console.error(`[write-update-manifest] No *-setup.exe in ${nsisDir}`);
  process.exit(1);
}

const productHints = {
  suite: /zivra universal|pops universal|universal management/i,
  restaurant: /zivra restaurant|restaurant management/i,
  "ice-cream-bar": /scoops|ice\s*cream/i,
  "general-store": /zivra general|general\s*store|retail/i,
  pharmacy: /zivra pharmacy|pharmacy management/i,
  distribution: /zivra distribution|medical distribution|distribution system/i,
  education: /educationflow|education\s*flow|education erp|school.*academy.*college/i,
};
const hint = productHints[edition];
function versionTuple(name) {
  const m = name.match(/_(\d+)\.(\d+)\.(\d+)_/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const preferX86 =
  /i686|x86/i.test(tauriTarget) || /i686-pc-windows-msvc/i.test(nsisDir);

const ranked = setupFiles
  .filter((f) => hint.test(f))
  .filter((f) => (preferX86 ? /_x86-setup\.exe$/i.test(f) : /_x64-setup\.exe$/i.test(f) || !/_x86-setup\.exe$/i.test(f)))
  .sort((a, b) => {
    const va = versionTuple(a);
    const vb = versionTuple(b);
    for (let i = 0; i < 3; i++) {
      if (vb[i] !== va[i]) return vb[i] - va[i];
    }
    try {
      return statSync(join(nsisDir, b)).mtimeMs - statSync(join(nsisDir, a)).mtimeMs;
    } catch {
      return b.localeCompare(a);
    }
  });

const setupName =
  ranked[0] ??
  setupFiles
    .filter((f) => hint.test(f))
    .sort((a, b) => {
      try {
        return statSync(join(nsisDir, b)).mtimeMs - statSync(join(nsisDir, a)).mtimeMs;
      } catch {
        return b.localeCompare(a);
      }
    })[0] ??
  setupFiles.sort().at(-1);

const setupPath = join(nsisDir, setupName);
const sigPath = `${setupPath}.sig`;
if (!existsSync(sigPath)) {
  console.error(
    `[write-update-manifest] Missing signature: ${sigPath}\n` +
      "Build with TAURI_SIGNING_PRIVATE_KEY(_PATH) and createUpdaterArtifacts=true.",
  );
  process.exit(1);
}

const version =
  versionArg ||
  setupName.match(/_(\d+\.\d+\.\d+)_/)?.[1] ||
  "0.0.0";

const isX86 = /_x86-setup\.exe$/i.test(setupName) || preferX86;
const platformKey = isX86 ? "windows-i686" : "windows-x86_64";

const safeAsset = setupName.replace(/\s+/g, "-");
const repo =
  edition === "ice-cream-bar"
    ? ICE_CREAM_REPO
    : edition === "distribution"
      ? DISTRIBUTION_REPO
      : DESKTOP_REPO;
const tagPrefix = edition === "ice-cream-bar" ? "ice-cream" : "desktop";
const base =
  (process.env.UPDATE_DOWNLOAD_BASE ?? "").trim().replace(/\/$/, "") ||
  `https://github.com/${repo}/releases/download/${tagPrefix}-v${version}`;

const signature = readFileSync(sigPath, "utf8").trim();
const notesByEdition = {
  suite: `Zivra Universal Management System update ${version} (BARIQ ERP Solutions)`,
  restaurant: `Zivra Restaurant Management System update ${version}`,
  "ice-cream-bar": `Scoops Ice Cream Bar update ${version}`,
  "general-store": `Zivra General Store Management System update ${version}`,
  pharmacy: `Zivra Pharmacy Management System update ${version}`,
  distribution: `Zivra Distribution System update ${version} (BARIQ ERP Solutions)`,
  education: `EducationFlow ERP update ${version} (BARIQ ERP Solutions)`,
};

const platforms = {
  [platformKey]: {
    signature,
    url: `${base}/${safeAsset}`,
  },
};

// Keep prior 64-bit / 32-bit entry if this release folder already has one.
const outDir = join(process.cwd(), "..", "..", "dist-installers", "updates");
mkdirSync(outDir, { recursive: true });
const manifestName = `latest-${edition}.json`;
const manifestPath = join(outDir, manifestName);
if (existsSync(manifestPath)) {
  try {
    const prev = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (prev?.version === version && prev?.platforms && typeof prev.platforms === "object") {
      for (const [key, value] of Object.entries(prev.platforms)) {
        if (key !== platformKey) platforms[key] = value;
      }
    }
  } catch {
    /* ignore */
  }
}

const manifest = {
  version,
  notes: notesByEdition[edition] ?? `Desktop ${edition} update ${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const releaseDir = join(outDir, `${tagPrefix}-v${version}`);
mkdirSync(releaseDir, { recursive: true });
copyFileSync(setupPath, join(releaseDir, safeAsset));
copyFileSync(sigPath, join(releaseDir, `${safeAsset}.sig`));
copyFileSync(manifestPath, join(releaseDir, manifestName));
copyFileSync(setupPath, join(outDir, safeAsset));
copyFileSync(sigPath, join(outDir, `${safeAsset}.sig`));

console.log(`[write-update-manifest] ${manifestName}`);
console.log(`  version:  ${version}`);
console.log(`  platform: ${platformKey}`);
console.log(`  url:      ${platforms[platformKey].url}`);
console.log(`  out:      ${manifestPath}`);
console.log(`  release:  ${releaseDir}`);
