# DelvePath

Created by Philip Bird — Mithril Consulting.

**Engineering prototype / evaluation software — not certified.**  
Not regulator-approved. Not for collision avoidance, well control, or steering decisions.

Offline Windows field app and public browser demo for directional borehole survey calculation (Minimum Curvature / ISCWSA). Results are **not** claimed bit-identical to WinSERVE.

License: **Apache-2.0**. Current evaluation build: **0.1.1**.

Public demo (planned): `https://delvepath.mithrilconsulting.io`

## What this build does

- Local project / hole files (`*.delvepath` SQLite, schema through v4)
- Keyboard-first MD → INC → AZI entry; **Add row** / **Add 5** (hold last INC/AZI, step MD); **Undo add**; **×** to delete a row
- Copy a row (**⎘** or Ctrl+C): MD / INC / AZI / comment plus calculated N / E / TVD. Paste into the grid (appends if MD is deeper) or into the **Target** N/E/TVD fields
- Excel/tab paste and CSV import (one hole per file)
- Oilfield inclination-from-vertical only (0° = vertical down)
- Current position; Plan / Profile / 3-D (Plotly, bundled locally); wrapping HTML legend
- **Parent wellbore + sidetracks:** branch from a selected measured station; laterals are separate holes tied on at the parent’s calculated N/E/TVD; plots overlay all holes
- **Targets:** junction (parent) and child lateral targets; numeric N/E/TVD deltas
- Path colors (swatch next to Hole); combined color-coded survey table; click a plot point to select that row
- Straight Line continuation / bit projection (hold last I/A), labelled **PROJECTED** (not WinSERVE BHL “trend of last two surveys”)
- Glossary tips that stay on screen; Start Here walkthrough
- Demos: Oregon 24c-23-65 (public WinSERVE); **Load dual-lateral example** (synthetic / constructed)
- CSV export and a printable report
- Browser demo: the same `delve-core` engine via WebAssembly; IndexedDB projects; `.delvepath.json` snapshots (not desktop SQLite)

## What it does not do

Mining-convention conversion, ISCWSA positional uncertainty, anti-collision, well-plan solvers, TAML junction hardware, interpolated kick-off at an arbitrary MD (selected measured row only), cloud sync, or any LLM in the calculation path. Declination / grid convergence are notes only — they are not auto-applied.

## Frozen Windows installer

After `npm run tauri -- build`, the NSIS installer is:

`src-tauri/target/release/bundle/nsis/DelvePath_0.1.1_x64-setup.exe`

A copy for handoff may also be on the Desktop as `DelvePath-evaluation-0.1.1`. See `EVALUATION.txt` in that folder.

The evaluation window still opens with the Oregon example. Use **Load dual-lateral example** for the constructed east/west laterals.

## Run (development)

Requires Rust, MSVC C++ build tools (`link.exe`), Node 20+, and WebView2.

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
npm run test-license
```

## Offline

Production config uses a local `frontendDist`, CSP without CDNs, and `webviewInstallMode.offlineInstaller`. Plotly needs `'unsafe-eval'` in CSP; that is a local-script allowance, not network access. See `docs/OFFLINE_REQUIREMENTS.md`.

## Docs

Start at `docs/PRD.md`, `docs/CALCULATION_SPEC.md`, `docs/MVP_ACCEPTANCE.md`, `docs/DEVLOG.md`.
