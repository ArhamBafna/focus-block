# App blocking enforcement limits

FocusBlock service owns desktop application enforcement. It stores an active-session
snapshot in `ProgramData` and rehydrates it after a service or Windows restart.

Instead of a high-frequency polling loop or network packet filtering (WFP), FocusBlock
subscribes directly to Windows kernel process start trace events via WMI/ETW
(`Win32_ProcessStartTrace`). When a blocked application executable or Windows Store
package (PFN) launches, the kernel event notifies FocusBlock and the process is
terminated before its window renders.

1. **Session Start & Sweep**: When a focus session begins, FocusBlock first registers
   the kernel process watcher. Immediately after the subscription is active, it runs
   a one-time process sweep to terminate any targeted applications that were already
   running before the session started.
2. **0% CPU Idle**: During an active session, FocusBlock idles at ~0% CPU because process
   creation is purely event-driven.
3. **Fallback Polling**: If the Windows service runs without administrative privileges or
   WMI event tracing is restricted, it switches to a low-frequency fallback polling loop
   (every 2.5 seconds).
4. **Observed, not assumed, latency**: the service does not claim a fixed millisecond
   figure. The guarded enforcement harness measures the observed launch-to-exit time and
   prints it; no number is asserted in product copy until such a run records one.
5. **Target Model**: Block targets are explicit executable paths (`.exe`) or Windows Store
   app packages (PFN). Wildcard folder scanning is retired.
6. **System Exclusions**: Core Windows administrative tools (`taskmgr.exe`, `perfmon.exe`,
   `mmc.exe`, `systemsettings.exe`, `explorer.exe`, etc.) and FocusBlock binaries are
   strictly protected and never blocked.
7. **Network & System Safety**: FocusBlock never modifies system DNS, proxy settings,
   hosts files, or global firewall state.

## Reporting which method is enforcing

Kernel events and the 2.5s sweep are not equivalent: a launch can be visible for up to
2.5 seconds under the fallback. A machine with a broken subscription used to be
indistinguishable from a healthy one, so the service status reply now carries
`enforcement_mode`:

- `inactive` — no active session, or no app targets to enforce.
- `kernel_events` — the instant path is enforcing.
- `polling_fallback` — the sweep is enforcing; blocking is degraded.

Consumers must treat `polling_fallback` as degraded, not healthy. Surfacing this in the
desktop UI is tracked separately from the service-side reporting.

## Test safety

Blocking is not machine-wide policy; it terminates processes. Tests therefore use an
injectable enforcer (`crate::enforcement::Enforcement`) so ordinary `cargo test` runs
never subscribe to Windows events, never terminate a process, and never open the real
`ProgramData` database. Constructing a session manager against that database re-applies
a saved session, which would terminate the developer's own blocked applications.

The real checks are opt-in and documented in
[app-blocking-tests.md](app-blocking-tests.md).
