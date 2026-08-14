/// <reference types="vite/client" />

declare module "plotly.js-dist-min" {
  const Plotly: {
    newPlot: (
      el: HTMLElement,
      data: unknown[],
      layout?: unknown,
      config?: unknown
    ) => Promise<unknown>;
    react: (
      el: HTMLElement,
      data: unknown[],
      layout?: unknown,
      config?: unknown
    ) => Promise<unknown>;
    purge: (el: HTMLElement) => void;
  };
  export default Plotly;
}
