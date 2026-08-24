# Chrome Web Store Submission — Focus Blocker

Everything needed to fill the Chrome Developer Dashboard in one sitting.
Package the upload zip, copy-paste the fields below, submit.

---

## 0. First-time setup (one time only)

1. **Register a developer account:** https://chrome.google.com/webstore/devconsole
   (sign in with the Google account that should own the listing).
2. **Pay the one-time registration fee:** $5.00 USD, prompted on first publish.
3. **Verify a contact email** when prompted (used by CWS for review contact).
4. **Host the privacy policy on GitHub Pages** (required for the dashboard's
   privacy policy URL field):
   - Repo → Settings → Pages → Source: `main` branch, `/docs` folder.
   - `docs/privacy.md` then renders at:
     **https://arhambafna.github.io/focus-block/privacy**
   - Confirm the URL loads before submitting (GitHub Pages can take a minute
     on first enable).

## 1. Package the upload

```powershell
cd apps/extension
npm run build
npm run package
```

Output: `apps/extension/releases/focus-blocker-v0.2.0.zip` — manifest at the
zip root, runtime files only (popup, background, blocked page, icons, fonts).
Upload exactly this artifact.

## 2. Store listing

| Field | Value |
|-------|-------|
| **Name** | Focus Blocker: Block Distracting Sites |
| **Category** | Productivity |
| **Language** | English |

**Short description (132 chars max):**

> Block distracting websites on demand or on a schedule. Lockdown mode, stop challenges, session history. 100% on-device.

**Detailed description:**

> Focus Blocker helps you protect your attention. Pick the sites that pull you
> away, start a session, and they stay out of reach until you're done.
>
> HOW IT WORKS
> • Add sites to your blocklist — exact domains or simple wildcards.
> • Start a focus session for a set number of minutes.
> • Blocked sites redirect to a calm reminder page while the session runs.
> • End the session when your time is up, and everything unlocks.
>
> HIGHLIGHTS
> • Lockdown mode — block everything except the sites you allow.
> • Schedules — recurring blocking windows for your work hours, with per-weekday
>   control and optional end dates.
> • Temporary allows — grant yourself a short, expiring exception without
>   breaking the session.
> • Stop challenges — a countdown, a typing exercise, a memory puzzle, math, or
>   a reflection prompt before an early stop, so ending is a decision, not a
>   reflex.
> • Session history — see what you actually followed through on.
>
> PRIVATE BY DESIGN
> No account. No servers. No analytics. Your lists, schedules, and history
> never leave your browser. Uninstalling removes everything.
>
> Focus Blocker is free and open source.

## 3. Single purpose

> Focus Blocker blocks the websites the user has chosen to block, during the
> focus sessions or scheduled windows the user has configured, by redirecting
> those sites until the session ends.

## 4. Permission justifications

**`declarativeNetRequest`** —
> This permission powers the core feature. When the user starts a focus
> session (or a scheduled window begins), the extension installs network-level
> rules that redirect requests to the user's own blocklisted sites to an
> extension-owned "site blocked" page. When the session ends, the rules are
> removed. Rules are derived exclusively from the user's own lists; the
> extension never observes or records network traffic.

**Host permissions (`<all_urls>`)** —
> The user can blocklist any site they choose, so blocking rules must be able
> to apply to arbitrary sites. The permission is used only to evaluate and
> redirect requests to blocklisted domains during an active session. The
> extension does not read page content, does not inject scripts into pages,
> and does not monitor browsing activity.

**`storage`** —
> Stores the user's blocklist, allowlist, schedules, session history, and
> settings locally on the device via chrome.storage.local. Nothing is synced
> or transmitted.

**`alarms`** —
> Wakes the extension's service worker to end focus sessions and activate or
> deactivate scheduled blocking windows at their configured times, including
> after the browser restarts.

**Web-accessible resources (`blocked/index.html`)** —
> The "site blocked" page that blocked requests are redirected to must be
> loadable from any page the user may block. It is a static page owned by the
> extension and contains no user data.

## 5. Privacy tab (dashboard)

| Field | Value |
|-------|-------|
| Privacy policy URL | https://arhambafna.github.io/focus-block/privacy |
| Does the item handle personal/sensitive user data? | **No** |
| Data usage disclosures | None — all data stays on device |
| Single purpose | See section 3 |

## 6. Version history entry (0.2.0)

> First public release.
>
> • Blocklist and allowlist with wildcard support
> • Timed focus sessions and lockdown mode
> • Recurring schedules with per-weekday control and end dates
> • Temporary time-boxed allows
> • Stop challenges (countdown, typing, pattern, math, reflection)
> • Session history
> • All data stored on-device; no accounts, no analytics

## 7. Distribution

- Visibility: **Public**.
- Regions: all.
- Pricing: free.

## 8. Submission checklist

- [ ] `npm run build && npm run package` in `apps/extension` — zip fresh
- [ ] Zip contains `manifest.json` at root (packaging script guarantees this)
- [ ] Version in manifest bumped for every resubmission
- [ ] Privacy policy URL loads (GitHub Pages enabled on `/docs`)
- [ ] Store icons: 128×128 uploaded (from `apps/extension/icons/icon128.png`)
- [ ] Screenshots: 1280×800 PNGs uploaded (see `apps/extension/store-assets/`)
- [ ] Listing copy pasted, category Productivity
- [ ] Privacy tab: "No" to personal data handling, justifications pasted
- [ ] Submit for review; first review typically 1–3 business days

## 9. After submission

- Review feedback arrives by email and in the dashboard **Item status** panel.
- If rejected, the reviewer message names the policy section; fix, bump the
  version, repackage, resubmit.
- Rejections most commonly cite permission justifications — keep section 4
  answers specific and copy them verbatim.
