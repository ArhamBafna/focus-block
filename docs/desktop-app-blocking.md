# Freedom.to Desktop App Blocking: Reverse Engineering & Cloning Guide

This document explains exactly how Freedom.to blocks Windows desktop applications (like Zoom) so fast that they never show a window or appear on the taskbar, and provides a clear guide on how to clone this functionality into our own application.

---

## 1. Executive Summary (How It Actually Works)

When you block Zoom and double-click its icon during a Freedom session:
1. **The app starts, but dies before it can show anything**: Freedom does **not** stop Windows from launching the `.exe` file. Instead, it catches the launch within milliseconds and immediately kills the process (`Process.Kill()`).
2. **Instant Event Detection (ETW / WMI)**: Freedom does not rely on a slow polling loop. Instead, it registers an event listener with the Windows kernel via WMI (`Win32_ProcessStartTrace`).
3. **The Kernel Notifies Freedom Instantly**: The exact millisecond `Zoom.exe` begins execution, Windows sends an event directly to Freedom with the new process ID (`ProcessId`).
4. **Fast Path Verification & Kill**: Freedom checks if the process's executable path matches your blocked list (`BlockedWindowsApplications`). If it does, Freedom calls `OpenProcess()` and immediately calls `Process.Kill()` (or `TerminateProcess` in Win32).
5. **Why It Feels Like It Never Opened**: Because Zoom is terminated in its first 5–15 milliseconds of life, it never reaches the point of creating a window, registering in the taskbar, or initializing its UI. To the user, double-clicking simply does nothing.

---

## 2. Reverse-Engineered Architecture of Freedom

By inspecting Freedom's core executable (`C:\Program Files (x86)\Freedom\FreedomBlocker.exe`) and local storage (`%LOCALAPPDATA%\Freedom.to\`), we reverse-engineered the entire pipeline:

```
[User Clicks "Manage Blocked Desktop Apps"]
                     │
                     ▼
         AppSelector.xaml (WPF UI)
  - Scans running processes via Process.GetProcesses()
  - Queries UWP apps via Windows.System.AppDiagnosticInfo
  - Extracts icons via Shell32 ExtractAssociatedIcon
  - Saves selections to user.config as JSON:
    {"C:\...\Zoom.exe": {"Name": "Zoom", "Path": "C:\...\Zoom.exe"}}
                     │
                     ▼
[User Starts Focus Session (e.g. 2 min)]
                     │
                     ▼
             BlockingController
                     │
      ┌──────────────┴──────────────┐
      │ (If Administrator)          │ (If Not Admin / Fallback)
      ▼                             ▼
ProcessWatcherBlockingStrategy  ProcessPollingBlockingStrategy
- Queries WMI kernel event:     - Runs 2500ms Timer
  "SELECT * FROM                - Enumerates Win32_Process
   Win32_ProcessStartTrace"     - Kills matches
- Calls PollAppsOnce() to kill
  already-running apps
                     │
                     ▼
[User Double-Clicks Zoom.exe]
                     │
                     ▼
Windows Kernel emits Win32_ProcessStartTrace
                     │
                     ▼
ProcessWatcherBlockingStrategy.OnNewProcess()
- Extracts ProcessId from event data
- Calls ProcessUtility.GetProcessPath():
    - Uses OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)
    - Calls QueryFullProcessImageName()
- Checks if Path is in BlockedWindowsApplications dictionary
                     │
                     ▼
BlockingController.OnProcessBlocked()
- Calls Process.Kill()
- Shows toast/balloon notification via BlockingNotification
- Result: Zoom dies in < 20ms; no window or taskbar entry ever appears.
```

---

## 3. Deep Dive into Freedom's Key Components

### A. The UI & Storage (`AppSelector`)
- **Menu Entry**: In the Windows system tray icon context menu, the option is `Manage Blocked Desktop Apps` (often misread as *Minimize blocked desktop apps*).
- **Process Enumeration**:
  - Freedom calls `Process.GetProcesses()`.
  - Filters out background and system processes using a blacklist (`explorer`, `taskhostw`, `svchost`, etc.).
  - Resolves each executable path using `ProcessUtility.GetProcessPath()`.
  - Also queries UWP (Microsoft Store) apps using `Windows.System.AppDiagnosticInfo.RequestInfoAsync()`.
