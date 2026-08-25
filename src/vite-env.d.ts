/// <reference types="vite/client" />

declare const __DELVE_VERSION__: string;
declare const __DELVE_GIT_SHA__: string;

interface ImportMetaEnv {
  readonly VITE_DESKTOP_DOWNLOAD_URL?: string;
  readonly VITE_DESKTOP_VERSION?: string;
  readonly VITE_DESKTOP_FILENAME?: string;
  readonly VITE_DESKTOP_SIZE?: string;
  readonly VITE_DESKTOP_DATE?: string;
  readonly VITE_DESKTOP_SHA256?: string;
  readonly VITE_DESKTOP_WINDOWS?: string;
  readonly VITE_DESKTOP_GITHUB_RELEASE?: string;
  readonly VITE_SOURCE_URL?: string;
}

declare module "*?raw" {
  const content: string;
  export default content;
}

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
