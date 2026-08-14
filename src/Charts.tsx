import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import { PARENT_HOLE_COLOR } from "./colors";
import type { CalculatedStation, Target } from "./domain";

type Tab = "plan" | "profile" | "3d" | "target";

export interface HoleOverlay {
  id: string;
  name: string;
  parent_hole_id: string | null;
  stations: CalculatedStation[];
  color: string;
}

interface Props {
  tab: Tab;
  stations: CalculatedStation[];
  overlays: HoleOverlay[];
  selected: number;
  targets: Target[];
  vspDeg: number;
  currentHoleId: string | null;
  onPickStation: (holeId: string, index: number) => void;
}

const plotCfg = { displayModeBar: false, responsive: true, staticPlot: false };

type PickPoint = { holeId: string; stationIndex: number };

export function Charts({
  tab,
  stations,
  overlays,
  selected,
  targets,
  vspDeg,
  currentHoleId,
  onPickStation,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const lastTab = useRef<Tab | null>(null);
  const plotSeq = useRef(0);
  const plotTail = useRef(Promise.resolve());
  const pickRef = useRef(onPickStation);
  pickRef.current = onPickStation;

  const paths = pathsForPlot(overlays, stations, currentHoleId);
  const projected = stations.filter((s) => s.class !== "measured");
  const sel = stations[selected];
  const hasKick = paths.some((h) => h.parent_hole_id && h.stations.some((s) => s.class === "measured"));
  const hasJunction = targets.some((t) => isJunctionTarget(t, targets));
  const hasTarget = targets.some((t) => !isJunctionTarget(t, targets));

  const legendItems: { color: string; label: string }[] = [
    ...paths.map((h) => ({ color: h.color, label: h.name })),
    ...(projected.length ? [{ color: "#c9a227", label: "PROJECTED" }] : []),
    ...(hasKick ? [{ color: "#e0c36a", label: "Kick-off" }] : []),
    ...(hasJunction ? [{ color: "#e0c36a", label: "Junction" }] : []),
    ...(hasTarget ? [{ color: "#c44b3c", label: "Target" }] : []),
    ...(sel ? [{ color: "#6f8fbf", label: "Selected" }] : []),
  ];

  useEffect(() => {
    const node = el.current;
    if (!node || tab === "target") {
      if (node) Plotly.purge(node);
      lastTab.current = tab;
      return;
    }
    const seq = ++plotSeq.current;
    const plotPaths = pathsForPlot(overlays, stations, currentHoleId);
    const plotMeasured = stations.filter((s) => s.class === "measured");
    const plotProjected = stations.filter((s) => s.class !== "measured");
    const plotSel = stations[selected];

    const layoutBase = {
      paper_bgcolor: "#22252b",
      plot_bgcolor: "#1b1d21",
      font: { color: "#c8c4ba", size: 11 },
      margin: { t: 28, r: 16, b: 40, l: 52 },
      showlegend: false,
      autosize: true,
      hovermode: "closest" as const,
      hoverlabel: {
        bgcolor: "#111318",
        bordercolor: "#c9a227",
        font: { color: "#e6e4df", size: 12 },
        align: "left" as const,
      },
    };

    const click = (ev: { points?: { customdata?: PickPoint }[] }) => {
      const cd = ev.points?.[0]?.customdata;
      if (!cd?.holeId || typeof cd.stationIndex !== "number") return;
      pickRef.current(cd.holeId, cd.stationIndex);
    };

    const crossed3d = lastTab.current !== tab && (lastTab.current === "3d" || tab === "3d");
    if (crossed3d) Plotly.purge(node);
    const entering3d = tab === "3d" && lastTab.current !== "3d";
    lastTab.current = tab;

    if (tab === "plan") {
      const data = [
        ...plotPaths.flatMap((h) => holePlanTraces(h)),
        ...projPlan(plotMeasured, plotProjected),
        plotSel
          ? {
              type: "scatter",
              mode: "markers",
              x: [plotSel.east],
              y: [plotSel.north],
              name: "Selected",
              marker: { size: 10, color: "#6f8fbf" },
            }
          : {},
        ...targets.map((t) =>
          isJunctionTarget(t, targets)
            ? branchMark2d(t.east, t.north, t.name || "Junction")
            : targetMark2d(t.east, t.north, t.name || "Target")
        ),
      ];
      enqueuePlot(seq, () =>
        Plotly.react(
          node,
          data.filter((d) => d && "type" in d),
          {
            ...layoutBase,
            title: { text: "Plan  +N up  +E right", font: { size: 12 } },
            xaxis: { title: "East", zeroline: true, scaleanchor: "y", scaleratio: 1 },
            yaxis: { title: "North", zeroline: true },
            annotations: [{ x: 0, y: 0, text: "N↑", showarrow: false, xanchor: "left" }],
          },
          plotCfg
        ).then(() => bindPlotEvents(node, seq, plotSeq.current, click))
      );
    }

    if (tab === "profile") {
      const data = [
        ...plotPaths.flatMap((h) => holeProfileTraces(h)),
        ...projProfile(plotMeasured, plotProjected),
        plotSel
          ? {
              type: "scatter",
              mode: "markers",
              x: [plotSel.vs],
              y: [plotSel.tvd],
              name: "Selected",
              marker: { size: 10, color: "#6f8fbf" },
            }
          : {},
        ...targets.map((t) =>
          isJunctionTarget(t, targets)
            ? branchMark2d(targetVs(t, vspDeg), t.tvd, t.name || "Junction")
            : targetMark2d(targetVs(t, vspDeg), t.tvd, t.name || "Target")
        ),
      ];
      enqueuePlot(seq, () =>
        Plotly.react(
          node,
          data.filter((d) => d && "type" in d),
          {
            ...layoutBase,
            title: { text: "Profile  VS vs TVD (TVD down — view only)", font: { size: 12 } },
            xaxis: { title: "Vertical section" },
            yaxis: { title: "TVD", autorange: "reversed" },
          },
          plotCfg
        ).then(() => bindPlotEvents(node, seq, plotSeq.current, click))
      );
    }

    if (tab === "3d") {
      const data = [
        ...plotPaths.flatMap((h) => hole3dTraces(h)),
        ...proj3d(plotMeasured, plotProjected),
        plotSel
          ? {
              type: "scatter3d",
              mode: "markers",
              x: [plotSel.east],
              y: [plotSel.north],
              z: [plotSel.tvd],
              name: "Selected",
              marker: { size: 6, color: "#6f8fbf" },
            }
          : {},
        ...targets.map((t) => targetMark3d(t, isJunctionTarget(t, targets))),
      ].filter(isScatter3d);
      const aspect = sceneAspect(plotPaths, targets, plotSel);
      const layout3d = {
        ...layoutBase,
        title: { text: "3-D  +N / +E / TVD down", font: { size: 12 } },
        scene: {
          domain: { x: [0, 1], y: [0, 1] },
          xaxis: { title: "East", backgroundcolor: "#1b1d21", gridcolor: "#3a3e46" },
          yaxis: { title: "North", backgroundcolor: "#1b1d21", gridcolor: "#3a3e46" },
          zaxis: { title: "TVD", autorange: "reversed", backgroundcolor: "#1b1d21", gridcolor: "#3a3e46" },
          aspectmode: "manual" as const,
          aspectratio: aspect,
          bgcolor: "#1b1d21",
        },
      };
      const draw = entering3d ? Plotly.newPlot : Plotly.react;
      enqueuePlot(seq, () =>
        draw(node, data, layout3d, plotCfg).then(() => bindPlotEvents(node, seq, plotSeq.current, click))
      );
    }
  }, [tab, stations, overlays, selected, targets, vspDeg, currentHoleId]);

  function enqueuePlot(seq: number, fn: () => Promise<unknown>) {
    plotTail.current = plotTail.current
      .catch(() => undefined)
      .then(() => {
        if (seq !== plotSeq.current) return;
        return fn();
      })
      .then(() => undefined);
  }

  useEffect(() => {
    return () => {
      if (el.current) Plotly.purge(el.current);
    };
  }, []);

  if (tab === "target") return null;
  return (
    <div className="chart-pane">
      <ChartLegend items={legendItems} />
      <div className="chart" ref={el} />
    </div>
  );
}

function pathsForPlot(
  overlays: HoleOverlay[],
  stations: CalculatedStation[],
  currentHoleId: string | null
): HoleOverlay[] {
  if (overlays.length === 0) {
    return stations.length
      ? [
          {
            id: currentHoleId ?? "current",
            name: "Measured",
            parent_hole_id: null,
            stations,
            color: PARENT_HOLE_COLOR,
          },
        ]
      : [];
  }
  let found = false;
  const next = overlays.map((h) => {
    if (h.id === currentHoleId) {
      found = true;
      return stations.length ? { ...h, stations } : h;
    }
    return h;
  });
  if (!found && stations.length) {
    next.push({
      id: currentHoleId ?? "current",
      name: "Measured",
      parent_hole_id: null,
      stations,
      color: PARENT_HOLE_COLOR,
    });
  }
  return next;
}

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="chart-legend">
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="chart-legend-item">
          <span className="chart-legend-swatch" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function bindPlotEvents(
  node: HTMLDivElement,
  seq: number,
  current: number,
  click: (ev: { points?: { customdata?: PickPoint }[] }) => void
) {
  if (seq !== current) return;
  const n = node as unknown as {
    on: (e: string, fn: (ev?: unknown) => void) => void;
    removeAllListeners?: (e: string) => void;
  };
  n.removeAllListeners?.("plotly_click");
  n.removeAllListeners?.("plotly_hover");
  n.on("plotly_click", click as (ev?: unknown) => void);
  n.on("plotly_hover", () => {
    requestAnimationFrame(() => clampPlotlyHover(node));
  });
}

function clampPlotlyHover(root: HTMLElement) {
  const pad = 8;
  const nodes = root.querySelectorAll<HTMLElement>(".hovertext, .hoverlayer");
  for (const el of nodes) {
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    let dx = 0;
    let dy = 0;
    if (r.top < pad) dy = pad - r.top;
    if (r.bottom > window.innerHeight - pad) dy += window.innerHeight - pad - r.bottom;
    if (r.left < pad) dx = pad - r.left;
    if (r.right > window.innerWidth - pad) dx += window.innerWidth - pad - r.right;
    if (dx || dy) el.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}

function isScatter3d(d: object): boolean {
  return "type" in d && (d as { type?: string }).type === "scatter3d";
}

function isJunctionTarget(t: Target, all: Target[]): boolean {
  if (t.parent_target_id) return false;
  return /^junction$/i.test(t.name) || all.some((c) => c.parent_target_id === t.id);
}

function sceneAspect(
  paths: HoleOverlay[],
  targets: Target[],
  sel: CalculatedStation | undefined
): { x: number; y: number; z: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const h of paths) {
    for (const s of h.stations) {
      xs.push(s.east);
      ys.push(s.north);
      zs.push(s.tvd);
    }
  }
  for (const t of targets) {
    xs.push(t.east);
    ys.push(t.north);
    zs.push(t.tvd);
  }
  if (sel) {
    xs.push(sel.east);
    ys.push(sel.north);
    zs.push(sel.tvd);
  }
  const span = (a: number[]) => {
    if (a.length === 0) return 1;
    const s = Math.max(...a) - Math.min(...a);
    return s > 1e-6 ? s : 1;
  };
  const ex = span(xs);
  const ey = span(ys);
  const ez = span(zs);
  const m = Math.max(ex, ey, ez, 1);
  const floor = m * 0.18;
  return {
    x: Math.max(ex, floor) / m,
    y: Math.max(ey, floor) / m,
    z: Math.max(ez, floor) / m,
  };
}

function measuredIndexed(h: HoleOverlay) {
  return h.stations
    .map((s, stationIndex) => ({ s, stationIndex }))
    .filter(({ s }) => s.class === "measured");
}

function picks(h: HoleOverlay): PickPoint[] {
  return measuredIndexed(h).map(({ stationIndex }) => ({ holeId: h.id, stationIndex }));
}

function holePlanTraces(h: HoleOverlay) {
  const m = measuredIndexed(h);
  const traces: object[] = [
    line2d(
      m.map(({ s }) => s.east),
      m.map(({ s }) => s.north),
      h.name,
      h.color,
      "solid",
      picks(h)
    ),
  ];
  if (h.parent_hole_id && m[0]) {
    traces.push(branchMark2d(m[0].s.east, m[0].s.north, `${h.name} kick-off`, { holeId: h.id, stationIndex: m[0].stationIndex }));
  }
  return traces;
}

function holeProfileTraces(h: HoleOverlay) {
  const m = measuredIndexed(h);
  const traces: object[] = [
    line2d(
      m.map(({ s }) => s.vs),
      m.map(({ s }) => s.tvd),
      h.name,
      h.color,
      "solid",
      picks(h)
    ),
  ];
  if (h.parent_hole_id && m[0]) {
    traces.push(branchMark2d(m[0].s.vs, m[0].s.tvd, `${h.name} kick-off`, { holeId: h.id, stationIndex: m[0].stationIndex }));
  }
  return traces;
}

function hole3dTraces(h: HoleOverlay) {
  const m = measuredIndexed(h);
  const traces: object[] = [
    {
      type: "scatter3d",
      mode: "lines+markers",
      x: m.map(({ s }) => s.east),
      y: m.map(({ s }) => s.north),
      z: m.map(({ s }) => s.tvd),
      name: h.name,
      customdata: picks(h),
      line: { color: h.color, width: 8 },
      marker: { size: 4, color: h.color },
    },
  ];
  if (h.parent_hole_id && m[0]) {
    traces.push({
      type: "scatter3d",
      mode: "markers",
      x: [m[0].s.east],
      y: [m[0].s.north],
      z: [m[0].s.tvd],
      name: `${h.name} kick-off`,
      customdata: [{ holeId: h.id, stationIndex: m[0].stationIndex }],
      marker: { size: 8, color: "#e0c36a", symbol: "diamond" },
    });
  }
  return traces;
}

function projPlan(measured: CalculatedStation[], projected: CalculatedStation[]) {
  if (!projected.length) return [];
  return [
    line2d(
      [measured[measured.length - 1]?.east ?? 0, ...projected.map((s) => s.east)],
      [measured[measured.length - 1]?.north ?? 0, ...projected.map((s) => s.north)],
      "PROJECTED",
      "#c9a227",
      "dash"
    ),
  ];
}

function projProfile(measured: CalculatedStation[], projected: CalculatedStation[]) {
  if (!projected.length) return [];
  return [
    line2d(
      [measured[measured.length - 1]?.vs ?? 0, ...projected.map((s) => s.vs)],
      [measured[measured.length - 1]?.tvd ?? 0, ...projected.map((s) => s.tvd)],
      "PROJECTED",
      "#c9a227",
      "dash"
    ),
  ];
}

function proj3d(measured: CalculatedStation[], projected: CalculatedStation[]) {
  if (!projected.length) return [];
  return [
    {
      type: "scatter3d",
      mode: "lines+markers",
      x: [measured[measured.length - 1]?.east ?? 0, ...projected.map((s) => s.east)],
      y: [measured[measured.length - 1]?.north ?? 0, ...projected.map((s) => s.north)],
      z: [measured[measured.length - 1]?.tvd ?? 0, ...projected.map((s) => s.tvd)],
      name: "PROJECTED",
      line: { color: "#c9a227", width: 6, dash: "dash" },
      marker: { size: 4, color: "#c9a227" },
    },
  ];
}

function targetVs(t: Target, vspDeg: number): number {
  const th = (vspDeg * Math.PI) / 180;
  return t.north * Math.cos(th) + t.east * Math.sin(th);
}

function targetMark2d(x: number, y: number, name: string) {
  return {
    type: "scatter",
    mode: "markers",
    x: [x],
    y: [y],
    name,
    marker: {
      size: 16,
      symbol: "x",
      color: "#c44b3c",
      line: { width: 3, color: "#c44b3c" },
    },
  };
}

function targetMark3d(t: Target, junction: boolean) {
  return {
    type: "scatter3d",
    mode: "markers",
    x: [t.east],
    y: [t.north],
    z: [t.tvd],
    name: t.name || (junction ? "Junction" : "Target"),
    marker: junction
      ? { size: 8, color: "#e0c36a", symbol: "diamond" }
      : { size: 8, color: "#c44b3c", symbol: "x", line: { width: 2, color: "#f0d48a" } },
  };
}

function branchMark2d(x: number, y: number, name: string, pick?: PickPoint) {
  return {
    type: "scatter",
    mode: "markers",
    x: [x],
    y: [y],
    name,
    customdata: pick ? [pick] : undefined,
    marker: {
      size: 11,
      symbol: "diamond",
      color: "#e0c36a",
      line: { width: 1, color: "#e0c36a" },
    },
  };
}

function line2d(
  x: number[],
  y: number[],
  name: string,
  color: string,
  dash: "solid" | "dash",
  customdata?: PickPoint[]
) {
  if (x.length === 0) return {};
  return {
    type: "scatter",
    mode: "lines+markers",
    x,
    y,
    name,
    customdata,
    line: { color, width: 2, dash },
    marker: { size: 5, color },
  };
}
