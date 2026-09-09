import { invoke } from "@tauri-apps/api/core";
import type { Trajectory, ValidationIssue } from "../../domain";
import type { CalculationService } from "../types";

export const tauriCalc: CalculationService = {
  calculate(req) {
    return invoke<Trajectory>("calculate", { req });
  },
  validateSurvey(req) {
    return invoke<ValidationIssue[]>("validate_survey", { req });
  },
  projectTangentMd(req, addedMd) {
    return invoke<Trajectory>("project_tangent_md", { req, addedMd });
  },
  projectTangentTvd(req, targetTvd) {
    return invoke<Trajectory>("project_tangent_tvd", { req, targetTvd });
  },
  projectTangentBit(req, bitToSensor) {
    return invoke<Trajectory>("project_tangent_bit", { req, bitToSensor });
  },
  async engineCall<T = unknown>(op: string, payload: unknown = {}) {
    const raw = await invoke<string>("engine_call", { req: JSON.stringify({ op, payload }) });
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(raw);
    }
  },
};
