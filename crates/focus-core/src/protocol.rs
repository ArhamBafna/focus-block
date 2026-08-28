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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum IpcResponse {
    Ok { data: ResponseData },
    Err { message: String },
}

// ResponseData is untagged, so every variant must serialize to a distinct
// shape. A previous ActiveSession(Option<ActiveSessionView>) variant was
// removed: its None arm serialized to `null`, byte-identical to Unit(()),
// which would have silently mis-decoded had it ever been used.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ResponseData {
    Unit(()),
    Health(ServiceHealth),
    Status(ServiceStatus),
    Domains(Vec<DomainEntry>),
    AppTargets(AppBlockTargetList),
    Presets(Vec<Preset>),
    Sessions(Vec<Session>),
    Settings(AppSettings),
    Policy(BlockingPolicySnapshot),
    Id(i64),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredApp {
    pub display_name: String,
    pub target: AppBlockTarget,
    pub icon_data_uri: Option<String>,
    pub category: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppSettings {
    pub os_allowlist_enabled: bool,
}

/// Exact persisted policy for Chrome and other service consumers. The desktop UI
/// is never the enforcement authority.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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

    #[test]
    fn ipc_response_ok_and_err_serialize_to_expected_wire_shape() {
        let ok = IpcResponse::Ok {
            data: ResponseData::Domains(vec![DomainEntry {
                id: 1,
                domain: "youtube.com".into(),
            }]),
        };
        let ok_val = serde_json::to_value(&ok).expect("serialize ok");
        assert_eq!(
            ok_val,
            serde_json::json!({
                "status": "Ok",
                "data": [{ "id": 1, "domain": "youtube.com" }]
            })
        );
        let ok_roundtrip: IpcResponse = serde_json::from_value(ok_val).expect("deserialize ok");
        assert_eq!(ok_roundtrip, ok);

        let err = IpcResponse::Err {
            message: "something went wrong".into(),
        };
        let err_val = serde_json::to_value(&err).expect("serialize err");
        assert_eq!(
            err_val,
            serde_json::json!({
                "status": "Err",
                "message": "something went wrong"
            })
        );
        let err_roundtrip: IpcResponse = serde_json::from_value(err_val).expect("deserialize err");
        assert_eq!(err_roundtrip, err);
    }

    #[test]
    fn discovered_app_serializes_to_camel_case_json() {
        let app = DiscoveredApp {
            display_name: "Discord".into(),
            target: AppBlockTarget::Executable {
                path: r"C:\Users\App\Discord.exe".into(),
            },
            icon_data_uri: Some("data:image/png;base64,...".into()),
            category: "Communication".into(),
        };

        let json = serde_json::to_value(&app).expect("serialize discovered app");
        assert_eq!(
            json,
            serde_json::json!({
                "displayName": "Discord",
                "target": {
                    "kind": "executable",
                    "path": "C:\\Users\\App\\Discord.exe"
                },
                "iconDataUri": "data:image/png;base64,...",
                "category": "Communication"
            })
        );

        let roundtrip: DiscoveredApp = serde_json::from_value(json).expect("deserialize discovered app");
        assert_eq!(roundtrip, app);
    }
}
