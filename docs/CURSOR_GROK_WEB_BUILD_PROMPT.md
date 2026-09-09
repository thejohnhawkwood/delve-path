# Build DelvePath Web as a Mithril Consulting Proof-of-Work Site

You are the senior implementation agent responsible for turning the existing DelvePath desktop prototype into a polished, fully functional public browser demo under the Mithril Consulting brand.

This is an implementation task, not a brainstorming exercise. Inspect the actual repositories, make a short execution plan, then build and verify the result. Continue autonomously through safe local work. Do not stop after scaffolding or a design mockup.

## Repositories

- DelvePath application: `C:\Users\Papa\Desktop\delve-path`
- Mithril Consulting website: `C:\Users\Papa\Desktop\mithril-consulting`

The DelvePath repository is the main implementation workspace. Touch the Mithril repository only for the smallest necessary navigation/integration change.

## Product owner and attribution

- Creator: **Philip Bird**
- Business: **Mithril Consulting**
- Required public credit: **Created by Philip Bird — Mithril Consulting**
- Public positioning: an independently developed engineering prototype and proof of work

Do not mention Brett Farr, failed follow-up, absence of a contract, or any private relationship on the public website, in public documentation, metadata, sample data, or release copy. Preserve relevant private records, but make the public product about the quality and provenance of the work.

## Read before editing

Read these files completely and treat them as source material:

### DelvePath

- `README.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/CALCULATION_SPEC.md`
- `docs/MVP_ACCEPTANCE.md`
- `docs/TEST_PLAN.md`
- `docs/OFFLINE_REQUIREMENTS.md`
- `src/App.tsx`
- `src/api.ts`
- `src/domain.ts`
- `src/Charts.tsx`
- `src/styles.css`
- `crates/delve-core/src/lib.rs`
- `crates/delve-core/src/min_curvature.rs`
- `crates/delve-core/src/validate.rs`
- `crates/delve-storage/src/lib.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`

### Mithril Consulting

- `AGENTS.md`
- `package.json`
- `src/data/site.ts`
- `src/components/layout/Header.astro`
- `src/components/layout/Footer.astro`
- `src/styles/global.css`
- `netlify.toml`

Also inspect the supplied DelvePath brand assets:

- `C:\Users\Papa\Desktop\delve-path\assets\web`
- `C:\Users\Papa\Desktop\delve-path\scripts\generate_wordmark.py`
- `C:\Users\Papa\Desktop\delve-path\scripts\generate_icons.py`

The icon and stone-stroke wordmark are original, code-generated artwork and should anchor the DelvePath identity. Do not replace them with generic SaaS branding.

## First: protect the user's work

Before editing either repository:

1. Run `git status --short --branch` in both repositories.
2. Treat all existing modifications and untracked files as user-owned.
3. Do not reset, discard, overwrite, relocate, or clean unrelated work.
4. The Mithril worktree is materially dirty. Keep its edit surface minimal and do not reformat unrelated files.
5. The DelvePath `assets/` directory and `scripts/generate_wordmark.py` are intentional untracked work. Preserve and use them.
6. Do not rewrite Git history, change repository visibility, push, deploy, upload files, alter DNS, or modify Google Drive permissions without explicit user approval.

## Target outcome

Build a public, static, local-first DelvePath website suitable for:

- `https://delvepath.mithrilconsulting.io`

Add a **DelvePath** item to the existing Mithril navigation that links directly to that site in the same tab. The DelvePath site must link back to Mithril Consulting and its contact page.

Do not use an iframe. The Mithril site currently sends `X-Frame-Options: DENY`, and DelvePath should own a full browser viewport anyway.

The completed browser experience must be a real demo, not a screenshot or disabled shell. A visitor must be able to:

