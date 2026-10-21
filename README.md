# FocusBlock

Enhance focused work sessions by blocking distracting apps and websites. FocusBlock is designed to help you manage your time, safeguard your focus, and reduce stress.

> For quick extension setup, jump [here](https://github.com/ArhamBafna/focus-block#chrome-extension).

## What's Included

- **One-Click Focus Sessions**: Quick, distraction-free sessions
- **Smart Blocking**: Blocking both websites and apps for desktop and browser
- **Customizable Controls**: Manage your block lists, session times, and essential sites
- **Session History**: View and analyze your focus sessions
- **Desktop & Chrome Extension**: Seamless blocking for both desktop and browser use
- **Strong, Minimal UI**: Clear, no-fuss controls without gimmicks or overbearing "guilt" elements

## Tech Stack

- **Desktop**: [Tauri](https://tauri.app/) (Rust backend + React/TypeScript frontend)
- **Backend**: Rust + [Tokio](https://tokio.rs/) async
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Chrome Extension**: Manifest V3, React + TypeScript
- **Database**: SQLite (using [rusqlite](https://github.com/rusqlite/rusqlite))
- **IPC**: Cross-platform inter-process communication
- **Build Tools**: Cargo (Rust), npm/pnpm (Node)

## Quickstart

### Quickstart Scripts

We have two main "core dev" scripts in `scripts/`:

#### 1. Start App (`scripts/start.bat`)

Start from PowerShell or double-click in File Explorer:

```powershell
.\scripts\start.bat
```

| Argument | Shorthand | Description |
|---|---|---|
| *(none)* | *(default)* | Full system: checks tools, builds extension, starts background `focus-service`, runs desktop app |
| `-DesktopOnly` | `-d` / `--desktop` | Background `focus-service` + start desktop UI (no extension build) |
| `-ExtensionOnly` | `-e` / `--extension` | Build Chrome extension to `apps/extension/dist` (no admin required) |
| `-ServiceOnly` | `-s` / `--service` | Only background `focus-service` (console mode) |

#### 2. Test (`scripts/test.bat`)

Runs tests. Color-coded status (exits `0` = ok, `1` = fail):

```powershell
.\scripts\test.bat
```

| Argument | Shorthand | What does it test? |
|---|---|---|
| *(none)* | *(default)* | Runs all 3 tests in order: Rust backend, Chrome extension, desktop app UI |
| `-RustOnly` | `-r` / `--rust` | Only Rust workspace unit tests (`cargo test --workspace`) |
| `-ExtensionOnly` | `-e` / `--extension` | Only Chrome ext unit tests (`apps/extension npm test`) |
| `-DesktopOnly` | `-d` / `--desktop` | Only desktop app (React) UI tests (`apps/desktop npm test`) |

---

### Prerequisites

- **Rust**: [Install Rust](https://rustup.rs/) (1.70+)
- **Node.js**: 18+ (npm/pnpm)
- **For Desktop**: Tauri CLI, WebView2 (Windows) / system webview (macOS/Linux)
- **For Extension**: Chrome/Chromium

### Manual / Low-Level Dev

1. **Install deps**:
   ```bash
   # Node deps
   npm install
   cd apps/desktop && npm install
   ```

2. **Build Rust backend** (Tauri does it by default, but you can also):
   ```bash
   cargo build --workspace
   ```

3. **Run dev server**:
   ```bash
   cd apps/desktop
   npm run dev
   ```

4. **Build for production**:
   ```bash
   cd apps/desktop
   npm run build
   ```

### Chrome Extension

#### Pre-built Release (Quick way for extension install)

1. Download `focus-blocker-v0.2.0.zip` from [Releases](https://github.com/ArhamBafna/focus-block/releases).
2. Unzip to a folder.
3. Go to Chrome, `chrome://extensions/`.
4. Toggle on **Developer mode** (top right).
5. Click **Load unpacked** button. Choose your unzipped folder.

#### Build from Source

1. **Install deps**:
   ```bash
   cd apps/extension
   npm install
   ```

2. **Watch mode** (rebuilds on file changes):
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

4. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Toggle on **Developer mode** (top right)
   - Click **Load unpacked**
   - Choose `apps/extension/dist` folder

5. **Rebuild after changes**:
   ```bash
   npm run build
   ```

## License

[Apache-2.0 License](LICENSE)
