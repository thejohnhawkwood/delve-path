import type { Target } from "../../domain";
import type { HoleRecord, ProjectRecord, StationRecord } from "../../records";
import { buildSnapshot, parseSnapshot } from "../snapshot";
import type { BrowserProjectSnapshot, ProjectRepository, ProjectSummary } from "../types";

export const IDB_NAME = "delvepath";
export const IDB_SCHEMA_VERSION = 1;

type MetaRow = { key: string; value: string };

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openDelveDb(indexedDBImpl: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDBImpl.open(IDB_NAME, IDB_SCHEMA_VERSION);
    open.onupgradeneeded = (event) => {
      const db = open.result;
      const from = event.oldVersion;
      if (from < 1) {
        db.createObjectStore("projects", { keyPath: "id" });
        const holes = db.createObjectStore("holes", { keyPath: "id" });
        holes.createIndex("project_id", "project_id");
        const stations = db.createObjectStore("stations", { keyPath: "id" });
        stations.createIndex("hole_id", "hole_id");
        const targets = db.createObjectStore("targets", { keyPath: "id" });
        targets.createIndex("hole_id", "hole_id");
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("Failed to open DelvePath IndexedDB"));
  });
}

export function createBrowserRepository(
  db: IDBDatabase,
  newId: () => string,
  applicationVersion: string
): ProjectRepository {
  async function all<T>(store: string): Promise<T[]> {
    return req(db.transaction(store, "readonly").objectStore(store).getAll()) as Promise<T[]>;
  }

  async function byIndex<T>(store: string, index: string, key: string): Promise<T[]> {
    return req(
      db.transaction(store, "readonly").objectStore(store).index(index).getAll(key)
    ) as Promise<T[]>;
  }

  return {
    async create(input) {
      const rec: ProjectRecord & { updatedAt: string } = {
        id: newId(),
        name: input.name,
        client: input.client,
        notes: "",
        updatedAt: new Date().toISOString(),
      };
      const tx = db.transaction(["projects", "meta"], "readwrite");
      tx.objectStore("projects").put(rec);
      tx.objectStore("meta").put({ key: "lastOpenedId", value: rec.id } satisfies MetaRow);
      await txDone(tx);
      return rec;
    },

    async open(idOrPath) {
      const rec = (await req(
        db.transaction("projects", "readonly").objectStore("projects").get(idOrPath)
      )) as (ProjectRecord & { updatedAt?: string }) | undefined;
      if (!rec) throw new Error("No browser project with that id.");
      await this.setLastOpenedId(rec.id);
      return rec;
    },

    async list() {
      const rows = (await all<ProjectRecord & { updatedAt?: string }>("projects")).map((p) => ({
        id: p.id,
        name: p.name,
        client: p.client,
        updatedAt: p.updatedAt ?? "",
      }));
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return rows as ProjectSummary[];
    },

    async rename(id, name) {
      const tx = db.transaction("projects", "readwrite");
      const store = tx.objectStore("projects");
      const rec = (await req(store.get(id))) as (ProjectRecord & { updatedAt?: string }) | undefined;
      if (!rec) throw new Error("Project not found.");
      rec.name = name;
      rec.updatedAt = new Date().toISOString();
      store.put(rec);
      await txDone(tx);
    },

    async deleteProject(id) {
      const holes = await byIndex<HoleRecord>("holes", "project_id", id);
      const stationIds: string[] = [];
      const targetIds: string[] = [];
      for (const h of holes) {
        stationIds.push(...(await byIndex<StationRecord>("stations", "hole_id", h.id)).map((s) => s.id));
        targetIds.push(...(await byIndex<Target>("targets", "hole_id", h.id)).map((t) => t.id));
      }
      const last = await this.getLastOpenedId();
      const tx = db.transaction(["projects", "holes", "stations", "targets", "meta"], "readwrite");
      tx.objectStore("projects").delete(id);
      for (const sid of stationIds) tx.objectStore("stations").delete(sid);
      for (const tid of targetIds) tx.objectStore("targets").delete(tid);
      for (const h of holes) tx.objectStore("holes").delete(h.id);
      if (last === id) tx.objectStore("meta").delete("lastOpenedId");
      await txDone(tx);
    },

    async getLastOpenedId() {
      const row = (await req(
        db.transaction("meta", "readonly").objectStore("meta").get("lastOpenedId")
      )) as MetaRow | undefined;
      return row?.value ?? null;
    },

    async setLastOpenedId(id) {
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put({ key: "lastOpenedId", value: id } satisfies MetaRow);
      await txDone(tx);
    },

    async saveHole(hole) {
      const tx = db.transaction(["holes", "projects"], "readwrite");
      tx.objectStore("holes").put(hole);
      const project = (await req(tx.objectStore("projects").get(hole.project_id))) as
        | (ProjectRecord & { updatedAt?: string })
        | undefined;
      if (project) {
        project.updatedAt = new Date().toISOString();
        tx.objectStore("projects").put(project);
      }
      await txDone(tx);
    },

    async saveStations(holeId, stations) {
      const existing = await byIndex<StationRecord>("stations", "hole_id", holeId);
      const tx = db.transaction("stations", "readwrite");
      for (const s of existing) tx.objectStore("stations").delete(s.id);
      for (const s of stations) tx.objectStore("stations").put({ ...s, hole_id: holeId });
      await txDone(tx);
    },

    async loadStations(holeId) {
      const rows = await byIndex<StationRecord>("stations", "hole_id", holeId);
      return rows.sort((a, b) => a.seq - b.seq);
    },

    async saveTarget(target) {
      const tx = db.transaction("targets", "readwrite");
      tx.objectStore("targets").put(target);
      await txDone(tx);
    },

    async loadTargets(holeId) {
      return byIndex<Target>("targets", "hole_id", holeId);
    },

    async listHoles(projectId) {
      return byIndex<HoleRecord>("holes", "project_id", projectId);
    },

    async deleteTarget(targetId) {
      const allTargets = await all<Target>("targets");
      const tx = db.transaction("targets", "readwrite");
      for (const t of allTargets) {
        if (t.parent_target_id === targetId) {
          tx.objectStore("targets").put({ ...t, parent_target_id: null });
        }
      }
      tx.objectStore("targets").delete(targetId);
      await txDone(tx);
    },

    async deleteHole(holeId) {
      const holes = await all<HoleRecord>("holes");
      if (holes.some((h) => h.parent_hole_id === holeId)) {
        throw new Error("cannot delete parent wellbore while a sidetrack still references it");
      }
      const stations = await byIndex<StationRecord>("stations", "hole_id", holeId);
      const targets = await byIndex<Target>("targets", "hole_id", holeId);
      const tx = db.transaction(["holes", "stations", "targets"], "readwrite");
      for (const s of stations) tx.objectStore("stations").delete(s.id);
      for (const t of targets) tx.objectStore("targets").delete(t.id);
      tx.objectStore("holes").delete(holeId);
      await txDone(tx);
    },

    async exportSnapshot(projectId) {
      const project = (await req(
        db.transaction("projects", "readonly").objectStore("projects").get(projectId)
      )) as ProjectRecord | undefined;
      if (!project) throw new Error("Project not found.");
      const holes = await byIndex<HoleRecord>("holes", "project_id", projectId);
      const stations: StationRecord[] = [];
      const targets: Target[] = [];
      for (const h of holes) {
        stations.push(...(await byIndex<StationRecord>("stations", "hole_id", h.id)));
        targets.push(...(await byIndex<Target>("targets", "hole_id", h.id)));
      }
      return buildSnapshot({ project, holes, stations, targets, applicationVersion });
    },

    async importSnapshot(data: unknown) {
      const snap = parseSnapshot(data);
      const idMap = new Map<string, string>();
      const nextId = (old: string) => {
        const existing = idMap.get(old);
        if (existing) return existing;
        const n = newId();
        idMap.set(old, n);
        return n;
      };
      const project: ProjectRecord & { updatedAt: string } = {
        ...snap.project,
        id: nextId(snap.project.id),
        updatedAt: new Date().toISOString(),
      };
      const holes = snap.holes.map((h) => ({
        ...h,
        id: nextId(h.id),
        project_id: project.id,
        parent_hole_id: h.parent_hole_id ? nextId(h.parent_hole_id) : null,
      }));
      const stations = snap.stations.map((s) => ({
        ...s,
        id: nextId(s.id),
        hole_id: nextId(s.hole_id),
      }));
      const targets = snap.targets.map((t) => ({
        ...t,
        id: nextId(t.id),
        hole_id: nextId(t.hole_id),
        parent_target_id: t.parent_target_id ? nextId(t.parent_target_id) : null,
      }));
      const tx = db.transaction(["projects", "holes", "stations", "targets", "meta"], "readwrite");
      tx.objectStore("projects").put(project);
      for (const h of holes) tx.objectStore("holes").put(h);
      for (const s of stations) tx.objectStore("stations").put(s);
      for (const t of targets) tx.objectStore("targets").put(t);
      tx.objectStore("meta").put({ key: "lastOpenedId", value: project.id } satisfies MetaRow);
      await txDone(tx);
      return project;
    },

    async resetAll() {
      const tx = db.transaction(["projects", "holes", "stations", "targets", "meta"], "readwrite");
      tx.objectStore("projects").clear();
      tx.objectStore("holes").clear();
      tx.objectStore("stations").clear();
      tx.objectStore("targets").clear();
      tx.objectStore("meta").clear();
      await txDone(tx);
    },
  };
}

export function remapSnapshotIds(
  snap: BrowserProjectSnapshot,
  newId: () => string
): BrowserProjectSnapshot {
  const idMap = new Map<string, string>();
  const nextId = (old: string) => {
    const existing = idMap.get(old);
    if (existing) return existing;
    const n = newId();
    idMap.set(old, n);
    return n;
  };
  return {
    ...snap,
    project: { ...snap.project, id: nextId(snap.project.id) },
    holes: snap.holes.map((h) => ({
      ...h,
      id: nextId(h.id),
      project_id: nextId(h.project_id),
      parent_hole_id: h.parent_hole_id ? nextId(h.parent_hole_id) : null,
    })),
    stations: snap.stations.map((s) => ({
      ...s,
      id: nextId(s.id),
      hole_id: nextId(s.hole_id),
    })),
    targets: snap.targets.map((t) => ({
      ...t,
      id: nextId(t.id),
      hole_id: nextId(t.hole_id),
      parent_target_id: t.parent_target_id ? nextId(t.parent_target_id) : null,
    })),
  };
}
