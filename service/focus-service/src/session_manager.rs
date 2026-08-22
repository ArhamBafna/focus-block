use chrono::Utc;
use focus_core::{
    ActiveSessionView, AppSettings, IpcRequest, IpcResponse, ResponseData,
    ServiceHealth, ServiceStatus, Session, SessionEndReason,
};
use focus_store::FocusStore;
use std::path::PathBuf;
use tracing::{error, info};

pub struct SessionManager {
    store: FocusStore,
    active_session: Option<Session>,
}

impl SessionManager {
    pub fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let db_path =
            PathBuf::from(std::env::var("ALLUSERSPROFILE").unwrap_or_else(|_| "C:\\ProgramData".into()))
                .join("FocusBlock")
                .join("data.db");
        
        let store = FocusStore::open(&db_path)?;
        
        let active_session = store.get_active_session()?;
        let mut mgr = Self {
            store,
            active_session: None,
        };

        if let Some(session) = active_session {
            if !session.is_expired() {
                if let Err(e) = mgr.start_enforcement(&session) {
                    error!("Failed to restart enforcement: {}", e);
                }
            } else {
                mgr.stop_enforcement();
                let mut s = session.clone();
                s.end(SessionEndReason::Completed);
                let _ = mgr.store.save_session(&s);
            }
        }

        Ok(mgr)
    }

    pub fn handle_request(&mut self, req: IpcRequest) -> IpcResponse {
        match req {
            IpcRequest::Ping => IpcResponse::Ok { data: ResponseData::Unit(()) },
            IpcRequest::Health => {
                let health = ServiceHealth {
                    running: true,
                    version: env!("CARGO_PKG_VERSION").to_string(),
                };
                IpcResponse::Ok { data: ResponseData::Health(health) }
            }
            IpcRequest::GetStatus => {
                let health = ServiceHealth {
                    running: true,
                    version: env!("CARGO_PKG_VERSION").to_string(),
                };
                let session_view = self.active_session.clone().map(|session| ActiveSessionView {
                    elapsed_sec: (Utc::now() - session.started_at).num_seconds().max(0) as u64,
                    remaining_sec: session.remaining_sec(),
                    session,
                });
                IpcResponse::Ok { data: ResponseData::Status(ServiceStatus { health, active_session: session_view }) }
            }
            IpcRequest::ListBlocklist => match self.store.list_blocklist() {
                Ok(domains) => IpcResponse::Ok { data: ResponseData::Domains(domains) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::AddBlocklist { domain } => match self.store.add_blocklist(&domain) {
                Ok(id) => IpcResponse::Ok { data: ResponseData::Id(id) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::RemoveBlocklist { id } => match self.store.remove_blocklist(id) {
                Ok(_) => IpcResponse::Ok { data: ResponseData::Unit(()) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::ListWhitelist => match self.store.list_whitelist() {
                Ok(domains) => IpcResponse::Ok { data: ResponseData::Domains(domains) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::AddWhitelist { domain } => match self.store.add_whitelist(&domain) {
                Ok(id) => IpcResponse::Ok { data: ResponseData::Id(id) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::RemoveWhitelist { id } => match self.store.remove_whitelist(id) {
                Ok(_) => IpcResponse::Ok { data: ResponseData::Unit(()) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::ListPresets => match self.store.list_presets() {
                Ok(presets) => IpcResponse::Ok { data: ResponseData::Presets(presets) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::CreatePreset { name, mode, duration_minutes, blocklist, whitelist } => {
                match self.store.create_preset(&name, mode, duration_minutes, blocklist, whitelist) {
                    Ok(_) => IpcResponse::Ok { data: ResponseData::Unit(()) },
                    Err(e) => IpcResponse::Err { message: e.to_string() },
                }
            }
            IpcRequest::DeletePreset { id } => match self.store.delete_preset(id) {
                Ok(_) => IpcResponse::Ok { data: ResponseData::Unit(()) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::StartSession { mode, duration_minutes, preset_id } => {
                if self.active_session.is_some() {
                    return IpcResponse::Err { message: "Session already active".into() };
                }

                let blocklist = self.store.blocklist_domains().unwrap_or_default();
                let whitelist = self.store.whitelist_domains().unwrap_or_default();

                let session = Session::new(mode, (duration_minutes as u64) * 60, blocklist, whitelist, preset_id);
                
                if let Err(e) = self.start_enforcement(&session) {
                    error!("Failed to start enforcement: {}", e);
                    return IpcResponse::Err { message: format!("Enforcement failed: {}", e) };
                }

                if let Err(e) = self.store.save_session(&session) {
                    error!("Failed to save session: {}", e);
                }
                
                IpcResponse::Ok { data: ResponseData::Unit(()) }
            }
            IpcRequest::StopSession => {
                if let Some(mut session) = self.active_session.take() {
                    session.end(SessionEndReason::Stopped);

                    self.stop_enforcement();

                    if let Err(e) = self.store.save_session(&session) {
                        error!("Failed to save stopped session: {}", e);
                    }
                }
                IpcResponse::Ok { data: ResponseData::Unit(()) }
            }
            IpcRequest::ListHistory { limit } => match self.store.list_history(limit) {
                Ok(sessions) => IpcResponse::Ok { data: ResponseData::Sessions(sessions) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::ClearHistory => match self.store.clear_history() {
                Ok(()) => IpcResponse::Ok { data: ResponseData::Unit(()) },
                Err(e) => IpcResponse::Err { message: e.to_string() },
            },
            IpcRequest::GetSettings => {
                let os_allowlist_enabled = self.store.get_setting_bool("os_allowlist_enabled").unwrap_or(true);
                IpcResponse::Ok { data: ResponseData::Settings(AppSettings { os_allowlist_enabled }) }
            }
            IpcRequest::UpdateSettings { os_allowlist_enabled } => {
                if let Err(e) = self.store.set_setting("os_allowlist_enabled", if os_allowlist_enabled { "true" } else { "false" }) {
                    IpcResponse::Err { message: e.to_string() }
                } else {
                    IpcResponse::Ok { data: ResponseData::Unit(()) }
                }
            }
        }
    }

    pub async fn tick(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(session) = &self.active_session {
            if session.is_expired() {
                info!("Session expired, stopping");
                let mut s = self.active_session.take().unwrap();
                s.end(SessionEndReason::Completed);
                self.stop_enforcement();
                if let Err(e) = self.store.save_session(&s) {
                    error!("Failed to save completed session: {}", e);
                }
            }
        }
        Ok(())
    }

    pub async fn shutdown(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(mut session) = self.active_session.take() {
            session.end(SessionEndReason::Stopped);
            self.stop_enforcement();
            let _ = self.store.save_session(&session);
        }
        Ok(())
    }

    fn start_enforcement(&mut self, session: &Session) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Starting enforcement for session");
        
        self.active_session = Some(session.clone());

        Ok(())
    }

    fn stop_enforcement(&mut self) {
        info!("Stopping enforcement");
    }
}
