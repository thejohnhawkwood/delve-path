import { useMemo, useState } from "react";
import { engineCall, parseEngineError } from "../engine";
import { fmt, lengthLabel, type UnitSystem } from "../domain";
import type { ExtraPath } from "../Charts";

type Profile = "slant" | "swell" | "horizontal" | "curve_hold" | "manual";

interface PlanStation {
  md: number;
  inc_deg: number;
  azi_deg: number;
  north: number;
  east: number;
  tvd: number;
  dls_display: number;
}

interface PlanSolveResult {
  status: string;
  stations: PlanStation[];
  residuals: number[];
  issues: { severity: string; code: string; message: string }[];
  max_dls: number;
  total_md: number;
  miss_n: number;
  miss_e: number;
  miss_tvd: number;
  active_constraints: string[];
}

export function PlanningWorkspace({
  unit,
  vspDeg,
  onPlanStations,
  onDocuments,
}: {
  unit: UnitSystem;
  vspDeg: number;
  onPlanStations: (stations: PlanStation[], name: string, paths: ExtraPath[]) => void;
  onDocuments: (docs: { kind: string; payload: unknown }[]) => void;
}) {
  const [profile, setProfile] = useState<Profile>("slant");
  const [kop, setKop] = useState("650");
  const [dls, setDls] = useState("3");
  const [hold, setHold] = useState("");
  const [solve, setSolve] = useState("hold_angle");
  const [tvd, setTvd] = useState("4500");
  const [disp, setDisp] = useState("1000");
  const [azi, setAzi] = useState("45");
  const [dls2, setDls2] = useState("1.5");
  const [entry, setEntry] = useState("7");
  const [tf, setTf] = useState("0");
  const [holdMd, setHoldMd] = useState("200");
  const [result, setResult] = useState<PlanSolveResult | null>(null);
  const [err, setErr] = useState("");
  const len = lengthLabel(unit);

  const methodNote = useMemo(() => {
    if (profile === "slant")
      return "2-D J / slant: constant-DLS build then hold to target center. Independently derived; WinSERVE examples are regression oracles only.";
    if (profile === "swell") return "2-D S: build, tangent, drop. DLS1/DLS2 independently editable.";
    if (profile === "horizontal") return "2-D horizontal / double-build landing. Reports when no tangent exists.";
    if (profile === "curve_hold")
      return "3-D curve + hold. Constant gravity TF and fixed-initial-dogleg-plane are distinct methods.";
    return "Manual section composition: hold, then DLS/toolface. Entered/locked values stay locked; solved values are labelled.";
  }, [profile]);

  function vs(n: number, e: number) {
    const th = (vspDeg * Math.PI) / 180;
    return n * Math.cos(th) + e * Math.sin(th);
  }

  async function solvePlan() {
    setErr("");
    try {
      const dlsRef = unit === "imperial" ? "per100_ft" : "per30_m";
      let out: PlanSolveResult;
      if (profile === "slant") {
        out = await engineCall<PlanSolveResult>("solve_slant", {
          unit,
          target_tvd: Number(tvd),
          target_disp: Number(disp),
          target_azi_deg: Number(azi),
          kop: kop === "" ? null : Number(kop),
          dls_display: dls === "" ? null : Number(dls),
          dls_ref: dlsRef,
          hold_inc_deg: hold === "" ? null : Number(hold),
          solve,
        });
      } else if (profile === "swell") {
        out = await engineCall<PlanSolveResult>("solve_swell", {
          unit,
          target_tvd: Number(tvd),
          target_disp: Number(disp),
          target_azi_deg: Number(azi),
          kop: kop === "" ? null : Number(kop),
          dls1: dls === "" ? null : Number(dls),
          dls2: dls2 === "" ? null : Number(dls2),
          dls_ref: dlsRef,
          lock_equal_dls: false,
          entry_inc_deg: Number(entry),
          hold_inc_deg: hold === "" ? null : Number(hold),
          tangent_length: null,
          solve,
        });
      } else if (profile === "horizontal") {
        out = await engineCall<PlanSolveResult>("solve_horizontal", {
          unit,
          kop: Number(kop || 0),
          land_inc_deg: Number(hold || 90),
          land_azi_deg: Number(azi),
          land_tvd: Number(tvd),
          land_north: Number(disp) * Math.cos((Number(azi) * Math.PI) / 180),
          land_east: Number(disp) * Math.sin((Number(azi) * Math.PI) / 180),
          dls1: Number(dls || 3),
          dls2: Number(dls2 || 3),
          dls_ref: dlsRef,
          hold_inc_between: null,
        });
      } else if (profile === "curve_hold") {
        out = await engineCall<PlanSolveResult>("solve_curve_hold", {
          start: { md: 0, inc_deg: 0, azi_deg: Number(azi), north: 0, east: 0, tvd: 0 },
          unit,
          target_north: Number(disp) * Math.cos((Number(azi) * Math.PI) / 180),
          target_east: Number(disp) * Math.sin((Number(azi) * Math.PI) / 180),
          target_tvd: Number(tvd),
          dls_display: dls === "" ? null : Number(dls),
          dls_ref: dlsRef,
          toolface_deg: tf === "" ? null : Number(tf),
          hold_inc_deg: hold === "" ? null : Number(hold),
          curve_length: null,
          hold_length: null,
          method: "constant_gravity_toolface",
          dogleg_plane_azi_deg: null,
          solve,
        });
      } else {
        const start = { md: 0, inc_deg: 0, azi_deg: Number(azi), north: 0, east: 0, tvd: 0 };
        const held = await engineCall<{ points: PlanStation[] }>("project_hold", {
          start,
          added_md: Number(holdMd || 200),
          unit,
          class: "planned",
        });
        const last = held.points.slice(-1)[0] ?? start;
        const nearVertical = Math.abs(last.inc_deg) <= 3 || Math.abs(last.inc_deg - 180) <= 3;
        const curve = nearVertical
          ? await engineCall<{ points: PlanStation[] }>("project_fixed_plane", {
              start: last,
              added_md: Number(kop || 400),
              dls_display: Number(dls || 3),
              dls_ref: dlsRef,
              toolface_deg: Number(tf || 0),
              dogleg_plane_azi_deg: Number(azi),
              unit,
              singular_inc_deg: 3,
              class: "planned",
            })
          : await engineCall<{ points: PlanStation[] }>("project_gravity_tf", {
              start: last,
              added_md: Number(kop || 400),
              dls_display: Number(dls || 3),
              dls_ref: dlsRef,
              toolface_deg: Number(tf || 0),
              unit,
              singular_inc_deg: 3,
              class: "planned",
            });
        const stations = [...held.points, ...curve.points];
        const end = stations.slice(-1)[0];
        out = {
          status: end ? "solved" : "infeasible",
          stations,
          residuals: [],
          issues: [],
          max_dls: stations.reduce((m, s) => Math.max(m, s.dls_display ?? 0), 0),
          total_md: end?.md ?? 0,
          miss_n: (end?.north ?? 0) - Number(disp) * Math.cos((Number(azi) * Math.PI) / 180),
          miss_e: (end?.east ?? 0) - Number(disp) * Math.sin((Number(azi) * Math.PI) / 180),
          miss_tvd: (end?.tvd ?? 0) - Number(tvd),
          active_constraints: ["manual hold + constant gravity toolface"],
        };
      }
      if (out.status.toLowerCase() === "infeasible" || out.stations.some((s) => !Number.isFinite(s.north))) {
        setResult(out);
        setErr(out.issues.map((i) => i.message).join(" ") || "Infeasible — no path plotted.");
        onPlanStations([], profile, []);
        return;
      }
      setResult(out);
      const paths: ExtraPath[] = [
        {
          name: `PLANNED ${profile} ${out.status}`,
          color: "#7ee0e0",
          dash: "dash",
          points: out.stations.map((s) => ({ north: s.north, east: s.east, tvd: s.tvd, vs: vs(s.north, s.east) })),
        },
      ];
      onPlanStations(out.stations, `${profile} ${out.status}`, paths);
      onDocuments([{ kind: "plan", payload: { profile, solve, result: out } }]);
    } catch (e) {
      setResult(null);
      setErr(parseEngineError(e));
      onPlanStations([], profile, []);
    }
  }

  return (
    <div className="workspace-panel">
      <h2>Planning</h2>
      <p className="muted">{methodNote}</p>
      <p className="muted">
        Entered/locked values stay white. Solved values and calculated stations are labelled. Infeasible solves return a typed
        status — never NaN coordinates. +UP along plan high-side · +RIGHT along plan right.
      </p>
      <div className="ws-row">
        <label>
          Profile
          <select value={profile} onChange={(e) => setProfile(e.target.value as Profile)}>
            <option value="slant">2-D J / slant</option>
            <option value="swell">2-D S</option>
            <option value="horizontal">2-D horizontal / double-build</option>
            <option value="curve_hold">3-D curve + hold</option>
            <option value="manual">Manual sections</option>
          </select>
        </label>
        <label>
          Solve
          <select value={solve} onChange={(e) => setSolve(e.target.value)}>
            <option value="hold_angle">Hold angle</option>
            <option value="dls">DLS</option>
            <option value="kop">KOP</option>
            <option value="tangent_length">Tangent length</option>
          </select>
        </label>
      </div>
      <table className="plan-table">
        <thead>
          <tr>
            <th>Seq</th>
            <th>Section</th>
            <th>End constraint</th>
            <th>ΔMD / End MD {len}</th>
            <th>End TVD {len}</th>
            <th>INC</th>
            <th>AZI</th>
            <th>DLS</th>
            <th>TF</th>
            <th>Solve/Lock</th>
            <th>Residual / Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>{profile}</td>
            <td>Target center</td>
            <td>
              <input
                value={profile === "manual" ? holdMd : kop}
                onChange={(e) => (profile === "manual" ? setHoldMd(e.target.value) : setKop(e.target.value))}
                aria-label="KOP or hold MD"
              />
            </td>
            <td>
              <input value={tvd} onChange={(e) => setTvd(e.target.value)} aria-label="Target TVD" />
            </td>
            <td>
              <input value={hold} onChange={(e) => setHold(e.target.value)} aria-label="Hold INC" />
            </td>
            <td>
              <input value={azi} onChange={(e) => setAzi(e.target.value)} aria-label="AZI" />
            </td>
            <td>
              <input value={dls} onChange={(e) => setDls(e.target.value)} aria-label="DLS" />
            </td>
            <td>
              <input value={tf} onChange={(e) => setTf(e.target.value)} aria-label="Toolface" />
            </td>
            <td>{solve}</td>
            <td>{result?.status ?? "—"}</td>
          </tr>
          <tr>
            <td>2</td>
            <td>{profile === "swell" || profile === "horizontal" ? "DLS2 / entry" : "Target displacement"}</td>
            <td>—</td>
            <td>
              <input value={disp} onChange={(e) => setDisp(e.target.value)} aria-label="Displacement" />
            </td>
            <td />
            <td>
              <input value={entry} onChange={(e) => setEntry(e.target.value)} aria-label="Entry INC" />
            </td>
            <td />
            <td>
              <input value={dls2} onChange={(e) => setDls2(e.target.value)} aria-label="DLS2" />
            </td>
            <td />
            <td>locked</td>
            <td />
          </tr>
        </tbody>
      </table>
      <div className="ws-row">
        <button type="button" className="primary" onClick={() => void solvePlan()}>
          Recompute plan
        </button>
        <span className="muted">Tab / Enter edit the table. Downstream stations recompute from the engine.</span>
      </div>
      {err && <div className="error">{err}</div>}
      {result && (
        <div className="ws-summary">
          <p>
            Status <b>{result.status}</b> · max DLS {fmt(result.max_dls)} · total MD {fmt(result.total_md)} {len} · miss
            N/E/TVD {fmt(result.miss_n)} / {fmt(result.miss_e)} / {fmt(result.miss_tvd)}
          </p>
          {result.issues.map((i, n) => (
            <div key={n} className={i.severity}>
              [{i.severity}] {i.message}
            </div>
          ))}
          {result.stations.length > 0 && (
            <table className="plan-table">
              <thead>
                <tr>
                  <th>MD</th>
                  <th>INC</th>
                  <th>AZI</th>
                  <th>+N</th>
                  <th>+E</th>
                  <th>TVD</th>
                  <th>DLS</th>
                </tr>
              </thead>
              <tbody>
                {result.stations.map((s, i) => (
                  <tr key={`${s.md}-${i}`}>
                    <td>{fmt(s.md)}</td>
                    <td>{fmt(s.inc_deg)}</td>
                    <td>{fmt(s.azi_deg)}</td>
                    <td>{fmt(s.north)}</td>
                    <td>{fmt(s.east)}</td>
                    <td>{fmt(s.tvd)}</td>
                    <td>{fmt(s.dls_display)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
