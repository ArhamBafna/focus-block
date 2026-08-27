/**
 * Cross-layer parity: desktop and extension ipc expose getStatusSafe with an
 * identical signature and identical envelope arms (issue #18).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "./memory-storage";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

function installExtensionStorage(getBehavior: "ok" | "reject"): void {
  (globalThis as unknown as { chrome?: unknown }).chrome = {
    runtime: {
      id: "parity-test",
      lastError: undefined,
      // getStatus() pings the background (session:expire) before reading.
      sendMessage: (_message: unknown, callback: (response?: unknown) => void) => {
        callback({ ok: true, result: null });
      },
      getManifest: () => ({ version: "0.0.0" }),
    },
    storage: {
      local: {
        get: getBehavior === "ok" ? async () => ({}) : (() => Promise.reject(new Error("storage dead"))),
        set: async () => undefined,
      },
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  invokeMock.mockReset();
});

describe("getStatusSafe parity", () => {
  it("exposes a zero-argument function on both layers", async () => {
    installExtensionStorage("ok");
    const [desktop, extension] = await Promise.all([import("./ipc"), import("@extension-ipc")]);

    expect(typeof desktop.ipc.getStatusSafe).toBe("function");
    expect(typeof extension.ipc.getStatusSafe).toBe("function");
    expect(desktop.ipc.getStatusSafe.length).toBe(extension.ipc.getStatusSafe.length);
    expect(desktop.ipc.getStatusSafe.length).toBe(0);
  });

  it("returns the same ok-envelope keys from both layers", async () => {
    installExtensionStorage("ok");
    delete (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { localStorage?: unknown }).localStorage = new MemoryStorage();

    // Fresh module instances per layer; resetModules above cleared earlier loads.
    const [desktopMod, extensionMod] = await Promise.all([
      import("./ipc"),
      import("@extension-ipc"),
    ]);

    const [deskEnvelope, extEnvelope] = await Promise.all([
      desktopMod.ipc.getStatusSafe(),
      extensionMod.ipc.getStatusSafe(),
    ]);

    expect(deskEnvelope.ok).toBe(true);
    expect(extEnvelope.ok).toBe(true);
    if (!deskEnvelope.ok || !extEnvelope.ok) return;
    expect(Object.keys(deskEnvelope).sort()).toEqual(Object.keys(extEnvelope).sort());
    expect(typeof deskEnvelope.data.health.running).toBe("boolean");
    expect(typeof extEnvelope.data.health.running).toBe("boolean");
  });

  it("returns the same unavailable arm from both layers when transport dies", async () => {
    installExtensionStorage("reject");
    (globalThis as unknown as { window: unknown }).window = { __TAURI_INTERNALS__: {} };
    invokeMock.mockRejectedValue(new Error("daemon not running"));

    const [desktopMod, extensionMod] = await Promise.all([
      import("./ipc"),
      import("@extension-ipc"),
    ]);

    const [deskEnvelope, extEnvelope] = await Promise.all([
      desktopMod.ipc.getStatusSafe(),
      extensionMod.ipc.getStatusSafe(),
    ]);

    expect(deskEnvelope).toMatchObject({ ok: false, kind: "unavailable" });
    expect(extEnvelope).toMatchObject({ ok: false, kind: "unavailable" });
    expect(Object.keys(deskEnvelope).sort()).toEqual(["kind", "message", "ok"]);
    expect(Object.keys(extEnvelope).sort()).toEqual(["kind", "message", "ok"]);
  });
});