- **Icon Extraction**: Calls Win32 `ExtractAssociatedIcon` (`shell32.dll`) to render the real app icons in the list.
- **Persistence**: Saved as serialized JSON into the local .NET configuration file:
  - File path: `%LOCALAPPDATA%\Freedom.to\FreedomBlocker.exe_Url_...\<version>\user.config`
  - Property: `BlockedWindowsApplications`
  - Format:
    ```json
    {
      "C:\\Users\\<User>\\AppData\\Roaming\\Zoom\\bin\\Zoom.exe": {
        "Name": "Zoom",
        "Path": "C:\\Users\\<User>\\AppData\\Roaming\\Zoom\\bin\\Zoom.exe",
        "AppUserModelId": null
      }
    }
    ```

### B. The Instant Blocker (`ProcessWatcherBlockingStrategy`)
- When Freedom has Administrator privileges, it creates a `ManagementEventWatcher` with WQL:
  ```sql
  SELECT * FROM Win32_ProcessStartTrace
  ```
- `Win32_ProcessStartTrace` is backed by **ETW (Event Tracing for Windows)** in the Windows kernel.
- Unlike traditional WMI queries that poll, `Win32_ProcessStartTrace` is an asynchronous push notification sent by the Windows kernel scheduler as soon as a process creation routine (`NtCreateUserProcess`) completes.
- In `OnNewProcess(object sender, EventArrivedEventArgs e)`:
  1. Freedom reads `e.NewEvent.Properties["ProcessId"].Value`.
  2. Freedom obtains the process handle and gets the real disk path using `ProcessUtility.GetProcessPathAsLimitedInfo(processId)`.
  3. It compares `processPath.ToLowerInvariant()` against `BlockedWindowsApplications.Keys`.
  4. If matched, it fires `ProcessBlocked`.

### C. The Kill Action (`BlockingController.OnProcessBlocked`)
The disassembled IL instructions show:
```csharp
// Disassembly from FreedomBlocker.exe
IL_0000: ldarg.2          // e (ProcessBlockedEventArgs)
IL_0001: callvirt         ProcessBlockedEventArgs.get_Process
IL_0006: callvirt         Process.Kill
IL_000B: ldarg.0          // this
IL_000C: ldfld            blockingNotification
IL_0011: ldarg.2          
IL_0012: callvirt         ProcessBlockedEventArgs.get_UwpName
...
IL_0026: callvirt         BlockingNotification.Notify
IL_002B: ret
```
It simply calls `Process.Kill()`. Because `Process.Kill()` runs before the application's main thread has called `CreateWindowEx` or `ShowWindow`, Windows never registers the window with Desktop Window Manager (DWM) or the taskbar.

### D. Safe Process Path Retrieval (`ProcessUtility`)
Freedom uses a two-tier approach to resolve the full path of any target process without permission errors:
1. **Tier 1**: Tries `process.MainModule.FileName`.
2. **Tier 2 (Fallback on "Access is denied")**:
   - Calls Win32 `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, processId)`. (Flag `0x1000` requires significantly fewer privileges than `PROCESS_ALL_ACCESS` or `PROCESS_QUERY_INFORMATION`).
   - Calls Win32 `QueryFullProcessImageName(hProcess, 0, lpExeName, ref lpdwSize)` (`kernel32.dll`).

### E. Polling Fallbacks & Edge Cases
1. **Initial Cleanup (`PollAppsOnce`)**: When a block session starts, Freedom immediately iterates through all currently active processes and kills any that are already running.
2. **Non-Admin Fallback (`ProcessPollingBlockingStrategy`)**: If Freedom is not run as administrator, `Win32_ProcessStartTrace` fails due to lack of ETW tracing permissions. Freedom falls back to a 2.5-second timer querying `SELECT ProcessId FROM Win32_Process`.
3. **UWP Store Apps (`UwpWatcherBlockingStrategy`)**: Win32 processes spawned by modern Store apps (UWP) run in AppContainers. Freedom uses `Windows.System.AppDiagnosticInfo.CreateWatcher()`, hooks into the `Added` event, matches `AppUserModelId`, and terminates the underlying diagnostic process group.
4. **Anti-Tampering Protection**: Freedom also automatically kills tools that could be used to terminate Freedom or alter proxy settings:
   - `taskmgr.exe` (Task Manager)
   - `perfmon.exe` (Performance Monitor)
   - `mmc.exe` (Management Console / Services)
   - `SystemSettings.exe` (Windows Settings)

---

## 4. How to Clone This in Our Own App (FocusBlock / Rust Backend)