1. Load the Oregon public-data example.
2. Load and switch between the synthetic parent/dual-lateral example.
3. Enter, edit, paste, import, copy, and delete MD/INC/AZI survey rows.
4. Calculate TVD, North, East, vertical section, closure, dogleg, and DLS.
5. Use Plan, Profile, and interactive 3-D views.
6. Select survey stations from the plots and grid.
7. Create and edit targets and see numeric deltas.
8. Branch a lateral from a selected measured station.
9. Use MD, TVD, and bit-to-sensor straight-line projections, visibly marked `PROJECTED`.
10. Export calculated CSV and print the survey report.
11. Save work locally in the browser and reopen it after a refresh.
12. Export and import a browser project snapshot.
13. Reset local demo data safely.
14. Reach the source, license, Mithril Consulting, contact page, and Windows download folder.

## Non-negotiable safety language

Keep a prominent, readable notice in the application and reports:

> Engineering prototype / evaluation software — not certified. Not regulator-approved. Not for collision avoidance, well control, or steering decisions.

Continue to describe the method as Minimum Curvature based on ISCWSA references. Do not claim bit-identical WinSERVE behavior, regulatory approval, certification, field validation, or suitability for safety-critical decisions.

## Architecture decision: one calculation engine

The current Vite build is only a browser shell because `src/App.tsx` exits calculation when Tauri is absent and `src/api.ts` routes calculation and persistence through Tauri IPC.

Fix this by sharing the Rust calculation engine with the browser through WebAssembly.

### Required architecture

1. Add a thin WebAssembly crate, preferably `crates/delve-wasm`.
2. Use `wasm-bindgen` and `serde-wasm-bindgen` or an equivalently small, well-supported bridge.
3. Expose browser-callable versions of:
   - trajectory calculation
   - survey validation
   - tangent continuation by added MD
   - tangent continuation to TVD
   - bit-to-sensor tangent projection
4. Keep `delve-core` pure. It must not know about Tauri, React, IndexedDB, or browser globals.
5. Create typed frontend interfaces for:
   - calculation service
   - project repository
   - file/import/export operations where platform behavior differs
6. Provide two adapters:
   - Tauri/native adapter using the existing commands and SQLite storage
   - browser adapter using WASM, IndexedDB, and browser file APIs
7. Select the adapter at runtime without scattering `isTauri()` branches throughout the UI.

Do **not** port the Minimum Curvature algorithm into a second TypeScript implementation unless WASM proves genuinely impossible. If a TypeScript fallback becomes necessary, stop, document the blocker with evidence, and obtain user approval before creating duplicated numerical logic.

## Preserve the desktop application

The existing Tauri/Windows application must continue working.

- Keep native `.delvepath` SQLite files and migrations unchanged unless a real defect requires a compatible migration.
- Preserve native New/Open dialogs and autosave.
- Preserve the offline/no-CDN desktop behavior.
- Do not pretend browser project files are SQLite-compatible.
- Run native Rust, storage, UI, and desktop build checks after refactoring.

## Browser persistence

Implement a local browser repository using IndexedDB.

Requirements:

- Match the logical project, hole, station, target, parent-hole, branch-MD, color, and tie-in model.
- Preserve two-second autosave behavior where practical.
- Include an explicit schema version and migration path.
- Make browser privacy clear: project data stays on the device and is not uploaded.
- Provide a small project chooser for locally saved browser projects.
- Provide project rename/delete with confirmation.
- Export/import a documented JSON snapshot such as `project-name.delvepath.json`.
- Validate imported JSON before replacing or adding local state.
- Retain current CSV import/export.
- Do not market `.delvepath.json` as compatible with desktop SQLite `.delvepath` files.

Do not add a backend, authentication, cloud database, telemetry, analytics, update checker, license server, or runtime API dependency.

## Website and interaction design

Build a distinctive DelvePath experience that still feels connected to Mithril Consulting.

### Visual direction

