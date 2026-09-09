import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import init, { engine_call } from "../src/generated/delve-wasm/delve_wasm.js";

const build = spawnSync(
  "cargo",
  ["build", "-p", "delve-engine", "--example", "engine-json"],
  { encoding: "utf8" },
);
if (build.status !== 0) throw new Error(build.stderr);
const exe = `target/debug/examples/engine-json${process.platform === "win32" ? ".exe" : ""}`;
const native = (op, payload = {}) => {
  const out = spawnSync(exe, [], {
    input: JSON.stringify({ op, payload }),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (out.status !== 0) throw new Error(out.stderr);
  return JSON.parse(out.stdout);
};
await init({
  module_or_path: readFileSync("src/generated/delve-wasm/delve_wasm_bg.wasm"),
});
const wasm = (op, payload = {}) =>
  JSON.parse(engine_call(JSON.stringify({ op, payload })));
let compared = 0;
let maxDifference = 0;
function compare(a, b, path = "result") {
  if (typeof a === "number" && typeof b === "number") {
    compared++;
    const delta = Math.abs(a - b);
    maxDifference = Math.max(maxDifference, delta);
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      delta > 1e-8 + 1e-10 * Math.max(Math.abs(a), Math.abs(b))
    )
      throw new Error(`${path}: ${a} != ${b}`);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error(`${path}: length mismatch`);
    a.forEach((v, i) => compare(v, b[i], `${path}[${i}]`));
  } else if (a && b && typeof a === "object" && typeof b === "object") {
    if (
      JSON.stringify(Object.keys(a).sort()) !==
      JSON.stringify(Object.keys(b).sort())
    )
      throw new Error(`${path}: keys mismatch`);
    for (const k of Object.keys(a)) compare(a[k], b[k], `${path}.${k}`);
  } else if (a !== b) throw new Error(`${path}: value mismatch`);
}
const demo = native("collision_demo");
compare(demo, wasm("collision_demo"));
const variants = [
  demo,
  { ...demo, max_dls: 0.001 },
  { ...demo, confidence: 0.99 },
  { ...demo, margin: 8 },
];
const timings = [];
let result;
for (const input of variants) {
  const n = native("generate_drill_path", input);
  const start = performance.now();
  const w = wasm("generate_drill_path", input);
  timings.push(performance.now() - start);
  compare(n, w);
  result ??= w;
}
if (result.baseline.summary.meets_constraints || !result.alternatives.length)
  throw new Error("The demo must require and find a correction.");
for (const g of result.alternatives) {
  if (
    g.summary.min_clearance_bound < 0 ||
    g.summary.max_dls_bound > demo.max_dls
  )
    throw new Error("Candidate violates constraints");
}
mkdirSync("artifacts/verification", { recursive: true });
writeFileSync(
  "artifacts/verification/collision-case.json",
  JSON.stringify(demo, null, 2),
);
writeFileSync(
  "artifacts/verification/collision-native-wasm-result.json",
  JSON.stringify(result, null, 2),
);
const report = {
  variantCount: variants.length,
  comparedNumericValues: compared,
  maxAbsoluteDifference: maxDifference,
  wasmMilliseconds: timings,
  baseline: result.baseline.summary,
  selected: result.alternatives[0].summary,
};
writeFileSync(
  "artifacts/verification/collision-parity.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
