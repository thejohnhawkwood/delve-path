# Open questions

Do not encode “most likely” answers.

| ID | Question | Class | MVP impact |
|---|---|---|---|
| Q-BRETT-CONV | What convention/units/north does Brett use? | Brett clarification | MVP ships oilfield-from-vertical + explicit flags. His data stays untyped until answered. |
| Q-MINE-WS | WinSERVE mining 90°/0°: stored vs displayed? | **Sourced (WSdoc p.40): report-only transposition.** Plots/INC>90/azimuth still OPEN | No mining mode in MVP. |
| Q-MINE-SIGN | Complete mining sign/dip conversion (Micromine −90 down, etc.) | BLOCKER | No mining import fixture. |
| Q-VS-WS | Is VS = N cos θ + E sin θ exactly WinSERVE? | research | WSdoc names VSP, not the equation. Industry formula; golden-tested. |
| Q-BIT | WinSERVE BHL “trend of last two” algebra | research | WSdoc names it only. MVP bit projection is **Straight Line** (hold I/A), which WSdoc p.54 does define. |
| Q-CLUSTER | Cluster “true positional average” algebra | research | Workflow sourced (2–8 shots). Formula not given. |
| Q-NORTH | Default north (ebook grid vs AER TRUE) | Brett / domain | Stored as enum; no auto-convert. |
| Q-WSDOC | WSdoc inaccessible | **Resolved 2026-08-13** — local `research/winserve/164952996-WSdoc.pdf` | Notes: `research/winserve/WSDOC_NOTES.md`. Still no RF/VS/BHL algebra. |
| Q-WEBVIEW | Fixed WebView2 runtime phone-home | post-MVP QA | Prefer offlineInstaller; air-gap still required. |
| Q-KOP-INTERP | DSR wants an interpolated min-curvature station at kick-off MD (second station of the sidetrack). This increment uses the **selected measured station** only. | research / later increment | No arbitrary-MD interpolation solver added. |
| Q-WS-APPEND | WinSERVE sidetrack definitive list = copy/append parent curve below KOP. DSR files the sidetrack from KOP. Overlay vs append? | product | Overlay implemented; append not implemented. |
| Q-ML-GOLDEN | Public dual-lateral as-drilled station table (both legs) for a named well. Gobbler Federal 4-26-35MLH (NDIC 32276) is named; ND well-file session was 401. | research | Do not invent as-drilled numbers. |