- Use the supplied DelvePath icon and lockup.
- Use graphite/charcoal surfaces, ivory text, steel neutrals, and restrained amber/gold path accents.
- Keep body/interface typography highly legible and technical.
- Do not turn the supplied medieval/stone visual language into hard-to-read body text.
- Avoid generic SaaS gradients, glassmorphism, cartoon imagery, fake dashboards, excessive animation, and AI-generated filler copy.
- Use motion only where it communicates state; respect `prefers-reduced-motion`.

### Public page structure

Create a polished shell around the actual workspace:

1. **Header**
   - DelvePath lockup
   - `Live Demo`
   - `Windows Download`
   - `Source`
   - `Mithril Consulting`
2. **Hero / orientation**
   - concise value proposition
   - `Open the live demo` anchor/action
   - Windows download action
   - visible prototype warning
3. **Guided demo**
   - retain and improve `Start Here`
   - Oregon example
   - synthetic dual-lateral example
4. **Full application workspace**
   - all current functional panels and views
5. **Trust / proof section**
   - what the application demonstrates
   - calculation method
   - current automated-test evidence
   - local-first privacy statement
   - source and license links
6. **Attribution / footer**
   - `Created by Philip Bird — Mithril Consulting`
   - Apache-2.0 and notices link
   - safety disclaimer
   - Mithril contact link

The marketing shell must work well on phones. The engineering workspace should be strong at 1366×768, usable at 1024 px, and degrade honestly on narrow screens through stacking, horizontal table scrolling, and readable controls rather than tiny text.

Ensure keyboard navigation, visible focus, proper labels, sufficient contrast, semantic headings, accessible buttons, reduced motion, and useful non-chart data alongside Plotly visualizations.

## Performance and static hosting

- Keep the site deployable as static files on Netlify.
- Add an appropriate DelvePath `netlify.toml` or documented equivalent.
- Build for the root of `delvepath.mithrilconsulting.io`; do not assume `/` assets if a configurable base is easy to support.
- Lazy-load Plotly and the heavy workspace so the marketing/orientation content appears promptly.
- Keep all normal runtime assets local. No CDN fonts, remote scripts, or remote icons.
- Cache hashed assets aggressively while keeping HTML revalidatable.
- Test the real production bundle and report compressed and uncompressed sizes.
- Plotly may require a CSP allowance. Do not weaken security headers blindly; document and test the smallest policy that works for Plotly and WASM.
- Do not add analytics unless the user separately authorizes it.

## Windows download link

The site must support one centrally configured Google Drive folder URL.

Search the repositories for an existing approved URL. If none exists:

- Add one clearly named configuration value such as `VITE_DESKTOP_DOWNLOAD_URL`.
- Document it in `.env.example` without inserting a fake public URL.
- Keep the production download action hidden or clearly disabled when the value is absent.
- Report the missing URL as a final release blocker.

When configured, open the exact Google Drive folder share URL with safe external-link attributes. Do not invent or transform it into an undocumented direct-download URL.

Near the download action, support metadata for:

- current desktop version
- installer filename
- file size
- release date
- SHA-256
- supported Windows versions
- GitHub Release/source-tag mirror

Never embed or redistribute the installer inside the website repository unless the user explicitly requests it.

## Open-source and attribution package

Prepare the software for a permissive, commercially usable public release under **Apache License 2.0**.

At the repository root, add and wire up:

- `LICENSE` — exact, unmodified Apache-2.0 text
- `NOTICE`
- `AUTHORS.md`
- `PROVENANCE.md`
- `TRADEMARKS.md`
- `THIRD_PARTY_NOTICES.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CITATION.cff`

Use the exact public credit:

> Created by Philip Bird — Mithril Consulting

Use a conservative preliminary copyright line:

> Copyright © 2026 Philip Bird, Mithril Consulting.

Flag the legal-owner wording for confirmation before public release if the repository does not establish whether Mithril Consulting is a trade name or incorporated entity.

Update relevant package metadata from `LicenseRef-Proprietary` or missing values to `Apache-2.0`. Keeping the npm package `private: true` is acceptable to prevent accidental registry publication.

