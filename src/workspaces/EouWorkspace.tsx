import { useEffect, useRef, useState, type ReactNode } from "react";
import { engineCall, parseEngineError } from "../engine";
import { fmt, type UnitSystem } from "../domain";
import type { Point } from "../collision/types";
import type { SharedUncertainty } from "../fieldModel";
import type { ExtraPath } from "../Charts";
import { glyphPaths, type Glyph } from "../collision/types";

export function EouWorkspace({
  unit,
  station,
  onPaths,
  vspDeg,
  holeId,
  onUncertainty, locationControl, onNavigate, shared, modelKey,
}: {
  unit: UnitSystem;
  station: Point | null;
  onPaths: (paths: ExtraPath[]) => void;
  vspDeg: number;
  holeId: string;
  modelKey: string;
  shared?: SharedUncertainty;
  locationControl: ReactNode;
  onNavigate: () => void;
  onUncertainty: (value: SharedUncertainty | null, id: string) => void;
}) {
  const [values, setValues] = useState({
    c_nn: "9",
    c_ne: "0",
    c_nv: "0",
    c_ee: "4",
    c_ev: "0",
    c_vv: "1",
  });
  const [source, setSource] = useState(
    "Manual example covariance — not a survey tool model",
  );
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [wholePath, setWholePath] = useState(false);
  const revision = useRef(0);
  const basis = useRef("");
  function invalidate() {
    revision.current++;
    setBusy(false);
    setOut("");
    setErr("");
    onPaths([]);
    onUncertainty(null, holeId);
  }
  useEffect(() => {
    revision.current++; setOut(""); setErr(""); setBusy(false); onPaths([]);
    return () => { revision.current++; };
  }, [holeId, unit, station?.md, station?.north, station?.east, station?.tvd, vspDeg, onPaths, modelKey]);
  useEffect(() => {
    const changed = basis.current !== holeId + unit;
    basis.current = holeId + unit;
    if (shared && shared.unit === unit) {
      const c = shared.covariance;
      setValues({ c_nn: String(c[0][0]), c_ne: String(c[0][1]), c_nv: String(c[0][2]), c_ee: String(c[1][1]), c_ev: String(c[1][2]), c_vv: String(c[2][2]) });
      setSource(shared.source); setWholePath(shared.wholePath);
    } else if (changed) {
      setValues({ c_nn: "9", c_ne: "0", c_nv: "0", c_ee: "4", c_ev: "0", c_vv: "1" });
      setSource("Manual example covariance — not a survey tool model"); setWholePath(false);
    }
  }, [holeId, unit, shared]);
  async function importCov() {
    const run = ++revision.current;
    setBusy(true);
    setErr("");
    try {
      if (!station)
        throw new Error(
          "Select a calculated station before placing uncertainty.",
        );
      if (!source.trim())
        throw new Error("Record the covariance source/model before importing.");
      const entries = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          value.trim() === "" ? NaN : Number(value),
        ]),
      );
      if (Object.values(entries).some((v) => !Number.isFinite(v)))
        throw new Error("All six covariance entries must be finite numbers.");
      const row = {
        ...entries,
        md: station.md,
        length_unit: unit,
        covariance_unit: unit,
        basis: "one_sigma_covariance",
        source_dimension: 3,
        source_probability: null,
        source_k: null,
        provider: source,
        model: "offline import",
        version: "v0.2",
        source_timestamp: new Date().toISOString(),
      };
      const norm = await engineCall<{ provenance: string; c: number[][] }>(
        "normalize_covariance",
        { row, hole_unit: unit },
      );
      const center: [number, number, number] = [
        station.north,
        station.east,
        station.tvd,
      ];
      const [glyph] = await engineCall<Glyph[]>("uncertainty_glyphs", [
        { center, covariance: norm.c, confidence: 0.95, vsp_deg: vspDeg },
      ]);
      const plan95 = await engineCall<[number, number, number][]>(
        "ellipse_polyline",
        {
          c: norm.c,
          mode: "marginal2d",
          p: 0.95,
          plane: "plan",
          center,
          n: 48,
        },
      );
      if (run !== revision.current) return;
      onUncertainty({ holeId, station, unit, covariance: norm.c, source, wholePath }, holeId);
      onPaths([
        ...glyphPaths(
          glyph,
          `EOU MD ${fmt(station.md)} · ${source}`,
          "#9caee6",
        ),
        {
          name: "EOU 2-D marginal 95% (χ²₂) — Plan view only",
          layer: "2-D marginal (Plan only)",
          view: "planView",
          color: "#e6b35a",
          dash: "dot",
          points: plan95.map(([north, east, tvd]) => ({ north, east, tvd })),
        },
      ]);
      setOut(
        `Imported 1σ NEV covariance at MD ${fmt(station.md)}. 2-D 95% k≈2.4477; 3-D 95% k=${fmt(glyph.k, 4)}. 3-D k=3 covers approximately 97.1%. ${glyph.label}. ${norm.provenance}. Profile follows section azimuth ${vspDeg}°.`,
      );
    } catch (e) {
      if (run !== revision.current) return;
      onPaths([]);
      setOut("");
      setErr(parseEngineError(e));
    } finally {
      if (run === revision.current) setBusy(false);
    }
  }
  return (
    <div className="workspace-panel field-panel">
      <span className="eyebrow">3 · ALLOW FOR POSITION ERROR</span>
      <h2>How certain is this position?</h2>
      <p>The line is the calculated hole centre. The translucent shape shows the position error you enter around it. Select a point, enter the spread and source, then show it on the same viewer.</p>
      {locationControl}
      <p className="muted">
        Offline covariance import in {unit === "imperial" ? "ft²" : "m²"}. Full
        symmetric NEV matrix. Ellipsoids and their Plan/Profile outlines
        represent the same 3-D 95% region. The smaller 2-D marginal is shown in
        Plan only.
      </p>
      <p className="muted">Selected station: {station ? `MD ${fmt(station.md)} ${unit === "imperial" ? "ft" : "m"}` : "none — select a survey row first"}.</p>
      {shared?.wholePath && <p className="field-callout">Clearance is using this hole's declared whole-path envelope: {shared.source}</p>}
      <div className="field-inputs">
        {([["c_nn","North / South spread"],["c_ee","East / West spread"],["c_vv","Vertical spread"]] as const).map(([key,label]) => <label key={key} data-help="One standard deviation of position error, in hole length units. The 95% 3-D ellipsoid scales the full covariance by about 2.795. Zero means no error in this direction under your entered model.">{label}
          <span><input type="number" aria-label={label} min="0" value={Number(values[key]) >= 0 ? Math.sqrt(Number(values[key])) : ""} onChange={e => { invalidate(); setValues({ ...values, [key]: e.target.value === "" ? "" : String(Number(e.target.value) ** 2) }); }} /> {unit === "imperial" ? "ft" : "m"} (1σ)</span></label>)}
      </div>
      <details><summary>Advanced: correlated errors / covariance matrix</summary>
      <div className="ws-row">
        {Object.entries(values).map(([key, value]) => (
          <label key={key}>
            {key.toUpperCase()}
            <input
              aria-label={key.toUpperCase()}
              value={value}
              onChange={(e) => { invalidate(); setValues({ ...values, [key]: e.target.value }); }}
            />
          </label>
        ))}
      </div>
      </details>
      <div className="ws-row">
        <label data-help="Name the survey report, tool model or constructed assumption behind these values. The source is carried into the clearance calculation and audit.">
          Source / model
          <input value={source} onChange={(e) => { invalidate(); setSource(e.target.value); }} />
        </label>
        <label data-help="Explicitly use this same covariance everywhere along this hole for the clearance demonstration. A single station covariance does not automatically describe future drilling or another hole.">
          <input type="checkbox" checked={wholePath} onChange={e => { invalidate(); setWholePath(e.target.checked); }} />
          Apply this envelope to the whole hole
        </label>
        <button type="button" disabled={busy || !station} onClick={() => void importCov()}>
          {busy ? "Importing…" : "Import 1σ matrix"}
        </button>
      </div>
      {err && <div className="error" role="alert">{err}</div>}
      {out && <div className="ws-summary">{out}</div>}
      {out && <div className="field-callout"><p>The viewer now shows this point's 95% position region. {wholePath ? "The same declared envelope is available to Clearance for this hole." : "This is a single-point display. Declare a whole-hole envelope above before using it for clearance."}</p><button onClick={onNavigate}>4 · Check nearby holes</button></div>}
      <p className="muted">
        Imported uncertainty is not ISCWSA Rev 5 propagation. Geocertainty
        remains import-only. BHA response envelopes are distinct from positional
        uncertainty.
      </p>
    </div>
  );
}
