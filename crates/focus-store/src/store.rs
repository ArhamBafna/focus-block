use crate::error::StoreError;
use crate::migrations::{SCHEMA, SEED_PRESETS};
use chrono::{DateTime, Utc};
use focus_core::protocol::DomainEntry;
use focus_core::{
    normalize_domain, AppBlockEntry, AppBlockTarget, Preset, Session, SessionMode, SessionStatus,
};
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub struct FocusStore {
    conn: Connection,
    path: PathBuf,
}

impl FocusStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StoreError> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path.as_ref())?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        let store = Self {
            conn,
            path: path.as_ref().to_path_buf(),
        };
        store.migrate()?;
        Ok(store)
    }

    pub fn default_path() -> PathBuf {
        PathBuf::from(std::env::var("PROGRAMDATA").unwrap_or_else(|_| "C:\\ProgramData".into()))
            .join("FocusBlock")
            .join("data.db")
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    fn migrate(&self) -> Result<(), StoreError> {
        self.conn.execute_batch(SCHEMA)?;
        self.add_sessions_app_target_snapshot_column()?;

        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM presets", [], |r| r.get(0))?;
        if count == 0 {
            for (name, mode, duration, blocklist) in SEED_PRESETS {
                let id = Uuid::new_v4();
                self.conn.execute(
                    "INSERT INTO presets (id, name, mode, duration_minutes, blocklist_json) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![id.to_string(), name, mode, duration, blocklist],
                )?;
            }
        }

        self.set_default_setting("os_allowlist_enabled", "true")?;
        Ok(())
    }

    fn set_default_setting(&self, key: &str, value: &str) -> Result<(), StoreError> {
        self.conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting_bool(&self, key: &str) -> Result<bool, StoreError> {
        let value: String = self
            .conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |r| r.get(0),
            )
            .unwrap_or_else(|_| "false".into());
        Ok(value == "true")
    }

    pub fn get_setting_u64(&self, key: &str) -> Result<u64, StoreError> {
        let value: String = self
            .conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |r| r.get(0),
            )
            .unwrap_or_else(|_| "0".into());
        Ok(value.parse().unwrap_or(0))
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), StoreError> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn list_blocklist(&self) -> Result<Vec<DomainEntry>, StoreError> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, domain FROM blocklist_domains ORDER BY domain")?;
        let rows = stmt.query_map([], |row| {
            Ok(DomainEntry {
                id: row.get(0)?,
                domain: row.get(1)?,
            })
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    pub fn add_blocklist(&self, domain: &str) -> Result<i64, StoreError> {
        let domain = normalize_domain(domain).ok_or_else(|| StoreError::Message("invalid domain".into()))?;
        self.conn.execute(
            "INSERT OR IGNORE INTO blocklist_domains (domain) VALUES (?1)",
            params![domain],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn remove_blocklist(&self, id: i64) -> Result<(), StoreError> {
        self.conn.execute("DELETE FROM blocklist_domains WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_app_block_targets(&self) -> Result<Vec<AppBlockEntry>, StoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, target_kind, target_value FROM app_block_targets ORDER BY id",
        )?;
        let rows = stmt.query_map([], |row| {
            let id: i64 = row.get(0)?;
            let kind: String = row.get(1)?;
            let value: String = row.get(2)?;
            let target = AppBlockTarget::from_storage(&kind, value).map_err(|message| {
                rusqlite::Error::FromSqlConversionFailure(
                    1,
                    rusqlite::types::Type::Text,
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, message)),
                )
            })?;
            Ok(AppBlockEntry { id, target })
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    pub fn app_block_targets(&self) -> Result<Vec<AppBlockTarget>, StoreError> {
        Ok(self
            .list_app_block_targets()?
            .into_iter()
            .map(|entry| entry.target)
            .collect())
    }

    pub fn add_app_block_target(&self, target: &AppBlockTarget) -> Result<i64, StoreError> {
        let target = target.normalized().map_err(StoreError::Message)?;
        let (kind, value) = target.storage_parts();
        self.conn.execute(
            "INSERT OR IGNORE INTO app_block_targets (target_kind, target_value) VALUES (?1, ?2)",
            params![kind, value],
        )?;

        self.conn.query_row(
            "SELECT id FROM app_block_targets WHERE target_kind = ?1 AND target_value = ?2",
            params![kind, value],
            |row| row.get(0),
        ).map_err(StoreError::from)
    }

    pub fn remove_app_block_target(&self, id: i64) -> Result<(), StoreError> {
        self.conn
            .execute("DELETE FROM app_block_targets WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_whitelist(&self) -> Result<Vec<DomainEntry>, StoreError> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, domain FROM whitelist_domains ORDER BY domain")?;
        let rows = stmt.query_map([], |row| {
            Ok(DomainEntry {
                id: row.get(0)?,
                domain: row.get(1)?,
            })
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    pub fn add_whitelist(&self, domain: &str) -> Result<i64, StoreError> {
        let domain = normalize_domain(domain).ok_or_else(|| StoreError::Message("invalid domain".into()))?;
        self.conn.execute(
            "INSERT OR IGNORE INTO whitelist_domains (domain) VALUES (?1)",
            params![domain],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn remove_whitelist(&self, id: i64) -> Result<(), StoreError> {
        self.conn.execute("DELETE FROM whitelist_domains WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn blocklist_domains(&self) -> Result<Vec<String>, StoreError> {
        Ok(self
            .list_blocklist()?
            .into_iter()
            .map(|d| d.domain)
            .collect())
    }

    pub fn whitelist_domains(&self) -> Result<Vec<String>, StoreError> {
        Ok(self
            .list_whitelist()?
            .into_iter()
            .map(|d| d.domain)
            .collect())
    }

    pub fn list_presets(&self) -> Result<Vec<Preset>, StoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, mode, duration_minutes, blocklist_json, whitelist_json FROM presets ORDER BY name",
        )?;
        let rows = stmt.query_map([], |row| {
            let mode_str: String = row.get(2)?;
            let mode = match mode_str.as_str() {
                "lockdown" => SessionMode::Lockdown,
                _ => SessionMode::Blocklist,
            };
            let blocklist: Vec<String> = serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default();
            let whitelist: Vec<String> = serde_json::from_str(&row.get::<_, String>(5)?).unwrap_or_default();
            Ok(Preset {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::new_v4()),
                name: row.get(1)?,
                mode,
                duration_minutes: row.get(3)?,
                blocklist,
                whitelist,
            })
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    pub fn create_preset(
        &self,
        name: &str,
        mode: SessionMode,
        duration_minutes: u32,
        blocklist: Vec<String>,
        whitelist: Vec<String>,
    ) -> Result<Preset, StoreError> {
        let preset = Preset {
            id: Uuid::new_v4(),
            name: name.to_string(),
            mode,
            duration_minutes,
            blocklist: blocklist.clone(),
            whitelist: whitelist.clone(),
        };
        let mode_str = match mode {
            SessionMode::Blocklist => "blocklist",
            SessionMode::Lockdown => "lockdown",
        };
        self.conn.execute(
            "INSERT INTO presets (id, name, mode, duration_minutes, blocklist_json, whitelist_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                preset.id.to_string(),
                preset.name,
                mode_str,
                preset.duration_minutes,
                serde_json::to_string(&blocklist)?,
                serde_json::to_string(&whitelist)?,
            ],
        )?;
        Ok(preset)
    }

    pub fn delete_preset(&self, id: Uuid) -> Result<(), StoreError> {
        self.conn
            .execute("DELETE FROM presets WHERE id = ?1", params![id.to_string()])?;
        Ok(())
    }

    pub fn get_preset(&self, id: Uuid) -> Result<Option<Preset>, StoreError> {
        Ok(self
            .list_presets()?
            .into_iter()
            .find(|p| p.id == id))
    }

    pub fn save_session(&self, session: &Session) -> Result<(), StoreError> {
        let mode_str = match session.mode {
            SessionMode::Blocklist => "blocklist",
            SessionMode::Lockdown => "lockdown",
        };
        let status_str = match session.status {
            SessionStatus::Active => "active",
            SessionStatus::Completed => "completed",
            SessionStatus::Stopped => "stopped",
        };
        self.conn.execute(
            "INSERT OR REPLACE INTO sessions (id, preset_id, mode, started_at, ended_at, planned_duration_sec, status, blocklist_snapshot, whitelist_snapshot, app_block_targets_snapshot) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                session.id.to_string(),
                session.preset_id.map(|id| id.to_string()),
                mode_str,
                session.started_at.to_rfc3339(),
                session.ended_at.map(|t| t.to_rfc3339()),
                session.planned_duration_sec,
                status_str,
                serde_json::to_string(&session.blocklist_snapshot)?,
                serde_json::to_string(&session.whitelist_snapshot)?,
                serde_json::to_string(&session.app_block_targets_snapshot)?,
            ],
        )?;
        Ok(())
    }

    pub fn get_active_session(&self) -> Result<Option<Session>, StoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, preset_id, mode, started_at, ended_at, planned_duration_sec, status, blocklist_snapshot, whitelist_snapshot, app_block_targets_snapshot FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1",
        )?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row_to_session(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn list_history(&self, limit: u32) -> Result<Vec<Session>, StoreError> {
        let mut stmt = self.conn.prepare(&format!(
            "SELECT id, preset_id, mode, started_at, ended_at, planned_duration_sec, status, blocklist_snapshot, whitelist_snapshot, app_block_targets_snapshot FROM sessions WHERE status != 'active' ORDER BY started_at DESC LIMIT {}",
            limit
        ))?;
        let rows = stmt.query_map([], row_to_session)?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    pub fn clear_history(&self) -> Result<(), StoreError> {
        self.conn.execute("DELETE FROM sessions WHERE status != 'active'", [])?;
        Ok(())
    }

    /// Existing installations predate app blocking. SQLite's `CREATE TABLE IF
    /// NOT EXISTS` does not add new columns, so make that upgrade explicit and
    /// idempotent before any session is read or written.
    fn add_sessions_app_target_snapshot_column(&self) -> Result<(), StoreError> {
        let mut stmt = self.conn.prepare("PRAGMA table_info(sessions)")?;
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;

        if !columns.iter().any(|column| column == "app_block_targets_snapshot") {
            self.conn.execute_batch(
                "ALTER TABLE sessions ADD COLUMN app_block_targets_snapshot TEXT NOT NULL DEFAULT '[]';",
            )?;
        }
        Ok(())
    }

}

fn row_to_session(row: &rusqlite::Row<'_>) -> Result<Session, rusqlite::Error> {
    let mode_str: String = row.get(2)?;
    let mode = match mode_str.as_str() {
        "lockdown" => SessionMode::Lockdown,
        _ => SessionMode::Blocklist,
    };
    let status_str: String = row.get(6)?;
    let status = match status_str.as_str() {
        "completed" => SessionStatus::Completed,
        "stopped" => SessionStatus::Stopped,
        _ => SessionStatus::Active,
    };
    let started_at: String = row.get(3)?;
    let ended_at: Option<String> = row.get(4)?;
    let blocklist: Vec<String> =
        serde_json::from_str(&row.get::<_, String>(7)?).unwrap_or_default();
    let whitelist: Vec<String> =
        serde_json::from_str(&row.get::<_, String>(8)?).unwrap_or_default();
    let app_target_snapshot: String = row.get(9)?;
    let app_block_targets: Vec<AppBlockTarget> = serde_json::from_str(&app_target_snapshot).map_err(
        |error| {
            rusqlite::Error::FromSqlConversionFailure(
                9,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        },
    )?;
    Ok(Session {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::new_v4()),
        preset_id: row
            .get::<_, Option<String>>(1)?
            .and_then(|s| Uuid::parse_str(&s).ok()),
        mode,
        started_at: DateTime::parse_from_rfc3339(&started_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        ended_at: ended_at.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .ok()
                .map(|d| d.with_timezone(&Utc))
        }),
        planned_duration_sec: row.get(5)?,
        status,
        blocklist_snapshot: blocklist,
        whitelist_snapshot: whitelist,
        app_block_targets_snapshot: app_block_targets,
    })
}
