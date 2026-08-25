import type { FileOperations } from "../types";

export const browserFiles: FileOperations = {
  async pickNewProjectPath() {
    return null;
  },
  async pickOpenProjectPath() {
    return null;
  },
  pickTextFile(accept: string) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = () => {
        const f = input.files?.[0];
        if (!f) {
          resolve(null);
          return;
        }
        void f.text().then((text) => resolve({ name: f.name, text }));
      };
      input.click();
    });
  },
  async saveTextFile(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
