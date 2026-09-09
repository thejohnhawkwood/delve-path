export interface ViewBounds {
  north: [number, number];
  east: [number, number];
  tvd: [number, number];
}

/** Display ranges share one length scale, even for exactly planar/vertical paths. */
export function boundsFor3d(data: unknown[]): ViewBounds {
  const extents = ["y", "x", "z"].map((axis) => {
    let low = Infinity;
    let high = -Infinity;
    for (const trace of data) {
      const values = (trace as Record<string, unknown>)[axis];
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        low = Math.min(low, value);
        high = Math.max(high, value);
      }
    }
    return Number.isFinite(low) ? [low, high] : [0, 0];
  });
  const largest = Math.max(...extents.map(([low, high]) => high - low), 1);
  const ranges = extents.map(([low, high]) => [low - largest * 0.04, high + largest * 0.04] as [number, number]);
  return { north: ranges[0], east: ranges[1], tvd: ranges[2] };
}
