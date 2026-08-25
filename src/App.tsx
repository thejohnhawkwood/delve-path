import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import {
  calculate,
  createProject,
  deleteTarget,
  lastMeasured,
  listHoles,
  loadStations,
  loadTargets,
  newUuid,
  openProject,
  pickOpenPath,
  pickSavePath,
  projectTangentBit,
  projectTangentMd,
  projectTangentTvd,
  saveHole,
  saveStations,
  saveTarget,
  type CalcRequest,
  type HoleRecord,
  type ProjectRecord,
  type StationRecord,
} from "./api";
import { type HoleOverlay } from "./Charts";
import { getPlatform } from "./platform";
import { AboutDialog } from "./web/AboutDialog";
import { ProjectChooser } from "./web/ProjectChooser";

const Charts = lazy(() => import("./Charts").then((m) => ({ default: m.Charts })));
import { asColorInput, COLOR_PRESETS, defaultHoleColor, PARENT_HOLE_COLOR } from "./colors";
import { asClass, exportCalculatedCsv, formatStationTsv, measuredOnly, parseSurveyTable, parseTargetPaste } from "./csv";
import type {
  AzimuthReference,
  CalculatedStation,
  MeasuredStation,
  Target,
  TieIn,
  Trajectory,
  UnitSystem,
  ValidationIssue,
} from "./domain";
import { dlsLabel, emptyRow, fmt, lengthLabel } from "./domain";
import { loadTipsOn, saveTipsOn } from "./glossary";
import { printReport } from "./report";
import { StartHere } from "./StartHere";
import { SurveyGrid, type SurveyHoleGroup } from "./SurveyGrid";
import { Tip } from "./Tip";

type Tab = "plan" | "profile" | "3d" | "target";
type ProjKind = "none" | "md" | "tvd" | "bit";

const OREGON_CSV = `md_ft,incl_deg,azi_deg,comment
445.0,0.0,0.0,
488.0,1.4,235.5,
519.0,3.0,211.6,
551.0,5.5,206.3,
582.0,6.8,201.2,
614.0,9.3,197.9,
645.0,12.1,196.3,
702.0,17.5,186.6,
733.0,19.5,181.0,
764.0,21.8,174.5,
795.0,24.5,169.0,
827.0,28.0,166.1,
889.0,32.8,163.9,
920.0,33.0,164.3,
982.0,33.3,164.5,
1075.0,34.5,163.4,
1137.0,35.2,163.1,
1203.0,35.8,162.2,
1294.0,36.9,164.8,
1357.0,34.8,165.3,
1419.0,33.7,165.0,
1482.0,34.4,165.3,
1594.0,34.9,166.9,
1718.0,34.9,166.9,
1848.0,33.56,166.32,Plug Back Interpolated Point
2591.0,26.0,162.0,`;

const DUAL_PARENT_CSV = `md_ft,incl_deg,azi_deg,comment
0,0,0,
2000,0,0,
5000,0,0,
6500,0,0,branch depth / possible KOP
7000,30,90,
7500,60,90,
8000,90,90,landed east
9000,90,90,
11000,90,90,east lateral TD`;

const DUAL_LATERAL_B_CSV = `md_ft,incl_deg,azi_deg,comment
6500,0,0,KICK-OFF / branch from Parent wellbore at MD 6500
7000,30,270,
7500,60,270,
8000,90,270,landed west
9000,90,270,
11000,90,270,west lateral TD`;

/** Min-curvature BHLs from delve-core-equivalent RF (constructed; not a golden). */
const DUAL_EAST_BHL = { north: 0, east: 3954.93, tvd: 7454.93 };
const DUAL_WEST_BHL = { north: 0, east: -3954.93, tvd: 7454.93 };
const DUAL_JUNCTION = { north: 0, east: 0, tvd: 6500 };

type HoleDraft = {
  rows: MeasuredStation[];
  tie: TieIn;
  unit: UnitSystem;
  aziRef: AzimuthReference;
  vsp: number;
  targets: Target[];
};

