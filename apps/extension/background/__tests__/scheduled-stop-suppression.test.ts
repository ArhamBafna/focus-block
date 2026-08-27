/**
 * Scheduled-session lifecycle integration tests: the manual-stop suppression
 * arm of stopSessionLocked, the suppression gate inside applyBlockingState,
 * and the supersede path that archives a running manual session when a
 * schedule window opens.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock, type ChromeMockHandles } from "./chrome-mock";
import type { ActiveSessionRecord, ArchivedSessionRecord, Schedule } from "../service-worker";

let mock: ChromeMockHandles;
let sw: typeof import("../service-worker");

beforeEach(async () => {
  vi.resetModules();
  mock = installChromeMock();
  sw = await import("../service-worker");
});

function rawSet(key: string, value: unknown): void {
  mock.data.set(key, value);
}

function rawGet<T>(key: string): T | undefined {
  return mock.data.get(key) as T | undefined;
}

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "sched-1",
    start_time: "09:00",
    end_time: "12:00",
    mode: "blocklist",
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    ends_on: null,
    ...overrides,
  };
}

function seedScheduledSession(scheduleId: string, overrides: Partial<ActiveSessionRecord> = {}): void {
  rawSet("active_session", {
    id: "session-1",
    preset_id: null,
    mode: "blocklist",
    started_at: new Date().toISOString(),
    planned_duration_sec: 60 * 60,
    status: "active",
    ended_at: null,
    blocklist_snapshot: ["news.com"],
    whitelist_snapshot: [],
    scheduled_schedule_id: scheduleId,
    ...overrides,
  });
}

function history(): ArchivedSessionRecord[] {
  return rawGet<ArchivedSessionRecord[]>("history") ?? [];
}

describe("manual stop of a scheduled session", () => {
  it("suppresses until the wall-clock end and keeps the schedule inactive", async () => {
    vi.useFakeTimers();
    // Monday 2026-08-24, 10:00 — inside the 09:00–12:00 window.
    vi.setSystemTime(new Date(2026, 7, 24, 10, 0));

    rawSet("schedules", [makeSchedule()]);
    seedScheduledSession("sched-1");
    await sw.requestReconcile();
    expect(mock.dnrRules.length).toBeGreaterThan(0);

    await sw.stopSessionLocked();

    const archived = history();
    expect(archived).toHaveLength(1);
    expect(archived[0].status).toBe("stopped");
    expect(rawGet("active_session")).toBeNull();
    expect(mock.dnrRules).toHaveLength(0);
    expect(rawGet("active_challenge")).toBeNull();

    const suppressedUntil = rawGet<number>("schedule_suppressed_until");
    expect(suppressedUntil).toBe(new Date(2026, 7, 24, 12, 0).getTime());

    // The suppression gate must keep the still-valid window from re-blocking.
    await sw.applyBlockingState();
    expect(rawGet("active_session")).toBeNull();
    expect(mock.dnrRules).toHaveLength(0);
  });

  it("falls back to the remaining duration when the end already passed", async () => {
    vi.useFakeTimers();
    // Stop at 13:00, past the 12:00 end; suppression lasts the remaining
    // planned duration instead of clamping to a boundary in the past.
    vi.setSystemTime(new Date(2026, 7, 24, 13, 0));

    rawSet("schedules", [makeSchedule()]);
    seedScheduledSession("sched-1");

    await sw.stopSessionLocked();

    const suppressedUntil = rawGet<number>("schedule_suppressed_until");
    const now = new Date(2026, 7, 24, 13, 0).getTime();
    expect(suppressedUntil).toBe(now + 60 * 60 * 1000);
  });

  it("clears a pending challenge when a scheduled session stops", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 10, 0));

    rawSet("schedules", [makeSchedule()]);
    seedScheduledSession("sched-1");
    rawSet("active_challenge", { type: "typing", status: "pending" });

    await sw.stopSessionLocked();

    expect(rawGet("active_challenge")).toBeNull();
  });
});

describe("suppression gate in applyBlockingState", () => {
  it("activates the schedule once stored suppression goes stale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 10, 0));

    rawSet("schedules", [makeSchedule()]);
    rawSet("schedule_suppressed_until", new Date(2026, 7, 24, 8, 0).getTime());
    rawSet("blocklist", [{ id: 1, domain: "news.com" }]);

    await sw.applyBlockingState();

    const active = rawGet<ActiveSessionRecord>("active_session");
    expect(active).not.toBeNull();
    expect(active?.scheduled_schedule_id).toBe("sched-1");
    expect(active?.planned_duration_sec).toBe(2 * 60 * 60);
    expect(rawGet("schedule_suppressed_until")).toBeNull();
    expect(mock.dnrRules.length).toBeGreaterThan(0);

    // Expiry alarm tracks the live schedule boundary (12:00).
    const expiryAlarms = mock.createdAlarms.filter((a) => a.name === "focus_session_expiry");
    expect(expiryAlarms.length).toBeGreaterThan(0);
    const lastWhen = (expiryAlarms[expiryAlarms.length - 1].info as { when: number }).when;
    expect(lastWhen).toBe(new Date(2026, 7, 24, 12, 0).getTime());
  });

  it("does not clear future suppression on every pass", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 10, 0));

    const futureSuppression = new Date(2026, 7, 24, 23, 0).getTime();
    rawSet("schedules", [makeSchedule()]);
    rawSet("schedule_suppressed_until", futureSuppression);

    await sw.applyBlockingState();
    await sw.applyBlockingState();

    expect(rawGet("schedule_suppressed_until")).toBe(futureSuppression);
    expect(rawGet("active_session") ?? null).toBeNull();
  });
});

describe("schedule window supersedes a running manual session", () => {
  it("archives the manual session as stopped and starts the scheduled session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 10, 0));

    rawSet("blocklist", [{ id: 1, domain: "news.com" }]);
    await sw.startSessionLocked("lockdown", 60);
    const manualId = rawGet<ActiveSessionRecord>("active_session")?.id;
    expect(manualId).toBeDefined();

    rawSet("schedules", [makeSchedule()]);
    await sw.applyBlockingState();

    const active = rawGet<ActiveSessionRecord>("active_session");
    expect(active?.id).not.toBe(manualId);
    expect(active?.scheduled_schedule_id).toBe("sched-1");
    expect(active?.mode).toBe("blocklist");
    expect(active?.started_at).toBe(new Date(2026, 7, 24, 10, 0).toISOString());
    expect(active?.planned_duration_sec).toBe(2 * 60 * 60);
    expect(active?.blocklist_snapshot).toEqual(["news.com"]);

    const archived = history();
    expect(archived).toHaveLength(1);
    expect(archived[0].id).toBe(manualId);
    expect(archived[0].status).toBe("stopped");

    // Rules reflect the new session's mode (blocklist, not lockdown).
    expect(mock.dnrRules.length).toBeGreaterThan(0);
  });
});
