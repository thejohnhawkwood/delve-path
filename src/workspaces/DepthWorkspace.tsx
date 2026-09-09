import { useState } from "react";
import { engineCall, parseEngineError } from "../engine";
import { fmt, lengthLabel, type Trajectory, type UnitSystem } from "../domain";
import { depthReportModel, openReport } from "../reportModel";

export function DepthWorkspace({ unit, traj }: { unit: UnitSystem; traj: Trajectory | null }) {
  const [rkb, setRkb] = useState("32");
  const [rt, setRt] = useState("30");
  const [gl, setGl] = useState("0");
  const [md, setMd] = useState("2400");
  const [tvd, setTvd] = useState("2385");
  const [mdShift, setMdShift] = useState("2");
  const [src1, setSrc1] = useState("1000");
  const [dst1, setDst1] = useState("1002");
  const [src2, setSrc2] = useState("2000");
  const [dst2, setDst2] = useState("2005");
  const [out, setOut] = useState("");
  const [ties, setTies] = useState<string[][]>([]);
  const [err, setErr] = useState("");
  const len = lengthLabel(unit);

  function datum(id: string, name: string, kind: string, elevation: number) {
    return {
      id,
      name,
      kind,
      elevation,
      elevation_unit: unit,
      positive_direction: "up",
      permanent_vertical_datum: "MSL",
      source: "user",
      date: "2026-08-28",
      notes: "",
    };
  }

  async function convert() {
    setErr("");
    try {
      const source = datum("rkb", "RKB", "rkb", Number(rkb));
      const target = datum("rt", "RT", "rt", Number(rt));
      const msl = datum("msl", "MSL", "msl", 0);
      const tvdRt = await engineCall<number>("translate_depth", { depth: Number(tvd), source, target, unit });
      const tvdMsl = await engineCall<number>("translate_depth", { depth: Number(tvd), source, target: msl, unit });
      const mdRt = await engineCall<number>("convert_md", {
        md: Number(md),
        source,
        target,
        unit,
        shift: {
          source_id: "rkb",
          target_id: "rt",
          shift: Number(mdShift),
          unit,
          path_meaning: "additive MD origin shift source→target",
          provenance: "user",
          notes: "not an elevation difference",
          colocated_vertical: false,
        },
      });
      const map = {
        id: "wl-1",
        kind: "affine_two_point",
        ties: [
          { source_depth: Number(src1), dest_depth: Number(dst1) },
          { source_depth: Number(src2), dest_depth: Number(dst2) },
        ],
        allow_extrapolation: false,
        one_way: false,
        source: "user",
        notes: "wireline mapping, not a datum shift",
      };
      const wl = await engineCall<{ output: number; scale: number; offset: number; residual: number; audit: string }>(
        "apply_wireline",
        { map, source: Number(md), reverse: false }
      );
      let mdTvd = "";
      if (traj) {
        const cands = await engineCall<number[]>("md_for_tvd", { traj, tvd: Number(tvd) });
        mdTvd =
          cands.length === 0
            ? "No MD for that TVD."
            : cands.length === 1
              ? `MD↔TVD via trajectory: TVD ${tvd} → MD ${fmt(cands[0])} ${len}`
              : `Multiple MDs for TVD ${tvd}: ${cands.map((c) => fmt(c)).join(", ")}. Select one.`;
      }
      setTies([
        [fmt(Number(src1)), fmt(Number(dst1)), "tie 1"],
        [fmt(Number(src2)), fmt(Number(dst2)), "tie 2"],
      ]);
      setOut(
        `Original TVD ${fmt(Number(tvd))} ${len} at RKB → TVDRT ${fmt(tvdRt)} ${len} → TVD MSL (positive down) ${fmt(tvdMsl)} ${len}. Elevation MSL (positive up) of RKB is ${fmt(Number(rkb))} ${len}. MDRKB ${fmt(Number(md))} → MDRT ${fmt(mdRt)} using explicit mdOriginShift ${mdShift} ${len} (not E_RT−E_RKB). Wireline affine: ${wl.audit} (scale ${fmt(wl.scale, 4)}, offset ${fmt(wl.offset)}). ${mdTvd} Ground ${fmt(Number(gl))} ${len} vs MSL.`
      );
    } catch (e) {
      setErr(parseEngineError(e));
    }
  }

  return (
    <div className="workspace-panel">
      <h2>Depth Reference & Zone Integrity</h2>
      <p className="muted">
        Depth is a typed coordinate. Elevations are normalized positive-up before any shift. MD origin conversion requires an
        explicit additive shift unless the references are colocated and vertical. Wireline depth is a mapping, not automatically
        a datum shift.
      </p>
      <div className="ws-row">
        <label>
          RKB elev {len}
          <input value={rkb} onChange={(e) => setRkb(e.target.value)} />
        </label>
        <label>
          RT elev {len}
          <input value={rt} onChange={(e) => setRt(e.target.value)} />
        </label>
        <label>
          GL elev {len}
          <input value={gl} onChange={(e) => setGl(e.target.value)} />
        </label>
        <label>
          Source MD {len}
          <input value={md} onChange={(e) => setMd(e.target.value)} />
        </label>
        <label>
          Source TVD {len}
          <input value={tvd} onChange={(e) => setTvd(e.target.value)} />
        </label>
        <label>
          MD origin shift {len}
          <input value={mdShift} onChange={(e) => setMdShift(e.target.value)} />
        </label>
      </div>
      <div className="ws-row">
        <label>
          Wireline src1
          <input value={src1} onChange={(e) => setSrc1(e.target.value)} />
        </label>
        <label>
          dest1
          <input value={dst1} onChange={(e) => setDst1(e.target.value)} />
        </label>
        <label>
          src2
          <input value={src2} onChange={(e) => setSrc2(e.target.value)} />
        </label>
        <label>
          dest2
          <input value={dst2} onChange={(e) => setDst2(e.target.value)} />
        </label>
        <button type="button" onClick={() => void convert()}>
          Audit convert
        </button>
        <button
          type="button"
          onClick={() =>
            openReport(
              depthReportModel({
                datums: [
                  ["RKB", "rkb", rkb, "MSL"],
                  ["RT", "rt", rt, "MSL"],
                  ["GL", "gl", gl, "MSL"],
                  ["MSL", "msl", "0", "MSL"],
                ],
                ties,
                markers: [["Pay", `TVD ${tvd} RKB`, out || "run audit"]],
              })
            )
          }
        >
          Report
        </button>
      </div>
      {err && <div className="error">{err}</div>}
      {out && (
        <div className="ws-summary">
          <p>
            <b>Audit:</b> Original value → source datum/scale → applied transform(s) → reported value.
          </p>
          <p>{out}</p>
        </div>
      )}
    </div>
  );
}
