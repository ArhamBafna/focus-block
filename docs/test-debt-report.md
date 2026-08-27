# Test-Debt Report

Generated 2026-08-25. Companion to `audit-report.md`.

## 1. What was added (implemented)

### New: `apps/extension/background/__tests__/scheduled-stop-suppression.test.ts` (8 assertions-groups)
Covers the largest untested behavioral cluster in shipped code — the scheduled-session lifecycle:
- Manual stop of a scheduled session writes `schedule_suppressed_until` = wall-clock end, archives `stopped`, clears challenge + rules, and the suppression gate keeps the still-valid window from re-blocking on next reconcile.
- Stop past the window end falls back to remaining planned duration.
- Pending challenge cleared on scheduled stop.
- Stale suppression is cleared and the schedule activates (asserts session fields, snapshot capture, DNR rules installed, expiry alarm pinned to live boundary).
- Future suppression is never clobbered by repeated reconcile passes.
- Schedule window superseding a running manual session: manual archived `stopped`, scheduled session started with correct id/started_at/planned_duration/snapshot.

### New: `apps/extension/popup/lib/__tests__/schedule-crud.test.ts` (13 assertions-groups)
Covers zero-test `validateSchedule` surface through public API:
- Valid create normalizes days (dedupe+sort), stores record.
- Rejection arms: invalid start/end time, start>=end, empty days, malformed end date, past end date, overlap error message — each asserting nothing was stored.
- Touching windows on disjoint days allowed.
- Update replaces fields; self-exclusion lets a schedule overlap its own old shape while other schedules' overlaps still reject; vanished id errors ("Schedule no longer exists.").
- Delete removes match; unknown id silently succeeds.

### Fixed broken pre-existing tests (test-only edits, no production code)
Desktop suite had 3 deterministically failing tests before this pass:
1. `src/lib/ipc.parity.test.ts` — chrome mock lacked `runtime.sendMessage` + `getManifest`; extension `getStatus()` now pings background (`session:expire`) before reading, so envelope degraded to unavailable. Mock extended.
2-3. `src/pages/Home.test.tsx` — expected removed UI copy ("Ready to Focus", "Locked Down" button); product moved to wisprflow-style lowercase ("ready to focus?", buttons "focus"/"lockdown"). Matchers updated to current shipped copy (case-insensitive).

## 2. Flaky-test hunt

| Suite | Runs | Result |
|---|---|---|
| extension vitest | 5 | all green, 82/82 each, duration stable (~10.3-11.3 s wall, ~0.5 s test time) |
| desktop vitest | 6 | 3 failing runs were deterministic (stale expectations, see above); after fix: green every run |
| `cargo test --workspace` | n/a | cannot run on this machine |

**No flaky tests found** in JS suites. Timezone-sensitive note: `schedule.test.ts` DST spring-forward case self-skips on non-DST timezones — not flaky, but coverage depends on machine locale; CI machines may silently skip it.

### Rust suite blocked by environment, not repo
```
error: ...target\debug\deps\serde_derive-....dll: LoadLibraryExW failed:
An Application Control policy has blocked this file. (os error 4551)
```
Windows App Control (WDAC) blocks freshly compiled proc-macro DLLs, so `cargo test` can't build locally. A stale/corrupt `target/` masked this until cache cleanup. **Needs human/admin decision:** add WDAC exemption for `%USERPROFILE%\.cargo` + project `target\`, or rely on CI (`rust-tests` job in `.github/workflows/ci.yml`).

## 3. Ready-to-drop tests for known bugs (add AFTER fixing, else suite goes red)

From audit findings — paste into place when the fix lands:

```ts
// H1 — append to popup/lib/__tests__/ipc.test.ts, blocklist describe:
it("rejects punctuation-only catch-all entries", async () => {
  await expect(ipc.addBlocklist("*.")).rejects.toThrow(/Invalid site/);
  await expect(ipc.addBlocklist(".")).rejects.toThrow(/Invalid site/);
  expect(mock.data.get("blocklist")).toBeUndefined();
});
```

```ts
// M1 — append to background/__tests__/scheduled-stop-suppression.test.ts:
it("clears a pending challenge when the session expires on its own", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 24, 10, 0));
  rawSet("active_session", { /* seedScheduledSession shape */ });
  rawSet("active_challenge", { type: "typing", status: "pending" });
  await sw.expireSession();
  expect(rawGet("active_challenge")).toBeNull();
});
```

```ts
// L1 — extend session-brain.test.ts stray describe:
it("archives a stray cancelled record instead of discarding it", async () => {
  const live = rawGet<ActiveSessionRecord>("active_session");
  rawSet("active_session", { ...live, status: "cancelled", ended_at: "2026-08-22T10:00:00.000Z" });
  await sw.requestReconcile();
  const history = rawGet<ArchivedSessionRecord[]>("history") ?? [];
  expect(history[0].status).toBe("cancelled");
});
```

## 4. Still uncovered, ranked by blast radius

1. **`service/focus-service/src/session_manager.rs` — 0 tests, entire OS-level enforcement brain** (crash-recovery matrix L18-60, enforce-failure rollback L321-329, half-stopped divergence L359-363, app-target sync rollback L381-409). Wrong = apps never blocked or never unblocked. Blocked on: module hardwires real store+WFP; needs trait seam first — source refactor, so out of scope for guaranteed-safe pass.
2. Extension `handleBackgroundMessage` + listener wiring (L785-862): unknown-type arm, duration coercion, onChanged relevance filter, three-way alarm dispatch. Typo here kills auto-unblock silently. Needs chrome-mock listener-capture upgrade.
3. `migrateStrayActiveSession` edges: `status:"cancelled"` discard (L1 bug above), partial-record defaulting, shape-check false negatives dropping LIVE sessions.
4. Popup `getStatus` negative-time/clock-skew clamps; temp-allow prune/write-back; settings DEFAULTS merge.
5. Desktop: mock path covers ~5 of ~18 commands; app-target trio absent from bridge table; desktop `normalizeDomain` untested and parity-unverified (drift documented in audit H6).
6. Rust secondary: `remaining_sec`/`is_expired`, `IpcRequest` decode, `get_active_session` positive path, `list_history(limit)`, all of focus-ipc framing.

## 5. Duplicate / mergeable tests (prompt 4 answer)

**No true duplicates found; nothing safely deletable.**
- Near-overlaps are deliberate cross-layer checks, not dupes: `isValidStoredDomain` table in `rules.test.ts` (worker copy) vs metacharacter rejection in `ipc.test.ts` (popup copy) pin two *independent copies* that must stay in sync — merging them would hide drift (see audit H6).
- `computeScheduleSuppression` unit cases (schedule.test.ts) vs new integration tests cover different layers (pure math vs storage wiring); both kept.
- Real reduction opportunity is structural, not test-deletion: collapse the duplicated validator copies into one shared module, then merge those two test files into one corpus-driven file. Recorded as architecture follow-up.

## 6. Final suite state

See chat output of final run. Extension 82/82, desktop 70/70, both green. Rust requires environment fix (above).
