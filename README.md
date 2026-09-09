# DelvePath

Created by Philip Bird — Mithril Consulting.

**Engineering prototype / evaluation software — not certified.**  
Not regulator-approved. Not for collision avoidance, well control, or steering decisions.

Offline Windows evaluation app and public browser demo for minimum-curvature borehole survey reconstruction and geometric planning experiments. Results are **not** claimed bit-identical to WinSERVE.

License: **Apache-2.0**. Current evaluation build: **0.2.2** (integrated field workflow).

Public demo: [Open DelvePath](https://thejohnhawkwood.github.io/delve-path/#workspace).

## What this build does

- Local project / hole files (`*.delvepath` SQLite, schema through v5; browser snapshots v2 with v1 migration)
- Keyboard-first MD → INC → AZI entry; **Add row** / **Add 5** (hold last INC/AZI, step MD); **Undo add**; **×** to delete a row
- Copy a row (**⎘** or Ctrl+C): MD / INC / AZI / comment plus calculated N / E / TVD. Paste into the grid (appends if MD is deeper) or into the **Target** N/E/TVD fields
- Excel/tab paste and CSV import (one hole per file)
- Oilfield inclination-from-vertical only (0° = vertical down)
- Current position; Plan / Profile / 3-D (Plotly, bundled locally); wrapping HTML legend
- **Parent wellbore + sidetracks:** branch from a selected measured station; laterals are separate holes tied on at the parent’s calculated N/E/TVD; plots overlay all holes
- Workspaces: Survey, Planning, Anti-collision, Flight Deck, Targets, Centerline, Depth, Reports, EOU
- **Anti-collision lab:** layered current / uncorrected / correction / offset / uncertainty previews; 65 bounded geometric candidates; a three-hole crossing case; traceable audit export, saved runs and replay
- **Targets:** plane + circle / rotated rectangle / polygon footprints rendered as real shapes
- **Planning:** 2-D slant / S / horizontal and 3-D curve+hold constructors; editable plan table
- **Flight Deck:** accepted survey → estimated bit → selectable forecast; editing slide assumptions recalculates the visible path; export the complete comparison
- **One field workflow:** Survey → Look ahead → Uncertainty → Clearance, with a shared viewer and Explain mode for mouse and keyboard
- Centerline screening (not anti-collision), typed depth datums, offline imported EOU
- Path colors (swatch next to Hole); combined color-coded survey table; click a plot point to select that row
- Straight Line continuation / bit projection (hold last I/A), labelled **PROJECTED** (not WinSERVE BHL “trend of last two surveys”)
- Glossary tips that stay on screen; Start Here walkthrough
- Demos: Oregon 24c-23-65 (public WinSERVE); **Load dual-lateral example** (synthetic / constructed)
- CSV export and a printable report
- Browser demo: the same `delve-core` engine via WebAssembly; IndexedDB projects; `.delvepath.json` snapshots (not desktop SQLite)

## What it does not do

Mining-convention conversion, ISCWSA Rev 5 uncertainty *propagation*, operational anti-collision / SF / MASD / PoC, TAML junction hardware, live WITS, Geocertainty HTTP (import-only), cloud sync, or any LLM in the calculation path. The anti-collision lab is a conservative geometric evaluation with explicitly supplied uncertainty envelopes; it does not produce steering commands. Declination / grid convergence are notes only — they are not auto-applied. Default builds remain offline.

## Build web and Windows

Install Rust, Node 22+, and the Windows MSVC C++ build tools. Set up the WASM toolchain once:

```text
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.104 --locked
```

Run `npm ci`, `npm run build:wasm`, then `npm run build` for the web artifact in `dist/`. Run `npm run tauri -- build` for the Windows release executable and NSIS installer:

`target/release/bundle/nsis/DelvePath_0.2.2_x64-setup.exe`

The installer is unsigned evaluation software. Existing external download folders may still contain older builds; local build success does not publish a release.

Open **Anti-collision**, then **Generate drill path** to compare the constructed crossing case. Toggle layers in Plan, Profile and 3-D; use **Inspect calculation & report** for all candidate outcomes. The same controls run on desktop and web. **Export audit JSON** preserves the complete calculation for replay.

## Run (development)

Requires Rust, MSVC C++ build tools (`link.exe`), Node 22+ (Node 24 used locally), and WebView2.

```text
npm install
npm run tauri dev
```

If `cargo` is not on PATH in that shell:

```text
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npm run tauri dev
```

Browser demo (no Tauri):

```text
npm run build:wasm
npm run dev
```

Then open `http://localhost:1420/`. Set `VITE_DESKTOP_DOWNLOAD_URL` in `.env.local` to the approved Google Drive folder when you have one. See `.env.example`.

Core / golden / UI tests:

```text
npm run test-core
npm run test-golden
npm run test-ui
npm run verify:collision
npm run test-license
```

## Offline

Production config uses a local `frontendDist`, CSP without CDNs, and `webviewInstallMode.offlineInstaller`. Plotly needs `'unsafe-eval'` in CSP; that is a local-script allowance, not network access. See `docs/OFFLINE_REQUIREMENTS.md`.

## Docs

Start at `docs/PRD.md`, `docs/CALCULATION_SPEC.md`, `docs/MVP_ACCEPTANCE.md`, `docs/DEVLOG.md`.

The current review is [docs/REVIEW_2026_09_08.md](docs/REVIEW_2026_09_08.md). Research, derivation and bounds are in [docs/ANTI_COLLISION_METHOD.md](docs/ANTI_COLLISION_METHOD.md).

The 0.2.1 viewer/tab-switching correction is documented in [docs/VIEWER_FIX_0.2.1.md](docs/VIEWER_FIX_0.2.1.md).

The 0.2.2 workflow, numerical corrections and verification steps are in [docs/FIELD_WORKFLOW_0.2.2.md](docs/FIELD_WORKFLOW_0.2.2.md).
