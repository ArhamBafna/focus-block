# FocusBlock Chrome Extension — Build & Testing Guide

## Prerequisites

- Node.js 18+
- npm 9+
- Google Chrome (any recent version)

---

## Build Instructions

### 1. Navigate to the extension directory

```powershell
cd apps/extension
```

### 2. Install dependencies

```powershell
npm.cmd install
```

### 3. Build the extension

```powershell
npm.cmd run build
```

This runs three steps in sequence:

| Step | Command | Output |
|------|---------|--------|
| 1. Popup build | `vite build --config vite.config.ts` | `dist/popup/` |
| 2. Service worker build | `vite build --config vite.config.bg.ts` | `dist/background/service-worker.js` |
| 3. Assemble | `node scripts/assemble.js` | Copies `manifest.json`, `blocked/`, `icons/` into `dist/` |

Final output: **`apps/extension/dist/`** — this folder is a complete Chrome extension.

> Before loading, you need icons. Either:
> - **Option A (recommended):** Place your own `icon16.png`, `icon48.png`, `icon128.png` in `apps/extension/icons/`
> - **Option B:** Create them programmatically — `npm install canvas` then `node scripts/generate-icons.js`

---

## Loading in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `apps/extension/dist/` folder
5. The Focus Blocker extension appears in your extensions list
6. Click the puzzle icon in Chrome toolbar → pin Focus Blocker for easy access

---

## Testing Instructions

### Basic smoke test

| Step | Expected result |
|------|-----------------|
| Click the extension icon | Popup opens (380px wide) |
| Navigate between tabs (Focus/Block/Allow/Schedule/History/Settings) | Views switch correctly |
| Data persists after closing/reopening popup | Yes (stored in chrome.storage.local) |

### Blocking test (core feature)

1. Open popup → click **Block** tab
2. Add `reddit.com` to the blocklist
3. Click **Focus** tab → click **Start 25m Focus**
4. Navigate to `https://reddit.com` in any Chrome tab
5. **Expected:** See the "Site Blocked" page instead of Reddit
6. Try `https://www.reddit.com` — also blocked
7. Navigate to any non-blocked site → loads normally
8. Return to popup → click **Stop Session**
9. Navigate to `reddit.com` again → loads normally

### Persistence test

1. Add several domains, create a preset, start a session
2. Close Chrome entirely and reopen it
3. Open popup — all data is still there
4. If a session was active: service worker re-reads state and reapplies rules on startup

---

## Debugging

### Check service worker logs

1. Go to `chrome://extensions`
2. Find Focus Blocker → click **Service Worker** link
3. DevTools opens for the service worker — check Console for `[FocusBlocker]` logs

### Inspect storage

In the service worker DevTools console:

```js
chrome.storage.local.get(null, console.log)
```

### Check active DNR rules

In the service worker DevTools console:

```js
chrome.declarativeNetRequest.getDynamicRules(rules => console.log(rules))
```

---

## Architecture Notes

### Data flow

```
Popup (React UI)
  writes to chrome.storage.local via ipc.ts
    chrome.storage.onChanged fires in service worker
      service worker calls chrome.declarativeNetRequest.updateDynamicRules
        Chrome blocks matching requests at network level
```

The desktop app is optional. When its local native bridge is installed, the
extension automatically merges permanent Block and Allow entries and mirrors
desktop-started browser protection. Extension-started sessions never start a
desktop session.

### Storage keys (chrome.storage.local)

| Key | Type | Description |
|-----|------|-------------|
| `blocklist` | `{id, domain}[]` | User's block list |
| `whitelist` | `{id, domain}[]` | User's allow list |
| `presets` | `Preset[]` | Saved session configs |
| `active_session` | `Session or null` | Currently running session |
| `history` | `Session[]` | Past sessions |
| `settings` | `{os_allowlist_enabled}` | App settings |

---

## Adding More Browsers (Future)

- **Firefox**: Supports MV3 + declarativeNetRequest. Needs a separate manifest with `browser_specific_settings`. All React popup and service worker code is identical.
- **Safari**: Requires Xcode + `safari-web-extension-converter`. Same source code.
- Architecture: add `manifests/firefox.json`, `manifests/safari.json` and a build flag.
