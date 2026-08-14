# Offline requirements

The installed program must work with networking disabled. No Internet, Wi-Fi, Starlink, cloud auth, APIs, CDNs, update servers, or licence servers.

## Runtime must contain

All JS, CSS, fonts, icons, Plotly, WASM/Rust binary, SQLite, in-app help needed for normal use.

## Forbidden in production runtime

CDN, analytics, telemetry, API ping, Google Fonts, remote icons, update check, remote licence check, `remote.urls` Tauri capabilities, `frontendDist` as an https URL.

CSP: `default-src 'self'`; `connect-src` IPC only.

Plotly.js (bundled locally) requires `'unsafe-eval'` on `script-src` for its plot engine. That is a **local** script allowance, not a network exception. Do not add CDN hosts to make Plotly work.

## Packaging

Tauri Windows: `webviewInstallMode.offlineInstaller` unless a fixed runtime is later justified.

User data in AppData / user-chosen project file. Not `$RESOURCE`.

## Air-gap test

See `docs/MVP_ACCEPTANCE.md` and `docs/TEST_PLAN.md`. Scan built assets for accidental `https://` fetches (docs URLs in markdown are fine; runtime must not contact them).
