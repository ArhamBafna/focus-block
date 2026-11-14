/**
 * Desktop → Chrome policy mirror tests.
 *
 * The service worker mirrors an active desktop session into the popup's
 * `active_session` slot so the same DNR rules apply in the browser. These tests
 * pin the failure modes that matter: a mirror that outlives the desktop
 * session (Chrome blocked forever), a mirror that can be stopped or expired
 * from the browser (free bypass of the desktop stop challenge), and two owners
 * fighting over the session slot every minute.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock, type ChromeMockHandles } from "./chrome-mock";
import type {
  ActiveSessionRecord,
  ArchivedSessionRecord,
  Schedule,
} from "../service-worker";

let mock: ChromeMockHandles;
let sw: typeof import("../service-worker");

const ALARM_SESSION_EXPIRY = "focus_session_expiry";

beforeEach(async () => {
  vi.resetModules();
  mock = installChromeMock();
  sw = await import("../service-worker");
});

afterEach(() => {
  vi.useRealTimers();
});

function rawGet<T>(key: string): T | undefined {
  return mock.data.get(key) as T | undefined;
}

function rawSet(key: string, value: unknown): void {
  mock.data.set(key, value);
}

function makeActiveSession(overrides: Partial<ActiveSessionRecord> = {}): ActiveSessionRecord {
  return {
    id: "session-1",
    preset_id: null,
    mode: "blocklist",
    started_at: new Date().toISOString(),
    planned_duration_sec: 25 * 60,
    status: "active",
    ended_at: null,
    blocklist_snapshot: ["news.com"],
    whitelist_snapshot: [],
    ...overrides,
  };
}

function activeDesktopPolicy(blocklist: string[] = ["news.com"]) {
  return {
    active: true,
    mode: "blocklist" as const,
    blocklist,
    whitelist: [] as string[],
    expires_at: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
  };
}

function rulesMention(domain: string): boolean {
  // Redirect rules use regexFilter, so dots arrive escaped (`news\.com`).
  // Strip escapes before matching so the assertion reads as the domain itself.
  return mock.dnrRules.some((rule) => JSON.stringify(rule).split("\\").join("").includes(domain));
}

/** A schedule window that is live right now, without crossing midnight. */
function scheduleCoveringNow(id = "sched-1"): Schedule {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = Math.max(0, minutes - 1);
  const endMinutes = Math.min(1439, minutes + 60);
  const clock = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  return {
    id,
    start_time: clock(startMinutes),
    end_time: clock(endMinutes),
    mode: "blocklist",
    days_of_week: [now.getDay()],
    ends_on: null,
  };
}

/** Freeze the clock at midday so a same-day schedule window always fits. */
function freezeMidday(): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-03-10T12:00:00"));
}

