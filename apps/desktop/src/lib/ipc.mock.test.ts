/**
 * Desktop ipc over the browser-only localStorage mock path (no service, no
 * Tauri): success and app-error arms, expired-session completion on status
 * reads, and getStatusSafe envelope parity with the extension layer
 * (issue #18).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "./memory-storage";

type IpcModule = typeof import("./ipc");

let ipc: IpcModule["ipc"];

beforeEach(async () => {
  vi.resetModules();
  // Node environment has neither window nor localStorage; their absence is
  // exactly what selects the mock path.
  delete (globalThis as unknown as { window?: unknown }).window;
  (globalThis as unknown as { localStorage?: unknown }).localStorage = new MemoryStorage();
  const imported = await import("./ipc");
  ipc = imported.ipc;
});

describe("localStorage mock path", () => {
  it("resolves successful commands with real data", async () => {
    await expect(ipc.ping()).resolves.toBeNull();
    await expect(ipc.addBlocklist("news.com")).resolves.toBeTypeOf("number");
    await expect(ipc.listBlocklist()).resolves.toEqual([
      { id: expect.any(Number), domain: "news.com" },
    ]);
  });

  it("maps application errors to rejections carrying kind 'app'", async () => {
    await ipc.startSession("blocklist", 25);
    const error = (await ipc
      .startSession("blocklist", 25)
      .catch((e: Error & { kind?: string }) => e)) as Error & { kind?: string };
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("already active");
    expect(error.kind).toBe("app");
  });

  it("getStatusSafe returns the raw envelope instead of throwing", async () => {
    await expect(ipc.getStatusSafe()).resolves.toEqual({
      ok: true,
      data: {
        health: { running: true, version: "0.1.0-mock" },
        active_session: null,
      },
    });
  });

  it("completes an expired session during GetStatus instead of showing stale time", async () => {
    const storage = (globalThis as unknown as { localStorage: MemoryStorage }).localStorage;
    const startedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    storage.setItem(
      "mock_active_session",
      JSON.stringify({
        id: "s1",
        preset_id: null,
        mode: "blocklist",
        started_at: startedAt,
        ended_at: null,
        planned_duration_sec: 5 * 60,
        status: "active",
        blocklist_snapshot: [],
        whitelist_snapshot: [],
      })
    );
    storage.setItem("mock_history", JSON.stringify([]));

    const envelope = await ipc.getStatusSafe();
    expect(envelope.ok).toBe(true);

    if (!envelope.ok) return;
    expect(envelope.data.active_session).toBeNull();

    const history = JSON.parse(storage.getItem("mock_history")!) as Array<{
      id: string;
      status: string;
      ended_at: string;
    }>;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: "s1", status: "completed" });
    expect(typeof history[0].ended_at).toBe("string");

    expect(JSON.parse(storage.getItem("mock_active_session")!)).toBeNull();
  });
});
