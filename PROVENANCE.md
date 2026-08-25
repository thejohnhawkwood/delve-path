# Provenance

Created by Philip Bird — Mithril Consulting.

## What this file is

A record of how DelvePath was developed and how a public export should be
understood. Git history, dates, and this document are **supporting evidence**.
They do not conclusively settle legal ownership by themselves.

## Development history

DelvePath began as a private engineering prototype: an offline Windows
application for Minimum Curvature survey reconstruction, later extended with a
browser demonstration that uses the same Rust calculation engine through
WebAssembly.

The original private repository and research archive remain the provenance
record for third-party manuals, standards PDFs, and other material that must
not be redistributed. See `docs/PUBLIC_RELEASE_MANIFEST.md`.

A public export, if one is made, should be a sanitized tree of original source,
tests, fixtures that are safe to publish, and this open-source package. It
should not rewrite historical commits.

## Public product

The public website and documentation describe DelvePath as an independently
developed engineering prototype and proof of work. They credit:

> Created by Philip Bird — Mithril Consulting

## Build identity

Release builds should record:

- application version (`package.json` / `tauri.conf.json`)
- source commit SHA
- SHA-256 of web and Windows artifacts
- CI attestations tied to that commit when GitHub Actions is used

See `docs/RELEASE.md`.
