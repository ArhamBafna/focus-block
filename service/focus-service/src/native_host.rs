//! Chrome native-messaging bridge. It never owns policy: all requests are
//! forwarded to the Windows service pipe and all responses come from there.

#[cfg(windows)]
mod windows_host {
    use chrono::Utc;
    use focus_core::{BlockingPolicySnapshot, IpcRequest, IpcResponse, ResponseData};
    use focus_ipc::IpcClient;
    use serde::Deserialize;
    use std::io::{self, Read, Write};

    const MAX_NATIVE_MESSAGE_BYTES: usize = 1024 * 1024;

    #[derive(Debug, Deserialize)]
    #[serde(tag = "type", rename_all = "kebab-case")]
    enum NativeRequest {
        GetActivePolicy,
        ServiceRequest { request: IpcRequest },
    }

    pub fn run() -> Result<(), String> {
        validate_origin()?;
        let runtime = tokio::runtime::Runtime::new().map_err(|error| error.to_string())?;
        let stdin = io::stdin();
        let stdout = io::stdout();
        let mut input = stdin.lock();
        let mut output = stdout.lock();

        loop {
            let payload = match read_native_message(&mut input) {
                Ok(Some(payload)) => payload,
                Ok(None) => return Ok(()),
                Err(error) => return Err(error),
            };
            let request: NativeRequest = match serde_json::from_slice(&payload) {
                Ok(request) => request,
                Err(error) => {
                    write_native_message(
                        &mut output,
                        &inactive_policy(Some(format!("invalid native message: {error}"))),
                    )?;
                    continue;
                }
            };

            match request {
                NativeRequest::GetActivePolicy => {
                    let response =
                        runtime.block_on(IpcClient::request(IpcRequest::GetActivePolicy));
                    let policy = match response {
                        Ok(IpcResponse::Ok {
                            data: ResponseData::Policy(policy),
                        }) => policy,
                        Ok(IpcResponse::Err { message }) => inactive_policy(Some(message)),
                        Ok(_) => inactive_policy(Some("unexpected service policy response".into())),
                        Err(error) => {
                            inactive_policy(Some(format!("service unavailable: {error}")))
                        }
                    };
                    write_native_message(&mut output, &policy)?;
                }
                NativeRequest::ServiceRequest { request } => {
                    let response = if native_request_allowed(&request) {
                        runtime
                            .block_on(IpcClient::request(request))
                            .unwrap_or_else(|error| IpcResponse::Err {
                                message: format!("service unavailable: {error}"),
                            })
                    } else {
                        IpcResponse::Err {
                            message: "native request is not allowed".into(),
                        }
                    };
                    write_native_message(&mut output, &response)?;
                }
            }
        }
    }

    /// Normalizes an extension ID or origin to a canonical `chrome-extension://<id>/`.
    pub fn normalize_origin(raw: &str) -> String {
        let trimmed = raw.trim();
        let without_prefix = trimmed
            .strip_prefix("chrome-extension://")
            .unwrap_or(trimmed);
        let id = without_prefix.trim_matches('/');
        format!("chrome-extension://{}/", id.to_ascii_lowercase())
    }

    /// Dedicated permanent development extension ID derived from the committed public key in manifest.json.
    pub const DEV_EXTENSION_ID: &str = "gmlbmoeejgjgmeffemfelecnmbiglfld";

