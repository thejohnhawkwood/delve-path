# Implementation plan

## Phase 0 — Evidence gate

**Objective:** Lock convention, units, calculation source, goldens.  
**Assumptions:** Oilfield-from-vertical is the only implemented convention. Mining blocked.  
**Gate:** This document set + usable Oregon + NM 9461 fixtures. **Met.**

## Phase 1 — Scaffold

**Objective:** Tauri 2 + React + TS strict + Rust workspace.  
**Modules:** `src/`, `src-tauri/`, `crates/delve-core`, `crates/delve-storage`.  
**Tests:** `npm run dev` / `cargo check`.  
**Gate:** Dev UI renders from local assets.

## Phase 2 — delve-core

**Objective:** Types, validation, min curvature, derived values, goldens.  
**Files:** `crates/delve-core/src/{lib,types,units,validate,min_curvature,derived,projection}.rs`  
**Tests:** synthetic + Oregon + NM 9461 + COMPASS/HawkEye compare.  
**Gate:** `test-core` + `test-golden` pass. Do not loosen tolerances.

## Phase 3 — Persistence

**Objective:** SQLite schema, repos, autosave.  
**Files:** `crates/delve-storage`  
**Gate:** create/save/reopen identical measured data.

## Phase 4 — Workflow

**Objective:** New/open project, hole setup, grid, paste, current position.  
**Gate:** Oregon numbers reproducible from UI paste (manual check).

## Phase 5 — Visualization

**Objective:** Plan, profile, 3-D from core results; synced selection.  
**Gate:** One station highlighted everywhere.

## Phase 6 — Targets / projection

**Objective:** Point target, deltas, simple tangent projection labelled PROJECTED.  
**Gate:** Classes distinct in UI and DB.

## Phase 7 — Import/export

**Objective:** CSV + paste map + printable report.  
**Gate:** Round-trip measured fields.

## Phase 8 — Hardening

**Objective:** Autosave, 1366 layout, offline config, installer if toolchain allows.  
**Gate:** Air-gap documented; installer may remain NOT YET VALIDATED.

## Phase 9 — Polish

**Objective:** Typography, empty/error states, terminology.  
**Gate:** Looks intentional, not a demo.

**Failure modes:** golden mismatch → stop and investigate; missing Rust → install; WSdoc gap → do not invent solvers.
