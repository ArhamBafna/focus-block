# Graph Report - focus-block  (2026-08-27)

## Corpus Check
- 183 files · ~314,087 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1486 nodes · 2169 edges · 142 communities (94 shown, 48 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7ff71cb3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FocusStore
- src/lib/ipc.ts
- dependencies
- FocusBlock Application
- devDependencies
- Chrome Extensions Skill (Manifest V3)
- protocol.rs
- Freedom.to
- Wisprflow Color Palette (DESIGN.md)
- manifest.json
- Content Scripts Reference
- Seven-crate Cargo workspace architecture
- service-worker.ts
- Schedule.tsx
- settings
- tauri.conf.json
- compilerOptions
- popup/lib/ipc.ts
- compilerOptions
- session.rs
- One-shot messaging with chrome.runtime.sendMessage
- popup/pages/Whitelist.tsx
- chrome-devtools-cli SKILL.md (.agents copy)
- handle_connection
- wisprflow-com-tokens.d.ts
- SessionManager
- End Session Dialog
- popup/pages/Home.tsx
- chrome.storage areas comparison (local/sync/session)
- default.json
- compilerOptions
- wisprflow-com-motion.one.js
- devDependencies
- wisprflow-com-motion.waapi.js
- popup/pages/History.tsx
- wisprflow-com-anatomy.tsx
- wisprflow-com-motion.framer.js
- Section order: hero, app-integration demo, social proof logos, 4x faster claim, Made for the way you work, AI Auto Edits, Personal Dictionary/Snippets, 100+ languages, Flow everywhere, testimonials ('Love letters to Flow'), stats, Start flowing CTA, FAQ teaser, footer
- wisprflow-com-gradients.json
- wisprflow-com-motion.gsap.js
- FocusBlock Design System
- Service Worker (ephemeral background context)
- assemble.js
- CTA: lavender 'Download for Windows' pill button with dark border (nav + hero), platform availability note 'Available on Mac, Windows, iPhone, and Android'
- FocusBlock: Freedom.to-like Windows desktop app
- focus-core
- Service worker lifecycle and termination rules (30s idle, 5min hard cap)
- Vite Logo SVG (favicon)
- generate-icons.js
- Secondary button state variant: cream fill, dark rounded outline, mic icon + 'Try Flow' label
- web_accessible_resources manifest declaration (MV3 scoped)
- Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background
- Focus Block app branding (interlocking orange and cyan circular mark on black)
- blocked.js
- Wisprflow primary button (default state): 'Download for Windows' pill button with lavender fill (#E9D4FF approx), 2px dark border, fully-rounded radius (~999px), generous horizontal padding, bold near-black label, leading Windows OS icon
- Primary CTA Button (Download for Windows)
- WisprFlow Card Component (default state): near-black surface, ~40px radius, generous padding
- Vertical list of snippet pill buttons with cream/ivory borders on dark background: Calendar, Hours, Support intro, FAQ, Careers link, Elevator pitch, Address
- Circular add button implying append-new-entry interaction for the dictionary card
- Wisprflow.com top navigation bar with links: Product (dropdown), Individuals (dropdown), Business, Resources (dropdown), Company (dropdown)
- wisprflow-com-theme.js
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
- Primary button (Download for Windows) - light lavender fill, black border, rounded pill, Windows logo icon
- WisprFlow secondary button component (cream/ivory pill, dark text)
- Secondary Button Variant 2 (cream background, dark border, mic icon + 'Try Flow' label)
- Circular flag icon pattern paired with native-script language labels inside outlined pill chips (cream stroke on near-black background)
- wisprflow-com-motion.tailwind.js
- Motion Rules (motion/react)
- Student Market Segment (budget-sensitive students)
- Core Blocking (Feature Category)
- Focus Streaks (Consecutive Focus Days)
- AGENTS.md Project Instructions
- Context menus UI surface
- DevTools panel UI surface
- Notifications UI surface
- Omnibox keyword integration
- Focus-block app icon 256x256 (@2x retina variant): two interlocking arcs in amber/orange and cyan forming a stylized '8'/link motif on black background, representing focus blocking/connection between desktop app and browser
- Square30x30Logo.png - Windows Store small square logo icon (dark rounded-square background with yellow and teal interlocking circular shapes)
- Spacing Scale
- Accountability Partner (Pair With Another User)
- PRODUCT.md Product Definition
- Target Users (Freelancers, Students, Employees)
- storage.ts
- focus-store/src/codec.rs
- Home.test.tsx
- domain.rs
- Issue tracker: GitHub
- Domain Docs
- DesktopFlow.e2e.test.tsx
- src/pages/History.tsx
- app_enforcement.rs
- LOW
- test_desktop_flow.py
- scripts
- ipc.parity.test.ts
- desktop/package.json
- src/App.tsx
- ipc.bridge.test.ts
- Chrome Web Store Listing — Focus Blocker
- popup/App.tsx
- @types/react-dom
- run_async
- desktop/vitest.config.ts
- Chrome Web Store Submission — Focus Blocker
- Test-Debt Report
- Focus Blocker — Privacy Policy
- app-picker.ts
- package.js
- Stale / Idle Files Report
- dev.js
- @tauri-apps/plugin-dialog
- @tauri-apps/cli
- vite
- ipc-response.test.mjs
- app-blocking-limitations.md
- src-tauri/src/lib.rs

## God Nodes (most connected - your core abstractions)
1. `FocusStore` - 41 edges
2. `StoreError` - 38 edges
3. `Freedom.to` - 25 edges
4. `Chrome Extensions Skill (Manifest V3)` - 23 edges
5. `applyBlockingState()` - 20 edges
6. `AppEnforcer` - 19 edges
7. `compilerOptions` - 18 edges
8. `SessionManager` - 17 edges
9. `compilerOptions` - 16 edges
10. `Session` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Brand Personality: Firm, Focused, De-stressing` --semantically_similar_to--> `Firm, Calm UX Principle`  [INFERRED] [semantically similar]
  PRODUCT.md → README.md
- `Desktop App Entry HTML` --references--> `FocusBlock Application`  [INFERRED]
  apps/desktop/index.html → README.md
- `Freedom.to Functional Reference` --conceptually_related_to--> `FocusBlock Application`  [INFERRED]
  AGENTS.md → README.md
- `Product Purpose: Distraction-Free Focus Sessions` --conceptually_related_to--> `FocusBlock Application`  [INFERRED]
  PRODUCT.md → README.md
- `ipc_request()` --references--> `IpcRequest`  [EXTRACTED]
  apps/desktop/src-tauri/src/lib.rs → crates/focus-core/src/protocol.rs

## Import Cycles
- 1-file cycle: `service/focus-service/src/app_enforcement.rs -> service/focus-service/src/app_enforcement.rs`

## Hyperedges (group relationships)
- **Execute-Inspect-Act browser automation loop (take_snapshot -> UIDs -> click/fill -> screenshot verify)** — agents_skills_chrome_devtools_cli_skill_take_snapshot_tool, agents_skills_chrome_devtools_cli_skill_element_uid, agents_skills_chrome_devtools_cli_skill_input_automation_tools, agents_skills_chrome_devtools_cli_skill_screenshot_based_verification [EXTRACTED 1.00]
- **Code Injection Mechanisms: content scripts, user scripts, sandboxed execution** — agents_skills_chrome_extensions_references_extensions_content_scripts, agents_skills_chrome_extensions_references_extensions_user_scripts, agents_skills_chrome_extensions_references_extensions_csp_sandbox [EXTRACTED 1.00]
- **Component Recipe System (button, card, link)** — design_extract_output_wisprflow_com_prompts_recipe_button, design_extract_output_wisprflow_com_prompts_recipe_card, design_extract_output_wisprflow_com_prompts_recipe_link, design_extract_output_wisprflow_com_design_language_component_anatomy [EXTRACTED 1.00]
- **Chrome Web Store Publishing Pipeline: template, privacy policy, checklist, listing copy** — agents_skills_chrome_extensions_references_webstore_chromewebstore_template, agents_skills_chrome_extensions_references_webstore_privacy_policy, agents_skills_chrome_extensions_references_webstore_review_checklist, agents_skills_chrome_extensions_references_webstore_store_listing [EXTRACTED 1.00]
- **MV3 Background Architecture: ephemeral service worker + storage persistence + messaging bridge** — agents_skills_chrome_extensions_references_extensions_service_worker, agents_skills_chrome_extensions_references_extensions_storage, agents_skills_chrome_extensions_references_extensions_message_passing [EXTRACTED 1.00]
- **Wisprflow Design Documentation Cluster** — design_extract_output_wisprflow_com_design_wisprflow_design_system, design_extract_output_wisprflow_com_design_language_design_language_doc, design_extract_output_wisprflow_com_preview_design_language_preview, design_extract_output_wisprflow_com_brand_brand_guidelines [INFERRED 0.85]
- **AI Framework Prompt Generation from Design Extract** — design_extract_output_wisprflow_com_prompts_claude_artifacts_prompt, design_extract_output_wisprflow_com_prompts_cursor_prompt, design_extract_output_wisprflow_com_prompts_lovable_prompt, design_extract_output_wisprflow_com_prompts_v0_prompt [INFERRED 0.95]
- **Reactive cross-context extension state via chrome.storage** — agents_skills_chrome_extension_references_storage_usechromestorage_hook, agents_skills_chrome_extension_references_storage_onchanged, agents_skills_chrome_extension_references_storage_chrome_storage_sync, agents_skills_chrome_extension_references_ui_surfaces_popup, agents_skills_chrome_extension_references_ui_surfaces_options_page [INFERRED 0.95]
- **End-of-Session Friction Mechanisms (deliberate obstacles before quitting a focus session)** — docs_ideas_challanges_end_session_dialog, docs_ideas_challanges_countdown_timer, docs_ideas_challanges_breathing_exercise, docs_ideas_challanges_type_paragraph, docs_ideas_challanges_pattern_memory_puzzle, docs_ideas_challanges_mental_math_challenge, docs_ideas_challanges_reflection_prompt, docs_ideas_features_list_delay_override, docs_ideas_features_list_locked_mode [INFERRED]
- **MV3 cross-context messaging backbone** — chrome_extension_execution_contexts_md_chrome_runtime_send_message, chrome_extension_execution_contexts_md_chrome_tabs_send_message, chrome_extension_execution_contexts_md_window_post_message, chrome_extension_execution_contexts_md_storage_on_changed_broadcast, chrome_extension_execution_contexts_md_three_layer_bridge, agents_skills_chrome_extension_skill_md_service_worker [INFERRED]
- **Fetch relay through service worker (CSP bypass pipeline)** — agents_skills_chrome_extension_references_messaging_rpc_rpc_layer, agents_skills_chrome_extension_references_network_csp_relay_pattern, agents_skills_chrome_extension_references_messaging_rpc_send_message, agents_skills_chrome_extension_references_network_csp_host_permissions_cors [INFERRED]
- **Failure modes of current DNS+WFP blocking architecture** — docs_appblockingtechinalhandoff_doh_bypass_flaw, docs_appblockingtechinalhandoff_cdn_rotating_ip_flaw, docs_appblockingtechinalhandoff_brittle_os_state_flaw [INFERRED]
- **Network-Level Blocking Pipeline** — readme_md_smart_blocking, apps_extension_build_md_dnr_blocking, apps_extension_build_md_data_flow, apps_extension_blocked_index_blocked_site_blocked_page [INFERRED]
- **v1 hybrid blocking engine (DNS proxy primary + WFP IP filters + service loop + kill-switch allowlist)** — docs_firstchat_focus_dns, docs_firstchat_focus_wfp, docs_firstchat_focus_service, docs_firstchat_kill_switch_allowlist [INFERRED]
- **WisprFlow-Derived Design Language** — agents_md_wisprflow_ui_directive, design_md_color_tokens, design_md_typography_figtree, apps_extension_blocked_index_blocked_site_blocked_page, apps_extension_popup_index_popup_entry_html [INFERRED]

## Communities (142 total, 48 thin omitted)

### Community 0 - "FocusStore"
Cohesion: 0.09
Nodes (31): AppBlockEntry, AsRef, Connection, Error, String, StoreError, corrupt_history_row_is_skipped_others_still_load(), corrupt_preset_row_is_skipped_others_still_load() (+23 more)

### Community 1 - "src/lib/ipc.ts"
Cohesion: 0.13
Nodes (15): ActiveSessionView, AppBlockTargetList, BridgeEnvelope, BridgeFailure, BridgeFailureKind, errorMessage(), handleMockRequest(), Preset (+7 more)

### Community 2 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, framer-motion, @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss, @tailwindcss/vite (+11 more)

### Community 3 - "FocusBlock Application"
Cohesion: 0.05
Nodes (39): Chrome Extension Skills Directive, Extension Rebuild Rule, Freedom.to Functional Reference, Two User-Facing Parts (Desktop + Extension), Desktop App Entry HTML, Tauri + React + TypeScript Template Note, Site Blocked Interstitial Page, Extension Build & Testing Guide (+31 more)

### Community 4 - "devDependencies"
Cohesion: 0.04
Nodes (45): allowScripts, canvas@3.2.3, dependencies, @phosphor-icons/react, react, react-dom, react-router-dom, tailwindcss (+37 more)

### Community 5 - "Chrome Extensions Skill (Manifest V3)"
Cohesion: 0.07
Nodes (36): Calling External APIs from Extensions Reference, Authentication with chrome.identity Reference, OAuth client_id Bound to Extension ID (dev vs store), Content Scripts & DOM Manipulation Reference, Context Menus Reference, CSP & Sandboxed Code Execution Reference, Extension CSP Blocks eval; Sandbox/Blob/srcdoc Alternatives, Declarative Net Request Reference (+28 more)

### Community 6 - "protocol.rs"
Cohesion: 0.05
Nodes (51): ActiveSessionView, AppBlockTargetList, AppSettings, AppBlockEntry, AppBlockTarget, AppBlockTargetList, AppSettings, BlockingPolicySnapshot (+43 more)

### Community 7 - "Freedom.to"
Cohesion: 0.07
Nodes (32): Feature Gap: Accountability Partnerships (buddy system), Opportunity: Adaptive AI Coach (predictive blocking), Block The Internet (full kill switch), Cold Turkey, Opportunity: Cross-Device Auto-Sync with Easy Setup (#1 ranked), Cross-Device Sync (one session everywhere), Pain Point: Ease of Bypass (#1 user gripe), Focus-Block Product (research subject) (+24 more)

### Community 8 - "Wisprflow Color Palette (DESIGN.md)"
Cohesion: 0.10
Nodes (30): Component Anatomy Reference (AGENT.md), Designlang Context Files, Output Expectations for UI Generation, Wisprflow Brand Voice (AGENT.md), Wisprflow Build Rules, Wisprflow Brand Guidelines (HTML Brand Book), Wisprflow Color Palette (DESIGN.md), Flat Material Language (+22 more)

### Community 9 - "manifest.json"
Cohesion: 0.06
Nodes (30): action, default_icon, default_popup, default_title, author, background, service_worker, type (+22 more)

### Community 10 - "Content Scripts Reference"
Cohesion: 0.09
Nodes (25): CSP Bypass Relay (content script -> SW -> API), Chrome Extension Development (Manifest V3) Skill, chrome.scripting API (executeScript/insertCSS/registerContentScripts), Content Scripts Reference, Isolated World (content script default JS environment), Main World Injection (page JS context), Content Script Orphaning on Extension Update, Injection Timing (run_at: document_start/end/idle) (+17 more)

### Community 11 - "Seven-crate Cargo workspace architecture"
Cohesion: 0.10
Nodes (25): Architecture Handoff & Redesign Proposal (FocusBlock network blocking), Flaw 3: Brittle OS state ('No Internet' bug when service dies), Flaw 2: CDN rotating IP problem defeats static firewall rules, DNS sinkhole response (0.0.0.0 for blocked domains), Flaw 1: DNS-over-HTTPS (DoH) bypass of local DNS proxy, Mechanism A: Local DNS Proxy on 127.0.0.1:53, Redesign proposal for true distraction blocking on Windows, Set-DnsClientServerAddress PowerShell command (force Wi-Fi DNS to 127.0.0.1) (+17 more)

### Community 12 - "service-worker.ts"
Cohesion: 0.06
Nodes (59): activateScheduledSession(), ActiveChallenge, ActiveSessionRecord, addDomainRules(), applyBlockingState(), ArchivedOutcome, ArchivedSessionRecord, BackgroundResponse (+51 more)

### Community 13 - "Schedule.tsx"
Cohesion: 0.11
Nodes (23): SessionMode, ALL_DAYS, DAY_OPTIONS, dayButtonStyle, daySummary(), displayTime(), endSummary(), errorStyle (+15 more)

### Community 14 - "settings"
Cohesion: 0.08
Nodes (23): background, gradients, palette, text, contentSize, wideSize, $schema, settings (+15 more)

### Community 15 - "tauri.conf.json"
Cohesion: 0.09
Nodes (22): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+14 more)

### Community 16 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+18 more)

### Community 17 - "popup/lib/ipc.ts"
Cohesion: 0.12
Nodes (21): ActiveChallengeView, ActiveSessionView, ALL_DAYS, BackgroundResponse, BridgeEnvelope, BridgeFailure, BridgeFailureKind, dateRangesOverlap() (+13 more)

### Community 18 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+14 more)

### Community 19 - "session.rs"
Cohesion: 0.14
Nodes (23): ActiveSessionView, double_end_is_impossible(), end_records_timestamp_and_reason(), ended_session_serializes_to_stable_wire_shape(), expired_session_reports_zero_remaining(), fresh_session_has_positive_remaining_within_planned(), future_started_at_clamps_elapsed_to_zero(), Preset (+15 more)

### Community 20 - "One-shot messaging with chrome.runtime.sendMessage"
Cohesion: 0.10
Nodes (21): return true async response rule (async handler trap), Common messaging bugs (Receiving end does not exist, port disconnects, 64MB payload), Cross-extension messaging via externally_connectable, Port-based long-lived connections (chrome.runtime.connect), Full RPC layer simulating HTTP over chrome.runtime messaging, One-shot messaging with chrome.runtime.sendMessage, Three-layer bridge: page <-> content script <-> service worker via window.postMessage, CORS vs CSP in extensions (+13 more)

### Community 21 - "popup/pages/Whitelist.tsx"
Cohesion: 0.24
Nodes (9): DomainEntry, ipc, TemporaryAllowEntry, Blocklists(), addButtonStyle, inputStyle(), remainingTime(), removeButtonStyle (+1 more)

### Community 22 - "chrome-devtools-cli SKILL.md (.agents copy)"
Cohesion: 0.14
Nodes (17): chrome-devtools-cli installation.md (.agents copy), npm global install of chrome-devtools-mcp (npm i chrome-devtools-mcp@latest -g), Accessibility Verification with DevTools, chrome-devtools-mcp CLI (chrome-devtools command), Clean Console Standard (zero errors/warnings), DevTools Debugging Workflow (UI/Network/Performance), chrome-devtools-cli SKILL.md (.agents copy), Element UID (+9 more)

### Community 23 - "handle_connection"
Cohesion: 0.18
Nodes (11): read_message(), Result, write_message(), handle_connection(), IpcServer, Result, Self, NamedPipeServer (+3 more)

### Community 24 - "wisprflow-com-tokens.d.ts"
Cohesion: 0.12
Nodes (15): ColorHex, ColorRole, ColorToken, DesignTokens, DurationToken, EasingToken, FontFamilyToken, FontSizeToken (+7 more)

### Community 25 - "SessionManager"
Cohesion: 0.16
Nodes (20): IpcResponse, Box, DateTime, Error, Option, Result, Self, Send (+12 more)

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
Cohesion: 0.20
Nodes (9): description, identifier, permissions, $schema, windows, core:default, dialog:default, main (+1 more)

### Community 30 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include, vite.config.ts

### Community 31 - "wisprflow-com-motion.one.js"
Cohesion: 0.22
Nodes (6): animations, durations, easings, keyframes, springs, _t

### Community 32 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, jsdom, @testing-library/dom, @testing-library/react, @types/chrome, @types/react, typescript, @vitejs/plugin-react (+9 more)

### Community 33 - "wisprflow-com-motion.waapi.js"
Cohesion: 0.29
Nodes (7): _animate(), animations, durations, easings, keyframes, prefersReducedMotion(), _timing

### Community 34 - "popup/pages/History.tsx"
Cohesion: 0.43
Nodes (5): Session, formatDuration(), History(), statusBg(), statusColor()

### Community 35 - "wisprflow-com-anatomy.tsx"
Cohesion: 0.29
Nodes (3): ButtonProps, CardProps, LinkProps

### Community 36 - "wisprflow-com-motion.framer.js"
Cohesion: 0.29
Nodes (6): durations, easings, inView, springs, transitions, variants

### Community 37 - "Section order: hero, app-integration demo, social proof logos, 4x faster claim, Made for the way you work, AI Auto Edits, Personal Dictionary/Snippets, 100+ languages, Flow everywhere, testimonials ('Love letters to Flow'), stats, Start flowing CTA, FAQ teaser, footer"
Cohesion: 0.40
Nodes (6): Color scheme: warm cream background, dark forest green sections, black cards, lavender accents, Hero: 'Don't type, just speak' with flowing dotted speech-to-text ribbon motif, Key marketing messages: voice is 4x faster than typing (45 wpm vs 220 wpm), works in all apps on any device, used by professionals everywhere, AI auto edits and personal dictionary, Section order: hero, app-integration demo, social proof logos, 4x faster claim, Made for the way you work, AI Auto Edits, Personal Dictionary/Snippets, 100+ languages, Flow everywhere, testimonials ('Love letters to Flow'), stats, Start flowing CTA, FAQ teaser, footer, Minimal top navigation (Flow logo) and large footer ending in oversized 'Flow' wordmark, Typography feel: elegant serif display headlines paired with clean sans-serif body text, italic accents

### Community 38 - "wisprflow-com-gradients.json"
Cohesion: 0.33
Nodes (5): count, generated, gradients, $schema, source

### Community 39 - "wisprflow-com-motion.gsap.js"
Cohesion: 0.33
Nodes (3): durations, eases, reveals

### Community 40 - "FocusBlock Design System"
Cohesion: 0.40
Nodes (5): design-extract-output Reference Directory, WisprFlow UI/UX Directive, FocusBlock Design System, theme.css (Tailwind v4 @theme), variables.css (CSS Custom Properties)

### Community 41 - "Service Worker (ephemeral background context)"
Cohesion: 0.40
Nodes (5): asyncHandler Pattern (return true from async listeners), Service Worker (ephemeral background context), Top 10 MV3 Mistakes, chrome.storage.onChanged broadcast sync, Service Worker Lifetime Limits (30s idle / 5min hard cap)

### Community 42 - "assemble.js"
Cohesion: 0.40
Nodes (3): __dirname, dist, root

### Community 43 - "CTA: lavender 'Download for Windows' pill button with dark border (nav + hero), platform availability note 'Available on Mac, Windows, iPhone, and Android'"
Cohesion: 0.50
Nodes (5): CTA: lavender 'Download for Windows' pill button with dark border (nav + hero), platform availability note 'Available on Mac, Windows, iPhone, and Android', Hero headline: 'Don't type, just speak' — large serif type, gray-to-black contrast emphasis, Hero imagery: cream background, curved speech-transcript ribbon flowing into a waveform capsule, floating circular text motif, Hero subcopy: 'The voice-to-text AI that turns speech into clear, polished writing in every app.', Floating rounded nav bar: 'Flow' logo with waveform icon, links (Product, Individuals, Business, Resources, Company), Windows-download CTA

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

### Community 49 - "Secondary button state variant: cream fill, dark rounded outline, mic icon + 'Try Flow' label"
Cohesion: 0.67
Nodes (4): Secondary button state variant: cream fill, dark rounded outline, mic icon + 'Try Flow' label, Black microphone glyph icon preceding label, Secondary style treatment: light cream background, ~2px near-black border, large corner radius (pill-like), 'Try Flow' CTA label in bold black sans-serif

### Community 50 - "web_accessible_resources manifest declaration (MV3 scoped)"
Cohesion: 0.67
Nodes (3): web_accessible_resources manifest declaration (MV3 scoped), Extension fingerprinting risk mitigation (use_dynamic_url), chrome.runtime.getURL resource access

### Community 51 - "Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background"
Cohesion: 0.67
Nodes (3): Interlocking dual-ring visual motif suggesting focus, blocking, and connection between distraction and concentration, Focus-block desktop app icon (128x128): two interlocking ring/arc shapes in amber-orange and cyan on a black square background, Tauri-based focus-block desktop application that uses this icon as its 128px application icon

### Community 52 - "Focus Block app branding (interlocking orange and cyan circular mark on black)"
Cohesion: 0.67
Nodes (3): Focus Block app branding (interlocking orange and cyan circular mark on black), Square71x71Logo.png - Windows Store square logo asset, Windows Store / MSIX small tile icon asset (71x71 px)

### Community 54 - "Wisprflow primary button (default state): 'Download for Windows' pill button with lavender fill (#E9D4FF approx), 2px dark border, fully-rounded radius (~999px), generous horizontal padding, bold near-black label, leading Windows OS icon"
Cohesion: 0.67
Nodes (3): Navbar context: button serves as top-right CTA in cream-background navigation bar alongside 'Flow' logo and dropdown nav links, Design token: fully-rounded (pill) border-radius ~999px with ~2px solid near-black outline on primary buttons, Wisprflow primary button (default state): 'Download for Windows' pill button with lavender fill (#E9D4FF approx), 2px dark border, fully-rounded radius (~999px), generous horizontal padding, bold near-black label, leading Windows OS icon

### Community 55 - "Primary CTA Button (Download for Windows)"
Cohesion: 0.67
Nodes (3): Primary CTA Button (Download for Windows), Default State Style: lavender fill, dark border, rounded pill, Windows Platform Download Action

### Community 56 - "WisprFlow Card Component (default state): near-black surface, ~40px radius, generous padding"
Cohesion: 0.67
Nodes (3): Circular add (+) button: dark gray circle with light plus icon, top-right of card header, WisprFlow Card Component (default state): near-black surface, ~40px radius, generous padding, Dictionary list item pills: teal-green fill (#0d4a3f), 2px cream border, fully rounded (pill) radius

### Community 57 - "Vertical list of snippet pill buttons with cream/ivory borders on dark background: Calendar, Hours, Support intro, FAQ, Careers link, Elevator pitch, Address"
Cohesion: 0.67
Nodes (3): Vertical list of snippet pill buttons with cream/ivory borders on dark background: Calendar, Hours, Support intro, FAQ, Careers link, Elevator pitch, Address, Active/highlighted snippet state: orange callout tooltip ('You can book a 30-minute call with me here: calendly.com/wisprflow') with hand-drawn orange arrow pointing from the Calendar item, 'Your Snippets' card component: dark rounded panel with bold serif-style heading and circular plus (add) button in top-right

### Community 58 - "Circular add button implying append-new-entry interaction for the dictionary card"
Cohesion: 1.00
Nodes (3): Circular add button implying append-new-entry interaction for the dictionary card, Vertical stack of dark green pill-shaped list items (Robyn, Viktor, SaaS, Caltrain, Mackey, Nguyen) with white borders and rounded corners, Card component 'Your Dictionary' - dark rounded panel with title and circular add (+) button in top-right

### Community 59 - "Wisprflow.com top navigation bar with links: Product (dropdown), Individuals (dropdown), Business, Resources (dropdown), Company (dropdown)"
Cohesion: 0.67
Nodes (3): Dropdown menu pattern on nav items (Product, Individuals, Resources, Company have chevron affordances; Business is a direct link), Nav styling: dark near-black text on light cream background, medium-weight sans-serif labels, small chevron-down icons after dropdown items, Wisprflow.com top navigation bar with links: Product (dropdown), Individuals (dropdown), Business, Resources (dropdown), Company (dropdown)

### Community 106 - "storage.ts"
Cohesion: 0.13
Nodes (17): ActiveSessionRecord, ALL_DAYS, ArchivedOutcome, ArchivedSessionRecord, ChallengeRecord, DEFAULTS, DomainListEntry, normalizeSchedule() (+9 more)

### Community 107 - "focus-store/src/codec.rs"
Cohesion: 0.12
Nodes (13): encode_domain_list(), encode_mode(), encode_status(), parse_domain_list(), parse_id(), parse_mode(), parse_status(), Result (+5 more)

### Community 108 - "Home.test.tsx"
Cohesion: 0.16
Nodes (12): ipc, ServiceStatus, formatTime(), Home(), HomePhase, buildStatus(), Deferred, Envelope (+4 more)

### Community 109 - "domain.rs"
Cohesion: 0.29
Nodes (4): domain_matches(), normalize_domain(), Option, String

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
Cohesion: 0.11
Nodes (47): BTreeSet, Default, Drop, FWP_BYTE_BLOB, GUID, HANDLE, HashSet, PSID (+39 more)

### Community 115 - "LOW"
Cohesion: 0.06
Nodes (34): Focus-Block Audit Report, H1. Punctuation-only blocklist entries (`*.`, `.`) become catch-all web blockers, H2. Named-pipe IPC accepts any local caller; unprivileged process can kill active blocking, H3. Unbounded frame allocation from untrusted length prefix (DoS on service), H4. Service crash-loops at boot when BFE isn't up (recent change), H5. No single source of truth for blocklists between extension and desktop/service, H6. Domain normalization implemented 3x, already drifted, HIGH (+26 more)

### Community 117 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, tauri, test

### Community 118 - "ipc.parity.test.ts"
Cohesion: 0.28
Nodes (3): IpcModule, invokeMock, MemoryStorage

### Community 119 - "desktop/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 120 - "src/App.tsx"
Cohesion: 0.11
Nodes (10): App(), navItems, DomainListKind, DomainListPage(), LIST_COPY, AppSettings, DomainEntry, ErrorBoundary (+2 more)

### Community 121 - "ipc.bridge.test.ts"
Cohesion: 0.50
Nodes (3): everyCommand, invokeMock, IpcModule

### Community 122 - "Chrome Web Store Listing — Focus Blocker"
Cohesion: 0.13
Nodes (14): Chrome Web Store Listing — Focus Blocker, Data Collection, Data Use Certification, Developer Info, Distribution, Graphics & Assets, Known Issues / Limitations, Permissions Justification (+6 more)

### Community 123 - "popup/App.tsx"
Cohesion: 0.16
Nodes (8): App(), navItems, bodyStyle, headingStyle, listItemStyle, Privacy(), sectionStyle, Settings()

### Community 125 - "run_async"
Cohesion: 0.22
Nodes (13): Receiver, configure_service_recovery(), Box, Error, Option, Result, Send, String (+5 more)

### Community 128 - "Chrome Web Store Submission — Focus Blocker"
Cohesion: 0.17
Nodes (11): 0. First-time setup (one time only), 1. Package the upload, 2. Store listing, 3. Single purpose, 4. Permission justifications, 5. Privacy tab (dashboard), 6. Version history entry (0.2.0), 7. Distribution (+3 more)

### Community 129 - "Test-Debt Report"
Cohesion: 0.17
Nodes (11): 1. What was added (implemented), 2. Flaky-test hunt, 3. Ready-to-drop tests for known bugs (add AFTER fixing, else suite goes red), 4. Still uncovered, ranked by blast radius, 5. Duplicate / mergeable tests (prompt 4 answer), 6. Final suite state, Fixed broken pre-existing tests (test-only edits, no production code), New: `apps/extension/background/__tests__/scheduled-stop-suppression.test.ts` (8 assertions-groups) (+3 more)

### Community 130 - "Focus Blocker — Privacy Policy"
Cohesion: 0.18
Nodes (10): Changes, Contact, Deletion, Focus Blocker — Privacy Policy, How the permissions are used, Retention, Sharing, Summary (+2 more)

### Community 131 - "app-picker.ts"
Cohesion: 0.19
Nodes (20): AppPickerModal(), Props, DiscoveredApp, getAppIcon(), getCachedInstalledApps(), isTauriEnvironment(), listInstalledApps(), listStoreApps() (+12 more)

### Community 132 - "package.js"
Cohesion: 0.25
Nodes (6): __dirname, dist, out, releases, root, { version }

### Community 133 - "Stale / Idle Files Report"
Cohesion: 0.33
Nodes (5): Human decision needed, Not stale (do not remove), Safe to remove (regenerable), Stale / Idle Files Report, Suggested cleanup command (run only after confirmation)

### Community 142 - "src-tauri/src/lib.rs"
Cohesion: 0.22
Nodes (21): extract_app_icon_native(), get_app_icon(), get_cached_icon(), icon_cache_dir(), ipc_request(), list_installed_apps(), list_installed_apps_native(), list_store_apps() (+13 more)

## Ambiguous Edges - Review These
- `Vite Logo SVG (favicon)` → `Vite Build Tool`  [AMBIGUOUS]
  apps/desktop/public/vite.svg · relation: rationale_for

## Knowledge Gaps
- **579 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+574 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Vite Logo SVG (favicon)` and `Vite Build Tool`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `StoreError` connect `FocusStore` to `SessionManager`, `focus-store/src/codec.rs`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `IpcResponse` connect `SessionManager` to `handle_connection`, `src-tauri/src/lib.rs`, `protocol.rs`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `store_error()` connect `SessionManager` to `FocusStore`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _579 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FocusStore` be split into smaller, more focused modules?**
  _Cohesion score 0.08823529411764706 - nodes in this community are weakly interconnected._
- **Should `src/lib/ipc.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._