/**
 * Rule-building hardening (issue #19): regex metacharacters in stored entries
 * can never reach a DNR regexFilter/urlFilter as raw pattern text, and a
 * failed reconcile pass resolves instead of becoming an unhandled rejection.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock, type ChromeMockHandles } from "./chrome-mock";

type WorkerModule = typeof import("../service-worker");

let mock: ChromeMockHandles;
let worker: WorkerModule;

beforeEach(async () => {
  vi.resetModules();
  mock = installChromeMock();
  worker = await import("../service-worker");
});

describe("isValidStoredDomain", () => {
  it.each([
    ["youtube.com", true],
    ["*game", true],
    ["*mail.google", true],
    ["sub.deep.example.co", true],
    ["*foo(bar", false],
    ["bad(.com", false],
    ["a+plus.com", false],
    ["pipe|.com", false],
    ["caret^.com", false],
    ["dollar$.com", false],
    ["*wild*double", false],
    ["*", false],
    ["nodot", false],
    ["", false],
    [42, false],
    [null, false],
  ])("isValidStoredDomain(%j) is %j", (input, expected) => {
    expect(worker.isValidStoredDomain(input)).toBe(expected);
  });
});

describe("buildRules", () => {
  it("plain domain produces exact and www rules for both allow and block actions", () => {
    const allowRules = worker.buildRules([], ["example.com"], [], "test-extension-id");
    expect(allowRules).toHaveLength(2);
    const filters = allowRules.map((r) => (r.condition as { urlFilter?: string }).urlFilter);
    expect(filters).toContain("||example.com^");
    expect(filters).toContain("||www.example.com^");

    const blockRules = worker.buildRules(["example.com"], [], [], "test-extension-id");
    expect(blockRules).toHaveLength(2);
    for (const rule of blockRules) {
      expect(rule.action.type).toBe(2);
    }
    const blockFilters = blockRules.map((r) => (r.condition as { regexFilter?: string }).regexFilter);
    expect(blockFilters).toContain("^https?://([^/]*\\.)?(example\\.com)(/.*)?$");
    expect(blockFilters).toContain("^https?://([^/]*\\.)?(www\\.example\\.com)(/.*)?$");
  });

  it("redirect rules escape dots in the domain so the regex stays valid", () => {
    const rules = worker.buildRules(["mail.example.com"], [], [], "test-extension-id");

    const regexFilters = rules.map((r) => (r.condition as { regexFilter?: string }).regexFilter);
    expect(regexFilters).toContain("^https?://([^/]*\\.)?(mail\\.example\\.com)(/.*)?$");
    expect(regexFilters).toContain("^https?://([^/]*\\.)?(www\\.mail\\.example\\.com)(/.*)?$");
    for (const filter of regexFilters) {
      expect(() => new RegExp(filter as string)).not.toThrow();
    }
  });

  it("wildcard entry produces an escaped regexFilter", () => {
    const rules = worker.buildRules(["*game"], [], [], "test-extension-id");

    expect(rules).toHaveLength(1);
    const condition = rules[0].condition as { regexFilter?: string };
    expect(condition.regexFilter).toBe("^https?://.*game.*");
    expect(() => new RegExp(condition.regexFilter as string)).not.toThrow();
  });

  it("metacharacter entries are skipped entirely instead of corrupting the rule set", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rules = worker.buildRules(
      ["*foo(bar", "bad(.com", "good.com", "*x*y"],
      [],
      [],
      "test-extension-id"
    );

    expect(rules).toHaveLength(2);
    const patterns = rules.map((r) => ((r.condition as { regexFilter?: string }).regexFilter ??
      (r.condition as { urlFilter?: string }).urlFilter) as string);
    expect(patterns).toContain("^https?://([^/]*\\.)?(good\\.com)(/.*)?$");
    expect(patterns).toContain("^https?://([^/]*\\.)?(www\\.good\\.com)(/.*)?$");
    const joined = patterns.join("|");
    expect(joined).not.toContain("*foo");
    expect(joined).not.toContain("bad");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("whitelist allow rules outrank blocklist redirects on the same domain", () => {
    const rules = worker.buildRules(["dual.com"], ["dual.com"], [], "test-extension-id");

    const allows = rules.filter((r) => r.action.type === chrome.declarativeNetRequest.RuleActionType.ALLOW);
    const blocks = rules.filter((r) => r.action.type === chrome.declarativeNetRequest.RuleActionType.REDIRECT);
    expect(allows.length).toBeGreaterThan(0);
    expect(blocks.length).toBeGreaterThan(0);
    expect(Math.min(...allows.map((r) => r.priority!))).toBeGreaterThan(Math.max(...blocks.map((r) => r.priority!)));
  });
});

describe("buildLockdownRules", () => {
  it("blocks everything except whitelists, temporary allows, and extension pages", () => {
    const rules = worker.buildLockdownRules(["allowed.com"], ["temp.com"], "test-extension-id");

    const catchAll = rules.find((r) => r.priority === 1);
    expect(catchAll?.action.type).toBe(2);
    expect((catchAll?.condition as { urlFilter?: string }).urlFilter).toBeUndefined();

    const allowFilters = rules
      .filter((r) => r.action.type === chrome.declarativeNetRequest.RuleActionType.ALLOW)
      .map((r) => (r.condition as { urlFilter?: string }).urlFilter);
    expect(allowFilters.some((f) => f?.includes("allowed.com"))).toBe(true);
    expect(allowFilters.some((f) => f?.includes("temp.com"))).toBe(true);
    expect(allowFilters.some((f) => f?.includes("chrome-extension://test-extension-id"))).toBe(true);

    for (const rule of rules) {
      if (rule.action.type === chrome.declarativeNetRequest.RuleActionType.REDIRECT) expect(rule.priority).toBe(1);
    }
  });
});

describe("requestReconcile failure handling", () => {
  function dnr(): { getDynamicRules: () => Promise<chrome.declarativeNetRequest.Rule[]> } {
    return (
      globalThis as unknown as {
        chrome: { declarativeNetRequest: { getDynamicRules: () => Promise<chrome.declarativeNetRequest.Rule[]> } };
      }
    ).chrome.declarativeNetRequest;
  }

  it("resolves and logs when the rules engine throws instead of rejecting", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    dnr().getDynamicRules = () => Promise.reject(new Error("DNR exploded"));

    mock.data.set("active_session", {
      id: "s1",
      preset_id: null,
      mode: "blocklist",
      started_at: new Date().toISOString(),
      planned_duration_sec: 3600,
      status: "active",
      ended_at: null,
      blocklist_snapshot: ["example.com"],
      whitelist_snapshot: [],
    });

    await expect(worker.requestReconcile()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("[FocusBlocker] Reconcile pass failed:", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("keeps reconciling on later triggers after a failed pass", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = true;
    dnr().getDynamicRules = async () => {
      if (fail) throw new Error("DNR down");
      return [];
    };

    mock.data.set("active_session", null);
    await worker.requestReconcile();
    expect(errorSpy).toHaveBeenCalled();

    fail = false;
    await expect(worker.requestReconcile()).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
