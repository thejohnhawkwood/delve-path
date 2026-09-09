import { useEffect, useRef, useState } from "react";
import { engineCall, parseEngineError } from "../engine";
import { fmt, lengthLabel, type CalculatedStation, type UnitSystem } from "../domain";
import type { HoleRecord } from "../records";
import type { HoleOverlay } from "../Charts";
import { openReport, centerlineReportModel } from "../reportModel";

interface Scan {
  distance: number;
  ref_md: number;
  off_md: number;
  ref_n: number;
  ref_e: number;
  ref_tvd: number;
  off_n: number;
  off_e: number;
  off_tvd: number;
  d_north: number;
  d_east: number;
  d_tvd: number;
  crossing_angle_deg: number;
  threshold?: number | null;
  above_threshold?: boolean | null;
  frame_ok: boolean;
  label: string;
  tolerance: number;
}

function toStates(stations: CalculatedStation[]) {
  return stations.map((s) => ({
    md: s.md,
    inc_deg: s.inc_deg,
    azi_deg: s.azi_deg,
    north: s.north,
    east: s.east,
    tvd: s.tvd,
    tangent_n: 0,
    tangent_e: 0,
    tangent_t: 1,
  }));
}

function holeFrame(h: HoleRecord | null | undefined, unit: UnitSystem) {
  return {
    unit_system: (h?.unit_system as UnitSystem) || unit,
    north_reference: h?.azimuth_reference === "unknown" ? "unknown" : h?.azimuth_reference ?? "unknown",
    origin_id: h?.origin_id ?? "unspecified",
    origin_north: h?.origin_north ?? 0,
    origin_east: h?.origin_east ?? 0,
    vertical_datum: h?.vertical_datum ?? "unspecified",
    vertical_datum_name: h?.vertical_datum_name ?? "",
    crs_epsg: h?.crs_epsg ?? null,
    crs_note: h?.crs_note ?? "",
  };
}

export function CenterlineWorkspace({
  unit,
  holes,
  current,
  stations,
  overlays,
  onResult,
}: {
  unit: UnitSystem;
  holes: HoleRecord[];
  current: HoleRecord | null;
  stations: CalculatedStation[];
  overlays: HoleOverlay[];
  onResult: (s: Scan | null) => void;
}) {
  const [offsetId, setOffsetId] = useState("");
  const [threshold, setThreshold] = useState("50");
  const [scan, setScan] = useState<Scan | null>(null);
  const [err, setErr] = useState("");
  const len = lengthLabel(unit);
  const offsetChoices = holes.filter((h) => h.id !== current?.id);
  const resolvedOffsetId = offsetChoices.some((h) => h.id === offsetId) ? offsetId : (offsetChoices[0]?.id ?? "");
  const offsetHole = offsetChoices.find((h) => h.id === resolvedOffsetId) ?? null;
  const offsetStations = overlays.find((o) => o.id === resolvedOffsetId)?.stations ?? [];
  const resultCallback = useRef(onResult); resultCallback.current = onResult;
  const inputKey = JSON.stringify([current,offsetHole,stations,offsetStations,threshold]);
  useEffect(() => {setScan(null);setErr("");resultCallback.current(null);},[inputKey]);

  async function run() {
    setErr("");
    try {
      if (!current) {
        setErr("Select a reference hole.");
        return;
      }
      if (!offsetHole || offsetHole.id === current.id) {
        setErr("Select a different offset path. Self-scan is not a clearance result.");
        return;
      }
      if (stations.length < 2 || offsetStations.length < 2) {
        setErr("Both paths need at least two calculated stations.");
        return;
      }
      const toM = unit === "imperial" ? 0.3048 : 1;
      const refIntervals = await engineCall("intervals_from_states", { states: toStates(stations), to_m: toM });
      const offIntervals = await engineCall("intervals_from_states", {
        states: toStates(offsetStations),
        to_m: toM,
      });
      const refFrame = holeFrame(current, unit);
      const offFrame = holeFrame(offsetHole, (offsetHole.unit_system as UnitSystem) || unit);
      const comparable = await engineCall<{ ok: boolean; issues?: { message: string }[] }>("frames_comparable", {
        a: refFrame,
        b: offFrame,
      });
      if (!comparable.ok) {
        setScan(null);
        onResult(null);
        setErr(
          `Blocked: units, origin, north, or datum are incompatible. ${(comparable.issues ?? []).map((i) => i.message).join(" ")}`
        );
        return;
      }
      const md0 = stations[0].md;
      const md1 = stations[stations.length - 1].md;
      const o0 = offsetStations[0].md;
      const o1 = offsetStations[offsetStations.length - 1].md;
      const branchMd =
        offsetHole.parent_hole_id === current.id
          ? offsetHole.branch_md
          : current.parent_hole_id === offsetHole.id
            ? current.branch_md
            : current.parent_hole_id && current.parent_hole_id === offsetHole.parent_hole_id
              ? current.branch_md
              : null;
      const out = await engineCall<Scan>("centerline_scan", {
        ref_intervals: refIntervals,
        off_intervals: offIntervals,
        ref_frame: refFrame,
        off_frame: offFrame,
        ref_md_range: [md0, md1],
        off_md_range: [o0, o1],
        exclude_ref: branchMd != null ? [md0, branchMd] : null,
        exclude_off: branchMd != null ? [o0, branchMd] : null,
        threshold: Number(threshold),
        to_m: toM,
      });
      setScan(out);
      onResult(out);
    } catch (e) {
      setScan(null);
      onResult(null);
      setErr(parseEngineError(e));
    }
  }

  return (
    <div className="workspace-panel">
      <h2>Centerline screening</h2>
      <p className="muted">
        Centerline separation screening only — position uncertainty, hole/casing size, survey quality, and company
        anti-collision rules are not included. Incompatible units, origin, north, or datum block the scan. This is not a
        separation factor, MASD, or probability of collision.
      </p>
      <div className="ws-row">
        <label>
          Offset path
          <select value={resolvedOffsetId} onChange={(e) => setOffsetId(e.target.value)}>
            {holes
              .filter((h) => h.id !== current?.id)
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Threshold {len}
          <input value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </label>
        <button type="button" onClick={() => void run()}>
          Scan
        </button>
        <button
          type="button"
          disabled={!scan}
          onClick={() =>
            scan &&
            openReport(
              centerlineReportModel({
                refPath: current?.name ?? "current",
                offPath: offsetHole?.name ?? offsetId,
                frame: scan.frame_ok ? "comparable" : "blocked",
                distance: fmt(scan.distance),
                refMd: fmt(scan.ref_md),
                offMd: fmt(scan.off_md),
                threshold: `${threshold} ${len}`,
                tolerance: fmt(scan.tolerance),
              })
            )
          }
        >
          Report
        </button>
      </div>
      {err && <div className="error">{err}</div>}
      {scan && (
        <div className="ws-summary">
          <p>
            Distance {fmt(scan.distance)} {len} at ref MD {fmt(scan.ref_md)} / offset MD {fmt(scan.off_md)} · crossing{" "}
            {fmt(scan.crossing_angle_deg)}°
          </p>
          <p>
            ΔNEV (offset − reference) N {fmt(scan.d_north)} E {fmt(scan.d_east)} TVD {fmt(scan.d_tvd)}
          </p>
          <p>
            {scan.above_threshold == null
              ? "No threshold comparison."
              : scan.above_threshold
                ? "above configured centerline threshold"
                : "below configured centerline threshold"}
          </p>
          <p className="muted">{scan.label}</p>
        </div>
      )}
    </div>
  );
}
