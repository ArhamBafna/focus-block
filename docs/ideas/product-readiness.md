# Product-Ready FocusBlock: Brainstorm

## The Problem — "How Might We?"

**How might we make FocusBlock installable and usable by a non-technical person who has never opened PowerShell?**

Today, running FocusBlock requires:

1. Admin PowerShell → `cargo build -p focus-service --release`
2. Admin PowerShell → run `install-focusblock.ps1` with paths + extension ID
3. Chrome → manually load unpacked extension + copy 32-char extension ID
4. Normal terminal → `cd apps/desktop && npm run tauri dev`

That's **four separate manual steps across three windows**, referencing cargo, npm, PowerShell scripts, and a 32-character ID. A real user would bounce at step 1.

**Target UX:** User downloads one `.exe`, double-clicks it, clicks "Install", and FocusBlock works. Extension available from Chrome Web Store. Done.

---

## How Freedom.to Does It (Reverse Engineering)

Freedom is the reference product. Here is how their entire install-to-use pipeline works on Windows:

### Architecture

| Layer | What Freedom uses | What FocusBlock has |
|---|---|---|
| **Desktop UI** | Electron (Chromium + Node.js) | Tauri v2 (Rust + WebView) |
| **Background engine** | Local proxy on `127.0.0.1:7769` + process monitor | Windows Service (`FocusBlockService`) |
| **Web blocking** | System proxy + loopback interception via WinINet/WinHTTP registry | `declarativeNetRequest` via Chrome extension |
| **App blocking** | Process enumeration via WMI, force-kill | Same — process enumeration via WMI, force-kill |
| **Browser integration** | Companion Chrome extension (CWS) + native messaging | Same — Chrome extension + native messaging host |
| **Anti-tamper** | Block Task Manager, block uninstaller during session, block Settings | Stop challenges (countdown, typing, memory, math, reflection) |
| **Cloud sync** | Account-based, server-synced schedules | None — 100% on-device, no account |
| **Update mechanism** | Electron + Squirrel.Windows (`.nupkg` delta updates) | Not yet — Tauri has `tauri-plugin-updater` |

### Freedom's Install Flow (What Users Experience)

```
1. User visits freedom.to → "Download for Windows" button
2. Downloads Freedom-Setup.exe (~80MB Electron bundle)
3. Double-clicks → UAC prompt → quick silent install
4. Installs to %LocalAppData%\Freedom (per-user, no admin required for basic install)
5. Registers autorun via HKCU\...\Run
6. App auto-launches → login prompt → system tray butterfly icon
7. In-app prompt: "Install Chrome extension" → links to CWS
8. Extension auto-detects desktop app via native messaging
9. Done. Two clicks after download.
```

### Freedom's Key Design Decisions (Lessons for FocusBlock)

1. **Per-user install (`%LocalAppData%`) for the UI, system-level hooks only for blocking.** Freedom avoids requiring admin for the basic app install. It only elevates when touching network/proxy settings. FocusBlock's Windows Service *requires* admin — the installer must handle this.

2. **Desktop-first, extension-second.** Freedom tells users to install the desktop app *before* the extension. If extension is installed first and desktop app is missing, the extension shows "Install Freedom Desktop" prompt. FocusBlock should do the same.

3. **Auto-launch after install.** Freedom launches immediately after setup completes. User never has to find the app in Start Menu. The installer opens it.

4. **System tray presence.** Freedom minimizes to system tray with a butterfly icon. The main UI is lightweight. Heavy config goes to web dashboard. FocusBlock's Tauri window should register a system tray icon and support minimize-to-tray.

5. **Silent auto-updates.** Squirrel.Windows downloads `.nupkg` delta updates in background, applies on next restart. User never sees an update dialog. Tauri's `tauri-plugin-updater` can do the same via GitHub Releases.

6. **Locked Mode anti-tamper runs in user-space.** Freedom does NOT use kernel drivers. It blocks Task Manager, Settings, and the uninstaller via process hooks and ACL restrictions. Determined admins can still bypass. FocusBlock's current approach (stop challenges) is a lighter but philosophically different enforcement model.

### What FocusBlock Can Steal vs. Must Skip

| Steal from Freedom | Skip / Do Differently |
|---|---|
| One-click installer | No account required (Freedom requires login) |
| Auto-launch after install | No cloud sync (100% on-device) |
| Desktop-first onboarding | No system proxy manipulation (use `declarativeNetRequest`) |
| System tray icon | No Electron bloat (Tauri is ~5MB vs ~80MB) |
| Silent auto-updates | Stop challenges instead of anti-tamper (different philosophy) |
| Extension links to CWS | Custom URI scheme (`focusblock://`) for deep links |

