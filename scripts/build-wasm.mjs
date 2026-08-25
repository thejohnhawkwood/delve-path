/**
 * Compile delve-core to WebAssembly and emit JS bindings for the Vite app.
 * Requires rustup target wasm32-unknown-unknown and wasm-bindgen-cli 0.2.104.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "generated", "delve-wasm");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with exit ${result.status}`);
  }
}

mkdirSync(outDir, { recursive: true });
run("cargo", ["build", "-p", "delve-wasm", "--target", "wasm32-unknown-unknown", "--release"]);
run("wasm-bindgen", [
  join(root, "target", "wasm32-unknown-unknown", "release", "delve_wasm.wasm"),
  "--out-dir",
  outDir,
  "--target",
  "web",
  "--typescript",
]);
console.log(`WASM bindings written to ${outDir}`);
