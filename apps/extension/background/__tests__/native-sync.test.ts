/**
 * Desktop → Chrome policy mirror tests.
 *
 * The service worker mirrors an active desktop session into the popup's
 * `active_session` slot so the same DNR rules apply in the browser. These tests
 * pin the two failure modes that matter: a mirror that outlives the desktop
 * session (Chrome blocked forever) and a mirror that can be stopped from the
 * browser (free bypass of the desktop stop challenge).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock, type ChromeMockHandles } from "./chrome-mock";
import type { ActiveSessionRecord, ArchivedSessionRecord } from "../service-worker";

let mock: ChromeMockHandles;
let sw: typeof import("../service-worker");

beforeEach(async () => {
  vi.resetModules();
  mock = installChromeMock();
  sw = await import("../service-worker");
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

describe("desktop policy mirror", () => {
  it("blocks Chrome while the desktop session runs and unblocks when it ends", async () => {
    await sw.syncNativePolicy(activeDesktopPolicy());

    const mirrored = rawGet<ActiveSessionRecord>("active_session");
    expect(mirrored).toBeDefined();
    expect(mirrored?.id.startsWith(sw.NATIVE_MIRROR_ID_PREFIX)).toBe(true);
    expect(mirrored?.blocklist_snapshot).toEqual(["news.com"]);
    expect(rulesMention("news.com")).toBe(true);

    await sw.syncNativePolicy({ active: false });

    expect(rawGet("active_session")).toBeNull();
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

    await expect(sw.stopSessionLocked()).rejects.toThrow(/Focus Block app/);
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

  it("keeps blocking when the native host reports an error instead of a policy", async () => {    await sw.syncNativePolicy(activeDesktopPolicy());

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
});
