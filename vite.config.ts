import { execSync } from "node:child_process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  base: process.env.BASE_URL || "/",
  plugins: [react()],
  define: {
    __DELVE_VERSION__: JSON.stringify(process.env.npm_package_version || "0.1.1"),
    __DELVE_GIT_SHA__: JSON.stringify(gitSha()),
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
