//! Chrome native-messaging bridge. It never owns policy: all requests are
//! forwarded to the Windows service pipe and all responses come from there.

#[cfg(windows)]
mod windows_host {
    use chrono::Utc;
    use focus_core::{
        BlockingPolicySnapshot, IpcRequest, IpcResponse, ResponseData,
    };
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
                        &IpcResponse::Err {
                            message: format!("invalid native message: {error}"),
                        },
                    )?;
                    continue;
                }
            };

            match request {
                NativeRequest::GetActivePolicy => {
                    let response = runtime.block_on(IpcClient::request(IpcRequest::GetActivePolicy));
                    let policy = match response {
                        Ok(IpcResponse::Ok {
                            data: ResponseData::Policy(policy),
                        }) => policy,
                        Ok(IpcResponse::Err { message }) => inactive_policy(Some(message)),
                        Ok(_) => inactive_policy(Some("unexpected service policy response".into())),
                        Err(error) => inactive_policy(Some(format!("service unavailable: {error}"))),
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

    fn validate_origin() -> Result<(), String> {
        let Ok(extension_id) = std::env::var("FOCUSBLOCK_EXTENSION_ID") else {
            return Ok(());
        };
        let extension_id = extension_id.trim();
        if extension_id.is_empty() {
            return Ok(());
        }
        let expected = format!("chrome-extension://{extension_id}/");
        if std::env::args().skip(1).any(|argument| argument == expected) {
            Ok(())
        } else {
            Err("native host origin did not match FOCUSBLOCK_EXTENSION_ID".into())
        }
    }

    fn native_request_allowed(request: &IpcRequest) -> bool {
        matches!(
            request,
            IpcRequest::Ping
                | IpcRequest::Health
                | IpcRequest::GetStatus
                | IpcRequest::ListBlocklist
                | IpcRequest::AddBlocklist { .. }
                | IpcRequest::RemoveBlocklist { .. }
                | IpcRequest::ListWhitelist
                | IpcRequest::AddWhitelist { .. }
                | IpcRequest::RemoveWhitelist { .. }
                | IpcRequest::ListPresets
                | IpcRequest::CreatePreset { .. }
                | IpcRequest::DeletePreset { .. }
                | IpcRequest::StartSession { .. }
                | IpcRequest::StopSession
                | IpcRequest::ListHistory { .. }
                | IpcRequest::ClearHistory
                | IpcRequest::GetSettings
                | IpcRequest::UpdateSettings { .. }
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

    fn write_native_message(value: &mut impl Write, message: &impl serde::Serialize) -> Result<(), String> {
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
