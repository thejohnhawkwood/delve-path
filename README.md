# DelvePath

**Engineering prototype / evaluation software — not certified.**  
Not regulator-approved. Not for collision avoidance, well control, or steering decisions.

Offline Windows field app for directional borehole survey calculation and visualization (Mithril Consulting). Survey reconstruction uses **Minimum Curvature** as documented by ISCWSA. Results are **not** claimed bit-identical to WinSERVE.

## What this build does

- Local project / hole files (`*.delvepath` SQLite)
- Keyboard-first MD → INC → AZI entry, paste, and CSV import
- Oilfield inclination-from-vertical only (0° = vertical down)
- Current position, plan / profile / 3-D (Plotly, bundled locally)
- Point targets and numeric N/E/TVD deltas
- Straight Line continuation / bit projection (hold last I/A; WSdoc name), labelled **PROJECTED** (not WinSERVE BHL “trend of last two surveys”)
- CSV export and a printable report

## What it does not do

Mining-convention conversion, ISCWSA positional uncertainty, anti-collision, well-plan solvers, cloud sync, or any LLM in the calculation path. Declination / grid convergence are notes only — they are not auto-applied.

## Run (development)

Requires Rust, MSVC C++ build tools (`link.exe`), Node 20+, and WebView2.

```text
npm install
npm run tauri dev
```

Core / golden tests (no UI):

```text
npm run test-core
npm run test-golden
npm run test-ui
```

## Offline

Production config uses a local `frontendDist`, CSP without CDNs, and `webviewInstallMode.offlineInstaller`. Plotly needs `'unsafe-eval'` in CSP; that is a local-script allowance, not network access. See `docs/OFFLINE_REQUIREMENTS.md`.

Air-gap installer validation may still be **NOT YET VALIDATED** until a production bundle is built and tested with networking disabled.

## Docs

Start at `docs/PRD.md`, `docs/CALCULATION_SPEC.md`, `docs/MVP_ACCEPTANCE.md`.
