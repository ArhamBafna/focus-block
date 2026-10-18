# Focus App Feature Inventory

**Status Legend:**
- `[DONE]` Working in current app (or fully implemented on its exclusive target platform)
- `[PARTIAL]` Exists in limited form (e.g. built on Extension or Desktop only, or missing sub-features)
- `[NOT YET]` Planned / exploratory idea only

---

## Core Blocking

### Website Blocking `[DONE]`
Block specific websites across supported browsers (powered by Declarative Net Request in Chrome extension).

### App Blocking `[DONE]`
Block selected desktop applications. Platform-exclusive to Windows Desktop: FocusBlock Windows service subscribes to kernel process creation events (`Win32_ProcessStartTrace`) and terminates blocked Win32 executables (`.exe`) and Microsoft Store packages (PFN) in < 10ms with zero idle CPU overhead. Includes an App Picker modal with hybrid app discovery and icon caching.

### Internet Kill Switch `[NOT YET]`
Disable all network access during a focus session. (Currently out of scope to avoid modifying system DNS, proxy, or firewall state).

### Category Blocking `[NOT YET]`
One-click blocking for entire categories such as Social Media, Video, Gaming, Shopping, News. (Discovered desktop apps have category tags, but category-level bulk blocking is not yet implemented).

### Custom Blocklists `[DONE]`
Create and edit personalized lists of blocked websites (in Extension and Desktop) and desktop applications (in Desktop).

### Prebuilt Blocklists `[NOT YET]`
Ready-made presets such as Student Study Mode, TikTok Detox, Exam Week, Deep Work.

### Whitelist Mode `[DONE]`
Allow only approved websites and apps (implemented as Lockdown Mode in both Desktop and Extension).

### Temporary Exceptions `[PARTIAL]`
Permit specific resources temporarily while a block remains active. Implemented in the Chrome Extension Whitelist (allows a domain for 15, 30, or 60 minutes with a live countdown). Desktop does not yet support temporary allows.

### Browser Extension Blocking `[DONE]`
Block websites directly within the browser. Platform-exclusive to the Chrome MV3 extension.

### Cross-Browser Blocking `[NOT YET]`
Apply blocks across all installed browsers (Safari, Firefox, etc.). FocusBlock currently targets Chromium browsers via extension and native messaging; no OS-level network proxy is used.

---

## Focus Sessions

### Manual Focus Session `[DONE]`
Start a focus session instantly from Desktop or Extension popup with customizable duration.

### Scheduled Sessions `[PARTIAL]`
Create future focus sessions. Implemented in Chrome Extension (allows setting start time, end time, and days of the week). Desktop app does not yet have a schedule manager.

### Recurring Sessions `[PARTIAL]`
Automatically repeat focus sessions daily or weekly. Implemented in Chrome Extension with background alarms. Desktop app does not yet support recurring schedules.

### Deep Work Mode / Exam Mode / Library Mode / Work Mode `[PARTIAL]`
Specialized focus profiles. Supported via Custom Presets in the Desktop app (custom duration, mode, and target lists), but pre-packaged named modes are not yet built-in.

### Session Breaks `[NOT YET]`
Built-in break periods between focus blocks.

### Pomodoro Timer / Custom Pomodoro Rules `[NOT YET]`
User-defined focus/break intervals (e.g., 25m work / 5m break).

---

## Enforcement

### Locked Mode `[PARTIAL]`
Sessions cannot be stopped early without completing an obstacle. Implemented in the Chrome Extension via Stop Challenges. Desktop app currently has an instant "Stop Session" button that bypasses locked mode until challenges are added to Desktop.

### Stop Challenges (Lockdown Gates) `[PARTIAL]`
Five challenge gates are implemented in the Chrome Extension to prevent impulsive quitting:
1. **Countdown Timer (Delay Override)**: Forces a 15s, 30s, 60s, or 120s waiting period with optional guided breathing animations.
2. **Typing Challenge**: Requires typing an emotional reflection paragraph character-perfect without copy-paste.
3. **Pattern Memory Puzzle**: 3x3 memory grid pattern replication that scrambles on mistake.
4. **Mental Challenge (Math/Logic)**: Sequential arithmetic and logic puzzles that must all pass.
5. **Reflection Prompt**: Requires typing 80–150 characters explaining why you are ending your focus session early.
*Note: Desktop app does not yet enforce these challenges before stopping.*