export default function App() {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [hole, setHole] = useState<HoleRecord | null>(null);
  const [holes, setHoles] = useState<HoleRecord[]>([]);
  const [unit, setUnit] = useState<UnitSystem>("imperial");
  const [aziRef, setAziRef] = useState<AzimuthReference>("unknown");
  const [vsp, setVsp] = useState(0);
  const [tie, setTie] = useState<TieIn>({ tvd: 0, north: 0, east: 0 });
  const [rows, setRows] = useState<MeasuredStation[]>([emptyRow(0)]);
  const [traj, setTraj] = useState<Trajectory | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<Tab>("plan");
  const [status, setStatus] = useState("No project open — New or Open, or enter a survey.");
  const [projKind, setProjKind] = useState<ProjKind>("none");
  const [projVal, setProjVal] = useState(100);
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<HoleOverlay[]>([]);
  const [allTargets, setAllTargets] = useState<Target[]>([]);
  const [tgtName, setTgtName] = useState("Target 1");
  const [tgtN, setTgtN] = useState("0");
  const [tgtE, setTgtE] = useState("0");
  const [tgtTvd, setTgtTvd] = useState("0");
  const [tgtStep, setTgtStep] = useState(50);
  const [tgtHoleId, setTgtHoleId] = useState("");
  const [tipsOn, setTipsOn] = useState(loadTipsOn);
  const [startHere, setStartHere] = useState(false);
  const [about, setAbout] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [rowUndo, setRowUndo] = useState<{ rows: MeasuredStation[]; selected: number } | null>(null);
  const runtime = getPlatform().kind;
  const saveTimer = useRef<number | null>(null);
  const dirty = useRef(false);
  const demoOnce = useRef(false);
  const drafts = useRef<Record<string, HoleDraft>>({});
  const catalog = allTargets.length ? allTargets : targets;
  const selectedTarget = catalog.find((t) => t.id === selectedTargetId) ?? catalog[0] ?? null;
  const holeList = holes.length ? holes : hole ? [hole] : [];
  const parentHoleId = hole?.parent_hole_id ?? hole?.id ?? "";

  const req = useCallback((): CalcRequest => {
    return {
      unit_system: unit,
      convention: "oilfield_from_vertical",
      azimuth_reference: aziRef,
      vsp_deg: vsp,
      tie_in: tie,
      stations: measuredOnly(rows),
    };
  }, [unit, aziRef, vsp, tie, rows]);

  const recalc = useCallback(async () => {
    const r = req();
    if (r.stations.length === 0) {
      setTraj(null);
      setIssues([]);
      return;
    }
    try {
      let next: Trajectory;
      if (projKind === "md") next = await projectTangentMd(r, projVal);
      else if (projKind === "tvd") next = await projectTangentTvd(r, projVal);
      else if (projKind === "bit") next = await projectTangentBit(r, projVal);
      else next = await calculate(r);
      setTraj(next);
      setIssues(next.stations.some((s) => s.class === "projected")
        ? [
            {
              severity: "info",
              index: next.stations.length - 1,
              code: "projected",
              message: "Last station is PROJECTED — Straight Line (hold last I/A). Not a measured survey. Not WinSERVE BHL trend.",
            },
          ]
        : []);
      setStatus("Calculated (Minimum Curvature).");
    } catch (e) {
      setIssues([
        {
          severity: "error",
          index: null,
          code: "calc",
          message: String(e),
        },
      ]);
      setStatus(String(e));
    }
  }, [req, projKind, projVal]);

  useEffect(() => {
    void recalc();
  }, [recalc]);

  useEffect(() => {
    if (demoOnce.current) return;
    demoOnce.current = true;
    void bootDemo();
  }, []);

  function snapshotDraft(id?: string) {
    const hid = id ?? hole?.id;
    if (!hid) return;
    drafts.current[hid] = { rows, tie, unit, aziRef, vsp, targets };
  }

  function applyDraft(d: HoleDraft) {
    setUnit(d.unit);
    setAziRef(d.aziRef);
    setVsp(d.vsp);
    setTie(d.tie);
    setRows(d.rows.length ? d.rows : [emptyRow(0)]);
    setTargets(d.targets);
    setSelectedTargetId(d.targets[0]?.id ?? null);
    if (d.targets[0]) {
      setTgtName(d.targets[0].name);
      setTgtN(String(d.targets[0].north));
      setTgtE(String(d.targets[0].east));
      setTgtTvd(String(d.targets[0].tvd));
      setTgtHoleId(d.targets[0].hole_id);
    } else {
      setTgtName("Target 1");
      setTgtN("0");
      setTgtE("0");
      setTgtTvd("0");
    }
    setSelected(0);
    setProjKind("none");
  }

  const persist = useCallback(async () => {
    if (!project || !hole) return;
    const measured = measuredOnly(rows);
    const recs: StationRecord[] = measured.map((s, i) => ({
      id: crypto.randomUUID(),
      hole_id: hole.id,
      seq: i,
      md: s.md,
      inc_deg: s.inc_deg,
      azi_deg: s.azi_deg,
      comment: s.comment,
      source: s.source,
      class: "measured",
      tvd_tie: i === 0 ? tie.tvd : null,
      north_tie: i === 0 ? tie.north : null,
      east_tie: i === 0 ? tie.east : null,
    }));
    const h: HoleRecord = {
      ...hole,
      unit_system: unit,
      survey_convention: "oilfield_from_vertical",
      azimuth_reference: aziRef,
      vsp_deg: vsp,
      parent_hole_id: hole.parent_hole_id ?? null,
      branch_md: hole.branch_md ?? null,
    };
    await saveHole(h);
    await saveStations(hole.id, recs);
    for (const t of targets) await saveTarget({ ...t, hole_id: hole.id });
    setHole(h);
    setHoles((prev) => prev.map((x) => (x.id === h.id ? h : x)));
    dirty.current = false;
    setStatus("Saved.");
  }, [project, hole, rows, tie, unit, aziRef, vsp, targets]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persist();
    }, 2000);
  }, [persist]);

  useEffect(() => {
    const onBlur = () => {
      if (dirty.current) void persist();
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [persist]);

  async function onNew() {
    const name = window.prompt("Project name", "Field project") ?? "Field project";
    const client = window.prompt("Client", "") ?? "";
    let p: ProjectRecord;
    if (runtime === "tauri") {
      const path = await pickSavePath();
      if (!path) return;
      p = await createProject(path, name, client);
    } else {
      p = await getPlatform().repo.create({ name, client });
    }
    const hid = await newUuid();
    const h: HoleRecord = {
      id: hid,
      project_id: p.id,
      name: "Hole 1",
      unit_system: unit,
      survey_convention: "oilfield_from_vertical",
      azimuth_reference: aziRef,
      vsp_deg: vsp,
      declination_note: "",
      grid_note: "",
      parent_hole_id: null,
      branch_md: null,
      color: null,
    };
    await saveHole(h);
    await saveStations(h.id, []);
    setProject(p);
    setHole(h);
    setHoles([h]);
    setRows([emptyRow(0)]);
    setTargets([]);
    setSelectedTargetId(null);
    setAllTargets([]);
    setTgtHoleId(hid);
    drafts.current = {};
    setStatus(runtime === "tauri" ? "Created desktop project." : "Created local browser project. Data stays on this device.");
  }

  async function onOpen() {
    if (runtime === "browser") {
      setChooser(true);
      return;
    }
    const path = await pickOpenPath();
    if (!path) return;
    const p = await openProject(path);
    const listed = await listHoles(p.id);
    setProject(p);
    setHoles(listed);
    drafts.current = {};
    if (listed[0]) {
      await applyStoredHole(listed[0]);
    }
    setStatus(`Opened ${path}`);
  }

  async function applyStoredHole(h: HoleRecord) {
    setHole(h);
    setUnit(h.unit_system === "metric" ? "metric" : "imperial");
    setAziRef((h.azimuth_reference as AzimuthReference) || "unknown");
    setVsp(h.vsp_deg);
    const st = await loadStations(h.id);
    const mapped: MeasuredStation[] = st.map((s) => ({
      md: s.md,
      inc_deg: s.inc_deg,
      azi_deg: s.azi_deg,
      comment: s.comment,
      class: asClass(s.class),
      source: (s.source as MeasuredStation["source"]) || "manual",
    }));
    setRows(mapped.length ? mapped : [emptyRow(0)]);
    if (st[0]) {
      setTie({
        tvd: st[0].tvd_tie ?? 0,
        north: st[0].north_tie ?? 0,
        east: st[0].east_tie ?? 0,
      });
    } else {
      setTie({ tvd: 0, north: 0, east: 0 });
    }
    const tg = await loadTargets(h.id);
    setTargets(tg);
    setSelectedTargetId(tg[0]?.id ?? null);
    if (tg[0]) {
      setTgtName(tg[0].name);
      setTgtN(String(tg[0].north));
      setTgtE(String(tg[0].east));
      setTgtTvd(String(tg[0].tvd));
      setTgtHoleId(tg[0].hole_id);
    } else {
      setTgtHoleId(h.id);
    }
    setSelected(0);
    setProjKind("none");
  }

  async function switchHole(nextId: string) {
    if (!nextId || nextId === hole?.id) return;
    snapshotDraft();
    if (dirty.current) await persist();
    const next = holes.find((h) => h.id === nextId);
    if (!next) return;
    const draft = drafts.current[nextId];
    if (draft) {
      setHole(next);
      applyDraft(draft);
    } else if (project) {
      await applyStoredHole(next);
    } else {
      setHole(next);
    }
    setStatus(`Switched to ${next.name}.`);
  }

  function applyPaste(text: string, source: "paste" | "csv", mode: "auto" | "replace" = "auto") {
    const { stations, warnings } = parseSurveyTable(text, source);
    if (stations.length === 0) {
      setStatus(warnings.join(" ") || "Nothing to import.");
      return;
    }
    const existing = measuredOnly(rows);
    const lastMd = existing.length ? Math.max(...existing.map((s) => s.md)) : null;
    const firstNew = Math.min(...stations.map((s) => s.md));
    const starterOnly =
      existing.length === 0 ||
      (existing.length === 1 && existing[0].md === 0 && existing[0].inc_deg === 0);
    const append = mode === "auto" && !starterOnly && lastMd != null && firstNew > lastMd;
    if (append) {
      setRows([...existing, ...stations]);
      setSelected(existing.length);
      setStatus(
        warnings.length
          ? warnings.join(" ")
          : `Appended ${stations.length} stations after MD ${lastMd}.`
      );
    } else {
      setRows(stations);
      setSelected(0);
      setStatus(warnings.length ? warnings.join(" ") : `Imported ${stations.length} measured stations.`);
    }
    setProjKind("none");
    scheduleSave();
  }

  function addSurveyRows(n: number) {
    const step = unit === "imperial" ? 100 : 30;
    const last = [...rows].reverse().find((r) => Number.isFinite(r.md));
    const lastFull = [...rows].reverse().find(
      (r) => Number.isFinite(r.md) && Number.isFinite(r.inc_deg) && Number.isFinite(r.azi_deg)
    );
    let md = last?.md ?? 0;
    const inc = lastFull?.inc_deg ?? 0;
    const azi = lastFull?.azi_deg ?? 0;
    const add: MeasuredStation[] = [];
    for (let k = 0; k < n; k++) {
      md += step;
      add.push({
        md,
        inc_deg: inc,
        azi_deg: azi,
        comment: "",
        class: "measured",
        source: "manual",
      });
    }
    setRowUndo({ rows, selected });
    setRows((prev) => [...prev, ...add]);
    setSelected(rows.length);
    scheduleSave();
    setStatus(
      n === 1
        ? `Added station at MD ${md} (hold last INC/AZI). Point appears after Minimum Curvature.`
        : `Added ${n} stations from MD ${add[0]?.md} (hold last INC/AZI).`
    );
  }

  function undoRowAdd() {
    if (!rowUndo) return;
    setRows(rowUndo.rows);
    setSelected(rowUndo.selected);
    setRowUndo(null);
    scheduleSave();
    setStatus("Undid last row add.");
  }

  async function copyStationRow(r: MeasuredStation, pos?: { north: number; east: number; tvd: number } | null) {
    const text = formatStationTsv(r, pos);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      const where = pos
        ? `N ${pos.north} E ${pos.east} TVD ${pos.tvd}. Paste into the grid or the Target N/E/TVD fields.`
        : `INC ${r.inc_deg} AZI ${r.azi_deg}. Paste into the grid.`;
      setStatus(`Copied MD ${Number.isFinite(r.md) ? r.md : "—"} · ${where}`);
    } catch (e) {
      setStatus(`Could not copy: ${e}`);
    }
  }

  function deleteRow(i: number) {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, j) => j !== i));
    setSelected((s) => {
      if (s === i) return Math.max(0, i - 1);
      if (s > i) return s - 1;
      return s;
    });
    scheduleSave();
  }

  function onPasteGrid(e: ClipboardEvent) {
    const text = e.clipboardData.getData("text");
    const el = e.target;
    const inTarget =
      tab === "target" ||
      (el instanceof HTMLElement && !!el.closest(".target-delta, .tgt-coords, .tgt-spin"));
    if (inTarget) {
      const coords = parseTargetPaste(text);
      if (coords) {
        e.preventDefault();
        setTgtN(String(coords.north));
        setTgtE(String(coords.east));
        setTgtTvd(String(coords.tvd));
        setStatus(
          `Target fields from paste: N ${coords.north} · E ${coords.east} · TVD ${coords.tvd}. Nudge, then Set / Add.`
        );
        return;
      }
      if (text.includes("\t") || text.includes("\n")) {
        e.preventDefault();
        setStatus("Paste a copied survey row (includes N/E/TVD) or three numbers: N, E, TVD.");
      }
      return;
    }
    if (text.includes("\t") || text.includes("\n")) {
      e.preventDefault();
      applyPaste(text, "paste");
    }
  }

  function onImportCsv() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      void f.text().then((text) => applyPaste(text, "csv"));
    };
    input.click();
  }

  function onExportCsv() {
    if (!traj) return;
    const blob = new Blob([exportCalculatedCsv(traj.stations, unit)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${hole?.name ?? "survey"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function bootDemo() {
    const platform = getPlatform();
    if (platform.kind === "browser") {
      const last = await platform.repo.getLastOpenedId();
      const list = await platform.repo.list();
      if (last && list.some((p) => p.id === last)) {
        try {
          const p = await platform.repo.open(last);
          const listed = await platform.repo.listHoles(p.id);
          setProject(p);
          setHoles(listed);
          if (listed[0]) await applyStoredHole(listed[0]);
          setStatus("Reopened local browser project. Data stays on this device. Not certified.");
          return;
        } catch {
          /* load Oregon */
        }
      }
      const p = await platform.repo.create({ name: "Oregon 24c-23-65", client: "" });
      const hid = await newUuid();
      const h = makeHoleRec(hid, p.id, "Hole 1");
      await saveHole(h);
      setProject(p);
      loadOregon(h);
      setStatus("Evaluation build — Oregon 24c-23-65 loaded. Start here walks the rest. Not certified.");
      return;
    }
    loadOregon();
    setStatus("Evaluation build — Oregon 24c-23-65 loaded. Start here walks the rest. Not certified.");
  }

  async function openBrowserProject(id: string) {
    const p = await openProject(id);
    const listed = await listHoles(p.id);
    setProject(p);
    setHoles(listed);
    drafts.current = {};
    if (listed[0]) await applyStoredHole(listed[0]);
    else {
      setHole(null);
      setRows([emptyRow(0)]);
    }
    setChooser(false);
    setStatus(`Opened local project ${p.name}. Data stays on this device.`);
  }

  async function exportBrowserSnapshot() {
    if (!project) {
      setStatus("Create or open a browser project first.");
      return;
    }
    try {
      if (dirty.current) await persist();
      const snap = await getPlatform().repo.exportSnapshot(project.id);
      const safe = project.name.replace(/[^\w.-]+/g, "-") || "project";
      await getPlatform().files.saveTextFile(
        `${safe}.delvepath.json`,
        JSON.stringify(snap, null, 2),
        "application/json"
      );
      setStatus("Exported browser snapshot (.delvepath.json). Not a desktop SQLite file.");
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function importBrowserSnapshot() {
    const file = await getPlatform().files.pickTextFile(".json,.delvepath.json,application/json");
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(file.text);
      const p = await getPlatform().repo.importSnapshot(parsed);
      await openBrowserProject(p.id);
      setStatus(`Imported ${p.name} as a new local project. Existing projects were not replaced.`);
    } catch (e) {
      setStatus(`Import rejected — local data unchanged. ${e}`);
    }
  }

  async function resetBrowserDemo() {
    if (
      !window.confirm(
        "Reset all local browser projects on this device? Built-in Oregon and dual-lateral examples will still be available."
      )
    ) {
      return;
    }
    await getPlatform().repo.resetAll();
    drafts.current = {};
    setProject(null);
    setHole(null);
    setHoles([]);
    demoOnce.current = false;
    await bootDemo();
  }

  function loadOregon(existing?: HoleRecord | null) {
    setUnit("imperial");
    setVsp(165.3);
    setTie({ tvd: 445, north: 0, east: 0 });
    setAziRef("unknown");
    const current = existing ?? hole;
    if (current) {
      const h = { ...current, parent_hole_id: null, branch_md: null };
      setHole(h);
      setHoles([h]);
    } else {
      setHoles([]);
    }
    drafts.current = {};
    setOverlays([]);
    applyPaste(OREGON_CSV, "csv", "replace");
    setStatus("Loaded Oregon 24c-23-65 fixture (imperial, VSP 165.30°, tie-in MD=TVD=445).");
  }

  function applySampleTarget() {
    setTgtName("Big Sand");
    setTgtN("-1070");
    setTgtE("270");
    setTgtTvd("2480");
    const t: Target = {
      id: selectedTarget?.id ?? crypto.randomUUID(),
      hole_id: hole?.id ?? "",
      name: "Big Sand",
      north: -1070,
      east: 270,
      tvd: 2480,
      horiz_tol: null,
      vert_tol: null,
      parent_target_id: null,
    };
    setTargets((prev) => {
      const i = prev.findIndex((x) => x.id === t.id);
      return i >= 0 ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t];
    });
    setSelectedTargetId(t.id);
    if (hole) scheduleSave();
    setStatus("Target Big Sand set — red X on Plan / Profile / 3-D.");
  }

  function parseStations(csv: string): MeasuredStation[] {
    return parseSurveyTable(csv, "csv").stations;
  }

  function makeHoleRec(
    id: string,
    projectId: string,
    name: string,
    extra: Partial<HoleRecord> = {}
  ): HoleRecord {
    return {
      id,
      project_id: projectId,
      name,
      unit_system: "imperial",
      survey_convention: "oilfield_from_vertical",
      azimuth_reference: "unknown",
      vsp_deg: 90,
      declination_note: "",
      grid_note: "",
      parent_hole_id: null,
      branch_md: null,
      color: null,
      ...extra,
    };
  }

  function pointTarget(
    id: string,
    holeId: string,
    name: string,
    n: number,
    e: number,
    tvd: number,
    parentId: string | null = null
  ): Target {
    return { id, hole_id: holeId, name, north: n, east: e, tvd, horiz_tol: null, vert_tol: null, parent_target_id: parentId };
  }

  async function persistHoleDraft(h: HoleRecord, d: HoleDraft) {
    if (!h.project_id) return;
    await saveHole(h);
    const measured = measuredOnly(d.rows);
    await saveStations(
      h.id,
      measured.map((s, i) => ({
        id: crypto.randomUUID(),
        hole_id: h.id,
        seq: i,
        md: s.md,
        inc_deg: s.inc_deg,
        azi_deg: s.azi_deg,
        comment: s.comment,
        source: s.source,
        class: "measured",
        tvd_tie: i === 0 ? d.tie.tvd : null,
        north_tie: i === 0 ? d.tie.north : null,
        east_tie: i === 0 ? d.tie.east : null,
      }))
    );
    for (const t of d.targets) await saveTarget({ ...t, hole_id: h.id });
  }

  async function loadDualLateral() {
    const parentId = crypto.randomUUID();
    const latId = crypto.randomUUID();
    const pid = project?.id ?? "";
    const parentRows = parseStations(DUAL_PARENT_CSV);
    const latRows = parseStations(DUAL_LATERAL_B_CSV);
    const parentHole = makeHoleRec(parentId, pid, "Parent wellbore");
    const latHole = makeHoleRec(latId, pid, "Lateral B", {
      parent_hole_id: parentId,
      branch_md: 6500,
    });
    const junctionId = crypto.randomUUID();
    const parentTargets = [
      pointTarget(junctionId, parentId, "Junction", DUAL_JUNCTION.north, DUAL_JUNCTION.east, DUAL_JUNCTION.tvd),
      pointTarget(
        crypto.randomUUID(),
        parentId,
        "East BHL",
        DUAL_EAST_BHL.north,
        DUAL_EAST_BHL.east,
        DUAL_EAST_BHL.tvd,
        junctionId
      ),
    ];
    const latTargets = [
      pointTarget(
        crypto.randomUUID(),
        latId,
        "West BHL",
        DUAL_WEST_BHL.north,
        DUAL_WEST_BHL.east,
        DUAL_WEST_BHL.tvd,
        junctionId
      ),
    ];
    const parentDraft: HoleDraft = {
      rows: parentRows,
      tie: { tvd: 0, north: 0, east: 0 },
      unit: "imperial",
      aziRef: "unknown",
      vsp: 90,
      targets: parentTargets,
    };
    const latDraft: HoleDraft = {
      rows: latRows,
      tie: { tvd: 6500, north: 0, east: 0 },
      unit: "imperial",
      aziRef: "unknown",
      vsp: 90,
      targets: latTargets,
    };
    drafts.current = { [parentId]: parentDraft, [latId]: latDraft };
    setHoles([parentHole, latHole]);
    setHole(parentHole);
    applyDraft(parentDraft);
    if (project) {
      await persistHoleDraft(parentHole, parentDraft);
      await persistHoleDraft(latHole, latDraft);
    }
    setStatus(
      "SYNTHETIC dual-lateral loaded — constructed, not a golden as-drilled match. Parent lands east; Lateral B branches at MD 6500 ft (vertical) and lands west. Use the Hole picker."
    );
  }

  async function branchFromSelected() {
    const row = rows[selected];
    if (!row || !Number.isFinite(row.md)) {
      setStatus("Select a measured survey row to branch from.");
      return;
    }
    let parent = hole;
    let p = project;
    if (!parent) {
      if (runtime === "tauri") {
        const path = await pickSavePath();
        if (!path) {
          setStatus("Save a project first, then branch from the selected station.");
          return;
        }
        const name = window.prompt("Project name", "Field project") ?? "Field project";
        const client = window.prompt("Client", "") ?? "";
        p = await createProject(path, name, client);
      } else {
        p = await getPlatform().repo.create({ name: "Field project", client: "" });
      }
      setProject(p);
      const hid = await newUuid();
      parent = makeHoleRec(hid, p.id, "Hole 1", {
        unit_system: unit,
        azimuth_reference: aziRef,
        vsp_deg: vsp,
      });
      await saveHole(parent);
      setHole(parent);
      setHoles([parent]);
    }
    snapshotDraft(parent.id);
    const calcAt =
      traj?.stations.find((s) => Math.abs(s.md - row.md) < 1e-6) ??
      (await calculate(req()).catch(() => null))?.stations.find((s) => Math.abs(s.md - row.md) < 1e-6);
    let warn = "";
    const branchTie: TieIn = calcAt
      ? { tvd: calcAt.tvd, north: calcAt.north, east: calcAt.east }
      : { tvd: 0, north: 0, east: 0 };
    if (!calcAt) warn = " Tie-in set to 0 — recalculate the parent if those N/E/TVD look wrong.";
    const kids = holes.filter((h) => h.parent_hole_id === parent.id);
    const letter = String.fromCharCode(66 + kids.length);
    const latName = `Lateral ${letter}`;
    const latId = await newUuid();
    const lat: HoleRecord = makeHoleRec(latId, p?.id ?? parent.project_id, latName, {
      unit_system: unit,
      azimuth_reference: aziRef,
      vsp_deg: vsp,
      parent_hole_id: parent.id,
      branch_md: row.md,
    });
    const kick: MeasuredStation = {
      md: row.md,
      inc_deg: row.inc_deg,
      azi_deg: row.azi_deg,
      comment: `KICK-OFF / branch from ${parent.name} at MD ${row.md}`,
      class: "measured",
      source: "tie_in",
    };
    const latDraft: HoleDraft = {
      rows: [kick],
      tie: branchTie,
      unit,
      aziRef,
      vsp,
      targets: [],
    };
    drafts.current[lat.id] = latDraft;
    setHoles((prev) => {
      const hasParent = prev.some((h) => h.id === parent.id);
      return hasParent ? [...prev, lat] : [parent, lat];
    });
    if ((p || project) && parent.project_id) {
      const parentDraft = drafts.current[parent.id] ?? { rows, tie, unit, aziRef, vsp, targets };
      await persistHoleDraft({ ...parent, project_id: (p ?? project)!.id }, parentDraft);
      await persistHoleDraft({ ...lat, project_id: (p ?? project)!.id }, latDraft);
    }
    setHole(lat);
    applyDraft(latDraft);
    setStatus(
      `Branched ${latName} from ${parent.name} at selected station MD ${row.md}. Tie-in is the parent’s calculated N/E/TVD at that station (not an interpolated kick-off). Add lateral surveys and targets.${warn}`
    );
  }

  function setTips(on: boolean) {
    setTipsOn(on);
    saveTipsOn(on);
  }

  const calcStations: CalculatedStation[] = useMemo(() => {
    if (!traj) return [];
    return traj.stations;
  }, [traj]);

  const pos = useMemo(() => {
    if (!traj) return null;
    const sel = traj.stations[selected];
    if (sel?.class === "projected") return sel;
    return lastMeasured(traj.stations) ?? sel ?? null;
  }, [traj, selected]);

  const posProjected = pos?.class === "projected";

  const delta = useMemo(() => {
    if (!pos || !selectedTarget) return null;
    return {
      dn: selectedTarget.north - pos.north,
      de: selectedTarget.east - pos.east,
      dt: selectedTarget.tvd - pos.tvd,
      horiz: Math.hypot(selectedTarget.north - pos.north, selectedTarget.east - pos.east),
    };
  }, [pos, selectedTarget]);

  useEffect(() => {
    let cancelled = false;
    async function refreshOverlays() {
      if (hole) drafts.current[hole.id] = { rows, tie, unit, aziRef, vsp, targets };
      const list = holes.length ? holes : hole ? [hole] : [];
      if (list.length === 0) {
        setOverlays([]);
        setAllTargets(targets);
        return;
      }
      const out: HoleOverlay[] = [];
      const tgts: Target[] = [];
      for (const h of list) {
        const d = h.id === hole?.id ? { rows, tie, unit, aziRef, vsp, targets } : drafts.current[h.id];
        let stations: CalculatedStation[] = [];
        if (h.id === hole?.id && traj) {
          stations = traj.stations;
        } else if (d && measuredOnly(d.rows).length > 0) {
          try {
            const t = await calculate({
              unit_system: d.unit,
              convention: "oilfield_from_vertical",
              azimuth_reference: d.aziRef,
              vsp_deg: d.vsp,
              tie_in: d.tie,
              stations: measuredOnly(d.rows),
            });
            stations = t.stations;
          } catch {
            stations = [];
          }
        } else if (!d && project) {
          try {
            const st = await loadStations(h.id);
            const mapped: MeasuredStation[] = st.map((s) => ({
              md: s.md,
              inc_deg: s.inc_deg,
              azi_deg: s.azi_deg,
              comment: s.comment,
              class: asClass(s.class),
              source: (s.source as MeasuredStation["source"]) || "manual",
            }));
            const tgs = await loadTargets(h.id);
            const loaded: HoleDraft = {
              rows: mapped.length ? mapped : [emptyRow(0)],
              tie: {
                tvd: st[0]?.tvd_tie ?? 0,
                north: st[0]?.north_tie ?? 0,
                east: st[0]?.east_tie ?? 0,
              },
              unit: h.unit_system === "metric" ? "metric" : "imperial",
              aziRef: (h.azimuth_reference as AzimuthReference) || "unknown",
              vsp: h.vsp_deg,
              targets: tgs,
            };
            drafts.current[h.id] = loaded;
            if (measuredOnly(loaded.rows).length > 0) {
              const t = await calculate({
                unit_system: loaded.unit,
                convention: "oilfield_from_vertical",
                azimuth_reference: loaded.aziRef,
                vsp_deg: loaded.vsp,
                tie_in: loaded.tie,
                stations: measuredOnly(loaded.rows),
              });
              stations = t.stations;
            }
            tgts.push(...tgs);
          } catch {
            stations = [];
          }
        }
        if (stations.length) {
          out.push({
            id: h.id,
            name: h.name,
            parent_hole_id: h.parent_hole_id,
            stations,
            color: defaultHoleColor(h, list),
          });
        }
        if (d) tgts.push(...d.targets);
      }
      if (!cancelled) {
        setOverlays(out);
        setAllTargets(tgts);
      }
    }
    void refreshOverlays();
    return () => {
      cancelled = true;
    };
  }, [holes, hole, traj, rows, tie, unit, aziRef, vsp, targets, project]);

  function holeNameOf(id: string): string {
    return holeList.find((h) => h.id === id)?.name ?? "Hole";
  }

  function findJunction(): Target | undefined {
    const onParent = catalog.filter((t) => (!parentHoleId || t.hole_id === parentHoleId) && !t.parent_target_id);
    return (
      onParent.find((t) => /^junction$/i.test(t.name)) ??
      onParent.find((t) => catalog.some((c) => c.parent_target_id === t.id))
    );
  }

  function fillForm(t: Target) {
    setSelectedTargetId(t.id);
    setTgtName(t.name);
    setTgtN(String(t.north));
    setTgtE(String(t.east));
    setTgtTvd(String(t.tvd));
    setTgtHoleId(t.hole_id);
  }

  function upsertList(list: Target[], t: Target): Target[] {
    const i = list.findIndex((x) => x.id === t.id);
    return i >= 0 ? list.map((x) => (x.id === t.id ? t : x)) : [...list, t];
  }

  function commitTarget(t: Target, fromHoleId?: string) {
    const oldHole = fromHoleId && fromHoleId !== t.hole_id ? fromHoleId : null;
    if (t.hole_id === hole?.id) {
      setTargets((prev) => upsertList(prev, t));
    } else if (oldHole === hole?.id) {
      setTargets((prev) => prev.filter((x) => x.id !== t.id));
    }
    if (oldHole && drafts.current[oldHole]) {
      drafts.current[oldHole].targets = drafts.current[oldHole].targets.filter((x) => x.id !== t.id);
    }
    const dest = drafts.current[t.hole_id];
    if (dest) dest.targets = upsertList(dest.targets, t);
    else {
      drafts.current[t.hole_id] = {
        rows: [emptyRow(0)],
        tie: { tvd: 0, north: 0, east: 0 },
        unit,
        aziRef,
        vsp,
        targets: [t],
      };
    }
    setAllTargets((prev) => upsertList(oldHole ? prev.filter((x) => x.id !== t.id) : prev, t));
    fillForm(t);
    if (project) void saveTarget(t);
    if (hole) scheduleSave();
  }

  function removeTarget(id: string) {
    for (const d of Object.values(drafts.current)) {
      d.targets = d.targets
        .filter((x) => x.id !== id)
        .map((x) => (x.parent_target_id === id ? { ...x, parent_target_id: null } : x));
    }
    setTargets((prev) =>
      prev.filter((x) => x.id !== id).map((x) => (x.parent_target_id === id ? { ...x, parent_target_id: null } : x))
    );
    setAllTargets((prev) =>
      prev.filter((x) => x.id !== id).map((x) => (x.parent_target_id === id ? { ...x, parent_target_id: null } : x))
    );
    setSelectedTargetId(null);
    if (project) void deleteTarget(id);
    setStatus("Target deleted. Child targets (if any) are now standalone.");
    if (hole) scheduleSave();
  }

  const targetRoots = catalog.filter(
    (t) => !t.parent_target_id || !catalog.some((p) => p.id === t.parent_target_id)
  );

  async function pickStation(holeId: string, index: number) {
    if (holeId && holeId !== "current" && holeId !== hole?.id) {
      await switchHole(holeId);
    }
    setSelected(index);
  }

  function assignHoleColor(hex: string) {
    if (!hole) return;
    const next = { ...hole, color: hex };
    setHole(next);
    setHoles((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    scheduleSave();
  }

  const gridGroups: SurveyHoleGroup[] = (() => {
    const list = orderHoles(holeList);
    if (list.length === 0) {
      return [
        {
          id: hole?.id ?? "current",
          name: hole?.name ?? "Measured",
          color: hole ? defaultHoleColor(hole, []) : PARENT_HOLE_COLOR,
          rows,
          calc: alignCalc(rows, calcStations),
        },
      ];
    }
    return list.map((h) => {
      const d = h.id === hole?.id ? null : drafts.current[h.id];
      const r = h.id === hole?.id ? rows : (d?.rows ?? []);
      const c =
        h.id === hole?.id
          ? alignCalc(rows, calcStations)
          : alignCalc(r, overlays.find((o) => o.id === h.id)?.stations ?? []);
      return { id: h.id, name: h.name, color: defaultHoleColor(h, list), rows: r, calc: c };
    });
  })();

  return (
    <div className="app" onPaste={onPasteGrid}>
      <div className="banner" role="note">
        Engineering prototype / evaluation software — not certified. Not regulator-approved. Not
        for collision avoidance, well control, or steering decisions. Minimum Curvature (ISCWSA).
        Not claimed bit-identical to WinSERVE.
      </div>
      <div className="toolbar">
        <span className="name">DELVEPATH</span>
        <button className="primary" onClick={() => setStartHere(true)}>
          Start here
        </button>
        <label className="tips-toggle">
          <input type="checkbox" checked={tipsOn} onChange={(e) => setTips(e.target.checked)} />
          Tips
        </label>
        <button className="primary" onClick={() => void onNew()}>
          New
        </button>
        <button onClick={() => void onOpen()}>Open</button>
        <button onClick={() => void persist()}>Save</button>
        {runtime === "browser" && (
          <>
            <button type="button" onClick={() => void exportBrowserSnapshot()}>
              Export project
            </button>
            <button type="button" onClick={() => void importBrowserSnapshot()}>
              Import project
            </button>
            <button type="button" onClick={() => void resetBrowserDemo()}>
              Reset demo
            </button>
          </>
        )}
        <button type="button" onClick={() => setAbout(true)}>
          About
        </button>
        <label>
          <Tip id="project" on={tipsOn}>
            Project
          </Tip>
          <input
            value={project?.name ?? ""}
            readOnly
            placeholder="(unsaved)"
            style={{ width: 140 }}
          />
        </label>
        <label>
          <Tip id="hole" on={tipsOn}>
            Hole
          </Tip>
          {holes.length > 1 && (
            <Tip id={hole?.parent_hole_id ? "sidetrack" : "parentWellbore"} on={tipsOn}>
              <select
                value={hole?.id ?? ""}
                onChange={(e) => void switchHole(e.target.value)}
                style={{ width: 140 }}
              >
                {holes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.parent_hole_id ? " (sidetrack)" : ""}
                  </option>
                ))}
              </select>
            </Tip>
          )}
          <input
            value={hole?.name ?? "Hole 1"}
            onChange={(e) => {
              if (!hole) return;
              const next = { ...hole, name: e.target.value };
              setHole(next);
              setHoles((prev) => prev.map((x) => (x.id === next.id ? next : x)));
              scheduleSave();
            }}
            style={{ width: 100 }}
          />
          {hole && (
            <HoleColorButton color={defaultHoleColor(hole, holeList)} onChange={assignHoleColor} />
          )}
        </label>
        <label>
          <Tip id="units" on={tipsOn}>
            Units
          </Tip>
          <select
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value as UnitSystem);
              scheduleSave();
            }}
          >
            <option value="imperial">feet / °/100 ft</option>
            <option value="metric">metres / °/30 m</option>
          </select>
        </label>
        <label>
          <Tip id="convention" on={tipsOn}>
            Convention
          </Tip>
          <select value="oilfield_from_vertical" disabled>
            <option value="oilfield_from_vertical">oilfield from vertical</option>
          </select>
        </label>
        <label>
          <Tip id="aziRef" on={tipsOn}>
            North
          </Tip>
          <select
            value={aziRef}
            onChange={(e) => {
              setAziRef(e.target.value as AzimuthReference);
              scheduleSave();
            }}
          >
            <option value="unknown">unknown</option>
            <option value="true">true</option>
            <option value="grid">grid</option>
            <option value="magnetic">magnetic</option>
          </select>
        </label>
        <label>
          <Tip id="vsp" on={tipsOn}>
            VSP °
          </Tip>
          <input
            type="number"
            step="0.01"
            value={vsp}
            onChange={(e) => {
              setVsp(Number(e.target.value));
              scheduleSave();
            }}
            style={{ width: 72 }}
          />
        </label>
        <label>
          <Tip id="tie" on={tipsOn}>
            Tie TVD
          </Tip>
          <input
            type="number"
            step="0.01"
            value={tie.tvd}
            onChange={(e) => {
              setTie({ ...tie, tvd: Number(e.target.value) });
              scheduleSave();
            }}
            style={{ width: 72 }}
          />
        </label>
        <label>
          <Tip id="north" on={tipsOn}>
            Tie N
          </Tip>
          <input
            type="number"
            step="0.01"
            value={tie.north}
            onChange={(e) => {
              setTie({ ...tie, north: Number(e.target.value) });
              scheduleSave();
            }}
            style={{ width: 72 }}
          />
        </label>
        <label>
          <Tip id="east" on={tipsOn}>
            Tie E
          </Tip>
          <input
            type="number"
            step="0.01"
            value={tie.east}
            onChange={(e) => {
              setTie({ ...tie, east: Number(e.target.value) });
              scheduleSave();
            }}
            style={{ width: 72 }}
          />
        </label>
        <Tip id="csv" on={tipsOn}>
          <button onClick={onImportCsv}>Import CSV</button>
        </Tip>
        <Tip id="csv" on={tipsOn}>
          <button onClick={onExportCsv} disabled={!traj}>
            Export CSV
          </button>
        </Tip>
        <Tip id="report" on={tipsOn}>
          <button onClick={() => traj && printReport(project?.name ?? "Untitled", hole?.name ?? "Hole 1", traj, unit)}>
            Report
          </button>
        </Tip>
        <Tip id="oregon" on={tipsOn}>
          <button onClick={() => loadOregon()}>Oregon example</button>
        </Tip>
        <Tip id="lateral" on={tipsOn}>
          <button onClick={() => void loadDualLateral()}>Load dual-lateral example</button>
        </Tip>
        <Tip id="kickOff" on={tipsOn}>
          <button onClick={() => void branchFromSelected()}>Branch from selected station</button>
        </Tip>
      </div>

      <div className="main">
        <section className={`pos ${posProjected ? "projected" : ""}`}>
          <h2>
            <Tip id="current" on={tipsOn}>
              CURRENT POSITION
            </Tip>
            {posProjected ? (
              <>
                {" — "}
                <Tip id="projected" on={tipsOn}>
                  PROJECTED
                </Tip>
              </>
            ) : (
              <>
                {" — "}
                <Tip id="measured" on={tipsOn}>
                  measured
                </Tip>
              </>
            )}{" "}
            · {unit} · oilfield from vertical · {dlsLabel(unit)}
          </h2>
          {pos ? (
            <div className="kv">
              <div>
                <span>
                  <Tip id="md" on={tipsOn}>
                    MD {lengthLabel(unit)}
                  </Tip>
                </span>
                <b>{fmt(pos.md)}</b>
              </div>
              <div>
                <span>
                  <Tip id="inc" on={tipsOn}>
                    INC °
                  </Tip>
                </span>
                <b>{fmt(pos.inc_deg)}</b>
              </div>
              <div>
                <span>
                  <Tip id="azi" on={tipsOn}>
                    AZI °
                  </Tip>
                </span>
                <b>{fmt(pos.azi_deg)}</b>
              </div>
              <div>
                <span>
                  <Tip id="tvd" on={tipsOn}>
                    TVD {lengthLabel(unit)}
                  </Tip>
                </span>
                <b>{fmt(pos.tvd)}</b>
              </div>
              <div>
                <span>
                  <Tip id="north" on={tipsOn}>
                    +North
                  </Tip>
                </span>
                <b>{fmt(pos.north)}</b>
              </div>
              <div>
                <span>
                  <Tip id="east" on={tipsOn}>
                    +East
                  </Tip>
                </span>
                <b>{fmt(pos.east)}</b>
              </div>
              <div>
                <span>
                  <Tip id="vs" on={tipsOn}>
                    VS
                  </Tip>
                </span>
                <b>{fmt(pos.vs)}</b>
              </div>
              <div>
                <span>
                  <Tip id="dls" on={tipsOn}>
                    DLS
                  </Tip>
                </span>
                <b>{fmt(pos.dls)}</b>
              </div>
            </div>
          ) : (
            <p>Enter MD / INC / AZI. Calculated fields stay empty until the engine returns a path.</p>
          )}
        </section>

        <section className="issues">
          <h2 style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: "0.08em", color: "var(--muted)" }}>
            VALIDATION · {status}
          </h2>
          {issues.length === 0 ? (
            <div>No blocking issues.</div>
          ) : (
            issues.map((iss, i) => (
              <div key={i} className={iss.severity}>
                [{iss.severity}] {iss.index != null ? `row ${iss.index + 1}: ` : ""}
                {iss.message}
              </div>
            ))
          )}
        </section>

        <div className="grid-panel">
          <div className="grid-actions">
            <button type="button" onClick={() => addSurveyRows(1)}>
              Add row
            </button>
            <button type="button" onClick={() => addSurveyRows(5)}>
              Add 5
            </button>
            <button type="button" disabled={!rowUndo} onClick={undoRowAdd}>
              Undo add
            </button>
            <span className="muted">
              Holds last INC/AZI · steps MD {unit === "imperial" ? 100 : 30} {lengthLabel(unit)} ·
              ⎘ copies a row (Ctrl+C) · paste appends if MD continues
            </span>
          </div>
          <SurveyGrid
            groups={gridGroups}
            activeHoleId={hole?.id ?? gridGroups[0]?.id ?? null}
            unit={unit}
            tipsOn={tipsOn}
            selected={selected}
            onSelect={(holeId, i) => void pickStation(holeId, i)}
            onChange={(i, patch) => {
              setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
              scheduleSave();
            }}
            onEnterLast={(i) => {
              if (i === rows.length - 1) addSurveyRows(1);
            }}
            onDelete={deleteRow}
            onCopy={(row, pos) => void copyStationRow(row, pos)}
          />
        </div>

        <section className="viz">
          <div className="tabs">
            <button className={tab === "plan" ? "on" : ""} onClick={() => setTab("plan")}>
              <Tip id="planView" on={tipsOn}>
                Plan
              </Tip>
            </button>
            <button className={tab === "profile" ? "on" : ""} onClick={() => setTab("profile")}>
              <Tip id="profileView" on={tipsOn}>
                Profile
              </Tip>
            </button>
            <button className={tab === "3d" ? "on" : ""} onClick={() => setTab("3d")}>
              <Tip id="view3d" on={tipsOn}>
                3-D
              </Tip>
            </button>
            <button className={tab === "target" ? "on" : ""} onClick={() => setTab("target")}>
              <Tip id="target" on={tipsOn}>
                Target
              </Tip>
            </button>
          </div>
          {tab === "target" ? (
            <div className="target-delta">
              <p>
                <Tip id="junction" on={tipsOn}>
                  Junction
                </Tip>
                {" — parent target at the kick-off / branch point. "}
                <Tip id="target" on={tipsOn}>
                  Lateral targets
                </Tip>
                {" are children (BHL or intermediate). High/low–left/right needs a plan."}
              </p>
              {catalog.length > 0 && (
                <ul className="tgt-tree">
                  {targetRoots.map((t) => {
                    const kids = catalog.filter((c) => c.parent_target_id === t.id);
                    const junction = !t.parent_target_id && (kids.length > 0 || /^junction$/i.test(t.name));
                    return (
                      <li key={t.id} className={t.id === selectedTarget?.id ? "on" : ""}>
                        <button type="button" onClick={() => fillForm(t)}>
                          <span className="role">{junction ? "JUNCTION" : "TARGET"}</span>
                          {t.name} · {holeNameOf(t.hole_id)} · N {fmt(t.north)} · E {fmt(t.east)} · TVD {fmt(t.tvd)}
                        </button>
                        {kids.length > 0 && (
                          <ul>
                            {kids.map((c) => (
                              <li key={c.id} className={c.id === selectedTarget?.id ? "on" : ""}>
                                <button type="button" onClick={() => fillForm(c)}>
                                  <span className="role">LATERAL</span>
                                  {c.name} · {holeNameOf(c.hole_id)} · N {fmt(c.north)} · E {fmt(c.east)} · TVD{" "}
                                  {fmt(c.tvd)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p>
                Name{" "}
                <input value={tgtName} onChange={(e) => setTgtName(e.target.value)} />
                {holeList.length > 0 && (
                  <label className="tgt-step">
                    Hole
                    <select
                      value={tgtHoleId || hole?.id || ""}
                      onChange={(e) => setTgtHoleId(e.target.value)}
                    >
                      {holeList.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                          {h.parent_hole_id ? " (sidetrack)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="tgt-step">
                  Step
                  <select value={tgtStep} onChange={(e) => setTgtStep(Number(e.target.value))}>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </p>
              <p className="muted">
                Paste a copied survey row (or N, E, TVD) into these fields, then nudge with ±.
              </p>
              <div className="tgt-coords">
                <Tip id="north" on={tipsOn}>
                  <CoordField label="N" value={tgtN} step={tgtStep} onChange={setTgtN} />
                </Tip>
                <Tip id="east" on={tipsOn}>
                  <CoordField label="E" value={tgtE} step={tgtStep} onChange={setTgtE} />
                </Tip>
                <Tip id="tvd" on={tipsOn}>
                  <CoordField label="TVD" value={tgtTvd} step={tgtStep} onChange={setTgtTvd} />
                </Tip>
              </div>
              <div className="tgt-actions">
                <button
                  onClick={() => {
                    const sel = traj?.stations[selected];
                    const north = sel ? sel.north : parseCoord(tgtN);
                    const east = sel ? sel.east : parseCoord(tgtE);
                    const tvd = sel ? sel.tvd : parseCoord(tgtTvd);
                    const existing = findJunction();
                    const hid = parentHoleId || hole?.id || "";
                    const t: Target = {
                      id: existing?.id ?? crypto.randomUUID(),
                      hole_id: hid,
                      name: existing?.name ?? "Junction",
                      north,
                      east,
                      tvd,
                      horiz_tol: null,
                      vert_tol: null,
                      parent_target_id: null,
                    };
                    commitTarget(t, existing?.hole_id);
                    setStatus(
                      sel
                        ? `Junction set at selected station N ${fmt(north)} E ${fmt(east)} TVD ${fmt(tvd)}.`
                        : `Junction set from typed N/E/TVD.`
                    );
                  }}
                >
                  Set junction
                </button>
                <button
                  onClick={() => {
                    const j = findJunction();
                    if (!j) {
                      setStatus("Set a junction first, then add lateral targets as children.");
                      return;
                    }
                    const kids = catalog.filter((c) => c.parent_target_id === j.id);
                    const hid = tgtHoleId || hole?.id || "";
                    const t: Target = {
                      id: crypto.randomUUID(),
                      hole_id: hid,
                      name: `Lateral ${kids.length + 1}`,
                      north: parseCoord(tgtN),
                      east: parseCoord(tgtE),
                      tvd: parseCoord(tgtTvd),
                      horiz_tol: null,
                      vert_tol: null,
                      parent_target_id: j.id,
                    };
                    commitTarget(t);
                    setStatus(`Added ${t.name} on ${holeNameOf(hid)} as a child of ${j.name}.`);
                  }}
                >
                  Add lateral target
                </button>
                <button
                  onClick={() => {
                    const hid = tgtHoleId || hole?.id || "";
                    const t: Target = {
                      id: selectedTarget?.id ?? crypto.randomUUID(),
                      hole_id: hid,
                      name: tgtName.trim() || "Target",
                      north: parseCoord(tgtN),
                      east: parseCoord(tgtE),
                      tvd: parseCoord(tgtTvd),
                      horiz_tol: null,
                      vert_tol: null,
                      parent_target_id: selectedTarget?.parent_target_id ?? null,
                    };
                    commitTarget(t, selectedTarget?.hole_id);
                    setStatus(
                      hole
                        ? `Target ${t.name} set — marker on Plan / Profile / 3-D.`
                        : `Target ${t.name} shown on plots. New/Open a project if you want it saved.`
                    );
                  }}
                >
                  {selectedTarget ? "Update target" : "Set target"}
                </button>
                <button
                  onClick={() => {
                    const hid = tgtHoleId || hole?.id || "";
                    const t: Target = {
                      id: crypto.randomUUID(),
                      hole_id: hid,
                      name: tgtName.trim() || `Target ${catalog.length + 1}`,
                      north: parseCoord(tgtN),
                      east: parseCoord(tgtE),
                      tvd: parseCoord(tgtTvd),
                      horiz_tol: null,
                      vert_tol: null,
                      parent_target_id: null,
                    };
                    commitTarget(t);
                    setStatus(`Added target ${t.name}.`);
                  }}
                >
                  Add target
                </button>
                <button
                  disabled={!selectedTarget}
                  onClick={() => {
                    const id = selectedTarget?.id;
                    if (!id) return;
                    removeTarget(id);
                  }}
                >
                  Delete
                </button>
              </div>
              {delta && pos ? (
                <>
                  <p>
                    ΔN {fmt(delta.dn)} · ΔE {fmt(delta.de)} · ΔTVD {fmt(delta.dt)} · horiz {fmt(delta.horiz)}{" "}
                    {lengthLabel(unit)}
                  </p>
                  <p>From {posProjected ? "PROJECTED" : "measured"} current position.</p>
                </>
              ) : (
                <p>Set a target and calculate a survey to see numeric deltas.</p>
              )}
            </div>
          ) : (
            <Suspense fallback={<p className="workspace-loading">Loading plots…</p>}>
              <Charts
                tab={tab}
                stations={calcStations}
                overlays={overlays}
                selected={Math.min(selected, Math.max(0, calcStations.length - 1))}
                targets={allTargets.length ? allTargets : targets}
                vspDeg={vsp}
                currentHoleId={hole?.id ?? null}
                onPickStation={(holeId, index) => void pickStation(holeId, index)}
              />
            </Suspense>
          )}
        </section>
      </div>

      <div className="proj-bar">
        <Tip id="straight" on={tipsOn}>
          <span>Straight Line projection (hold I/A — not WinSERVE BHL trend)</span>
        </Tip>
        <select value={projKind} onChange={(e) => setProjKind(e.target.value as ProjKind)}>
          <option value="none">None</option>
          <option value="md">+MD</option>
          <option value="tvd">to TVD</option>
          <option value="bit">bit-to-sensor</option>
        </select>
        <Tip id="bit" on={tipsOn}>
          <span className="muted">bit-to-sensor</span>
        </Tip>
        <input
          type="number"
          step="0.01"
          value={projVal}
          onChange={(e) => setProjVal(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span>{status}</span>
      </div>
      {startHere && (
        <StartHere
          onClose={() => setStartHere(false)}
          onLoadOregon={() => loadOregon()}
          onLoadDual={() => void loadDualLateral()}
          onSampleTarget={applySampleTarget}
          onGoTab={setTab}
          tipsOn={tipsOn}
          onTips={setTips}
          runtime={runtime}
        />
      )}
      {about && <AboutDialog onClose={() => setAbout(false)} />}
      {chooser && (
        <ProjectChooser onClose={() => setChooser(false)} onOpen={(id) => void openBrowserProject(id)} />
      )}
    </div>
  );
}

function orderHoles(list: HoleRecord[]): HoleRecord[] {
  const parents = list.filter((h) => !h.parent_hole_id);
  const kids = list.filter((h) => h.parent_hole_id);
  const out: HoleRecord[] = [];
  for (const p of parents) {
    out.push(p);
    out.push(...kids.filter((k) => k.parent_hole_id === p.id));
  }
  for (const k of kids) {
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

function HoleColorButton({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <span className="hole-color-wrap" ref={wrap}>
      <button
        type="button"
        className="hole-swatch"
        title="Path color"
        style={{ background: color }}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <span className="hole-color-pop">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className="hole-swatch"
              style={{ background: c }}
              title={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
          <input
            type="color"
            value={asColorInput(color)}
            title="Custom"
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
      )}
    </span>
  );
}

function parseCoord(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function bumpCoord(s: string, step: number, dir: 1 | -1): string {
  return String(parseCoord(s) + dir * step);
}

function onCoordDraft(raw: string, set: (s: string) => void) {
  if (raw === "" || raw === "-" || raw === "." || raw === "-." || /^-?\d*\.?\d*$/.test(raw)) {
    set(raw);
  }
}

function CoordField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: string;
  step: number;
  onChange: (s: string) => void;
}) {
  return (
    <label className="tgt-coord">
      {label}
      <span className="tgt-spin">
        <button type="button" aria-label={`${label} minus ${step}`} onClick={() => onChange(bumpCoord(value, step, -1))}>
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onCoordDraft(e.target.value, onChange)}
        />
        <button type="button" aria-label={`${label} plus ${step}`} onClick={() => onChange(bumpCoord(value, step, 1))}>
          +
        </button>
      </span>
    </label>
  );
}

function alignCalc(rows: MeasuredStation[], calc: CalculatedStation[]): CalculatedStation[] {
  if (calc.length === 0) return [];
  const out: CalculatedStation[] = [];
  let ci = 0;
  for (let i = 0; i < rows.length; i++) {
    const c = calc[ci];
    if (c && Number.isFinite(rows[i].md) && Math.abs(c.md - rows[i].md) < 1e-9) {
      out[i] = c;
      ci++;
    }
  }
  if (calc.length > ci) {
    for (let k = ci; k < calc.length; k++) {
      out[rows.length + (k - ci)] = calc[k];
    }
  }
  return out;
}
