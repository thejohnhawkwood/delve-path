# Data model

UUIDs and `created_at` / `updated_at` on every entity. Local authoritative. No cloud.

## Project

`id, name, client, notes, created_at, updated_at`

## Hole

`id, project_id, name, collar_north_m, collar_east_m, reference_elevation_m, unit_system (metric|imperial), survey_convention (oilfield_from_vertical), azimuth_reference (true|grid|magnetic|unknown), vsp_deg, declination_note, grid_note, parent_hole_id, branch_md, color, created_at, updated_at`

Collar N/E are display/metadata offsets; trajectory N/E are wellhead-relative unless later specified.

`parent_hole_id` is null for a **parent wellbore**. A sidetrack / lateral stores the parent’s id and `branch_md` (display units, same as stored stations) of the **selected measured station** used as kick-off. Role is inferred: parent if `parent_hole_id` is None. Schema v2 migration adds these columns on existing `*.delvepath` files.

`color` is an optional `#rrggbb` plot/table color. Null means the UI default (parent `#e8eaed`, then a fixed lateral palette). Schema v4 adds this column.

Each hole still calculates independently from its own TieIn. The lateral’s first station is the kick-off; its tie-in is the parent’s calculated N/E/TVD at that station. The parent’s stations are not copied into the lateral (DSR sidetrack list from KOP; overlay parent + laterals on charts). Arbitrary-MD interpolation at kick-off is **not** implemented.

## Survey station (measured)

`id, hole_id, seq, md_m, inc_rad, azi_rad, comment, source (manual|paste|csv|tie_in), class (measured), created_at, updated_at`

Calculated fields are **not stored as source of truth**. They are recomputed by `delve-core` on read. Optional cache columns may exist but are discarded on recompute.

## Target

`id, hole_id, name, north_m, east_m, tvd_m, horiz_tol_m, vert_tol_m, parent_target_id, created_at, updated_at`

`parent_target_id` is null for a **junction** (parent target at the kick-off / branch point) or a standalone point. A lateral target (BHL or intermediate) stores the junction’s id. Schema v3 adds this column. Deleting a junction nulls children (they become standalone); it does not cascade-delete them.

## Projection

`id, hole_id, kind (tangent_to_md | tangent_to_tvd | tangent_bit), from_station_id, bit_to_sensor_m, target_md_m, target_tvd_m, created_at`

Projected stations are derived, class `projected`, never inserted into the measured list.

## Planned path (schema stub)

`plan` + `plan_station` tables may exist empty for V1. Not required to populate in MVP.

## SQLite

File: user-chosen `*.delvepath` (SQLite). Schema version table. WAL. Transactions around survey edits. Autosave debounce ~2 s after last edit plus on blur/close.
