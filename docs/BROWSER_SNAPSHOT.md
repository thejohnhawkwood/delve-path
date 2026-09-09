# Browser project snapshot

Format: `delvepath-browser-snapshot`  
File extension: `.delvepath.json`

This JSON file is a **browser** export of a local IndexedDB project. It is
**not** a desktop SQLite `*.delvepath` file and must not be opened as one.

## Schema (version 2)

Version 2 adds `documents[]` (plans, BHA, segments, decisions, datums, wireline, covariance) plus hole frame fields and station `review_state`. Version 1 files migrate: stations become `unreviewed`, missing frame fields default to `unspecified`, `documents` becomes `[]`. Values are not silently rewritten beyond those defaults.

Desktop `*.delvepath` SQLite is schema v5 and is not this JSON format.

## Schema (version 1)

```json
{
  "format": "delvepath-browser-snapshot",
  "formatVersion": 1,
  "notCompatibleWith": "desktop-sqlite-delvepath",
  "exportedAt": "2026-08-24T00:00:00.000Z",
  "applicationVersion": "0.1.1",
  "project": { "id": "...", "name": "...", "client": "...", "notes": "..." },
  "holes": [],
  "stations": [],
  "targets": []
}
```

Holes include `parent_hole_id`, `branch_md`, and `color`. Stations include
tie-in fields on the first measured row. Targets include `parent_target_id`.

Invalid or corrupt JSON is rejected. Existing local projects are left unchanged.


Collision audits are carried in the existing v2 `documents` collection as uniquely identified `scan` records. They preserve their original frames, units and hashes. They are not measured stations and are not implicitly converted on import. The separate `.json` audit export is self-contained and replayable in either runtime; a cross-runtime floating-point difference can change a content hash even when numerical parity is within the documented tolerance.
