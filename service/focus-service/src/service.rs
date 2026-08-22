use crate::session_manager::SessionManager;
use focus_ipc::{IpcServer, RequestHandler};
use std::error::Error;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{watch, Mutex};
use tracing::{error, info};

/// Upper bound for session finalization during shutdown. Bounded so an active
/// tick or IPC handler cannot deadlock the stop path past the SCM wait hint.
const SHUTDOWN_BUDGET: Duration = Duration::from_secs(8);

const STATE_HINT: Duration = Duration::from_secs(10);

/// Resolves once the shutdown flag flips; never errors if the sender goes away.
async fn shutdown_requested(shutdown_rx: &mut watch::Receiver<bool>) {
    loop {
        if *shutdown_rx.borrow_and_update() {
            return;
        }
        if shutdown_rx.changed().await.is_err() {
            // Sender dropped without signal: nothing will ever request stop.
            std::future::pending::<()>().await;
        }
    }
}

/// The single run/shutdown path for both console and Windows-service modes.
///
/// Console mode arms the selector with Ctrl+C; service mode arms it with the
/// control-handler flag. Everything after the await — task teardown, session
/// finalization, error propagation — is identical for both entry points.
pub async fn run_with_shutdown(
    mut shutdown_rx: watch::Receiver<bool>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
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
            tokio::time::sleep(Duration::from_secs(1)).await;
            let mut guard = timer_mgr.lock().await;
            if let Err(e) = guard.tick().await {
                error!("session tick error: {e}");
            }
        }
    });

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            info!("shutdown signal received (console Ctrl+C)");
        }
        _ = shutdown_requested(&mut shutdown_rx) => {
            info!("shutdown signal received (service stop)");
        }
    }

    // Abort background work first so nothing contends for the manager lock
    // while the session is being finalized.
    ipc_task.abort();
    timer_task.abort();
    let _ = tokio::join!(ipc_task, timer_task);
    info!("background tasks stopped");

    // One centralized cleanup: finalize any active session as Stopped.
    let cleanup = async {
        let mut guard = manager.lock().await;
        guard.shutdown().await
    };
    let result = match tokio::time::timeout(SHUTDOWN_BUDGET, cleanup).await {
        Ok(result) => result,
        Err(_) => Err("session shutdown exceeded budget; continuing stop".into()),
    };

    match &result {
        Ok(()) => info!("shutdown complete"),
        Err(e) => error!("shutdown completed with error: {e}"),
    }
    result
}

pub fn run_console() {
    info!("FocusBlock service starting in console mode");
    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
    rt.block_on(async {
        let (_shutdown_tx, shutdown_rx) = watch::channel(false);
        if let Err(e) = run_with_shutdown(shutdown_rx).await {
            error!("service error: {e}");
            std::process::exit(1);
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

    fn report(
        handler: &windows_service::service_control_handler::ServiceStatusHandle,
        state: ServiceState,
        checkpoint: u32,
        exit_code: u32,
        accept_stop: bool,
    ) {
        let _ = handler.set_service_status(ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: state,
            controls_accepted: if accept_stop {
                ServiceControlAccept::STOP
            } else {
                ServiceControlAccept::empty()
            },
            exit_code: ServiceExitCode::Win32(exit_code),
            checkpoint,
            wait_hint: STATE_HINT,
            process_id: None,
        });
    }

    fn my_service_main(_arguments: Vec<OsString>) {
        // Control handler flips the flag only; all cleanup lives on the one
        // shared shutdown path in run_with_shutdown.
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        let event_handler = move |control_event| -> ServiceControlHandlerResult {
            match control_event {
                ServiceControl::Stop | ServiceControl::Shutdown => {
                    let _ = shutdown_tx.send(true);
                    ServiceControlHandlerResult::NoError
                }
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                _ => ServiceControlHandlerResult::NotImplemented,
            }
        };

        let handler = match service_control_handler::register(SERVICE_NAME, event_handler) {
            Ok(handler) => handler,
            Err(e) => {
                error!("failed to register control handler: {e}");
                return;
            }
        };

        report(&handler, ServiceState::StartPending, 1, 0, false);

        let exit_code = if let Ok(rt) = tokio::runtime::Runtime::new() {
            rt.block_on(async {
                report(&handler, ServiceState::Running, 0, 0, true);
                match crate::service::run_with_shutdown(shutdown_rx).await {
                    Ok(()) => 0,
                    Err(e) => {
                        error!("service error: {e}");
                        1
                    }
                }
            })
        } else {
            error!("failed to create tokio runtime");
            1
        };

        // Always land on STOPPED so `sc stop` finishes within the wait hint
        // instead of the SCM killing the process.
        report(&handler, ServiceState::Stopped, 0, exit_code, false);
    }

    service_dispatcher::start(SERVICE_NAME, ffi_service_main)
        .unwrap_or_else(|e| {
            error!("service dispatcher failed: {e}, falling back to console");
            run_console();
        });
}
