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

    struct PipeSecurity {
        sd: *mut std::ffi::c_void,
    }

    impl PipeSecurity {
        fn new() -> io::Result<Self> {
            // SDDL granting Generic All to Everyone (WD): D:(A;;GA;;;WD)
            // Allows non-elevated desktop UI and browser native messaging host
            // to connect to the pipe created by an elevated/system service process.
            let sddl: Vec<u16> = "D:(A;;GA;;;WD)\0".encode_utf16().collect();
            let mut sd = std::ptr::null_mut();
            const SDDL_REVISION_1: u32 = 1;
            unsafe {
                let ok = windows_sys::Win32::Security::Authorization::ConvertStringSecurityDescriptorToSecurityDescriptorW(
                    sddl.as_ptr(),
                    SDDL_REVISION_1,
                    &mut sd,
                    std::ptr::null_mut(),
                );
                if ok == 0 {
                    return Err(io::Error::last_os_error());
                }
            }
            Ok(Self { sd })
        }

        fn create_pipe(&self, first: bool) -> io::Result<NamedPipeServer> {
            let mut sa = windows_sys::Win32::Security::SECURITY_ATTRIBUTES {
                nLength: std::mem::size_of::<windows_sys::Win32::Security::SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: self.sd,
                bInheritHandle: 0,
            };
            let mut options = ServerOptions::new();
            if first {
                options.first_pipe_instance(true);
            }
            unsafe {
                options.create_with_security_attributes_raw(
                    PIPE_NAME,
                    &mut sa as *mut _ as *mut std::ffi::c_void,
                )
            }
        }
    }

    impl Drop for PipeSecurity {
        fn drop(&mut self) {
            if !self.sd.is_null() {
                unsafe {
                    windows_sys::Win32::Foundation::LocalFree(self.sd as _);
                }
            }
        }
    }

    unsafe impl Send for PipeSecurity {}
    unsafe impl Sync for PipeSecurity {}

    pub struct IpcServer {
        handler: RequestHandler,
    }

    impl IpcServer {
        pub fn new(handler: RequestHandler) -> Self {
            Self { handler }
        }

        pub async fn run(&self) -> io::Result<()> {
            info!("IPC server listening on {}", PIPE_NAME);

            let sec = PipeSecurity::new()?;

            // Pre-create the first instance so we're ready before the loop.
            let mut pending = sec.create_pipe(true)?;

            loop {
                // Wait for a client to connect to the current pending instance.
                pending.connect().await?;
                let connected = pending;

                // Immediately create the NEXT instance so it's waiting before
                // we hand off the connected one — eliminates the accept-gap that
                // caused OS error 231 (all pipe instances busy).
                pending = sec.create_pipe(false)?;

                let handler = Arc::clone(&self.handler);
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(connected, handler).await {
                        if e.raw_os_error() == Some(232) || e.kind() == std::io::ErrorKind::UnexpectedEof {
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
