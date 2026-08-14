# Tauri v2 — offline Windows field-release notes

**Status:** architecture reference only. Do not scaffold the app in this research pass.

Official docs:

- https://v2.tauri.app/
- https://v2.tauri.app/concept/architecture/
- https://v2.tauri.app/start/create-project/
- https://v2.tauri.app/distribute/windows-installer/
- https://v2.tauri.app/plugin/sql/
- https://v2.tauri.app/plugin/file-system/
- https://v2.tauri.app/security/permissions/
- https://v2.tauri.app/security/capabilities/
- https://v2.tauri.app/security/csp/
- https://v2.tauri.app/security/asset-protocol/
- https://v2.tauri.app/develop/resources/

## Implications for DelvePath

1. **Bundle the UI.** `build.frontendDist` must be a local directory embedded in the binary. A `https://` frontendDist loads a remote URL and is incompatible with networking disabled.

2. **WebView2 install mode.** Default `downloadBootstrapper` needs internet at install time. Field release must use `offlineInstaller` (~127 MB) or `fixedRuntime` (~180 MB). `embedBootstrapper` still downloads the runtime.

3. **No remote capabilities.** Do not enable `remote.urls`. CSP should be `default-src 'self'` with `connect-src` limited to IPC. Do not pull Google Fonts or other CDNs.

4. **Local SQLite.** `@tauri-apps/plugin-sql` with the `sqlite` feature. Database path under AppConfig. Default capability is close/load/select; writes need `sql:allow-execute`.

5. **Writable data vs resources.** Per-machine MSI/NSIS install cannot write `$RESOURCE` without admin. Put survey databases in `$APPDATA` / `$APPCONFIG`. Ship read-only defaults as `bundle.resources`.

6. **Filesystem scopes.** Deny-by-default. Scope import/export to AppData plus a user-chosen project folder. Do not grant `$HOME/**`.

7. **QA item (OPEN):** install and run with networking disabled. Tauri docs cover install-time network, not a runtime phone-home test for Fixed Version WebView2.

The field MVP must install and run with networking disabled. Optional future cloud sync must not be required by this architecture.
