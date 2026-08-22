import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const universalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Sibling folder only — never a copy inside Universal. */
export function resolveBackendRoot() {
  const sibling = join(universalRoot, "..", "backend-system");
  if (existsSync(join(sibling, "package.json"))) return sibling;
  return null;
}

export function requireBackendRoot() {
  const dir = resolveBackendRoot();
  if (!dir) {
    console.error("[backend] Sibling folder missing: e:\\rpos new\\backend-system");
    process.exit(1);
  }
  return dir;
}
