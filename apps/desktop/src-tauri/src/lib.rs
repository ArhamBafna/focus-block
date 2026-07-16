use focus_core::{IpcRequest, IpcResponse};
use focus_ipc::IpcClient;

#[tauri::command]
async fn ipc_request(request: IpcRequest) -> Result<IpcResponse, String> {
    // Attempt IPC
    match IpcClient::request(request).await {
        Ok(resp) => Ok(resp),
        Err(e) => {
            // For now, return Err so JS can handle it
            Err(format!("IPC Error: {}", e))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ipc_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
