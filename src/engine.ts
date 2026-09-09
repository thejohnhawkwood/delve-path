import { getPlatform } from "./platform";

export async function engineCall<T = unknown>(op: string, payload: unknown = {}): Promise<T> {
  return getPlatform().calc.engineCall<T>(op, payload);
}

export function parseEngineError(e: unknown): string {
  const raw = String(e);
  try {
    const obj = JSON.parse(raw) as { error?: string };
    if (obj.error) return obj.error;
  } catch {
    /* keep raw */
  }
  return raw;
}
