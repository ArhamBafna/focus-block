# Open questions gathered while fixing issues #3–#15

You were away; every decision below was made autonomously so the work could land. All 13 issues are closed with one commit each. Review these when back — nothing is blocking, but some choices deserve your sign-off.

## Questions

1. **#3 — Popup session ops now go through the service worker.** `startSession`/`stopSession`/expiry moved from direct `chrome.storage` writes to `chrome.runtime.sendMessage` handled under a background mutation lock (this is what kills the lost-update races). OK that popup no longer writes session state directly? Alternative was a storage-based lock, which is unreliable across contexts.

2. **#4/#6 — Corrupt UUIDs are now LOUD errors, not silent regeneration.** A preset/session row with an unparseable id makes `list_presets`/session reads fail instead of inventing a random id (which silently rewired references). Acceptable that one corrupt row can fail a whole list read? Fallback policy otherwise: corrupt mode → blocklist, corrupt status → stopped, corrupt JSON list → empty (all documented in `crates/focus-store/src/codec.rs`). Want different fallbacks?

3. **#6 — Corrupt session status falls back to `stopped`, not `active`.** Old code fell back to Active, which let dead rows resurrect as live sessions. Stopped keeps history visible but never re-activates anything. Confirm intent.

4. **#12 — Home duration picker replaced `window.prompt`.** Global rule bans native dialogs; the Start flow is now an inline "Duration [input] minutes" field defaulting to 25. Fine, or do you want presets/chips there instead?

5. **#13 — Desktop ipc signatures extended, not broken.** Existing methods still throw (errors now carry `.kind = "app" | "unavailable"`); new `getStatusSafe()` returns the raw envelope for polling. Extension `ipc.ts` did NOT get a matching `getStatusSafe` yet — wanted? (Signature parity rule says the two ipc layers should mirror.)

6. **#15 — Shutdown budget is 8s.** Session finalization during service stop gives up after 8s and proceeds to STOPPED. SCM wait hint set to 10s. Reasonable numbers for your deployment?

7. **Extension background still mirrors types by hand** (`service-worker.ts` duplicates the record shapes because it's a separate vite bundle and didn't import `popup/lib/storage`). #11 only covered the two popup modules. Want the worker to import from `lib/storage.ts` too?

8. **No automated tests exist for extension/desktop frontend code.** I verified via `tsc` + vite builds only. Want me to add vitest + tests for ipc/background logic next?

## Environment note

`cargo test --workspace` fails on the `desktop` bin test harness with Windows Application Control block (os error 4551) — pre-existing machine policy, not code. Library tests (21 total) pass.

## Commits

| Issue | Commit |
|-------|--------|
| #3 | 8c2718f |
| #4 | 975d46a |
| #5 | 15d7e0d |
| #6 | fdf354c |
| #7 | ae138e6 |
| #8 | 21df39d |
| #9 | 08e79f7 |
| #10 | cf25f60 |
| #11 | 7765e91 |
| #14 | 39955dd |
| #12 | c850974 |
| #13 | 6d83f5d |
| #15 | 29a909b |
