# FocusBlock

A distraction-blocking application for maintaining focused work sessions. FocusBlock helps users block distracting websites and apps, enabling them to protect focused time and work with less stress.

## Features

- **Quick Focus Sessions**: Start distraction-free sessions with a single click
- **Smart Blocking**: Block websites and applications across your desktop and browser
- **Flexible Controls**: Customize block lists, set session durations, and whitelist critical sites
- **Session Review**: Track and review your focus history to understand your patterns
- **Desktop + Chrome Extension**: Unified blocking across both desktop and web browsing
- **Firm, Calm UX**: Decisive controls with visual clarity—no noisy gamification or guilt-heavy UI

## Tech Stack

- **Desktop**: [Tauri](https://tauri.app/) (Rust backend, React/TypeScript frontend)
- **Backend**: Rust with [Tokio](https://tokio.rs/) async runtime
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Chrome Extension**: Manifest V3, React + TypeScript
- **Database**: SQLite via [rusqlite](https://github.com/rusqlite/rusqlite)
- **IPC**: Cross-platform inter-process communication layer
- **Build Tools**: Cargo (Rust), npm/pnpm (Node.js)

## Project Structure

```
.
├── apps/
│   ├── desktop/              # Desktop application (Tauri)
│   │   ├── src/              # React + TypeScript UI
│   │   ├── src-tauri/        # Tauri Rust backend
│   │   └── package.json      # Desktop dependencies
│   └── extension/            # Chrome extension
│       ├── src/              # Extension UI (React)
│       ├── public/           # Extension manifest & assets
│       ├── vite.config.ts    # Popup build config
│       ├── vite.config.bg.ts # Service worker build config
│       └── package.json      # Extension dependencies
│
├── crates/                   # Rust libraries (workspace members)
│   ├── focus-core/           # Core blocking logic & domain models
│   ├── focus-store/          # SQLite data layer & persistence
│   └── focus-ipc/            # Inter-process communication layer
│
├── service/                  # Background service
│   └── focus-service/        # System service for blocking enforcement
│
├── Cargo.toml               # Rust workspace root
├── Cargo.lock               # Cargo lock file
└── README.md               # This file
```

## Getting Started

### Prerequisites

- **Rust**: [Install Rust](https://rustup.rs/) (1.70+)
- **Node.js**: Version 18+ with npm or pnpm
- **For Desktop**: Tauri CLI, WebView2 (Windows), or system webview (macOS/Linux)
- **For Extension**: Chrome/Chromium browser

### Desktop App Development

1. **Install dependencies**:
   ```bash
   # Install Node.js dependencies
   npm install
   cd apps/desktop && npm install
   ```

2. **Build Rust backend** (automatic via Tauri, but you can also):
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

### Chrome Extension Development

1. **Install dependencies**:
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

4. **Load extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select `apps/extension/dist` folder

5. **Rebuild after changes**:
   ```bash
   npm run build
   ```

## Development Workflow

### Monorepo Structure

This is a **Rust + Node.js monorepo**. Changes to code should be scoped:

- **Desktop feature**? Modify `apps/desktop/src/` (React) and `apps/desktop/src-tauri/` (Rust backend)
- **Extension feature**? Modify `apps/extension/src/` (React)
- **Shared Rust logic**? Modify `crates/focus-*/` libraries and rebuild
- **System service**? Modify `service/focus-service/`

### Running Tests & Builds

- **Rust workspace**:
  ```bash
  cargo test --workspace
  cargo build --workspace --release
  ```

- **Desktop**:
  ```bash
  cd apps/desktop
  npm run build
  ```

- **Extension**:
  ```bash
  cd apps/extension
  npm run build
  ```

### Unit Tests

Both frontend apps ship a vitest suite runnable locally and in CI:

```bash
cd apps/desktop   # or apps/extension
npm test
```

## Continuous Integration

`.github/workflows/ci.yml` runs on every push and pull request. A change is green only when all three jobs pass:

1. **Rust workspace tests** — `cargo test --workspace`
2. **Desktop build** — `npm ci`, `npm test`, `npm run build` in `apps/desktop`
3. **Extension build** — `npm ci`, `npm test`, `npm run build` in `apps/extension`

A failing test or build marks the commit red.

### Requiring green CI before merge (one-time, owner only)

Branch protection cannot be enabled from CI itself; do this once in GitHub:

**Settings → Branches → Add branch protection rule →**

- Branch name pattern: `main`
- Check **Require a pull request before merging** (optional) and **Require status checks to pass before merging**
- Under status checks, search for and select: `Rust workspace tests`, `Desktop build`, `Extension build`

After that, merges to `main` are impossible while any job is red.

## License

[Apache-2.0 License](LICENSE)
