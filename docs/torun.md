# Run FocusBlock on Windows from a clean computer

This is the complete local testing procedure. Use **PowerShell as Administrator** for every step that builds or installs the Windows service.

## 1. Install prerequisites

Install:

- Rust (rustup)
- Node.js 18+

Confirm they work:

```powershell
rustc --version
cargo --version
node --version
npm --version
```

## 2. Open the project

```powershell
Set-Location C:\Users\bafna\Desktop\Projects\blocking
```

## 3. Build the Windows service and Chrome native bridge

```powershell
cargo build -p focus-service --release
```

## 4. Build and load the Chrome extension

```powershell
Set-Location C:\Users\bafna\Desktop\Projects\blocking\apps\extension
npm install
npm run build
```

Load it in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `C:\Users\bafna\Desktop\Projects\blocking\apps\extension\dist`.
5. Copy the 32-character extension ID shown under **Focus Blocker**.

The ID in the next command must match the ID Chrome shows.
```

## 5. Install and start the Windows service/native bridge

Stay in an **Administrator PowerShell** and replace `YOUR_EXTENSION_ID` with the copied Chrome ID:

```powershell
Set-Location C:\Users\bafna\Desktop\Projects\blocking

.\service\focus-service\install\install-focusblock.ps1 `
  -ServiceExecutablePath ".\target\release\focus-service.exe" `
  -NativeHostExecutablePath ".\target\release\focus-native-host.exe" `
  -ExtensionId "YOUR_EXTENSION_ID"
```

Verify the service:

```powershell
Get-Service FocusBlockService
```

It must say `Running`. If it says `Stopped`, run in same Admin window:

```powershell
Start-Service FocusBlockService
Start-Sleep -Seconds 3
Get-Service FocusBlockService
```

## 6. Start the desktop UI

Open a **second normal PowerShell window** at same time:

```powershell
Set-Location C:\Users\bafna\Desktop\Projects\blocking\apps\desktop
npm install
npm run tauri dev
```
Keep this terminal open while using the desktop UI.

## 7. Verification

Check service:

```powershell
Get-Service FocusBlockService
```

Check Chrome:

1. Open `chrome://extensions`.
2. Find **Focus Blocker**.
3. Confirm there is no **Errors** badge.
4. Click **service worker** to inspect logs if needed.

## 8. Reboot test

Restart Windows. Do not manually start the service afterward. Confirm:

```powershell
Get-Service FocusBlockService
```

It should return `Running`, and the active policy should still be enforced.

## 9. Troubleshooting

### Service is stopped

Run the following in Administrator PowerShell:

```powershell
Set-Location C:\Users\bafna\Desktop\Projects\blocking
cargo build -p focus-service --release

.\service\focus-service\install\install-focusblock.ps1 `
  -ServiceExecutablePath ".\target\release\focus-service.exe" `
  -NativeHostExecutablePath ".\target\release\focus-native-host.exe" `
  -ExtensionId "YOUR_EXTENSION_ID"

Start-Service FocusBlockService
Get-Service FocusBlockService
```


For direct diagnostics, use Administrator PowerShell:

```powershell
.\target\release\focus-service.exe --console
```

The process should stay running. Stop it with `Ctrl+C`.


### Rebuilding after code changes

After extension changes:
```powershell
Set-Location C:\Users\bafna\Desktop\Projects\blocking\apps\extension
npm run build
```

Then click **Reload** for the extension in `chrome://extensions`.

After service changes, rebuild release and rerun the installer from Administrator PowerShell.

## 10. Remove the test installation

Run as Administrator:

```powershell
Stop-Service FocusBlockService -ErrorAction SilentlyContinue
sc.exe delete FocusBlockService
```

This removes the Windows service registration. It does not remove the source code or Chrome extension files.
