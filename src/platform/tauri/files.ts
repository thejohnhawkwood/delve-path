import { open, save } from "@tauri-apps/plugin-dialog";
import type { FileOperations } from "../types";

export const tauriFiles: FileOperations = {
  pickNewProjectPath() {
    return save({
      title: "New DelvePath project",
      defaultPath: "project.delvepath",
      filters: [{ name: "DelvePath project", extensions: ["delvepath"] }],
    });
  },
  pickOpenProjectPath() {
    return open({
      title: "Open DelvePath project",
      multiple: false,
      filters: [{ name: "DelvePath project", extensions: ["delvepath", "db"] }],
    }) as Promise<string | null>;
  },
  pickTextFile() {
    return Promise.reject(new Error("Use the desktop CSV import control."));
  },
  async saveTextFile() {
    throw new Error("Use the desktop CSV export control.");
  },
};
