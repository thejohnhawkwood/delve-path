/** Display colors for holes. Stored hex on the hole wins; otherwise parent then laterals. */

export const PARENT_HOLE_COLOR = "#e8eaed";
export const LATERAL_COLORS = ["#7ee0e0", "#e0c36a", "#7ec47a", "#7a8fc4", "#c47a4a"] as const;
export const COLOR_PRESETS = [PARENT_HOLE_COLOR, ...LATERAL_COLORS];

export function defaultHoleColor(
  hole: { id: string; color?: string | null; parent_hole_id?: string | null },
  all: { id: string; parent_hole_id?: string | null }[]
): string {
  if (hole.color) return hole.color;
  if (!hole.parent_hole_id) return PARENT_HOLE_COLOR;
  const laterals = all.filter((h) => h.parent_hole_id);
  const i = laterals.findIndex((h) => h.id === hole.id);
  return LATERAL_COLORS[(i < 0 ? 0 : i) % LATERAL_COLORS.length];
}

export function asColorInput(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : PARENT_HOLE_COLOR;
}
