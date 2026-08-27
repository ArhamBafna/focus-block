# Focus-Block Audit Report

Generated 2026-08-25 via 6 parallel read-only specialist reviews (security, correctness, regressions, architecture, performance, test coverage). Every finding below was re-verified against actual source by the main thread; unverifiable claims were dropped. Read-only pass — no code changed.

Severity scale: CRITICAL > HIGH > MEDIUM > LOW.

---

## HIGH

### H1. Punctuation-only blocklist entries (`*.`, `.`) become catch-all web blockers
- **Where:** `apps/extension/popup/lib/ipc.ts:142-154` (`isValidStoredDomain`) and mirrored copy `apps/extension/background/service-worker.ts` (~L152-162), consumed at `service-worker.ts:186`.
- **Verified:** `SAFE_DOMAIN_CHARS = /^[a-z0-9.-]+$/` matches `"."`. `normalizeDomain("*.")` returns `"*."`; wildcard branch only checks `matchText.length > 0`. Non-wildcard branch accepts `"."` too (`includes(".")` true).
- **Why a problem:** stored `"*."` becomes DNR `urlFilter: "*.*"`, which matches every URL containing a dot — effectively the whole internet blocked for the session from one typo. Tests cover `*foo(bar` but not dot-only input.
- **Smallest fix:** in both copies of `isValidStoredDomain`, add `if (!/[a-z0-9]/.test(str)) return false;`.

### H2. Named-pipe IPC accepts any local caller; unprivileged process can kill active blocking
- **Where:** `crates/focus-ipc/src/server.rs:30-32,58-66`; pipe name `crates/focus-core/src/protocol.rs:6`; handler passes `StopSession` straight through (`service/focus-service/src/service.rs:208-214`, `session_manager.rs:337-365` calls `app_enforcer.clear()` removing WFP filters).
- **Why a problem:** any local process can open `\\.\pipe\focusblock` and send `StopSession`; SYSTEM-level enforcement silently removed without admin rights. Local-only (remote clients rejected) but still defeats core purpose.
- **Smallest fix:** restrict pipe DACL to SYSTEM+Administrators+interactive user SID, or per-install shared-secret token as first field of every request.

### H3. Unbounded frame allocation from untrusted length prefix (DoS on service)
- **Where:** `crates/focus-ipc/src/codec.rs:6-8` — `let len = reader.read_u32_le().await? as usize; let mut buf = vec![0u8; len];`
- **Why a problem:** up to ~4 GiB zeroed allocation inside LocalSystem service from an 8-byte write; combined with uncapped `tokio::spawn` per connection (`server.rs:45`) → memory/handle exhaustion. Sibling parser does it right: `native_host.rs:145-147` caps at 1 MiB.
- **Smallest fix:** reject `len > 1024*1024` in `read_message` (and client read `client.rs:61-63`).

### H4. Service crash-loops at boot when BFE isn't up (recent change)
- **Where:** `service/focus-service/src/session_manager.rs:32-41` — expired-at-startup path does `mgr.app_enforcer.clear()?`, propagating out of `SessionManager::new()`.
- **Why a problem:** `FwpmEngineOpen0` fails if Base Filtering Engine isn't running yet; installer sets no BFE dependency (`install-focusblock.ps1:46`). On reboot where the service wins the race, SCM restarts every 5 s until BFE starts; IPC pipe down, desktop shows "unreachable". Adjacent branch (L42-49) correctly logs-and-retries instead.
- **Smallest fix:** mirror sibling branch: `if let Err(error) = mgr.app_enforcer.clear() { error!("failed to remove stale filters; will retry: {error}"); }` and/or add BFE dependency in installer.