Currently, FocusBlock checks processes periodically in a polling loop. To achieve the exact same instant, seamless blocking behavior as Freedom.to, we should implement a process start watcher in Rust.

### Architecture in Rust / Tauri

#### Step 1: Instant Process Creation Listener (ETW / WMI)

In Rust (`service/focus-service` or desktop backend), we can subscribe to `Win32_ProcessStartTrace` via WMI, or use native ETW:

```rust
use std::collections::HashSet;
use std::path::PathBuf;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Threading::{
    OpenProcess, TerminateProcess, QueryFullProcessImageNameW,
    PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE,
};

/// Get full executable path of any process ID using QueryFullProcessImageNameW
pub fn get_process_path(pid: u32) -> Option<PathBuf> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buffer = [0u16; 1024];
        let mut size = buffer.len() as u32;

        let success = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT(0),
            windows::core::PWSTR(buffer.as_mut_ptr()),
            &mut size,
        );
        let _ = CloseHandle(handle);

        if success.is_ok() && size > 0 {
            Some(PathBuf::from(String::from_utf16_lossy(&buffer[..size as usize])))
        } else {
            None
        }
    }
}

/// Terminate the process immediately
pub fn kill_process(pid: u32) -> bool {
    unsafe {
        if let Ok(handle) = OpenProcess(PROCESS_TERMINATE, false, pid) {
            let res = TerminateProcess(handle, 1).is_ok();
            let _ = CloseHandle(handle);
            res
        } else {
            false
        }
    }
}
```

#### Step 2: WMI Event Watcher in Rust

Using the `wmi` crate or COM dispatch:

```rust
use wmi::{COMLibrary, WMIConnection};
use serde::Deserialize;

#[derive(Deserialize, Debug)]
#[serde(rename = "Win32_ProcessStartTrace")]
struct ProcessStartTrace {
    ProcessId: u32,
    ProcessName: String,
}

pub fn start_process_watcher(blocked_paths: HashSet<PathBuf>) {
    std::thread::spawn(move || {
        let com_con = COMLibrary::new().unwrap();
        let wmi_con = WMIConnection::new(com_con.into()).unwrap();

        let iterator = wmi_con
            .raw_notification::<ProcessStartTrace>(
                "SELECT ProcessId, ProcessName FROM Win32_ProcessStartTrace"
            )
            .unwrap();

        for event in iterator {
            if let Ok(trace) = event {
                if let Some(path) = get_process_path(trace.ProcessId) {
                    if blocked_paths.contains(&path) {
                        // Kill instantly before window initializes
                        kill_process(trace.ProcessId);
                    }
                }
            }
        }
    });
}
```

#### Step 3: Initial Pre-Session Sweep

When a focus session begins:
1. Call `EnumProcesses` / `CreateToolhelp32Snapshot`.
2. Find all currently running processes that match the blocklist.
3. Call `TerminateProcess` on them so any apps left open before the session started are closed immediately.
4. Keep the ETW/WMI watcher active throughout the session duration.

---

## 5. Comparison: Polling vs. Event-Driven (Why Freedom Feels Magic)

| Feature | Polling (e.g., every 250ms–2500ms) | Event-Driven (Freedom: `Win32_ProcessStartTrace`) |
|---|---|---|
| **Speed to Kill** | 50ms – 250ms+ after launch | **< 15ms** after launch |
| **Window Visibility** | App window often flashes or starts loading before being killed | **Zero visibility**: App never draws a frame |
| **Taskbar Icon** | Taskbar button often blinks for a split second | **No taskbar presence** |
| **CPU Usage** | Constantly scanning all processes every few hundred ms | **0% CPU** idle (event-driven notification from kernel) |
| **User Experience** | Feels buggy / flickering | Feels like the application is completely disabled |

---

## 6. Summary Checklist for FocusBlock

To reproduce the exact Freedom experience in FocusBlock:
1. **App Picker**: Enumerate processes, use `QueryFullProcessImageNameW` for paths, and `ExtractAssociatedIcon` to display icons in the UI. Store lowercase absolute paths in blocklists.
2. **Session Start**: Perform a one-time sweep to kill any already-running blocked apps.
3. **Session Active**: Run an asynchronous listener on `Win32_ProcessStartTrace`. On each event, inspect `ProcessId`, resolve path via `QueryFullProcessImageNameW`, check against blocked set, and call `TerminateProcess`.
4. **Fallback**: If running without Administrator rights, run a low-frequency fallback polling loop.
