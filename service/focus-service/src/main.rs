mod service;
mod session_manager;

use tracing_subscriber::EnvFilter;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("focus_service=info".parse().unwrap())
                .add_directive("focus_ipc=info".parse().unwrap())
                .add_directive("focus_dns=info".parse().unwrap())
                .add_directive("focus_wfp=info".parse().unwrap())
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
