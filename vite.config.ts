import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function sourceFingerprint(): string {
  const files: string[] = ["Cargo.toml", "Cargo.lock", "package.json", "package-lock.json"];
  const walk = (dir: string) => { for(const e of readdirSync(dir,{withFileTypes:true})) {
    const path = `${dir}/${e.name}`;
    if(e.isDirectory()) { if(!["target","gen"].includes(e.name)) walk(path); }
    else if(/\.(rs|tsx?|css|toml|json)$/.test(e.name)) files.push(path);
  }};
  for(const dir of ["crates","src","src-tauri/src"]) walk(dir);
  const hash = createHash("sha256");
  for(const file of files.sort()) { hash.update(file); hash.update("\0"); hash.update(readFileSync(file,"utf8").replace(/\r\n/g,"\n")); hash.update("\0"); }
  return hash.digest("hex");
}

export default defineConfig({
  base: process.env.BASE_URL || "/",
  plugins: [react()],
  define: {
    __DELVE_VERSION__: JSON.stringify(process.env.npm_package_version || "0.1.1"),
    __DELVE_GIT_SHA__: JSON.stringify(gitSha()),
    __DELVE_SOURCE_SHA256__: JSON.stringify(sourceFingerprint()),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: ["es2021", "chrome100", "safari14"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("plotly.js")) return "plotly";
          if (id.includes("generated/delve-wasm")) return "delve-wasm";
        },
      },
    },
  },
});
