# FocusBlock Windows Installer & Native Messaging Setup

## Overview

FocusBlock uses Tauri v2 with NSIS installer bundling to provide a single-installer, zero-friction setup for Windows users.

## Components

1. **FocusBlock App**: Tauri desktop application installed to `$PROGRAMFILES\FocusBlock`.
2. **FocusBlockService**: Windows background service (`focus-service.exe`) running automatically via `sc.exe`.
3. **Chrome Native Messaging Host (`com.focusblock.bridge`)**: Bridge binary (`focus-native-host.exe`) connecting the Chrome extension to the background service.

## Installer Configuration (`tauri.conf.json`)

The NSIS bundler is configured in `apps/desktop/src-tauri/tauri.conf.json`:

```json
"bundle": {
  "active": true,
  "windows": {
    "nsis": {
      "installMode": "perMachine",
      "installerHooks": "nsis-hooks.nsi"
    }
  }
}
```

- `installMode: "perMachine"`: Requires single UAC prompt on install and installs globally.
- `installerHooks: "nsis-hooks.nsi"`: Defines post-install and pre-uninstall hooks.

## Post-Install Hook (`nsis-hooks.nsi`)

On installation:
1. Creates `%ProgramData%\FocusBlock` (and/or `$INSTDIR`).
2. Generates `com.focusblock.bridge.json` pointing to `$INSTDIR\focus-native-host.exe` with allowed origins including the stable Chrome Extension ID.
3. Registers the native messaging host in Windows Registry:
   - `HKLM\Software\Google\Chrome\NativeMessagingHosts\com.focusblock.bridge`
   - `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.focusblock.bridge`
4. Registers and starts `FocusBlockService` via Windows Service Control Manager (`sc.exe`).

## Pre-Uninstall Hook (`nsis-hooks.nsi`)

On uninstallation:
1. Stops and deletes `FocusBlockService`.
2. Removes the `com.focusblock.bridge` registry keys from HKLM and HKCU.
3. Cleans up manifest files.

## In-App Self-Repair

If system cleanup tools or registry modifications break the bridge configuration after install:
- Desktop Settings detects missing registry keys or manifest files.
- The user can click a single **"Repair"** button in Settings, which re-writes the HKCU registry key and manifest without requiring terminal commands or administrator re-installation.
