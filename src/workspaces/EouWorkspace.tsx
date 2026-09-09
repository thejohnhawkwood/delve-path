import { useEffect, useRef, useState } from "react";
import { engineCall, parseEngineError } from "../engine";
import { fmt, type CalculatedStation, type UnitSystem } from "../domain";
import type { ExtraPath } from "../Charts";
import { glyphPaths, type Glyph } from "../collision/types";

export function EouWorkspace({
  unit,
  station,
  onPaths,
  vspDeg,
  holeId,
}: {
  unit: UnitSystem;
  station: CalculatedStation | null;
  onPaths: (paths: ExtraPath[]) => void;
  vspDeg: number;
  holeId: string;
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
  const revision = useRef(0);
  function invalidate() {
    revision.current++;
    setBusy(false);
    setOut("");
    setErr("");
    onPaths([]);
  }
  useEffect(() => {
    invalidate();
    return () => { revision.current++; };
  }, [holeId, unit, station?.md, station?.north, station?.east, station?.tvd, vspDeg, onPaths]);
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
    <div className="workspace-panel">
      <h2>Ellipsoids of uncertainty</h2>
      <p className="muted">
        Offline covariance import in {unit === "imperial" ? "ft²" : "m²"}. Full
        symmetric NEV matrix. Ellipsoids and their Plan/Profile outlines
        represent the same 3-D 95% region. The smaller 2-D marginal is shown in
        Plan only.
      </p>
      <p className="muted">Selected station: {station ? `MD ${fmt(station.md)} ${unit === "imperial" ? "ft" : "m"}` : "none — select a survey row first"}.</p>
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
        <label>
          Source / model
          <input value={source} onChange={(e) => { invalidate(); setSource(e.target.value); }} />
        </label>
        <button type="button" disabled={busy || !station} onClick={() => void importCov()}>
          {busy ? "Importing…" : "Import 1σ matrix"}
        </button>
      </div>
      {err && <div className="error" role="alert">{err}</div>}
      {out && <div className="ws-summary">{out}</div>}
      <p className="muted">
        Imported uncertainty is not ISCWSA Rev 5 propagation. Geocertainty
        remains import-only. BHA response envelopes are distinct from positional
        uncertainty.
      </p>
    </div>
  );
}