### H5. No single source of truth for blocklists between extension and desktop/service
- **Where:** extension stores domains in chrome.storage (`apps/extension/popup/lib/ipc.ts:307`); service stores in SQLite (`service/focus-service/src/session_manager.rs:93`). Native-messaging bridge built to unify (`native_host.rs`, installer registers `com.focusblock.bridge`) but never wired: zero `connectNative`/`sendNativeMessage` in `apps/extension`, and `manifest.json` lacks `"nativeMessaging"` permission.
- **Why a problem:** two unrelated blocklists maintained by hand; CWS listing justifies a permission that doesn't exist; `BlockingPolicySnapshot` has no consumer.
- **Smallest fix:** decide once: wire `nativeMessaging` + client, or remove host registration/listing copy until implemented. Record in ADR.

### H6. Domain normalization implemented 3x, already drifted
- **Where:** Rust authority `crates/focus-core/src/domain.rs:25` (no charset check); desktop copy `apps/desktop/src/lib/ipc.ts:105`; extension hardened variant `apps/extension/popup/lib/ipc.ts:142` (+ verbatim duplicate in service-worker.ts).
- **Verified drift:** `*game` accepted by extension, rejected by desktop/Rust; `exa!mple.com` accepted by desktop, rejected by extension.
- **Why a problem:** entries valid on desktop flow into snapshots the extension must render/block; behavior differs per surface.
- **Smallest fix:** one shared TS module + extend existing parity test (`apps/desktop/src/lib/ipc.parity.test.ts`) with a fixture corpus; make Rust explicitly accept-or-reject `*`.

## MEDIUM

### M1. Session ending outside manual stop leaves orphaned pending challenge
- **Where:** `apps/extension/background/service-worker.ts:589-608` (`expireSession`) and finalize branches at ~L648/L658 never clear `active_challenge`; `stopSessionLocked` does (L772). Popup gates on it: `apps/extension/popup/pages/Home.tsx:210`.
- **Scenario:** challenge started in final seconds, expiry alarm fires mid-challenge → gate rendered with no session behind it; user must solve challenge to "stop" an already-ended session.
- **Fix:** clear `active_challenge` inside `finalizeActiveSession`.

### M2. Popup list mutations bypass background mutation lock; `Date.now()` IDs collide
- **Where:** `apps/extension/popup/lib/ipc.ts:309-328` (blocklist), 334-353 (whitelist), 371-391 (temp allows), 398-443 (schedules). Sessions already go through `withLock` messages precisely to avoid this class of race.
- **Scenario:** double-click Add → interleaved read-push-write loses an entry; same-millisecond adds get identical ids → later `removeBlocklist(id)` removes two rows.
- **Fix:** route mutations as background messages under lock, or minimally disable submit buttons while a write is in flight.

### M3. Service stop no longer ends sessions or removes blocking (behavior change)
- **Where:** `service/focus-service/src/session_manager.rs:251-253` — `shutdown()` is now a no-op `Ok(())`; WFP filters are persistent and survive `sc stop` and reboot.
- **Why a problem:** previously stopping the service regained control; now machine stays blocked until service runs again or provider manually deleted. No uninstall/cleanup step for the persistent provider exists in repo. Intentional-looking ("preserving active policy for restart") but silently alters a prior guarantee; also plants expired rows that trigger H4 path.
- **Fix if unintended:** restore finalization in `shutdown()`. If intended: ship cleanup tooling + document.

### M4. Full system process enumeration 4x/sec even with zero app targets
- **Where:** `service/focus-service/src/app_enforcement.rs:205-206,238-258`; driven every 250 ms by `service/focus-service/src/service.rs:225-229`.
- **Why a problem:** web-only sessions pay full cost: ~300 processes × 4/sec = ~1,200 OpenProcess+path queries/sec, ~20 MB/s transient 64 KB allocations, plus warn-log spam for protected processes (~100-200 events/sec). Runs while holding the single manager mutex, stalling IPC/status polls.
- **Fix:** early-return when `targets.is_empty()`; decouple kill-loop to its own 1-2 s interval; drop warn→trace.

