import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
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
    return invoke<{ name: string; text: string } | null>("import_text_file");
  },
  async saveTextFile(filename, text) {
    await invoke("export_text_file", { filename, text });
  },
};