Apache-2.0 permits commercial use. Do not add a non-commercial restriction, field-of-use restriction, anti-competitor clause, Commons Clause, mandatory main-screen attribution clause, or any custom term while calling the result Apache-2.0/open source.

Reserve the official identity separately:

- `DelvePath` and the official logo/wordmark remain Philip Bird / Mithril Consulting marks.
- Forks may accurately say “based on DelvePath.”
- Forks may not imply endorsement or present themselves as an official Mithril Consulting release.
- Use `™`, not `®`, unless the user confirms registration.

Expose the license, NOTICE, attribution, and third-party notices through an in-app About/Licenses view and include them with desktop release artifacts.

## Fonts and third-party assets

The TTF files under `assets/web/fonts` report SIL Open Font License 1.1 metadata, but no license files are currently beside them.

- Prefer the original generated lockup and ordinary UI fonts over shipping all seven display fonts.
- Ship only fonts actually used.
- For each shipped font, verify the exact copyright and license metadata and include the OFL text and required notices.
- Do not imply that OFL fonts are relicensed under Apache-2.0.
- Generate a reviewed third-party notice inventory from both lockfiles.
- Add an SPDX SBOM generation/check step suitable for CI.

## Public-repository hygiene

The current private repository contains third-party research material that must not automatically become public.

Treat these as private unless explicit redistribution permission is documented:

- competitor manuals
- ISCWSA and other standards PDFs
- regulatory/source PDFs
- DOCX/XLSX files
- OCR or rendered reproductions
- private correspondence
- Brett-specific research notes

Do not delete or rewrite this material during the website build. Instead:

1. Ensure none of it is copied into the web bundle.
2. Create a precise public-release manifest/checklist describing what is safe to export.
3. Prefer URLs, citations, hashes, original analysis, small factual fixtures, and synthetic examples.
4. Keep the untouched original repository/archive private as provenance evidence.
5. Do not make the repository public or run history-filtering tools without explicit user approval and a verified backup.

## Provenance and proof of work

Strengthen the authorship trail without making legal claims the repository cannot prove:

- `AUTHORS.md` names Philip Bird explicitly.
- `PROVENANCE.md` describes the original private development history and the sanitized public export.
- Preserve existing commits and dates.
- Use consistent real-name author metadata for new commits, but do not rewrite old commits.
- Prepare signed annotated release-tag instructions.
- Prepare SHA-256 generation for web and Windows artifacts.
- Prepare CI artifact attestations tied to the source commit.
- Put the commit SHA and application version in an unobtrusive About/Build information view.

Do not claim that Git history alone conclusively settles ownership. It is supporting provenance evidence.

## Mithril Consulting integration

The Mithril site is proprietary and has unrelated in-progress work. Keep the licensing boundary clear.

Make only the minimum required site change:

- Add `{ label: 'DelvePath', href: 'https://delvepath.mithrilconsulting.io' }` or the equivalent typed external-nav entry to the single canonical navigation data source.
- Confirm desktop and mobile navigation render it correctly.
- Check whether seven links plus the CTA crowd the 1024–1200 px header. Adjust navigation spacing/breakpoint only if needed and only in the smallest relevant styles/components.
- Do not rework current project/home content, invoices, business files, proof assets, email configuration, or unrelated branding.
- Do not change the Mithril repository license.

The DelvePath repository/site carries Apache-2.0. The Mithril marketing repository remains proprietary.

## Automated tests and quality gates

Preserve all existing tests and add coverage for the web platform.

At minimum, add and run:

### Numerical parity

- Rust native tests against every current golden and synthetic fixture.
- WASM/browser tests against the same fixtures and locked tolerances.
- Explicit checks for vertical, due north/east, azimuth wrap, near-zero dogleg, unit equivalence, tie-in, decreasing/duplicate MD, and high-angle examples.

### Persistence

