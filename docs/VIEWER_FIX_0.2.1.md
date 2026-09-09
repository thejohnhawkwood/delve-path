# Viewer and workspace correction — 0.2.1

## Reproduced failures

The dual-lateral demo's nearly zero North extent caused Plotly's `aspectmode: data` to produce scene ratios around East 205,386, North 2.5e−11 and TVD 193,574. The default camera ended up inside that enormous scene; the paths appeared absent. This also affected other planar and vertical trajectories.

The EOU import called the shared Rust engine with `marginal_2d`, while the serialized enum is `marginal2d`. The complete import therefore failed before emitting its ellipsoid mesh. The error was reproduced directly in the workspace.

The shared chart's purge and draw operations could overlap. Disposal read a ref React could already have cleared, leaving a detached WebGL plot alive. The survey chart remained mounted when Anti-collision hid its container. Plot resizing depended on window resize events, which do not cover all panel/layout changes.

## Corrections

- Explicit padded display ranges and ratios normalized by the largest displayed span preserve equal length units across all three axes, including degenerate paths. Visible meshes, targets and overlays participate in overview bounds. This changes display geometry only.
- One chart controller serializes drawing, resizing, view changes and disposal. It cancels stale scheduled work, observes its actual container size, captures the disposed DOM node, releases hidden survey charts, and surfaces rendering failures with a retry control.
- The workspace uses a bounded flex/grid layout and scrollable controls. A chart's minimum size cannot be silently clipped by a shrinking panel.
- EOU uses the correct engine enum and the selected survey station. A successful import focuses on the ellipsoid; **Show entire path** restores context. Plan and Profile honor the same focus and selected section azimuth.
- EOU inputs/results survive workspace changes. Editing the covariance, source, selected station, hole, unit or section invalidates earlier results; obsolete asynchronous imports cannot restore them.

The native calculation algorithms and stored survey data format are unchanged. Research references and the calculation bounds remain in `ANTI_COLLISION_METHOD.md`. Plot lifecycle behavior follows the [Plotly function reference](https://plotly.com/javascript/plotlyjs-function-reference/).

## Verification and builds

`e2e/viewer.spec.ts` covers the previously blank planar scene, actual EOU mesh and outlines, selected-station placement, persistence across workspace tabs, invalid covariance, five repeated hide/remount/Target/3-D cycles, and resizing at 2560×1392, 1100×760 and 1366×768. Checks verify finite bounded scene proportions, equal physical scale, plot/container dimensions, and absence of stale canvases or browser errors.

All 11 browser end-to-end tests and 29 TypeScript tests passed against this patch. Production compilation, license and bundle-hygiene checks passed. A copy of the newly compiled Windows executable was also checked through native Windows UI automation: dual-lateral 3-D, Rust-backed EOU import, maximizing to 2560×1392, switching to Anti-collision, and returning to the retained EOU ellipsoid all worked. The entire maximized client area rendered; the large blank white region in the supplied screenshot did not recur. This check used normal UI controls, without remote debugging. The synthetic test session was closed afterward.

The release evidence is in `artifacts/verification/viewer-fix/validation.json`. Screenshots and the 0.2.1 web ZIP accompany it. The Windows installer is `target/release/bundle/nsis/DelvePath_0.2.1_x64-setup.exe`. Install that patch build to replace 0.2.0; the old installer still contains the reproduced bugs. Public download folders have not been updated by this local build.