---

## What Needs to Ship (The 3 Deliverables)

| # | Deliverable | User touches | You ship |
|---|---|---|---|
| 1 | **Windows installer** (`.exe`) | Double-click, click Install | NSIS via `tauri build` |
| 2 | **Chrome Web Store extension** | Click "Add to Chrome" | Published `.zip` on CWS |
| 3 | **First-run onboarding** (inside the app) | Guided setup | In-app welcome screen |

---

## Direction A: NSIS Installer Bundles Everything (Recommended)

### How it works

Tauri v2's NSIS bundler already produces a `FocusBlocker-setup.exe`. Extend it to:

1. **Bundle the service binary as a sidecar** (`focus-service.exe` and `focus-native-host.exe`)
2. **Install the Windows service** during setup (NSIS runs elevated = UAC prompt once)
3. **Register the native messaging host** (write manifest JSON + registry key)
4. **Extension comes from Chrome Web Store** (hardcoded extension ID, no copy-pasting)
5. **Auto-launch app** after install completes

### What changes in the codebase

```
tauri.conf.json
├── bundle.externalBin: ["binaries/focus-service", "binaries/focus-native-host"]
├── bundle.windows.nsis.installMode: "perMachine"   ← forces UAC
└── bundle.windows.nsis.installerHooks: "./nsis-hooks.nsi"  ← custom

nsis-hooks.nsi (new)
├── Post-install: sc create FocusBlockService ...
├── Post-install: write native host manifest + registry
├── Post-install: launch app
├── Pre-uninstall: sc delete FocusBlockService
└── Pre-uninstall: remove registry keys + manifest

src-tauri/binaries/ (new directory)
├── focus-service-x86_64-pc-windows-msvc.exe
└── focus-native-host-x86_64-pc-windows-msvc.exe
```

### User experience

```
Download FocusBlocker-setup.exe
  → UAC prompt ("Allow FocusBlock to make changes?") → Yes
  → Installs to C:\Program Files\FocusBlock\
  → Windows service starts automatically
  → Native messaging host registered
  → Desktop app auto-launches
  → App shows first-run welcome: "Install Chrome extension" → CWS link
  → Done.
```

### Assumptions to validate

- [ ] **Tauri NSIS hooks can run `sc.exe create`** — Tauri docs confirm custom NSIS script injection
- [ ] **Chrome Web Store extension ID is stable** — Yes, once published, the ID never changes
- [ ] **Service survives app updates** — NSIS hooks need upgrade logic (stop → update → restart)

---

## Direction B: First-Run Self-Install (Simpler to Build, Worse UX)

App itself handles service installation on first launch via UAC elevation.

### Trade-offs vs Direction A

| | Direction A (NSIS hooks) | Direction B (first-run) |
|---|---|---|
| UAC prompt | Once, during install | Once, on first launch |
| Uninstall cleanup | Handled by NSIS uninstaller | Need custom cleanup |
| User trust | "Installer needs admin" feels normal | "App needs admin" feels sketchy |
| Updates | NSIS handles service binary swap | App must handle in Rust |

**Verdict:** Direction A wins. Users expect installers to need admin. They do NOT expect apps to.

---

## Direction C: Hybrid (Recommended Final)

Use NSIS hooks for fresh installs. If the service is missing on launch (edge case / broken update), the app detects and self-repairs via UAC prompt. Belt and suspenders.

---

## The Extension Distribution Question

