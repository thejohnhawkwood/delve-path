import { invoke } from "@tauri-apps/api/core";
import { tauriCalc } from "./calc";
import { tauriFiles } from "./files";
import { createTauriRepository } from "./repo";
import type { Platform } from "../types";

export function createTauriPlatform(): Platform {
  return {
    kind: "tauri",
    calc: tauriCalc,
    repo: createTauriRepository(),
    files: tauriFiles,
    newId() {
      return crypto.randomUUID();
    },
  };
}

export async function tauriNewUuid(): Promise<string> {
  return invoke<string>("new_uuid");
}
