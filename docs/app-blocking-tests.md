# App blocking test harness

App blocking terminates processes. There is no firewall rule or other machine-wide
policy to roll back, so "harmless by default" means: no kernel subscription, no process
termination, and no access to the real database described below.

## What `cargo test` does by default

Nothing real. `service/focus-service` unit tests use an injectable `Enforcement` fake
(`src/test_support.rs::FakeEnforcer`) over a store in the temp directory. Constructing a
session manager against `%ALLUSERSPROFILE%\FocusBlock\data.db` re-applies any saved active
session and would terminate the developer's own blocked applications, so tests must never
do it — and they don't.

The two real checks in `src/real_enforcement.rs` are compiled but return immediately
unless their tier is requested.

## Real runs are gated

Both gates are required:

| Variable | Value | Meaning |
| --- | --- | --- |
| `FOCUS_REAL_ENFORCEMENT` | `tier-a` or `tier-b` | Which real checks to run |
| `FOCUS_DISPOSABLE_WINDOWS_ACK` | `1` or `yes` | You accept that this machine may lose data or a service |

An unknown tier, or a requested tier without the acknowledgement, fails loudly. A missing
prerequisite also fails loudly — never a green skip.

Before anything is touched the harness checks:

- Windows, and an elevated shell (the subscription needs it);
- `FocusBlockService` does not already exist, and no `focus-service.exe` /
  `focusblock.exe` is running;
- `%ALLUSERSPROFILE%\FocusBlock\data.db` does not exist;
- the kernel process-start subscription actually registers (probed with a target that
  cannot match a real executable, then torn down);
- the dedicated test executable is present.

The harness never stops a user service or erases user data to prepare.

### Tier A — any dev PC, after the gates

One check: apply the blocking target, then launch the dedicated dummy executable and
require it to exit before any cleanup. It never installs, starts, or stops a service.

```powershell
# elevated PowerShell, on a machine with no FocusBlock install or data
$env:FOCUS_REAL_ENFORCEMENT = "tier-a"
$env:FOCUS_DISPOSABLE_WINDOWS_ACK = "1"
cargo test -p focus-service tier_a -- --nocapture --test-threads=1
```

### Tier B — only where this harness installed the service

Installs `FocusBlockService` from the built binary, starts it, and drives a real session:
start (dummy dies), stop (new dummy survives 6s, history records a stop), start again,
restart the service through Windows service management, then require the same session id
to come back with `kernel_events` enforcement and a fresh dummy to die again.

```powershell
# elevated PowerShell, disposable Windows environment with no FocusBlock install
$env:FOCUS_REAL_ENFORCEMENT = "tier-b"
$env:FOCUS_DISPOSABLE_WINDOWS_ACK = "1"
cargo test -p focus-service tier_b -- --nocapture --test-threads=1
```

Tier B provisions only its own service. It does not install anything else and does not
change system settings.

## One run at a time

Both tiers take `%TEMP%\focus-block-real-enforcement.lock` for the whole run — setup,
execution, cleanup — so parallel test threads, a second executable, or a second terminal
cannot overlap enforcement. If a crash leaves the file behind, delete it and retry.

## Cleanup

- Test children are reaped on success and on assertion failure.
- Temporary stores are deleted; the shared database is never used.
- Tier B stops the session, stops and deletes the service, and removes the disposable
  data directory even when an assertion fails.
- If a runner is killed abruptly, recover by hand:

```powershell
sc query FocusBlockService
sc delete FocusBlockService        # only on the disposable machine
Remove-Item -Recurse -Force "$env:ALLUSERSPROFILE\FocusBlock"
Remove-Item "$env:TEMP\focus-block-real-enforcement.lock"
```

## Prove the check can fail

Before trusting a green run, mutate the behavior and confirm the check notices:

1. In `src/app_enforcement.rs::inspect_and_terminate_process`, make the match path return
   `None` without calling `TerminateProcess`.
2. Run Tier A: `tier_a_dummy_launch_is_terminated_with_kernel_events` must fail.
3. Revert the mutation.

This is a manual step; it is not automated because the harness cannot edit and rebuild
its own enforcement code safely.

## Reporting

A guarded run prints each check it completed (`[real-enforcement:TierA] ...`), including
the measured launch-to-exit time. Leave a tier that could not be run — no disposable
machine, no elevation — explicitly outstanding rather than reporting it as passing.