[CHROMEWEBSTORE.md](file:///c:/Users/bafna_sb19qr0/Desktop/Projects/focus-block/CHROMEWEBSTORE.md) is already prepared. This is the plan:

1. Publish to Chrome Web Store ($5 one-time, need Google Developer account — **not yet created**)
2. Once published, extension ID is permanent
3. Hardcode that ID in the installer's native host manifest template
4. No more manual "copy your extension ID" step
5. Onboarding: app shows "Install Chrome Extension" button → opens CWS page

**Chicken-and-egg handling (stolen from Freedom):**
- Extension installed first, no desktop app? → Extension popup shows "Install FocusBlock Desktop" link
- Desktop app installed first, no extension? → App shows "Install Chrome Extension" CWS link
- Both installed? → Native messaging auto-connects. Green state.

---

## CI/CD Pipeline

### What Exists Now

[ci.yml](file:///c:/Users/bafna_sb19qr0/Desktop/Projects/focus-block/.github/workflows/ci.yml) already runs:
- `rust-tests`: Rust workspace tests on `ubuntu-latest`
- `desktop-build`: Desktop frontend build + tests on `ubuntu-latest`
- `extension-build`: Extension build + tests on `ubuntu-latest`

Triggers on all pushes and PRs to `main`. No Windows runner. No release artifacts.

### What's Missing

- Windows build (currently ubuntu-only — Tauri Windows builds need `windows-latest`)
- Release pipeline (no `tauri build`, no installer artifact, no GitHub Release)
- Extension packaging for CWS upload
- Code signing
- Update manifest (`latest.json`) generation

### Target Pipeline

```
ci.yml (existing, keep as-is for PR checks)
  ├── rust-tests (ubuntu)
  ├── desktop-build (ubuntu)
  └── extension-build (ubuntu)

release.yml (new, triggers on v* tags)
  ├── build-installer (windows-latest)
  │   ├── cargo build -p focus-service --release
  │   ├── Copy binaries to src-tauri/binaries/
  │   ├── npm run tauri build (produces NSIS .exe)
  │   ├── Sign with Ed25519 key (TAURI_SIGNING_PRIVATE_KEY secret)
  │   └── Create GitHub Release with .exe + .sig + latest.json
  └── package-extension (ubuntu-latest)
      ├── cd apps/extension && npm run build && npm run package
      └── Upload .zip as release artifact (manual CWS upload)
```

---

## Auto-Update

Tauri v2 has `tauri-plugin-updater`. Needs:

1. **Ed25519 key pair** — `cargo tauri signer generate`
2. **`latest.json` endpoint** — GitHub Releases (free)
3. **Plugin config in `tauri.conf.json`**:
   ```json
   "plugins": {
     "updater": {
       "pubkey": "...",
       "endpoints": ["https://github.com/ArhamBafna/focus-block/releases/latest/download/latest.json"]
     }
   }
   ```

Update flow: App checks GitHub → downloads new `.exe` + `.sig` → verifies → runs NSIS silently → restarts. Service binary updated in the process (NSIS hooks stop/restart service).

---

## Code Signing (The SmartScreen Problem)

Without a code-signing certificate, Windows SmartScreen shows "Windows protected your PC." Most users will not click "Run anyway."

| Option | Cost | SmartScreen effect |
|---|---|---|
| No signing | Free | Scary red/blue warning, most users bail |
| Azure Trusted Signing | ~$10/month | Immediate trust |
| OV certificate | ~$200-400/year | Warning fades after reputation builds |
| EV certificate | ~$400-600/year | Immediate trust |

**Recommendation:** Azure Trusted Signing ($10/month). Cheapest path to immediate trust.

---

## Onboarding UX (First-Run Experience)

Modeled after Freedom's flow:

### Screen 1: Welcome
> "Welcome to FocusBlock. Let's get you set up in 30 seconds."
> [Continue]

### Screen 2: Chrome Extension
> "Install the Chrome extension to block distracting websites."
> [Install from Chrome Web Store] ← opens CWS page
> [Skip for now] ← user can add it later

### Screen 3: Ready
> "You're all set. Your Windows service is running and ready to block distracting apps."
> [Start Your First Focus Session]

The app should also detect extension connection status:
- **Connected:** Green dot. "Chrome extension connected."
- **Not connected:** Yellow dot. "Chrome extension not installed. [Install now]"

---

## MVP Scope — What's In, What's Out

### In (Must have for v1.0)
- [ ] NSIS installer bundling service + native host as sidecars
- [ ] Service auto-installs and auto-starts during setup
- [ ] Native messaging host registered during setup
- [ ] Chrome Web Store extension published
- [ ] Hardcoded CWS extension ID (no manual copying)
- [ ] First-run onboarding (welcome + install extension CWS link)
- [ ] Clean uninstaller (removes service, registry keys, manifest)
- [ ] GitHub Actions release pipeline (`release.yml`) on `windows-latest`
- [ ] Auto-launch app after install

### Should have (v1.0 if time allows)
- [ ] Auto-updater (`tauri-plugin-updater` + GitHub Releases)
- [ ] Code signing (Azure Trusted Signing)
- [ ] System tray icon with minimize-to-tray
- [ ] Extension detects missing desktop app and shows install link
- [ ] Custom URI scheme (`focusblock://`) for deep links

### Out (Not doing, and why)
- **Mac/Linux support** — Windows only. Different blocking mechanisms, different service models. Ship Windows, validate product, expand later.
- **Self-hosted extension** — CWS handles updates, trust, distribution. No value in self-hosting.
- **MSI installer** — NSIS is more customizable and Tauri's preferred path. No need for both.
- **Account system / cloud sync** — FocusBlock is 100% on-device. This is a feature, not a limitation. Freedom requires accounts. FocusBlock does not.
- **Kernel-level anti-tamper** — Freedom blocks Task Manager from user-space. FocusBlock uses stop challenges (different philosophy: make quitting a deliberate decision, not an impossible one).
- **Portable/no-install mode** — Windows Service requires admin to install. No way around this. Lean into the installer.
- **In-browser extension installation** — Chrome deprecated inline install in 2018. CWS link is the only way.
- **Electron migration** — Tauri already works, produces ~5MB bundles vs Electron's ~80MB. No reason to switch.

---

## What the "Launch Timeline" Question Meant

The question was: when do you want the first real user to be able to download and use FocusBlock? The answer determines what goes in v1.0 vs. v1.1:

- **"Within weeks"** → Ship NSIS installer + CWS extension. Skip auto-update and code signing for v1.0. Add them in v1.1.
- **"Within months"** → Ship everything: installer, CWS, auto-update, code signing, onboarding UX, system tray — all in v1.0.
- **"No rush, doing this right"** → Same as months, plus polish onboarding, write docs, maybe a landing page.

---

## Concrete Next Steps (When You're Ready)

| # | Step | Depends on | Can start now? |
|---|---|---|---|
| 1 | Create Google Developer account for CWS | $5, your Google account | Yes |
| 2 | Publish extension to Chrome Web Store | Step 1 | After step 1 |
| 3 | Set up sidecar bundling in `tauri.conf.json` | Nothing | **Yes** |
| 4 | Write NSIS hooks (service install/uninstall, native host) | Step 3 | After step 3 |
| 5 | Write `release.yml` GitHub Actions workflow | Step 4 | After step 4 |
| 6 | Build first-run onboarding UI | Step 2 (need CWS link) | Partially |
| 7 | Set up code signing (Azure Trusted Signing) | Budget decision | Yes |
| 8 | Add auto-updater (`tauri-plugin-updater`) | Step 5 | After step 5 |
| 9 | System tray icon + minimize-to-tray | Nothing | **Yes** |

Steps 3, 4, and 9 can start immediately. Step 1 requires creating the Google Developer account.

---

## Step 3 Decision Record: Sidecar Bundling & Installer Spec

During planning for Step 3, the following design decisions were vetted and confirmed:

### 1. Bundled Binaries (`bundle.externalBin`)
- Both background helpers will be packaged into the desktop installer:
  - `focus-service`: Windows background blocker engine.
  - `focus-native-host`: Native messaging bridge to Chrome extension.
- In `tauri.conf.json`:
  ```json
  "bundle": {
    "externalBin": [
      "binaries/focus-service",
      "binaries/focus-native-host"
    ]
  }
  ```

### 2. Target Architecture
- 64-bit Windows: `x86_64-pc-windows-msvc`.
- Tauri requires sidecars on disk before packaging to match:
  - `apps/desktop/src-tauri/binaries/focus-service-x86_64-pc-windows-msvc.exe`
  - `apps/desktop/src-tauri/binaries/focus-native-host-x86_64-pc-windows-msvc.exe`

### 3. Administrator Privilege Model (Option A vs Freedom.to)
- **Freedom.to benchmark:** Freedom requires Windows Administrator rights to set up network filtering and background blocking. Without elevation, users can easily kill the process in Task Manager or bypass blocks.
- **Decision:** **Option A (Per-Machine Installer)**.
  - Set `bundle.windows.nsis.installMode: "perMachine"` in `tauri.conf.json`.
  - Installer prompts for standard Windows UAC permission once during setup.
  - Installs to `C:\Program Files\FocusBlock` so the Windows Service can be registered cleanly and removed cleanly on uninstall.

### 4. Build Automation
- Automate binary staging via an npm script in `apps/desktop/package.json` (e.g. `npm run build:sidecars` or linked into `beforeBuildCommand`).
- Script runs `cargo build -p focus-service --release` and copies/renames the binaries to `apps/desktop/src-tauri/binaries/` with the required target triple automatically so no manual file copying is required.

### 5. Git Hygiene
- Add `apps/desktop/src-tauri/binaries/*.exe` to `.gitignore` to avoid committing large binary files to source control.

