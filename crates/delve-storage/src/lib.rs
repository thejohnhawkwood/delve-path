//! SQLite persistence. No UI. No calculation.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("database: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("schema: {0}")]
    Schema(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub client: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoleRecord {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub unit_system: String,
    pub survey_convention: String,
    pub azimuth_reference: String,
    pub vsp_deg: f64,
    pub declination_note: String,
    pub grid_note: String,
    /// None = parent wellbore. Some = sidetrack / lateral from that hole.
    pub parent_hole_id: Option<String>,
    /// Selected measured-station MD of the parent used as kick-off (display units).
    pub branch_md: Option<f64>,
    /// Optional plot/table color (`#rrggbb`). Null = UI default (parent then lateral palette).
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StationRecord {
    pub id: String,
    pub hole_id: String,
    pub seq: i64,
    pub md: f64,
    pub inc_deg: f64,
    pub azi_deg: f64,
    pub comment: String,
    pub source: String,
    pub class: String,
    pub tvd_tie: Option<f64>,
    pub north_tie: Option<f64>,
    pub east_tie: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetRecord {
    pub id: String,
    pub hole_id: String,
    pub name: String,
    pub north: f64,
    pub east: f64,
    pub tvd: f64,
    pub horiz_tol: Option<f64>,
    pub vert_tol: Option<f64>,
    /// None = junction / standalone. Some = child of that junction.
    #[serde(default)]
    pub parent_target_id: Option<String>,
}

pub struct Store {
    conn: Connection,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self, StorageError> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
        let store = Self { conn };
        store.migrate()?;
        Ok(store)
    }

    pub fn open_memory() -> Result<Self, StorageError> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        let store = Self { conn };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<(), StorageError> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            );
            INSERT OR IGNORE INTO schema_version (version) VALUES (1);

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                client TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS holes (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                unit_system TEXT NOT NULL,
                survey_convention TEXT NOT NULL,
                azimuth_reference TEXT NOT NULL,
                vsp_deg REAL NOT NULL,
                declination_note TEXT NOT NULL DEFAULT '',
                grid_note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS stations (
                id TEXT PRIMARY KEY,
                hole_id TEXT NOT NULL REFERENCES holes(id) ON DELETE CASCADE,
                seq INTEGER NOT NULL,
                md REAL NOT NULL,
                inc_deg REAL NOT NULL,
                azi_deg REAL NOT NULL,
                comment TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL,
                class TEXT NOT NULL,
                tvd_tie REAL,
                north_tie REAL,
                east_tie REAL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS targets (
                id TEXT PRIMARY KEY,
                hole_id TEXT NOT NULL REFERENCES holes(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                north REAL NOT NULL,
                east REAL NOT NULL,
                tvd REAL NOT NULL,
                horiz_tol REAL,
                vert_tol REAL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            "#,
        )?;
        self.migrate_holes_branch_columns()?;
        self.migrate_targets_parent_column()?;
        self.migrate_holes_color_column()?;
        Ok(())
    }

    fn table_columns(&self, table: &str) -> Result<Vec<String>, StorageError> {
        let mut stmt = self.conn.prepare(&format!("PRAGMA table_info({table})"))?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(1))?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    fn migrate_holes_branch_columns(&self) -> Result<(), StorageError> {
        let cols = self.table_columns("holes")?;
        if !cols.iter().any(|c| c == "parent_hole_id") {
            self.conn
                .execute("ALTER TABLE holes ADD COLUMN parent_hole_id TEXT", [])?;
        }
        if !cols.iter().any(|c| c == "branch_md") {
            self.conn
                .execute("ALTER TABLE holes ADD COLUMN branch_md REAL", [])?;
        }
        let version: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |r| r.get(0),
        )?;
        if version < 2 {
            self.conn.execute(
                "INSERT OR IGNORE INTO schema_version (version) VALUES (2)",
                [],
            )?;
        }
        Ok(())
    }

    fn migrate_targets_parent_column(&self) -> Result<(), StorageError> {
        let cols = self.table_columns("targets")?;
        if !cols.iter().any(|c| c == "parent_target_id") {
            self.conn
                .execute("ALTER TABLE targets ADD COLUMN parent_target_id TEXT", [])?;
        }
        let version: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |r| r.get(0),
        )?;
        if version < 3 {
            self.conn.execute(
                "INSERT OR IGNORE INTO schema_version (version) VALUES (3)",
                [],
            )?;
        }
        Ok(())
    }

    fn migrate_holes_color_column(&self) -> Result<(), StorageError> {
        let cols = self.table_columns("holes")?;
        if !cols.iter().any(|c| c == "color") {
            self.conn
                .execute("ALTER TABLE holes ADD COLUMN color TEXT", [])?;
        }
        let version: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |r| r.get(0),
        )?;
        if version < 4 {
            self.conn.execute(
                "INSERT OR IGNORE INTO schema_version (version) VALUES (4)",
                [],
            )?;
        }
        Ok(())
    }

    fn hole_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<HoleRecord> {
        Ok(HoleRecord {
            id: r.get(0)?,
            project_id: r.get(1)?,
            name: r.get(2)?,
            unit_system: r.get(3)?,
            survey_convention: r.get(4)?,
            azimuth_reference: r.get(5)?,
            vsp_deg: r.get(6)?,
            declination_note: r.get(7)?,
            grid_note: r.get(8)?,
            parent_hole_id: r.get(9)?,
            branch_md: r.get(10)?,
            color: r.get(11)?,
        })
    }

    pub fn upsert_project(&self, p: &ProjectRecord) -> Result<(), StorageError> {
        self.conn.execute(
            "INSERT INTO projects (id, name, client, notes) VALUES (?1,?2,?3,?4)
             ON CONFLICT(id) DO UPDATE SET name=?2, client=?3, notes=?4, updated_at=datetime('now')",
            params![p.id, p.name, p.client, p.notes],
        )?;
        Ok(())
    }

    pub fn get_project_any(&self) -> Result<Option<ProjectRecord>, StorageError> {
        self.conn
            .query_row(
                "SELECT id, name, client, notes FROM projects ORDER BY created_at LIMIT 1",
                [],
                |r| {
                    Ok(ProjectRecord {
                        id: r.get(0)?,
                        name: r.get(1)?,
                        client: r.get(2)?,
                        notes: r.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn get_project(&self, id: &str) -> Result<Option<ProjectRecord>, StorageError> {
        self.conn
            .query_row(
                "SELECT id, name, client, notes FROM projects WHERE id=?1",
                [id],
                |r| {
                    Ok(ProjectRecord {
                        id: r.get(0)?,
                        name: r.get(1)?,
                        client: r.get(2)?,
                        notes: r.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn upsert_hole(&self, h: &HoleRecord) -> Result<(), StorageError> {
        self.conn.execute(
            "INSERT INTO holes (id, project_id, name, unit_system, survey_convention, azimuth_reference, vsp_deg, declination_note, grid_note, parent_hole_id, branch_md, color)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
             ON CONFLICT(id) DO UPDATE SET name=?3, unit_system=?4, survey_convention=?5, azimuth_reference=?6, vsp_deg=?7, declination_note=?8, grid_note=?9, parent_hole_id=?10, branch_md=?11, color=?12, updated_at=datetime('now')",
            params![h.id, h.project_id, h.name, h.unit_system, h.survey_convention, h.azimuth_reference, h.vsp_deg, h.declination_note, h.grid_note, h.parent_hole_id, h.branch_md, h.color],
        )?;
        Ok(())
    }

    pub fn list_holes(&self, project_id: &str) -> Result<Vec<HoleRecord>, StorageError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, name, unit_system, survey_convention, azimuth_reference, vsp_deg, declination_note, grid_note, parent_hole_id, branch_md, color
             FROM holes WHERE project_id=?1 ORDER BY created_at",
        )?;
        let rows = stmt.query_map([project_id], Self::hole_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_hole(&self, id: &str) -> Result<Option<HoleRecord>, StorageError> {
        self.conn
            .query_row(
                "SELECT id, project_id, name, unit_system, survey_convention, azimuth_reference, vsp_deg, declination_note, grid_note, parent_hole_id, branch_md, color FROM holes WHERE id=?1",
                [id],
                Self::hole_from_row,
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn delete_hole(&self, id: &str) -> Result<(), StorageError> {
        let kids: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM holes WHERE parent_hole_id=?1",
            [id],
            |r| r.get(0),
        )?;
        if kids > 0 {
            return Err(StorageError::Schema(
                "cannot delete parent wellbore while a sidetrack still references it".into(),
            ));
        }
        self.conn.execute("DELETE FROM holes WHERE id=?1", [id])?;
        Ok(())
    }

    pub fn replace_stations(
        &self,
        hole_id: &str,
        stations: &[StationRecord],
    ) -> Result<(), StorageError> {
        let tx = self.conn.unchecked_transaction()?;
        tx.execute("DELETE FROM stations WHERE hole_id=?1", [hole_id])?;
        for s in stations {
            tx.execute(
                "INSERT INTO stations (id, hole_id, seq, md, inc_deg, azi_deg, comment, source, class, tvd_tie, north_tie, east_tie)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                params![s.id, s.hole_id, s.seq, s.md, s.inc_deg, s.azi_deg, s.comment, s.source, s.class, s.tvd_tie, s.north_tie, s.east_tie],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn list_stations(&self, hole_id: &str) -> Result<Vec<StationRecord>, StorageError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, hole_id, seq, md, inc_deg, azi_deg, comment, source, class, tvd_tie, north_tie, east_tie
             FROM stations WHERE hole_id=?1 ORDER BY seq",
        )?;
        let rows = stmt.query_map([hole_id], |r| {
            Ok(StationRecord {
                id: r.get(0)?,
                hole_id: r.get(1)?,
                seq: r.get(2)?,
                md: r.get(3)?,
                inc_deg: r.get(4)?,
                azi_deg: r.get(5)?,
                comment: r.get(6)?,
                source: r.get(7)?,
                class: r.get(8)?,
                tvd_tie: r.get(9)?,
                north_tie: r.get(10)?,
                east_tie: r.get(11)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn upsert_target(&self, t: &TargetRecord) -> Result<(), StorageError> {
        self.conn.execute(
            "INSERT INTO targets (id, hole_id, name, north, east, tvd, horiz_tol, vert_tol, parent_target_id)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
             ON CONFLICT(id) DO UPDATE SET name=?3, north=?4, east=?5, tvd=?6, horiz_tol=?7, vert_tol=?8, parent_target_id=?9, hole_id=?2, updated_at=datetime('now')",
            params![t.id, t.hole_id, t.name, t.north, t.east, t.tvd, t.horiz_tol, t.vert_tol, t.parent_target_id],
        )?;
        Ok(())
    }

    pub fn list_targets(&self, hole_id: &str) -> Result<Vec<TargetRecord>, StorageError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, hole_id, name, north, east, tvd, horiz_tol, vert_tol, parent_target_id FROM targets WHERE hole_id=?1",
        )?;
        let rows = stmt.query_map([hole_id], |r| {
            Ok(TargetRecord {
                id: r.get(0)?,
                hole_id: r.get(1)?,
                name: r.get(2)?,
                north: r.get(3)?,
                east: r.get(4)?,
                tvd: r.get(5)?,
                horiz_tol: r.get(6)?,
                vert_tol: r.get(7)?,
                parent_target_id: r.get(8)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn delete_target(&self, id: &str) -> Result<(), StorageError> {
        // Children become standalone; do not cascade-delete laterals.
        self.conn.execute(
            "UPDATE targets SET parent_target_id = NULL WHERE parent_target_id=?1",
            [id],
        )?;
        self.conn.execute("DELETE FROM targets WHERE id=?1", [id])?;
        Ok(())
    }
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_reopen_stations() {
        let db = Store::open_memory().unwrap();
        let p = ProjectRecord {
            id: new_id(),
            name: "P".into(),
            client: "C".into(),
            notes: "".into(),
        };
        db.upsert_project(&p).unwrap();
        let h = HoleRecord {
            id: new_id(),
            project_id: p.id.clone(),
            name: "H1".into(),
            unit_system: "imperial".into(),
            survey_convention: "oilfield_from_vertical".into(),
            azimuth_reference: "unknown".into(),
            vsp_deg: 165.3,
            declination_note: "".into(),
            grid_note: "".into(),
            parent_hole_id: None,
            branch_md: None,
            color: None,
        };
        db.upsert_hole(&h).unwrap();
        let s = StationRecord {
            id: new_id(),
            hole_id: h.id.clone(),
            seq: 0,
            md: 445.0,
            inc_deg: 0.0,
            azi_deg: 0.0,
            comment: "tie".into(),
            source: "tie_in".into(),
            class: "measured".into(),
            tvd_tie: Some(445.0),
            north_tie: Some(0.0),
            east_tie: Some(0.0),
        };
        db.replace_stations(&h.id, std::slice::from_ref(&s))
            .unwrap();
        let back = db.list_stations(&h.id).unwrap();
        assert_eq!(back.len(), 1);
        assert_eq!(back[0].md, 445.0);
        assert_eq!(back[0].tvd_tie, Some(445.0));
    }

    #[test]
    fn branch_columns_roundtrip() {
        let db = Store::open_memory().unwrap();
        let cols = db.table_columns("holes").unwrap();
        assert!(cols.iter().any(|c| c == "parent_hole_id"));
        assert!(cols.iter().any(|c| c == "branch_md"));
        let p = ProjectRecord {
            id: new_id(),
            name: "P".into(),
            client: "".into(),
            notes: "".into(),
        };
        db.upsert_project(&p).unwrap();
        let parent = HoleRecord {
            id: new_id(),
            project_id: p.id.clone(),
            name: "Parent wellbore".into(),
            unit_system: "imperial".into(),
            survey_convention: "oilfield_from_vertical".into(),
            azimuth_reference: "unknown".into(),
            vsp_deg: 90.0,
            declination_note: "".into(),
            grid_note: "".into(),
            parent_hole_id: None,
            branch_md: None,
            color: None,
        };
        db.upsert_hole(&parent).unwrap();
        let lat = HoleRecord {
            id: new_id(),
            project_id: p.id.clone(),
            name: "Lateral B".into(),
            unit_system: "imperial".into(),
            survey_convention: "oilfield_from_vertical".into(),
            azimuth_reference: "unknown".into(),
            vsp_deg: 90.0,
            declination_note: "".into(),
            grid_note: "".into(),
            parent_hole_id: Some(parent.id.clone()),
            branch_md: Some(6500.0),
            color: None,
        };
        db.upsert_hole(&lat).unwrap();
        let listed = db.list_holes(&p.id).unwrap();
        assert_eq!(listed.len(), 2);
        let back = listed.iter().find(|h| h.id == lat.id).unwrap();
        assert_eq!(back.parent_hole_id.as_deref(), Some(parent.id.as_str()));
        assert_eq!(back.branch_md, Some(6500.0));
        assert!(db.delete_hole(&parent.id).is_err());
        db.delete_hole(&lat.id).unwrap();
        db.delete_hole(&parent.id).unwrap();
        assert!(db.list_holes(&p.id).unwrap().is_empty());
    }

    #[test]
    fn migrate_v1_adds_branch_columns() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
            INSERT INTO schema_version (version) VALUES (1);
            CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                client TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE holes (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                unit_system TEXT NOT NULL,
                survey_convention TEXT NOT NULL,
                azimuth_reference TEXT NOT NULL,
                vsp_deg REAL NOT NULL,
                declination_note TEXT NOT NULL DEFAULT '',
                grid_note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            "#,
        )
        .unwrap();
        let store = Store { conn };
        store.migrate().unwrap();
        let cols = store.table_columns("holes").unwrap();
        assert!(cols.iter().any(|c| c == "parent_hole_id"));
        assert!(cols.iter().any(|c| c == "branch_md"));
        assert!(cols.iter().any(|c| c == "color"));
        let tcols = store.table_columns("targets").unwrap();
        assert!(tcols.iter().any(|c| c == "parent_target_id"));
    }

    #[test]
    fn parent_target_roundtrip_and_delete_nulls_children() {
        let db = Store::open_memory().unwrap();
        let cols = db.table_columns("targets").unwrap();
        assert!(cols.iter().any(|c| c == "parent_target_id"));
        let p = ProjectRecord {
            id: new_id(),
            name: "P".into(),
            client: "".into(),
            notes: "".into(),
        };
        db.upsert_project(&p).unwrap();
        let h = HoleRecord {
            id: new_id(),
            project_id: p.id.clone(),
            name: "Parent wellbore".into(),
            unit_system: "imperial".into(),
            survey_convention: "oilfield_from_vertical".into(),
            azimuth_reference: "unknown".into(),
            vsp_deg: 90.0,
            declination_note: "".into(),
            grid_note: "".into(),
            parent_hole_id: None,
            branch_md: None,
            color: None,
        };
        db.upsert_hole(&h).unwrap();
        let junction = TargetRecord {
            id: new_id(),
            hole_id: h.id.clone(),
            name: "Junction".into(),
            north: 0.0,
            east: 0.0,
            tvd: 6500.0,
            horiz_tol: None,
            vert_tol: None,
            parent_target_id: None,
        };
        let east = TargetRecord {
            id: new_id(),
            hole_id: h.id.clone(),
            name: "East BHL".into(),
            north: 0.0,
            east: 3954.93,
            tvd: 7454.93,
            horiz_tol: None,
            vert_tol: None,
            parent_target_id: Some(junction.id.clone()),
        };
        db.upsert_target(&junction).unwrap();
        db.upsert_target(&east).unwrap();
        let listed = db.list_targets(&h.id).unwrap();
        assert_eq!(listed.len(), 2);
        let child = listed.iter().find(|t| t.id == east.id).unwrap();
        assert_eq!(
            child.parent_target_id.as_deref(),
            Some(junction.id.as_str())
        );
        db.delete_target(&junction.id).unwrap();
        let after = db.list_targets(&h.id).unwrap();
        assert_eq!(after.len(), 1);
        assert_eq!(after[0].id, east.id);
        assert_eq!(after[0].parent_target_id, None);
    }

    #[test]
    fn hole_color_roundtrip() {
        let db = Store::open_memory().unwrap();
        let cols = db.table_columns("holes").unwrap();
        assert!(cols.iter().any(|c| c == "color"));
        let p = ProjectRecord {
            id: new_id(),
            name: "P".into(),
            client: "".into(),
            notes: "".into(),
        };
        db.upsert_project(&p).unwrap();
        let h = HoleRecord {
            id: new_id(),
            project_id: p.id.clone(),
            name: "Lateral B".into(),
            unit_system: "imperial".into(),
            survey_convention: "oilfield_from_vertical".into(),
            azimuth_reference: "unknown".into(),
            vsp_deg: 90.0,
            declination_note: "".into(),
            grid_note: "".into(),
            parent_hole_id: None,
            branch_md: None,
            color: Some("#7ee0e0".into()),
        };
        db.upsert_hole(&h).unwrap();
        let back = db.get_hole(&h.id).unwrap().unwrap();
        assert_eq!(back.color.as_deref(), Some("#7ee0e0"));
        let cleared = HoleRecord {
            color: None,
            ..back
        };
        db.upsert_hole(&cleared).unwrap();
        assert_eq!(db.get_hole(&h.id).unwrap().unwrap().color, None);
    }
}
