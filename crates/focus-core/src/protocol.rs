use crate::{Preset, Session, SessionMode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const PIPE_NAME: &str = r"\\.\pipe\focusblock";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "cmd", content = "data")]
pub enum IpcRequest {
    Ping,
    Health,
    GetStatus,
    ListBlocklist,
    AddBlocklist { domain: String },
    RemoveBlocklist { id: i64 },
    ListWhitelist,
    AddWhitelist { domain: String },
    RemoveWhitelist { id: i64 },
    ListPresets,
    CreatePreset {
        name: String,
        mode: SessionMode,
        duration_minutes: u32,
        blocklist: Vec<String>,
        whitelist: Vec<String>,
    },
    DeletePreset { id: Uuid },
    StartSession {
        mode: SessionMode,
        duration_minutes: u32,
        preset_id: Option<Uuid>,
    },
    StopSession,
    ListHistory { limit: u32 },
    ClearHistory,
    GetSettings,
    UpdateSettings { os_allowlist_enabled: bool },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", content = "data")]
pub enum IpcResponse {
    Ok { data: ResponseData },
    Err { message: String },
}

// ResponseData is untagged, so every variant must serialize to a distinct
// shape. A previous ActiveSession(Option<ActiveSessionView>) variant was
// removed: its None arm serialized to `null`, byte-identical to Unit(()),
// which would have silently mis-decoded had it ever been used.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ResponseData {
    Unit(()),
    Health(ServiceHealth),
    Status(ServiceStatus),
    Domains(Vec<DomainEntry>),
    Presets(Vec<Preset>),
    Sessions(Vec<Session>),
    Settings(AppSettings),
    Id(i64),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DomainEntry {
    pub id: i64,
    pub domain: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppSettings {
    pub os_allowlist_enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub running: bool,
    pub version: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub health: ServiceHealth,
    pub active_session: Option<crate::ActiveSessionView>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Untagged enum: each variant must survive a serialize/deserialize
    /// round-trip as itself, or responses silently decode as the wrong type.
    #[test]
    fn every_response_variant_round_trips_to_itself() {
        let health = ServiceHealth { running: true, version: "0.0.0".into() };
        let status = ServiceStatus {
            health: health.clone(),
            active_session: None,
        };
        let domain = DomainEntry { id: 1, domain: "a.com".into() };
        let preset = Preset {
            id: Uuid::nil(),
            name: "p".into(),
            mode: SessionMode::Blocklist,
            duration_minutes: 25,
            blocklist: vec![],
            whitelist: vec![],
        };
        let session = Session::new(
            SessionMode::Blocklist,
            60,
            vec![],
            vec![],
            None,
        );
        // Overwrite generated fields so equality is exact.
        let session = Session {
            id: Uuid::nil(),
            started_at: chrono::Utc::now(),
            ended_at: None,
            ..session
        };

        let cases: Vec<ResponseData> = vec![
            ResponseData::Unit(()),
            ResponseData::Health(health),
            ResponseData::Status(status),
            ResponseData::Domains(vec![domain]),
            ResponseData::Presets(vec![preset]),
            ResponseData::Sessions(vec![session]),
            ResponseData::Settings(AppSettings { os_allowlist_enabled: true }),
            ResponseData::Id(42),
        ];

        for original in cases {
            let json = serde_json::to_value(&original).expect("serialize");
            let decoded: ResponseData = serde_json::from_value(json).expect("deserialize");
            match (&original, &decoded) {
                (ResponseData::Unit(()), ResponseData::Unit(())) => {}
                (ResponseData::Health(a), ResponseData::Health(b)) => assert_eq!(a, b),
                (ResponseData::Status(a), ResponseData::Status(b)) => assert_eq!(a, b),
                (ResponseData::Domains(a), ResponseData::Domains(b)) => assert_eq!(a, b),
                (ResponseData::Presets(a), ResponseData::Presets(b)) => assert_eq!(a, b),
                (ResponseData::Sessions(a), ResponseData::Sessions(b)) => assert_eq!(a, b),
                (ResponseData::Settings(a), ResponseData::Settings(b)) => assert_eq!(a, b),
                (ResponseData::Id(a), ResponseData::Id(b)) => assert_eq!(a, b),
                other => panic!("variant mis-decoded: {:?}", other.1),
            }
        }
    }

    #[test]
    fn unit_serializes_to_null_distinctly_from_other_variants() {
        let json = serde_json::to_value(ResponseData::Unit(())).unwrap();
        assert_eq!(json, serde_json::Value::Null);
        // No other variant may produce null.
        let id = serde_json::to_value(ResponseData::Id(1)).unwrap();
        assert_ne!(id, serde_json::Value::Null);
    }
}
