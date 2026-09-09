import init, { engine_call } from "../generated/delve-wasm/delve_wasm.js";
self.onmessage = async (
  event: MessageEvent<{
    op: string;
    payload: unknown;
    module: WebAssembly.Module;
  }>,
) => {
  try {
    await init({ module_or_path: event.data.module });
    const result: unknown = JSON.parse(
      engine_call(
        JSON.stringify({ op: event.data.op, payload: event.data.payload }),
      ),
    );
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({ error: String(e) });
  }
};
