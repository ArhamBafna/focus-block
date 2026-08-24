use focus_core::{IpcRequest, IpcResponse};
use focus_ipc::IpcClient;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoreApp {
    display_name: String,
    package_family_name: String,
}

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

/// Lists Start-menu apps backed by a package family. The selected PFN is passed
/// unchanged to the service; this command never stores or enforces a target.
#[tauri::command]
fn list_store_apps() -> Result<Vec<StoreApp>, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
$packageFamilies = @(Get-AppxPackage | ForEach-Object { $_.PackageFamilyName })
$apps = @(Get-StartApps | ForEach-Object {
    if ($_.AppID -match '^(?<family>[^!]+)!.+$' -and $packageFamilies -contains $matches['family']) {
        [PSCustomObject]@{
            displayName = $_.Name
            packageFamilyName = $matches['family']
        }
    }
} | Group-Object packageFamilyName | ForEach-Object {
    $_.Group | Sort-Object displayName | Select-Object -First 1
} | Sort-Object displayName)
@($apps) | ConvertTo-Json -Compress
"#;

        let output = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|error| format!("Could not list Microsoft Store apps: {error}"))?;

        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if message.is_empty() {
                "Could not list Microsoft Store apps.".into()
            } else {
                format!("Could not list Microsoft Store apps: {message}")
            });
        }

        let json = String::from_utf8(output.stdout)
            .map_err(|error| format!("Could not read Microsoft Store app list: {error}"))?;
        serde_json::from_str(&json)
            .map_err(|error| format!("Could not read Microsoft Store app list: {error}"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Microsoft Store app selection is only available on Windows.".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ipc_request, list_store_apps])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::StoreApp;

    #[test]
    fn parses_store_apps_from_the_powershell_json_shape() {
        let apps: Vec<StoreApp> = serde_json::from_str(
            r#"[{"displayName":"Calculator","packageFamilyName":"Microsoft.WindowsCalculator_8wekyb3d8bbwe"}]"#,
        )
        .expect("Start-menu app JSON should deserialize");

        assert_eq!(apps.len(), 1);
        assert_eq!(apps[0].display_name, "Calculator");
        assert_eq!(
            apps[0].package_family_name,
            "Microsoft.WindowsCalculator_8wekyb3d8bbwe"
        );
    }
}
