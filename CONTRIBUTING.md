# Contributing

Created by Philip Bird — Mithril Consulting.

## License of contributions

By submitting a contribution, you agree it is licensed under the Apache
License, Version 2.0, without additional terms. Do not add field-of-use
restrictions, a Commons Clause, or a mandatory main-screen attribution clause.

## What to change

- Keep `delve-core` pure: no Tauri, no IndexedDB, no browser globals, no UI.
- Browser and desktop adapters live in `src/platform/`.
- Do not port Minimum Curvature into a second TypeScript implementation.
- Do not copy files listed as private in `docs/PUBLIC_RELEASE_MANIFEST.md`
  into the web bundle.

## Checks

```text
npm run test-ui
npm run test-core
npm run test-golden
cargo test -p delve-storage
cargo test -p delve-wasm
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
npm run build:wasm
npm run build
npm run test-license
npm run test-sbom
```

## Attribution

Keep the public credit:

> Created by Philip Bird — Mithril Consulting
