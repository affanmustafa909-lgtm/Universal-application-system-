import { HAS_ICE_CREAM_BAR, PLATFORM_EDITION } from "./edition";

/** Last published suite on the old GitHub feed that does not ship Ice Cream Bar. */
const LAST_SUITE_WITHOUT_ICE_CREAM = "0.3.58";

function parseSemver(raw: string): [number, number, number] | null {
  const m = raw.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

/**
 * Old 0.3.58 (and earlier) suite installers overwrite this app and drop Ice Cream Bar.
 * Keep those updates off the banner and block Update & Restart.
 */
export function isSafeDesktopUpdate(version: string, notes = ""): boolean {
  // Ice Cream Bar EXE uses its own GitHub feed — never the old suite/restaurant channel.
  if (PLATFORM_EDITION === "ice-cream-bar") return true;
  const body = notes.toLowerCase();
  if (body.includes("ice cream") || body.includes("ice-cream") || body.includes("scoops")) {
    return true;
  }
  if (!HAS_ICE_CREAM_BAR) return true;
  return compareSemver(version, LAST_SUITE_WITHOUT_ICE_CREAM) > 0;
}
