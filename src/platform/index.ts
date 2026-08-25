import { isTauri } from "./detect";
import type { Platform } from "./types";

export { isTauri } from "./detect";
export type {
  BrowserProjectSnapshot,
  CalculationService,
  FileOperations,
  Platform,
  ProjectRepository,
  ProjectSummary,
  RuntimeKind,
} from "./types";
export { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from "./types";
export { parseSnapshot, SnapshotError, buildSnapshot } from "./snapshot";

let platform: Platform | null = null;

export async function initPlatform(applicationVersion = "0.1.1"): Promise<Platform> {
  if (platform) return platform;
  if (isTauri()) {
    const { createTauriPlatform } = await import("./tauri/adapter");
    platform = createTauriPlatform();
    return platform;
  }
  const { createBrowserPlatform } = await import("./browser/adapter");
  platform = await createBrowserPlatform(applicationVersion);
  return platform;
}

export function getPlatform(): Platform {
  if (!platform) {
    throw new Error("Platform is not initialized. Call initPlatform() before rendering the app.");
  }
  return platform;
}