### M5. Blocked-folder recursive rescan + canonicalize of every EXE every 2 s
- **Where:** `app_enforcement.rs:207-212,225-236,293-350` — equality guard skips WFP rewrite but not the filesystem walk; runs under the global mutex.
- **Fix:** cache computed identities; recompute only when `targets` changes or forced refresh.

### M6. Blocking OS/WFP/SQLite work inline on tokio runtime under one global mutex
- **Where:** `service/focus-service/src/service.rs:224-233` (tick) and `208-214` (IPC handler). Desktop Home polls at 1 Hz (`apps/desktop/src/pages/Home.tsx:68`) through the same mutex → recurring UI latency spikes during ticks.
- **Fix:** `tokio::task::spawn_blocking` for tick body / SQLite calls; clone data, release guard, re-lock to commit.

### M7. Extension rule-churn guard is memory-only; every SW cold start rewrites all DNR rules
- **Where:** `apps/extension/background/service-worker.ts:321-339` — `lastRulesJson` module variable resets when MV3 kills the worker (~30 s idle); next reconcile does remove-all+add-all even when identical.
- **Fix:** persist hash in `chrome.storage.session`, or compare against actual `getDynamicRules()` result before writing.

### M8. `finalizeActiveSession` two-write sequence not atomic → duplicated history rows after crash
- **Where:** `apps/extension/background/service-worker.ts:484-496` — `pushHistory(archived)` then `storageSet("active_session", null)`; MV3 worker death between awaits leaves live-status record that re-finalizes later.
- **Fix:** dedupe in `pushHistory`: filter out existing record with same id before unshift.

### M9. Presets feature exists end-to-end but does nothing
- **Where:** `apps/desktop/src/pages/Presets.tsx:38` creates presets with hardcoded empty lists; `session_manager.rs:301-306` ignores `preset_id` when starting sessions; `FocusStore::get_preset` (`crates/focus-store/src/store.rs:311-316`) has zero production callers; extension carries `preset_id?` parameter with no preset UI.
- **Why a problem:** users create a preset; blocking behavior unchanged. Silent contract break across IPC.
- **Fix:** honor `preset_id` in `start_session` (load and override lists/mode/duration), or remove Presets page + IPC variants until designed.

### M10. `list_store_apps` PowerShell JSON breaks with 0 or 1 Start-menu apps (recent)
- **Where:** `apps/desktop/src-tauri/src/lib.rs:34-66` — `@($apps) | ConvertTo-Json -Compress` unrolls arrays in PS 5.1: 1 element emits `{...}`, 0 emits nothing; Rust `from_str::<Vec<StoreApp>>` errors → Store-app picker always fails on minimal Windows installs.
- **Fix:** `ConvertTo-Json -Compress -InputObject @($apps)`.

## LOW

### L1. Stray migration silently discards `"cancelled"` records
- **Where:** `apps/extension/background/service-worker.ts:527-531` — only `completed`/`stopped` archived; `"cancelled"` is a first-class outcome elsewhere. Data drop, inconsistent with type model. Fix: accept `"cancelled"` in archive branch.

### L2. No server-side duration validation in `session:start`
- **Where:** `service-worker.ts:791` coerces non-number to `0`; `NaN` passes typeof check → instant-expire spam (`0`) or un-expirable session with misleading error (`NaN` throws at alarm create after rules installed). Fix: first line of `startSessionLocked`: reject `!Number.isFinite(d) || d <= 0`.

### L3. Scheduled-session popup countdown uses frozen `planned_duration_sec`
- **Where:** `apps/extension/popup/lib/ipc.ts:290-298` vs worker's live-boundary logic (`service-worker.ts:700-706`). Mid-session schedule edits make display diverge from real expiry. Fix: compute remaining from schedule boundary in `getStatus`.

### L4. Back-to-back scheduled windows label finished window `"stopped"` instead of `"completed"`
- **Where:** `service-worker.ts:563` hardcodes outcome on supersede. Fix: use `scheduledSessionOutcome(active.scheduled_schedule_id)`.

