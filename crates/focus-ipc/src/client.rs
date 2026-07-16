#[cfg(windows)]
mod imp {
    use focus_core::protocol::PIPE_NAME;
    use focus_core::{IpcRequest, IpcResponse};
    use std::io;
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::windows::named_pipe::ClientOptions;

    pub struct IpcClient;

    impl IpcClient {
        pub async fn request(req: IpcRequest) -> io::Result<IpcResponse> {
            let mut client = loop {
                match ClientOptions::new().open(PIPE_NAME) {
                    Ok(c) => break c,
                    Err(e) if e.kind() == io::ErrorKind::WouldBlock || e.raw_os_error() == Some(231) => {
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

        pub async fn ping() -> bool {
            Self::request(IpcRequest::Ping).await
                .map(|r| matches!(r, IpcResponse::Ok { .. }))
                .unwrap_or(false)
        }

        pub async fn with_timeout(req: IpcRequest, _timeout: Duration) -> io::Result<IpcResponse> {
            Self::request(req).await
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use focus_core::{IpcRequest, IpcResponse};
    use std::io;

    pub struct IpcClient;

    impl IpcClient {
        pub fn request(_req: IpcRequest) -> io::Result<IpcResponse> {
            Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "IPC only supported on Windows",
            ))
        }

        pub fn ping() -> bool {
            false
        }
    }
}

pub use imp::IpcClient;
