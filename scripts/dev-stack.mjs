import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { requireBackendRoot } from "./resolve-backend.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = requireBackendRoot();

function run(label, args, cwd) {
  const child = spawn("corepack", ["pnpm", ...args], {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[dev-stack] ${label} exited ${code}`);
      process.exit(code);
    }
  });
  return child;
}

console.log(`[dev-stack] API from sibling ${backendDir}`);
run("api", ["--filter", "@platform/api", "start"], backendDir);
run("web", ["--filter", "@platform/launcher", "dev:web"], root);
