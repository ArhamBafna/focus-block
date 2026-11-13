mod app_enforcement;
mod enforcement;
mod service;
mod session_manager;

// Test-only: the fake enforcer, guarded-run prerequisites, and the real
// enforcement checks. None of this is compiled into a shipped service.
#[cfg(test)]
mod real_enforcement;
#[cfg(test)]
mod test_support;

use tracing_subscriber::EnvFilter;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                // Without these directives the env filter's implicit default is
                // ERROR, which would hide the store's corrupt-row warnings —
                // the only signal that saved data is being silently dropped.
                .add_directive("focus_service=info".parse().unwrap())
                .add_directive("focus_ipc=info".parse().unwrap())
                .add_directive("focus_store=info".parse().unwrap())
                .add_directive("focus_core=info".parse().unwrap()),
        )
        .init();

    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--console") {
        service::run_console();
    } else {
        #[cfg(windows)]
        service::run_windows_service();
        #[cfg(not(windows))]
        service::run_console();
    }
}
