# Graph Report - focus-block  (2026-11-13)

## Corpus Check
- 128 files · ~85,338 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 16 file(s) not represented in the graph (top: (none) 5, .css 3, .woff2 2)

## Summary
- 1467 nodes · 2544 edges · 154 communities (69 shown, 85 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `529359aa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FocusStore
- src/lib/ipc.ts
- dependencies
- FocusBlock Application
- extension/package.json
- service.rs
- protocol.rs
- Freedom.to
- test_support.rs
- manifest.json
- src-tauri/src/lib.rs
- Runbook: how to run FocusBlock (service + desktop)
- ref_vitest
- Schedule.tsx
- warn
- tauri.conf.json
- compilerOptions
- popup/lib/ipc.ts
- compilerOptions
- session.rs
- ipc
- service-worker.ts
- .with_timeout
- Presets.tsx
- Send
- Sync
- Enforcement (Feature Category)
- popup/pages/Home.tsx
- DomainEntry
- default.json
- compilerOptions
- Preset
- devDependencies
- Schedule
- applyBlockingState
- Local Data Storage [DONE]
- Mindful Unlock Flow (Delay + Breathing Task + Ask Why)
- Pomodoro Timer / Custom Pomodoro Rules [NOT YET]
- os
- sqlite3
- FocusBlock Design System
- storeapp
- subprocess
- sys
- session_manager.rs
- focus-core
- Key Changes
- Vite Logo SVG (favicon)
- FakeEnforcer
- TempDb
- Session
- Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background
- Focus Block app branding (interlocking orange and cyan circular mark on black)
- blocked.js
- SessionMode
- Box
- native-sync.test.ts
- Drop
- StoreError
- Uuid
- Enforcement
- AppBlockTarget
- Focus Block desktop app built with Tauri
- React framework logo (SVG asset)
- Focus Block 32x32 app icon (cyan and amber circular mark)
- Focus Block main app icon - two interlocking circular arcs (amber and cyan) with offset dots on black, forming a stylized focus/block motif
- Tauri Windows app packaging icon requirement (MSIX/Square logo assets)
- Square142x142Logo.png - Windows Store square logo asset (cyan/orange abstract mark)
- Square150x150Logo.png - Windows Store square logo asset (150x150) for the Tauri desktop app
- Focus Block Windows Store square logo (284x284) - interlocking yellow and cyan circular arcs forming an abstract figure-8/focus mark on black background
- Square310x310Logo.png - Windows Store large square logo (interlocking cyan and amber circular arcs with dot centers on black background)
- Square44x44Logo.png - Windows Store square logo asset depicting two interlocking arcs in cyan and amber forming an abstract link/chain mark on black
- Square89x89Logo.png - app icon asset (interlocking cyan and orange circular shapes on black)
- Focus-block brand identity: two interlocking arcs (amber and teal) with focal dots, evoking connection/blocking and focus
- Chrome extension branding asset used for toolbar action, extensions management page, and Chrome Web Store listing
- Distraction blocking concept - shield/blocked-symbol motif visually representing focus-block's core website-blocking function
- Focus/target symbol design (white concentric circles on purple rounded square)
- BTreeSet
- collections
- Arc
- BlockedAppEvent
- Default
- Motion Rules (motion/react)
- Student Market Segment (budget-sensitive students)
- Core Blocking (Feature Category)
- Focus Streaks (Consecutive Focus Days)
- focus-service/src/main.rs
- AGENTS.md Project Instructions
- Enforcement
- Error
- deriveappcontainersidfromappcontainername
- ffi
- Focus-block app icon 256x256 (@2x retina variant): two interlocking arcs in amber/orange and cyan forming a stylized '8'/link motif on black background, representing focus blocking/connection between desktop app and browser
- Square30x30Logo.png - Windows Store small square logo icon (dark rounded-square background with yellow and teal interlocking circular shapes)
- GUID
- extension/vite.config.ts
- PSID
- rpc_c_authn_default
- Spacing Scale
- Accountability Partner (Pair With Another User)
- PRODUCT.md Product Definition
- Target Users (Freelancers, Students, Employees)
- security
- storage.ts
- focus-store/src/codec.rs
- Home.test.tsx
- Instant
- Issue tracker: GitHub
- Domain Docs
- DesktopFlow.e2e.test.tsx
- IpcRequest
- app_enforcement.rs
- IpcResponse
- Mutex
- handle_connection
- Option
- desktop/package.json
- src/App.tsx
- Output
- real_enforcement.rs
- popup/App.tsx
- read_message
- windowsfilteringplatform
- Path
- PathBuf
- Chrome Web Store Submission — Focus Blocker
- server.rs
- Focus Blocker — Privacy Policy
- src/pages/Blocklists.tsx
- fixtures.ts
- ref_node_fs
- ref_node_test
- ipc.parity.test.ts
- Result
- Self
- ref_node_assert
- App blocking test harness
- ChildGuard
- native_host.rs
- String
- FocusStore
- ServiceStatus
- Vec
- FocusStore
- focus_core
- scheduled-stop-suppression.test.ts
- popup/pages/Whitelist.tsx
- ipc.bridge.test.ts
- desktop/vitest.config.ts
- GuardedRun

## God Nodes (most connected - your core abstractions)
1. `FocusStore` - 50 edges
2. `SessionManager` - 28 edges
3. `Freedom.to` - 25 edges
4. `AppEnforcer` - 24 edges
5. `applyBlockingState()` - 22 edges
6. `FakeEnforcer` - 20 edges
7. `compilerOptions` - 18 edges
8. `Session` - 17 edges
9. `compilerOptions` - 16 edges
10. `run_process_watcher()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `What `cargo test` does by default` --references--> `FakeEnforcer`  [EXTRACTED]
  docs/app-blocking-tests.md → service/focus-service/src/test_support.rs
- `Prove the check can fail` --references--> `inspect_and_terminate_process()`  [EXTRACTED]
  docs/app-blocking-tests.md → service/focus-service/src/app_enforcement.rs
- `Brand Personality: Firm, Focused, De-stressing` --semantically_similar_to--> `Firm, Calm UX Principle`  [INFERRED] [semantically similar]
  PRODUCT.md → README.md
- `Desktop App Entry HTML` --references--> `FocusBlock Application`  [INFERRED]
  apps/desktop/index.html → README.md
- `Freedom.to Functional Reference` --conceptually_related_to--> `FocusBlock Application`  [INFERRED]
  AGENTS.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Network-Level Blocking Pipeline** — readme_md_smart_blocking, apps_extension_build_md_dnr_blocking, apps_extension_build_md_data_flow, apps_extension_blocked_index_blocked_site_blocked_page [INFERRED]
- **WisprFlow-Derived Design Language** — agents_md_wisprflow_ui_directive, design_md_color_tokens, design_md_typography_figtree, apps_extension_blocked_index_blocked_site_blocked_page, apps_extension_popup_index_popup_entry_html [INFERRED]

## Communities (154 total, 85 thin omitted)

### Community 0 - "FocusStore"
Cohesion: 0.08
Nodes (37): AppBlockEntry, AsRef, Connection, SCHEMA, SEED_PRESETS, corrupt_history_row_is_skipped_others_still_load(), corrupt_preset_row_is_skipped_others_still_load(), corrupt_schedule_row_is_skipped_others_still_load() (+29 more)

### Community 1 - "src/lib/ipc.ts"
Cohesion: 0.12
Nodes (20): ActiveSessionView, ALL_DAYS, AppBlockTargetList, BridgeEnvelope, BridgeFailure, BridgeFailureKind, dateRangesOverlap(), errorMessage() (+12 more)

### Community 2 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, framer-motion, @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss, @tailwindcss/vite (+3 more)

### Community 3 - "FocusBlock Application"
Cohesion: 0.05
Nodes (38): Chrome Extension Skills Directive, Extension Rebuild Rule, Freedom.to Functional Reference, Two User-Facing Parts (Desktop + Extension), Desktop App Entry HTML, Site Blocked Interstitial Page, Extension Build & Testing Guide, chrome.storage.local Persistence (+30 more)

### Community 4 - "extension/package.json"
Cohesion: 0.04
Nodes (44): allowScripts, canvas@3.2.3, dependencies, @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss (+36 more)

### Community 5 - "service.rs"
Cohesion: 0.14
Nodes (19): Arc, focus_ipc, Receiver, configure_service_recovery(), Box, Duration, Error, Option (+11 more)

### Community 6 - "protocol.rs"
Cohesion: 0.07
Nodes (37): ActiveSessionView, AppBlockTargetList, AppSettings, chrono, crate, AppBlockEntry, AppBlockTarget, AppBlockTargetList (+29 more)

### Community 7 - "Freedom.to"
Cohesion: 0.07
Nodes (32): Feature Gap: Accountability Partnerships (buddy system), Opportunity: Adaptive AI Coach (predictive blocking), Block The Internet (full kill switch), Cold Turkey, Opportunity: Cross-Device Auto-Sync with Easy Setup (#1 ranked), Cross-Device Sync (one session everywhere), Pain Point: Ease of Bypass (#1 user gripe), Focus-Block Product (research subject) (+24 more)

### Community 8 - "test_support.rs"
Cohesion: 0.12
Nodes (29): FnMut, process, tier_b_service_lifecycle_start_stop_and_restart(), default_db_path(), PathBuf, ACK_ENV, ipc(), is_elevated() (+21 more)

### Community 9 - "manifest.json"
Cohesion: 0.07
Nodes (26): action, default_icon, default_popup, default_title, author, background, service_worker, type (+18 more)

### Community 10 - "src-tauri/src/lib.rs"
Cohesion: 0.09
Nodes (36): AppBlockTarget, extract_app_icon_native(), get_app_icon(), get_cached_icon(), icon_cache_dir(), icon_cache_separates_saved_icons_from_remembered_failures(), icon_miss_is_fresh(), icon_miss_marker() (+28 more)

### Community 11 - "Runbook: how to run FocusBlock (service + desktop)"
Cohesion: 0.50
Nodes (4): Run focus-service as Administrator (cargo run --bin focus-service -- --console), Runbook: how to run FocusBlock (service + desktop), Run Tauri desktop app in dev mode (cd apps/desktop; npm run tauri dev), WiX installer fragment to register focus-service as Windows Service (v1: manual launch)

### Community 12 - "ref_vitest"
Cohesion: 0.17
Nodes (10): ChromeMockHandles, installChromeMock(), WorkerModule, rawSet(), seedScheduledSession(), IpcModule, SendMessageOutcome, IpcModule (+2 more)

### Community 13 - "Schedule.tsx"
Cohesion: 0.11
Nodes (23): SessionMode, ALL_DAYS, DAY_OPTIONS, dayButtonStyle, daySummary(), displayTime(), endSummary(), errorStyle (+15 more)

### Community 15 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 16 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+13 more)

### Community 17 - "popup/lib/ipc.ts"
Cohesion: 0.12
Nodes (21): ActiveChallengeView, ActiveSessionView, ALL_DAYS, BackgroundResponse, BridgeEnvelope, BridgeFailure, BridgeFailureKind, dateRangesOverlap() (+13 more)

### Community 18 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 19 - "session.rs"
Cohesion: 0.13
Nodes (25): ActiveSessionView, double_end_is_impossible(), end_records_timestamp_and_reason(), ended_session_serializes_to_stable_wire_shape(), expired_session_reports_zero_remaining(), fresh_session_has_positive_remaining_within_planned(), future_started_at_clamps_elapsed_to_zero(), Preset (+17 more)

### Community 20 - "ipc"
Cohesion: 0.19
Nodes (9): COPY, DomainListPage(), DomainEntry, ipc, Session, formatDuration(), History(), statusBg() (+1 more)

### Community 21 - "service-worker.ts"
Cohesion: 0.10
Nodes (27): ActiveChallenge, addDomainRules(), ArchivedOutcome, BackgroundResponse, buildLockdownRules(), buildRules(), checkNativePolicy(), clearAllRules() (+19 more)

### Community 22 - ".with_timeout"
Cohesion: 0.35
Nodes (8): IpcClient, Error, Instant, IpcRequest, IpcResponse, Result, timeout_error(), unsupported()

### Community 23 - "Presets.tsx"
Cohesion: 0.16
Nodes (10): Preset, SessionMode, EMPTY_FORM, NewPresetForm, parseDomains(), Presets(), deletePreset, listPresets (+2 more)

### Community 26 - "Enforcement (Feature Category)"
Cohesion: 0.67
Nodes (3): Delay Override - Require Waiting Before Ending Session [NOT YET], Enforcement (Feature Category), Locked Mode - Sessions Cannot Be Stopped Early [PARTIAL]

### Community 27 - "popup/pages/Home.tsx"
Cohesion: 0.16
Nodes (10): ChallengeGate(), Props, AppSettings, ServiceStatus, shouldTriggerStopChallenge(), isMirrorSession(), formatTime(), Home() (+2 more)

### Community 29 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 30 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 32 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, jsdom, @tauri-apps/cli, @testing-library/dom, @testing-library/react, @types/chrome, @types/react, @types/react-dom (+4 more)

### Community 34 - "applyBlockingState"
Cohesion: 0.30
Nodes (21): activateScheduledSession(), applyBlockingState(), clearMirror(), expireSession(), finalizeActiveSession(), getActiveTemporaryAllows(), getCurrentSchedule(), getScheduleBoundary() (+13 more)

### Community 40 - "FocusBlock Design System"
Cohesion: 0.40
Nodes (5): design-extract-output Reference Directory, WisprFlow UI/UX Directive, FocusBlock Design System, theme.css (Tailwind v4 @theme), variables.css (CSS Custom Properties)

### Community 44 - "session_manager.rs"
Cohesion: 0.09
Nodes (64): IpcResponse, F, HashMap, Local, a_failed_release_keeps_enforcement_and_says_so(), a_session_with_no_app_targets_reports_inactive_enforcement(), construction_without_a_saved_session_clears_stale_enforcement(), degraded_blocking_is_visible_in_status_instead_of_looking_healthy() (+56 more)

### Community 45 - "focus-core"
Cohesion: 0.70
Nodes (5): desktop, focus-core, focus-ipc, focus-service, focus-store

### Community 46 - "Key Changes"
Cohesion: 0.14
Nodes (13): 1. Enforcement Seam (`service/focus-service/src/enforcement.rs`, `service/focus-service/src/real_enforcement.rs`), 2. Session Manager (`service/focus-service/src/session_manager.rs`), 3. Watcher Safety (`service/focus-service/src/app_enforcement.rs`), 4. Visible Degraded Mode (`crates/focus-core/src/protocol.rs`), 5. Dedicated Dummy Executable (`service/focus-service/examples/focus_test_dummy.rs`), 6. Opt-In Gates (`service/focus-service/src/test_support.rs`), 7. New Tests (28 tests total), App Blocking Implementation Summary (+5 more)

### Community 47 - "Vite Logo SVG (favicon)"
Cohesion: 0.67
Nodes (4): Vite Logo SVG (favicon), Desktop App Favicon/Branding, Iconify Logos Icon Set, Vite Build Tool

### Community 48 - "FakeEnforcer"
Cohesion: 0.26
Nodes (7): EnforcementMode, FakeEnforcer, FakeLog, Arc, BlockedAppEvent, Mutex, Self

### Community 49 - "TempDb"
Cohesion: 0.20
Nodes (9): OutOfProcessLock, Default, Drop, Path, PathBuf, Vec, service_exe(), sidecar_paths() (+1 more)

### Community 51 - "Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background"
Cohesion: 0.67
Nodes (3): Interlocking dual-ring visual motif suggesting focus, blocking, and connection between distraction and concentration, Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background, Tauri-based focus-block desktop application that uses this icon as its 128px application icon

### Community 52 - "Focus Block app branding (interlocking orange and cyan circular mark on black)"
Cohesion: 0.67
Nodes (3): Focus Block app branding (interlocking orange and cyan circular mark on black), Square71x71Logo.png - Windows Store square logo asset, Windows Store / MSIX small tile icon asset (71x71 px)

### Community 56 - "native-sync.test.ts"
Cohesion: 0.14
Nodes (6): ActiveSessionRecord, ArchivedSessionRecord, SessionBase, rawSet(), seedDomainList(), UpdateOptions

### Community 60 - "Enforcement"
Cohesion: 0.29
Nodes (5): Enforcement, Option, Result, Send, String

### Community 98 - "extension/vite.config.ts"
Cohesion: 0.32
Nodes (3): ref_tailwindcss_vite, ref_vite, ref_vitejs_plugin_react

### Community 106 - "storage.ts"
Cohesion: 0.12
Nodes (18): ActiveSessionRecord, ALL_DAYS, ArchivedOutcome, ArchivedSessionRecord, ChallengeRecord, DEFAULTS, DomainListEntry, NATIVE_MIRROR_ID_PREFIX (+10 more)

### Community 107 - "focus-store/src/codec.rs"
Cohesion: 0.08
Nodes (19): domain_matches(), normalize_domain(), Option, String, encode_domain_list(), encode_mode(), encode_status(), parse_domain_list() (+11 more)

### Community 108 - "Home.test.tsx"
Cohesion: 0.17
Nodes (11): ServiceStatus, formatTime(), Home(), HomePhase, buildStatus(), Deferred, Envelope, getStatusSafe (+3 more)

### Community 110 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 111 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 112 - "DesktopFlow.e2e.test.tsx"
Cohesion: 0.20
Nodes (9): addAppBlockTarget, getStatusSafe, listAppBlockTargets, listBlocklist, listHistory, listInstalledApps, listWhitelist, startSession (+1 more)

### Community 114 - "app_enforcement.rs"
Cohesion: 0.06
Nodes (56): atomic, AtomicBool, BlockedAppEvent, com, core, Default, Enforcement, EnforcementMode (+48 more)

### Community 117 - "handle_connection"
Cohesion: 0.22
Nodes (11): c_void, handle_connection(), IpcServer, PipeSecurity, Result, Self, Drop, NamedPipeServer (+3 more)

### Community 119 - "desktop/package.json"
Cohesion: 0.07
Nodes (27): @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss, @tailwindcss/vite, @types/chrome, @types/react (+19 more)

### Community 120 - "src/App.tsx"
Cohesion: 0.11
Nodes (10): App(), navItems, AppBlockedModal(), Props, AppSettings, BlockedAppEvent, ErrorBoundary, App() (+2 more)

### Community 122 - "real_enforcement.rs"
Cohesion: 0.21
Nodes (11): appenforcer, default_db_path, FocusStore, BLOCK_DEADLINE, dedicated_dummy_executable_is_available(), dummy_target(), OBSERVE_RELEASED, AppBlockTarget (+3 more)

### Community 123 - "popup/App.tsx"
Cohesion: 0.12
Nodes (17): navItems, DomainEntry, ipc, Session, Blocklists(), formatDuration(), History(), statusBg() (+9 more)

### Community 124 - "read_message"
Cohesion: 0.22
Nodes (9): read_message(), Result, write_message(), Error, String, StoreError, io, R (+1 more)

### Community 128 - "Chrome Web Store Submission — Focus Blocker"
Cohesion: 0.17
Nodes (11): 0. First-time setup (one time only), 1. Package the upload, 2. Store listing, 3. Single purpose, 4. Permission justifications, 5. Privacy tab (dashboard), 6. Version history entry (0.2.0), 7. Distribution (+3 more)

### Community 129 - "server.rs"
Cohesion: 0.25
Nodes (7): codec, future, imp, ipcclient, named_pipe, pin, tracing

### Community 130 - "Focus Blocker — Privacy Policy"
Cohesion: 0.18
Nodes (10): Changes, Contact, Deletion, Focus Blocker — Privacy Policy, How the permissions are used, Retention, Sharing, Summary (+2 more)

### Community 131 - "src/pages/Blocklists.tsx"
Cohesion: 0.17
Nodes (18): AppPickerModal(), apps_desktop_src_components_apppickermodal_discoveredapp, Props, DiscoveredApp, getAppIcon(), listInstalledApps(), listStoreApps(), pickExecutable() (+10 more)

### Community 132 - "fixtures.ts"
Cohesion: 0.05
Nodes (40): copyDir(), __dirname, dist, root, children, start(), __dirname, iconsDir (+32 more)

### Community 135 - "ipc.parity.test.ts"
Cohesion: 0.28
Nodes (3): IpcModule, invokeMock, MemoryStorage

### Community 139 - "App blocking test harness"
Cohesion: 0.14
Nodes (12): App blocking enforcement limits, Reporting which method is enforcing, Test safety, App blocking test harness, Cleanup, One run at a time, Prove the check can fail, Real runs are gated (+4 more)

### Community 141 - "ChildGuard"
Cohesion: 0.29
Nodes (3): Child, ExitStatus, ChildGuard

### Community 142 - "native_host.rs"
Cohesion: 0.17
Nodes (20): BlockingPolicySnapshot, deserialize, Read, Serialize, inactive_policy(), main(), MAX_NATIVE_MESSAGE_BYTES, native_request_allowed() (+12 more)

### Community 148 - "focus_core"
Cohesion: 0.29
Nodes (6): clientoptions, DEFAULT_TIMEOUT, Duration, focus_core, pipe_name, time

### Community 149 - "scheduled-stop-suppression.test.ts"
Cohesion: 0.38
Nodes (5): Schedule, history(), rawGet(), rawSet(), seedScheduledSession()

### Community 150 - "popup/pages/Whitelist.tsx"
Cohesion: 0.38
Nodes (6): TemporaryAllowEntry, addButtonStyle, inputStyle(), remainingTime(), removeButtonStyle, Whitelist()

### Community 151 - "ipc.bridge.test.ts"
Cohesion: 0.50
Nodes (3): everyCommand, invokeMock, IpcModule

### Community 152 - "desktop/vitest.config.ts"
Cohesion: 0.50
Nodes (3): appRoot, ref_node_path, ref_node_url

### Community 153 - "GuardedRun"
Cohesion: 0.23
Nodes (8): Into, GuardedRun, requested_tier(), AppBlockTarget, Option, Result, String, Tier

## Ambiguous Edges - Review These
- `Vite Logo SVG (favicon)` → `Vite Build Tool`  [AMBIGUOUS]
  apps/desktop/public/vite.svg · relation: rationale_for

## Knowledge Gaps
- **454 isolated node(s):** `ArchivedOutcome`, `ActiveChallenge`, `StorageData`, `mutationTail`, `BackgroundResponse` (+449 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 698 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **85 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Vite Logo SVG (favicon)` and `Vite Build Tool`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `start()` connect `fixtures.ts` to `ref_vitest`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `FocusStore` connect `FocusStore` to `test_support.rs`, `TempDb`, `session_manager.rs`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `canvas` connect `fixtures.ts` to `extension/package.json`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `ArchivedOutcome`, `ActiveChallenge`, `StorageData` to the rest of the system?**
  _454 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FocusStore` be split into smaller, more focused modules?**
  _Cohesion score 0.0795196364816618 - nodes in this community are weakly interconnected._
- **Should `src/lib/ipc.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1225296442687747 - nodes in this community are weakly interconnected._