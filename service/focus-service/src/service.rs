use crate::session_manager::SessionManager;
use focus_ipc::{IpcServer, RequestHandler};
use std::sync::Arc;
use tokio::sync::{watch, Mutex};
use tracing::{error, info, warn};

const SERVICE_NAME: &str = "FocusBlockService";

pub fn run_console() {
    info!("FocusBlock service starting in console mode");
    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
    rt.block_on(async {
        if let Err(error) = run_async(None).await {
            error!("service error: {error}");
        }
    });
}

#[cfg(windows)]
pub fn run_windows_service() {
    use std::ffi::OsString;
    use std::sync::{Arc, Mutex as StdMutex};
    use windows_service::service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    };
    use windows_service::service_control_handler::{self, ServiceControlHandlerResult};
    use windows_service::{define_windows_service, service_dispatcher};

    define_windows_service!(ffi_service_main, my_service_main);

    fn service_status(
        state: ServiceState,
        controls: ServiceControlAccept,
        exit_code: u32,
    ) -> ServiceStatus {
        ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: state,
            controls_accepted: controls,
            exit_code: ServiceExitCode::Win32(exit_code),
            checkpoint: 0,
            wait_hint: std::time::Duration::from_secs(5),
            process_id: None,
        }
    }

    fn my_service_main(_arguments: Vec<OsString>) {
        let (stop_tx, stop_rx) = watch::channel(false);
        let status_handle = Arc::new(StdMutex::new(None::<
            service_control_handler::ServiceStatusHandle,
        >));
        let status_for_handler = Arc::clone(&status_handle);
        let event_handler = move |control_event| -> ServiceControlHandlerResult {
            match control_event {
                ServiceControl::Stop | ServiceControl::Shutdown | ServiceControl::Preshutdown => {
                    if let Ok(handle) = status_for_handler.lock() {
                        if let Some(handle) = handle.as_ref() {
                            let _ = handle.set_service_status(service_status(
                                ServiceState::StopPending,
                                ServiceControlAccept::empty(),
                                0,
                            ));
                        }
                    }
                    let _ = stop_tx.send(true);
                    ServiceControlHandlerResult::NoError
                }
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                _ => ServiceControlHandlerResult::NotImplemented,
            }
        };

        let handler = match service_control_handler::register(SERVICE_NAME, event_handler) {
            Ok(handler) => handler,
            Err(error) => {
                error!("service control registration failed: {error}");
                return;
            }
        };
        if let Ok(mut handle) = status_handle.lock() {
            *handle = Some(handler);
        }

        let running_controls = ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN;
        if let Ok(handle) = status_handle.lock() {
            if let Some(handle) = handle.as_ref() {
                let _ = handle.set_service_status(service_status(
                    ServiceState::Running,
                    running_controls,
                    0,
                ));
            }
        };
        if let Err(error) = configure_service_recovery() {
            warn!("unable to configure service recovery: {error}");
        }

        let result = tokio::runtime::Runtime::new()
            .map_err(|error| error.to_string())
            .and_then(|rt| rt.block_on(run_async(Some(stop_rx))).map_err(|error| error.to_string()));
        let exit_code = match result {
            Ok(()) => 0,
            Err(error) => {
                error!("service runtime failed: {error}");
                1
            }
        };

        {
            let handle = status_handle
                .lock()
                .map_err(|_| ())
                .ok();
            if let Some(handle) = handle.as_ref().and_then(|handle| handle.as_ref()) {
                let _ = handle.set_service_status(service_status(
                    ServiceState::Stopped,
                    ServiceControlAccept::empty(),
                    exit_code,
                ));
            }
        }
    }

    service_dispatcher::start(SERVICE_NAME, ffi_service_main).unwrap_or_else(|error| {
        error!("service dispatcher failed: {error}; falling back to console");
        run_console();
    });
}

#[cfg(windows)]
fn configure_service_recovery() -> Result<(), String> {
    use std::ptr;
    use windows_sys::Win32::System::Services::{
        ChangeServiceConfig2W, CloseServiceHandle, OpenSCManagerW, OpenServiceW, SC_ACTION,
        SC_ACTION_RESTART, SC_MANAGER_CONNECT, SERVICE_CHANGE_CONFIG,
        SERVICE_CONFIG_FAILURE_ACTIONS, SERVICE_CONFIG_FAILURE_ACTIONS_FLAG,
        SERVICE_FAILURE_ACTIONS_FLAG, SERVICE_FAILURE_ACTIONSW,
    };

    let service_name: Vec<u16> = SERVICE_NAME.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let scm = OpenSCManagerW(ptr::null(), ptr::null(), SC_MANAGER_CONNECT);
        if scm.is_null() {
            return Err("OpenSCManagerW failed".into());
        }
        let service = OpenServiceW(scm, service_name.as_ptr(), SERVICE_CHANGE_CONFIG);
        if service.is_null() {
            let _ = CloseServiceHandle(scm);
            return Err("OpenServiceW failed".into());
        }

        let mut actions = [
            SC_ACTION {
                Type: SC_ACTION_RESTART,
                Delay: 5_000,
            },
            SC_ACTION {
                Type: SC_ACTION_RESTART,
                Delay: 5_000,
            },
            SC_ACTION {
                Type: SC_ACTION_RESTART,
                Delay: 15_000,
            },
        ];
        let mut failure_actions = SERVICE_FAILURE_ACTIONSW {
            dwResetPeriod: 86_400,
            lpRebootMsg: ptr::null_mut(),
            lpCommand: ptr::null_mut(),
            cActions: actions.len() as u32,
            lpsaActions: actions.as_mut_ptr(),
        };
        let mut failure_flag = SERVICE_FAILURE_ACTIONS_FLAG {
            // Normal service stop exits cleanly; recovery is for actual failures.
            fFailureActionsOnNonCrashFailures: 0,
        };
        let actions_ok = ChangeServiceConfig2W(
            service,
            SERVICE_CONFIG_FAILURE_ACTIONS,
            (&mut failure_actions as *mut SERVICE_FAILURE_ACTIONSW).cast(),
        ) != 0;
        let flag_ok = ChangeServiceConfig2W(
            service,
            SERVICE_CONFIG_FAILURE_ACTIONS_FLAG,
            (&mut failure_flag as *mut SERVICE_FAILURE_ACTIONS_FLAG).cast(),
        ) != 0;
        let _ = CloseServiceHandle(service);
        let _ = CloseServiceHandle(scm);
        if actions_ok && flag_ok {
            Ok(())
        } else {
            Err("ChangeServiceConfig2W failed".into())
        }
    }
}

async fn run_async(
    stop_rx: Option<watch::Receiver<bool>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
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
        if let Err(error) = ipc.run().await {
            error!("ipc server stopped: {error}");
        }
    });

    let timer_mgr = Arc::clone(&manager);
    let timer_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(250));
        loop {
            interval.tick().await;
            let mut guard = timer_mgr.lock().await;
            if let Err(error) = guard.tick().await {
                error!("session tick error: {error}");
            }
        }
    });

    wait_for_stop(stop_rx).await;
    info!("service shutdown signal received; preserving active policy for restart");
    {
        let mut guard = manager.lock().await;
        guard.shutdown().await?;
    }
    ipc_task.abort();
    timer_task.abort();
    Ok(())
}

async fn wait_for_stop(mut stop_rx: Option<watch::Receiver<bool>>) {
    match stop_rx.as_mut() {
        Some(receiver) => {
            if !*receiver.borrow() {
                let _ = receiver.changed().await;
            }
        }
        None => {
            let _ = tokio::signal::ctrl_c().await;
        }
    }
}
