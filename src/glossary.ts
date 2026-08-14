/** Short hover text for on-screen terms. Sourced from docs/DOMAIN_GLOSSARY.md. */

export const GLOSSARY = {
  md: "Measured depth — along-hole length from the stated surface reference (KB/RKB/GL). Not the same as TVD.",
  tvd: "True vertical depth — vertical depth computed from the surveys. Not the same as MD.",
  inc: "Inclination — oilfield: 0° is vertical down, 90° is horizontal, above 90° is drilling up.",
  azi: "Azimuth — hole direction, 0–360°, clockwise from the North setting (true, grid, or magnetic).",
  north: "Local +North / −South from the hole origin (usually the wellhead). Not map northing unless you say so.",
  east: "Local +East / −West from the hole origin.",
  vs: "Vertical section — displacement along the VSP azimuth. Not the same as closure.",
  vsp: "Vertical section plane — the azimuth you want VS measured along. Often the plan direction.",
  closure: "Closure distance — straight-line horizontal distance from origin to the station. Not VS.",
  closureAzi: "Closure azimuth — direction from origin to the station, clockwise from the same north as AZI.",
  dls: "Dogleg severity — curvature of the last interval, in °/100 ft or °/30 m. Not a relabel of the other unit.",
  tie: "Tie-in — starting station: MD/INC/AZI plus known TVD/N/E. Later stations accumulate from here.",
  convention: "How inclination is defined. This build is oilfield from vertical only. Mining dip import is refused.",
  units: "Display units. Internally the engine uses metres and radians. Feet and °/100 ft are converted, not relabelled.",
  aziRef: "Which north the azimuths are already in. Declination and grid are notes only — they are not applied.",
  project: "A local DelvePath job file (*.delvepath, SQLite). Holds holes, surveys, and targets. Not a WinSERVE .SVY.",
  hole: "One borehole inside the project. A parent wellbore or a sidetrack/lateral. Surveys and targets belong to the hole.",
  parentWellbore: "API RP 78 DSR: the original wellbore that a sidetrack originates from. Laterals do not re-enter the parent’s stations — overlay both holes on the plots.",
  kickOff: "Kick-off / branch point. This build uses the selected measured station as KOP (no interpolated station at an arbitrary MD). DSR would interpolate min-curvature at kick-off; that solver is not added.",
  lateral: "A sidetrack hole from a parent wellbore, starting at the kick-off station with the parent’s calculated N/E/TVD as tie-in.",
  sidetrack: "DSR: new borehole from a parent wellbore. Tie-on is the last accepted station above kick-off; an interpolated kick-off station is the DSR second station. WinSERVE: interpolate + MAKE TIE-IN + copy/append curves.",
  measured: "A station you entered or imported. Source of truth for the survey list.",
  projected: "A what-if point. Straight Line hold of last INC/AZI. Never written into the measured list.",
  current: "Last measured station, or the projection if one is selected. This is “where is the hole now?”",
  planView: "Map view: +North up, +East right, equal scale. Solid = measured, dashed amber = projected, red X = target.",
  profileView: "Section view: vertical section vs TVD, with TVD increasing down the screen (view only).",
  view3d: "Orbit the well in East / North / TVD. No geology.",
  target: "A point objective in N, E, and TVD. Deltas are numeric. High/low–left/right needs a plan (not in this build).",
  junction: "Parent target at the kick-off / branch point (N/E/TVD). Lateral targets hang off it as children. Not TAML hardware.",
  straight: "Straight Line projection — hold last INC and AZI. Same idea as WinSERVE Straight Line to MD/TVD. Not BHL trend.",
  bit: "Bit-to-sensor — along-hole distance from the survey tool to the bit. Here it is a Straight Line hold, not WinSERVE BHL trend.",
  csv: "Import MD, INC, AZI (and optional comment). Mining dip headers are refused. Export includes calculated columns and class.",
  report: "Printable survey table with the prototype disclaimer. Projected rows stay labelled.",
  oregon: "Public Oregon WinSERVE filing 24c-23-65. Feet, VSP 165.30°, tie-in MD = TVD = 445.",
  comment: "Free text on a station (tie-in note, interpolated, plug-back). Does not change the math.",
  class: "measured, projected, or planned. Projections must not look like surveys.",
} as const;

export type GlossaryId = keyof typeof GLOSSARY;

export const TIPS_KEY = "delvepath.tutorialTips";

export function loadTipsOn(): boolean {
  try {
    return localStorage.getItem(TIPS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveTipsOn(on: boolean): void {
  try {
    localStorage.setItem(TIPS_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}
