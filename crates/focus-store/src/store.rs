use crate::codec;
use crate::error::StoreError;
use crate::migrations::{SCHEMA, SEED_PRESETS};
use chrono::{DateTime, Utc};
use focus_core::protocol::DomainEntry;
use focus_core::{normalize_domain, Preset, Session, SessionMode};
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// Every setting default is declared here and nowhere else. `migrate` seeds
/// these rows; the getters fall back to them when a row is missing.
const SETTING_DEFAULTS: &[(&str, &str)] = &[("os_allowlist_enabled", "true")];

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

        for (key, value) in SETTING_DEFAULTS {
            self.set_default_setting(key, value)?;
        }
        Ok(())
    }

    fn set_default_setting(&self, key: &str, value: &str) -> Result<(), StoreError> {
        self.conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    fn raw_setting(&self, key: &str) -> Result<Option<String>, StoreError> {
        let value = self.conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |r| r.get::<_, String>(0),
        );
        match value {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn get_setting_bool(&self, key: &str) -> Result<bool, StoreError> {
        match self.raw_setting(key)? {
            Some(value) => Ok(value == "true"),
            // Declared default wins when no row exists; real DB errors above propagate.
            None => Ok(SETTING_DEFAULTS
                .iter()
                .find(|(k, _)| *k == key)
                .map(|(_, v)| *v == "true")
                .unwrap_or(false)),
        }
    }

    /// Numeric settings have no declared defaults yet; missing rows read as 0.
    pub fn get_setting_u64(&self, key: &str) -> Result<u64, StoreError> {
        match self.raw_setting(key)? {
            Some(value) => Ok(value.parse().unwrap_or(0)),
            None => Ok(0),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), StoreError> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    // ── Domain lists ─────────────────────────────────────────────────────────
    //
    // Blocklist and whitelist share one implementation; the table is the only
    // difference between them. Public methods keep their names so callers and
    // the IPC surface are untouched.

    fn list_domains_in(&self, table: &'static str) -> Result<Vec<DomainEntry>, StoreError> {
        let mut stmt = self.conn.prepare(&format!("SELECT id, domain FROM {table} ORDER BY domain"))?;
        let mut rows = stmt.query([])?;
        let mut entries = Vec::new();
        while let Some(row) = rows.next()? {
            entries.push(DomainEntry {
                id: row.get(0)?,
                domain: row.get(1)?,
            });
        }
        Ok(entries)
    }

    fn add_domain_to(&self, table: &'static str, domain: &str) -> Result<i64, StoreError> {
        let domain =
            normalize_domain(domain).ok_or_else(|| StoreError::Message("invalid domain".into()))?;
        self.conn.execute(
            &format!("INSERT OR IGNORE INTO {table} (domain) VALUES (?1)"),
            params![domain],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    fn remove_domain_from(&self, table: &'static str, id: i64) -> Result<(), StoreError> {
        self.conn
            .execute(&format!("DELETE FROM {table} WHERE id = ?1"), params![id])?;
        Ok(())
    }

    pub fn list_blocklist(&self) -> Result<Vec<DomainEntry>, StoreError> {
        self.list_domains_in("blocklist_domains")
    }

    pub fn add_blocklist(&self, domain: &str) -> Result<i64, StoreError> {
        self.add_domain_to("blocklist_domains", domain)
    }

    pub fn remove_blocklist(&self, id: i64) -> Result<(), StoreError> {
        self.remove_domain_from("blocklist_domains", id)
    }

    pub fn list_whitelist(&self) -> Result<Vec<DomainEntry>, StoreError> {
        self.list_domains_in("whitelist_domains")
    }

    pub fn add_whitelist(&self, domain: &str) -> Result<i64, StoreError> {
        self.add_domain_to("whitelist_domains", domain)
    }

    pub fn remove_whitelist(&self, id: i64) -> Result<(), StoreError> {
        self.remove_domain_from("whitelist_domains", id)
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
        let mut rows = stmt.query([])?;
        let mut presets = Vec::new();
        while let Some(row) = rows.next()? {
            let id_raw: String = row.get(0)?;
            let id = match codec::parse_id(&id_raw) {
                Ok(id) => id,
                Err(_) => {
                    // Skip the broken row, keep the rest of the list usable.
                    tracing::warn!(id = %id_raw, "preset row has corrupt id, skipping it");
                    continue;
                }
            };
            let mode = codec::parse_mode(&row.get::<_, String>(2)?);
            let blocklist = codec::parse_domain_list(&row.get::<_, String>(4)?);
            let whitelist = codec::parse_domain_list(&row.get::<_, String>(5)?);
            presets.push(Preset {
                id,
                name: row.get(1)?,
                mode,
                duration_minutes: row.get(3)?,
                blocklist,
                whitelist,
            });
        }
        Ok(presets)
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
        let mode_str = codec::encode_mode(mode);
        self.conn.execute(
            "INSERT INTO presets (id, name, mode, duration_minutes, blocklist_json, whitelist_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                preset.id.to_string(),
                preset.name,
                mode_str,
                preset.duration_minutes,
                codec::encode_domain_list(&blocklist),
                codec::encode_domain_list(&whitelist),
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
        let mode_str = codec::encode_mode(session.mode);
        let status_str = codec::encode_status(session.status);
        self.conn.execute(
            "INSERT OR REPLACE INTO sessions (id, preset_id, mode, started_at, ended_at, planned_duration_sec, status, blocklist_snapshot, whitelist_snapshot) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                session.id.to_string(),
                session.preset_id.map(|id| id.to_string()),
                mode_str,
                session.started_at.to_rfc3339(),
                session.ended_at.map(|t| t.to_rfc3339()),
                session.planned_duration_sec,
                status_str,
                codec::encode_domain_list(&session.blocklist_snapshot),
                codec::encode_domain_list(&session.whitelist_snapshot),
            ],
        )?;
        Ok(())
    }

    pub fn get_active_session(&self) -> Result<Option<Session>, StoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, preset_id, mode, started_at, ended_at, planned_duration_sec, status, blocklist_snapshot, whitelist_snapshot FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1",
        )?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            match row_to_session(row) {
                Ok(session) => return Ok(Some(session)),
                Err(StoreError::CorruptRow(message)) => {
                    tracing::warn!(reason = %message, "active session row corrupt, treating as none");
                    continue;
                }
                Err(e) => return Err(e),
            }
        }
        Ok(None)
    }

    pub fn list_history(&self, limit: u32) -> Result<Vec<Session>, StoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, preset_id, mode, started_at, ended_at, planned_duration_sec, status, blocklist_snapshot, whitelist_snapshot FROM sessions WHERE status != 'active' ORDER BY started_at DESC LIMIT ?1",
        )?;
        let mut rows = stmt.query(params![limit])?;
        let mut sessions = Vec::new();
        while let Some(row) = rows.next()? {
            match row_to_session(row) {
                Ok(session) => sessions.push(session),
                // Skip the broken row, keep the rest of the history usable.
                Err(StoreError::CorruptRow(message)) => {
                    tracing::warn!(reason = %message, "history row corrupt, skipping it");
                    continue;
                }
                Err(e) => return Err(e),
            }
        }
        Ok(sessions)
    }

    pub fn clear_history(&self) -> Result<(), StoreError> {
        self.conn.execute("DELETE FROM sessions WHERE status != 'active'", [])?;
        Ok(())
    }

}

