#[cfg(windows)]
mod imp {
    use crate::codec::{read_message, write_message};
    use focus_core::protocol::PIPE_NAME;
    use focus_core::{IpcRequest, IpcResponse};
    use std::future::Future;
    use std::io;
    use std::pin::Pin;
    use std::sync::Arc;
    use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};
    use tracing::{error, info};

    pub type RequestHandler = Arc<
        dyn Fn(IpcRequest) -> Pin<Box<dyn Future<Output = IpcResponse> + Send>> + Send + Sync,
    >;

    pub struct IpcServer {
        handler: RequestHandler,
    }

    impl IpcServer {
        pub fn new(handler: RequestHandler) -> Self {
            Self { handler }
        }

        pub async fn run(&self) -> io::Result<()> {
            info!("IPC server listening on {}", PIPE_NAME);

            // Pre-create the first instance so we're ready before the loop.
            let mut pending = ServerOptions::new()
                .first_pipe_instance(true)
                .create(PIPE_NAME)?;

            loop {
                // Wait for a client to connect to the current pending instance.
                pending.connect().await?;
                let connected = pending;

                // Immediately create the NEXT instance so it's waiting before
                // we hand off the connected one — eliminates the accept-gap that
                // caused OS error 231 (all pipe instances busy).
                pending = ServerOptions::new().create(PIPE_NAME)?;

                let handler = Arc::clone(&self.handler);
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(connected, handler).await {
                        if e.raw_os_error() == Some(232) {
                            tracing::debug!("client closed ipc connection early: {e}");
                        } else {
                            error!("ipc connection error: {e}");
                        }
                    }
                });
            }
        }
    }

    async fn handle_connection(
        mut pipe: NamedPipeServer,
        handler: RequestHandler,
    ) -> io::Result<()> {
        let req = read_message(&mut pipe).await?;
        let response = handler(req).await;
        write_message(&mut pipe, &response).await?;
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    use focus_core::{IpcRequest, IpcResponse};
    use std::future::Future;
    use std::io;
    use std::pin::Pin;
    use std::sync::Arc;

    pub type RequestHandler = Arc<
        dyn Fn(IpcRequest) -> Pin<Box<dyn Future<Output = IpcResponse> + Send>> + Send + Sync,
    >;

    pub struct IpcServer {
        _handler: RequestHandler,
    }

    impl IpcServer {
        pub fn new(handler: RequestHandler) -> Self {
            Self { _handler: handler }
        }

        pub async fn run(&self) -> io::Result<()> {
            Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "IPC only supported on Windows",
            ))
        }
    }
}

pub use imp::{IpcServer, RequestHandler};
