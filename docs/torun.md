# Run FocusBlock on Windows from a clean computer

This is the complete local testing procedure. Use **PowerShell as Administrator** for every step that builds or installs the Windows service.

## 1. Install prerequisites

Install:

- Rust (rustup): https://rustup.rs/
- Node.js 18 or newer: https://nodejs.org/
- Google Chrome
- WebView2 (normally already installed with Windows)

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

This creates:

```text
target\release\focus-service.exe
target\release\focus-native-host.exe
```

Do not open these files manually. The installer registers them correctly.

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

The ID in the next command must exactly match the ID Chrome shows. Example only:

```text
fmfabpemofdkhhcmjaejhinplelkiokm
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

It must say `Running`. If it says `Stopped`, use the same Administrator window:

```powershell
Start-Service FocusBlockService
Start-Sleep -Seconds 3
Get-Service FocusBlockService
```

The installer also configures automatic startup and Windows service recovery.

## 6. Start the desktop UI

Open a **second normal PowerShell window** (the service remains installed and running):

```powershell
Set-Location C:\Users\bafna\Desktop\Projects\blocking\apps\desktop
npm install
npm run tauri dev
```

Keep this terminal open while using the desktop UI.

## 7. Use the system

- Start a focus session in the desktop app.
- Website policies are sent to `FocusBlockService`, then to Chrome through the native-messaging bridge.
- The Chrome extension applies the received policy with dynamic `declarativeNetRequest` rules.
- App enforcement is handled by the Windows service, not the desktop window.

The current desktop UI does not yet expose an app-target selector. App-target backend support exists, but selecting `.exe`, folder, or Store apps requires that UI to be added.

## 8. Verify everything

Check the service:

```powershell
Get-Service FocusBlockService
```

Check Chrome:

1. Open `chrome://extensions`.
2. Find **Focus Blocker**.
3. Confirm there is no **Errors** badge.
4. Click **service worker** to inspect logs if needed.

After adding a blocked website in an active desktop session, refresh the Chrome page. It should redirect to the bundled blocked page.

## 9. Reboot test

Restart Windows. Do not manually start the service afterward. Confirm:

```powershell
Get-Service FocusBlockService
```

It should return `Running`, and the active policy should still be enforced.

## 10. Troubleshooting

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

Do not diagnose WFP or database access from a non-Administrator console. A normal-user `--console` run can show `attempt to write a readonly database` even though the installed LocalSystem service has the required permissions.

For direct diagnostics, use Administrator PowerShell:

```powershell
.\target\release\focus-service.exe --console
```

The process should stay running. Stop it with `Ctrl+C`.

### Chrome does not update

- Confirm the native host was installed with the current extension ID.
- Reload the unpacked extension from `chrome://extensions`.
- Confirm `FocusBlockService` is `Running`.
- Refresh the blocked website tab.

### Rebuilding after code changes

After extension changes:

```powershell
Set-Location C:\Users\bafna\Desktop\Projects\blocking\apps\extension
npm run build
```

Then click **Reload** for the extension in `chrome://extensions`.

After service changes, rebuild release and rerun the installer from Administrator PowerShell.

## 11. Remove the test installation

Run as Administrator:

```powershell
Stop-Service FocusBlockService -ErrorAction SilentlyContinue
sc.exe delete FocusBlockService
```

This removes the Windows service registration. It does not remove the source code or Chrome extension files.
