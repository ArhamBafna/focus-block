use crate::app_enforcement::AppEnforcer;
use crate::enforcement::Enforcement;
use chrono::{Duration, Utc};
use focus_core::{
    ActiveSessionView, AppBlockTargetList, AppSettings, BlockingPolicySnapshot, IpcRequest,
    IpcResponse, ResponseData, Schedule, ScheduleList, ServiceHealth, ServiceStatus, Session, SessionStatus,
};
use focus_store::FocusStore;
use std::path::PathBuf;
use tracing::{error, info};

pub struct SessionManager {
    store: FocusStore,
    active_session: Option<Session>,
    app_enforcer: Box<dyn Enforcement>,
    pub schedule_suppressed_until: std::collections::HashMap<String, chrono::DateTime<Utc>>,
}

/// The real, machine-wide state this service owns. Tests must never reach it:
/// opening this database and merely constructing a manager re-applies any saved
/// active session, which terminates the user's blocked applications.
pub fn default_db_path() -> PathBuf {
    PathBuf::from(std::env::var("ALLUSERSPROFILE").unwrap_or_else(|_| "C:\\ProgramData".into()))
        .join("FocusBlock")
        .join("data.db")
}

impl SessionManager {
    pub fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let store = FocusStore::open(default_db_path())?;
        Self::with_enforcement(store, Box::new(AppEnforcer::default()))
    }

    /// Build a manager over a caller-supplied store and enforcement seam. The
    /// recovery rules live here so production and tests share one code path.
    pub(crate) fn with_enforcement(
        store: FocusStore,
        app_enforcer: Box<dyn Enforcement>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let active_session = store.get_active_session()?;
        let mut schedule_suppressed_until = std::collections::HashMap::new();
        if let Ok(history) = store.list_history(50) {
            let now = Utc::now();
            for session in history {
                if session.status == SessionStatus::Stopped {
                    if let Some(sched_id) = session.scheduled_schedule_id {
                        let planned_end = session
                            .started_at
                            .checked_add_signed(Duration::seconds(session.planned_duration_sec as i64))
                            .unwrap_or_else(Utc::now);
                        if now < planned_end {
                            schedule_suppressed_until.entry(sched_id).or_insert(planned_end);
                        }
                    }
                }
            }
        }

        let mut mgr = Self {
            store,
            active_session: None,
            app_enforcer,
            schedule_suppressed_until,
        };

        match active_session {
            Some(session) if session.is_expired() => {
                // Do not mark complete until app enforcement is cleared.
                mgr.app_enforcer.clear()?;
                let mut completed = session;
                completed.status = SessionStatus::Completed;
                completed.ended_at = Some(Utc::now());
                mgr.store.save_session(&completed)?;
            }
            Some(session) => {
                // Keep state if enforcement restore fails; the 1s service tick
                // retries and process termination remains enabled.
                mgr.active_session = Some(session.clone());
                if let Err(error) = mgr.app_enforcer.apply(&session.app_block_targets_snapshot) {
                    error!("failed to restore app enforcement; will retry: {error}");
                }
            }
            None => {
                // A prior crash can leave a watcher behind in a previous process;
                // clearing here is a no-op on a healthy service and never touches
                // other programs or machine-wide policy.
                if let Err(error) = mgr.app_enforcer.clear() {
                    error!("failed to clear stale enforcement: {error}");
                }
            }
        }

        Ok(mgr)
    }

    pub fn handle_request(&mut self, req: IpcRequest) -> IpcResponse {
        match req {
            IpcRequest::Ping => IpcResponse::Ok {
                data: ResponseData::Unit(()),
            },
            IpcRequest::Health => IpcResponse::Ok {
                data: ResponseData::Health(self.health()),
            },
            IpcRequest::GetStatus => {
                let session_view = self.active_session.clone().map(|session| ActiveSessionView {
                    elapsed_sec: (Utc::now() - session.started_at).num_seconds().max(0) as u64,
                    remaining_sec: session.remaining_sec(),
                    session,
                });
                IpcResponse::Ok {
                    data: ResponseData::Status(ServiceStatus {
                        health: self.health(),
                        active_session: session_view,
                        last_blocked_app: self.app_enforcer.last_blocked_app(),
                        enforcement_mode: self.app_enforcer.mode(),
                    }),
                }
            }
            IpcRequest::GetActivePolicy => IpcResponse::Ok {
                data: ResponseData::Policy(self.active_policy()),
            },
            IpcRequest::ListBlocklist => self
                .store
                .list_blocklist()
                .map(|domains| IpcResponse::Ok {
                    data: ResponseData::Domains(domains),
                })
                .unwrap_or_else(store_error),
            IpcRequest::AddBlocklist { domain } => match self.store.add_blocklist(&domain) {
                Ok(id) => match self.sync_active_site_lists() {
                    Ok(()) => IpcResponse::Ok {
                        data: ResponseData::Id(id),
                    },
                    Err(message) => IpcResponse::Err { message },
                },
                Err(error) => store_error(error),
            },
            IpcRequest::RemoveBlocklist { id } => match self.store.remove_blocklist(id) {
                Ok(()) => match self.sync_active_site_lists() {
                    Ok(()) => IpcResponse::Ok {
                        data: ResponseData::Unit(()),
                    },
                    Err(message) => IpcResponse::Err { message },
                },
                Err(error) => store_error(error),
            },
            IpcRequest::ListAppBlockTargets => self
                .store
                .list_app_block_targets()
                .map(|targets| IpcResponse::Ok {
                    data: ResponseData::AppTargets(AppBlockTargetList { targets }),
                })
                .unwrap_or_else(store_error),
            IpcRequest::AddAppBlockTarget { target } => {
                let target = match AppEnforcer::validate_target(&target) {
                    Ok(target) => target,
                    Err(message) => return IpcResponse::Err { message },
                };
                match self.store.add_app_block_target(&target) {
                    Ok(id) => match self.sync_active_app_targets() {
                        Ok(()) => IpcResponse::Ok {
                            data: ResponseData::Id(id),
                        },
                        Err(message) => IpcResponse::Err { message },
                    },
                    Err(error) => store_error(error),
                }
            }
            IpcRequest::RemoveAppBlockTarget { id } => match self.store.remove_app_block_target(id) {
                Ok(()) => match self.sync_active_app_targets() {
                    Ok(()) => IpcResponse::Ok {
                        data: ResponseData::Unit(()),
                    },
                    Err(message) => IpcResponse::Err { message },
                },
                Err(error) => store_error(error),
            },
            IpcRequest::ListWhitelist => self
                .store
                .list_whitelist()
                .map(|domains| IpcResponse::Ok {
                    data: ResponseData::Domains(domains),
                })
                .unwrap_or_else(store_error),
            IpcRequest::AddWhitelist { domain } => match self.store.add_whitelist(&domain) {
                Ok(id) => match self.sync_active_site_lists() {
                    Ok(()) => IpcResponse::Ok {
                        data: ResponseData::Id(id),
                    },
                    Err(message) => IpcResponse::Err { message },
                },
                Err(error) => store_error(error),
            },
            IpcRequest::RemoveWhitelist { id } => match self.store.remove_whitelist(id) {
                Ok(()) => match self.sync_active_site_lists() {
                    Ok(()) => IpcResponse::Ok {
                        data: ResponseData::Unit(()),
                    },
                    Err(message) => IpcResponse::Err { message },
                },
                Err(error) => store_error(error),
            },
            IpcRequest::ListPresets => self
                .store
                .list_presets()
                .map(|presets| IpcResponse::Ok {
                    data: ResponseData::Presets(presets),
                })
                .unwrap_or_else(store_error),
            IpcRequest::CreatePreset {
                name,
                mode,
                duration_minutes,
                blocklist,
                whitelist,
            } => self
                .store
                .create_preset(&name, mode, duration_minutes, blocklist, whitelist)
                .map(|_| IpcResponse::Ok {
                    data: ResponseData::Unit(()),
                })
                .unwrap_or_else(store_error),
            IpcRequest::DeletePreset { id } => self
                .store
                .delete_preset(id)
                .map(|_| IpcResponse::Ok {
                    data: ResponseData::Unit(()),
                })
                .unwrap_or_else(store_error),
            IpcRequest::StartSession {
                mode,
                duration_minutes,
                preset_id,
            } => self.start_session(mode, duration_minutes, preset_id),
            IpcRequest::StopSession => self.stop_session(),
            IpcRequest::ListHistory { limit } => self
                .store
                .list_history(limit)
                .map(|sessions| IpcResponse::Ok {
                    data: ResponseData::Sessions(sessions),
                })
                .unwrap_or_else(store_error),
            IpcRequest::ClearHistory => self
                .store
                .clear_history()
                .map(|()| IpcResponse::Ok {
                    data: ResponseData::Unit(()),
                })
                .unwrap_or_else(store_error),
            IpcRequest::GetSettings => {
                // Real database errors surface instead of silently reading as a default.
                match self.store.get_setting_bool("os_allowlist_enabled") {
                    Ok(os_allowlist_enabled) => IpcResponse::Ok {
                        data: ResponseData::Settings(AppSettings { os_allowlist_enabled }),
                    },
                    Err(e) => IpcResponse::Err { message: e.to_string() },
                }
            }
            IpcRequest::UpdateSettings {
                os_allowlist_enabled,
            } => self
                .store
                .set_setting(
                    "os_allowlist_enabled",
                    if os_allowlist_enabled { "true" } else { "false" },
                )
                .map(|()| IpcResponse::Ok {
                    data: ResponseData::Unit(()),
                })
                .unwrap_or_else(store_error),
            IpcRequest::ClearLastBlockedApp => {
                self.app_enforcer.clear_last_blocked_app();
                IpcResponse::Ok {
                    data: ResponseData::Unit(()),
                }
            }
            IpcRequest::ListSchedules => self
                .store
                .list_schedules()
                .map(|schedules| IpcResponse::Ok {
                    data: ResponseData::Schedules(ScheduleList { schedules }),
                })
                .unwrap_or_else(store_error),
            IpcRequest::CreateSchedule { schedule } => {
                let schedules = match self.store.list_schedules() {
                    Ok(s) => s,
                    Err(e) => return store_error(e),
                };
                if let Err(message) = validate_schedule(&schedule, &schedules) {
                    return IpcResponse::Err { message };
                }
                match self.store.create_schedule(&schedule) {
                    Ok(()) => {
                        let _ = self.evaluate_schedules_at(&chrono::Local::now(), &Utc::now());
                        IpcResponse::Ok {
                            data: ResponseData::Unit(()),
                        }
                    }
                    Err(e) => store_error(e),
                }
            }
            IpcRequest::UpdateSchedule { schedule } => {
                let schedules = match self.store.list_schedules() {
                    Ok(s) => s,
                    Err(e) => return store_error(e),
                };
                if let Err(message) = validate_schedule(&schedule, &schedules) {
                    return IpcResponse::Err { message };
                }
                if let Err(e) = self.store.update_schedule(&schedule) {
                    return store_error(e);
                }

                if let Some(session) = &self.active_session {
                    if session.scheduled_schedule_id.as_deref() == Some(&schedule.id) {
                        let now_local = chrono::Local::now();
                        if let Some((_start, end_utc)) = schedule_is_active_at(&schedule, &now_local) {
                            let mut updated = session.clone();
                            updated.mode = schedule.mode;
                            let duration = (end_utc - session.started_at).num_seconds().max(1) as u64;
                            updated.planned_duration_sec = duration;
                            let _ = self.store.save_session(&updated);
                            let _ = self.app_enforcer.apply(&updated.app_block_targets_snapshot);
                            self.active_session = Some(updated);
                        } else {
                            let _ = self.stop_session();
                            self.schedule_suppressed_until.remove(&schedule.id);
                        }
                    }
                }

                IpcResponse::Ok {
                    data: ResponseData::Unit(()),
                }
            }
            IpcRequest::DeleteSchedule { id } => self.delete_schedule(&id),
        }
    }

    pub async fn tick(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(session) = self.active_session.clone() {
            if session.is_expired() {
                self.complete_expired_session(session)?;
            } else if let Err(error) = self.app_enforcer.tick() {
                error!("app enforcement tick failed; will retry: {error}");
            }
        }

        let now_local = chrono::Local::now();
        let now_utc = Utc::now();
        self.evaluate_schedules_at(&now_local, &now_utc)?;
        Ok(())
    }

    pub fn evaluate_schedules_at(
        &mut self,
        now_local: &chrono::DateTime<chrono::Local>,
        now_utc: &chrono::DateTime<Utc>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.schedule_suppressed_until.retain(|_, until| now_utc < until);

        let schedules = self.store.list_schedules()?;

        for schedule in &schedules {
            if let Some(until) = self.schedule_suppressed_until.get(&schedule.id) {
                if now_utc < until {
                    continue;
                }
            }

            if let Some((_start_utc, end_utc)) = schedule_is_active_at(schedule, now_local) {
                if let Some(active) = &self.active_session {
                    if active.scheduled_schedule_id.as_deref() == Some(&schedule.id) {
                        return Ok(());
                    }
                    tracing::info!("Scheduled session {} taking over active session", schedule.id);
                    self.app_enforcer.clear()?;
                    let mut old = active.clone();
                    old.status = SessionStatus::Stopped;
                    old.ended_at = Some(Utc::now());
                    self.store.save_session(&old)?;
                    self.active_session = None;
                }

                let remaining_sec = (end_utc - *now_utc).num_seconds().max(1) as u64;
                let blocklist = self.store.blocklist_domains()?;
                let whitelist = self.store.whitelist_domains()?;
                let app_targets = self.store.app_block_targets()?;

                let mut session = Session::new(
                    schedule.mode,
                    remaining_sec,
                    blocklist,
                    whitelist,
                    app_targets,
                    None,
                ).with_scheduled_schedule_id(Some(schedule.id.clone()));
                session.started_at = *now_utc;

                if let Err(error) = self.store.save_session(&session) {
                    return Err(Box::new(error));
                }

                if let Err(error) = self.app_enforcer.apply(&session.app_block_targets_snapshot) {
                    tracing::error!("App enforcement for scheduled session failed: {error}");
                    let mut failed = session;
                    failed.status = SessionStatus::Stopped;
                    failed.ended_at = Some(Utc::now());
                    let _ = self.store.save_session(&failed);
                    return Ok(());
                }

                self.active_session = Some(session);
                tracing::info!("Activated scheduled session {}", schedule.id);
                return Ok(());
            }
        }

        Ok(())
    }

    /// A Windows service stop/restart must preserve active policy. Active session
    /// snapshot and enforcement targets are rehydrated on next start.
    pub async fn shutdown(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Ok(())
    }

    fn health(&self) -> ServiceHealth {
        ServiceHealth {
            running: true,
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }

    fn active_policy(&self) -> BlockingPolicySnapshot {
        match &self.active_session {
            Some(session) => BlockingPolicySnapshot {
                active: true,
                mode: Some(session.mode),
                blocklist: session.blocklist_snapshot.clone(),
                whitelist: session.whitelist_snapshot.clone(),
                blocked_domains: session.blocklist_snapshot.clone(),
                allowed_domains: session.whitelist_snapshot.clone(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                expires_at: session_expiry(session),
                error: None,
            },
            None => BlockingPolicySnapshot {
                active: false,
                mode: None,
                blocklist: Vec::new(),
                whitelist: Vec::new(),
                blocked_domains: Vec::new(),
                allowed_domains: Vec::new(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                expires_at: None,
                error: None,
            },
        }
    }

    fn start_session(
        &mut self,
        mode: focus_core::SessionMode,
        duration_minutes: u32,
        preset_id: Option<uuid::Uuid>,
    ) -> IpcResponse {
        if self.active_session.is_some() {
            return IpcResponse::Err {
                message: "Session already active".into(),
            };
        }

        let blocklist = self.store.blocklist_domains().unwrap_or_default();
        let whitelist = self.store.whitelist_domains().unwrap_or_default();
        let app_targets = match self.store.app_block_targets() {
            Ok(targets) => targets,
            Err(error) => return store_error(error),
        };
        let session = Session::new(
            mode,
            (duration_minutes as u64) * 60,
            blocklist,
            whitelist,
            app_targets,
            preset_id,
        );

        // Persist policy before applying app enforcement. A crash in the
        // narrow gap is recovered by service startup, never by the desktop UI.
        if let Err(error) = self.store.save_session(&session) {
            return store_error(error);
        }
        if let Err(error) = self.app_enforcer.apply(&session.app_block_targets_snapshot) {
            let mut failed = session;
            failed.status = SessionStatus::Stopped;
            failed.ended_at = Some(Utc::now());
            let _ = self.store.save_session(&failed);
            return IpcResponse::Err {
                message: format!("App enforcement failed: {error}"),
            };
        }

        self.active_session = Some(session);
        IpcResponse::Ok {
            data: ResponseData::Unit(()),
        }
    }

    fn delete_schedule(&mut self, id: &str) -> IpcResponse {
        self.schedule_suppressed_until.remove(id);
        if let Some(session) = &self.active_session {
            if session.scheduled_schedule_id.as_deref() == Some(id) {
                let stop_resp = self.stop_session();
                self.schedule_suppressed_until.remove(id);
                if let IpcResponse::Err { message } = stop_resp {
                    return IpcResponse::Err { message };
                }
            }
        }
        match self.store.delete_schedule(id) {
            Ok(()) => IpcResponse::Ok {
                data: ResponseData::Unit(()),
            },
            Err(e) => store_error(e),
        }
    }

    fn stop_session(&mut self) -> IpcResponse {
        let Some(mut session) = self.active_session.clone() else {
            return IpcResponse::Ok {
                data: ResponseData::Unit(()),
            };
        };

        if let Err(error) = self.app_enforcer.clear() {
            return IpcResponse::Err {
                message: format!("Could not remove app enforcement: {error}"),
            };
        }

        if let Some(sched_id) = &session.scheduled_schedule_id {
            let suppressed_until = session
                .started_at
                .checked_add_signed(Duration::seconds(session.planned_duration_sec as i64))
                .unwrap_or_else(Utc::now);
            self.schedule_suppressed_until.insert(sched_id.clone(), suppressed_until);
        }

        session.status = SessionStatus::Stopped;
        session.ended_at = Some(Utc::now());
        match self.store.save_session(&session) {
            Ok(()) => {
                self.active_session = None;
                IpcResponse::Ok {
                    data: ResponseData::Unit(()),
                }
            }
            Err(error) => IpcResponse::Err {
                message: format!(
                    "App enforcement was removed but session persistence failed: {error}"
                ),
            },
        }
    }

    fn complete_expired_session(
        &mut self,
        session: Session,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Session expired; removing enforcement");
        self.app_enforcer.clear()?;
        let mut completed = session;
        completed.status = SessionStatus::Completed;
        completed.ended_at = Some(Utc::now());
        self.store.save_session(&completed)?;
        self.active_session = None;
        Ok(())
    }

    fn sync_active_app_targets(&mut self) -> Result<(), String> {
        let Some(previous_session) = self.active_session.clone() else {
            return Ok(());
        };
        let targets = self
            .store
            .app_block_targets()
            .map_err(|error| error.to_string())?;
        let mut candidate_session = previous_session.clone();
        candidate_session.app_block_targets_snapshot = targets;

        // Apply app enforcement first. If persistence then fails, restore previous policy so
        // disk snapshot and active enforcement never diverge across a restart.
        self.app_enforcer
            .apply(&candidate_session.app_block_targets_snapshot)?;
        if let Err(error) = self.store.save_session(&candidate_session) {
            return match self
                .app_enforcer
                .apply(&previous_session.app_block_targets_snapshot)
            {
                Ok(()) => Err(error.to_string()),
                Err(rollback_error) => Err(format!(
                    "session persistence failed: {error}; enforcement rollback also failed: {rollback_error}"
                )),
            };
        }
        self.active_session = Some(candidate_session);
        Ok(())
    }

    /// Browser rules use the active session snapshot supplied through native
    /// messaging. Keep that snapshot current when either permanent site list
    /// changes, including changes mirrored from the Chrome extension.
    fn sync_active_site_lists(&mut self) -> Result<(), String> {
        let Some(previous_session) = self.active_session.clone() else {
            return Ok(());
        };
        let blocklist = self
            .store
            .blocklist_domains()
            .map_err(|error| error.to_string())?;
        let whitelist = self
            .store
            .whitelist_domains()
            .map_err(|error| error.to_string())?;
        let mut candidate_session = previous_session;
        candidate_session.blocklist_snapshot = blocklist;
        candidate_session.whitelist_snapshot = whitelist;
        self.store
            .save_session(&candidate_session)
            .map_err(|error| error.to_string())?;
        self.active_session = Some(candidate_session);
        Ok(())
    }
}

fn session_expiry(session: &Session) -> Option<chrono::DateTime<Utc>> {
    if session.planned_duration_sec == 0 {
        return None;
    }
    let seconds = i64::try_from(session.planned_duration_sec).ok()?;
    session.started_at.checked_add_signed(Duration::seconds(seconds))
}

fn store_error(error: focus_store::StoreError) -> IpcResponse {
    IpcResponse::Err {
        message: error.to_string(),
    }
}

pub fn parse_time_hh_mm(value: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let h: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    if h < 24 && m < 60 {
        Some((h, m))
    } else {
        None
    }
}

pub fn schedule_is_active_at(
    schedule: &Schedule,
    now: &chrono::DateTime<chrono::Local>,
) -> Option<(chrono::DateTime<Utc>, chrono::DateTime<Utc>)> {
    use chrono::{Datelike, TimeZone};

    let today_key = format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day());
    if let Some(ends_on) = &schedule.ends_on {
        if &today_key > ends_on {
            return None;
        }
    }

    let day_of_week = now.weekday().num_days_from_sunday() as u8;
    if !schedule.days_of_week.contains(&day_of_week) {
        return None;
    }

    let (sh, sm) = parse_time_hh_mm(&schedule.start_time)?;
    let (eh, em) = parse_time_hh_mm(&schedule.end_time)?;

    let now_time = now.time();
    let start_time = chrono::NaiveTime::from_hms_opt(sh, sm, 0)?;
    let end_time = chrono::NaiveTime::from_hms_opt(eh, em, 0)?;

    if start_time <= now_time && now_time < end_time {
        let naive_date = now.date_naive();
        let start_naive = naive_date.and_time(start_time);
        let end_naive = naive_date.and_time(end_time);
        let start_dt = now.timezone().from_local_datetime(&start_naive).earliest()?.with_timezone(&Utc);
        let end_dt = now.timezone().from_local_datetime(&end_naive).earliest()?.with_timezone(&Utc);
        Some((start_dt, end_dt))
    } else {
        None
    }
}


pub fn validate_schedule(schedule: &Schedule, existing: &[Schedule]) -> Result<(), String> {
    use chrono::Datelike;

    let (sh, sm) = parse_time_hh_mm(&schedule.start_time)
        .ok_or_else(|| "Enter valid start and end times.".to_string())?;
    let (eh, em) = parse_time_hh_mm(&schedule.end_time)
        .ok_or_else(|| "Enter valid start and end times.".to_string())?;

    let start_mins = sh * 60 + sm;
    let end_mins = eh * 60 + em;

    if start_mins >= end_mins {
        return Err("End time must be after start time.".into());
    }

    if schedule.days_of_week.is_empty() {
        return Err("Choose at least one day.".into());
    }

    for day in &schedule.days_of_week {
        if *day > 6 {
            return Err("Days of week must be between 0 and 6.".into());
        }
    }

    let today = chrono::Local::now();
    let today_key = format!("{:04}-{:02}-{:02}", today.year(), today.month(), today.day());

    if let Some(ends_on) = &schedule.ends_on {
        if chrono::NaiveDate::parse_from_str(ends_on, "%Y-%m-%d").is_err() {
            return Err("Choose a valid end date.".into());
        }
        if ends_on < &today_key {
            return Err("End date cannot be in the past.".into());
        }
    }

    for other in existing {
        if other.id == schedule.id {
            continue;
        }

        let first_ends_on = schedule.ends_on.as_deref();
        let second_ends_on = other.ends_on.as_deref();
        let dates_overlap = (first_ends_on.is_none() || first_ends_on.unwrap() >= today_key.as_str())
            && (second_ends_on.is_none() || second_ends_on.unwrap() >= today_key.as_str());

        if !dates_overlap {
            continue;
        }

        let days_intersect = schedule.days_of_week.iter().any(|d| other.days_of_week.contains(d));
        if !days_intersect {
            continue;
        }

        if let (Some((osh, osm)), Some((oeh, oem))) = (
            parse_time_hh_mm(&other.start_time),
            parse_time_hh_mm(&other.end_time),
        ) {
            let o_start = osh * 60 + osm;
            let o_end = oeh * 60 + oem;
            if start_mins < o_end && end_mins > o_start {
                return Err(format!(
                    "Schedule overlaps with {}–{} on shared days.",
                    other.start_time, other.end_time
                ));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{FakeEnforcer, TempDb};
    use focus_core::{AppBlockTarget, EnforcementMode};

    const TEST_EXE: &str = r"C:\Program Files\Example\example.exe";

    fn target() -> AppBlockTarget {
        AppBlockTarget::Executable {
            path: TEST_EXE.into(),
        }
    }

    /// A session already written to the store, with a controllable age, so the
    /// recovery and expiry paths are deterministic instead of sleep-based.
    fn seed_session(
        store: &FocusStore,
        age_sec: i64,
        duration_sec: u64,
        targets: Vec<AppBlockTarget>,
    ) -> Session {
        let mut session = Session::new(
            focus_core::SessionMode::Lockdown,
            duration_sec,
            Vec::new(),
            Vec::new(),
            targets,
            None,
        );
        session.started_at = Utc::now() - Duration::seconds(age_sec);
        store.save_session(&session).expect("seed session");
        session
    }

    fn status(manager: &mut SessionManager) -> focus_core::ServiceStatus {
        match manager.handle_request(IpcRequest::GetStatus) {
            IpcResponse::Ok {
                data: ResponseData::Status(status),
            } => status,
            other => panic!("status request failed: {other:?}"),
        }
    }

    fn history(manager: &mut SessionManager) -> Vec<Session> {
        match manager.handle_request(IpcRequest::ListHistory { limit: 20 }) {
            IpcResponse::Ok {
                data: ResponseData::Sessions(sessions),
            } => sessions,
            other => panic!("history request failed: {other:?}"),
        }
    }

    #[test]
    fn start_session_applies_saved_targets_and_reports_mode() {
        let db = TempDb::new();
        let store = db.open();
        store.add_app_block_target(&target()).expect("seed target");

        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        reset(&log);

        let response = manager.handle_request(IpcRequest::StartSession {
            mode: focus_core::SessionMode::Lockdown,
            duration_minutes: 25,
            preset_id: None,
        });
        assert!(matches!(response, IpcResponse::Ok { .. }), "{response:?}");

        let log = log.lock().unwrap();
        assert_eq!(log.applied, vec![vec![target()]]);
        assert_eq!(log.events, vec!["apply:1".to_string()]);
        drop(log);

        let status = status(&mut manager);
        assert!(status.active_session.is_some());
        assert_eq!(status.enforcement_mode, EnforcementMode::KernelEvents);
    }

    #[test]
    fn stop_session_releases_enforcement_and_records_history() {
        let db = TempDb::new();
        let store = db.open();
        store.add_app_block_target(&target()).expect("seed target");

        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        reset(&log);
        let started = start(&mut manager);

        let response = manager.handle_request(IpcRequest::StopSession);
        assert!(matches!(response, IpcResponse::Ok { .. }), "{response:?}");

        let events = log.lock().unwrap().events.clone();
        assert_eq!(events, vec!["apply:1".to_string(), "clear".to_string()]);

        let status = status(&mut manager);
        assert!(status.active_session.is_none());
        assert_eq!(status.enforcement_mode, EnforcementMode::Inactive);

        let saved = history(&mut manager)
            .into_iter()
            .find(|session| session.id == started.id)
            .expect("stopped session in history");
        assert_eq!(saved.status, SessionStatus::Stopped);
        assert!(saved.ended_at.is_some());
    }

    #[test]
    fn expired_session_is_completed_on_recovery_without_replacing_it() {
        let db = TempDb::new();
        let store = db.open();
        let seeded = seed_session(&store, 120, 60, vec![target()]);

        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");

        // Expiry is cleaned up before any session starts, and never by writing a
        // brand new session over the saved one.
        assert_eq!(log.lock().unwrap().events, vec!["clear".to_string()]);
        assert!(status(&mut manager).active_session.is_none());

        let saved = history(&mut manager)
            .into_iter()
            .find(|session| session.id == seeded.id)
            .expect("the same session must remain in history");
        assert_eq!(saved.status, SessionStatus::Completed);

        let response = manager.handle_request(IpcRequest::StopSession);
        assert!(matches!(response, IpcResponse::Ok { .. }));
        assert_eq!(
            log.lock().unwrap().events,
            vec!["clear".to_string()],
            "stopping with no active session must not touch enforcement"
        );
    }

    #[test]
    fn reopening_restores_the_saved_session_identity_and_policy() {
        let db = TempDb::new();
        let store = db.open();
        let seeded = seed_session(&store, 10, 600, vec![target()]);

        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");

        assert_eq!(log.lock().unwrap().applied, vec![vec![target()]]);
        let active = status(&mut manager)
            .active_session
            .expect("the saved session must be restored");
        assert_eq!(active.session.id, seeded.id);
        assert_eq!(active.session.status, SessionStatus::Active);
    }

    #[test]
    fn expiry_during_a_tick_completes_the_saved_session() {
        let db = TempDb::new();
        let store = db.open();
        // Active on recovery, but its deadline passes while the manager runs.
        let seeded = seed_session(&store, 0, 1, vec![target()]);

        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        assert_eq!(log.lock().unwrap().applied.len(), 1);

        std::thread::sleep(std::time::Duration::from_millis(1100));
        runtime_block_on(manager.tick()).expect("tick");

        let events = log.lock().unwrap().events.clone();
        assert_eq!(events, vec!["apply:1".to_string(), "clear".to_string()]);
        let status = status(&mut manager);
        assert!(status.active_session.is_none());
        assert_eq!(
            status.enforcement_mode,
            EnforcementMode::Inactive,
            "an expired session must leave nothing enforcing, so a newly launched app survives"
        );
        let saved = history(&mut manager)
            .into_iter()
            .find(|session| session.id == seeded.id)
            .expect("completed session in history");
        assert_eq!(saved.status, SessionStatus::Completed);
    }

    #[test]
    fn enforcement_failure_marks_the_session_stopped_and_surfaces_the_error() {
        let db = TempDb::new();
        let store = db.open();
        store.add_app_block_target(&target()).expect("seed target");

        let (fake, log) = FakeEnforcer::failing_apply("subscription refused");
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        reset(&log);

        let response = manager.handle_request(IpcRequest::StartSession {
            mode: focus_core::SessionMode::Lockdown,
            duration_minutes: 25,
            preset_id: None,
        });
        match response {
            IpcResponse::Err { message } => {
                assert!(message.contains("App enforcement failed"), "{message}");
                assert!(message.contains("subscription refused"), "{message}");
            }
            other => panic!("a failed apply must not be accepted: {other:?}"),
        }

        assert!(status(&mut manager).active_session.is_none());
        assert_eq!(
            log.lock().unwrap().events,
            vec!["apply-failed".to_string()],
            "a failed apply must not be recorded as applied"
        );
    }

    #[test]
    fn rapid_start_stop_cycles_never_apply_before_releasing() {
        let db = TempDb::new();
        let store = db.open();
        store.add_app_block_target(&target()).expect("seed target");

        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        reset(&log);

        for _ in 0..3 {
            start(&mut manager);
            assert!(matches!(
                manager.handle_request(IpcRequest::StopSession),
                IpcResponse::Ok { .. }
            ));
        }

        assert_eq!(
            log.lock().unwrap().events,
            vec![
                "apply:1",
                "clear",
                "apply:1",
                "clear",
                "apply:1",
                "clear"
            ]
        );
    }

    #[test]
    fn a_session_with_no_app_targets_reports_inactive_enforcement() {
        let db = TempDb::new();
        let store = db.open();
        let (fake, _log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");

        start(&mut manager);
        let status = status(&mut manager);
        assert!(status.active_session.is_some());
        assert_eq!(
            status.enforcement_mode,
            EnforcementMode::Inactive,
            "with nothing to enforce, the service must not claim kernel-event enforcement"
        );
    }

    #[test]
    fn degraded_blocking_is_visible_in_status_instead_of_looking_healthy() {
        let db = TempDb::new();
        let store = db.open();
        store.add_app_block_target(&target()).expect("seed target");

        let (fake, _log) = FakeEnforcer::in_fallback_mode();
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        start(&mut manager);

        assert_eq!(
            status(&mut manager).enforcement_mode,
            EnforcementMode::PollingFallback,
            "a run enforced by the 2.5s sweep must be distinguishable from instant blocking"
        );
    }

    #[test]
    fn a_failed_release_keeps_enforcement_and_says_so() {
        let db = TempDb::new();
        let store = db.open();
        store.add_app_block_target(&target()).expect("seed target");

        let (fake, _log) = FakeEnforcer::failing_clear("watcher would not stop");
        let mut manager =
            SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        let started = start(&mut manager);

        match manager.handle_request(IpcRequest::StopSession) {
            IpcResponse::Err { message } => {
                assert!(message.contains("Could not remove app enforcement"), "{message}");
                assert!(message.contains("watcher would not stop"), "{message}");
            }
            other => panic!("a failed release must not report success: {other:?}"),
        }

        // Still active, and still recorded as active: the session cannot be
        // reported as stopped while enforcement is still in place.
        let status = status(&mut manager);
        assert_eq!(
            status.active_session.map(|view| view.session.id),
            Some(started.id)
        );
        let saved = db
            .open()
            .get_active_session()
            .expect("read active session")
            .expect("the session must still be persisted as active");
        assert_eq!(saved.id, started.id);
    }

    /// Construction clears stale enforcement when no session is saved, which is
    /// correct production behavior but not the subject of the test that follows.
    fn reset(log: &std::sync::Arc<std::sync::Mutex<crate::test_support::FakeLog>>) {
        let mut log = log.lock().unwrap();
        log.events.clear();
        log.applied.clear();
    }

    #[test]
    fn construction_without_a_saved_session_clears_stale_enforcement() {
        let db = TempDb::new();
        let store = db.open();
        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);

        let manager = SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        assert!(manager.active_session.is_none());
        assert_eq!(log.lock().unwrap().events, vec!["clear".to_string()]);
    }

    fn start(manager: &mut SessionManager) -> Session {
        let response = manager.handle_request(IpcRequest::StartSession {
            mode: focus_core::SessionMode::Lockdown,
            duration_minutes: 25,
            preset_id: None,
        });
        assert!(matches!(response, IpcResponse::Ok { .. }), "{response:?}");
        status(manager)
            .active_session
            .expect("session is active")
            .session
    }

    #[test]
    fn schedule_ipc_crud_and_active_deletion_stops_session() {
        let db = TempDb::new();
        let store = db.open();
        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager = SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        reset(&log);

        let sched = Schedule {
            id: "sched-123".into(),
            start_time: "09:00".into(),
            end_time: "17:00".into(),
            mode: focus_core::SessionMode::Lockdown,
            days_of_week: vec![1, 2, 3],
            ends_on: None,
        };

        // Create
        let resp = manager.handle_request(IpcRequest::CreateSchedule { schedule: sched.clone() });
        assert_eq!(resp, IpcResponse::Ok { data: ResponseData::Unit(()) });

        // List
        let resp = manager.handle_request(IpcRequest::ListSchedules);
        match resp {
            IpcResponse::Ok { data: ResponseData::Schedules(list) } => {
                assert_eq!(list.schedules.len(), 1);
                assert_eq!(list.schedules[0].id, "sched-123");
            }
            other => panic!("unexpected list response: {other:?}"),
        }

        // Update
        let mut updated = sched.clone();
        updated.end_time = "18:00".into();
        let resp = manager.handle_request(IpcRequest::UpdateSchedule { schedule: updated });
        assert_eq!(resp, IpcResponse::Ok { data: ResponseData::Unit(()) });

        // Seed an active session started by this schedule
        let mut active = Session::new(
            focus_core::SessionMode::Lockdown,
            3600,
            vec![],
            vec![],
            vec![],
            None,
        ).with_scheduled_schedule_id(Some("sched-123".into()));
        active.status = SessionStatus::Active;
        manager.store.save_session(&active).expect("save active session");
        manager.active_session = Some(active);

        // Deleting active schedule stops the session immediately
        let resp = manager.handle_request(IpcRequest::DeleteSchedule { id: "sched-123".into() });
        assert_eq!(resp, IpcResponse::Ok { data: ResponseData::Unit(()) });
        assert!(manager.active_session.is_none());

        // List is now empty
        let resp = manager.handle_request(IpcRequest::ListSchedules);
        match resp {
            IpcResponse::Ok { data: ResponseData::Schedules(list) } => {
                assert_eq!(list.schedules.len(), 0);
            }
            other => panic!("unexpected list response: {other:?}"),
        }
    }

    #[test]
    fn scheduled_session_triggers_and_manual_stop_suppresses_retriggering() {
        use chrono::TimeZone;
        let db = TempDb::new();
        let store = db.open();
        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager = SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        reset(&log);

        // Schedule: Monday to Friday (1..=5), 09:00 to 17:00
        let sched = Schedule {
            id: "sched-work".into(),
            start_time: "09:00".into(),
            end_time: "17:00".into(),
            mode: focus_core::SessionMode::Lockdown,
            days_of_week: vec![1, 2, 3, 4, 5],
            ends_on: None,
        };
        manager.store.create_schedule(&sched).expect("save schedule");
        manager.store.add_app_block_target(&target()).expect("add target");

        // Set time: Monday 2026-08-24 at 10:00:00 Local (inside schedule)
        let monday_local = chrono::Local.with_ymd_and_hms(2026, 8, 24, 10, 0, 0).single().unwrap();
        let monday_utc = monday_local.with_timezone(&Utc);

        // 1. Evaluate schedule -> triggers scheduled session
        manager.evaluate_schedules_at(&monday_local, &monday_utc).expect("eval");
        assert!(manager.active_session.is_some());
        let active = manager.active_session.as_ref().unwrap();
        assert_eq!(active.scheduled_schedule_id.as_deref(), Some("sched-work"));
        assert_eq!(active.mode, focus_core::SessionMode::Lockdown);
        assert_eq!(log.lock().unwrap().applied.len(), 1);

        // 2. Stop session manually -> should suppress retriggering until 17:00
        let stop_resp = manager.handle_request(IpcRequest::StopSession);
        assert!(matches!(stop_resp, IpcResponse::Ok { .. }));
        assert!(manager.active_session.is_none());
        assert!(manager.schedule_suppressed_until.contains_key("sched-work"));

        // 3. Immediately evaluate again at 10:01:00 -> MUST NOT retrigger
        let next_local = chrono::Local.with_ymd_and_hms(2026, 8, 24, 10, 1, 0).single().unwrap();
        let next_utc = next_local.with_timezone(&Utc);
        manager.evaluate_schedules_at(&next_local, &next_utc).expect("eval");
        assert!(manager.active_session.is_none(), "Must stay suppressed after manual stop");

        // 4. Advance time past 17:00 (e.g. 17:01) -> suppression clears
        let evening_local = chrono::Local.with_ymd_and_hms(2026, 8, 24, 17, 1, 0).single().unwrap();
        let evening_utc = evening_local.with_timezone(&Utc);
        manager.evaluate_schedules_at(&evening_local, &evening_utc).expect("eval");
        assert!(manager.schedule_suppressed_until.is_empty());
        assert!(manager.active_session.is_none());
    }

    #[test]
    fn scheduled_session_supersedes_running_manual_session() {
        use chrono::TimeZone;
        let db = TempDb::new();
        let store = db.open();
        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager = SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        reset(&log);

        let sched = Schedule {
            id: "sched-takeover".into(),
            start_time: "14:00".into(),
            end_time: "16:00".into(),
            mode: focus_core::SessionMode::Lockdown,
            days_of_week: vec![1, 2, 3, 4, 5],
            ends_on: None,
        };
        manager.store.create_schedule(&sched).expect("save schedule");

        // Start a manual blocklist session
        start(&mut manager);
        assert_eq!(manager.active_session.as_ref().unwrap().scheduled_schedule_id, None);

        // Schedule window opens at 14:00 Monday
        let monday_local = chrono::Local.with_ymd_and_hms(2026, 8, 24, 14, 0, 0).single().unwrap();
        let monday_utc = monday_local.with_timezone(&Utc);

        manager.evaluate_schedules_at(&monday_local, &monday_utc).expect("eval");
        let active = manager.active_session.as_ref().unwrap();
        assert_eq!(active.scheduled_schedule_id.as_deref(), Some("sched-takeover"));
        assert_eq!(active.mode, focus_core::SessionMode::Lockdown);
    }

    #[test]
    fn stopping_schedule_a_does_not_suppress_schedule_b() {
        use chrono::TimeZone;
        let db = TempDb::new();
        let store = db.open();
        let (fake, log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager = SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");
        reset(&log);

        let sched_a = Schedule {
            id: "sched-a".into(),
            start_time: "09:00".into(),
            end_time: "12:00".into(),
            mode: focus_core::SessionMode::Blocklist,
            days_of_week: vec![1],
            ends_on: None,
        };
        let sched_b = Schedule {
            id: "sched-b".into(),
            start_time: "10:00".into(),
            end_time: "15:00".into(),
            mode: focus_core::SessionMode::Lockdown,
            days_of_week: vec![1],
            ends_on: None,
        };
        manager.store.create_schedule(&sched_a).expect("save sched_a");
        manager.store.create_schedule(&sched_b).expect("save sched_b");

        let t1_local = chrono::Local.with_ymd_and_hms(2026, 8, 24, 9, 30, 0).single().unwrap();
        let t1_utc = t1_local.with_timezone(&Utc);
        manager.evaluate_schedules_at(&t1_local, &t1_utc).expect("eval");
        assert_eq!(manager.active_session.as_ref().unwrap().scheduled_schedule_id.as_deref(), Some("sched-a"));

        manager.handle_request(IpcRequest::StopSession);
        assert!(manager.active_session.is_none());
        assert!(manager.schedule_suppressed_until.contains_key("sched-a"));
        assert!(!manager.schedule_suppressed_until.contains_key("sched-b"));

        let t2_local = chrono::Local.with_ymd_and_hms(2026, 8, 24, 10, 15, 0).single().unwrap();
        let t2_utc = t2_local.with_timezone(&Utc);
        manager.evaluate_schedules_at(&t2_local, &t2_utc).expect("eval");
        assert!(manager.active_session.is_some());
        assert_eq!(manager.active_session.as_ref().unwrap().scheduled_schedule_id.as_deref(), Some("sched-b"));
    }

    #[test]
    fn service_restart_restores_suppression_for_stopped_scheduled_session() {
        let db = TempDb::new();
        let store = db.open();
        let (fake, _log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let manager = SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");

        let sched = Schedule {
            id: "sched-restart".into(),
            start_time: "09:00".into(),
            end_time: "17:00".into(),
            mode: focus_core::SessionMode::Lockdown,
            days_of_week: vec![1],
            ends_on: None,
        };
        manager.store.create_schedule(&sched).expect("save schedule");

        let mut session = Session::new(
            focus_core::SessionMode::Lockdown,
            7200,
            vec![],
            vec![],
            vec![],
            None,
        ).with_scheduled_schedule_id(Some("sched-restart".into()));
        session.started_at = Utc::now();
        session.status = SessionStatus::Stopped;
        session.ended_at = Some(Utc::now());
        manager.store.save_session(&session).expect("save session");

        let store2 = db.open();
        let (fake2, _log2) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let manager2 = SessionManager::with_enforcement(store2, Box::new(fake2)).expect("new manager");

        assert!(manager2.schedule_suppressed_until.contains_key("sched-restart"));
    }

    #[test]
    fn deleting_active_schedule_clears_suppression() {
        let db = TempDb::new();
        let store = db.open();
        let (fake, _log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager = SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");

        let sched = Schedule {
            id: "sched-del".into(),
            start_time: "09:00".into(),
            end_time: "17:00".into(),
            mode: focus_core::SessionMode::Lockdown,
            days_of_week: vec![1],
            ends_on: None,
        };
        manager.store.create_schedule(&sched).expect("save schedule");

        let mut active = Session::new(
            focus_core::SessionMode::Lockdown,
            3600,
            vec![],
            vec![],
            vec![],
            None,
        ).with_scheduled_schedule_id(Some("sched-del".into()));
        active.status = SessionStatus::Active;
        manager.store.save_session(&active).expect("save session");
        manager.active_session = Some(active);

        manager.handle_request(IpcRequest::DeleteSchedule { id: "sched-del".into() });
        assert!(manager.active_session.is_none());
        assert!(!manager.schedule_suppressed_until.contains_key("sched-del"));
    }

    #[test]
    fn schedule_validation_rejects_invalid_and_overlapping() {
        let db = TempDb::new();
        let store = db.open();
        let (fake, _log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager = SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");

        let valid = Schedule {
            id: "s1".into(),
            start_time: "09:00".into(),
            end_time: "12:00".into(),
            mode: focus_core::SessionMode::Lockdown,
            days_of_week: vec![1, 2],
            ends_on: None,
        };
        let resp = manager.handle_request(IpcRequest::CreateSchedule { schedule: valid });
        assert_eq!(resp, IpcResponse::Ok { data: ResponseData::Unit(()) });

        // Overlapping on shared day 2
        let overlap = Schedule {
            id: "s2".into(),
            start_time: "10:00".into(),
            end_time: "14:00".into(),
            mode: focus_core::SessionMode::Blocklist,
            days_of_week: vec![2, 3],
            ends_on: None,
        };
        let resp = manager.handle_request(IpcRequest::CreateSchedule { schedule: overlap });
        assert!(matches!(resp, IpcResponse::Err { .. }));

        // Invalid time
        let invalid_time = Schedule {
            id: "s3".into(),
            start_time: "15:00".into(),
            end_time: "12:00".into(),
            mode: focus_core::SessionMode::Blocklist,
            days_of_week: vec![4],
            ends_on: None,
        };
        let resp = manager.handle_request(IpcRequest::CreateSchedule { schedule: invalid_time });
        assert!(matches!(resp, IpcResponse::Err { .. }));
    }

    #[test]
    fn updating_running_schedule_updates_session_or_ends_if_outside() {
        use chrono::Datelike;
        let db = TempDb::new();
        let store = db.open();
        let (fake, _log) = FakeEnforcer::new(EnforcementMode::KernelEvents);
        let mut manager = SessionManager::with_enforcement(store, Box::new(fake)).expect("manager");

        let sched = Schedule {
            id: "sched-update".into(),
            start_time: "09:00".into(),
            end_time: "17:00".into(),
            mode: focus_core::SessionMode::Blocklist,
            days_of_week: vec![0, 1, 2, 3, 4, 5, 6],
            ends_on: None,
        };
        manager.store.create_schedule(&sched).expect("save schedule");

        let mut active = Session::new(
            focus_core::SessionMode::Blocklist,
            8 * 3600,
            vec![],
            vec![],
            vec![],
            None,
        ).with_scheduled_schedule_id(Some("sched-update".into()));
        active.status = SessionStatus::Active;
        manager.store.save_session(&active).expect("save session");
        manager.active_session = Some(active);

        // Update mode to Lockdown while still running
        let updated = Schedule {
            id: "sched-update".into(),
            start_time: "00:00".into(),
            end_time: "23:59".into(),
            mode: focus_core::SessionMode::Lockdown,
            days_of_week: vec![0, 1, 2, 3, 4, 5, 6],
            ends_on: None,
        };
        manager.handle_request(IpcRequest::UpdateSchedule { schedule: updated });
        assert!(manager.active_session.is_some());
        assert_eq!(manager.active_session.as_ref().unwrap().mode, focus_core::SessionMode::Lockdown);

        // Update schedule to a time window that excludes now (e.g. 01:00-01:01 if not at that time)
        // Set days to empty or day that excludes today
        let today_day = chrono::Local::now().date_naive().weekday().num_days_from_sunday() as u8;
        let other_day = (today_day + 3) % 7;
        let excluded = Schedule {
            id: "sched-update".into(),
            start_time: "00:00".into(),
            end_time: "23:59".into(),
            mode: focus_core::SessionMode::Lockdown,
            days_of_week: vec![other_day],
            ends_on: None,
        };
        manager.handle_request(IpcRequest::UpdateSchedule { schedule: excluded });
        // Session ends because it was edited out of current time!
        assert!(manager.active_session.is_none());
    }

    fn runtime_block_on<F: std::future::Future>(future: F) -> F::Output {
        tokio::runtime::Runtime::new()
            .expect("runtime")
            .block_on(future)
    }
}