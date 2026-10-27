# App Blocking Implementation Summary

## Overview

This commit rewrites the app blocking safety story for FocusBlock, moving from a machine-persistent Windows Filtering Platform (WFP) / firewall approach to an event-driven model that terminates processes at launch. The changes enable safe test execution and make blocking mode visible in the service status without requiring UI work.

## Key Changes

### 1. Enforcement Seam (`service/focus-service/src/enforcement.rs`, `service/focus-service/src/real_enforcement.rs`)
- Introduced a 4-method `Enforcer` trait defining the enforcement contract
- Split into two implementations:
  - **Fake enforcer** (`test_support.rs`): Used by tests, records intentions without touching real processes
  - **Real enforcer** (`real_enforcement.rs`): Two tiers of execution
    - **Tier A**: Kills a dedicated dummy executable on launch via kernel events — runs on any dev PC where FocusBlock is not installed/running and no real data exists
    - **Tier B**: Full lifecycle (start → kill → stop → restart → expiry) — only on a machine where the test installed its own dedicated service

### 2. Session Manager (`service/focus-service/src/session_manager.rs`)
- Constructs either the real or injected enforcer based on `FOCUS_REAL_ENFORCEMENT` env var
- No longer hardwires a real enforcer at construction — previously a test could not help but use the real one, which on startup would re-apply saved sessions and kill the developer's own blocked apps

### 3. Watcher Safety (`service/focus-service/src/app_enforcement.rs`)
- `stop_watcher` now awaits a bounded 2-second shutdown before allowing a replacement
- If the watcher cannot prove it has stopped, it refuses to start a replacement, reports `polling_fallback`, and returns an error instead of leaving two watchers running (the overlapping-guard defect)

### 4. Visible Degraded Mode (`crates/focus-core/src/protocol.rs`)
- `ServiceStatus` gains `enforcement_mode: Option<EnforcementMode>` (`inactive` / `kernel_events` / `polling_fallback`)
- A machine where the WMI subscription failed can no longer look healthy — the mode is explicit

### 5. Dedicated Dummy Executable (`service/focus-service/examples/focus_test_dummy.rs`)
- A minimal binary that Tier A terminates on launch; never touches real focus data

### 6. Opt-In Gates (`service/focus-service/src/test_support.rs`)
- Prerequisite checks before any enforcement runs:
  - Platform: Windows only
  - Elevation: must be running as admin
  - No existing `FocusBlockService` installed
  - No running FocusBlock processes
  - No `data.db` in `%ProgramData%\FocusBlock\`
  - Real subscription probe succeeds
- Every failure is loud; an unknown tier value fails loudly too
- Two-level tier system: Tier A may run on any dev PC (only kills dummy), Tier B only where the test installed its own service

### 7. New Tests (28 tests total)
- **18 in focus-service**: tier A/b lifecycle, system tool exclusions, package name matching, construction without saved session clears stale enforcement, session with no targets reports inactive, degraded blocking visible in status, expired session completes on recovery without replacing it, enforcement failure surfaces error, rapid start/stop cycles never apply before releasing, failed release keeps enforcement and says so, reopening restores saved identity and policy, start applies saved targets and reports mode, stop releases enforcement and records history, expiry completes saved session
- **10 in session_manager**: construction without saved session, session with no targets, degraded visibility, expired recovery, enforcement failure, rapid start/stop, failed release, reopening identity/policy

## What Was NOT Changed
- No Windows Filtering Platform / firewall filters are created or modified
- No machine-wide persistent state beyond `%ProgramData%\FocusBlock\data.db`
- No desktop or extension UI changes
- No automatic machine provisioning

## Test Results
- `cargo test --workspace`: 49 tests pass (18 focus-service, 16 session/protocol/domain, 13 codec/store, 2 desktop)
- `cargo clippy`: Only 3 pre-existing warnings in untouched code
- Default suite leaves `%ProgramData%\FocusBlock\data.db` untouched

## Remaining Open Items
- Neither real tier has been executed in this environment — they require a clean machine, appropriate env vars, and admin elevation
- The separate desktop ticket for showing "degraded blocking" in the UI remains outstanding
- Both issues #46 and #47 stay open until someone records a real enforcement run