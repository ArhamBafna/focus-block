use crate::session_manager::SessionManager;
use focus_ipc::{IpcServer, RequestHandler};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info};

pub fn run_console() {
    info!("FocusBlock service starting in console mode");
    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
    rt.block_on(async {
        if let Err(e) = run_async().await {
            error!("service error: {e}");
        }
    });
}

#[cfg(windows)]
pub fn run_windows_service() {
    use std::ffi::OsString;
    use windows_service::service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    };
    use windows_service::service_control_handler::{self, ServiceControlHandlerResult};
    use windows_service::{define_windows_service, service_dispatcher};

    const SERVICE_NAME: &str = "FocusBlockService";

    define_windows_service!(ffi_service_main, my_service_main);

    fn my_service_main(_arguments: Vec<OsString>) {
        let event_handler = move |control_event| -> ServiceControlHandlerResult {
            match control_event {
                ServiceControl::Stop => ServiceControlHandlerResult::NoError,
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                _ => ServiceControlHandlerResult::NotImplemented,
            }
        };

        if let Ok(handler) = service_control_handler::register(SERVICE_NAME, event_handler) {
            let status = ServiceStatus {
                service_type: ServiceType::OWN_PROCESS,
                current_state: ServiceState::Running,
                controls_accepted: ServiceControlAccept::STOP,
                exit_code: ServiceExitCode::Win32(0),
                checkpoint: 0,
                wait_hint: std::time::Duration::default(),
                process_id: None,
            };
            let _ = handler.set_service_status(status);

            if let Ok(rt) = tokio::runtime::Runtime::new() {
                rt.block_on(async {
                    let _ = crate::service::run_async().await;
                });
            }
        }
    }

    service_dispatcher::start(SERVICE_NAME, ffi_service_main)
        .unwrap_or_else(|e| {
            error!("service dispatcher failed: {e}, falling back to console");
            run_console();
        });
}

async fn run_async() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let manager = Arc::new(Mutex::new(SessionManager::new()?));
    let mgr_ipc = Arc::clone(&manager);

    let handler: RequestHandler = Arc::new(move |req| {
        let mgr_ipc = Arc::clone(&mgr_ipc);
        Box::pin(async move {
            let mut guard = mgr_ipc.lock().await;
            guard.handle_request(req)
        })
    });

    let ipc = IpcServer::new(handler);
    let ipc_task = tokio::spawn(async move {
        if let Err(e) = ipc.run().await {
            error!("ipc server stopped: {e}");
        }
    });

    let timer_mgr = Arc::clone(&manager);
    let timer_task = tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            let mut guard = timer_mgr.lock().await;
            if let Err(e) = guard.tick().await {
                error!("session tick error: {e}");
            }
        }
    });

    tokio::signal::ctrl_c().await?;
    info!("shutdown signal received");
    {
        let mut guard = manager.lock().await;
        guard.shutdown().await?;
    }
    ipc_task.abort();
    timer_task.abort();
    Ok(())
}
