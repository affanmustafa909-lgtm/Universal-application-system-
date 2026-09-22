import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let sqlJsDir;
try {
  const entry = require.resolve("sql.js");
  sqlJsDir = dirname(entry);
} catch {
  console.warn("[copy-sql-wasm] sql.js not installed yet; skipping");
  process.exit(0);
}

const distDir = join(sqlJsDir, "dist");
const wasmDestDir = join(__dirname, "..", "public");
mkdirSync(wasmDestDir, { recursive: true });

/** Browser sql.js (Vite) asks for sql-wasm-browser.wasm; Node build uses sql-wasm.wasm. */
const files = ["sql-wasm-browser.wasm", "sql-wasm.wasm"];
let copied = 0;
for (const name of files) {
  const src = join(distDir, name);
  if (!existsSync(src)) {
    console.warn("[copy-sql-wasm] missing", src);
    continue;
  }
  const dest = join(wasmDestDir, name);
  copyFileSync(src, dest);
  console.log("[copy-sql-wasm] copied to", dest);
  copied += 1;
}

if (!copied) {
  console.warn("[copy-sql-wasm] no wasm files copied");
}
