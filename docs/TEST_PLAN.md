# Test plan

Commands (repo root):

```text
cargo test -p delve-core -p delve-planning -p delve-assurance -p delve-engine -p delve-storage
npm run test-ui        # vitest
npm run test-e2e       # Playwright including Curve Recovery reveal
npm run build:wasm && npm run build
```

Existing delve-core synthetic and golden suites must stay unchanged. New crates cover projections, plans, Flight Deck, targets, centerline, depth, and imported covariance.

`test-all` fails if any of those fail. Golden failures are errors, not warnings.

## Core / synthetic (Phase 2)

`L1_vertical`, `L1_due_north`, `L1_due_east`, `L1_azimuth_wrap`, `L1_near_zero_dogleg`, `L1_cross_horizontal`, `L1_vsp_independence`, `L1_unit_equivalence`, `L1_tie_in`.

No `L1_mining_import`.

## Golden

| Suite | Compare | Notes |
|---|---|---|
| Oregon WinSERVE | TVD N E VS DLS | ft, VSP 165.30°, first station is tie-in |
| NM 9461 | TVD N E VS DLS closure | exclude last projected-to-TD row; DLS at 4685 flagged |
| COMPASS plan excerpt | TVD N E on selected stations | **plan**, not as-drilled |
| HawkEye excerpt | TVD N E VS DLS | excerpt only; method not printed on page |

Print a per-suite max-diff report. Do not round engine output before compare.

## Persistence

Create → edit → kill/reopen → identical measured data.

## UI / E2E (as practical)

Enter/paste a short survey; current position updates; views highlight the same station.

## Air-gap

Documented procedure. Installer may be **NOT YET VALIDATED** in this pass if only a dev build exists.


## Collision evaluation verification

Run `npm run verify:collision` after rebuilding WASM. It compares native and WASM results and writes repeatable synthetic evidence under `artifacts/verification/`. `e2e/collision.spec.ts` exercises correction generation, every preview view, real ellipsoid layers, input invalidation, infeasible constraints, offline recalculation, file audit export/replay, and saved-run reload. `src/collision/audit.test.ts` checks input/result tamper detection and planned-only CSV output. Rust tests independently exercise segment intersections, curvature/flatness/arc-length bounds, units, NIST quantiles, rotated covariance, and bounded centerline refinement. All four existing survey goldens retain their tolerances.

CI now includes a Windows NSIS build and uploads calculation/browser evidence; remote CI has not run until the branch is pushed.
