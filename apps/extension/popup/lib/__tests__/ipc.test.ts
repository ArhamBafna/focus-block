/**
 * Extension ipc background channel: every message resolves a single typed
 * envelope where transport failure is the "unavailable" arm and background
 * application errors are the "app" arm, with the kind carried on unwrapped
 * errors (issue #18).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock, type ChromeMockHandles } from "../../../background/__tests__/chrome-mock";

type IpcModule = typeof import("../ipc");

let mock: ChromeMockHandles;
let ipc: IpcModule["ipc"];
let shouldTriggerStopChallenge: IpcModule["shouldTriggerStopChallenge"];

type SendMessageOutcome = { response?: unknown; lastError?: string } | "throw";

function fakeSendMessage(responder: (message: unknown) => SendMessageOutcome): unknown[] {
  const sent: unknown[] = [];
  const runtime = (globalThis as unknown as {
    chrome: {
      runtime: {
        lastError?: { message?: string };
        sendMessage: (message: unknown, callback: (response?: unknown) => void) => void;
      };
    };
  }).chrome.runtime;

  runtime.sendMessage = (message, callback) => {
    sent.push(message);
    const outcome = responder(message);
    if (outcome === "throw") throw new TypeError("port closed");
    runtime.lastError = outcome.lastError ? { message: outcome.lastError } : undefined;
    callback(outcome.response);
  };
  return sent;
}

beforeEach(async () => {
  vi.resetModules();
  mock = installChromeMock();
  const imported = await import("../ipc");
  ipc = imported.ipc;
  shouldTriggerStopChallenge = imported.shouldTriggerStopChallenge;
});

describe("background channel arms", () => {
  it("startSession rejects with kind 'app' when the background reports an error", async () => {
    fakeSendMessage(() => ({ response: { ok: false, error: "A session is already active" } }));

    await expect(ipc.startSession("blocklist", 25)).rejects.toMatchObject({
      kind: "app",
      message: "A session is already active",
    });
  });

  it.each([
    ["lastError set", () => ({ lastError: "Background service unreachable" })],
    ["no response object", () => ({ response: undefined })],
    ["malformed response", () => ({ response: { nonsense: true } })],
    ["sendMessage throws synchronously", () => "throw" as const],
  ])("%s rejects with kind 'unavailable'", async (_label, responder) => {
    fakeSendMessage(responder);

    await expect(ipc.stopSession()).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("startSession unwraps a successful background result", async () => {
    const sent = fakeSendMessage((message) => {
      expect((message as { type?: string }).type).toBe("session:start");
      return { response: { ok: true, result: null } };
    });

    await expect(ipc.startSession("lockdown", 45, "p1")).resolves.toBeNull();
    expect(sent[0]).toMatchObject({
      type: "session:start",
      mode: "lockdown",
      duration_minutes: 45,
      preset_id: "p1",
    });
  });

  it("stopSession sends exactly one session:stop per call", async () => {
    const sent = fakeSendMessage(() => ({ response: { ok: true, result: null } }));

    await Promise.all([ipc.stopSession(), ipc.stopSession()]);

    expect(sent).toHaveLength(2);
    for (const message of sent) expect(message).toMatchObject({ type: "session:stop" });
  });
});

describe("blocklist domain rejection (issue #19)", () => {
  it("rejects regex metacharacters with a clear message and stores nothing", async () => {
    await expect(ipc.addBlocklist("*foo(bar")).rejects.toThrow(/Invalid site/);
    await expect(ipc.addBlocklist("bad(.com")).rejects.toThrow(/Invalid site/);

    expect(mock.data.get("blocklist")).toBeUndefined();
  });

  it("still accepts valid domains, wildcards, and URLs", async () => {
    await expect(ipc.addBlocklist("youtube.com")).resolves.toBeGreaterThan(0);
    await expect(ipc.addBlocklist("*game")).resolves.toBeGreaterThan(0);
    await expect(ipc.addBlocklist("https://mail.example.com/path")).resolves.toBeGreaterThan(0);

    const list = await ipc.listBlocklist();
    expect(list.map((d) => d.domain).sort()).toEqual(["*game", "mail.example.com", "youtube.com"]);
  });

  it("applies the same rejection to the whitelist", async () => {
    await expect(ipc.addWhitelist("a+plus.com")).rejects.toThrow(/Invalid site/);
    expect(mock.data.get("whitelist")).toBeUndefined();
  });
});

describe("getStatusSafe raw envelope", () => {
  it("returns an ok envelope wrapping the status view when storage works", async () => {
    fakeSendMessage(() => ({ response: { ok: true, result: null } }));
    mock.data.set("active_session", {
      id: "s1",
      preset_id: null,
      mode: "blocklist",
      started_at: new Date().toISOString(),
      planned_duration_sec: 600,
      status: "active",
      ended_at: null,
      blocklist_snapshot: [],
      whitelist_snapshot: [],
    });

    const envelope = await ipc.getStatusSafe();

    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;
    expect(envelope.data.health.running).toBe(true);
    expect(envelope.data.active_session?.session.id).toBe("s1");
    expect(envelope.data.active_session?.remaining_sec).toBeLessThanOrEqual(600);
  });

  it("degrades to the unavailable arm when storage itself fails", async () => {
    (globalThis as unknown as {
      chrome: { storage: { local: { get: () => Promise<never> } } };
    }).chrome.storage.local.get = () => Promise.reject(new Error("storage dead"));

    await expect(ipc.getStatusSafe()).resolves.toMatchObject({
      ok: false,
      kind: "unavailable",
    });
  });
});

describe("getSettings fallback handling", () => {
  it("supplies default challenge scopes when missing from older storage versions", async () => {
    mock.data.set("settings", {
      stop_challenge: "countdown",
      challenge_countdown_duration: 60,
      challenge_countdown_breathing: true,
    } as any);

    const settings = await ipc.getSettings();
    expect(settings.stop_challenge).toBe("countdown");
    expect(settings.stop_challenge_lockdown).toBe(true);
    expect(settings.stop_challenge_focus).toBe(false);
  });

  it("preserves explicitly false lockdown challenge", async () => {
    mock.data.set("settings", {
      stop_challenge: "countdown",
      stop_challenge_lockdown: false,
      stop_challenge_focus: true,
      challenge_countdown_duration: 30,
      challenge_countdown_breathing: false,
    } as any);

    const settings = await ipc.getSettings();
    expect(settings.stop_challenge_lockdown).toBe(false);
    expect(settings.stop_challenge_focus).toBe(true);
  });
});

describe("shouldTriggerStopChallenge behavior verification", () => {
  const baseSettings = {
    stop_challenge: "countdown",
    stop_challenge_lockdown: true,
    stop_challenge_focus: false,
  };

  it("triggers challenge for lockdown session when lockdown switch is on", () => {
    expect(shouldTriggerStopChallenge("lockdown", baseSettings)).toBe(true);
  });

  it("stops immediately for lockdown session when lockdown switch is off", () => {
    expect(
      shouldTriggerStopChallenge("lockdown", { ...baseSettings, stop_challenge_lockdown: false })
    ).toBe(false);
  });

  it("triggers challenge for focus session when focus switch is on", () => {
    expect(
      shouldTriggerStopChallenge("blocklist", { ...baseSettings, stop_challenge_focus: true })
    ).toBe(true);
  });

  it("stops immediately for focus session when focus switch is off", () => {
    expect(shouldTriggerStopChallenge("blocklist", baseSettings)).toBe(false);
  });

  it("stops immediately when both switches are off", () => {
    expect(
      shouldTriggerStopChallenge("lockdown", {
        ...baseSettings,
        stop_challenge_lockdown: false,
        stop_challenge_focus: false,
      })
    ).toBe(false);
    expect(
      shouldTriggerStopChallenge("blocklist", {
        ...baseSettings,
        stop_challenge_lockdown: false,
        stop_challenge_focus: false,
      })
    ).toBe(false);
  });

  it("stops immediately when challenge method is none even if switches are on", () => {
    expect(
      shouldTriggerStopChallenge("lockdown", {
        stop_challenge: "none",
        stop_challenge_lockdown: true,
        stop_challenge_focus: true,
      })
    ).toBe(false);
    expect(
      shouldTriggerStopChallenge("blocklist", {
        stop_challenge: "none",
        stop_challenge_lockdown: true,
        stop_challenge_focus: true,
      })
    ).toBe(false);
  });

  it("stops immediately when settings is null", () => {
    expect(shouldTriggerStopChallenge("lockdown", null)).toBe(false);
    expect(shouldTriggerStopChallenge("blocklist", null)).toBe(false);
  });
});
