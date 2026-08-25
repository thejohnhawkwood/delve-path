# Browser project snapshot

Format: `delvepath-browser-snapshot`  
File extension: `.delvepath.json`

This JSON file is a **browser** export of a local IndexedDB project. It is
**not** a desktop SQLite `*.delvepath` file and must not be opened as one.

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
