import { beforeAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import init, { engine_call } from "../generated/delve-wasm/delve_wasm.js";
import { candidateCsv, makeAudit, verifyAudit } from "./audit";
import type { Generation } from "./types";
let result: Generation;
beforeAll(async () => {
  await init({
    module_or_path: readFileSync("src/generated/delve-wasm/delve_wasm_bg.wasm"),
  });
  const input = JSON.parse(
    engine_call(JSON.stringify({ op: "collision_demo", payload: {} })),
  );
  result = JSON.parse(
    engine_call(JSON.stringify({ op: "generate_drill_path", payload: input })),
  );
});
it("audits preserve complete inputs and detect input/result tampering", async () => {
  const audit = await makeAudit(result);
  await verifyAudit(audit);
  const tampered = structuredClone(audit);
  tampered.result.input.margin += 1;
  await expect(verifyAudit(tampered)).rejects.toThrow("hashes");
  const output = structuredClone(audit);
  output.result.alternatives[0].summary.min_clearance_bound += 1;
  await expect(verifyAudit(output)).rejects.toThrow("hashes");
});
it("exports planned candidates with units and MD error bounds", () => {
  const csv = candidateCsv(result, result.alternatives[0].summary.id);
  expect(csv).toContain("SYNTHETIC / constructed");
  expect(csv).toContain("cumulative MD error bound");
  expect(csv).toContain("planned,");
  expect(csv).not.toContain("measured,");
  expect(() => candidateCsv(result, "missing")).toThrow("Select");
});
