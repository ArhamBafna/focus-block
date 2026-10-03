# Graph Report - focus-block  (2026-10-02)

## Corpus Check
- 151 files · ~102,026 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 5, .css 3, .bat 3)

## Summary
- 1375 nodes · 2127 edges · 106 communities (68 shown, 38 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `01ee4af8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FocusStore
- src/lib/ipc.ts
- dependencies
- FocusBlock Application
- extension/package.json
- Chrome Extensions Skill (Manifest V3)
- protocol.rs
- Freedom.to
- service-worker.ts
- manifest.json
- Content Scripts Reference
- Seven-crate Cargo workspace architecture
- ref_vitest
- Schedule.tsx
- applyBlockingState
- tauri.conf.json
- compilerOptions
- popup/lib/ipc.ts
- compilerOptions
- session.rs
- One-shot messaging with chrome.runtime.sendMessage
- popup/pages/Whitelist.tsx
- chrome-devtools-cli SKILL.md (.agents copy)
- HIGH
- Session Error Log - September 18, 2026
- SessionManager
- End Session Dialog
- popup/pages/Home.tsx
- chrome.storage areas comparison (local/sync/session)
- default.json
- compilerOptions
- ref_react
- devDependencies
- popup/pages/History.tsx
- MEDIUM
- startSessionLocked
- 1. What was added (implemented)
- FocusBlock Design System
- Service Worker (ephemeral background context)
- FocusBlock: Freedom.to-like Windows desktop app
- focus-core
- Service worker lifecycle and termination rules (30s idle, 5min hard cap)
- Vite Logo SVG (favicon)
- web_accessible_resources manifest declaration (MV3 scoped)
- Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background
- Focus Block app branding (interlocking orange and cyan circular mark on black)
- blocked.js
- Build tools comparison (CRXJS, WXT, Plasmo, Vite, Webpack, esbuild/tsup)
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
- Motion Rules (motion/react)
- Student Market Segment (budget-sensitive students)
- Core Blocking (Feature Category)
- Focus Streaks (Consecutive Focus Days)
- focus-service/src/main.rs
- AGENTS.md Project Instructions
- Context menus UI surface
- DevTools panel UI surface
- Notifications UI surface
- Omnibox keyword integration
- Focus-block app icon 256x256 (@2x retina variant): two interlocking arcs in amber/orange and cyan forming a stylized '8'/link motif on black background, representing focus blocking/connection between desktop app and browser
- Square30x30Logo.png - Windows Store small square logo icon (dark rounded-square background with yellow and teal interlocking circular shapes)
- extension/vite.config.ts
- Spacing Scale
- Accountability Partner (Pair With Another User)
- PRODUCT.md Product Definition
- Target Users (Freelancers, Students, Employees)
- storage.ts
- focus-store/src/codec.rs
- Home.test.tsx
- Issue tracker: GitHub
- Domain Docs
- DesktopFlow.e2e.test.tsx
- src/pages/History.tsx
- app_enforcement.rs
- LOW
- scripts
- desktop/package.json
- src/App.tsx
- Chrome Web Store Listing — Focus Blocker
- popup/App.tsx
- Chrome Web Store Submission — Focus Blocker
- Test-Debt Report
- Focus Blocker — Privacy Policy
- src/pages/Blocklists.tsx
- package.js
- ipc-response.test.mjs
- app-blocking-limitations.md
- src-tauri/src/lib.rs

## God Nodes (most connected - your core abstractions)
1. `FocusStore` - 40 edges
2. `StoreError` - 38 edges
3. `Freedom.to` - 25 edges
4. `Chrome Extensions Skill (Manifest V3)` - 23 edges
5. `applyBlockingState()` - 20 edges
6. `AppEnforcer` - 19 edges
7. `compilerOptions` - 18 edges
8. `Session` - 16 edges
9. `SessionManager` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `L8. Extension history grows unbounded toward chrome.storage 10 MB cap` --references--> `pushHistory()`  [INFERRED]
  docs/audit-report.md → apps/extension/background/service-worker.ts
- `New: `apps/extension/popup/lib/__tests__/schedule-crud.test.ts` (13 assertions-groups)` --references--> `validateSchedule()`  [INFERRED]
  docs/test-debt-report.md → apps/extension/popup/lib/ipc.ts
- `Verified-clean areas` --references--> `withLock()`  [INFERRED]
  docs/audit-report.md → apps/extension/background/service-worker.ts
- `4. Still uncovered, ranked by blast radius` --references--> `handleBackgroundMessage()`  [INFERRED]
  docs/test-debt-report.md → apps/extension/background/service-worker.ts
- `L2. No server-side duration validation in `session:start`` --references--> `startSessionLocked()`  [INFERRED]
  docs/audit-report.md → apps/extension/background/service-worker.ts

## Import Cycles
- 1-file cycle: `service/focus-service/src/app_enforcement.rs -> service/focus-service/src/app_enforcement.rs`

## Hyperedges (group relationships)
- **Execute-Inspect-Act browser automation loop (take_snapshot -> UIDs -> click/fill -> screenshot verify)** — agents_skills_chrome_devtools_cli_skill_take_snapshot_tool, agents_skills_chrome_devtools_cli_skill_element_uid, agents_skills_chrome_devtools_cli_skill_input_automation_tools, agents_skills_chrome_devtools_cli_skill_screenshot_based_verification [EXTRACTED 1.00]
- **Code Injection Mechanisms: content scripts, user scripts, sandboxed execution** — agents_skills_chrome_extensions_references_extensions_content_scripts, agents_skills_chrome_extensions_references_extensions_user_scripts, agents_skills_chrome_extensions_references_extensions_csp_sandbox [EXTRACTED 1.00]
- **Chrome Web Store Publishing Pipeline: template, privacy policy, checklist, listing copy** — agents_skills_chrome_extensions_references_webstore_chromewebstore_template, agents_skills_chrome_extensions_references_webstore_privacy_policy, agents_skills_chrome_extensions_references_webstore_review_checklist, agents_skills_chrome_extensions_references_webstore_store_listing [EXTRACTED 1.00]
- **MV3 Background Architecture: ephemeral service worker + storage persistence + messaging bridge** — agents_skills_chrome_extensions_references_extensions_service_worker, agents_skills_chrome_extensions_references_extensions_storage, agents_skills_chrome_extensions_references_extensions_message_passing [EXTRACTED 1.00]
- **Reactive cross-context extension state via chrome.storage** — agents_skills_chrome_extension_references_storage_usechromestorage_hook, agents_skills_chrome_extension_references_storage_onchanged, agents_skills_chrome_extension_references_storage_chrome_storage_sync, agents_skills_chrome_extension_references_ui_surfaces_popup, agents_skills_chrome_extension_references_ui_surfaces_options_page [INFERRED 0.95]
- **End-of-Session Friction Mechanisms (deliberate obstacles before quitting a focus session)** — docs_ideas_challanges_end_session_dialog, docs_ideas_challanges_countdown_timer, docs_ideas_challanges_breathing_exercise, docs_ideas_challanges_type_paragraph, docs_ideas_challanges_pattern_memory_puzzle, docs_ideas_challanges_mental_math_challenge, docs_ideas_challanges_reflection_prompt, docs_ideas_features_list_delay_override, docs_ideas_features_list_locked_mode [INFERRED]
- **MV3 cross-context messaging backbone** — chrome_extension_execution_contexts_md_chrome_runtime_send_message, chrome_extension_execution_contexts_md_chrome_tabs_send_message, chrome_extension_execution_contexts_md_window_post_message, chrome_extension_execution_contexts_md_storage_on_changed_broadcast, chrome_extension_execution_contexts_md_three_layer_bridge, agents_skills_chrome_extension_skill_md_service_worker [INFERRED]
- **Fetch relay through service worker (CSP bypass pipeline)** — agents_skills_chrome_extension_references_messaging_rpc_rpc_layer, agents_skills_chrome_extension_references_network_csp_relay_pattern, agents_skills_chrome_extension_references_messaging_rpc_send_message, agents_skills_chrome_extension_references_network_csp_host_permissions_cors [INFERRED]
- **Failure modes of current DNS+WFP blocking architecture** — docs_appblockingtechinalhandoff_doh_bypass_flaw, docs_appblockingtechinalhandoff_cdn_rotating_ip_flaw, docs_appblockingtechinalhandoff_brittle_os_state_flaw [INFERRED]
- **Network-Level Blocking Pipeline** — readme_md_smart_blocking, apps_extension_build_md_dnr_blocking, apps_extension_build_md_data_flow, apps_extension_blocked_index_blocked_site_blocked_page [INFERRED]
- **v1 hybrid blocking engine (DNS proxy primary + WFP IP filters + service loop + kill-switch allowlist)** — docs_firstchat_focus_dns, docs_firstchat_focus_wfp, docs_firstchat_focus_service, docs_firstchat_kill_switch_allowlist [INFERRED]
- **WisprFlow-Derived Design Language** — agents_md_wisprflow_ui_directive, design_md_color_tokens, design_md_typography_figtree, apps_extension_blocked_index_blocked_site_blocked_page, apps_extension_popup_index_popup_entry_html [INFERRED]

## Communities (106 total, 38 thin omitted)

### Community 0 - "FocusStore"
Cohesion: 0.08
Nodes (37): AppBlockEntry, AsRef, Connection, Error, String, StoreError, SCHEMA, SEED_PRESETS (+29 more)

### Community 1 - "src/lib/ipc.ts"
Cohesion: 0.13
Nodes (15): ActiveSessionView, AppBlockTargetList, BridgeEnvelope, BridgeFailure, BridgeFailureKind, errorMessage(), handleMockRequest(), Preset (+7 more)

### Community 2 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, framer-motion, @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss, @tailwindcss/vite (+3 more)

### Community 3 - "FocusBlock Application"
Cohesion: 0.05
Nodes (39): Chrome Extension Skills Directive, Extension Rebuild Rule, Freedom.to Functional Reference, Two User-Facing Parts (Desktop + Extension), Desktop App Entry HTML, Tauri + React + TypeScript Template Note, Site Blocked Interstitial Page, Extension Build & Testing Guide (+31 more)

### Community 4 - "extension/package.json"
Cohesion: 0.04
Nodes (44): allowScripts, canvas@3.2.3, dependencies, @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss (+36 more)

### Community 5 - "Chrome Extensions Skill (Manifest V3)"
Cohesion: 0.07
Nodes (36): Calling External APIs from Extensions Reference, Authentication with chrome.identity Reference, OAuth client_id Bound to Extension ID (dev vs store), Content Scripts & DOM Manipulation Reference, Context Menus Reference, CSP & Sandboxed Code Execution Reference, Extension CSP Blocks eval; Sandbox/Blob/srcdoc Alternatives, Declarative Net Request Reference (+28 more)

### Community 6 - "protocol.rs"
Cohesion: 0.06
Nodes (50): ActiveSessionView, AppBlockTargetList, AppSettings, crate, AppBlockEntry, AppBlockTarget, AppBlockTargetList, AppSettings (+42 more)

### Community 7 - "Freedom.to"
Cohesion: 0.07
Nodes (32): Feature Gap: Accountability Partnerships (buddy system), Opportunity: Adaptive AI Coach (predictive blocking), Block The Internet (full kill switch), Cold Turkey, Opportunity: Cross-Device Auto-Sync with Easy Setup (#1 ranked), Cross-Device Sync (one session everywhere), Pain Point: Ease of Bypass (#1 user gripe), Focus-Block Product (research subject) (+24 more)

### Community 8 - "service-worker.ts"
Cohesion: 0.13
Nodes (24): ActiveChallenge, addDomainRules(), ArchivedOutcome, BackgroundResponse, buildLockdownRules(), buildRules(), clearAllRules(), escapeRegex() (+16 more)

### Community 9 - "manifest.json"
Cohesion: 0.07
Nodes (26): action, default_icon, default_popup, default_title, author, background, service_worker, type (+18 more)

### Community 10 - "Content Scripts Reference"
Cohesion: 0.09
Nodes (25): CSP Bypass Relay (content script -> SW -> API), Chrome Extension Development (Manifest V3) Skill, chrome.scripting API (executeScript/insertCSS/registerContentScripts), Content Scripts Reference, Isolated World (content script default JS environment), Main World Injection (page JS context), Content Script Orphaning on Extension Update, Injection Timing (run_at: document_start/end/idle) (+17 more)

### Community 11 - "Seven-crate Cargo workspace architecture"
Cohesion: 0.10
Nodes (25): Architecture Handoff & Redesign Proposal (FocusBlock network blocking), Flaw 3: Brittle OS state ('No Internet' bug when service dies), Flaw 2: CDN rotating IP problem defeats static firewall rules, DNS sinkhole response (0.0.0.0 for blocked domains), Flaw 1: DNS-over-HTTPS (DoH) bypass of local DNS proxy, Mechanism A: Local DNS Proxy on 127.0.0.1:53, Redesign proposal for true distraction blocking on Windows, Set-DnsClientServerAddress PowerShell command (force Wi-Fi DNS to 127.0.0.1) (+17 more)

### Community 12 - "ref_vitest"
Cohesion: 0.06
Nodes (30): everyCommand, invokeMock, IpcModule, IpcModule, invokeMock, MemoryStorage, appRoot, ActiveSessionRecord (+22 more)

### Community 13 - "Schedule.tsx"
Cohesion: 0.11
Nodes (23): SessionMode, ALL_DAYS, DAY_OPTIONS, dayButtonStyle, daySummary(), displayTime(), endSummary(), errorStyle (+15 more)

### Community 14 - "applyBlockingState"
Cohesion: 0.41
Nodes (13): activateScheduledSession(), applyBlockingState(), expireSession(), finalizeActiveSession(), getActiveTemporaryAllows(), pushHistory(), scheduledSessionOutcome(), setIfChanged() (+5 more)

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
Nodes (24): ActiveSessionView, double_end_is_impossible(), end_records_timestamp_and_reason(), ended_session_serializes_to_stable_wire_shape(), expired_session_reports_zero_remaining(), fresh_session_has_positive_remaining_within_planned(), future_started_at_clamps_elapsed_to_zero(), Preset (+16 more)

### Community 20 - "One-shot messaging with chrome.runtime.sendMessage"
Cohesion: 0.10
Nodes (21): return true async response rule (async handler trap), Common messaging bugs (Receiving end does not exist, port disconnects, 64MB payload), Cross-extension messaging via externally_connectable, Port-based long-lived connections (chrome.runtime.connect), Full RPC layer simulating HTTP over chrome.runtime messaging, One-shot messaging with chrome.runtime.sendMessage, Three-layer bridge: page <-> content script <-> service worker via window.postMessage, CORS vs CSP in extensions (+13 more)

### Community 21 - "popup/pages/Whitelist.tsx"
Cohesion: 0.32
Nodes (7): DomainEntry, TemporaryAllowEntry, addButtonStyle, inputStyle(), remainingTime(), removeButtonStyle, Whitelist()

### Community 22 - "chrome-devtools-cli SKILL.md (.agents copy)"
Cohesion: 0.14
Nodes (17): chrome-devtools-cli installation.md (.agents copy), npm global install of chrome-devtools-mcp (npm i chrome-devtools-mcp@latest -g), Accessibility Verification with DevTools, chrome-devtools-mcp CLI (chrome-devtools command), Clean Console Standard (zero errors/warnings), DevTools Debugging Workflow (UI/Network/Performance), chrome-devtools-cli SKILL.md (.agents copy), Element UID (+9 more)

### Community 23 - "HIGH"
Cohesion: 0.18
Nodes (10): Focus-Block Audit Report, H1. Punctuation-only blocklist entries (`*.`, `.`) become catch-all web blockers, H2. Named-pipe IPC accepts any local caller; unprivileged process can kill active blocking, H3. Unbounded frame allocation from untrusted length prefix (DoS on service), H4. Service crash-loops at boot when BFE isn't up (recent change), H5. No single source of truth for blocklists between extension and desktop/service, H6. Domain normalization implemented 3x, already drifted, HIGH (+2 more)

### Community 24 - "Session Error Log - September 18, 2026"
Cohesion: 0.18
Nodes (10): Correct Cleanup Actions, Critical Errors Made During Cleanup, Error 1: Incorrect Git Restore, Error 2: Not Checking Session Context, Files That Should Have Been Left Alone, Intentional Changes Made, Lessons for Future Agents, Session Error Log - September 18, 2026 (+2 more)

### Community 25 - "SessionManager"
Cohesion: 0.09
Nodes (31): chrono, clientoptions, IpcResponse, DEFAULT_TIMEOUT, IpcClient, Duration, Error, Instant (+23 more)

### Community 26 - "End Session Dialog"
Cohesion: 0.14
Nodes (14): Add-on: Guided Breathing Exercise (Inhale 4s / Hold 2s / Exhale 6s), Challenge 1: Countdown Timer Before Ending Session, End Session Dialog, Challenge 4: Mental Challenge (Math / Logic Sequence, All-Must-Pass), Challenge 3: Pattern Memory Puzzle (Grid Replication), Challenge 5: Reflection Prompt (Why End Session?, 80-150 Chars Required), Saved Reflection Prompts In Extension (User-Deletable), Challenge 2: Type Emotional Paragraph Character-Perfect (No Paste) (+6 more)

### Community 27 - "popup/pages/Home.tsx"
Cohesion: 0.17
Nodes (8): ChallengeGate(), Props, AppSettings, ServiceStatus, formatTime(), Home(), HomePhase, warningBannerStyle

### Community 28 - "chrome.storage areas comparison (local/sync/session)"
Cohesion: 0.18
Nodes (11): chrome.storage.local, chrome.storage.session, chrome.storage.sync, chrome.storage.onChanged reactive listener, chrome.storage areas comparison (local/sync/session), useChromeStorage framework hook (React/Vue), Shared code between extension contexts (src/shared), Commands (keyboard shortcuts) (+3 more)

### Community 29 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 30 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 31 - "ref_react"
Cohesion: 0.25
Nodes (4): ErrorBoundary, App(), ref_react, ref_react_dom

### Community 32 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, jsdom, @tauri-apps/cli, @testing-library/dom, @testing-library/react, @types/chrome, @types/react, @types/react-dom (+4 more)

### Community 34 - "popup/pages/History.tsx"
Cohesion: 0.43
Nodes (5): Session, formatDuration(), History(), statusBg(), statusColor()

### Community 35 - "MEDIUM"
Cohesion: 0.29
Nodes (7): M10. `list_store_apps` PowerShell JSON breaks with 0 or 1 Start-menu apps (recent), M4. Full system process enumeration 4x/sec even with zero app targets, M5. Blocked-folder recursive rescan + canonicalize of every EXE every 2 s, M6. Blocking OS/WFP/SQLite work inline on tokio runtime under one global mutex, M7. Extension rule-churn guard is memory-only; every SW cold start rewrites all DNR rules, M9. Presets feature exists end-to-end but does nothing, MEDIUM

### Community 36 - "startSessionLocked"
Cohesion: 0.40
Nodes (6): handleBackgroundMessage(), requestReconcile(), startSessionLocked(), withLock(), L2. No server-side duration validation in `session:start`, M2. Popup list mutations bypass background mutation lock; `Date.now()` IDs collide

### Community 37 - "1. What was added (implemented)"
Cohesion: 0.50
Nodes (4): 1. What was added (implemented), Fixed broken pre-existing tests (test-only edits, no production code), New: `apps/extension/background/__tests__/scheduled-stop-suppression.test.ts` (8 assertions-groups), New: `apps/extension/popup/lib/__tests__/schedule-crud.test.ts` (13 assertions-groups)

### Community 40 - "FocusBlock Design System"
Cohesion: 0.40
Nodes (5): design-extract-output Reference Directory, WisprFlow UI/UX Directive, FocusBlock Design System, theme.css (Tailwind v4 @theme), variables.css (CSS Custom Properties)

### Community 41 - "Service Worker (ephemeral background context)"
Cohesion: 0.40
Nodes (5): asyncHandler Pattern (return true from async listeners), Service Worker (ephemeral background context), Top 10 MV3 Mistakes, chrome.storage.onChanged broadcast sync, Service Worker Lifetime Limits (30s idle / 5min hard cap)

### Community 44 - "FocusBlock: Freedom.to-like Windows desktop app"
Cohesion: 0.40
Nodes (5): Core requirement: focus sessions (start/stop/duration/presets/history), FocusBlock: Freedom.to-like Windows desktop app, Core requirement: internet blocking with whitelist/localhost/OS-service exceptions, System-level network filtering (intercept requests before browser), Core requirement: domain-based website blocking

### Community 45 - "focus-core"
Cohesion: 0.70
Nodes (5): desktop, focus-core, focus-ipc, focus-service, focus-store

### Community 46 - "Service worker lifecycle and termination rules (30s idle, 5min hard cap)"
Cohesion: 0.50
Nodes (4): Extension update process (version bump, onInstalled migration, staged rollout), chrome.alarms replacing setTimeout/setInterval, Service worker lifecycle and termination rules (30s idle, 5min hard cap), State management with chrome.storage.session/local

### Community 47 - "Vite Logo SVG (favicon)"
Cohesion: 0.67
Nodes (4): Vite Logo SVG (favicon), Desktop App Favicon/Branding, Iconify Logos Icon Set, Vite Build Tool

### Community 50 - "web_accessible_resources manifest declaration (MV3 scoped)"
Cohesion: 0.67
Nodes (3): web_accessible_resources manifest declaration (MV3 scoped), Extension fingerprinting risk mitigation (use_dynamic_url), chrome.runtime.getURL resource access

### Community 51 - "Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background"
Cohesion: 0.67
Nodes (3): Interlocking dual-ring visual motif suggesting focus, blocking, and connection between distraction and concentration, Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background, Tauri-based focus-block desktop application that uses this icon as its 128px application icon

### Community 52 - "Focus Block app branding (interlocking orange and cyan circular mark on black)"
Cohesion: 0.67
Nodes (3): Focus Block app branding (interlocking orange and cyan circular mark on black), Square71x71Logo.png - Windows Store square logo asset, Windows Store / MSIX small tile icon asset (71x71 px)

### Community 98 - "extension/vite.config.ts"
Cohesion: 0.32
Nodes (3): ref_tailwindcss_vite, ref_vite, ref_vitejs_plugin_react

### Community 106 - "storage.ts"
Cohesion: 0.13
Nodes (17): ActiveSessionRecord, ALL_DAYS, ArchivedOutcome, ArchivedSessionRecord, ChallengeRecord, DEFAULTS, DomainListEntry, normalizeSchedule() (+9 more)

### Community 107 - "focus-store/src/codec.rs"
Cohesion: 0.08
Nodes (18): domain_matches(), normalize_domain(), Option, String, encode_domain_list(), encode_mode(), encode_status(), parse_domain_list() (+10 more)

### Community 108 - "Home.test.tsx"
Cohesion: 0.15
Nodes (12): ServiceStatus, formatTime(), Home(), HomePhase, buildStatus(), Deferred, Envelope, getStatusSafe (+4 more)

### Community 110 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 111 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 112 - "DesktopFlow.e2e.test.tsx"
Cohesion: 0.20
Nodes (9): addAppBlockTarget, getStatusSafe, listAppBlockTargets, listBlocklist, listHistory, listInstalledApps, listWhitelist, startSession (+1 more)

### Community 113 - "src/pages/History.tsx"
Cohesion: 0.43
Nodes (5): Session, formatDuration(), History(), statusBg(), statusColor()

### Community 114 - "app_enforcement.rs"
Cohesion: 0.07
Nodes (63): BTreeSet, collections, Default, deriveappcontainersidfromappcontainername, Drop, ffi, foundation, fs (+55 more)

### Community 115 - "LOW"
Cohesion: 0.17
Nodes (12): L10. Desktop↔extension copy-forked UI/logic drifts unmanaged, L11. Desktop Home polls at 1 Hz forever, re-renders every second even idle, L12. Security nits, L1. Stray migration silently discards `"cancelled"` records, L3. Scheduled-session popup countdown uses frozen `planned_duration_sec`, L4. Back-to-back scheduled windows label finished window `"stopped"` instead of `"completed"`, L5. Native-host origin check fails open; env var never set anywhere, L6. Tauri CSP disabled (+4 more)

### Community 117 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, tauri, test

### Community 119 - "desktop/package.json"
Cohesion: 0.09
Nodes (21): @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss, @tailwindcss/vite, @types/chrome, @types/react (+13 more)

### Community 120 - "src/App.tsx"
Cohesion: 0.15
Nodes (10): App(), navItems, DomainListKind, DomainListPage(), LIST_COPY, AppSettings, DomainEntry, ipc (+2 more)

### Community 122 - "Chrome Web Store Listing — Focus Blocker"
Cohesion: 0.13
Nodes (14): Chrome Web Store Listing — Focus Blocker, Data Collection, Data Use Certification, Developer Info, Distribution, Graphics & Assets, Known Issues / Limitations, Permissions Justification (+6 more)

### Community 123 - "popup/App.tsx"
Cohesion: 0.17
Nodes (11): navItems, ipc, Blocklists(), bodyStyle, headingStyle, listItemStyle, Privacy(), sectionStyle (+3 more)

### Community 128 - "Chrome Web Store Submission — Focus Blocker"
Cohesion: 0.08
Nodes (23): 0. First-time setup (one time only), 1. Package the upload, 2. Store listing, 3. Single purpose, 4. Permission justifications, 5. Privacy tab (dashboard), 6. Version history entry (0.2.0), 7. Distribution (+15 more)

### Community 129 - "Test-Debt Report"
Cohesion: 0.25
Nodes (7): computeScheduleSuppression(), 2. Flaky-test hunt, 3. Ready-to-drop tests for known bugs (add AFTER fixing, else suite goes red), 5. Duplicate / mergeable tests (prompt 4 answer), 6. Final suite state, Rust suite blocked by environment, not repo, Test-Debt Report

### Community 130 - "Focus Blocker — Privacy Policy"
Cohesion: 0.18
Nodes (10): Changes, Contact, Deletion, Focus Blocker — Privacy Policy, How the permissions are used, Retention, Sharing, Summary (+2 more)

### Community 131 - "src/pages/Blocklists.tsx"
Cohesion: 0.17
Nodes (19): AppPickerModal(), DiscoveredApp, Props, DiscoveredApp, getAppIcon(), listInstalledApps(), listStoreApps(), pickExecutable() (+11 more)

### Community 132 - "package.js"
Cohesion: 0.09
Nodes (22): copyDir(), __dirname, dist, root, children, shutdown(), start(), __dirname (+14 more)

### Community 138 - "ipc-response.test.mjs"
Cohesion: 0.33
Nodes (5): standaloneSource, ref_node_assert, ref_node_fs, ref_node_test, ref_typescript

### Community 142 - "src-tauri/src/lib.rs"
Cohesion: 0.05
Nodes (57): extract_app_icon_native(), get_app_icon(), get_cached_icon(), icon_cache_dir(), ipc_request(), list_installed_apps(), list_store_apps(), AppBlockTarget (+49 more)

## Ambiguous Edges - Review These
- `Vite Logo SVG (favicon)` → `Vite Build Tool`  [AMBIGUOUS]
  apps/desktop/public/vite.svg · relation: rationale_for

## Knowledge Gaps
- **512 isolated node(s):** `getStatusSafe`, `listAppBlockTargets`, `addAppBlockTarget`, `startSession`, `stopSession` (+507 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 697 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Vite Logo SVG (favicon)` and `Vite Build Tool`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `AppEnforcer` connect `app_enforcement.rs` to `SessionManager`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `start()` connect `package.js` to `ref_vitest`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `FocusStore` connect `FocusStore` to `SessionManager`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `getStatusSafe`, `listAppBlockTargets`, `addAppBlockTarget` to the rest of the system?**
  _512 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FocusStore` be split into smaller, more focused modules?**
  _Cohesion score 0.07663828211773417 - nodes in this community are weakly interconnected._
- **Should `src/lib/ipc.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._