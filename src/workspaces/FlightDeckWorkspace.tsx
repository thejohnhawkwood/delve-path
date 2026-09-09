import { useMemo, useState } from "react";
import { engineCall, parseEngineError } from "../engine";
import { fmt, lengthLabel, type ReviewState, type UnitSystem } from "../domain";
import { openReport, shiftCardModel } from "../reportModel";
import type { ExtraPath } from "../Charts";

interface DemoSurvey {
  md: number;
  inc_deg: number;
  azi_deg: number;
  accepted: boolean;
}

interface Attitude {
  md: number;
  inc_deg: number;
  azi_deg: number;
  north: number;
  east: number;
  tvd: number;
}

interface PathPoint extends Attitude {
  dls_display?: number;
}

interface ScenarioInput {
  id: string;
  name: string;
  method: string;
  added_md: number;
  dls_display?: number | null;
  toolface_deg?: number | null;
  slide_yield?: number | null;
  segments: {
    mode: string;
    length: number;
    toolface_deg: number;
    slide_yield_dls: number;
    rotary_dls: number;
    rotary_tf_deg: number;
    dls_ref: string;
  }[];
}

interface ScenarioCard {
  input: ScenarioInput;
  future_bit_md: number;
  next_sensor_md: number;
  future_bit: PathPoint;
  next_sensor: PathPoint;
  path: PathPoint[];
  ud?: number | null;
  lr?: number | null;
  max_dls: number;
  avg_dls: number;
  slide_footage: number;
  constraint_feasible: boolean;
  violations: string[];
  assumptions: string[];
}

interface Demo {
  name: string;
  mark: string;
  surveys: DemoSurvey[];
  held_out: DemoSurvey;
  last_accepted: Attitude;
  bha: {
    name: string;
    configuration_revision: number;
    sensor_to_bit: number;
    slide_yield_nom: number;
    slide_yield_low: number;
    slide_yield_high: number;
  };
  memory: {
    qualified_count: number;
    median_slide_yield?: number | null;
    sample_ids: string[];
    samples: { id: string; included: boolean; reason: string }[];
  };
  segments: {
    id: string;
    start_bit_md: number;
    end_bit_md: number;
    mode: string;
    started_at?: string;
    ended_at?: string;
  }[];
  constraints: {
    stand_length: number;
    max_slide_per_stand: number;
    min_useful_slide: number;
    max_dls: number;
    max_yield: number;
  };
  corridor: { up_down: number; left_right: number };
  scenarios: ScenarioInput[];
  plan: {
    stations: { md: number; inc_deg: number; azi_deg: number; north: number; east: number; tvd: number }[];
    status: string;
  };
}

const SCENARIO_COLORS = ["#c9a227", "#7ee0e0", "#d08a4a", "#b48ec8", "#8ec8a0"];

