import { useEffect, useRef, useState } from "react";
import { engineCall, parseEngineError } from "../engine";
import { fmt, lengthLabel, dlsLabel, type UnitSystem } from "../domain";
import { getPlatform } from "../platform";
import type { ExtraPath } from "../Charts";
import type { Point } from "../collision/types";
import type { FlightSelection } from "../fieldModel";

export interface RecoveryDemo {
  name: string; mark: string;
  surveys: { md: number; inc_deg: number; azi_deg: number; accepted: boolean }[];
  plan: { stations: Point[] };
}
interface Card {
  input: { id: string; name: string; added_md: number };
  future_bit: Point; next_sensor: Point; path: Point[];
  max_dls: number; slide_footage: number; ud: number | null; lr: number | null;
  constraint_feasible: boolean; violations: string[]; assumptions: string[];
}
const defaults = (unit: UnitSystem) => unit === "imperial"
  ? { lag: "52", stand: "93", slide: "28", yield: "8", tf: "270", max: "12" }
  : { lag: "15", stand: "30", slide: "9", yield: "8", tf: "270", max: "12" };

export function FlightDeckWorkspace({ unit, sensor, modelKey, holeName, plan, onDemoLoaded, onUpdate, onNavigate }: {
  unit: UnitSystem; sensor: Point | null; modelKey: string; holeName: string; plan: Point[];
  onDemoLoaded: (demo: RecoveryDemo) => Promise<void>;
  onUpdate: (paths: ExtraPath[], selection: FlightSelection | null) => void;
  onNavigate: (workspace: "survey" | "eou" | "collision") => void;
}) {
  const [values, setValues] = useState(() => defaults(unit));
  const [cards, setCards] = useState<Card[]>([]);
  const [estimate, setEstimate] = useState<{ bit: Point; path: Point[] } | null>(null);
  const [selected, setSelected] = useState("custom");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultKey, setResultKey] = useState("");
  const revision = useRef(0);
  const len = lengthLabel(unit);
  const key = JSON.stringify([modelKey, values, plan]);
  const ready = resultKey === key;
  const chosen = ready ? cards.find(c => c.input.id === selected) : undefined;
  useEffect(() => { setValues(defaults(unit)); }, [unit]);

  useEffect(() => {
    const run = ++revision.current;
    setError(""); setBusy(false); setCards([]); setEstimate(null);
    onUpdate([], null);
    if (!requested || !sensor) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setBusy(true);
        try {
          const { lag, stand, slide, yield: response, tf, max } = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() === "" ? NaN : Number(v)]));
          if (![lag, stand, slide, response, tf, max].every(Number.isFinite) || lag < 0 || stand <= 0 || stand < lag || slide < 0 || slide > stand || response < 0 || max <= 0 || tf < 0 || tf > 360)
            throw new Error("Enter valid lengths: next interval must cover sensor-to-bit distance; slide must be between zero and the interval length. Toolface is 0–360°. Curvature limit must be positive.");
          const proj = lag > 0 ? await engineCall<{ points: Point[] }>("project_hold", { start: sensor, added_md: lag, unit, class: "projected" }) : { points: [sensor] };
          const bit = proj.points.slice(-1)[0]!;
          const bha = {
            id: "field-bha", hole_id: holeName, name: "Entered motor response", configuration_revision: 1,
            start_md: sensor.md, end_md: null, motor_id: "", motor_model: "", bend_setting: "", bit_size: 0, hole_size: 0,
            sensor_to_bit: lag, hole_section: "", formation_tag: "", toolface_basis: "gravity",
            slide_yield_low: response, slide_yield_nom: response, slide_yield_high: response,
            rotary_dls: 0, rotary_tf_deg: 0, yield_ref: unit === "imperial" ? "per100_ft" : "per30_m",
            notes: "Hold last survey attitude to bit. Zero rotary tendency. User-entered slide response.",
          };
          let reference: Point | null = null;
          if (plan.length > 1 && bit.md + stand >= plan[0].md && bit.md + stand <= plan.slice(-1)[0]!.md) {
            reference = await engineCall<Point>("evaluate_at_md", { md: bit.md + stand, input: {
              unit_system: unit, convention: "oilfield_from_vertical", azimuth_reference: "unknown", vsp_deg: 0,
              tie_in: plan[0], stations: plan.map(p => ({ ...p, class: "planned", source: "manual", comment: "Comparison plan" })),
            } });
          }
          const next: Card[] = [];
          const unavailable: string[] = [];
          for (const [id, name, footage, yieldValue] of [
            ["hold", "Hold direction", 0, 0],
            ["custom", "Your slide then rotate", slide, response],
            ["gentle", "Longer, gentler slide", Math.min(stand, slide * 2), slide * 2 <= stand ? response / 2 : response * slide / stand],
          ] as const) {
            const segments = [
              ...(footage > 0 ? [{ mode: "slide", length: footage, toolface_deg: tf, slide_yield_dls: yieldValue, rotary_dls: 0, rotary_tf_deg: 0, dls_ref: bha.yield_ref }] : []),
              ...(stand > footage ? [{ mode: "rotate", length: stand - footage, toolface_deg: 0, slide_yield_dls: 0, rotary_dls: 0, rotary_tf_deg: 0, dls_ref: bha.yield_ref }] : []),
            ];
            try { next.push(await engineCall<Card>("flight_scenario", {
              start_bit: bit, bha, input: { id, name, method: id === "hold" ? "hold" : "slide_rotate", added_md: stand, slide_yield: yieldValue, segments },
              plan: reference, corridor: null, constraints: { stand_length: stand, max_slide_per_stand: stand, min_useful_slide: 0, max_dls: max, max_yield: max }, unit,
            })); } catch (e) {
              if (id === "hold") throw e;
              unavailable.push(name + ": " + parseEngineError(e));
            }
          }
          if (run !== revision.current) return;
          setEstimate({ bit, path: [sensor, ...proj.points] }); setCards(next); setResultKey(key);
          if (!next.some(c => c.input.id === selected)) setSelected("hold");
          setError(unavailable.join(" "));
        } catch (e) { if (run === revision.current) setError(parseEngineError(e)); }
        finally { if (run === revision.current) setBusy(false); }
      })();
    }, 200);
    return () => { window.clearTimeout(timer); revision.current++; };
  }, [key, requested, sensor, unit, holeName, onUpdate]);

  useEffect(() => {
    if (!chosen || !estimate || !sensor) return;
    const hold = cards.find(c => c.input.id === "hold")!;
    const paths: ExtraPath[] = [
      { name: "ESTIMATED · survey to bit (hold direction)", layer: "Estimated bit", color: "#e6b35a", dash: "dot", points: estimate.path },
      ...(chosen.input.id !== "hold" ? [{ name: "SCENARIO · Hold direction", layer: "Hold comparison", color: "#e6b35a", dash: "dash" as const, points: hold.path }] : []),
      { name: "SCENARIO · " + chosen.input.name, layer: "Selected forecast", color: "#64d7d8", width: 7, points: chosen.path },
      { name: "ESTIMATED · Bit now", layer: "Estimated bit", color: "#e6b35a", marker: true, points: [estimate.bit] },
      { name: "SCENARIO · Next survey MD " + fmt(chosen.next_sensor.md) + " " + len, layer: "Selected forecast", color: "#e8e3f5", marker: true, points: [chosen.next_sensor] },
    ];
    onUpdate(paths, { id: chosen.input.id, name: chosen.input.name, sensor, bit: estimate.bit, estimatedPath: estimate.path, path: chosen.path, nextSensor: chosen.next_sensor, maxDls: chosen.max_dls, unit, modelKey });
  }, [chosen, estimate, sensor, cards, unit, modelKey, len, onUpdate]);

  async function loadDemo() {
    setError("");
    try { const demo = await engineCall<RecoveryDemo>("curve_recovery_demo"); await onDemoLoaded(demo); setValues(defaults("imperial")); setRequested(true); }
    catch (e) { setError(parseEngineError(e)); }
  }
  async function exportComparison() {
    if (!chosen || !estimate) return;
    const record = { format: "delvepath/flight-comparison/1", createdAt: new Date().toISOString(), version: __DELVE_VERSION__, source: __DELVE_SOURCE_SHA256__, holeName, unit, sensor, entered: values, estimate, selectedScenario: chosen.input.id, scenarios: cards, modelKey, assumptions: ["Hold last surveyed direction to estimate bit position.", "Zero rotary tendency; entered slide response.", "Plan offsets compare reconstructed plan at the same measured depth when covered."] };
    await getPlatform().files.saveTextFile("flight-comparison.json", JSON.stringify(record, null, 2), "application/json").catch(e => setError(parseEngineError(e)));
  }
  return <div className="workspace-panel field-panel">
    <span className="eyebrow">2 · LOOK AHEAD</span>
    <h2>What happens over the next stand?</h2>
    <p>Start at the last accepted survey in <b>{holeName}</b>. Estimate the bit, then compare three ways forward. Click a card to see its path beside you.</p>
    <div className="ws-row"><button onClick={() => void loadDemo()} data-help="Loads a constructed survey and comparison plan into the whole project. It replaces the working example in Survey too.">Load Curve Recovery demo</button></div>
    {!sensor ? <div className="field-callout">Accept a survey row to establish where the forecast starts. <button onClick={() => onNavigate("survey")}>Review surveys</button></div> : <p className="field-anchor">Accepted survey · MD {fmt(sensor.md)} {len} · inclination {fmt(sensor.inc_deg, 1)}° · direction {fmt(sensor.azi_deg, 1)}°</p>}
    {ready && cards.length > 0 && <div className="forecast-switcher" role="group" aria-label="Quick forecast selection">{cards.map(c => <button key={c.input.id} aria-pressed={c.input.id === selected} onClick={() => setSelected(c.input.id)}>{c.input.name}</button>)}</div>}
    <fieldset className="field-inputs"><legend>Enter the drilling assumptions</legend>
      {([
        ["lag", "Sensor to bit", len, "Distance along the hole from the survey tool to the bit. The amber interval holds the latest accepted inclination and azimuth; it is an estimate."],
        ["stand", "Next interval", len, "How much more hole to model after the current bit. All three cards cover this same length."],
        ["slide", "Slide length", len, "Length drilled with the motor held at the entered toolface, followed by rotating the rest of the interval."],
        ["tf", "Toolface", "°", "Direction of the bend from the high side: 0 builds angle, 90 turns right, 180 drops angle, 270 turns left. Gravity toolface needs a nonvertical hole."],
        ["yield", "Slide response", dlsLabel(unit), "Assumed bend rate while sliding. Enter a supported motor response; this is not a learned value or a measured survey."],
        ["max", "Curvature limit", dlsLabel(unit), "Each forecast checks its largest bend rate across the entire interval, including the slide before the rotary section."],
      ] as const).map(([id, label, suffix, help]) => <label key={id} data-help={help}>{label}<span><input aria-label={label} type="number" value={values[id]} onChange={e => { onUpdate([], null); setValues({ ...values, [id]: e.target.value }); }} /> {suffix}</span></label>)}
    </fieldset>
    <button className="primary" disabled={!sensor || busy} onClick={() => setRequested(true)} data-help="Calculates three forecasts with the shared Rust engine. Further edits update the cards and viewer automatically.">{busy ? "Calculating forecasts…" : requested && ready ? "Forecasts up to date" : "Compare next stand"}</button>
    {error && <p role="alert" className="error">{error}</p>}
    {ready && estimate && <p className="field-anchor">Bit estimate · MD {fmt(estimate.bit.md)} {len}. Amber joins the accepted survey to the bit; cyan is your selected forecast.</p>}
    <div className="scenario-cards" role="group" aria-label="Forecast choices">
      {ready && cards.map(c => <button key={c.input.id} className={"scenario-card " + (selected === c.input.id ? "selected" : "")} aria-pressed={selected === c.input.id} onClick={() => setSelected(c.input.id)} data-help={"Select " + c.input.name + ". The cyan path and next-survey marker change immediately. This choice is also available to uncertainty and clearance."}>
        <span className="scenario-tag">{selected === c.input.id ? "● SHOWN IN VIEWER" : "VIEW THIS OPTION"}</span><h3>{c.input.name}</h3>
        <p>{c.slide_footage === 0 ? "Continue on the current heading." : "Slide " + fmt(c.slide_footage, 1) + " " + len + ", then rotate " + fmt(c.input.added_md - c.slide_footage, 1) + " " + len + "."}</p>
        <p>Next survey: {fmt(c.next_sensor.inc_deg, 1)}° inclination · {fmt(c.next_sensor.azi_deg, 1)}° direction</p>
        <p>Largest bend: {fmt(c.max_dls, 1)} {dlsLabel(unit)}</p>
        <strong>{c.constraint_feasible ? "Within entered curvature limit" : "Exceeds entered limit"}</strong>
      </button>)}
    </div>
    {chosen && <div className="field-callout" aria-live="polite"><b>Viewing: {chosen.input.name}</b>
      <p>Bit after the stand: MD {fmt(chosen.future_bit.md)} {len}. Next survey tool position: MD {fmt(chosen.next_sensor.md)} {len}.</p>
      {chosen.ud != null && chosen.lr != null ? <p>At the same measured depth as the plan: {fmt(Math.abs(chosen.ud))} {len} {chosen.ud >= 0 ? "above" : "below"}, {fmt(Math.abs(chosen.lr))} {len} to the {chosen.lr >= 0 ? "right" : "left"}.</p> : <p>No comparison plan covers this measured depth. You can still compare the forecast shapes.</p>}
      <div className="ws-row"><button onClick={() => onNavigate("eou")}>3 · Add uncertainty</button><button onClick={() => onNavigate("collision")}>4 · Check nearby holes</button><button onClick={() => void exportComparison()}>Export this comparison</button></div>
    </div>}
    <details><summary>How this forecast is calculated</summary><p>The survey path uses Minimum Curvature. The bit estimate holds the last accepted direction across the sensor-to-bit gap. Sliding uses the entered gravity toolface and response; rotating holds direction. The next survey is sampled along the actual scenario at bit depth minus sensor spacing.</p><p>Comparison paths do not add measured survey rows. Motor response is entered, not automatically learned.</p>{chosen?.violations.map(v => <p key={v}>{v}</p>)}</details>
  </div>;
}
