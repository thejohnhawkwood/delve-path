import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseSnapshot } from "../snapshot";
import { createBrowserRepository, IDB_NAME, openDelveDb } from "./idb";

Object.defineProperty(globalThis, "indexedDB", { value: indexedDB, configurable: true });
Object.defineProperty(globalThis, "IDBKeyRange", { value: IDBKeyRange, configurable: true });

let seq = 0;
const newId = () => `id-${++seq}`;

async function repo() {
  const db = await openDelveDb(indexedDB);
  return { db, r: createBrowserRepository(db, newId, "0.1.1") };
}

async function deleteDb() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(IDB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  seq = 0;
  await deleteDb();
});

afterEach(async () => {
  await deleteDb();
});

describe("IndexedDB repository", () => {
  it("creates, reloads, and deletes a multi-hole project", async () => {
    const { db, r } = await repo();
    const p = await r.create({ name: "Dual", client: "Demo" });
    const parent = {
      id: newId(),
      project_id: p.id,
      name: "Parent wellbore",
      unit_system: "imperial",
      survey_convention: "oilfield_from_vertical",
      azimuth_reference: "unknown",
      vsp_deg: 90,
      declination_note: "",
      grid_note: "",
      parent_hole_id: null,
      branch_md: null,
      color: "#8ec8c8",
    };
    const lat = {
      ...parent,
      id: newId(),
      name: "Lateral B",
      parent_hole_id: parent.id,
      branch_md: 6500,
      color: "#7ee0e0",
    };
    await r.saveHole(parent);
    await r.saveHole(lat);
    await r.saveStations(parent.id, [
      {
        id: newId(),
        hole_id: parent.id,
        seq: 0,
        md: 0,
        inc_deg: 0,
        azi_deg: 0,
        comment: "",
        source: "manual",
        class: "measured",
        tvd_tie: 0,
        north_tie: 0,
        east_tie: 0,
      },
    ]);
    await r.saveTarget({
      id: newId(),
      hole_id: parent.id,
      name: "Junction",
      north: 0,
      east: 0,
      tvd: 6500,
      horiz_tol: null,
      vert_tol: null,
      parent_target_id: null,
    });
    const holes = await r.listHoles(p.id);
    expect(holes).toHaveLength(2);
    expect(holes.find((h) => h.parent_hole_id === parent.id)?.branch_md).toBe(6500);
    const snap = await r.exportSnapshot(p.id);
    expect(snap.format).toBe("delvepath-browser-snapshot");
    const opened = await r.open(p.id);
    expect(opened.name).toBe("Dual");
    await r.deleteProject(p.id);
    expect(await r.list()).toHaveLength(0);
    db.close();
  });

  it("imports a snapshot as a new project and rejects corrupt JSON", async () => {
    const { db, r } = await repo();
    const p = await r.create({ name: "Original", client: "" });
    await r.saveHole({
      id: newId(),
      project_id: p.id,
      name: "H1",
      unit_system: "imperial",
      survey_convention: "oilfield_from_vertical",
      azimuth_reference: "unknown",
      vsp_deg: 0,
      declination_note: "",
      grid_note: "",
      parent_hole_id: null,
      branch_md: null,
      color: null,
    });
    const snap = await r.exportSnapshot(p.id);
    expect(() => parseSnapshot({ format: "bad" })).toThrow();
    const imported = await r.importSnapshot(snap);
    expect(imported.id).not.toBe(p.id);
    expect((await r.list()).map((x) => x.name).sort()).toEqual(["Original", "Original"]);
    const before = await r.list();
    await expect(r.importSnapshot({ nope: true })).rejects.toThrow();
    expect(await r.list()).toHaveLength(before.length);
    db.close();
  });

  it("sets schema version 1 on first open", async () => {
    const db = await openDelveDb(indexedDB);
    expect(db.version).toBe(1);
    expect([...db.objectStoreNames]).toEqual(
      expect.arrayContaining(["projects", "holes", "stations", "targets", "meta"])
    );
    db.close();
  });

  it("resetAll leaves an empty database", async () => {
    const { db, r } = await repo();
    await r.create({ name: "X", client: "" });
    await r.resetAll();
    expect(await r.list()).toEqual([]);
    expect(await r.getLastOpenedId()).toBeNull();
    db.close();
  });
});
