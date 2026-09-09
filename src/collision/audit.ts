import type { Generation } from "./types";
export const AUDIT_FORMAT = "delvepath-collision-audit";
export interface Audit {
  format: typeof AUDIT_FORMAT;
  formatVersion: 1;
  createdAt: string;
  applicationVersion: string;
  gitRevision: string;
  sourceSha256: string;
  inputSha256: string;
  resultSha256: string;
  result: Generation;
}
export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function makeAudit(result: Generation): Promise<Audit> {
  return {
    format: AUDIT_FORMAT,
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    applicationVersion: __DELVE_VERSION__,
    gitRevision: __DELVE_GIT_SHA__,
    sourceSha256: __DELVE_SOURCE_SHA256__,
    inputSha256: await digest(result.input),
    resultSha256: await digest(result),
    result,
  };
}
export async function verifyAudit(a: Audit): Promise<void> {
  if (a.format !== AUDIT_FORMAT || a.formatVersion !== 1 || !a.result?.input)
    throw new Error("Unsupported audit format.");
  if (
    (await digest(a.result.input)) !== a.inputSha256 ||
    (await digest(a.result)) !== a.resultSha256
  )
    throw new Error(
      "Audit content hashes do not match. Import the case separately if you intend to change its inputs.",
    );
}
export function candidateCsv(g: Generation, id: string): string {
  const c = g.alternatives.find((x) => x.summary.id === id);
  if (!c) throw new Error("Select a generated candidate first.");
  return [
    `# ${g.notice}`,
    `# ${g.input.synthetic ? "SYNTHETIC / constructed" : "User supplied evaluation case"} — ${g.method}`,
    `# PLANNED CANDIDATE; length unit ${g.input.frame.unit_system}; TVD positive down; cumulative MD error bound ±${c.summary.length_error_bound}`,
    "class,md,inc_deg,azi_deg,north,east,tvd",
    ...c.points.map((p) =>
      ["planned", p.md, p.inc_deg, p.azi_deg, p.north, p.east, p.tvd].join(","),
    ),
  ].join("\n");
}
