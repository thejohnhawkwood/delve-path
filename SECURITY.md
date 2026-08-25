# Security

Created by Philip Bird — Mithril Consulting.

DelvePath is local-first evaluation software. The browser demo stores project
data in IndexedDB on the visitor’s device. It does not upload surveys, and it
has no account, license server, or telemetry.

## Report a vulnerability

Email **phil@mithrilconsulting.io** with:

- a description of the issue
- affected version or commit SHA
- steps that stay within your own data and systems

Please do not open a public issue for an unfixed vulnerability.

## Scope notes

- This software is **not certified** and is **not** for collision avoidance,
  well control, or steering decisions.
- Desktop project files are local SQLite. Browser snapshots are JSON and are
  **not** compatible with desktop `*.delvepath` files.
- Do not send third-party manuals, well files you are not authorized to share,
  or personal data that is unrelated to the report.
