#[cfg(windows)]
mod imp {
    use focus_core::protocol::PIPE_NAME;
    use focus_core::{IpcRequest, IpcResponse};
    use std::io;
    use std::time::{Duration, Instant};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::windows::named_pipe::ClientOptions;

    /// Upper bound for a full request: connect retries + write + read.
    pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);

    fn timeout_error() -> io::Error {
        io::Error::new(io::ErrorKind::TimedOut, "IPC request timed out")
    }

    pub struct IpcClient;

    impl IpcClient {
        pub async fn request(req: IpcRequest) -> io::Result<IpcResponse> {
            Self::with_timeout(req, DEFAULT_TIMEOUT).await
        }

        pub async fn ping() -> bool {
            Self::request(IpcRequest::Ping).await
                .map(|r| matches!(r, IpcResponse::Ok { .. }))
                .unwrap_or(false)
        }

        /// Runs the request under a hard deadline. Connect retries stop at the
        /// deadline; any stalled read or write is dropped by the outer guard,
        /// so a stuck service surfaces an error instead of hanging forever.
        pub async fn with_timeout(req: IpcRequest, timeout: Duration) -> io::Result<IpcResponse> {
            let deadline = Instant::now() + timeout;
            match tokio::time::timeout(timeout, Self::request_inner(req, deadline)).await {
                Ok(result) => result,
                Err(_) => Err(timeout_error()),
            }
        }

        async fn request_inner(req: IpcRequest, deadline: Instant) -> io::Result<IpcResponse> {
            let mut client = loop {
                match ClientOptions::new().open(PIPE_NAME) {
                    Ok(c) => break c,
                    Err(e) if e.kind() == io::ErrorKind::WouldBlock || e.raw_os_error() == Some(231) => {
                        if Instant::now() >= deadline {
                            return Err(timeout_error());
                        }
                        tokio::time::sleep(Duration::from_millis(50)).await;
                        continue;
                    }
                    Err(e) => return Err(e),
                }
            };
            let payload = serde_json::to_vec(&req)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            client.write_u32_le(payload.len() as u32).await?;
            client.write_all(&payload).await?;
            client.flush().await?;

            let len = client.read_u32_le().await? as usize;
            let mut buf = vec![0u8; len];
            client.read_exact(&mut buf).await?;
            serde_json::from_slice(&buf).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use focus_core::{IpcRequest, IpcResponse};
    use std::io;
    use std::time::Duration;

    pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);

    fn unsupported() -> io::Error {
        io::Error::new(io::ErrorKind::Unsupported, "IPC only supported on Windows")
    }

    pub struct IpcClient;

    impl IpcClient {
        pub async fn request(_req: IpcRequest) -> io::Result<IpcResponse> {
            Err(unsupported())
        }

        pub async fn ping() -> bool {
            false
        }

        /// Same API shape as the Windows implementation; always unsupported.
        pub async fn with_timeout(_req: IpcRequest, _timeout: Duration) -> io::Result<IpcResponse> {
            Err(unsupported())
        }
    }
}

pub use imp::IpcClient;