export function FlightDeckWorkspace({
  unit,
  latestAccepted,
  holeId,
  vspDeg,
  onDemoLoaded,
  onPaths,
  onDocuments,
}: {
  unit: UnitSystem;
  latestAccepted: ReviewState | undefined;
  holeId: string;
  vspDeg: number;
  onDemoLoaded: (demo: Demo) => void;
  onPaths: (paths: ExtraPath[]) => void;
  onDocuments: (docs: { kind: string; payload: unknown }[]) => void;
}) {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [cards, setCards] = useState<ScenarioCard[]>([]);
  const [estimate, setEstimate] = useState<{
    derived_bit_md: number;
    next_expected_sensor_md: number;
    bit: Attitude;
    path: PathPoint[];
  } | null>(null);
  const [footage, setFootage] = useState<{ slide: number; rotate: number; slide_pct: number; elapsed_hours: number | null } | null>(
    null
  );
  const [slideLen, setSlideLen] = useState("28");
  const [tf, setTf] = useState("270");
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<
    { name: string; miss_3d: number; inc_residual_deg: number; azi_residual_deg: number; md_difference: number }[]
  >([]);
  const [err, setErr] = useState("");
  const [memoryAfter, setMemoryAfter] = useState<number | null>(null);
  const [help, setHelp] = useState("");
  const len = lengthLabel(unit);

  const accepted = useMemo(() => demo?.surveys.filter((s) => s.accepted).slice(-1)[0], [demo]);

  function vs(n: number, e: number) {
    const th = (vspDeg * Math.PI) / 180;
    return n * Math.cos(th) + e * Math.sin(th);
  }

  function asPath(name: string, color: string, dash: ExtraPath["dash"], pts: PathPoint[]): ExtraPath {
    return {
      name,
      color,
      dash,
      points: pts.map((q) => ({ north: q.north, east: q.east, tvd: q.tvd, vs: vs(q.north, q.east) })),
    };
  }

  async function loadDemo() {
    setErr("");
    setRevealed(false);
    setScores([]);
    setMemoryAfter(null);
    try {
      const d = await engineCall<Demo>("curve_recovery_demo");
      setDemo(d);
      onDemoLoaded(d);
      try {
        const note = await engineCall<{ assumptions: string[]; applicability: string[] }>("method_help", {
          method: "slide_rotate_segments",
        });
        setHelp(`${note.assumptions.join(" ")} ${note.applicability.join(" ")}`);
      } catch {
        setHelp("Ordered slide/rotate uses user-entered slide yield and rotary tendency.");
      }
      await evaluate(d, Number(slideLen), Number(tf));
    } catch (e) {
      setErr(parseEngineError(e));
    }
  }

  async function evaluate(d: Demo, slide: number, toolface: number) {
    const sensor = d.last_accepted;
    const est = await engineCall<{
      derived_bit_md: number;
      next_expected_sensor_md: number;
      bit: Attitude;
      path: PathPoint[];
    }>("flight_estimate", {
      sensor,
      bha: d.bha,
      segments: d.segments,
      unit,
    });
    setEstimate(est);
    const ft = await engineCall<{ slide: number; rotate: number; slide_pct: number; elapsed_hours: number | null }>(
      "shift_card_footage",
      { segments: d.segments }
    );
    setFootage(ft);
    const planEnd = d.plan.stations.slice(-1)[0];
    const extras: ScenarioInput[] = [
      {
        id: "nominal",
        name: "Original nominal yield",
        method: "slide_rotate",
        added_md: 93,
        slide_yield: d.bha.slide_yield_nom,
        segments: [
          {
            mode: "slide",
            length: slide,
            toolface_deg: toolface,
            slide_yield_dls: d.bha.slide_yield_nom,
            rotary_dls: 0.3,
            rotary_tf_deg: 90,
            dls_ref: "per100_ft",
          },
          {
            mode: "rotate",
            length: 93 - slide,
            toolface_deg: 0,
            slide_yield_dls: d.bha.slide_yield_nom,
            rotary_dls: 0.3,
            rotary_tf_deg: 90,
            dls_ref: "per100_ft",
          },
        ],
      },
      {
        id: "memory",
        name: "BHA Memory median (frozen)",
        method: "slide_rotate",
        added_md: 93,
        slide_yield: d.memory.median_slide_yield ?? d.bha.slide_yield_nom,
        segments: [
          {
            mode: "slide",
            length: slide,
            toolface_deg: toolface,
            slide_yield_dls: d.memory.median_slide_yield ?? d.bha.slide_yield_nom,
            rotary_dls: 0.3,
            rotary_tf_deg: 90,
            dls_ref: "per100_ft",
          },
          {
            mode: "rotate",
            length: 93 - slide,
            toolface_deg: 0,
            slide_yield_dls: d.memory.median_slide_yield ?? d.bha.slide_yield_nom,
            rotary_dls: 0.3,
            rotary_tf_deg: 90,
            dls_ref: "per100_ft",
          },
        ],
      },
    ];
    const scenarios = [
      ...d.scenarios.map((s) => {
        if (s.id !== "short") return s;
        return {
          ...s,
          segments: s.segments.map((seg, i) =>
            i === 0 ? { ...seg, length: slide, toolface_deg: toolface, slide_yield_dls: s.slide_yield ?? 10 } : seg
          ),
        };
      }),
      ...extras,
    ];
    const next: ScenarioCard[] = [];
    for (const input of scenarios) {
      const card = await engineCall<ScenarioCard>("flight_scenario", {
        start_bit: est.bit,
        bha: d.bha,
        input,
        plan: planEnd,
        corridor: d.corridor,
        constraints: d.constraints,
        unit,
      });
      next.push(card);
    }
    setCards(next);

    const envelopeInputs = [
      { name: "BHA response low", yield: d.bha.slide_yield_low, color: "#8a6d1b" },
      { name: "BHA response nominal", yield: d.bha.slide_yield_nom, color: "#c9a227" },
      { name: "BHA response high", yield: d.bha.slide_yield_high, color: "#e0c36a" },
    ];
    const envelope: ExtraPath[] = [];
    for (const e of envelopeInputs) {
      const card = await engineCall<ScenarioCard>("flight_scenario", {
        start_bit: est.bit,
        bha: d.bha,
        input: { ...extras[0], id: e.name, name: e.name, slide_yield: e.yield, segments: extras[0].segments.map((s) => ({ ...s, slide_yield_dls: e.yield })) },
        plan: planEnd,
        corridor: d.corridor,
        constraints: d.constraints,
        unit,
      });
      envelope.push(asPath(`${e.name} — BHA response envelope, not positional uncertainty`, e.color, "dot", card.path));
    }

    onPaths([
      asPath("PLANNED rev 1", "#7ee0e0", "dash", d.plan.stations),
      asPath("ESTIMATED bit interval", "#d08a4a", "dash", [sensor, ...est.path]),
      ...next.map((c, i) => asPath(`SCENARIO ${c.input.name}`, SCENARIO_COLORS[i % SCENARIO_COLORS.length], "dash", c.path)),
      ...envelope,
    ]);
    onDocuments([
      { kind: "plan", payload: d.plan },
      { kind: "bha", payload: d.bha },
      { kind: "segment", payload: d.segments },
      { kind: "decision", payload: { name: d.name, mark: d.mark, frozen: false } },
    ]);
  }

  async function reveal() {
    if (!demo || !estimate) return;
    setErr("");
    const frozen = cards.map((c) => ({
      name: c.input.name,
      pred: {
        md: c.next_sensor_md,
        inc_deg: c.next_sensor.inc_deg,
        azi_deg: c.next_sensor.azi_deg,
        north: c.next_sensor.north,
        east: c.next_sensor.east,
        tvd: c.next_sensor.tvd,
      },
    }));
    const decision = {
      id: "demo-decision",
      hole_id: holeId || "demo-hole",
      accepted_survey_md: demo.last_accepted.md,
      estimated_bit_md: estimate.derived_bit_md,
      plan_revision: 1,
      bha_id: "demo-bha",
      bha_revision: demo.bha.configuration_revision,
      target_id: null,
      offset_hole_id: null,
      assumptions: ["SYNTHETIC / constructed"],
      constraints: demo.constraints,
      scenarios: demo.scenarios,
      selected_scenario_id: "short",
      memory_revision: demo.memory.qualified_count,
      memory_sample_ids: demo.memory.sample_ids,
      expected_survey_md: estimate.next_expected_sensor_md,
      actual_resolution_md: demo.held_out.md,
      scores: [],
      created_at: "2026-08-28T12:00:00Z",
      resolved_at: null,
    };
    const hold = cards.find((c) => c.input.id === "hold");
    const actual = {
      md: demo.held_out.md,
      inc_deg: demo.held_out.inc_deg,
      azi_deg: demo.held_out.azi_deg,
      north: (hold?.future_bit.north ?? demo.last_accepted.north) + 12,
      east: (hold?.future_bit.east ?? demo.last_accepted.east) - 8,
      tvd: (hold?.future_bit.tvd ?? demo.last_accepted.tvd) + 1,
    };
    const sc = await engineCall<typeof scores>("flight_score", {
      decision,
      actual_md: demo.held_out.md,
      actual,
      frozen,
    });
    setScores(sc);
    setRevealed(true);
    setMemoryAfter(demo.memory.qualified_count + 1);
    onDocuments([{ kind: "decision", payload: { ...decision, scores: sc, resolved_at: "2026-08-28T12:01:00Z" } }]);
  }

  function printShift() {
    if (!demo || !estimate) return;
    openReport(
      shiftCardModel({
        accepted: accepted
          ? `MD ${fmt(accepted.md)} INC ${fmt(accepted.inc_deg)} AZI ${fmt(accepted.azi_deg)} accepted`
          : "none",
        estimatedBit: `MD ${fmt(estimate.derived_bit_md)} N ${fmt(estimate.bit.north)} E ${fmt(estimate.bit.east)} TVD ${fmt(estimate.bit.tvd)}`,
        startBitMd: String(demo.segments[0]?.start_bit_md ?? ""),
        endBitMd: String(demo.segments.slice(-1)[0]?.end_bit_md ?? ""),
        drilled: String((demo.segments.slice(-1)[0]?.end_bit_md ?? 0) - (demo.segments[0]?.start_bit_md ?? 0)),
        slide: footage ? fmt(footage.slide) : "—",
        rotate: footage ? fmt(footage.rotate) : "—",
        slidePct: footage ? fmt(footage.slide_pct) : "—",
        hours: footage?.elapsed_hours == null ? "timestamps incomplete" : fmt(footage.elapsed_hours),
        selected: cards.find((c) => c.input.id === "short")?.input.name ?? "—",
        alternatives: cards.map((c) => c.input.name).join("; "),
        offsets: cards.map((c) => `${c.input.name} UD ${c.ud ?? "—"} LR ${c.lr ?? "—"}`).join("; "),
        bha: `${demo.bha.name} rev ${demo.bha.configuration_revision} sensor-to-bit ${demo.bha.sensor_to_bit} ${len}`,
        memory: `qualified n=${demo.memory.qualified_count} median ${demo.memory.median_slide_yield ?? "n/a"}`,
        scores: scores.map((s) => [s.name, fmt(s.miss_3d), fmt(s.inc_residual_deg), fmt(s.azi_residual_deg), fmt(s.md_difference)]),
        warnings: latestAccepted === "accepted" ? [] : ["Flight Deck anchors require an explicitly accepted station."],
        planRev: "1",
        timestamp: "2026-08-28T12:00:00Z",
      })
    );
  }

  return (
    <div className="workspace-panel">
      <h2>Next-Stand Flight Deck + BHA Memory</h2>
      <p className="muted">
        Separate ACCEPTED SURVEY, ESTIMATED bit, and SCENARIO paths. {demo?.mark ?? "SYNTHETIC / constructed"} when the Curve
        Recovery demo is loaded. Gravity TF 0/90/180/270 = build / right / drop / left. Sensor MD and bit MD are never conflated.
      </p>
      <div className="ws-row">
        <button type="button" className="primary" onClick={() => void loadDemo()}>
          Load Curve Recovery demo
        </button>
        <button type="button" disabled={!demo} onClick={() => void reveal()}>
          Reveal held-out synthetic survey
        </button>
        <button type="button" disabled={!demo} onClick={printShift}>
          Shift Card preview
        </button>
      </div>
      {help && <p className="muted">{help}</p>}
      {err && <div className="error">{err}</div>}
      {estimate && accepted && (
        <div className="ws-summary timed">
          <p>
            <b>0–15 s</b> ACCEPTED SURVEY sensor MD {fmt(accepted.md)} {len} · ESTIMATED bit MD {fmt(estimate.derived_bit_md)}{" "}
            {len} · next expected sensor MD {fmt(estimate.next_expected_sensor_md)} {len}
          </p>
        </div>
      )}
      {demo && (
        <div className="ws-row">
          <label>
            Short-correction slide {len}
            <input
              value={slideLen}
              onChange={(e) => {
                setSlideLen(e.target.value);
                void evaluate(demo, Number(e.target.value), Number(tf));
              }}
            />
          </label>
          <label>
            Toolface °
            <input
              value={tf}
              onChange={(e) => {
                setTf(e.target.value);
                void evaluate(demo, Number(slideLen), Number(e.target.value));
              }}
            />
          </label>
          <span className="muted">40–60 s: edits update Plan / Profile / 3-D and cards immediately.</span>
        </div>
      )}
      <div className="scenario-cards">
        {cards.map((c) => (
          <article key={c.input.id} className="scenario-card">
            <h3>{c.input.name}</h3>
            <p>Future bit MD {fmt(c.future_bit_md)} · next sensor MD {fmt(c.next_sensor_md)}</p>
            <p>
              Predicted survey INC/AZI {fmt(c.next_sensor.inc_deg)} / {fmt(c.next_sensor.azi_deg)}
            </p>
            <p>
              UD {c.ud == null ? "—" : fmt(c.ud)} · LR {c.lr == null ? "—" : fmt(c.lr)} · max DLS {fmt(c.max_dls)} · avg DLS{" "}
              {fmt(c.avg_dls)} · slide {fmt(c.slide_footage)} {len}
            </p>
            <p>
              {c.constraint_feasible
                ? "constraint-feasible under entered assumptions"
                : `violations: ${c.violations.join("; ")}`}
            </p>
            <p className="muted">{c.assumptions.join(" ")}</p>
          </article>
        ))}
      </div>
      {demo && (
        <details>
          <summary>BHA Memory samples (never pooled across revisions)</summary>
          <table className="plan-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Included</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {demo.memory.samples.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.included ? "included" : "excluded"}</td>
                  <td>{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {revealed && (
        <div className="ws-summary">
          <p>
            <b>60–90 s</b> Held-out MD {demo?.held_out.md}. Scores use the actual survey MD. Forecasts stayed frozen.
            BHA Memory n → n+1: {demo?.memory.qualified_count} → {memoryAfter}.
          </p>
          <table className="plan-table">
            <thead>
              <tr>
                <th>Forecast</th>
                <th>3-D miss</th>
                <th>ΔINC</th>
                <th>ΔAZI</th>
                <th>ΔMD</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{fmt(s.miss_3d)}</td>
                  <td>{fmt(s.inc_residual_deg)}</td>
                  <td>{fmt(s.azi_residual_deg)}</td>
                  <td>{fmt(s.md_difference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
