import { engineCall } from "../engine";
import { isTauri } from "../platform";
import { browserWasmModule } from "../platform/browser/calc";
import EngineWorker from "./engine.worker?worker&inline";
/** A cancellable worker keeps WASM candidate search off the React thread.
 * Desktop uses the same Rust dispatch in an async native command. */
export function runCollision<T>(
  op: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (isTauri()) return engineCall<T>(op, payload);
  return new Promise((resolve, reject) => {
    const worker = new EngineWorker();
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(new Error("Calculation cancelled."));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onmessage = (
      event: MessageEvent<{ result?: T; error?: string }>,
    ) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result as T);
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message));
    };
    worker.postMessage({ op, payload, module: browserWasmModule() });
  });
}
