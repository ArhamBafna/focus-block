/**
 * Session-brain regression tests (issues #3, #14, #17).
 *
 * Runs the real service-worker module against a fake chrome.* environment:
 * mutation-lock serialization, expiry racing a fresh start, stray-record
 * migration, and rule-update dedupe.
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

function seedDomainList(key: "blocklist" | "whitelist", domains: string[]): void {
  rawSet(
    key,
    domains.map((domain, index) => ({ id: index + 1, domain }))
  );
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

describe("rapid start/stop clicks", () => {
  it("serializes into exactly one history entry per stop and never drops one", async () => {
    seedDomainList("blocklist", ["news.com"]);

    const outcomes = await Promise.allSettled([
      sw.startSessionLocked("blocklist", 25),
      sw.startSessionLocked("blocklist", 25),
      sw.stopSessionLocked(),
      sw.startSessionLocked("lockdown", 10),
      sw.stopSessionLocked(),
    ]);

    expect(outcomes[0].status).toBe("fulfilled");
    expect(outcomes[1]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: "A session is already active" }),
    });
    expect(outcomes[2].status).toBe("fulfilled");
    expect(outcomes[3].status).toBe("fulfilled");
    expect(outcomes[4].status).toBe("fulfilled");

    const history = rawGet<ArchivedSessionRecord[]>("history") ?? [];
    expect(history).toHaveLength(2);
    for (const record of history) {
      expect(record.status).toBe("stopped");
      expect(typeof record.ended_at).toBe("string");
    }

    expect(rawGet("active_session")).toBeNull();
  });

  it("keeps history intact when stop clicks arrive with no session running", async () => {
    const outcomes = await Promise.allSettled([
      sw.stopSessionLocked(),
      sw.stopSessionLocked(),
    ]);

    for (const outcome of outcomes) expect(outcome.status).toBe("fulfilled");

    const history = rawGet<ArchivedSessionRecord[]>("history") ?? [];
    expect(history).toHaveLength(0);
    expect(rawGet("active_session") ?? null).toBeNull();
  });
});

describe("expiry racing a fresh manual start", () => {
  it("does not archive a fresh session when a stale expiry alarm fires", async () => {
    // Session A lives and dies normally.
    await sw.startSessionLocked("blocklist", 60);
    await sw.stopSessionLocked();

    // Fresh manual session B starts; the alarm scheduled for A fires late.
    await sw.startSessionLocked("lockdown", 45);
    await sw.requestReconcile();
    await sw.expireSession();

    const active = rawGet<ActiveSessionRecord>("active_session");
    expect(active).not.toBeNull();
    expect(active?.status).toBe("active");
    expect(active?.mode).toBe("lockdown");

    const history = rawGet<ArchivedSessionRecord[]>("history") ?? [];
    expect(history).toHaveLength(1);
    expect(history[0].id).not.toBe(active?.id);
    expect(history[0].status).toBe("stopped");
  });

  it("still archives a genuinely finished session on expiry", async () => {
    const startedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    rawSet("active_session", makeActiveSession({ started_at: startedAt }));

    await sw.expireSession();

    const history = rawGet<ArchivedSessionRecord[]>("history") ?? [];
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("completed");
    expect(rawGet("active_session")).toBeNull();
    expect(mock.dnrRules).toHaveLength(0);
  });
});

describe("stray terminal record in the active slot", () => {
  it.each(["completed", "stopped"] as const)(
    "archives a stray %s record and clears rules on next apply",
    async (status) => {
      seedDomainList("blocklist", ["news.com"]);
      await sw.startSessionLocked("blocklist", 30);
      expect(mock.dnrRules.length).toBeGreaterThan(0);

      const live = rawGet<ActiveSessionRecord>("active_session");
      const endedAt = "2026-08-22T10:00:00.000Z";
      rawSet("active_session", { ...live, status, ended_at: endedAt });

      await sw.requestReconcile();

      const history = rawGet<ArchivedSessionRecord[]>("history") ?? [];
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe(status);
      expect(history[0].ended_at).toBe(endedAt);
      expect(rawGet("active_session")).toBeNull();

      expect(mock.dnrRules).toHaveLength(0);
      expect(mock.clearedAlarms).toContain("focus_session_expiry");
    }
  );

  it("discards an unrecognizable record instead of crashing or archiving it", async () => {
    rawSet("active_session", { status: "mysterious", junk: true });

    await expect(sw.requestReconcile()).resolves.toBeUndefined();

    const history = rawGet<ArchivedSessionRecord[]>("history") ?? [];
    expect(history).toHaveLength(0);
    expect(rawGet("active_session")).toBeNull();
  });
});

describe("blocking-rule updates", () => {
  it("produces exactly one rules update per real change and skips no-op passes", async () => {
    seedDomainList("blocklist", ["news.com"]);

    await sw.startSessionLocked("blocklist", 30);
    const updatesAfterStart = mock.stats.dnrUpdateCalls;
    expect(updatesAfterStart).toBeGreaterThan(0);
    expect(mock.dnrRules.length).toBeGreaterThan(0);

    // Reconcile passes over unchanged state never touch the rules engine.
    await sw.requestReconcile();
    await sw.requestReconcile();
    expect(mock.stats.dnrUpdateCalls).toBe(updatesAfterStart);

    // A live change (temporary allow feeds rules directly) updates exactly once.
    rawSet("temporary_allowlist", [
      { id: "temp-1", domain: "mail.com", expires_at: Date.now() + 5 * 60 * 1000 },
    ]);
    await sw.requestReconcile();
    expect(mock.stats.dnrUpdateCalls).toBe(updatesAfterStart + 1);
  });

  it("clears all rules in one update when the last session ends", async () => {
    seedDomainList("blocklist", ["news.com"]);
    await sw.startSessionLocked("blocklist", 30);

    await sw.stopSessionLocked();

    expect(mock.dnrRules).toHaveLength(0);
  });
});

describe("reconcile failure handling", () => {
  it("a failed DNR pass resolves without rejecting and the next pass recovers", async () => {
    seedDomainList("blocklist", ["news.com"]);
    await sw.startSessionLocked("blocklist", 30);
    const updatesAfterStart = mock.stats.dnrUpdateCalls;
    expect(updatesAfterStart).toBeGreaterThan(0);

    // Replace updateDynamicRules so the next call fails like a transient
    // chrome.* API error would; later calls delegate to the real mock.
    const originalUpdate = chrome.declarativeNetRequest.updateDynamicRules.bind(
      chrome.declarativeNetRequest
    );
    type UpdateOptions = Parameters<typeof originalUpdate>[0];
    let failNext = true;
    const failingUpdate = async (options: UpdateOptions): Promise<void> => {
      if (failNext) {
        failNext = false;
        throw new Error("Simulated transient DNR failure");
      }
      await originalUpdate(options);
    };
    (
      chrome.declarativeNetRequest as { updateDynamicRules: typeof failingUpdate }
    ).updateDynamicRules = failingUpdate;

    // A live change makes the pending pass a real (non-no-op) rules update,
    // so the failure lands inside the requestReconcile catch branch.
    rawSet("temporary_allowlist", [
      { id: "temp-1", domain: "mail.com", expires_at: Date.now() + 5 * 60 * 1000 },
    ]);

    const hasMailAllow = (rule: chrome.declarativeNetRequest.Rule) =>
      rule.priority === 3 && rule.condition?.urlFilter === "||mail.com^";

    await expect(sw.requestReconcile()).resolves.toBeUndefined();
    expect(failNext).toBe(false);
    expect(mock.stats.dnrUpdateCalls).toBe(updatesAfterStart);
    expect(mock.dnrRules.some(hasMailAllow)).toBe(false);

    // Restore the API; the retry pass applies rules and the loop stays healthy.
    (
      chrome.declarativeNetRequest as { updateDynamicRules: typeof originalUpdate }
    ).updateDynamicRules = originalUpdate;

    await expect(sw.requestReconcile()).resolves.toBeUndefined();

    expect(mock.stats.dnrUpdateCalls).toBe(updatesAfterStart + 1);
    expect(
      mock.dnrRules.filter((rule) => hasMailAllow(rule) || rule.condition?.urlFilter === "||www.mail.com^")
    ).toHaveLength(2);
    expect(
      mock.dnrRules.some((rule) => rule.condition?.regexFilter?.includes("news"))
    ).toBe(true);
  });
});
