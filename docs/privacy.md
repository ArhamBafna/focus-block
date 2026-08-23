# Focus Blocker — Privacy Policy

_Last updated: August 23, 2026_

This policy covers the Focus Blocker browser extension. The same substance is
shown inside the extension on its **Privacy** screen (Settings → Privacy).

**Public URL for the Chrome Web Store dashboard:**
`https://arhambafna.github.io/focus-block/privacy`

## Summary

Focus Blocker has **no servers, no accounts, and no analytics**. Everything the
extension records stays inside your browser on your device. Nothing is
collected, transmitted, sold, or shared — ever.

## What we collect

**Nothing.** The extension does not collect personal data, browsing history,
page contents, or usage statistics. There is no remote endpoint to send data to.

## What stays on your device

The extension saves your settings locally using your browser's built-in
storage (`chrome.storage.local`). This never leaves your device:

- **Blocklist and allow list** — the sites you choose to block or allow.
- **Temporary allows** — time-boxed exceptions you create.
- **Schedules** — the blocking windows you configure.
- **Session history** — start/stop times of your own focus sessions.
- **Settings** — your stop-challenge preferences.

## How the permissions are used

- **Block sites (declarativeNetRequest + host permissions):** the network-level
  rules that redirect blocked sites while a session runs. This is the core
  feature; it operates entirely inside your browser.
- **Storage:** keeps the lists and settings above on your device.
- **Alarms:** ends sessions and activates schedules at the right time.

The extension does not read page contents, does not inject scripts into pages,
and does not monitor activity outside of enforcing your own block rules.

## Sharing

We do not share, sell, rent, or transfer any data. There is no third party to
share it with.

## Retention

Your data is kept only until you remove it:

- Clear session history anytime from the **History** tab.
- Remove individual sites from the **Block** / **Allow** tabs.
- Delete schedules from the **Schedule** tab.

## Deletion

Uninstalling the extension removes **all** stored data permanently. There is
nothing left on any server, because there are no servers.

## Changes

Material changes to this policy will be reflected in the extension's release
notes and on this page with a new "last updated" date.

## Contact

Questions or concerns? Open an issue at
[github.com/ArhamBafna/focus-block/issues](https://github.com/ArhamBafna/focus-block/issues).