### L5. Native-host origin check fails open; env var never set anywhere
- **Where:** `service/focus-service/src/native_host.rs:82-88` — `FOCUSBLOCK_EXTENSION_ID` unset repo-wide so check always skipped. Real gate is installer manifest. Fix: compile-time ID or fail closed when absent.

### L6. Tauri CSP disabled
- **Where:** `apps/desktop/src-tauri/tauri.conf.json:20` `"csp": null`; window exposes `ipc_request` incl. StopSession. Fix: `"default-src 'self'; style-src 'self' 'unsafe-inline'"`.

### L7. Duplicate `"test"` script key; orphaned test file
- **Where:** `apps/extension/package.json` defines `"test"` twice (`node --test scripts/ipc-response.test.mjs` then `vitest run`); last wins, so `scripts/ipc-response.test.mjs` (only tests for several `normalizeDomain` edges) never runs in CI. Fix: delete dead key or fold mjs into vitest include.

### L8. Extension history grows unbounded toward chrome.storage 10 MB cap
- **Where:** `service-worker.ts:477-482` — nothing trims; each record embeds full domain snapshots; whole blob rewritten per archive. Fix: cap length (e.g., 500) in `pushHistory`.

### L9. Dead code (verified by repo-wide grep)
- `focus_core::domain_matches` (`domain.rs:32-36`), `IpcClient::ping` (`focus-ipc/client.rs:24-28`), `FocusStore::get_setting_u64` (`store.rs:104-108`), `Session::end()` bypassed everywhere (`session.rs:107-117`; manager sets fields by hand), unused assets `apps/desktop/public/vite.svg`/`tauri.svg`/`src/assets/react.svg`, unused deps `framer-motion` (desktop) + `@types/chrome` (desktop devDeps), dead log directives `focus_dns`/`focus_wfp` (`main.rs:13-14`), empty `rule_resources` stub (manifest.json).

### L10. Desktop↔extension copy-forked UI/logic drifts unmanaged
- Near-verbatim `Home.tsx` twins, duplicated `formatTime`, cloned DomainListPage vs Blocklists editors, 200+ lines CSS tokens copied by hand, status vocabulary split three ways (Rust lacks `cancelled`). Parity test covers exactly one method. Fix direction: shared workspace package + wider parity fixtures.

### L11. Desktop Home polls at 1 Hz forever, re-renders every second even idle
- **Where:** `apps/desktop/src/pages/Home.tsx:66-71`. Fix: 5 s idle poll, 1 s only while session active; skip state set when payload unchanged.

### L12. Security nits
- Actions pinned to tags not SHAs (`.github/workflows/ci.yml`); `web_accessible_resources` exposes blocked page to all sites (minor fingerprinting; page itself safe — uses `textContent`).

## Verified-clean areas

- No secrets committed (regex sweep: AWS/GitHub/Google keys, PEM, tokens — nothing real).
- No XSS sinks in any TS/TSX (no innerHTML/dangerouslySetInnerHTML/eval); blocked page escapes properly; domain regexes escaped before DNR.
- SQL fully parameterized; PS installer validates extension-ID format twice.
- Schedule day-math sound: DST spring-forward clamp deliberate + pinned by test; overnight windows impossible by construction; weekly cadence scan correct.
- Session mutations correctly serialized under `withLock`; alarm-vs-storage races handled; MV3 cache loss benign.
- Tauri shell thin proxy; native host owns no policy; crate layering single-sourced.
- Existing-user DB migrated via explicit ALTER TABLE, not CREATE-only.

## Priority order

H1 (one-line fix, user-bricking typo) → H4/H3/H2 (service robustness/security) → M1/M2/M8 (state consistency) → M4-M7 (perf) → H5/M3/M9/M10 (product decisions/recent regressions) → LOWs opportunistically.