describe("desktop policy mirror", () => {
  it("blocks Chrome while the desktop session runs and unblocks when it ends", async () => {
    const policy = activeDesktopPolicy();
    await sw.syncNativePolicy(policy);

    const mirrored = rawGet<ActiveSessionRecord>("active_session");
    expect(mirrored).toBeDefined();
    expect(mirrored?.id.startsWith(sw.NATIVE_MIRROR_ID_PREFIX)).toBe(true);
    expect(mirrored?.blocklist_snapshot).toEqual(["news.com"]);
    // The real end time travels with the mirror so the popup can show it.
    expect(mirrored?.ends_at).toBe(policy.expires_at);
    expect(rulesMention("news.com")).toBe(true);

    // A stop challenge the popup opened for the mirror dies with the mirror.
    rawSet("active_challenge", { type: "math", status: "pending" });
    await sw.syncNativePolicy({ active: false });

    expect(rawGet("active_session")).toBeNull();
    expect(rawGet("active_challenge")).toBeNull();
    expect(mock.dnrRules).toHaveLength(0);
  });

  it("refreshes the same mirror when the desktop snapshot changes", async () => {
    await sw.syncNativePolicy(activeDesktopPolicy());
    const first = rawGet<ActiveSessionRecord>("active_session");

    await sw.syncNativePolicy(activeDesktopPolicy(["news.com", "games.com"]));

    const refreshed = rawGet<ActiveSessionRecord>("active_session");
    expect(refreshed?.id).toBe(first?.id);
    expect(refreshed?.blocklist_snapshot).toEqual(["news.com", "games.com"]);
    expect(rulesMention("games.com")).toBe(true);
  });

  it("keeps an indefinite desktop session alive across refreshes", async () => {
    const indefinite = { ...activeDesktopPolicy(), expires_at: null };
    await sw.syncNativePolicy(indefinite);

    // "No end" is carried as a null end time, not as a fake deadline.
    expect(rawGet<ActiveSessionRecord>("active_session")?.ends_at).toBeNull();

    // Pretend the mirror has been alive for longer than its grace window.
    const mirrored = rawGet<ActiveSessionRecord>("active_session")!;
    rawSet("active_session", {
      ...mirrored,
      started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      planned_duration_sec: 180,
    });

    await sw.syncNativePolicy(indefinite);

    const refreshed = rawGet<ActiveSessionRecord>("active_session");
    expect(refreshed?.id).toBe(mirrored.id);
    const elapsed = Math.floor(
      (Date.now() - new Date(refreshed!.started_at).getTime()) / 1000
    );
    expect(refreshed!.planned_duration_sec).toBeGreaterThan(elapsed);

    // The expiry alarm, not just the stored number, has to move past the grace.
    const alarm = mock.createdAlarms.filter((entry) => entry.name === ALARM_SESSION_EXPIRY).at(-1);
    const when = (alarm?.info as { when?: number } | undefined)?.when ?? 0;
    expect(when - Date.now()).toBeGreaterThan(120 * 1000);
  });

  it("leaves a popup-started session alone while the desktop is idle", async () => {
    const popupSession = makeActiveSession();
    rawSet("active_session", popupSession);

    await sw.syncNativePolicy({ active: false });

    expect(rawGet<ActiveSessionRecord>("active_session")?.id).toBe("session-1");
  });

  it("lets the desktop session win and archives the popup session honestly", async () => {
    rawSet("active_session", makeActiveSession());

    await sw.syncNativePolicy(activeDesktopPolicy());

    const active = rawGet<ActiveSessionRecord>("active_session");
    expect(active?.id.startsWith(sw.NATIVE_MIRROR_ID_PREFIX)).toBe(true);

    const history = rawGet<ArchivedSessionRecord[]>("history") ?? [];
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("session-1");
    expect(history[0].status).toBe("stopped");
  });

  it("refuses to end a mirrored session from the popup", async () => {
    await sw.syncNativePolicy(activeDesktopPolicy());
    rawSet("active_challenge", { type: "math", status: "pending" });

    await expect(sw.stopSession()).rejects.toThrow(/Focus Block app/);

    expect(rawGet<ActiveSessionRecord>("active_session")).not.toBeNull();
    expect(rulesMention("news.com")).toBe(true);
    // The challenge this stop started must not be left dangling on screen.
    expect(rawGet("active_challenge")).toBeNull();
  });

  it("does not clear a live mirror when the popup asks the worker to expire", async () => {
    await sw.syncNativePolicy(activeDesktopPolicy());

    // The popup sends session:expire on every status read.
    await sw.expireSession();

    expect(rawGet<ActiveSessionRecord>("active_session")).not.toBeNull();
    expect(rulesMention("news.com")).toBe(true);
  });

  it("clears an expired mirror without inventing a history entry", async () => {
    await sw.syncNativePolicy(activeDesktopPolicy());
    const mirrored = rawGet<ActiveSessionRecord>("active_session")!;
    rawSet("active_session", {
      ...mirrored,
      started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      planned_duration_sec: 60,
    });

    await sw.expireSession();

    expect(rawGet("active_session")).toBeNull();
    expect(rawGet<ArchivedSessionRecord[]>("history") ?? []).toHaveLength(0);
    expect(mock.dnrRules).toHaveLength(0);
  });

  it("keeps the desktop session in front of a live schedule window", async () => {
    freezeMidday();
    rawSet("schedules", [scheduleCoveringNow()]);

    await sw.syncNativePolicy(activeDesktopPolicy());

    const active = rawGet<ActiveSessionRecord>("active_session");
    expect(active?.id.startsWith(sw.NATIVE_MIRROR_ID_PREFIX)).toBe(true);
    expect(rulesMention("news.com")).toBe(true);

    // The worker's own reconcile must not hand the slot back to the window.
    await sw.applyBlockingState();
    expect(rawGet<ActiveSessionRecord>("active_session")?.id).toBe(active?.id);
    expect(rulesMention("news.com")).toBe(true);
    expect(rawGet<ArchivedSessionRecord[]>("history") ?? []).toHaveLength(0);
  });

  it("hands the slot back to the schedule when the desktop session ends", async () => {
    freezeMidday();
    rawSet("schedules", [scheduleCoveringNow()]);
    await sw.syncNativePolicy(activeDesktopPolicy());
    expect(rawGet<ActiveSessionRecord>("active_session")?.id).toContain(
      sw.NATIVE_MIRROR_ID_PREFIX
    );

    await sw.syncNativePolicy({ active: false });

    // The mirror is a view, not a session: nothing is archived, and the window
    // that was live the whole time simply resumes.
    const resumed = rawGet<ActiveSessionRecord>("active_session");
    expect(resumed?.scheduled_schedule_id).toBe("sched-1");
    expect(rawGet<ArchivedSessionRecord[]>("history") ?? []).toHaveLength(0);
  });

  it("archives a live scheduled session when the desktop policy takes the slot", async () => {
    freezeMidday();
    rawSet("schedules", [scheduleCoveringNow()]);
    await sw.applyBlockingState();

    const scheduled = rawGet<ActiveSessionRecord>("active_session");
    expect(scheduled?.scheduled_schedule_id).toBe("sched-1");
    rawSet("active_challenge", { type: "math", status: "pending" });

    await sw.syncNativePolicy(activeDesktopPolicy());

    const active = rawGet<ActiveSessionRecord>("active_session");
    expect(active?.id.startsWith(sw.NATIVE_MIRROR_ID_PREFIX)).toBe(true);
    // The schedule's own session really did end, so history says so.
    const history = rawGet<ArchivedSessionRecord[]>("history") ?? [];
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(scheduled?.id);
    expect(history[0].status).toBe("stopped");
    // A challenge for the replaced session must not survive it.
    expect(rawGet("active_challenge")).toBeNull();
  });

  it("keeps blocking when the native host reports an error instead of a policy", async () => {
    await sw.syncNativePolicy(activeDesktopPolicy());

    const chromeLike = (globalThis as unknown as { chrome: any }).chrome;
    chromeLike.runtime.sendNativeMessage = (
      _host: string,
      _message: unknown,
      callback: (response: unknown) => void
    ) => {
      callback({ active: false, error: "service unavailable" });
    };

    await sw.checkNativePolicy();

    expect(rawGet<ActiveSessionRecord>("active_session")).not.toBeNull();
    expect(rulesMention("news.com")).toBe(true);
  });

  it("keeps blocking when the native port itself fails", async () => {
    await sw.syncNativePolicy(activeDesktopPolicy());

    const chromeLike = (globalThis as unknown as { chrome: any }).chrome;
    chromeLike.runtime.sendNativeMessage = (
      _host: string,
      _message: unknown,
      callback: (response: unknown) => void
    ) => {
      chromeLike.runtime.lastError = { message: "native host has exited" };
      callback(undefined);
    };

    await sw.checkNativePolicy();

    // "Unknown" must never read as "the desktop session ended".
    expect(rawGet<ActiveSessionRecord>("active_session")).not.toBeNull();
    expect(rulesMention("news.com")).toBe(true);
  });

  it("serializes overlapping syncs so the newest policy is the one applied", async () => {
    // Two native-sync ticks can land in the same event-loop turn. The mutation
    // lock makes the last one win; without it both could act on one stale read.
    const first = sw.syncNativePolicy(activeDesktopPolicy(["news.com"]));
    const second = sw.syncNativePolicy(activeDesktopPolicy(["news.com", "games.com"]));
    await Promise.all([first, second]);

    const active = rawGet<ActiveSessionRecord>("active_session");
    expect(active?.id.startsWith(sw.NATIVE_MIRROR_ID_PREFIX)).toBe(true);
    expect(active?.blocklist_snapshot).toEqual(["news.com", "games.com"]);
    expect(rulesMention("games.com")).toBe(true);
    expect(rawGet<ArchivedSessionRecord[]>("history") ?? []).toHaveLength(0);
  });

  it("survives an expiry and a policy sync racing each other", async () => {
    // The popup asks for an expiry on every status read, so this overlap is the
    // normal case, not a corner case.
    await Promise.all([sw.expireSession(), sw.syncNativePolicy(activeDesktopPolicy())]);

    const active = rawGet<ActiveSessionRecord>("active_session");
    expect(active?.id.startsWith(sw.NATIVE_MIRROR_ID_PREFIX)).toBe(true);
    expect(rulesMention("news.com")).toBe(true);
    expect(rawGet<ArchivedSessionRecord[]>("history") ?? []).toHaveLength(0);
  });

  it("renews an expired mirror lease when the desktop session is still alive", async () => {
    const indefinite = { ...activeDesktopPolicy(), expires_at: null };
    await sw.syncNativePolicy(indefinite);
    const mirror = rawGet<ActiveSessionRecord>("active_session")!;

    // Simulate a machine that slept: the lease ran out and no sync tick arrived,
    // which is also exactly when the popup gets opened.
    rawSet("active_session", {
      ...mirror,
      started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      planned_duration_sec: 600,
    });

    const chromeLike = (globalThis as unknown as { chrome: any }).chrome;
    chromeLike.runtime.sendNativeMessage = (
      _host: string,
      _message: unknown,
      callback: (response: unknown) => void
    ) => {
      callback(indefinite);
    };

    await sw.expireSession();

    // The desktop session is live, so the lease renews instead of unblocking.
    expect(rawGet<ActiveSessionRecord>("active_session")?.id).toBe(mirror.id);
    expect(rulesMention("news.com")).toBe(true);
    expect(rawGet<ArchivedSessionRecord[]>("history") ?? []).toHaveLength(0);
  });

  it("keeps blocking when the host fails right after a wake from sleep", async () => {
    const indefinite = { ...activeDesktopPolicy(), expires_at: null };
    await sw.syncNativePolicy(indefinite);
    const mirror = rawGet<ActiveSessionRecord>("active_session")!;
    rawSet("active_session", {
      ...mirror,
      started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      planned_duration_sec: 600,
    });

    const chromeLike = (globalThis as unknown as { chrome: any }).chrome;
    chromeLike.runtime.sendNativeMessage = (
      _host: string,
      _message: unknown,
      callback: (response: unknown) => void
    ) => {
      chromeLike.runtime.lastError = { message: "native host has exited" };
      callback(undefined);
    };

    await sw.expireSession();

    // A resume is exactly when the named pipe is not ready yet. One failed
    // question must not unblock Chrome while the desktop session is running.
    expect(rawGet<ActiveSessionRecord>("active_session")?.id).toBe(mirror.id);
    expect(rulesMention("news.com")).toBe(true);
    expect(rawGet<number>("mirror_unverified_since")).toBeTypeOf("number");

    // A live answer clears the failure streak again.
    chromeLike.runtime.sendNativeMessage = (
      _host: string,
      _message: unknown,
      callback: (response: unknown) => void
    ) => {
      chromeLike.runtime.lastError = undefined;
      callback(indefinite);
    };
    await sw.checkNativePolicy();
    expect(rawGet("mirror_unverified_since")).toBeNull();
  });

  it("does not unblock a mirror whose lease ran out just before the pass", async () => {
    const indefinite = { ...activeDesktopPolicy(), expires_at: null };
    await sw.syncNativePolicy(indefinite);
    const mirror = rawGet<ActiveSessionRecord>("active_session")!;
    // The renewal check ran a moment before the lease ran out, so this pass sees
    // a spent lease with no fresh answer. Time alone must not lift blocking.
    rawSet("active_session", {
      ...mirror,
      started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      planned_duration_sec: 600,
    });

    await sw.applyBlockingState();

    expect(rawGet<ActiveSessionRecord>("active_session")?.id).toBe(mirror.id);
    expect(rulesMention("news.com")).toBe(true);
    expect(rawGet<ArchivedSessionRecord[]>("history") ?? []).toHaveLength(0);
  });

  it("never extends the failure grace past the bound", async () => {
    const indefinite = { ...activeDesktopPolicy(), expires_at: null };
    await sw.syncNativePolicy(indefinite);
    const mirror = rawGet<ActiveSessionRecord>("active_session")!;
    const unverifiedStart = Date.now() - 9 * 60 * 1000;
    rawSet("active_session", {
      ...mirror,
      started_at: new Date(unverifiedStart - 60 * 1000).toISOString(),
      planned_duration_sec: 660,
    });
    rawSet("mirror_unverified_since", unverifiedStart);

    const chromeLike = (globalThis as unknown as { chrome: any }).chrome;
    chromeLike.runtime.sendNativeMessage = (
      _host: string,
      _message: unknown,
      callback: (response: unknown) => void
    ) => {
      chromeLike.runtime.lastError = { message: "native host has exited" };
      callback(undefined);
    };

    await sw.checkNativePolicy();

    const active = rawGet<ActiveSessionRecord>("active_session")!;
    const leaseEndsAt = Date.parse(active.started_at) + active.planned_duration_sec * 1000;
    // Nine minutes into a ten-minute bound, the last extension may only be the
    // minute that is left: the mirror must not outlive the bound.
    expect(leaseEndsAt).toBeLessThanOrEqual(unverifiedStart + 10 * 60 * 1000 + 1000);
    expect(rawGet("active_session")).not.toBeNull();
  });

  it("gives up on a mirror when the service is unreachable past the bound", async () => {
    const indefinite = { ...activeDesktopPolicy(), expires_at: null };
    await sw.syncNativePolicy(indefinite);
    const mirror = rawGet<ActiveSessionRecord>("active_session")!;
    rawSet("active_session", {
      ...mirror,
      started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      planned_duration_sec: 600,
    });
    // The failures started long before now: this is an uninstalled or wedged
    // service, not a resume.
    rawSet("mirror_unverified_since", Date.now() - 60 * 60 * 1000);

    const chromeLike = (globalThis as unknown as { chrome: any }).chrome;
    chromeLike.runtime.sendNativeMessage = (
      _host: string,
      _message: unknown,
      callback: (response: unknown) => void
    ) => {
      chromeLike.runtime.lastError = { message: "native host has exited" };
      callback(undefined);
    };

    await sw.expireSession();

    // Bounded by design: the extension never blocks Chrome forever on a session
    // it cannot verify.
    expect(rawGet("active_session")).toBeNull();
    expect(mock.dnrRules).toHaveLength(0);
  });

  it("verifies a live mirror every time the popup asks, not only when the lease runs out", async () => {
    // A one-hour desktop session: the lease is still valid, so an expiry-only
    // check would keep showing it after the user already stopped it in the app.
    const endingLater = {
      ...activeDesktopPolicy(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    await sw.syncNativePolicy(endingLater);
    expect(rulesMention("news.com")).toBe(true);

    const chromeLike = (globalThis as unknown as { chrome: any }).chrome;
    chromeLike.runtime.sendNativeMessage = (
      _host: string,
      _message: unknown,
      callback: (response: unknown) => void
    ) => {
      chromeLike.runtime.lastError = undefined;
      callback({ active: false, mode: null });
    };

    await sw.expireSession();

    expect(rawGet("active_session")).toBeNull();
    expect(mock.dnrRules).toHaveLength(0);
  });

  it("renews from the reconcile path too, without a popup open", async () => {
    const indefinite = { ...activeDesktopPolicy(), expires_at: null };
    await sw.syncNativePolicy(indefinite);
    const mirror = rawGet<ActiveSessionRecord>("active_session")!;
    rawSet("active_session", {
      ...mirror,
      started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      planned_duration_sec: 600,
    });

    const chromeLike = (globalThis as unknown as { chrome: any }).chrome;
    chromeLike.runtime.sendNativeMessage = (
      _host: string,
      _message: unknown,
      callback: (response: unknown) => void
    ) => {
      chromeLike.runtime.lastError = undefined;
      callback(indefinite);
    };

    await sw.requestReconcile();

    // An alarm-driven reconcile must reach the same verdict as a popup open.
    expect(rawGet<ActiveSessionRecord>("active_session")?.id).toBe(mirror.id);
    expect(rulesMention("news.com")).toBe(true);
  });

  it("shares one mirror id prefix with the popup", async () => {
    const popupStorage = await import("../../popup/lib/storage");

    // A silent rename on either side would make the popup offer a Stop button
    // for a session the worker refuses to stop.
    expect(popupStorage.NATIVE_MIRROR_ID_PREFIX).toBe(sw.NATIVE_MIRROR_ID_PREFIX);
    expect(popupStorage.isMirrorSession({ id: sw.NATIVE_MIRROR_ID_PREFIX + "1" })).toBe(true);
    expect(popupStorage.isMirrorSession({ id: "session-1" })).toBe(false);
    expect(popupStorage.isMirrorSession(null)).toBe(false);
  });

  it("recovers safely when sendNativeMessage hangs and times out", async () => {
    vi.useFakeTimers();
    const chromeLike = (globalThis as unknown as { chrome: any }).chrome;
    // Simulate a hung native host that never calls the callback
    chromeLike.runtime.sendNativeMessage = vi.fn();

    const checkPromise = sw.checkNativePolicy();
    await vi.advanceTimersByTimeAsync(6500);
    await checkPromise;

    expect(chromeLike.runtime.sendNativeMessage).toHaveBeenCalled();
  });
});
