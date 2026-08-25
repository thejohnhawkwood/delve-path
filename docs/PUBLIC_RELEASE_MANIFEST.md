# Public-release manifest

The current private repository contains third-party research that must **not**
automatically become public. Do not delete that material from the private
archive. Do not copy it into the web bundle or a public export.

Created by Philip Bird — Mithril Consulting.

## Keep private (do not export / do not ship)

Treat as private unless written redistribution permission is on file:

| Path / pattern | Why |
|---|---|
| `research/brett/` | Private correspondence and research notes |
| `research/competitors/` | Competitor manuals and extracts |
| `research/standards/` | ISCWSA and other standards PDFs |
| `research/regulatory/` | Regulatory source PDFs and extracts |
| `research/winserve/` PDFs, DOCX, OCR, rendered pages | Third-party documentation |
| `research/mining/` source documents | Third-party documentation |
| `research/**/*.pdf` | Third-party / source PDFs |
| `research/**/*.docx`, `*.xlsx` | Office originals |
| `research/**/_ocr/`, `_render/`, `_extract/` | Reproductions |
| Private emails, names of private counterparties, contract status | Not part of the public product |

The original private repository should stay private as provenance evidence.
Do not run history-filtering tools or flip visibility without an explicit
backup and owner approval.

## Safe to include in a public source export

- `src/`, `crates/`, `src-tauri/` application code (no research binaries)
- `docs/` product and engineering docs that do not embed restricted PDFs
- `LICENSE`, `NOTICE`, `AUTHORS.md`, `PROVENANCE.md`, `TRADEMARKS.md`,
  `THIRD_PARTY_NOTICES.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CITATION.cff`
- `assets/web/*.png` original generated brand marks
- `scripts/generate_wordmark.py`, `scripts/generate_icons.py`
- Synthetic and public-data **CSV fixtures** already used by tests
- `research/golden/fixtures/*.csv` and `research/golden/metadata/*.json`
  that contain numeric tables and citations, not scanned manuals
- This manifest and `docs/RELEASE.md`

## Must never enter the web bundle

`scripts/check-web-bundle.mjs` scans `dist/` after `npm run build` for:

- `brett` (case-insensitive path or filename)
- `.pdf`, `.docx`, `.xlsx` payloads
- ISCWSA ebook filenames
- competitor manual filenames

Citations and hashes in markdown are acceptable. Runtime must not fetch them.

## Public positioning

Describe DelvePath as an independently developed engineering prototype and
proof of work. Credit: **Created by Philip Bird — Mithril Consulting**.
