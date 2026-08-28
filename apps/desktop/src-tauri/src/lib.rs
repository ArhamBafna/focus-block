use focus_core::{DiscoveredApp, IpcRequest, IpcResponse};
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

/// Lists installed applications (Win32 + Store packages) for the focus blocklist picker.
#[tauri::command]
fn list_installed_apps() -> Result<Vec<DiscoveredApp>, String> {
    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
$packageFamilies = @(Get-AppxPackage | ForEach-Object { $_.PackageFamilyName })
$storeApps = @(Get-StartApps | ForEach-Object {
    if ($_.AppID -match '^(?<family>[^!]+)!.+$' -and $packageFamilies -contains $matches['family']) {
        [PSCustomObject]@{
            displayName = $_.Name
            target = [PSCustomObject]@{
                kind = "package"
                package_family_name = $matches['family']
            }
            category = "Windows Store"
            iconDataUri = $null
        }
    }
} | Group-Object { $_.target.package_family_name } | ForEach-Object {
    $_.Group | Sort-Object displayName | Select-Object -First 1
})
$shell = New-Object -ComObject WScript.Shell
$win32Apps = @(Get-ChildItem -Path "$env:ProgramData\Microsoft\Windows\Start Menu\Programs", "$env:APPDATA\Microsoft\Windows\Start Menu\Programs" -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $shortcut = $shell.CreateShortcut($_.FullName)
    $targetPath = $shortcut.TargetPath
    if ($targetPath -match '\.exe$') {
        [PSCustomObject]@{
            displayName = $_.BaseName
            target = [PSCustomObject]@{
                kind = "executable"
                path = $targetPath
            }
            category = "Desktop App"
            iconDataUri = $null
        }
    }
} | Group-Object { $_.target.path } | ForEach-Object {
    $_.Group | Sort-Object displayName | Select-Object -First 1
})
$allApps = $storeApps + $win32Apps | Sort-Object displayName
@($allApps) | ConvertTo-Json -Compress -Depth 5
"#;
        let output = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|error| format!("Could not list installed apps: {error}"))?;

        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(if message.is_empty() {
                "Could not list installed apps.".into()
            } else {
                format!("Could not list installed apps: {message}")
            });
        }

        let json = String::from_utf8(output.stdout)
            .map_err(|error| format!("Could not read installed app list: {error}"))?;
        serde_json::from_str(&json)
            .map_err(|error| format!("Could not parse installed app list: {error}"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
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
        .invoke_handler(tauri::generate_handler![ipc_request, list_installed_apps, list_store_apps])
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
