# Test plan

Commands (repo root):

```text
npm run test-core      # cargo test -p delve-core
npm run test-golden    # cargo test -p delve-core -- golden
npm run test-ui        # vitest
npm run test-all       # core + golden + ui + production build
```

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
