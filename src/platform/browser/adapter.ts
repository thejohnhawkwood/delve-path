import { createBrowserRepository, openDelveDb } from "./idb";
import { browserCalc, initBrowserCalc } from "./calc";
import { browserFiles } from "./files";
import type { Platform } from "../types";

export async function createBrowserPlatform(applicationVersion: string): Promise<Platform> {
  await initBrowserCalc();
  const db = await openDelveDb();
  const newId = () => crypto.randomUUID();
  return {
    kind: "browser",
    calc: browserCalc,
    repo: createBrowserRepository(db, newId, applicationVersion),
    files: browserFiles,
    newId,
  };
}
