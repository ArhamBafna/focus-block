use crate::{Preset, Session, SessionMode};
use chrono::{DateTime, Utc};
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
    ListAppBlockTargets,
    AddAppBlockTarget { target: AppBlockTarget },
    RemoveAppBlockTarget { id: i64 },
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
    /// Canonical, service-owned browser policy used by the native-messaging host.
    GetActivePolicy,
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
    AppTargets(AppBlockTargetList),
    Presets(Vec<Preset>),
    Sessions(Vec<Session>),
    ActiveSession(Option<crate::ActiveSessionView>),
    Settings(AppSettings),
    Policy(BlockingPolicySnapshot),
    Id(i64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEntry {
    pub id: i64,
    pub domain: String,
}

/// An application identity selected for service-side blocking.
///
/// `Executable` is an exact Win32 image path, `Folder` covers every `.exe` below
/// that directory, and `Package` is a Windows package family name (PFN).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AppBlockTarget {
    Executable { path: String },
    Folder { path: String },
    Package { package_family_name: String },
}

impl AppBlockTarget {
    pub fn normalized(&self) -> Result<Self, String> {
        match self {
            Self::Executable { path } => {
                let path = path.trim();
                if path.is_empty() || !path.to_ascii_lowercase().ends_with(".exe") {
                    return Err("executable target must be a .exe path".into());
                }
                Ok(Self::Executable { path: path.to_string() })
            }
            Self::Folder { path } => {
                let path = path.trim();
                if path.is_empty() {
                    return Err("folder target must not be empty".into());
                }
                Ok(Self::Folder { path: path.to_string() })
            }
            Self::Package { package_family_name } => {
                let package_family_name = package_family_name.trim();
                if package_family_name.is_empty()
                    || !package_family_name.contains('_')
                    || package_family_name.contains(['\\', '/', '\0'])
                {
                    return Err("package target must be a package family name".into());
                }
                Ok(Self::Package {
                    package_family_name: package_family_name.to_string(),
                })
            }
        }
    }

    pub fn storage_parts(&self) -> (&'static str, &str) {
        match self {
            Self::Executable { path } => ("executable", path),
            Self::Folder { path } => ("folder", path),
            Self::Package { package_family_name } => ("package", package_family_name),
        }
    }

    pub fn from_storage(kind: &str, value: String) -> Result<Self, String> {
        let target = match kind {
            "executable" => Self::Executable { path: value },
            "folder" => Self::Folder { path: value },
            "package" => Self::Package {
                package_family_name: value,
            },
            _ => return Err(format!("unknown app target kind: {kind}")),
        };
        target.normalized()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppBlockEntry {
    pub id: i64,
    pub target: AppBlockTarget,
}

/// Wrapper keeps an empty target list distinct from `Domains([])` while
/// `ResponseData` remains backward-compatible and untagged.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppBlockTargetList {
    pub targets: Vec<AppBlockEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub os_allowlist_enabled: bool,
}

/// Exact persisted policy for Chrome and other service consumers. The desktop UI
/// is never the enforcement authority.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockingPolicySnapshot {
    pub active: bool,
    pub mode: Option<SessionMode>,
    pub blocklist: Vec<String>,
    pub whitelist: Vec<String>,
    pub blocked_domains: Vec<String>,
    pub allowed_domains: Vec<String>,
    pub version: String,
    pub expires_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
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