/// Ok(session) for a good row; Err(CorruptRow) marks a row that should be
/// skipped (broken identity); other errors are real failures.
fn row_to_session(row: &rusqlite::Row<'_>) -> Result<Session, StoreError> {
    let mode = codec::parse_mode(&row.get::<_, String>(2)?);
    let status = codec::parse_status(&row.get::<_, String>(6)?);
    let started_at: String = row.get(3)?;
    let ended_at: Option<String> = row.get(4)?;
    let blocklist = codec::parse_domain_list(&row.get::<_, String>(7)?);
    let whitelist = codec::parse_domain_list(&row.get::<_, String>(8)?);
    let id = codec::parse_id(&row.get::<_, String>(0)?)
        .map_err(|e| StoreError::CorruptRow(e.to_string()))?;
    let preset_id = match row.get::<_, Option<String>>(1)? {
        Some(s) => match codec::parse_id(&s) {
            Ok(id) => Some(id),
            // A broken reference doesn't invalidate the session itself.
            Err(_) => {
                tracing::warn!(preset_id = %s, "session references a corrupt preset id; dropping the link");
                None
            }
        },
        None => None,
    };
    Ok(Session {
        id,
        preset_id,
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
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use focus_core::{SessionEndReason, SessionMode};

    fn memory_store() -> FocusStore {
        FocusStore::open(":memory:").expect("in-memory store opens")
    }

    #[test]
    fn lockdown_preset_survives_round_trip() {
        let store = memory_store();
        let created = store
            .create_preset("Locked", SessionMode::Lockdown, 45, vec![], vec!["mail.com".into()])
            .expect("create");
        let loaded = store.get_preset(created.id).expect("get").expect("exists");
        assert_eq!(loaded.mode, SessionMode::Lockdown);
        assert_eq!(loaded.whitelist, vec!["mail.com".to_string()]);
    }

    #[test]
    fn corrupt_preset_row_is_skipped_others_still_load() {
        let store = memory_store();
        let good = store
            .create_preset("Good", SessionMode::Blocklist, 25, vec![], vec![])
            .expect("create");
        store
            .conn
            .execute(
                "INSERT INTO presets (id, name, mode, duration_minutes) VALUES ('not-a-uuid', 'Bad', 'garbled', 10)",
                [],
            )
            .expect("insert corrupt row");

        let presets = store.list_presets().expect("list still loads");
        // Seed presets plus the good one; the corrupt row is gone.
        let loaded: Vec<_> = presets.iter().filter(|p| p.id == good.id).collect();
        assert_eq!(loaded.len(), 1);
        assert!(presets.iter().all(|p| p.id != Uuid::nil()));
    }

    #[test]
    fn corrupt_history_row_is_skipped_others_still_load() {
        let store = memory_store();
        let mut session = Session::new(SessionMode::Blocklist, 60, vec![], vec![], None);
        session.end(SessionEndReason::Stopped);
        store.save_session(&session).expect("save");
        store
            .conn
            .execute(
                "INSERT INTO sessions (id, preset_id, mode, started_at, planned_duration_sec, status) VALUES ('broken-id', NULL, 'blocklist', '2026-01-01T00:00:00Z', 60, 'completed')",
                [],
            )
            .expect("insert corrupt row");

        let history = store.list_history(10).expect("history still loads");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].id, session.id);
    }

    #[test]
    fn corrupt_status_row_falls_back_to_stopped_in_history() {
        let store = memory_store();
        store
            .conn
            .execute(
                "INSERT INTO sessions (id, preset_id, mode, started_at, planned_duration_sec, status) VALUES ('00000000-0000-0000-0000-000000000009', NULL, 'blocklist', '2026-01-01T00:00:00Z', 60, 'garbled')",
                [],
            )
            .expect("insert corrupt row");
        let history = store.list_history(10).expect("history loads");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].status, focus_core::SessionStatus::Stopped);
        // And it can never surface as the active session.
        assert!(store.get_active_session().expect("ok").is_none());
    }

    #[test]
    fn legacy_row_without_end_timestamp_loads_unchanged() {
        let store = memory_store();
        store
            .conn
            .execute(
                "INSERT INTO sessions (id, preset_id, mode, started_at, planned_duration_sec, status) VALUES ('00000000-0000-0000-0000-000000000008', NULL, 'lockdown', '2026-01-01T00:00:00Z', 60, 'completed')",
                [],
            )
            .expect("insert legacy row");
        let history = store.list_history(10).expect("history loads");
        assert_eq!(history[0].mode, SessionMode::Lockdown);
        assert!(history[0].ended_at.is_none());
    }

    #[test]
    fn settings_default_declared_once_and_reads_propagate() {
        let store = memory_store();
        // Fresh database: declared default applies without a row existing.
        let enabled = store.get_setting_bool("os_allowlist_enabled").expect("read ok");
        assert!(enabled);

        // Explicit value overrides default and persists.
        store
            .set_setting("os_allowlist_enabled", "false")
            .expect("write ok");
        let enabled = store.get_setting_bool("os_allowlist_enabled").expect("read ok");
        assert!(!enabled);

        // Unknown key with no declared default reads as false.
        let unknown = store.get_setting_bool("no_such_setting").expect("read ok");
        assert!(!unknown);
    }

    #[test]
    fn domain_lists_behave_identically_for_both_kinds() {
        let store = memory_store();

        let first_block = store.add_blocklist("YouTube.com").expect("add");
        let first_white = store.add_whitelist("mail.com").expect("add");
        assert!(first_block > 0);
        assert!(first_white > 0);

        // Duplicate inserts are ignored (no error, no second row).
        let dup = store.add_blocklist("youtube.com").expect("dup add ok");
        assert_eq!(store.list_blocklist().expect("list").len(), 1);
        let _ = dup;

        // Invalid domains are loud.
        assert!(store.add_blocklist("not a domain!!").is_err());
        assert!(store.add_whitelist("").is_err());

        // Sort order is by normalized domain.
        store.add_blocklist("aaa.com").expect("add");
        let blocklist = store.list_blocklist().expect("list");
        let domains: Vec<&str> = blocklist.iter().map(|d| d.domain.as_str()).collect();
        assert_eq!(domains, vec!["aaa.com", "youtube.com"]);

        // Removal works per list and leaves the other untouched.
        let youtube_id = blocklist
            .iter()
            .find(|d| d.domain == "youtube.com")
            .expect("entry")
            .id;
        store.remove_blocklist(youtube_id).expect("remove");
        assert_eq!(store.list_blocklist().expect("list").len(), 1);
        assert_eq!(store.list_whitelist().expect("list").len(), 1);

        // Domain snapshots follow their tables.
        assert_eq!(
            store.blocklist_domains().expect("domains"),
            vec!["aaa.com".to_string()]
        );
        assert_eq!(
            store.whitelist_domains().expect("domains"),
            vec!["mail.com".to_string()]
        );
    }

    #[test]
    fn end_transition_persists_through_store() {
        use focus_core::SessionStatus;
        let store = memory_store();
        let mut session = Session::new(SessionMode::Blocklist, 60, vec![], vec![], None);
        store.save_session(&session).expect("save active");
        session.end(SessionEndReason::Stopped);
        store.save_session(&session).expect("save stopped");
        let history = store.list_history(10).expect("history");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].status, SessionStatus::Stopped);
        assert!(store.get_active_session().expect("ok").is_none());
    }
}
