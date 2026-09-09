import { useEffect, useMemo, useRef, useState } from "react";
import type { FlightSelection } from "../fieldModel";
import { engineCall, parseEngineError } from "../engine";
import { getPlatform } from "../platform";
import { loadDocuments, saveDocument } from "../api";
import { fmt } from "../domain";
import type { ExtraPath } from "../Charts";
import {
  glyphPaths,
  type Candidate,
  type CollisionCase,
  type Generation,
  type Glyph,
} from "../collision/types";
import { runCollision } from "../collision/run";
import {
  candidateCsv,
  digest,
  makeAudit,
  verifyAudit,
  type Audit,
} from "../collision/audit";

const COLORS = {
  current: "#f0e9d8",
  baseline: "#e6b35a",
  correction: "#64d7d8",
  offset: "#b4a0e6",
  clearance: "#ec9f92",
};

export function CollisionWorkspace({ holeId, sharedInput, stale, forecast, onUseActive, onDemoLoaded, onPaths, onNavigate, onUsePlan }: {
  holeId: string | null; sharedInput: CollisionCase | null; stale: boolean; forecast: FlightSelection | null;
  onUseActive: () => Promise<void>; onDemoLoaded: (input: CollisionCase) => Promise<void>;
  onPaths: (paths: ExtraPath[], label?: string) => void; onNavigate: () => void; onUsePlan: (candidate: Candidate) => void;
}) {
  const [input, setInput] = useState<CollisionCase | null>(null);
  const [baseline, setBaseline] = useState<Candidate | null>(null);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [forecastClearance, setForecastClearance] = useState<number | null>(null);
  const [glyphs, setGlyphs] = useState<ExtraPath[]>([]);
  const [editor, setEditor] = useState(false);
  const [json, setJson] = useState("");
  const [report, setReport] = useState(false);
  const [saved, setSaved] = useState<
    { id: string; label: string; payload: string }[]
  >([]);
  const [savedId, setSavedId] = useState("");
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const unit = input?.frame.unit_system === "imperial" ? "ft" : "m";
  const dlsUnit =
    input?.frame.unit_system === "imperial" ? "°/100 ft" : "°/30 m";
  const selected =
    generation?.alternatives.find((a) => a.summary.id === selectedId) ?? null;
  const displayBaseline = generation?.baseline ?? baseline;


  function changeCase(next: CollisionCase) {
    sequence.current++;
    controller.current?.abort();
    setBusy(false);
    setInput(next);
    setBaseline(null);
    setGeneration(null);
    setSelectedId("");
    setMessage("");
    setError("");
    setGlyphs([]);
  }
  async function loadDemo() {
    try {
      await onDemoLoaded(await engineCall<CollisionCase>("collision_demo"));
    } catch (e) {
      setError(parseEngineError(e));
    }
  }
  useEffect(() => {
    if (sharedInput) changeCase(sharedInput);
    else { changeCasePlaceholder(); }
    function changeCasePlaceholder() { setInput(null); setGeneration(null); setBaseline(null); onPaths([]); }
    return () => {
      sequence.current++;
      controller.current?.abort();
    };
  }, [sharedInput]);
  useEffect(() => {
    if (!input || stale) { controller.current?.abort(); setBusy(false); return; }
    const seq = ++sequence.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    const timer = window.setTimeout(() => {
      void runCollision<Candidate>("collision_analyze", input, abort.signal)
        .then((b) => {
          if (seq === sequence.current) setBaseline(b);
        })
        .catch((e) => {
          if (seq === sequence.current) setError(parseEngineError(e));
        })
        .finally(() => {
          if (seq === sequence.current) setBusy(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [input, stale]);
  useEffect(() => {
    setSaved([]);
    setSavedId("");
    if (!holeId) return;
    let active = true;
    void loadDocuments(holeId, "scan")
      .then((docs) => {
        if (active)
          setSaved(
            docs
              .filter((d) => d.id.includes(":collision:"))
              .map((d) => ({
                id: d.id,
                label: d.updated_at,
                payload: d.payload,
              })),
          );
      })
      .catch((e) => {
        if (active)
          setError(`Could not load saved runs: ${parseEngineError(e)}`);
      });
    return () => {
      active = false;
    };
  }, [holeId]);

  async function generate() {
    if (!input || stale) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const seq = ++sequence.current;
    setBusy(true);
    setError("");
    setMessage("");
    setGeneration(null);
    setSelectedId("");
    try {
      const g = await runCollision<Generation>(
        "generate_drill_path",
        input,
        abort.signal,
      );
      if (seq !== sequence.current) return;
      setGeneration(g);
      setSelectedId(g.alternatives[0]?.summary.id ?? "");
      setMessage(
        `${g.ledger.length} candidates evaluated. ${g.ledger.filter((r) => r.meets_constraints).length} meet the configured geometry constraints.`,
      );
    } catch (e) {
      if (seq === sequence.current) setError(parseEngineError(e));
    } finally {
      if (seq === sequence.current) setBusy(false);
    }
  }
  function cancel() {
    sequence.current++;
    controller.current?.abort();
    setBusy(false);
    setMessage("Calculation cancelled; no new candidate selected.");
  }

  useEffect(() => {
    if (!input || !displayBaseline) {
      setGlyphs([]);
      return;
    }
    let active = true;
    const items: {
      center: [number, number, number];
      covariance: number[][];
      label: string;
      color: string;
    }[] = [];
    const add = (
      p: { north: number; east: number; tvd: number },
      covariance: number[][],
      label: string,
      color: string,
    ) =>
      items.push({
        center: [p.north, p.east, p.tvd],
        covariance,
        label,
        color,
      });
    add(
      input.start,
      input.envelope.covariance,
      "Current state EOU",
      COLORS.current,
    );
    for (const e of displayBaseline.encounters) {
      add(
        e.reference,
        input.envelope.covariance,
        "Uncorrected EOU",
        COLORS.baseline,
      );
      const off = input.offsets.find((o) => o.id === e.offset_id)!;
      add(e.offset, off.envelope.covariance, `${off.name} EOU`, COLORS.offset);
    }
    if (selected) {
      for (let i = 1; i <= 7; i++)
        add(
          selected.points[Math.floor(((selected.points.length - 1) * i) / 8)],
          input.envelope.covariance,
          "Correction EOU",
          COLORS.correction,
        );
      for (const e of selected.encounters)
        add(
          e.reference,
          input.envelope.covariance,
          "Correction closest approach EOU",
          COLORS.correction,
        );
    }
    void engineCall<Glyph[]>(
      "uncertainty_glyphs",
      items.map((i) => ({
        center: i.center,
        covariance: i.covariance,
        confidence: input.confidence,
        vsp_deg: 0,
      })),
    )
      .then((gs) => {
        if (active)
          setGlyphs(
            gs.flatMap((g, i) => glyphPaths(g, items[i].label, items[i].color)),
          );
      })
      .catch((e) => {
        if (active) {
          setGlyphs([]);
          setError(parseEngineError(e));
        }
      });
    return () => {
      active = false;
    };
  }, [input, displayBaseline, selected]);

  const paths = useMemo<ExtraPath[]>(() => {
    if (!input) return [];
    const out: ExtraPath[] = [
      {
        name: "CURRENT · supplied survey / bit state",
        layer: "Current path",
        points: input.current,
        color: COLORS.current,
        dash: "solid",
        width: 7,
      },
      ...input.offsets.map((o) => ({
        name: `OFFSET · ${o.name}`,
        layer: "Offset holes",
        points: o.points,
        color: COLORS.offset,
        dash: "solid" as const,
        width: 5,
      })),
    ];
    if (displayBaseline)
      out.push({
        name: "UNCORRECTED · endpoint-constrained route",
        layer: "Uncorrected route",
        points: displayBaseline.points,
        color: COLORS.baseline,
        dash: "dash",
        width: 4,
      });
    if (selected)
      out.push({
        name: `CORRECTION · ${selected.summary.id} · evaluation candidate`,
        layer: "Correction path",
        points: selected.points,
        color: COLORS.correction,
        dash: "solid",
        width: 7,
      });
    for (const [candidate, label, color] of [
      [displayBaseline, "Uncorrected", COLORS.baseline],
      [selected, "Correction", COLORS.correction],
    ] as const) {
      for (const e of candidate?.encounters ?? [])
        out.push({
          name: `${label} → ${e.offset_name} · ${fmt(e.distance)} ${unit} · ref MD ${fmt(e.reference.md)} / offset MD ${fmt(e.offset.md)}`,
          layer: "Clearance connectors",
          points: [e.reference, e.offset],
          color,
          dash: "dot",
          width: 4,
        });
    }
    // Crosshair with declared display size only; the target is a point constraint.
    const t = input.target;
    const d = 3;
    out.push({
      name: "TARGET · required endpoint and exit attitude",
      layer: "Target",
      color: COLORS.correction,
      dash: "solid",
      width: 5,
      points: [
        { ...t, north: t.north - d },
        { ...t, north: t.north + d },
        t,
        { ...t, east: t.east - d },
        { ...t, east: t.east + d },
      ],
    });
    return [...out, ...glyphs];
  }, [input, displayBaseline, selected, glyphs, unit]);
  const forecastMatches = input && forecast && JSON.stringify(input.start) === JSON.stringify(forecast.bit) && input.frame.unit_system === forecast.unit;
  useEffect(() => { onPaths(stale ? [] : [...paths, ...(forecastMatches && forecast ? [{ name: "SCENARIO · " + forecast.name, layer: "Selected forecast", points: forecast.path, color: "#74b7ff", width: 5, dash: "dot" as const }] : [])], input?.name ?? ""); }, [paths, stale, onPaths, input?.name, forecastMatches, forecast]);
  useEffect(() => {
    let active = true;
    setForecastClearance(null);
    if (input && forecast && forecastMatches && !stale) void engineCall<{ clearance_lower_bound: number }[]>("screen_forecast", { case: input, points: forecast.path })
      .then(encounters => { if (active) setForecastClearance(Math.min(...encounters.map(e => e.clearance_lower_bound))); })
      .catch(e => { if (active) setError(parseEngineError(e)); });
    return () => { active = false; };
  }, [input, forecast, stale, forecastMatches]);
  async function useActive() { try { setError(""); await onUseActive(); } catch(e) { setError(parseEngineError(e)); } }

  async function exportRun() {
    if (!generation) return;
    try {
      const a = await makeAudit(generation);
      await getPlatform().files.saveTextFile(
        "delvepath-collision-audit.json",
        JSON.stringify(a, null, 2),
        "application/json",
      );
      setMessage(
        "Audit export prepared with inputs, every candidate result, source fingerprint and content hashes.",
      );
    } catch (e) {
      setError(parseEngineError(e));
    }
  }
  async function saveRun() {
    if (!generation || !holeId) return;
    try {
      const a = await makeAudit(generation);
      const id = `${holeId}:collision:${getPlatform().newId()}`;
      const payload = JSON.stringify(a);
      await saveDocument({
        id,
        hole_id: holeId,
        kind: "scan",
        payload,
        updated_at: a.createdAt,
      });
      setSaved((s) => [...s, { id, label: a.createdAt, payload }]);
      setSavedId(id);
      setMessage(
        "Immutable evaluation run saved in this project. Survey rows are unchanged.",
      );
    } catch (e) {
      setError(`Save failed: ${parseEngineError(e)}`);
    }
  }
  async function importText(text: string) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const seq = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const parsed = JSON.parse(text) as Audit | CollisionCase;
      if ("format" in parsed) {
        await verifyAudit(parsed);
        const replay = await runCollision<Generation>(
          "generate_drill_path",
          parsed.result.input,
          abort.signal,
        );
        const same = (await digest(replay)) === parsed.resultSha256;
        if (seq !== sequence.current) return;
        changeCase(parsed.result.input);
        setGeneration(replay);
        setSelectedId(replay.alternatives[0]?.summary.id ?? "");
        setMessage(
          same
            ? "Replay verified: current engine reproduces the saved result hash."
            : "Replay differs from the saved engine result. Review the source fingerprint and regenerate.",
        );
      } else {
        await runCollision<Candidate>(
          "collision_analyze",
          parsed,
          abort.signal,
        );
        if (seq !== sequence.current) return;
        changeCase(parsed);
      }
      setEditor(false);
    } catch (e) {
      if (seq === sequence.current)
        setError(`Import/replay failed: ${parseEngineError(e)}`);
    } finally {
      if (seq === sequence.current) setBusy(false);
    }
  }
  async function importFile() {
    try {
      const file = await getPlatform().files.pickTextFile(".json");
      if (file) await importText(file.text);
    } catch (e) {
      setError(parseEngineError(e));
    }
  }

  if (!input) return <div className="workspace-panel field-panel">
    <span className="eyebrow">4 · CHECK THE SPACE AHEAD</span><h2>Will this route crowd another hole?</h2>
    <p>Use the active hole, its selected Flight Deck forecast, and the other holes in this project. Each hole needs a source-labelled uncertainty envelope.</p>
    <div className="ws-row"><button className="primary" onClick={() => void useActive()}>Use active hole & forecast</button><button onClick={() => void loadDemo()}>Load crossing demo</button><button onClick={() => void importFile()}>Import case / audit</button></div>
    <p>The crossing example loads three holes into Survey: a northbound active lateral, an eastbound crossing ahead, and a lower lateral that limits a downward detour. Start here for a complete walkthrough.</p>
    {saved.length > 0 && <details><summary>Save, export &amp; replay</summary><p>These runs contain their own inputs. Replay reconstructs that recorded snapshot.</p><select aria-label="Saved collision run" value={savedId} onChange={e => setSavedId(e.target.value)}><option value="">Choose saved run…</option>{saved.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select><button disabled={!savedId} onClick={() => { const s = saved.find(s => s.id === savedId); if (s) void importText(s.payload); }}>Replay saved run</button></details>}
    {error && <p role="alert" className="error">{error} <button onClick={onNavigate}>Open Uncertainty</button></p>}
  </div>;
  return (
    <div className="collision-workspace">
      <header className="collision-header">
        <div>
          <span className="eyebrow">PLAN / ANTI-COLLISION LAB</span>
          <h1>Will this route crowd another hole?</h1>
        </div>
        <div className="collision-actions">
          <button onClick={() => void useActive()}>Use active hole & forecast</button>
          <button onClick={() => void loadDemo()}>Load crossing demo</button>
          <button onClick={() => void importFile()}>Import case / audit</button>
          <button
            onClick={() => {
              setJson(JSON.stringify(input, null, 2));
              setEditor(true);
            }}
          >
            Edit complete case
          </button>
        </div>
      </header>
      {stale && <div className="field-callout" role="status">The survey, forecast or uncertainty changed. This result is out of date. Use active hole &amp; forecast to refresh it.</div>}
      <div className="collision-layout">
        <aside className="collision-controls">
          <span className="case-badge">
            {input.synthetic
              ? "SYNTHETIC / constructed"
              : "USER-SUPPLIED / evaluation"}
          </span>
          <h2>{input.name}</h2>
          <p className="muted">
            The viewer shows this case's recorded inputs. Amber is a route to the chosen endpoint; cyan is a generated correction. Use active hole &amp; forecast to refresh the case from your project.
          </p>
          <div className="collision-anchor">
            CURRENT MD{" "}
            <b>
              {fmt(input.start.md)} {unit}
            </b>
            <span>
              INC {fmt(input.start.inc_deg, 1)}° · AZI{" "}
              {fmt(input.start.azi_deg, 1)}°
            </span>
          </div>
          {forecastClearance != null && <div className="field-callout">Selected Flight Deck forecast: <b>{forecast?.name}</b><p>Sampled path clearance: {fmt(forecastClearance)} {unit}. This checks the exact displayed forecast polyline; correction generation below explores new curves to the same endpoint.</p></div>}
          <fieldset>
            <legend>Path constraints</legend>
            <label data-help="Physical radius of the active hole in the current length units, not its diameter. Added to both uncertainty envelopes and the clearance margin.">Active hole radius <input aria-label="Active hole radius" type="number" min="0" step="0.01" value={input.radius} onChange={e => changeCase({ ...input, radius: Number(e.target.value) })} /></label>
            {(
              [
                ["max_dls", "Maximum dogleg", dlsUnit],
                ["max_excursion", "Search excursion", unit],
                ["margin", "Additional clearance margin", unit],
              ] as const
            ).map(([key, label, suffix]) => (
              <label key={key}>
                {label}
                <span>
                  <input
                    aria-label={label}
                    type="number"
                    min="0"
                    step="0.1"
                    value={Number.isFinite(input[key]) ? input[key] : ""}
                    onChange={(e) =>
                      changeCase({
                        ...input,
                        [key]:
                          e.target.value === "" ? NaN : Number(e.target.value),
                      })
                    }
                  />{" "}
                  {suffix}
                </span>
              </label>
            ))}
            <label>
              3-D confidence region
              <select
                aria-label="Confidence region"
                value={input.confidence}
                onChange={(e) =>
                  changeCase({ ...input, confidence: Number(e.target.value) })
                }
              >
                <option value={0.9}>90%</option>
                <option value={0.95}>95%</option>
                <option value={0.99}>99%</option>
              </select>
            </label>
          </fieldset>
          <button
            className="generate-path"
            disabled={busy || !baseline || stale}
            onClick={() => void generate()}
          >
            Generate drill path
          </button>
          {busy && (
            <div role="status">
              Evaluating geometry… <button onClick={cancel}>Cancel</button>
            </div>
          )}
          {error && (
            <p className="collision-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="collision-message" role="status">
              {message}
            </p>
          )}
          {generation?.status === "no_candidate_in_search" && (
            <div className="constraint-warning">
              <b>No candidate meets these constraints.</b>
              <p>
                The bounded search found no correction. Review the target,
                dogleg limit, excursion and envelope assumptions.
              </p>
            </div>
          )}
          <details>
            <summary>Uncertainty & coordinate basis</summary>
            <p>
              3-D {input.confidence * 100}% ellipsoids from one-sigma NEV
              covariance. All lengths in {unit}; covariance in {unit}². Same
              region projected into Plan and Profile.
            </p>
            <p>{input.envelope.source}</p>
            <p>
              Whole-path constant envelopes, explicitly declared. Not ISCWSA Rev
              5 propagation. No field tool model is implied.
            </p>
            <p>
              Origin: {input.frame.origin_id}. North:{" "}
              {input.frame.north_reference}. Datum:{" "}
              {input.frame.vertical_datum_name}; TVD positive down.
            </p>
            <p>
              Global screening uses enclosing spheres around the ellipsoids plus
              hole radii and the entered margin. This may reject viable routes;
              a negative lower bound is inconclusive about physical
              intersection.
            </p>
          </details>
          <details>
            <summary>Save, export & replay</summary>
            <div className="collision-actions">
              <button disabled={!generation || stale} onClick={() => void exportRun()}>
                Export audit JSON
              </button>
              <button
                disabled={!selected || !generation || stale}
                onClick={() => {
                  if (generation)
                    void getPlatform()
                      .files.saveTextFile(
                        "correction-candidate.csv",
                        candidateCsv(generation, selectedId),
                        "text/csv",
                      )
                      .catch((e) => setError(parseEngineError(e)));
                }}
              >
                Export candidate CSV
              </button>
              <button
                disabled={!generation || !holeId || stale}
                onClick={() => void saveRun()}
              >
                Save run to project
              </button>
            </div>
            {!holeId && (
              <p>
                Open a project in Survey to save a run there. File exports work
                independently.
              </p>
            )}
            {saved.length > 0 && (
              <>
                <select
                  aria-label="Saved collision run"
                  value={savedId}
                  onChange={(e) => setSavedId(e.target.value)}
                >
                  <option value="">Choose saved run…</option>
                  {saved.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!savedId}
                  onClick={() => {
                    const s = saved.find((x) => x.id === savedId);
                    if (s) void importText(s.payload);
                  }}
                >
                  Replay saved run
                </button>
              </>
            )}
          </details>
        </aside>
        <div className="collision-results">
          <div className="collision-comparison">
            <div className="comparison-card baseline">
              <span>ROUTE TO ENDPOINT</span>
              <strong>
                {displayBaseline
                  ? `${fmt(displayBaseline.summary.min_clearance_bound)} ${unit}`
                  : "—"}
              </strong>
              <small>Space left after uncertainty, hole sizes and margin. Negative means the entered spacing is not met; it does not prove a physical collision.</small>
              <b>
                {displayBaseline?.summary.meets_constraints
                  ? "Meets configured geometry"
                  : "Correction needed for configured geometry"}
              </b>
            </div>
            <div className="comparison-card correction">
              <button disabled={!selected || stale} onClick={() => { if (selected) onUsePlan(selected); }} data-help="Keep this geometric correction as the comparison plan in Flight Deck. It stays a planned route; survey rows are unchanged.">Use correction as comparison plan</button>
              <span>CORRECTION CANDIDATE</span>
              <strong>
                {selected
                  ? `${fmt(selected.summary.min_clearance_bound)} ${unit}`
                  : "Generate to compare"}
              </strong>
              <small>
                {selected
                  ? `Dogleg ≤ ${fmt(selected.summary.max_dls_bound)} ${dlsUnit} · length ${fmt(selected.summary.length)} ${unit}`
                  : "Target and attitude constrained · all offsets checked"}
              </small>
              {generation && generation.alternatives.length > 0 && (
                <select
                  aria-label="Correction candidate"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {generation.alternatives.map((a) => (
                    <option key={a.summary.id} value={a.summary.id}>
                      {a.summary.id} · {fmt(a.summary.length)} {unit} · bound{" "}
                      {fmt(a.summary.min_clearance_bound)} {unit}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="comparison-card">
              <span>CALCULATION RECORD</span>
              <p>
                {generation
                  ? `${generation.ledger.length} candidates · ${generation.ledger.filter((c) => c.meets_constraints).length} pass configured checks`
                  : `${input.offsets.length} offsets · uncertainty + hole radii + margin`}
              </p>
              <button disabled={!generation || stale} onClick={() => setReport(true)}>
                Inspect calculation & report
              </button>
              <small>
                Geometric evaluation. No separation factor or collision
                probability.
              </small>
            </div>
          </div>
        </div>
      </div>
      {editor && (
        <div className="modal-back">
          <div
            className="modal case-editor"
            role="dialog"
            aria-label="Edit complete collision case"
          >
            <h2>Complete input case</h2>
            <p>
              Explicit start/target, current path, offset polylines, coordinate
              frames, radii and covariance provenance. Lengths follow
              frame.unit_system. Changing units requires converting all values.
            </p>
            <textarea
              aria-label="Collision case JSON"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              spellCheck={false}
            />
            <div className="collision-actions">
              <button onClick={() => void importText(json)}>
                Validate & apply case
              </button>
              <button onClick={() => setEditor(false)}>Cancel</button>
            </div>
            {error && <p role="alert">{error}</p>}
          </div>
        </div>
      )}
      {report && generation && (
        <div className="modal-back">
          <div
            className="modal collision-report"
            role="dialog"
            aria-label="Calculation audit report"
          >
            <header>
              <h2>Anti-collision planning · calculation audit</h2>
              <button onClick={() => setReport(false)}>Close report</button>
            </header>
            <p className="case-badge">
              {input.synthetic
                ? "SYNTHETIC / constructed"
                : "User-supplied evaluation"}
            </p>
            <p>{generation.notice}</p>
            <h3>{generation.input.name}</h3>
            <p>
              Method: {generation.method}. App {__DELVE_VERSION__} · revision{" "}
              {__DELVE_GIT_SHA__}. Source fingerprint {__DELVE_SOURCE_SHA256__}.
            </p>
            <p>
              NEV / TVD positive down · {unit} · covariance {unit}² ·{" "}
              {input.frame.north_reference} north · {input.frame.origin_id} ·{" "}
              {input.frame.vertical_datum_name}.
            </p>
            <h3>Inputs & interpretation</h3>
            <p>
              DLS ≤ {input.max_dls} {dlsUnit}; margin {input.margin} {unit};
              search excursion {input.max_excursion} {unit}; 3-D confidence{" "}
              {input.confidence * 100}%; curve/chord tolerance{" "}
              {input.chord_tolerance} {unit}.
            </p>
            {generation.assumptions.map((a) => (
              <p key={a}>{a}</p>
            ))}
            <h3>Before / after at each offset</h3>
            <table>
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Offset</th>
                  <th>Centerline {unit}</th>
                  <th>Required {unit}</th>
                  <th>Clearance bound {unit}</th>
                  <th>Reference MD</th>
                  <th>Offset MD</th>
                </tr>
              </thead>
              <tbody>
                {[generation.baseline, ...(selected ? [selected] : [])].flatMap(
                  (c) =>
                    c.encounters.map((e) => (
                      <tr key={`${c.summary.id}-${e.offset_id}`}>
                        <td>{c.summary.id}</td>
                        <td>{e.offset_name}</td>
                        <td>{fmt(e.distance)}</td>
                        <td>{fmt(e.required_distance)}</td>
                        <td>{fmt(e.clearance_lower_bound)}</td>
                        <td>{fmt(e.reference.md)}</td>
                        <td>{fmt(e.offset.md)}</td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
            <h3>Candidate ledger</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Right / High {unit}</th>
                  <th>Length ± bound {unit}</th>
                  <th>DLS bound</th>
                  <th>Clearance bound</th>
                  <th>Result / reason</th>
                </tr>
              </thead>
              <tbody>
                {generation.ledger.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>
                      {fmt(c.excursion_right)} / {fmt(c.excursion_high)}
                    </td>
                    <td>
                      {fmt(c.length)} ± {fmt(c.length_error_bound, 5)}
                    </td>
                    <td>{fmt(c.max_dls_bound)}</td>
                    <td>{fmt(c.min_clearance_bound)}</td>
                    <td>
                      {c.meets_constraints
                        ? "Meets configured geometry"
                        : c.reasons.join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="collision-actions">
              <button onClick={() => void exportRun()}>
                Export audit JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
