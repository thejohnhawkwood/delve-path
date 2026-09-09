export const CREDIT = "Created by Philip Bird — Mithril Consulting";

export const SAFETY =
  "Engineering prototype / evaluation software — not certified. Not regulator-approved. Not for collision avoidance, well control, or steering decisions.";

export const mithrilUrl = "https://mithrilconsulting.io";
export const mithrilContactUrl = "https://mithrilconsulting.io/contact";

export const sourceUrl =
  import.meta.env.VITE_SOURCE_URL || "https://github.com/thejohnhawkwood/delve-path";

/** Historical shared folder, retained for integrations that import this constant. */
export const APPROVED_DESKTOP_DOWNLOAD_URL =
  "https://drive.google.com/drive/folders/1nnhXHkcPL2cjl5L7wZVUMPQnb6cnc3_d?usp=sharing";

export const desktopDownloadUrl =
  import.meta.env.VITE_DESKTOP_DOWNLOAD_URL || "https://github.com/thejohnhawkwood/delve-path/releases/download/v0.2.2/DelvePath_0.2.2_x64-setup.exe";

export const appVersion = typeof __DELVE_VERSION__ !== "undefined" ? __DELVE_VERSION__ : "0.2.2";
export const gitSha = typeof __DELVE_GIT_SHA__ !== "undefined" ? __DELVE_GIT_SHA__ : "unknown";

export const desktopMeta = {
  version: import.meta.env.VITE_DESKTOP_VERSION || "0.2.2",
  filename: import.meta.env.VITE_DESKTOP_FILENAME || "DelvePath_0.2.2_x64-setup.exe",
  size: import.meta.env.VITE_DESKTOP_SIZE || "",
  date: import.meta.env.VITE_DESKTOP_DATE || "",
  sha256: import.meta.env.VITE_DESKTOP_SHA256 || "",
  windows: import.meta.env.VITE_DESKTOP_WINDOWS || "Windows 10/11 64-bit",
  githubRelease: import.meta.env.VITE_DESKTOP_GITHUB_RELEASE || "https://github.com/thejohnhawkwood/delve-path/releases/tag/v0.2.2",
};

export function externalRel(): { target: "_blank"; rel: "noopener noreferrer" } {
  return { target: "_blank", rel: "noopener noreferrer" };
}

/** Public-folder URL that respects Vite `base` (standalone `/` or `/delvepath/`). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${path.replace(/^\/+/, "")}`;
}
