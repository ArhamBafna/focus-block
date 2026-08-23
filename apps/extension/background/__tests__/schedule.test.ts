/**
 * Schedule correctness tests (issue #25): time-boundary logic, next-alarm
 * scheduling, suppress-until DST stability, and mid-session schedule
 * deletion labelling a session cancelled instead of completed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock, type ChromeMockHandles } from "./chrome-mock";
import type { ActiveSessionRecord, ArchivedSessionRecord } from "../service-worker";

let mock: ChromeMockHandles;
let sw: typeof import("../service-worker");

beforeEach(async () => {
  vi.resetModules();
  mock = installChromeMock();
  sw = await import("../service-worker");
});

afterEach(() => {
  vi.useRealTimers();
});

function rawSet(key: string, value: unknown): void {
  mock.data.set(key, value);
}

function makeSchedule(overrides: Partial<import("../service-worker").Schedule> = {}) {
  return {
    id: "sched-1",
    start_time: "09:00",
    end_time: "12:00",
    mode: "blocklist" as const,
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

describe("time boundary helpers", () => {
  it("timeToMinutes accepts HH:MM and rejects anything else", () => {
    expect(sw.timeToMinutes("00:00")).toBe(0);
    expect(sw.timeToMinutes("23:59")).toBe(23 * 60 + 59);
    expect(sw.timeToMinutes("9:00")).toBeNull();
    expect(sw.timeToMinutes("24:00")).toBeNull();
    expect(sw.timeToMinutes("12:60")).toBeNull();
    expect(sw.timeToMinutes("")).toBeNull();
  });

  it("scheduleRunsOn respects the weekday filter", () => {
    const weekdayOnly = makeSchedule({ days_of_week: [1, 2, 3, 4, 5] });
    // 2026-08-23 is a Sunday.
    const sunday = new Date(2026, 7, 23);
    const monday = new Date(2026, 7, 24);
    expect(sw.scheduleRunsOn(weekdayOnly, sunday)).toBe(false);
    expect(sw.scheduleRunsOn(weekdayOnly, monday)).toBe(true);
  });

  it("scheduleRunsOn stops after the ends_on date", () => {
    const ending = makeSchedule({ ends_on: "2026-08-24" });
    expect(sw.scheduleRunsOn(ending, new Date(2026, 7, 24))).toBe(true);
    expect(sw.scheduleRunsOn(ending, new Date(2026, 7, 25))).toBe(false);
  });

  it("legacy schedules without days repeat daily", () => {
    const legacy = makeSchedule({ days_of_week: [] });
    for (let day = 0; day < 7; day += 1) {
      expect(sw.scheduleRunsOn(legacy, new Date(2026, 7, 23 + day))).toBe(true);
    }
  });

  it("getCurrentSchedule only matches start <= now < end", () => {
    const schedule = makeSchedule();
    const inside = new Date(2026, 7, 24, 9, 0);
    const laterInside = new Date(2026, 7, 24, 11, 59);
    const atEnd = new Date(2026, 7, 24, 12, 0);
    const before = new Date(2026, 7, 24, 8, 59);

    expect(sw.getCurrentSchedule([schedule], inside)?.id).toBe("sched-1");
    expect(sw.getCurrentSchedule([schedule], laterInside)?.id).toBe("sched-1");
    expect(sw.getCurrentSchedule([schedule], atEnd)).toBeNull();
    expect(sw.getCurrentSchedule([schedule], before)).toBeNull();
  });

  it("getScheduleBoundary maps wall-clock minutes onto the given day", () => {
    const schedule = makeSchedule({ start_time: "09:15", end_time: "17:45" });
    const day = new Date(2026, 7, 24);
    const start = sw.getScheduleBoundary(schedule, "start_time", day);
    const end = sw.getScheduleBoundary(schedule, "end_time", day);
    expect(start?.getHours()).toBe(9);
    expect(start?.getMinutes()).toBe(15);
    expect(end?.getHours()).toBe(17);
    expect(end?.getMinutes()).toBe(45);
  });
});

describe("next boundary alarm", () => {
  it("schedules the nearest future start or end boundary", async () => {
    // Freeze now mid-morning; the 09:00 start is past, 12:00 end is next.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 10, 0));

    rawSet("schedules", [makeSchedule()]);
    await sw.applyBlockingState();

    const boundaryAlarms = mock.createdAlarms.filter((a) => a.name === "focus_schedule_boundary");
    expect(boundaryAlarms).toHaveLength(1);
    const when = (boundaryAlarms[0].info as { when: number }).when;
    expect(when).toBe(new Date(2026, 7, 24, 12, 0).getTime());
  });

  it("skips boundaries on days the schedule does not run", async () => {
    vi.useFakeTimers();
    // Saturday 2026-08-22 23:30; weekday-only schedule next runs Monday 09:00.
    vi.setSystemTime(new Date(2026, 7, 22, 23, 30));

    rawSet("schedules", [makeSchedule({ days_of_week: [1, 2, 3, 4, 5] })]);
    await sw.applyBlockingState();

    const boundaryAlarms = mock.createdAlarms.filter((a) => a.name === "focus_schedule_boundary");
    expect(boundaryAlarms).toHaveLength(1);
    const when = (boundaryAlarms[0].info as { when: number }).when;
    expect(when).toBe(new Date(2026, 7, 24, 9, 0).getTime());
  });
});

describe("suppress-until after a manual stop", () => {
  it("uses the wall-clock end time when it is still ahead", () => {
    const now = new Date(2026, 7, 24, 10, 0);
    const suppressed = sw.computeScheduleSuppression(12 * 60, 30 * 60, now);
    expect(suppressed).toBe(new Date(2026, 7, 24, 12, 0).getTime());
  });

  it("falls back to the remaining duration when the end already passed", () => {
    const now = new Date(2026, 7, 24, 13, 0);
    const suppressed = sw.computeScheduleSuppression(12 * 60, 30 * 60, now);
    expect(suppressed).toBe(now.getTime() + 30 * 60 * 1000);
  });

  it("falls back to the remaining duration without a parsable end time", () => {
    const now = new Date(2026, 7, 24, 10, 0);
    const suppressed = sw.computeScheduleSuppression(null, 15 * 60, now);
    expect(suppressed).toBe(now.getTime() + 15 * 60 * 1000);
  });

  it("stays on the local wall clock across a DST spring-forward", () => {
    // Detect whether the running timezone observes DST at all.
    const jan = new Date(2026, 0, 15).getTimezoneOffset();
    const jul = new Date(2026, 6, 15).getTimezoneOffset();
    if (jan === jul) {
      console.warn("Skipping DST assertion: timezone has no DST.");
      return;
    }

    // 2026-03-08 is the US spring-forward date (2:00 -> 3:00 local).
    // Stopping at 01:30 local with a 02:30 end: that wall time does not
    // exist, so suppression lands on the instant the clock resumes (03:00),
    // which is 30 real minutes after the stop.
    const now = new Date(2026, 2, 8, 1, 30);
    const suppressed = sw.computeScheduleSuppression(2 * 60 + 30, 30 * 60, now);

    expect(suppressed).toBe(new Date(2026, 2, 8, 3, 0).getTime());
    expect(suppressed - now.getTime()).toBe(30 * 60 * 1000);
  });
});

describe("mid-session schedule deletion", () => {
  it("labels the running session cancelled, not completed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 10, 0));

    rawSet("schedules", [makeSchedule()]);
    seedScheduledSession("sched-1");

    // The popup deletes the schedule, then storage.onChanged reconciles.
    rawSet("schedules", []);
    await sw.applyBlockingState();

    const history = (mock.data.get("history") as ArchivedSessionRecord[]) ?? [];
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("cancelled");
    expect(history[0].scheduled_schedule_id).toBe("sched-1");
    expect(mock.data.get("active_session")).toBeNull();
    expect(mock.dnrRules).toHaveLength(0);
  });

  it("still labels a naturally finished window completed", async () => {
    vi.useFakeTimers();
    // Now is past the 12:00 end boundary.
    vi.setSystemTime(new Date(2026, 7, 24, 12, 30));

    rawSet("schedules", [makeSchedule()]);
    seedScheduledSession("sched-1", { started_at: new Date(2026, 7, 24, 9, 0).toISOString() });

    await sw.applyBlockingState();

    const history = (mock.data.get("history") as ArchivedSessionRecord[]) ?? [];
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("completed");
    expect(mock.data.get("active_session")).toBeNull();
    expect(mock.dnrRules).toHaveLength(0);
  });
});
