use focus_core::{AppBlockTarget, DiscoveredApp, IpcRequest, IpcResponse};
use focus_ipc::IpcClient;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoreApp {
    display_name: String,
    package_family_name: String,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum OneOrMany<T> {
    One(T),
    Many(Vec<T>),
}

impl<T> OneOrMany<T> {
    fn into_vec(self) -> Vec<T> {
        match self {
            Self::One(item) => vec![item],
            Self::Many(items) => items,
        }
    }
}

/// PowerShell prints nothing at all when a pipeline has no objects, and prints a
/// bare object (not an array) when it has exactly one. Both shapes mean "here is
/// the list"; neither is a parse failure.
fn parse_app_list<T: serde::de::DeserializeOwned>(json: &str) -> Result<Vec<T>, serde_json::Error> {
    if json.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str::<OneOrMany<T>>(json).map(OneOrMany::into_vec)
}

fn icon_cache_dir() -> PathBuf {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Local".into());
    let dir = PathBuf::from(local_app_data)
        .join("FocusBlock")
        .join("IconCache");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn target_cache_key(target: &AppBlockTarget) -> String {
    let raw = match target {
        AppBlockTarget::Executable { path } => format!("exe_{}", path.to_lowercase()),
        AppBlockTarget::Package {
            package_family_name,
        } => {
            format!("pkg_{}", package_family_name.to_lowercase())
        }
    };
    let clean: String = raw
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .take(32)
        .collect();
    format!("{}_{:016x}.b64", clean, stable_hash(&raw))
}

/// FNV-1a. `DefaultHasher` is explicitly not stable across Rust releases, and a
/// cache key that changed on a toolchain bump would orphan every cached icon.
fn stable_hash(value: &str) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

/// Renders `value` as a PowerShell single-quoted literal. Single-quoted strings
/// expand nothing, so doubling `'` is the only escape needed: a target path or
/// package family name can never break out into script code.
fn powershell_single_quoted(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
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

/// How long a failed extraction is remembered. Without a marker the app picker
/// re-runs PowerShell for every app whose icon can never be extracted (many UWP
/// packages) on each open.
const ICON_MISS_TTL: std::time::Duration = std::time::Duration::from_secs(7 * 24 * 60 * 60);

fn icon_miss_marker(cache_dir: &Path, key: &str) -> PathBuf {
    cache_dir.join(format!("{key}.miss"))
}

/// A missing-icon marker only counts while it is younger than the TTL, so an
/// app that gains a usable icon later still gets one without a reinstall.
fn icon_miss_is_fresh(cache_dir: &Path, key: &str) -> bool {
    let modified = std::fs::metadata(icon_miss_marker(cache_dir, key))
        .and_then(|meta| meta.modified())
        .ok();
    miss_marker_is_fresh(modified)
}

/// `modified` is when the marker was written; `None` means there is no marker.
fn miss_marker_is_fresh(modified: Option<std::time::SystemTime>) -> bool {
    matches!(
        modified.and_then(|time| time.elapsed().ok()),
        Some(age) if age < ICON_MISS_TTL
    )
}

fn save_icon_miss(cache_dir: &Path, key: &str) {
    let _ = std::fs::write(icon_miss_marker(cache_dir, key), b"");
}

#[cfg(target_os = "windows")]
fn extract_app_icon_native(target: &AppBlockTarget) -> Option<String> {
    let cache_dir = icon_cache_dir();
    let key = target_cache_key(target);
    if let Some(cached) = get_cached_icon(&cache_dir, &key) {
        return Some(cached);
    }
    if icon_miss_is_fresh(&cache_dir, &key) {
        return None;
    }

    let script = match target {
        AppBlockTarget::Executable { path } => {
            format!(
                r#"
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
$exe = {}
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
                powershell_single_quoted(path)
            )
        }
        AppBlockTarget::Package {
            package_family_name,
        } => {
            format!(
                r#"
$ErrorActionPreference = 'SilentlyContinue'
$pfn = {}
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
                powershell_single_quoted(package_family_name)
            )
        }
    };

    let mut cmd = std::process::Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(cmd.output().ok());
    });
    let output = rx
        .recv_timeout(std::time::Duration::from_secs(5))
        .ok()
        .flatten()?;

    if output.status.success() {
        let b64 = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !b64.is_empty() && b64.starts_with("data:image/png;base64,") {
            save_cached_icon(&cache_dir, &key, &b64);
            return Some(b64);
        }
    }

    // The extraction ran and produced no icon: remember it so the next open does
    // not pay for PowerShell again.
    save_icon_miss(&cache_dir, &key);
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
        let icon = tauri::async_runtime::spawn_blocking(move || extract_app_icon_native(&target))
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
    try {
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
    } catch {}
} | Group-Object { $_.target.path } | ForEach-Object {
    $_.Group | Sort-Object displayName | Select-Object -First 1
})
$allApps = $storeApps + $win32Apps | Sort-Object displayName
@($allApps) | ConvertTo-Json -Compress -Depth 5
"#;
        let mut cmd = std::process::Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let output = cmd
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
        let mut apps = parse_app_list::<DiscoveredApp>(&json)
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

        let mut cmd = std::process::Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let output = cmd
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
        parse_app_list::<StoreApp>(&json)
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
    use super::{powershell_single_quoted, StoreApp};

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

    /// A blockable target reaches PowerShell through format!(). Anything that
    /// survives as more than literal text would be an injection, so every
    /// hostile shape has to stay inert inside the quoted literal.
    #[test]
    fn powershell_literals_keep_hostile_targets_inert() {
        assert_eq!(
            powershell_single_quoted(r"C:\Program Files\Discord\Update.exe"),
            r"'C:\Program Files\Discord\Update.exe'"
        );
        assert_eq!(
            powershell_single_quoted(r"C:\App's\a.exe"),
            r"'C:\App''s\a.exe'"
        );

        for hostile in [
            r#""; Remove-Item C:\ -Recurse; ""#,
            "$(Start-Process calc)",
            "Microsoft.App`nwhoami_8wekyb3d8bbwe",
            "a'; Start-Process calc; 'b",
        ] {
            let quoted = powershell_single_quoted(hostile);
            assert!(quoted.starts_with('\'') && quoted.ends_with('\''));

            // Inside a single-quoted literal only a doubled quote is allowed.
            let inner = &quoted[1..quoted.len() - 1];
            let mut chars = inner.chars().peekable();
            while let Some(ch) = chars.next() {
                if ch == '\'' {
                    assert_eq!(
                        chars.next(),
                        Some('\''),
                        "a lone quote would close the literal: {hostile}"
                    );
                }
            }
        }
    }

    #[test]
    fn app_list_json_accepts_zero_one_or_many_entries() {
        use super::parse_app_list;

        // PowerShell prints nothing for an empty pipeline result.
        assert!(parse_app_list::<StoreApp>("").unwrap().is_empty());
        assert!(parse_app_list::<StoreApp>(" \r\n").unwrap().is_empty());
        assert!(parse_app_list::<StoreApp>("[]").unwrap().is_empty());

        // One object is printed bare, not wrapped in an array.
        let single = parse_app_list::<StoreApp>(
            r#"{"displayName":"Calculator","packageFamilyName":"Fam_1"}"#,
        )
        .expect("a single bare object is a list of one");
        assert_eq!(single.len(), 1);
        assert_eq!(single[0].display_name, "Calculator");

        let many = parse_app_list::<StoreApp>(
            r#"[{"displayName":"A","packageFamilyName":"F1"},{"displayName":"B","packageFamilyName":"F2"}]"#,
        )
        .expect("an array is a list");
        assert_eq!(many.len(), 2);
    }

    #[test]
    fn icon_cache_separates_saved_icons_from_remembered_failures() {
        use super::{
            get_cached_icon, icon_miss_is_fresh, save_cached_icon, save_icon_miss,
        };

        let dir = std::env::temp_dir().join(format!(
            "focusblock-icon-cache-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();

        // Cold cache: nothing remembered, so the caller may extract.
        assert!(!icon_miss_is_fresh(&dir, "key"));
        assert_eq!(get_cached_icon(&dir, "key"), None);

        // A failed extraction is remembered, which is the point of the marker.
        save_icon_miss(&dir, "key");
        assert!(icon_miss_is_fresh(&dir, "key"));

        // Saved icons are returned and are not confused with failure markers.
        save_cached_icon(&dir, "icon", "data:image/png;base64,AAA");
        assert_eq!(
            get_cached_icon(&dir, "icon").as_deref(),
            Some("data:image/png;base64,AAA")
        );
        assert!(!icon_miss_is_fresh(&dir, "icon"));

        // An empty cache file is not usable data.
        save_cached_icon(&dir, "empty", "  ");
        assert_eq!(get_cached_icon(&dir, "empty"), None);

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn expired_icon_failure_markers_are_retried() {
        use super::{miss_marker_is_fresh, ICON_MISS_TTL};

        assert!(!miss_marker_is_fresh(None), "no marker means no memory");
        assert!(miss_marker_is_fresh(Some(std::time::SystemTime::now())));

        let stale = std::time::SystemTime::now()
            .checked_sub(ICON_MISS_TTL + std::time::Duration::from_secs(60))
            .expect("the clock is later than 1970");
        assert!(!miss_marker_is_fresh(Some(stale)));
    }

    /// The cache key becomes a file name inside the icon cache directory, so it
    /// must not contain path separators, and the same target must always map to
    /// the same file whatever the case of the path.
    #[test]
    fn icon_cache_keys_are_safe_file_names_and_stable_per_target() {
        use super::{stable_hash, target_cache_key};
        use focus_core::AppBlockTarget;

        // Known-answer vectors: FNV-1a 64, so a toolchain upgrade cannot move
        // every key and orphan the cache.
        assert_eq!(stable_hash(""), 0xcbf2_9ce4_8422_2325);
        assert_eq!(stable_hash("a"), 0xaf63_dc4c_8601_ec8c);

        let exe = AppBlockTarget::Executable {
            path: r"C:\Program Files\Discord\Discord.exe".into(),
        };
        let exe_other_case = AppBlockTarget::Executable {
            path: r"c:\program files\discord\discord.exe".into(),
        };
        let package = AppBlockTarget::Package {
            package_family_name: "Microsoft.WindowsCalculator_8wekyb3d8bbwe".into(),
        };

        let key = target_cache_key(&exe);
        assert_eq!(key, target_cache_key(&exe_other_case));
        assert_ne!(key, target_cache_key(&package));
        assert_eq!(target_cache_key(&package), target_cache_key(&package));

        for candidate in [key, target_cache_key(&package)] {
            let stem = candidate.strip_suffix(".b64").expect("cache key ends in .b64");
            assert!(
                !stem.chars().any(|c| matches!(c, '/' | '\\' | ':' | '.')),
                "{stem}"
            );
            assert!(!stem.is_empty(), "{candidate}");
            assert_eq!(candidate.matches('.').count(), 1, "{candidate}");
            assert!(candidate.len() < 120, "{candidate}");
        }
    }
}
