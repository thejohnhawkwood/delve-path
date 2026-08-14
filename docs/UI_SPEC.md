# UI specification

Industrial 2026 field software. Graphite chrome, readable data surfaces, compact controls. No glassmorphism, neon, or chat aesthetics. Amber = warning, red = error, green = pass — semantic only. Meaning is never color-only.

Prototype banner always visible: **Engineering prototype / evaluation software — not certified.**

## Layout (1366×768 and 1920×1080)

```text
[ menu / project / hole picker / units / convention / branch / examples ]
[ CURRENT POSITION panel          | validation ]
[ Survey grid (primary)                          ]
[ Plan | Profile | 3-D | Target  tabs            ]
```

Grid is the speed path. Charts consume core results.

## Survey grid

Columns: MD, INC, AZI (editable) · TVD, N, E, VS, Closure, Closure Azi, DLS (calculated, visually muted) · Comment.

Workflow: MD → TAB → INC → TAB → AZI → ENTER → next row.

Paste tab/CSV multi-row. Insert/delete rows. Do not silently sort decreasing MD.

## Current position

Shows last **measured** station unless a projection is selected, in which case it is labelled **PROJECTED**. Units and convention shown.

## Views

- **Plan:** +N up, +E right, equal scale default, north label, actual solid, projected dashed, target marker, current point. Open-project overlay: every hole (parent + sidetracks) in distinct colors with a legend; diamond at each lateral’s kick-off; all targets as named X marks.
- **Profile:** VS vs TVD (TVD down on screen). Render flip is view-only. Same overlay.
- **3-D:** line + stations + targets + orbit/fit. No geology. Same overlay.
- **Target:** junction (parent at kick-off N/E/TVD) plus child lateral targets (BHL / intermediate), assigned to a hole. Tree in the Target tab. Deltas vs the selected target. High/low–left/right only if a plan exists; otherwise numeric deltas. Do not invent high-side without a plan. Junction = diamond; other targets = X. Not TAML hardware.

## Parent wellbore / sidetrack

Hole picker switches among holes in the open project (or the in-memory dual-lateral demo). **Branch from selected station** creates a new hole named Lateral B/C/…, copies units/convention/north/VSP, sets `parent_hole_id` + `branch_md`, seeds one kick-off station, and ties on the parent’s **calculated** N/E/TVD at that row. Parent survey is not copied into the lateral. **Load dual-lateral example** is a constructed imperial demo (not a golden). Oregon auto-load in production is unchanged.

## Keyboard

Tab order follows entry. Focus returns to MD after ENTER.