- IndexedDB create/save/reload/delete.
- Multi-hole, sidetrack, target, color, tie-in, and projected-state behavior.
- JSON snapshot round-trip.
- Invalid/corrupt JSON rejection without data loss.
- IndexedDB schema migration coverage.

### UI/browser

- Oregon demo calculates and renders.
- Synthetic dual-lateral demo switches holes and overlays both paths.
- Editing a station updates position and plots.
- Target delta and projection flows work.
- CSV import/export and browser project export work.
- Reset requires confirmation and leaves the built-in demos available.
- Download/source/Mithril links use correct URLs and safe attributes.
- Safety and attribution text are present.

Use Playwright or the repository's best-fitting browser test tool for a small, high-value production smoke suite. Do not add brittle pixel-perfect tests for incidental styling.

### Accessibility and responsive review

- Keyboard-only core workflow.
- Visible focus and correct tab order.
- Form labels and button names.
- Automated accessibility scan with documented manual checks.
- 390 px marketing page.
- 1024 px workspace.
- 1366×768 target field-laptop layout.
- Current Chrome, Edge, Firefox, and Safari behavior where practical.

### Required command-level verification

Run the applicable final commands and report exact results:

```powershell
npm run test-ui
npm run test-core
npm run test-golden
cargo test -p delve-storage
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
npm run build
```

Add and run the new WASM, browser, E2E, license, and SBOM scripts you introduce. Also run `npm run build` in the Mithril repository after the minimal navigation change.

If a command cannot run, investigate and provide the actual blocker. Do not silently skip a gate or say “should pass.”

## Definition of done

Do not call the task complete until all of the following are true:

- The Oregon sample calculates in a normal browser without Tauri.
- The synthetic dual-lateral workflow calculates and overlays correctly.
- All current meaningful desktop functionality still works.
- Browser projects survive refresh through IndexedDB.
- Browser JSON import/export is documented, validated, and tested.
- Desktop SQLite project behavior remains intact.
- Plan, Profile, and 3-D are functional and responsive.
- Projections remain visibly and semantically distinct from measurements.
- The public demo clearly explains its evaluation/safety status.
- The supplied DelvePath branding is integrated professionally.
- The official credit reads `Created by Philip Bird — Mithril Consulting`.
- Apache-2.0, NOTICE, trademark boundary, provenance, security, citation, third-party notices, and SBOM support are present.
- No restricted research or private material enters the web bundle.
- The Google Drive URL is centrally configurable and never faked.
- The Mithril nav includes DelvePath without disturbing unrelated work.
- Production builds and tests pass with recorded results.
- Deployment, DNS, Google Drive, repository-visibility, and code-signing actions still requiring user authority are listed separately.

## Working style

- Lead with evidence from the codebase.
- Make small, coherent changes and verify after each architectural layer.
- Prefer adapting the mature existing UI over rewriting it.
- Keep the Rust core authoritative.
- Avoid broad dependency churn.
- Avoid speculative features outside this brief.
- Document non-obvious platform decisions close to the code.
- Provide concise progress updates during long work.
- If an assumption does not materially change the product, choose the safest reasonable default and continue.
- Ask the user only when a missing choice would materially alter ownership, public release, deployment, or external state.

## Final handoff format

At completion, report:

1. The outcome a visitor now experiences.
2. The architecture implemented.
3. Important files added or changed, grouped by repository.
4. Exact test/build commands and pass counts.
5. Bundle/performance results.
6. Licensing, asset, and public-release clearance status.
7. Any remaining blockers requiring the user, especially:
   - Google Drive folder URL
   - final legal-owner wording
   - Netlify site creation/deployment
   - DNS for `delvepath.mithrilconsulting.io`
   - public repository creation/visibility
   - Windows code-signing certificate/service
8. A short manual launch checklist in the correct order.

Build this as something Philip Bird can confidently send to a prospect as both a working technical demonstration and a credible record of Mithril Consulting's engineering capability.
