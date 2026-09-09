import { useEffect, useRef, useState } from "react";
import { usePlotlyView } from "./plotlyView";
import { boundsFor3d } from "./chartBounds";
import { PARENT_HOLE_COLOR } from "./colors";
import type { CalculatedStation, Target } from "./domain";

export type ChartTab = "planView" | "profile" | "3d" | "target";

export interface ExtraPath {
  name: string;
  color: string;
  dash?: "solid" | "dash" | "dot";
  layer?: string;
  width?: number;
  opacity?: number;
  view?: ChartTab;
  fill?: boolean;
  mesh?: { vertices: [number, number, number][]; triangles: [number, number, number][] };
  points: { north: number; east: number; tvd: number; vs?: number }[];
}

export interface TargetOutlineTrace {
  name: string;
  world: [number, number, number][];
  section: [number, number][];
  projection: [number, number][];
}

export interface HoleOverlay {
  id: string;
  name: string;
  parent_hole_id: string | null;
  stations: CalculatedStation[];
  color: string;
}

interface Props {
  tab: ChartTab;
  stations: CalculatedStation[];
  overlays: HoleOverlay[];
  selected: number;
  targets: Target[];
  vspDeg: number;
  currentHoleId: string | null;
  onPickStation: (holeId: string, index: number) => void;
  extraPaths?: ExtraPath[];
  targetOutlines?: TargetOutlineTrace[];
  profileTargetMode?: "intersection" | "projection";
  focusBounds?: { north: [number, number]; east: [number, number]; tvd: [number, number] };
  unitLabel?: string;
}

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
  extraPaths = [],
  targetOutlines = [],
  profileTargetMode = "projection",
  focusBounds,
  unitLabel = "",
}: Props) {
  const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);
  const { element: el, render, error, retry } = usePlotlyView();
  const pickRef = useRef(onPickStation);
  pickRef.current = onPickStation;

  const paths = pathsForPlot(overlays, stations, currentHoleId);
  const layerOf = (p: ExtraPath) => p.layer ?? (p.name.startsWith("EOU") ? "Uncertainty" : p.name.split(" ")[0]);
  const layers = [...new Map([
    ...paths.map((p) => [`survey:${p.id}`, { label: p.name, color: p.color }] as const),
    ...extraPaths.map((p) => [layerOf(p), { label: layerOf(p), color: p.color }] as const),
  ]).entries()];
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
    ...extraPaths.filter((p) => !p.layer && !p.view).slice(0, 8).map((p) => ({ color: p.color, label: p.name })),
  ];

  useEffect(() => {
    if (tab === "target") return;
    const plotPaths = pathsForPlot(overlays, stations, currentHoleId).filter((p) => !hiddenLayers.includes(`survey:${p.id}`));
    const visibleExtras = extraPaths.filter((p) => (!p.view || p.view === tab) && !hiddenLayers.includes(layerOf(p)));
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

    const draw = (data: unknown[], layout: Record<string, unknown>) => render({
      data, layout, mode: tab, onReady: (node) => bindPlotEvents(node, click),
    });

    if (tab === "planView") {
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
        ...visibleExtras.map((p) =>
          extraLine2d(
            p.points.map((q) => q.east),
            p.points.map((q) => q.north),
            p
          )
        ),
        ...targetOutlines.map((o) =>
          line2d(
            o.world.map((q) => q[1]),
            o.world.map((q) => q[0]),
            `${o.name} footprint`,
            "#c44b3c",
            "solid"
          )
        ),
      ];
        draw(
          data.filter((d) => d && "type" in d),
          {
            ...layoutBase,
            title: { text: "Plan  +N up  +E right", font: { size: 12 } },
            xaxis: { title: `East ${unitLabel}`, zeroline: true, scaleanchor: "y", scaleratio: 1, range: focusBounds?.east },
            yaxis: { title: `North ${unitLabel}`, zeroline: true, range: focusBounds?.north },
            annotations: [{ x: 0, y: 0, text: "N↑", showarrow: false, xanchor: "left" }],
          },
        );
    }

    if (tab === "profile") {
      const sectionBounds = focusBounds ? focusBounds.north.flatMap((north) =>
        focusBounds.east.map((east) => extraVs(north, east, vspDeg))) : null;
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
        ...visibleExtras.map((p) =>
          extraLine2d(
            p.points.map((q) => q.vs ?? extraVs(q.north, q.east, vspDeg)),
            p.points.map((q) => q.tvd),
            p
          )
        ),
        ...targetOutlines.flatMap((o) => {
          const pts = profileTargetMode === "intersection" ? o.section : o.projection;
          return [
            line2d(
              pts.map((q) => q[0]),
              pts.map((q) => q[1]),
              `${o.name} ${profileTargetMode === "intersection" ? "section-plane intersection" : "orthogonal projection"}`,
              "#c44b3c",
              profileTargetMode === "intersection" ? "solid" : "dash"
            ),
          ];
        }),
      ];
        draw(
          data.filter((d) => d && "type" in d),
          {
            ...layoutBase,
            title: { text: "Profile  VS vs TVD (TVD down — view only)", font: { size: 12 } },
            xaxis: { title: `Vertical section ${unitLabel}`, range: sectionBounds ? [Math.min(...sectionBounds), Math.max(...sectionBounds)] : undefined },
            yaxis: { title: `TVD ${unitLabel}`, autorange: focusBounds ? false : "reversed", range: focusBounds ? [...focusBounds.tvd].reverse() : undefined, scaleanchor: "x", scaleratio: 1 },
          },
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
        ...visibleExtras.map((p) => p.mesh ? ({
          type: "mesh3d", name: p.name, color: p.color, opacity: p.opacity ?? 0.18,
          x: p.mesh.vertices.map((q) => q[1]), y: p.mesh.vertices.map((q) => q[0]), z: p.mesh.vertices.map((q) => q[2]),
          i: p.mesh.triangles.map((q) => q[0]), j: p.mesh.triangles.map((q) => q[1]), k: p.mesh.triangles.map((q) => q[2]),
          hovertemplate: `${p.name}<extra></extra>`, flatshading: false,
        }) : ({
          type: "scatter3d",
          mode: "lines",
          x: p.points.map((q) => q.east),
          y: p.points.map((q) => q.north),
          z: p.points.map((q) => q.tvd),
          name: p.name,
          line: { color: p.color, width: p.width ?? 5, dash: p.dash ?? "dash" },
          opacity: p.opacity ?? 1,
        })),
        ...targetOutlines.map((o) => ({
          type: "scatter3d",
          mode: "lines",
          x: o.world.map((q) => q[1]),
          y: o.world.map((q) => q[0]),
          z: o.world.map((q) => q[2]),
          name: `${o.name} footprint`,
          line: { color: "#c44b3c", width: 4 },
        })),
      ].filter(isScatter3d);
      const bounds = focusBounds ?? boundsFor3d(data);
      const spans = { x: bounds.east[1]-bounds.east[0], y: bounds.north[1]-bounds.north[0], z: bounds.tvd[1]-bounds.tvd[0] };
      const largest = Math.max(spans.x,spans.y,spans.z);
      const layout3d = {
        ...layoutBase,
        title: { text: "3-D  +N / +E / TVD down", font: { size: 12 } },
        scene: {
          domain: { x: [0, 1], y: [0, 1] },
          xaxis: { title: `East ${unitLabel}`, range: bounds.east, autorange: false, backgroundcolor: "#1b1d21", gridcolor: "#3a3e46" },
          yaxis: { title: `North ${unitLabel}`, range: bounds.north, autorange: false, backgroundcolor: "#1b1d21", gridcolor: "#3a3e46" },
          zaxis: { title: `TVD ${unitLabel}`, range: [...bounds.tvd].reverse(), autorange: false, backgroundcolor: "#1b1d21", gridcolor: "#3a3e46" },
          aspectmode: "manual",
          camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } },
          aspectratio: {x:spans.x/largest,y:spans.y/largest,z:spans.z/largest},
          uirevision: JSON.stringify(focusBounds ?? "overview"),
          bgcolor: "#1b1d21",
        },
      };
      draw(data, layout3d);
    }
  }, [tab, stations, overlays, selected, targets, vspDeg, currentHoleId, extraPaths, targetOutlines, profileTargetMode, hiddenLayers, focusBounds, unitLabel]);

  if (tab === "target") return null;
  return (
    <div className="chart-pane">
      {layers.length > 0 && <div className="chart-layers" role="group" aria-label="Preview layers">
        <span>LAYERS</span>
        {layers.map(([id, layer]) => <label key={id}>
          <input type="checkbox" checked={!hiddenLayers.includes(id)} onChange={() => setHiddenLayers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])} />
          <i style={{ background: layer.color }} />{layer.label}
        </label>)}
      </div>}
      <ChartLegend items={legendItems} />
      {error && <div className="chart-error" role="alert">{error} <button onClick={retry}>Retry preview</button></div>}
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
  click: (ev: { points?: { customdata?: PickPoint }[] }) => void
) {
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
  return "type" in d && ["scatter3d", "mesh3d"].includes((d as { type: string }).type);
}

function isJunctionTarget(t: Target, all: Target[]): boolean {
  if (t.parent_target_id) return false;
  return /^junction$/i.test(t.name) || all.some((c) => c.parent_target_id === t.id);
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

function extraVs(north: number, east: number, vspDeg: number): number {
  const th = (vspDeg * Math.PI) / 180;
  return north * Math.cos(th) + east * Math.sin(th);
}

function targetVs(t: Target, vspDeg: number): number {
  return extraVs(t.north, t.east, vspDeg);
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

function extraLine2d(x: number[], y: number[], p: ExtraPath) {
  return { type: "scatter", mode: "lines", x, y, name: p.name,
    line: { color: p.color, width: p.width ?? 2.5, dash: p.dash ?? "dash" },
    opacity: p.opacity ?? 1, fill: p.fill ? "toself" : undefined,
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
