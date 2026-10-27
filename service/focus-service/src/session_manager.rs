use crate::app_enforcement::AppEnforcer;
use crate::enforcement::Enforcement;
use chrono::{Duration, Utc};
use focus_core::{
    ActiveSessionView, AppBlockTargetList, AppSettings, BlockingPolicySnapshot, IpcRequest,
    IpcResponse, ResponseData, ServiceHealth, ServiceStatus, Session, SessionStatus,
};
use focus_store::FocusStore;
use std::path::PathBuf;
use tracing::{error, info};

pub struct SessionManager {
    store: FocusStore,
    active_session: Option<Session>,
    app_enforcer: Box<dyn Enforcement>,
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
        let mut mgr = Self {
            store,
            active_session: None,
            app_enforcer,
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

    fn runtime_block_on<F: std::future::Future>(future: F) -> F::Output {
        tokio::runtime::Runtime::new()
            .expect("runtime")
            .block_on(future)
    }
}