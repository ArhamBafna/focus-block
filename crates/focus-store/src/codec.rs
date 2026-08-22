//! The single place where persisted text crosses into typed domain values and
//! back. Every table reader/writer must go through these helpers so fallback
//! policy exists at exactly one site.
//!
//! # Fallback policy (documented here, nowhere else)
//!
//! - Unknown/corrupt `mode` strings degrade to [`SessionMode::Blocklist`] —
//!   the default list-blocking mode a fresh install starts with.
//! - Unknown/corrupt `status` strings degrade to [`SessionStatus::Stopped`] —
//!   a row of uncertain liveness must never resurrect as an active session,
//!   and history rows stay visible rather than disappearing.
//! - Corrupt UUID ids mark the row as corrupt: readers skip that row (with a
//!   warning) and keep serving the rest of the list, never inventing a new id
//!   to take its place.
//! - Unparseable domain-list JSON degrades to an empty list; snapshots are
//!   advisory copies of live tables, not authoritative data.

use focus_core::{SessionMode, SessionStatus};

pub fn encode_mode(mode: SessionMode) -> &'static str {
    match mode {
        SessionMode::Blocklist => "blocklist",
        SessionMode::Lockdown => "lockdown",
    }
}

pub fn parse_mode(raw: &str) -> SessionMode {
    match raw {
        "lockdown" => SessionMode::Lockdown,
        "blocklist" => SessionMode::Blocklist,
        other => {
            tracing::warn!(value = %other, "corrupt mode string in database, using documented fallback (blocklist)");
            SessionMode::Blocklist
        }
    }
}

pub fn encode_status(status: SessionStatus) -> &'static str {
    match status {
        SessionStatus::Active => "active",
        SessionStatus::Completed => "completed",
        SessionStatus::Stopped => "stopped",
    }
}

pub fn parse_status(raw: &str) -> SessionStatus {
    match raw {
        "active" => SessionStatus::Active,
        "completed" => SessionStatus::Completed,
        "stopped" => SessionStatus::Stopped,
        other => {
            tracing::warn!(value = %other, "corrupt status string in database, using documented fallback (stopped)");
            SessionStatus::Stopped
        }
    }
}

pub fn parse_id(raw: &str) -> Result<uuid::Uuid, crate::error::StoreError> {
    uuid::Uuid::parse_str(raw)
        .map_err(|_| crate::error::StoreError::Message(format!("corrupt uuid in database: {raw}")))
}

pub fn parse_domain_list(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_else(|_| {
        tracing::warn!("unparseable domain list JSON in database, using empty list");
        Vec::new()
    })
}

pub fn encode_domain_list(domains: &[String]) -> String {
    serde_json::to_string(domains).unwrap_or_else(|_| "[]".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mode_round_trip_preserves_lockdown() {
        assert_eq!(parse_mode(encode_mode(SessionMode::Lockdown)), SessionMode::Lockdown);
        assert_eq!(parse_mode(encode_mode(SessionMode::Blocklist)), SessionMode::Blocklist);
    }

    #[test]
    fn corrupt_mode_hits_documented_fallback() {
        assert_eq!(parse_mode("weird"), SessionMode::Blocklist);
        assert_eq!(parse_mode(""), SessionMode::Blocklist);
    }

    #[test]
    fn corrupt_status_never_resurrects_active() {
        assert_eq!(parse_status("weird"), SessionStatus::Stopped);
        assert_eq!(parse_status(""), SessionStatus::Stopped);
        assert_eq!(parse_status(encode_status(SessionStatus::Completed)), SessionStatus::Completed);
    }

    #[test]
    fn corrupt_id_is_flagged_not_random() {
        assert!(parse_id("not-a-uuid").is_err());
        let id = uuid::Uuid::new_v4();
        assert_eq!(parse_id(&id.to_string()).unwrap(), id);
    }

    #[test]
    fn corrupt_domain_json_degrades_to_empty() {
        assert!(parse_domain_list("{not json").is_empty());
        assert_eq!(
            parse_domain_list(r#"["a.com"]"#),
            vec!["a.com".to_string()]
        );
    }
}
