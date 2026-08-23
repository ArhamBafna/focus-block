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
