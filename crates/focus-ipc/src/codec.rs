use focus_core::{IpcRequest, IpcResponse};
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub const MAX_IPC_MESSAGE_BYTES: usize = 2 * 1024 * 1024; // 2 MB

pub async fn read_message<R: AsyncReadExt + Unpin>(reader: &mut R) -> io::Result<IpcRequest> {
    let len = reader.read_u32_le().await? as usize;
    if len > MAX_IPC_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("IPC message length {len} exceeds limit of {MAX_IPC_MESSAGE_BYTES}"),
        ));
    }
    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf).await?;
    serde_json::from_slice(&buf).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

pub async fn write_message<W: AsyncWriteExt + Unpin>(
    writer: &mut W,
    response: &IpcResponse,
) -> io::Result<()> {
    let buf =
        serde_json::to_vec(response).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    writer.write_u32_le(buf.len() as u32).await?;
    writer.write_all(&buf).await?;
    writer.flush().await?;
    Ok(())
}
