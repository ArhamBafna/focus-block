# Focus Blocker Chrome Extension — Build & Testing Guide

## Prerequisites

- Node.js 18+
- npm 9+
- Google Chrome 116+ (`minimum_chrome_version` in the manifest)

---

## Build Instructions

### 1. Navigate to the extension directory

```powershell
cd apps/extension
```

### 2. Install dependencies

```powershell
npm install
```

### 3. Build the extension

```powershell
npm run build
```

This runs three steps in sequence:

| Step | Script | Command | Output |
|------|--------|---------|--------|
| 1. Popup build | `build:popup` | `tsc --noEmit` + `vite build --config vite.config.ts` | `dist/popup/` |
| 2. Service worker build | `build:bg` | `vite build --config vite.config.bg.ts` | `dist/background/service-worker.js` |
| 3. Assemble | `assemble` | `node scripts/assemble.js` | Copies `manifest.json`, `blocked/`, `icons/` into `dist/` |

Final output: **`apps/extension/dist/`** — this folder is a complete Chrome extension.

Icons live in `apps/extension/icons/` and ship with the repo. To regenerate them
programmatically: `npm install canvas`, then `node scripts/generate-icons.js`.

### 4. Run the unit tests

```powershell
npm test
```

Vitest suites cover the background session brain, DNR rule building, and the
popup ipc/storage layers. CI (`.github/workflows/ci.yml`) runs this on every push.

For a rebuild-on-save loop:

```powershell
npm run dev
```

---

## Loading in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `apps/extension/dist/` folder
5. Focus Blocker appears in your extensions list
6. Click the puzzle icon in the Chrome toolbar and pin Focus Blocker

---

## Testing Instructions

### Basic smoke test

| Step | Expected result |
|------|-----------------|
| Click the extension icon | Popup opens (380px wide) |
| Navigate the top tabs (Focus / Block / Allow / Schedule / History / Settings) | Views switch correctly |
| Settings → **Privacy** link | Privacy screen renders, back link returns to Settings |
| Data persists after closing/reopening popup | Yes (stored in chrome.storage.local) |

### Blocking test (core feature)

1. Open popup → **Block** tab
2. Add `reddit.com` to the blocklist (malformed entries like `*foo(bar` are rejected inline)
3. Go to **Focus** tab → click **focus** → enter minutes → **Start**
4. Navigate to `https://reddit.com` in any Chrome tab
5. **Expected:** See the blocked page instead of Reddit
6. Try `https://www.reddit.com` — also blocked
7. Navigate to any non-blocked site → loads normally
8. Return to popup → click **Stop Session**
9. Navigate to `reddit.com` again → loads normally

### Lockdown test

Same as above but start with the **lockdown** button: every site redirects except
domains on the **Allow** list and extension pages.

### Schedule test

1. Open popup → **Schedule** tab
2. Create a schedule covering the current time window on today's weekday
3. The service worker activates a scheduled session at the next boundary alarm;
   blocking applies until the end time
4. Delete the schedule mid-session → blocking clears at the next reconcile

### Persistence test

1. Add several domains, start a session
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
      service worker reconciles state under its mutation lock
        chrome.declarativeNetRequest.updateDynamicRules
          Chrome blocks matching requests at network level
```

Session lifecycle mutations (start/stop/expire) travel as runtime messages so
they serialize inside the worker's mutation lock instead of racing storage.

### Storage keys (chrome.storage.local)

| Key | Type | Description |
|-----|------|-------------|
| `blocklist` | `{id, domain}[]` | User's block list |
| `whitelist` | `{id, domain}[]` | User's allow list |
| `temporary_allowlist` | `{id, domain, expires_at}[]` | Time-boxed allow entries |
| `schedules` | `Schedule[]` | Recurring blocking windows |
| `active_session` | `ActiveSessionRecord \| null` | Currently running session |
| `history` | `ArchivedSessionRecord[]` | Past sessions |
| `schedule_suppressed_until` | `number \| null` | Timestamp until schedules stay off after an early stop |
| `active_challenge` | `{type, status} \| null` | Stop-challenge gate in progress |
| `settings` | `{stop_challenge, challenge_countdown_duration, challenge_countdown_breathing}` | App settings |

---

## Adding More Browsers (Future)

- **Firefox**: Supports MV3 + declarativeNetRequest. Needs a separate manifest with `browser_specific_settings`. All React popup and service worker code is identical.
- **Safari**: Requires Xcode + `safari-web-extension-converter`. Same source code.
- Architecture: add `manifests/firefox.json`, `manifests/safari.json` and a build flag.
