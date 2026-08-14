import type { CalculatedStation, MeasuredStation, StationClass, UnitSystem } from "./domain";

export interface ParsedSurvey {
  stations: MeasuredStation[];
  warnings: string[];
}

const MD_KEYS = ["md", "md_ft", "md_m", "measured_depth"];
const INC_KEYS = ["inc", "incl", "inc_deg", "incl_deg", "inclination"];
const AZI_KEYS = ["azi", "az", "azi_deg", "azim", "azimuth"];
const COMMENT_KEYS = ["comment", "remarks", "note"];

function norm(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function findCol(headers: string[], keys: string[]): number {
  const n = headers.map(norm);
  for (const k of keys) {
    const i = n.indexOf(k);
    if (i >= 0) return i;
  }
  return -1;
}

export function splitTable(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
    return parseCsvLine(line);
  });
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
    } else if (ch === "," && !q) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function looksLikeMiningHeaders(headers: string[]): boolean {
  const n = headers.map(norm);
  return n.some((h) => h === "dip" || h === "inclination_from_horizontal" || h === "mining_inc");
}

export function parseSurveyTable(text: string, source: "paste" | "csv"): ParsedSurvey {
  const rows = splitTable(text);
  const warnings: string[] = [];
  if (rows.length === 0) return { stations: [], warnings: ["Empty table."] };

  let start = 0;
  let mdCol = 0;
  let incCol = 1;
  let aziCol = 2;
  let commentCol = 3;

  if (looksLikeMiningHeaders(rows[0])) {
    return {
      stations: [],
      warnings: [
        "Mining-style headers (dip / inclination-from-horizontal) are blocked. Mining conversion is not implemented.",
      ],
    };
  }

  const headerHit =
    findCol(rows[0], MD_KEYS) >= 0 &&
    findCol(rows[0], INC_KEYS) >= 0 &&
    findCol(rows[0], AZI_KEYS) >= 0;

  if (headerHit) {
    mdCol = findCol(rows[0], MD_KEYS);
    incCol = findCol(rows[0], INC_KEYS);
    aziCol = findCol(rows[0], AZI_KEYS);
    commentCol = findCol(rows[0], COMMENT_KEYS);
    start = 1;
  }

  const stations: MeasuredStation[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const md = Number(r[mdCol]);
    const inc = Number(r[incCol]);
    const azi = Number(r[aziCol]);
    if (![md, inc, azi].every(Number.isFinite)) {
      warnings.push(`Row ${i + 1} skipped (MD/INC/AZI not numeric).`);
      continue;
    }
    stations.push({
      md,
      inc_deg: inc,
      azi_deg: azi,
      comment: commentCol >= 0 ? (r[commentCol] ?? "") : "",
      class: "measured",
      source,
    });
  }
  return { stations, warnings };
}

export function exportCalculatedCsv(
  stations: CalculatedStation[],
  unit: UnitSystem
): string {
  const len = unit === "imperial" ? "ft" : "m";
  const dls = unit === "imperial" ? "dls_deg_per_100ft" : "dls_deg_per_30m";
  const header = [
    `md_${len}`,
    "inc_deg",
    "azi_deg",
    `tvd_${len}`,
    `north_${len}`,
    `east_${len}`,
    `vs_${len}`,
    `closure_${len}`,
    "closure_azi_deg",
    dls,
    "class",
    "comment",
  ].join(",");
  const lines = stations.map((s) =>
    [
      s.md,
      s.inc_deg,
      s.azi_deg,
      s.tvd,
      s.north,
      s.east,
      s.vs,
      s.closure,
      s.closure_azi_deg,
      s.dls,
      s.class,
      csvEscape(s.comment),
    ].join(",")
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}

function csvEscape(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsForCalc(rows: MeasuredStation[]): MeasuredStation[] {
  return rows.filter((r) => Number.isFinite(r.md) && Number.isFinite(r.inc_deg) && Number.isFinite(r.azi_deg));
}

export function measuredOnly(rows: MeasuredStation[]): MeasuredStation[] {
  return rowsForCalc(rows).filter((r) => r.class === "measured");
}

export function asClass(s: string): StationClass {
  if (s === "projected") return "projected";
  if (s === "planned") return "planned";
  return "measured";
}
