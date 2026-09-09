import { useCallback, useEffect, useRef, useState } from "react";
import Plotly from "plotly.js-dist-min";

interface Figure {
  data: unknown[];
  layout: Record<string, unknown>;
  mode: string;
  onReady: (node: HTMLDivElement) => void;
}

/** One serialized owner for draw, resize, view changes and disposal. */
export function usePlotlyView() {
  const element = useRef<HTMLDivElement>(null);
  const latest = useRef<Figure | null>(null);
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  const request = useRef<(() => void) | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    let disposed = false;
    let revision = 0;
    let frame = 0;
    let mode: string | null = null;
    let renderedSize = "";
    const schedule = () => {
      const next = ++revision;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        tail.current = tail.current.catch(() => undefined).then(async () => {
          if (disposed || next !== revision || !node.isConnected) return;
          const figure = latest.current;
          if (!figure) return;
          const width = node.clientWidth;
          const height = node.clientHeight;
          if (!width || !height) {
            Plotly.purge(node);
            mode = null;
            renderedSize = "";
            return;
          }
          try {
            if (mode !== figure.mode) {
              Plotly.purge(node);
              mode = null;
            }
            const draw = mode === null ? Plotly.newPlot : Plotly.react;
            await draw(node, figure.data, { ...figure.layout, width, height, autosize: false }, {
              displayModeBar: false, responsive: false, staticPlot: false,
            });
            mode = figure.mode;
            renderedSize = `${width}:${height}`;
            if (!disposed && next === revision) {
              figure.onReady(node);
              setError("");
            }
          } catch (cause) {
            Plotly.purge(node);
            mode = null;
            if (!disposed && next === revision) setError(`Preview could not render: ${String(cause)}`);
          }
        });
      });
    };
    request.current = schedule;
    const observer = new ResizeObserver(() => {
      if (`${node.clientWidth}:${node.clientHeight}` !== renderedSize) schedule();
    });
    observer.observe(node);
    schedule();
    return () => {
      disposed = true;
      revision++;
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (request.current === schedule) request.current = null;
      // Capture this node. React may already have cleared/replaced element.current.
      tail.current = tail.current.catch(() => undefined).then(() => Plotly.purge(node));
    };
  }, []);

  const render = useCallback((figure: Figure) => {
    latest.current = figure;
    request.current?.();
  }, []);
  const retry = useCallback(() => request.current?.(), []);
  return { element, render, error, retry };
}