    /// The origins the installed manifest allows, or the environment override.
    /// Chrome enforces `allowed_origins` before it starts this process, so this
    /// is the second lock on the same door; it must not be skipped merely
    /// because the installer never exported an environment variable.
    fn configured_extension_origins() -> Vec<String> {
        let mut origins = Vec::new();
        let dev_origin = normalize_origin(DEV_EXTENSION_ID);
        if !origins.contains(&dev_origin) {
            origins.push(dev_origin);
        }

        if let Ok(id) = std::env::var("FOCUSBLOCK_EXTENSION_ID") {
            let normalized = normalize_origin(&id);
            if normalized != "chrome-extension:///" && !origins.contains(&normalized) {
                origins.push(normalized);
            }
        }

        let mut candidate_dirs = Vec::new();
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                candidate_dirs.push(parent.to_path_buf());
            }
        }
        if let Ok(program_data) = std::env::var("ProgramData") {
            candidate_dirs.push(std::path::PathBuf::from(program_data));
        }
        if let Ok(local_app_data) = std::env::var("LocalAppData") {
            candidate_dirs.push(std::path::PathBuf::from(local_app_data));
        }
        if let Ok(app_data) = std::env::var("AppData") {
            candidate_dirs.push(std::path::PathBuf::from(app_data));
        }

        for dir in candidate_dirs {
            let manifest_paths = [
                dir.join("FocusBlock").join("com.focusblock.bridge.json"),
                dir.join("com.focusblock.bridge.json"),
            ];
            for manifest in manifest_paths {
                if let Ok(text) = std::fs::read_to_string(manifest) {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(arr) = value.get("allowed_origins").and_then(|v| v.as_array()) {
                            for item in arr {
                                if let Some(s) = item.as_str() {
                                    let normalized = normalize_origin(s);
                                    if normalized != "chrome-extension:///" && !origins.contains(&normalized) {
                                        origins.push(normalized);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            let release_id_paths = [
                dir.join("FocusBlock").join("focusblock-web-store-extension-id.txt"),
                dir.join("focusblock-web-store-extension-id.txt"),
            ];
            for release_path in release_id_paths {
                if let Ok(text) = std::fs::read_to_string(release_path) {
                    let trimmed = text.trim();
                    if trimmed.len() == 32 && trimmed.chars().all(|c| c.is_ascii_lowercase() && c <= 'p') {
                        let normalized = normalize_origin(trimmed);
                        if !origins.contains(&normalized) {
                            origins.push(normalized);
                        }
                    }
                }
            }
        }
        origins
    }

    /// Strictly verifies that the origin passed by Chrome in argv[1] matches
    /// one of the configured allowed origins.
    fn origin_argument_matches<O: AsRef<str>>(
        allowed_origins: &[O],
        origin_arg: Option<&str>,
    ) -> bool {
        let Some(arg) = origin_arg else {
            return false;
        };
        let normalized = normalize_origin(arg);
        allowed_origins.iter().any(|allowed| allowed.as_ref() == normalized)
    }

    fn validate_origin() -> Result<(), String> {
        let allowed = configured_extension_origins();
        if allowed.is_empty() {
            // Fail closed: if origin configuration is missing or cannot be read,
            // refuse native requests rather than opening an unvalidated bridge.
            return Err("no allowed extension origins configured in manifest or environment".into());
        }
        // Chrome strictly passes the caller's origin as the very first command line argument (argv[1]).
        let first_arg = std::env::args().nth(1);
        if origin_argument_matches(&allowed, first_arg.as_deref()) {
            Ok(())
        } else {
            Err("native host origin did not match any configured extension".into())
        }
    }

    fn native_request_allowed(request: &IpcRequest) -> bool {
        // A browser client may read state, but may not modify configuration,
        // history, or start/stop sessions. Starting a session is reserved for
        // the desktop app to prevent asymmetric lockout vectors over native messaging.
        matches!(
            request,
            IpcRequest::Ping
                | IpcRequest::Health
                | IpcRequest::GetStatus
                | IpcRequest::ListBlocklist
                | IpcRequest::ListWhitelist
                | IpcRequest::ListPresets
                | IpcRequest::ListHistory { .. }
                | IpcRequest::GetSettings
        )
    }

    fn inactive_policy(error: Option<String>) -> BlockingPolicySnapshot {
        // Keep this JSON shape identical to a live service response so the
        // extension can safely decide whether to retain its cached snapshot.
        BlockingPolicySnapshot {
            active: false,
            mode: None,
            blocklist: Vec::new(),
            whitelist: Vec::new(),
            blocked_domains: Vec::new(),
            allowed_domains: Vec::new(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            expires_at: Some(Utc::now()),
            error,
        }
    }

    fn read_native_message(input: &mut impl Read) -> Result<Option<Vec<u8>>, String> {
        let mut length = [0u8; 4];
        match input.read_exact(&mut length) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
            Err(error) => return Err(format!("failed to read native message length: {error}")),
        }
        let length = u32::from_le_bytes(length) as usize;
        if length > MAX_NATIVE_MESSAGE_BYTES {
            return Err("native message exceeds size limit".into());
        }
        let mut payload = vec![0u8; length];
        input
            .read_exact(&mut payload)
            .map_err(|error| format!("failed to read native message: {error}"))?;
        Ok(Some(payload))
    }

    fn write_native_message(
        value: &mut impl Write,
        message: &impl serde::Serialize,
    ) -> Result<(), String> {
        let payload = serde_json::to_vec(message).map_err(|error| error.to_string())?;
        if payload.len() > MAX_NATIVE_MESSAGE_BYTES {
            return Err("native response exceeds size limit".into());
        }
        value
            .write_all(&(payload.len() as u32).to_le_bytes())
            .and_then(|()| value.write_all(&payload))
            .and_then(|()| value.flush())
            .map_err(|error| format!("failed to write native response: {error}"))
    }

    #[cfg(test)]
    mod tests {
        use super::native_request_allowed;
        use focus_core::IpcRequest;

        #[test]
        fn browser_requests_cannot_rewrite_desktop_configuration() {
            // The policy read has its own arm in `run()`, so it is deliberately
            // not part of the passthrough allowlist.
            assert!(!native_request_allowed(&IpcRequest::GetActivePolicy));

            // Schedule and app-block management stay desktop-only: a browser
            // client must not add, edit, or delete the desktop user's rules.
            for denied in [
                IpcRequest::ListSchedules,
                IpcRequest::CreateSchedule {
                    schedule: focus_core::Schedule {
                        id: "s1".into(),
                        start_time: "09:00".into(),
                        end_time: "10:00".into(),
                        mode: focus_core::SessionMode::Blocklist,
                        days_of_week: vec![1],
                        ends_on: None,
                    },
                },
                IpcRequest::DeleteSchedule { id: "s1".into() },
                IpcRequest::ListAppBlockTargets,
                IpcRequest::ClearLastBlockedApp,
                // Anything that erases history or rewrites settings/presets is
                // desktop-only as well; a browser origin must not be able to
                // change how the desktop app behaves.
                IpcRequest::ClearHistory,
                IpcRequest::UpdateSettings {
                    os_allowlist_enabled: false,
                },
                IpcRequest::CreatePreset {
                    name: "p".into(),
                    mode: focus_core::SessionMode::Blocklist,
                    duration_minutes: 25,
                    blocklist: Vec::new(),
                    whitelist: Vec::new(),
                },
                IpcRequest::DeletePreset {
                    id: uuid::Uuid::nil(),
                },
                // Even list mutations are writes: a browser client must not
                // change which sites the desktop session blocks.
                IpcRequest::AddBlocklist {
                    domain: "evil.example".into(),
                },
                IpcRequest::RemoveBlocklist { id: 1 },
                IpcRequest::AddWhitelist {
                    domain: "evil.example".into(),
                },
                IpcRequest::RemoveWhitelist { id: 1 },
            ] {
                assert!(!native_request_allowed(&denied), "{denied:?}");
            }

            // Reading state is the designed bridge surface.
            assert!(native_request_allowed(&IpcRequest::GetStatus));
            assert!(native_request_allowed(&IpcRequest::ListBlocklist));

            // Starting or ending a desktop session must go through the desktop app, which
            // owns the session lifecycle and stop challenge; the browser bridge must not be a bypass
            // or an asymmetric lockout vector.
            assert!(!native_request_allowed(&IpcRequest::StartSession {
                mode: focus_core::SessionMode::Blocklist,
                duration_minutes: 25,
                preset_id: None,
            }));
            assert!(!native_request_allowed(&IpcRequest::StopSession));
        }

        #[test]
        fn origin_check_only_accepts_the_configured_extension() {
            use super::{normalize_origin, origin_argument_matches};

            let allowed = [
                "chrome-extension://abcdefghijklmnopabcdefghijklmnop/",
                "chrome-extension://secondallowedextensionid000000000/",
            ];
            // Matches identical canonical origin
            assert!(origin_argument_matches(
                &allowed,
                Some("chrome-extension://abcdefghijklmnopabcdefghijklmnop/")
            ));
            // Matches second allowed origin
            assert!(origin_argument_matches(
                &allowed,
                Some("chrome-extension://secondallowedextensionid000000000/")
            ));
            // Normalizes raw IDs without prefix or with mixed case/whitespace/slashes
            assert!(origin_argument_matches(
                &allowed,
                Some(" ABCDEFGHijklmnopABCDEFGHijklmnop/ ")
            ));
            assert_eq!(
                normalize_origin("abcdef/"),
                "chrome-extension://abcdef/"
            );

            // Rejects unknown extensions, non-origin arguments, and missing arguments
            assert!(!origin_argument_matches(
                &allowed,
                Some("chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba/")
            ));
            assert!(!origin_argument_matches(&allowed, Some("--parent-window=0")));
            assert!(!origin_argument_matches(&allowed, None));
        }

        #[test]
        fn configured_origins_always_includes_permanent_dev_extension_id() {
            use super::{configured_extension_origins, DEV_EXTENSION_ID};

            let origins = configured_extension_origins();
            let expected_dev = format!("chrome-extension://{}/", DEV_EXTENSION_ID);
            assert!(
                origins.contains(&expected_dev),
                "origins should contain permanent dev extension ID"
            );
        }
    }
}

#[cfg(windows)]
fn main() {
    if let Err(error) = windows_host::run() {
        // Native messaging reserves stdout for framed JSON only.
        eprintln!("focus-native-host: {error}");
        std::process::exit(1);
    }
}

#[cfg(not(windows))]
fn main() {
    eprintln!("focus-native-host is only available on Windows");
    std::process::exit(1);
}
