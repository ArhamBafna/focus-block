# Chrome Web Store Listing — Focus Blocker

> Last Updated: 2026-07-21

## Store Listing

**Extension Name**

Focus Blocker

**Short Description**

Block distracting sites, schedule focus time, and use Lockdown directly in Chrome.

**Detailed Description**

Focus Blocker helps you protect focused time in Chrome without needing a desktop app or an account.

Create a Block list for sites you want to avoid, or use Lockdown to allow only sites you choose. Start timed sessions, create recurring schedules, add temporary exceptions, and review your session history.

Install, add your sites, and start a Focus or Lockdown session. Your lists, schedules, settings, and history stay on your device. If you later install FocusBlock desktop, its permanent Block and Allow lists can merge automatically with this extension; browser sessions still stay browser-only.

Focus Blocker does not use analytics, accounts, or remote servers.

**Category**

Productivity

**Single Purpose**

Blocks distracting websites during user-started or scheduled Focus and Lockdown sessions.

**Primary Language**

English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---:|---|---|
| Store Icon | 128x128 PNG | Ready | `icons/icon128.png` |
| Screenshot 1 | 1280x800 or 640x400 | Needs update | Focus session blocking a selected site |
| Screenshot 2 | 1280x800 or 640x400 | Needs update | Lockdown allow list and timer |
| Screenshot 3 | 1280x800 or 640x400 | Needs update | Schedule editor |

### Screenshot Notes

Show browser-only setup first. Do not show desktop-app setup or describe desktop pairing as required.

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `declarativeNetRequest` | permissions | Applies the user’s active Focus or Lockdown rules to Chrome requests. |
| `storage` | permissions | Saves the user’s lists, sessions, schedules, temporary allows, history, and settings on their device. |
| `alarms` | permissions | Ends timed sessions and temporary allows, and starts or stops scheduled sessions while the popup is closed. |
| `nativeMessaging` | permissions | Optional local-only integration with FocusBlock desktop for users who install both products. The extension works fully when no native app exists. |
| `<all_urls>` | host permissions | Lets a user-created Focus or Lockdown rule apply to websites they visit, regardless of domain. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No. User-created rules and session data stay on-device. When the optional desktop integration is installed, permanent Block and Allow entries are exchanged only with that local desktop service.

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**

Required before submission: publish a public policy URL stating that Focus Blocker stores user data locally and uses no analytics or remote server. Do not submit with this placeholder.

## Distribution

**Visibility**: Public

**Regions**: All regions

## Developer Info

**Publisher Name**

Required before submission.

**Contact Email**

Required before submission.

**Support URL / Email**

Required before submission.

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 0.1.0 | 2026-07-21 | Browser-first Focus, Lockdown, schedules, temporary allows, history, and optional local desktop list mirror. | Draft |

## Review Notes

### Known Issues / Limitations

- Blocking applies while an extension session, schedule, or mirrored desktop session is active. It does not block websites when Chrome is closed.
- Before a public desktop release, package `service/focus-service/install/focusblock-web-store-extension-id.txt` with the permanent Chrome Web Store extension ID. Chrome native messaging requires one exact extension origin; wildcard origins are not allowed.
