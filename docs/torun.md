# Run FocusBlock on Windows

Procedure to run and test FocusBlock locally on Windows.

## 1. Prerequisites

Install:
- **Rust**: [rustup.rs](https://rustup.rs/) (1.70+)
- **Node.js**: 18+ from [nodejs.org](https://nodejs.org/)

Verify in PowerShell:

```powershell
rustc --version
cargo --version
node --version
npm --version
```

## 2. Quickstart (Automated)

Run the unified launcher from the project root:

```powershell
.\scripts\start.bat
```

This script:
1. Elevates to Administrator automatically (required for background app blocking).
2. Installs missing npm dependencies if needed.
3. Builds the Chrome extension to `apps/extension/dist`.
4. Starts the background `focus-service` (connected via named pipe `\\.\pipe\focusblock`).
5. Launches the Tauri desktop app in dev mode.

### Launcher Flags

| Flag | Shorthand | Action |
|---|---|---|
| *(none)* | *(default)* | Runs full ecosystem (service + extension build + desktop app) |
| `-DesktopOnly` | `-d` | Starts background service and desktop UI only |
| `-ExtensionOnly` | `-e` | Builds extension only (no admin required) |
| `-ServiceOnly` | `-s` | Starts background service only in console mode |

## 3. Load Chrome Extension

1. Open `chrome://extensions` in Chrome.
2. Toggle on **Developer mode** (top-right corner).
3. Click **Load unpacked**.
4. Select `apps/extension/dist` from the repository root.
5. Pin **Focus Blocker** in the Chrome toolbar.

## 4. Run Test Suites

Run all automated unit and integration tests:

```powershell
.\scripts\test.bat
```

Flags:
- `.\scripts\test.bat -RustOnly` (`-r`): Rust core and service tests (`cargo test --workspace`)
- `.\scripts\test.bat -ExtensionOnly` (`-e`): Extension unit tests (`npm test` in `apps/extension`)
- `.\scripts\test.bat -DesktopOnly` (`-d`): Desktop UI tests (`npm test` in `apps/desktop`)

## 5. Verification

### Test App Blocking (Desktop)
1. In the Desktop UI, navigate to the **Blocklists** tab.
2. Click **+ Add App** and select an app (e.g. Notepad or Calculator).
3. Go to the **Focus** tab and click **Start Focus Session**.
4. Attempt to open the blocked app:
   - Process terminates immediately (< 10ms) before window renders.
   - Desktop app displays the **App Blocked Modal**.
5. Stop the session: app launches normally again.

### Test Website Blocking (Extension)
1. Open the Focus Blocker extension popup.
2. In the **Block** tab, add `reddit.com`.
3. In the **Focus** tab, start a 5-minute session.
4. Visit `reddit.com` in Chrome: page redirects to the blocked notification page.
5. Click **Stop Session**: `reddit.com` loads normally again.

## 6. Troubleshooting

### Background Service Not Running
Run the service directly in console mode from an Administrator PowerShell:

```powershell
cargo run --bin focus-service -- --console
```

Verify the named pipe is available:
```powershell
Test-Path '\\.\pipe\focusblock'
```

### Rebuilding Extension After Changes
```powershell
cd apps/extension
npm run build
```
Then reload the extension on `chrome://extensions`.
