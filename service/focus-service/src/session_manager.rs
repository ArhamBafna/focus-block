use crate::app_enforcement::AppEnforcer;
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
    app_enforcer: AppEnforcer,
}

impl SessionManager {
    pub fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let db_path = PathBuf::from(
            std::env::var("ALLUSERSPROFILE").unwrap_or_else(|_| "C:\\ProgramData".into()),
        )
        .join("FocusBlock")
        .join("data.db");
        let store = FocusStore::open(&db_path)?;
        let active_session = store.get_active_session()?;
        let mut mgr = Self {
            store,
            active_session: None,
            app_enforcer: AppEnforcer::default(),
        };

        match active_session {
            Some(session) if session.is_expired() => {
                // Do not mark complete until FocusBlock filters are actually gone.
                // This fails closed if the BFE/WFP service is temporarily unavailable.
                mgr.app_enforcer.clear()?;
                let mut completed = session;
                completed.status = SessionStatus::Completed;
                completed.ended_at = Some(Utc::now());
                mgr.store.save_session(&completed)?;
            }
            Some(session) => {
                // Keep state even when WFP is temporarily unavailable; the 250 ms
                // service tick will retry and process termination remains enabled.
                mgr.active_session = Some(session.clone());
                if let Err(error) = mgr.app_enforcer.apply(&session.app_block_targets_snapshot) {
                    error!("failed to restore app enforcement; will retry: {error}");
                }
            }
            None => {
                // A prior crash before database cleanup can leave only our own
                // persistent filters. Never touch other providers or firewall state.
                if let Err(error) = mgr.app_enforcer.clear() {
                    error!("failed to remove stale FocusBlock filters: {error}");
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

    /// A Windows service stop/restart must preserve active policy. Persistent WFP
    /// filters and the active session snapshot are rehydrated on next start.
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

        // Persist policy before creating persistent WFP rules. A crash in the
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

        // Commit WFP first. If persistence then fails, restore previous policy so
        // disk snapshot and persistent filters never diverge across a restart.
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