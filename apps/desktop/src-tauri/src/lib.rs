use focus_core::{AppBlockTarget, DiscoveredApp, IpcRequest, IpcResponse};
use focus_ipc::IpcClient;
use serde::{Deserialize, Serialize};
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoreApp {
    display_name: String,
    package_family_name: String,
}

fn icon_cache_dir() -> PathBuf {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Local".into());
    let dir = PathBuf::from(local_app_data).join("FocusBlock").join("IconCache");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn target_cache_key(target: &AppBlockTarget) -> String {
    let raw = match target {
        AppBlockTarget::Executable { path } => format!("exe_{}", path.to_lowercase()),
        AppBlockTarget::Folder { path } => format!("dir_{}", path.to_lowercase()),
        AppBlockTarget::Package { package_family_name } => {
            format!("pkg_{}", package_family_name.to_lowercase())
        }
    };
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    raw.hash(&mut hasher);
    let h = hasher.finish();
    let clean: String = raw
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .take(32)
        .collect();
    format!("{}_{:016x}.b64", clean, h)
}

fn get_cached_icon(cache_dir: &Path, key: &str) -> Option<String> {
    let file = cache_dir.join(key);
    if file.is_file() {
        std::fs::read_to_string(file)
            .ok()
            .filter(|s| !s.trim().is_empty())
    } else {
        None
    }
}

fn save_cached_icon(cache_dir: &Path, key: &str, data: &str) {
    let file = cache_dir.join(key);
    let _ = std::fs::write(file, data);
}

#[cfg(target_os = "windows")]
fn extract_app_icon_native(target: &AppBlockTarget) -> Option<String> {
    let cache_dir = icon_cache_dir();
    let key = target_cache_key(target);
    if let Some(cached) = get_cached_icon(&cache_dir, &key) {
        return Some(cached);
    }

    let script = match target {
        AppBlockTarget::Executable { path } => {
            format!(
                r#"
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
$exe = "{}"
if (Test-Path $exe) {{
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exe)
    if ($icon) {{
        $bmp = $icon.ToBitmap()
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $b64 = "data:image/png;base64," + [Convert]::ToBase64String($ms.ToArray())
        $ms.Dispose()
        $bmp.Dispose()
        $icon.Dispose()
        Write-Output $b64
    }}
}}
"#,
                path.replace('"', "`\"")
            )
        }
        AppBlockTarget::Package { package_family_name } => {
            format!(
                r#"
$ErrorActionPreference = 'SilentlyContinue'
$pfn = "{}"
$pkg = Get-AppxPackage | Where-Object {{ $_.PackageFamilyName -eq $pfn }} | Select-Object -First 1
if ($pkg -and $pkg.InstallLocation) {{
    $manifestPath = Join-Path $pkg.InstallLocation "AppxManifest.xml"
    if (Test-Path $manifestPath) {{
        [xml]$xml = Get-Content $manifestPath -Raw
        $app = $xml.Package.Applications.Application | Select-Object -First 1
        $logo = $app.VisualElements.Square44x44Logo
        if (-not $logo) {{ $logo = $app.VisualElements.Square150x150Logo }}
        if (-not $logo) {{ $logo = $app.VisualElements.Logo }}
        if ($logo) {{
            $logoBase = [System.IO.Path]::Combine($pkg.InstallLocation, [System.IO.Path]::GetDirectoryName($logo))
            $logoName = [System.IO.Path]::GetFileNameWithoutExtension($logo)
            $matches = @(Get-ChildItem -Path $logoBase -Filter "$logoName*.png" -ErrorAction SilentlyContinue | Sort-Object Length -Descending)
            if ($matches.Count -gt 0) {{
                $bytes = [System.IO.File]::ReadAllBytes($matches[0].FullName)
                Write-Output ("data:image/png;base64," + [Convert]::ToBase64String($bytes))
                exit 0
            }}
        }}
    }}
    $assets = @(Get-ChildItem -Path (Join-Path $pkg.InstallLocation "Assets"), $pkg.InstallLocation -Filter "*.png" -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -match 'logo|targetsize|square' }} | Sort-Object Length -Descending)
    if ($assets.Count -gt 0) {{
        $bytes = [System.IO.File]::ReadAllBytes($assets[0].FullName)
        Write-Output ("data:image/png;base64," + [Convert]::ToBase64String($bytes))
    }}
}}
"#,
                package_family_name.replace('"', "`\"")
            )
        }
        AppBlockTarget::Folder { .. } => return None,
    };

    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .ok()?;

    if output.status.success() {
        let b64 = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !b64.is_empty() && b64.starts_with("data:image/png;base64,") {
            save_cached_icon(&cache_dir, &key, &b64);
            return Some(b64);
        }
    }
    None
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

/// Asynchronously extracts and caches an app icon (Win32 executable or Store package).
#[tauri::command]
async fn get_app_icon(target: AppBlockTarget) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let icon = tauri::async_runtime::spawn_blocking(move || {
            extract_app_icon_native(&target)
        })
        .await
        .map_err(|e| format!("Icon task failed: {e}"))?;
        Ok(icon)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = target;
        Ok(None)
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
        let mut apps: Vec<DiscoveredApp> = serde_json::from_str(&json)
            .map_err(|error| format!("Could not parse installed app list: {error}"))?;

        let cache_dir = icon_cache_dir();
        for app in &mut apps {
            if app.icon_data_uri.is_none() {
                let key = target_cache_key(&app.target);
                if let Some(cached) = get_cached_icon(&cache_dir, &key) {
                    app.icon_data_uri = Some(cached);
                }
            }
        }

        Ok(apps)
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
            .map_err(|error| format!("Could not parse Microsoft Store app list: {error}"))
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
        .invoke_handler(tauri::generate_handler![
            ipc_request,
            list_installed_apps,
            list_store_apps,
            get_app_icon
        ])
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
