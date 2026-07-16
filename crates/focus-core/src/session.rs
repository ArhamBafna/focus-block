use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionMode {
    Blocklist,
    Lockdown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Active,
    Completed,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: Uuid,
    pub preset_id: Option<Uuid>,
    pub mode: SessionMode,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub planned_duration_sec: u64,
    pub status: SessionStatus,
    pub blocklist_snapshot: Vec<String>,
    pub whitelist_snapshot: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub id: Uuid,
    pub name: String,
    pub mode: SessionMode,
    pub duration_minutes: u32,
    pub blocklist: Vec<String>,
    pub whitelist: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSessionView {
    pub session: Session,
    pub elapsed_sec: u64,
    pub remaining_sec: Option<u64>,
}

impl Session {
    pub fn new(
        mode: SessionMode,
        planned_duration_sec: u64,
        blocklist: Vec<String>,
        whitelist: Vec<String>,
        preset_id: Option<Uuid>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            preset_id,
            mode,
            started_at: Utc::now(),
            ended_at: None,
            planned_duration_sec,
            status: SessionStatus::Active,
            blocklist_snapshot: blocklist,
            whitelist_snapshot: whitelist,
        }
    }

    pub fn remaining_sec(&self) -> Option<u64> {
        if self.planned_duration_sec == 0 {
            return None;
        }
        let elapsed = (Utc::now() - self.started_at).num_seconds().max(0) as u64;
        self.planned_duration_sec.saturating_sub(elapsed).into()
    }

    pub fn is_expired(&self) -> bool {
        if self.planned_duration_sec == 0 {
            return false;
        }
        let elapsed = (Utc::now() - self.started_at).num_seconds().max(0) as u64;
        elapsed >= self.planned_duration_sec
    }
}