### Delay Override `[PARTIAL]`
Require waiting before ending a session. Implemented in Chrome Extension as the Countdown Timer Challenge (15s–120s with breathing exercises). Desktop app does not yet enforce this delay.

### Force Mode `[PARTIAL]`
Extreme anti-bypass protection. Windows background service automatically keeps enforcement running and restarts enforcer upon system/service restart. User-space anti-tamper (blocking Task Manager or uninstaller) is not implemented per product philosophy (relying on deliberate friction instead of kernel locks).

### Anti-Uninstall Protection `[NOT YET]`
Prevent uninstallation while a focus session is active.

### Anti-Incognito Protection `[NOT YET]`
Prevent bypass through private browsing.

### Anti-Browser-Switch Protection `[NOT YET]`
Detect and restrict switching to unmanaged secondary browsers.

### Session Commitment Confirmation `[NOT YET]`
Pledge or confirm commitment before starting a high-friction session.

### Emergency Override `[NOT YET]`
Trusted emergency unlock process for urgent access during a locked session.

### Trusted Contact Unlock `[NOT YET]`
A friend, mentor, or family member can authorize an override.

---

## Cross-Device System

*Note: FocusBlock v1 is strictly local-first and on-device (no accounts, no cloud dependencies). Cross-device sync is a future exploration.*

### Device Sync `[NOT YET]`
Sync blocklists and settings across devices.

### Cross-Device Blocking `[NOT YET]`
One session blocks distractions simultaneously across desktop, phone, and tablet.

### Universal Focus Button `[NOT YET]`
Start focus mode on all devices simultaneously.

### QR Device Pairing / Code Pairing `[NOT YET]`
Pair secondary devices via direct QR scan or pairing code.

### Cloud Sync `[NOT YET]`
Store settings securely across devices. (Concept: Anki-style peer sync — send changes to cloud queue and delete once synced to keep data stored locally).

---

## Mobile Features

*Note: FocusBlock v1 targets Windows desktop and Chrome extension. Mobile features are planned for future versions.*

### Mobile App Blocking `[NOT YET]`
Block distracting mobile apps on iOS and Android.

### Mobile Website Blocking `[NOT YET]`
Block websites on mobile browsers (Safari / Chrome mobile).

### Focus Mode Integration `[NOT YET]`
Integrate with native iOS Focus / Android Digital Wellbeing modes.

### Android Enforcement Layer `[NOT YET]`
Use Android Accessibility / Device Admin / VPN restriction tools.

### iOS Enforcement Layer `[NOT YET]`
Use Apple Screen Time API / Family Controls.

### Battery-Efficient Blocking `[NOT YET]`
Minimize battery drain on mobile devices.

### Tablet Support `[NOT YET]`
Optimized layout and experience for iPads and Android tablets.

---

## Accountability

*Note: Social & accountability features are planned for future multi-user versions.*

### Contact Discovery `[NOT YET]`
Find friends who have the app via opt-in contacts matching.

### Accountability Partner `[NOT YET]`
Pair with an accountability partner.

### Friend Notifications `[NOT YET]`
Notify friends when a focus session or commitment is broken early.

### Shared Focus Sessions `[NOT YET]`
Focus together simultaneously with friends or peers.

### Public Study Rooms `[NOT YET]`
Join open virtual study rooms with group accountability (broken session alerts other room members).

### Accountability History `[NOT YET]`
Public or partner-facing log of completed and broken commitments.

---

## Student Features

### Student Mode `[NOT YET]`
Preset configurations and blocklists tailored for study hours.

### Exam Week Templates `[NOT YET]`
Prebuilt schedules and aggressive restriction templates for exam periods.

---

## Motivation & Rewards

### Focus Streaks `[NOT YET]`
Track consecutive focus days and weekly consistency streaks.

### Focus Credits `[NOT YET]`
Earn redeemable credits from completed focus sessions.

### Premium Day Rewards `[NOT YET]`
Redeem focus credits for free premium days or extended access.

