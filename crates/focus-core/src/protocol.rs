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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ResponseData {
    Unit(()),
    Health(ServiceHealth),
    Status(ServiceStatus),
    Domains(Vec<DomainEntry>),
    Presets(Vec<Preset>),
    Sessions(Vec<Session>),
    ActiveSession(Option<crate::ActiveSessionView>),
    Settings(AppSettings),
    Id(i64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEntry {
    pub id: i64,
    pub domain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub os_allowlist_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub running: bool,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub health: ServiceHealth,
    pub active_session: Option<crate::ActiveSessionView>,
}
