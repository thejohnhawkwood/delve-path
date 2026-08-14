import type { CalculatedStation, Trajectory, UnitSystem } from "./domain";
import { dlsLabel, fmt, lengthLabel } from "./domain";

export function printReport(
  projectName: string,
  holeName: string,
  traj: Trajectory,
  unit: UnitSystem
): void {
  const len = lengthLabel(unit);
  const rows = traj.stations
    .map(
      (s: CalculatedStation) => `<tr class="${s.class}">
      <td>${fmt(s.md)}</td><td>${fmt(s.inc_deg)}</td><td>${fmt(s.azi_deg)}</td>
      <td>${fmt(s.tvd)}</td><td>${fmt(s.north)}</td><td>${fmt(s.east)}</td>
      <td>${fmt(s.vs)}</td><td>${fmt(s.closure)}</td><td>${fmt(s.closure_azi_deg)}</td>
      <td>${fmt(s.dls)}</td><td>${s.class}</td><td>${escapeHtml(s.comment)}</td>
    </tr>`
    )
    .join("");
  const html = `<!doctype html><html><head><title>DelvePath report</title>
  <style>
    body{font:12px/1.4 Segoe UI,sans-serif;color:#111;margin:24px}
    h1{font-size:16px;margin:0 0 4px}
    .warn{background:#fff3cd;border:1px solid #c9a227;padding:8px;margin:8px 0}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #bbb;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
    th:last-child,td:last-child{text-align:left}
    tr.projected{background:#fff6d6}
  </style></head><body>
  <h1>DelvePath survey report</h1>
  <div class="warn">Engineering prototype / evaluation software — not certified.
  Not for collision avoidance or steering. Minimum Curvature (ISCWSA). Not claimed bit-identical to WinSERVE.</div>
  <p>${escapeHtml(projectName)} / ${escapeHtml(holeName)} · ${unit} · oilfield from vertical ·
  azimuth ${traj.azimuth_reference} · VSP ${fmt(traj.vsp_deg)}°</p>
  <table>
    <thead><tr>
      <th>MD ${len}</th><th>INC</th><th>AZI</th><th>TVD ${len}</th>
      <th>+N</th><th>+E</th><th>VS</th><th>CL</th><th>CL Azi</th>
      <th>DLS ${dlsLabel(unit)}</th><th>Class</th><th>Comment</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}