### Subscription Discounts `[NOT YET]`
Earn subscription discounts through verified focus consistency.

### Reward Marketplace `[NOT YET]`
Exchange focus credits for rewards, perks, or partner discounts.

### Partner Rewards `[NOT YET]`
Real-world partner offers and productivity tool discounts.

### Focus Achievements `[NOT YET]`
Milestone badges for hours focused, sessions completed, and streaks.

### Progress Milestones `[NOT YET]`
Celebrate major focus milestones and level-ups.

### Virtual Growth System `[NOT YET]`
Visual gamified growth representation of productive hours.

### Tree / Garden Growth `[NOT YET]`
Forest-style visual trees or gardens that grow during focus and wither if quit early.

### Community Impact Rewards `[NOT YET]`
Convert completed focus hours into charitable donations or tree planting.

### Seasonal Challenges `[NOT YET]`
Time-limited community focus challenges and events.

---

## Behavioral Intervention

### Before Opening Apps (Mindful Pause) `[NOT YET]`
Delay opening distracting apps with a short breathing task or mandatory intention prompt ("Why do you want to open this?").

### Mindful Unlock Flow `[PARTIAL]`
Reduce impulsive quits through mindful friction. Implemented in Chrome Extension (breathing countdown timer and written reflection challenge). Not in Desktop yet.

### Journaling Prompts `[PARTIAL]`
Reflective focus prompts. Implemented in Chrome Extension Reflection Challenge (requires writing 80–150 characters before ending early).

### Goal Setting Before Session `[NOT YET]`
Declare intended task/goal before a focus session begins.

### Session Reflection `[NOT YET]`
Review outcomes and productivity notes after a focus session concludes.

### Habit Coaching `[NOT YET]`
Guided advice and tips for improving concentration over time.

### Attention Training Exercises `[NOT YET]`
Short exercises to build attention span and resist distractions.

---

## Analytics

### Focus Time Tracking `[DONE]`
Track and display total completed focus time across sessions. Implemented in History views.

### Session History `[DONE]`
Review past sessions, including date, duration, mode, and completion status. Implemented in both Desktop and Chrome Extension.

### Time Saved Tracking `[NOT YET]`
Estimate distraction time prevented based on blocked attempt counts.

### Daily / Weekly / Monthly Reports `[NOT YET]`
Aggregated charts and productivity summaries over time.

### Distraction Analytics `[PARTIAL]`
Identify most frequent distraction triggers. Desktop service tracks blocked app events (name, timestamp, block count); full analytics UI is not yet built.

### Focus Score `[NOT YET]`
Overall focus performance and attention quality score.

### Consistency Score `[NOT YET]`
Measure habit formation and schedule adherence.

### Goal Progress Tracking `[NOT YET]`
Track progress toward weekly or monthly focus goals.

### Device / App / Website Usage Reports `[NOT YET]`
Detailed breakdown of apps and websites blocked during sessions.

### Productivity Trends `[NOT YET]`
Long-term focus patterns and peak focus hour insights.

---

## Smart Automation

### Calendar Integration `[NOT YET]`
Import schedule and automatically create focus sessions from Google, Outlook, or Apple Calendar.

### Automatic Session Creation `[NOT YET]`
Generate sessions automatically based on recurring work patterns.

### Smart Scheduling `[NOT YET]`
Suggest optimal focus windows based on user energy and distraction trends.

### Adaptive Scheduling `[NOT YET]`
Learn user behavior and adapt schedule timing dynamically.

### AI Focus Recommendations `[NOT YET]`
Suggest blocklist additions based on observed distraction attempts.

### Distraction Pattern Detection `[NOT YET]`
Identify high-risk distraction habits and times of day.

### Auto-Block High-Risk Times `[NOT YET]`
Automatically trigger focus blocks during known habitual distraction hours.

### Location-Based Focus `[NOT YET]`
Activate focus sessions when arriving at libraries, schools, or offices.

### WiFi-Based Focus `[NOT YET]`
Trigger focus when connected to specific work or school Wi-Fi networks.

### Habit Prediction `[NOT YET]`
Predict and preempt distraction risk before sessions break down.

---

## Focus Environment

