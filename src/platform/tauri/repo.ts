import { invoke } from "@tauri-apps/api/core";
import type { Target } from "../../domain";
import type { HoleRecord, ProjectRecord, StationRecord } from "../../records";
import type { ProjectRepository } from "../types";

export function createTauriRepository(): ProjectRepository {
  return {
    create({ name, client, path }) {
      if (!path) return Promise.reject(new Error("A file path is required for a desktop project."));
      return invoke<ProjectRecord>("create_project", { path, name, client });
    },
    open(idOrPath) {
      return invoke<ProjectRecord>("open_project", { path: idOrPath });
    },
    async list() {
      return [];
    },
    async rename() {
      throw new Error("Rename the desktop project file in Explorer, or change the name field in the toolbar.");
    },
    async deleteProject() {
      throw new Error("Delete a desktop *.delvepath file in Explorer.");
    },
    async getLastOpenedId() {
      return null;
    },
    async setLastOpenedId() {
      /* desktop last-opened is the SQLite file the user opened */
    },
    saveHole(hole) {
      return invoke("save_hole", { hole });
    },
    saveStations(holeId, stations) {
      return invoke("save_stations", { holeId, stations });
    },
    loadStations(holeId) {
      return invoke<StationRecord[]>("load_stations", { holeId });
    },
    saveTarget(target) {
      return invoke("save_target", { target });
    },
    loadTargets(holeId) {
      return invoke<Target[]>("load_targets", { holeId });
    },
    listHoles(projectId) {
      return invoke<HoleRecord[]>("list_holes", { projectId });
    },
    deleteTarget(targetId) {
      return invoke("delete_target", { targetId });
    },
    deleteHole(holeId) {
      return invoke("delete_hole", { holeId });
    },
    async exportSnapshot() {
      throw new Error("Use Save / the *.delvepath SQLite file on desktop. Browser JSON snapshots are a separate format.");
    },
    async importSnapshot() {
      throw new Error("Desktop opens *.delvepath SQLite files, not browser .delvepath.json snapshots.");
    },
    async resetAll() {
      throw new Error("Desktop projects are files on disk. Create a new project instead of resetting browser demo data.");
    },
  };
}
