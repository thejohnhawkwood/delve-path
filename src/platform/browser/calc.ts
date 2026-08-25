import type { Trajectory, ValidationIssue } from "../../domain";
import type { CalcRequest } from "../../records";
import type { CalculationService } from "../types";

type WasmApi = typeof import("../../generated/delve-wasm/delve_wasm.js");

let wasm: WasmApi | null = null;
let initOnce: Promise<void> | null = null;

export function initBrowserCalc(module?: BufferSource): Promise<void> {
  if (!initOnce) {
    initOnce = (async () => {
      const mod = await import("../../generated/delve-wasm/delve_wasm.js");
      await mod.default(module ? { module_or_path: module } : undefined);
      wasm = mod;
    })();
  }
  return initOnce;
}

function api(): WasmApi {
  if (!wasm) throw new Error("WASM calculation engine is not initialized.");
  return wasm;
}

export const browserCalc: CalculationService = {
  async calculate(req: CalcRequest): Promise<Trajectory> {
    return api().calculate(req) as Trajectory;
  },
  async validateSurvey(req: CalcRequest): Promise<ValidationIssue[]> {
    return api().validate_survey(req) as ValidationIssue[];
  },
  async projectTangentMd(req: CalcRequest, addedMd: number): Promise<Trajectory> {
    return api().project_tangent_md(req, addedMd) as Trajectory;
  },
  async projectTangentTvd(req: CalcRequest, targetTvd: number): Promise<Trajectory> {
    return api().project_tangent_tvd(req, targetTvd) as Trajectory;
  },
  async projectTangentBit(req: CalcRequest, bitToSensor: number): Promise<Trajectory> {
    return api().project_tangent_bit(req, bitToSensor) as Trajectory;
  },
};