### Ambient Focus Sounds `[NOT YET]`
Built-in background sounds (white noise, rain, cafe, binaural beats, lo-fi).

### Sound Mixing `[NOT YET]`
Mix multiple ambient audio channels with individual volume sliders.

---

## Social Features

### Friend Network `[NOT YET]`
Add friends and view mutual focus statuses.

### Focus Challenges `[NOT YET]`
Compete or collaborate with friends in focus sprints.

### Leaderboards `[NOT YET]`
Optional opt-in friend or community productivity rankings.

### Community Events `[NOT YET]`
Scheduled group focus sessions and quiet hours.

### Study Marathons `[NOT YET]`
Long-form group focus events with shared accountability.

### Accountability Communities `[NOT YET]`
Interest-based focus groups (students, writers, developers, founders).

---

## Customization

### Custom Templates (Presets) `[DONE]`
Save and reuse session configurations (name, mode, duration, target lists). Implemented as Presets in the Desktop app.

### Theme Support `[DONE]`
Curated visual styling. Both Desktop and Extension implement the dark/light design system inspired by Wispr Flow tokens.

### Beginner Mode `[NOT YET]`
Simplified user interface with minimal settings.

### Advanced Mode `[NOT YET]`
Power-user controls and advanced network/process configurations.

### One-Tap Setup `[NOT YET]`
Minimal friction, instant default onboarding.

### Personal Focus Profiles `[NOT YET]`
Different block profiles for different contexts (e.g., Coding, Writing, Gaming detox).

### Custom Categories `[NOT YET]`
User-created blocking groupings beyond default tags.

### Flexible Rule Builder `[NOT YET]`
Advanced rule creation (e.g., allow specific subpaths, block only during specific hours).

---

## Privacy & Security

### Local Data Storage `[DONE]`
All data is stored 100% locally on the device (SQLite via rusqlite on Desktop service, `chrome.storage.local` in Extension).

### Privacy-First Analytics `[DONE]`
Zero third-party analytics, tracking, or telemetry.

### No Data Selling `[DONE]`
Explicit privacy commitment; no user data is collected or monetized.

### Delete Data `[DONE]`
Full user control over history. Implemented as "Clear History" in both Desktop and Extension.

### Secure Sync `[NOT YET]`
End-to-end encrypted synchronization if cloud features are added.

### Export Data `[NOT YET]`
Download focus history and statistics as JSON or CSV.

---

## Integrations

### Calendar Integration `[NOT YET]`
Google Calendar, Outlook, and Apple Calendar integration.

### Task Manager Integration `[NOT YET]`
Connect task lists with focus sessions.

### Notion Integration `[NOT YET]`
Link focus blocks directly to Notion workspace tasks.

### Todoist Integration `[NOT YET]`
Start focus sessions tied to Todoist tasks.

### Project Tracking Integration `[NOT YET]`
Sync focus time with project management tools (Linear, Jira, GitHub).

---

## Accessibility & Convenience

### Offline Mode `[DONE]`
Works completely without an internet connection (no account login or cloud ping required).

### Cross-Platform Support `[PARTIAL]`
Supports Windows desktop and Chromium-based browsers (Chrome extension). macOS, Linux, and Mobile are not yet supported.

### Fast Onboarding `[PARTIAL]`
Quick initial setup. Single-click bundled Windows NSIS installer and Chrome Web Store direct install planned in `product-readiness.md`.

### Guided Setup Wizard `[NOT YET]`
Interactive wizard to configure initial blocklists and permissions.

### Import Settings `[NOT YET]`
Import blocklists from other blocking software or text files.

### Export Settings `[NOT YET]`
Backup and export blocklists and presets.

---

## Business & Licensing Plans

*Note: Exploratory licensing models for future commercial distribution.*

### Lifetime License Option `[NOT YET]`
One-time payment for lifetime desktop & extension access.

### Family Share Subscriptions `[NOT YET]`
Multi-seat license for households.

### Student Discounts `[NOT YET]`
Discounted plans for students with verified school emails.

### Team Plans `[NOT YET]`
Organization licenses with team workspaces.

### School Plans `[NOT YET]`
Campus-wide deployments for educational institutions.
