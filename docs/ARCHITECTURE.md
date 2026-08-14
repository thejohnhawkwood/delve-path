# Architecture

## Layers

```text
React UI  (Vite + TypeScript strict)
    │ typed Tauri commands only — no raw SQL
    ▼
Tauri 2 app  (commands, dialogs, lifecycle, offline bundle)
    │
    ├── delve-storage  (SQLite + migrations + repositories)
    └── delve-core     (pure Rust domain + min curvature)
```

**Invariant:** `delve-core` does not know Tauri, SQLite, or the UI exist.

## Workspace

```text
crates/delve-core
crates/delve-storage
src-tauri          # Tauri host
src                # React
tests/fixtures     # copies/links of golden CSVs + provenance
```

## Canonical internal model (locked for MVP)

Source: ISCWSA *Introduction to Wellbore Positioning* V09.10.17 Ch. 3–7; `docs/SURVEY_CONVENTIONS.md`.

| Quantity | Internal |
|---|---|
| Length | metres (`LengthM`) |
| Angle (trig) | radians |
| Inclination | from vertical, 0 = down, π/2 = horizontal |
| Azimuth | clockwise from the hole’s stored north reference |
| Coordinates | +North, +East, +TVD down |
| Convention enum | `OilfieldFromVertical` only in MVP |
| Azimuth reference | `True` / `Grid` / `Magnetic` / `Unknown` — stored, not auto-converted |
| DLS | stored as rad/m; presented as °/30 m or °/100 ft |

Mining-from-horizontal and WinSERVE mining report mode are **not implemented**. Import without an explicit convention is refused.

Declination/grid are metadata only. Surveys are assumed already in the chosen north.

## Station classification

`Measured` | `Calculated` (derived from measured) | `Projected` | `Planned`

Projected/planned rows never live as measured observations.

## Persistence

- One SQLite file per project (user-chosen path) plus last-opened list in AppConfig
- UUIDs and timestamps on all entities
- Migrations; transactions; autosave of dirty survey edits
- No cloud

## Visualization

Plotly.js bundled locally (MIT). Views consume `delve-core` results; they do not recompute trajectory math.

## Future (not built)

Optional sync Field SQLite → cloud → Office web. Enabled by UUIDs, migrations, and a pure core — not by a sync framework.
