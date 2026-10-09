# Graph Report - focus-block  (2026-10-09)

## Corpus Check
- 105 files · ~60,312 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 5, .css 3, .bat 3)

## Summary
- 1160 nodes · 1898 edges · 85 communities (50 shown, 35 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `35a80489`
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
- ipc.parity.test.ts
- manifest.json
- DomainListPage.tsx
- Runbook: how to run FocusBlock (service + desktop)
- service-worker.ts
- Schedule.tsx
- warn
- tauri.conf.json
- compilerOptions
- popup/lib/ipc.ts
- compilerOptions
- session.rs
- SessionManager
- End Session Dialog
- popup/pages/Home.tsx
- default.json
- compilerOptions
- ErrorBoundary
- devDependencies
- popup/pages/History.tsx
- FocusBlock Design System
- focus-core
- Vite Logo SVG (favicon)
- Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background
- Focus Block app branding (interlocking orange and cyan circular mark on black)
- blocked.js
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
- app_enforcement.rs
- scripts
- desktop/package.json
- src/App.tsx
- Chrome Web Store Listing — Focus Blocker
- popup/App.tsx
- Chrome Web Store Submission — Focus Blocker
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
4. `applyBlockingState()` - 20 edges
5. `AppEnforcer` - 19 edges
6. `compilerOptions` - 18 edges
7. `compilerOptions` - 16 edges
8. `Session` - 16 edges
9. `SessionManager` - 16 edges
10. `IpcRequest` - 15 edges

## Surprising Connections (you probably didn't know these)
- `0. First-time setup (one time only)` --references--> `main()`  [INFERRED]
  CHROMEWEBSTORE.md → scripts/test_desktop_flow.py
- `Brand Personality: Firm, Focused, De-stressing` --semantically_similar_to--> `Firm, Calm UX Principle`  [INFERRED] [semantically similar]
  PRODUCT.md → README.md
- `Desktop App Entry HTML` --references--> `FocusBlock Application`  [INFERRED]
  apps/desktop/index.html → README.md
- `Freedom.to Functional Reference` --conceptually_related_to--> `FocusBlock Application`  [INFERRED]
  AGENTS.md → README.md
- `Product Purpose: Distraction-Free Focus Sessions` --conceptually_related_to--> `FocusBlock Application`  [INFERRED]
  PRODUCT.md → README.md

## Import Cycles
- 1-file cycle: `service/focus-service/src/app_enforcement.rs -> service/focus-service/src/app_enforcement.rs`

## Hyperedges (group relationships)
- **End-of-Session Friction Mechanisms (deliberate obstacles before quitting a focus session)** — docs_ideas_challanges_end_session_dialog, docs_ideas_challanges_countdown_timer, docs_ideas_challanges_breathing_exercise, docs_ideas_challanges_type_paragraph, docs_ideas_challanges_pattern_memory_puzzle, docs_ideas_challanges_mental_math_challenge, docs_ideas_challanges_reflection_prompt, docs_ideas_features_list_delay_override, docs_ideas_features_list_locked_mode [INFERRED]
- **Network-Level Blocking Pipeline** — readme_md_smart_blocking, apps_extension_build_md_dnr_blocking, apps_extension_build_md_data_flow, apps_extension_blocked_index_blocked_site_blocked_page [INFERRED]
- **WisprFlow-Derived Design Language** — agents_md_wisprflow_ui_directive, design_md_color_tokens, design_md_typography_figtree, apps_extension_blocked_index_blocked_site_blocked_page, apps_extension_popup_index_popup_entry_html [INFERRED]

## Communities (85 total, 35 thin omitted)

### Community 0 - "FocusStore"
Cohesion: 0.08
Nodes (35): AppBlockEntry, AsRef, Connection, String, StoreError, SCHEMA, SEED_PRESETS, corrupt_history_row_is_skipped_others_still_load() (+27 more)

### Community 1 - "src/lib/ipc.ts"
Cohesion: 0.10
Nodes (19): ActiveSessionView, AppBlockTargetList, everyCommand, invokeMock, IpcModule, BridgeEnvelope, BridgeFailure, BridgeFailureKind (+11 more)

### Community 2 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, framer-motion, @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss, @tailwindcss/vite (+3 more)

### Community 3 - "FocusBlock Application"
Cohesion: 0.05
Nodes (39): Chrome Extension Skills Directive, Extension Rebuild Rule, Freedom.to Functional Reference, Two User-Facing Parts (Desktop + Extension), Desktop App Entry HTML, Tauri + React + TypeScript Template Note, Site Blocked Interstitial Page, Extension Build & Testing Guide (+31 more)

### Community 4 - "extension/package.json"
Cohesion: 0.04
Nodes (44): allowScripts, canvas@3.2.3, dependencies, @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss (+36 more)

### Community 5 - "service.rs"
Cohesion: 0.14
Nodes (19): arc, focus_ipc, Receiver, configure_service_recovery(), Box, Duration, Error, Option (+11 more)

### Community 6 - "protocol.rs"
Cohesion: 0.06
Nodes (50): ActiveSessionView, AppBlockTargetList, AppSettings, crate, AppBlockEntry, AppBlockTarget, AppBlockTargetList, AppSettings (+42 more)

### Community 7 - "Freedom.to"
Cohesion: 0.07
Nodes (32): Feature Gap: Accountability Partnerships (buddy system), Opportunity: Adaptive AI Coach (predictive blocking), Block The Internet (full kill switch), Cold Turkey, Opportunity: Cross-Device Auto-Sync with Easy Setup (#1 ranked), Cross-Device Sync (one session everywhere), Pain Point: Ease of Bypass (#1 user gripe), Focus-Block Product (research subject) (+24 more)

### Community 8 - "ipc.parity.test.ts"
Cohesion: 0.28
Nodes (3): IpcModule, invokeMock, MemoryStorage

### Community 9 - "manifest.json"
Cohesion: 0.07
Nodes (26): action, default_icon, default_popup, default_title, author, background, service_worker, type (+18 more)

### Community 10 - "DomainListPage.tsx"
Cohesion: 0.29
Nodes (6): DomainListKind, DomainListPage(), LIST_COPY, DomainEntry, ipc, Whitelist()

### Community 11 - "Runbook: how to run FocusBlock (service + desktop)"
Cohesion: 0.50
Nodes (4): Run focus-service as Administrator (cargo run --bin focus-service -- --console), Runbook: how to run FocusBlock (service + desktop), Run Tauri desktop app in dev mode (cd apps/desktop; npm run tauri dev), WiX installer fragment to register focus-service as Windows Service (v1: manual launch)

### Community 12 - "service-worker.ts"
Cohesion: 0.06
Nodes (63): appRoot, activateScheduledSession(), ActiveChallenge, ActiveSessionRecord, addDomainRules(), applyBlockingState(), ArchivedOutcome, ArchivedSessionRecord (+55 more)

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
Nodes (24): ActiveSessionView, double_end_is_impossible(), end_records_timestamp_and_reason(), ended_session_serializes_to_stable_wire_shape(), expired_session_reports_zero_remaining(), fresh_session_has_positive_remaining_within_planned(), future_started_at_clamps_elapsed_to_zero(), Preset (+16 more)

### Community 25 - "SessionManager"
Cohesion: 0.13
Nodes (21): chrono, IpcResponse, pathbuf, Box, DateTime, Error, Option, Result (+13 more)

### Community 26 - "End Session Dialog"
Cohesion: 0.14
Nodes (14): Add-on: Guided Breathing Exercise (Inhale 4s / Hold 2s / Exhale 6s), Challenge 1: Countdown Timer Before Ending Session, End Session Dialog, Challenge 4: Mental Challenge (Math / Logic Sequence, All-Must-Pass), Challenge 3: Pattern Memory Puzzle (Grid Replication), Challenge 5: Reflection Prompt (Why End Session?, 80-150 Chars Required), Saved Reflection Prompts In Extension (User-Deletable), Challenge 2: Type Emotional Paragraph Character-Perfect (No Paste) (+6 more)

### Community 27 - "popup/pages/Home.tsx"
Cohesion: 0.17
Nodes (8): ChallengeGate(), Props, AppSettings, ServiceStatus, formatTime(), Home(), HomePhase, warningBannerStyle

### Community 29 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 30 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 32 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, jsdom, @tauri-apps/cli, @testing-library/dom, @testing-library/react, @types/chrome, @types/react, @types/react-dom (+4 more)

### Community 34 - "popup/pages/History.tsx"
Cohesion: 0.43
Nodes (5): Session, formatDuration(), History(), statusBg(), statusColor()

### Community 40 - "FocusBlock Design System"
Cohesion: 0.40
Nodes (5): design-extract-output Reference Directory, WisprFlow UI/UX Directive, FocusBlock Design System, theme.css (Tailwind v4 @theme), variables.css (CSS Custom Properties)

### Community 45 - "focus-core"
Cohesion: 0.70
Nodes (5): desktop, focus-core, focus-ipc, focus-service, focus-store

### Community 47 - "Vite Logo SVG (favicon)"
Cohesion: 0.67
Nodes (4): Vite Logo SVG (favicon), Desktop App Favicon/Branding, Iconify Logos Icon Set, Vite Build Tool

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

### Community 114 - "app_enforcement.rs"
Cohesion: 0.07
Nodes (65): BTreeSet, collections, Default, deriveappcontainersidfromappcontainername, Drop, ffi, foundation, fs (+57 more)

### Community 117 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, tauri, test

### Community 119 - "desktop/package.json"
Cohesion: 0.09
Nodes (22): @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss, @tailwindcss/vite, @types/chrome, @types/react (+14 more)

### Community 120 - "src/App.tsx"
Cohesion: 0.14
Nodes (12): App(), navItems, AppSettings, Session, formatDuration(), History(), statusBg(), statusColor() (+4 more)

### Community 122 - "Chrome Web Store Listing — Focus Blocker"
Cohesion: 0.13
Nodes (14): Chrome Web Store Listing — Focus Blocker, Data Collection, Data Use Certification, Developer Info, Distribution, Graphics & Assets, Known Issues / Limitations, Permissions Justification (+6 more)

### Community 123 - "popup/App.tsx"
Cohesion: 0.12
Nodes (18): navItems, DomainEntry, ipc, TemporaryAllowEntry, Blocklists(), bodyStyle, headingStyle, listItemStyle (+10 more)

### Community 128 - "Chrome Web Store Submission — Focus Blocker"
Cohesion: 0.11
Nodes (18): 0. First-time setup (one time only), 1. Package the upload, 2. Store listing, 3. Single purpose, 4. Permission justifications, 5. Privacy tab (dashboard), 6. Version history entry (0.2.0), 7. Distribution (+10 more)

### Community 130 - "Focus Blocker — Privacy Policy"
Cohesion: 0.18
Nodes (10): Changes, Contact, Deletion, Focus Blocker — Privacy Policy, How the permissions are used, Retention, Sharing, Summary (+2 more)

### Community 131 - "src/pages/Blocklists.tsx"
Cohesion: 0.20
Nodes (17): AppPickerModal(), apps_desktop_src_components_apppickermodal_discoveredapp, Props, DiscoveredApp, getAppIcon(), listInstalledApps(), listStoreApps(), pickExecutable() (+9 more)

### Community 132 - "package.js"
Cohesion: 0.09
Nodes (20): copyDir(), __dirname, dist, root, children, start(), __dirname, iconsDir (+12 more)

### Community 138 - "ipc-response.test.mjs"
Cohesion: 0.33
Nodes (5): standaloneSource, ref_node_assert, ref_node_fs, ref_node_test, ref_typescript

### Community 142 - "src-tauri/src/lib.rs"
Cohesion: 0.06
Nodes (50): extract_app_icon_native(), get_app_icon(), get_cached_icon(), icon_cache_dir(), ipc_request(), list_installed_apps(), list_store_apps(), AppBlockTarget (+42 more)

## Ambiguous Edges - Review These
- `Vite Logo SVG (favicon)` → `Vite Build Tool`  [AMBIGUOUS]
  apps/desktop/public/vite.svg · relation: rationale_for

## Knowledge Gaps
- **422 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+417 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 588 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Vite Logo SVG (favicon)` and `Vite Build Tool`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `start()` connect `package.js` to `service-worker.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `FocusStore` connect `FocusStore` to `SessionManager`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `canvas` connect `package.js` to `extension/package.json`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _422 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FocusStore` be split into smaller, more focused modules?**
  _Cohesion score 0.08169014084507042 - nodes in this community are weakly interconnected._
- **Should `src/lib/ipc.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09782608695652174 - nodes in this community are weakly interconnected._