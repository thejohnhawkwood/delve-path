# Data model

UUIDs and `created_at` / `updated_at` on every entity. Local authoritative. No cloud.

## Project

`id, name, client, notes, created_at, updated_at`

## Hole

`id, project_id, name, unit_system, survey_convention, azimuth_reference, vsp_deg, declination_note, grid_note, parent_hole_id, branch_md, color, origin_id, origin_north, origin_east, vertical_datum, vertical_datum_name, crs_epsg, crs_note, created_at, updated_at`

Schema v5 adds the coordinate-frame fields. Existing holes migrate to `origin_id=unspecified` and `vertical_datum=unspecified`. Paths are comparable only when unit, named origin, north, and datum all agree.

Collar N/E are display/metadata offsets; trajectory N/E are wellhead-relative unless later specified.

`parent_hole_id` is null for a **parent wellbore**. A sidetrack / lateral stores the parent’s id and `branch_md` (display units, same as stored stations) of the **selected measured station** used as kick-off. Role is inferred: parent if `parent_hole_id` is None. Schema v2 migration adds these columns on existing `*.delvepath` files.

`color` is an optional `#rrggbb` plot/table color. Null means the UI default (parent `#e8eaed`, then a fixed lateral palette). Schema v4 adds this column.

Each hole still calculates independently from its own TieIn. The lateral’s first station is the kick-off; its tie-in is the parent’s calculated N/E/TVD at that station. The parent’s stations are not copied into the lateral (DSR sidetrack list from KOP; overlay parent + laterals on charts). Arbitrary-MD interpolation at kick-off is **not** implemented.

## Survey station (measured)

`id, hole_id, seq, md, inc_deg, azi_deg, comment, source, class, tvd_tie, north_tie, east_tie, review_state (unreviewed|accepted|excluded), reviewer, review_source, reviewed_at, exclusion_reason`

Existing stations migrate to `unreviewed`. Flight Deck anchors require `accepted`. Station IDs are stable across saves.

Calculated fields are **not stored as source of truth**. They are recomputed by `delve-core` on read. Optional cache columns may exist but are discarded on recompute.

## Target

`id, hole_id, name, north_m, east_m, tvd_m, horiz_tol_m, vert_tol_m, parent_target_id, created_at, updated_at`

`parent_target_id` is null for a **junction** (parent target at the kick-off / branch point) or a standalone point. Schema v3 adds this column. Schema v5 adds `geometry_json` (plane + footprint). Legacy N/E/TVD rows migrate to a horizontal point footprint without inventing dip.

## Documents (schema v5)

`id, hole_id, kind (plan|bha|segment|decision|datum|wireline|marker|covariance|scan), payload, updated_at`

Typed plan / BHA / scenario / depth / EOU objects are versioned Serde JSON. Derived survey coordinates are not stored as source truth.

## Projection

`id, hole_id, kind (tangent_to_md | tangent_to_tvd | tangent_bit), from_station_id, bit_to_sensor_m, target_md_m, target_tvd_m, created_at`

Projected stations are derived, class `projected`, never inserted into the measured list.

## Planned path (schema stub)

`plan` + `plan_station` tables may exist empty for V1. Not required to populate in MVP.

## SQLite

File: user-chosen `*.delvepath` (SQLite). Schema version table. WAL. Transactions around survey edits. Autosave debounce ~2 s after last edit plus on blur/close.


## Collision audit records (no schema migration)

Collision runs are unique `scan` documents, ID `<hole-id>:collision:<uuid>`, with `delvepath-collision-audit` format version 1. They preserve a complete self-contained case, method/source fingerprint, input/result hashes, baseline, candidate ledger, and up to three passing alternatives. SQLite v5, IndexedDB v2 and browser snapshot v2 continue unchanged. Historical audit frames/units are immutable and independent of later hole edits. Imported cases explicitly declare offset polyline geometry and whole-path constant covariance envelopes. Candidate CSV rows are `planned`; they never enter the measured-station store.
