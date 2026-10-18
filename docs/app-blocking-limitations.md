# App blocking enforcement limits

FocusBlock service owns desktop application enforcement. It stores an active-session
snapshot in `ProgramData` and rehydrates it after service or Windows restart.

Instead of a high-frequency polling loop or network packet filtering (WFP), FocusBlock
subscribes directly to Windows kernel process start trace events via WMI/ETW
(`Win32_ProcessStartTrace`). When a blocked application executable or Windows Store
package (PFN) launches, the kernel event notifies FocusBlock and the process is
terminated in < 10 milliseconds before its window renders.

1. **Session Start & Sweep**: When a focus session begins, FocusBlock first registers
   the kernel process watcher. Immediately after the subscription is active, it runs
   a one-time process sweep to terminate any targeted applications that were already
   running before the session started.
2. **0% CPU Idle**: During an active session, FocusBlock idles at ~0% CPU because process
   creation is purely event-driven.
3. **Fallback Polling**: If the Windows service runs without administrative privileges or
   WMI event tracing is restricted, it switches to a low-frequency fallback polling loop
   (every 2.5 seconds).
4. **Target Model**: Block targets are explicit executable paths (`.exe`) or Windows Store
   app packages (PFN). Wildcard folder scanning is retired.
5. **System Exclusions**: Core Windows administrative tools (`taskmgr.exe`, `perfmon.exe`,
   `mmc.exe`, `systemsettings.exe`, `explorer.exe`, etc.) and FocusBlock binaries are
   strictly protected and never blocked.
6. **Network & System Safety**: FocusBlock never modifies system DNS, proxy settings,
   hosts files, or global firewall state.

