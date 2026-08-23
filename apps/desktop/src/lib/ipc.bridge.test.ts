/**
 * Desktop ipc over the real Tauri bridge: every command resolves exactly one
 * typed envelope; transport failure maps to the "unavailable" arm, service
 * errors to the "app" arm, and errors carry their kind (issue #18).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

type IpcModule = typeof import("./ipc");

let mod: IpcModule["ipc"];
let getStatusSafe: IpcModule["ipc"]["getStatusSafe"];

beforeEach(async () => {
  vi.resetModules();
  invokeMock.mockReset();
  // Force the Tauri branch of the isTauri check before the module loads.
  (globalThis as unknown as { window: unknown }).window = { __TAURI_INTERNALS__: {} };
  const imported = await import("./ipc");
  mod = imported.ipc;
  getStatusSafe = imported.ipc.getStatusSafe;
});

/** Every public command except getStatusSafe rejects on failure. */
const everyCommand: [string, () => Promise<unknown>][] = [
  ["ping", () => mod.ping()],
  ["getHealth", () => mod.getHealth()],
  ["getStatus", () => mod.getStatus()],
  ["listBlocklist", () => mod.listBlocklist()],
  ["addBlocklist", () => mod.addBlocklist("news.com")],
  ["removeBlocklist", () => mod.removeBlocklist(1)],
  ["listWhitelist", () => mod.listWhitelist()],
  ["addWhitelist", () => mod.addWhitelist("docs.com")],
  ["removeWhitelist", () => mod.removeWhitelist(2)],
  ["listPresets", () => mod.listPresets()],
  ["createPreset", () => mod.createPreset("Deep Work", "blocklist", 50, ["news.com"], [])],
  ["deletePreset", () => mod.deletePreset("p1")],
  ["startSession", () => mod.startSession("blocklist", 25)],
  ["stopSession", () => mod.stopSession()],
  ["listHistory", () => mod.listHistory()],
  ["clearHistory", () => mod.clearHistory()],
  ["getSettings", () => mod.getSettings()],
  ["updateSettings", () => mod.updateSettings(true)],
];

describe("daemon-down transport failure", () => {
  beforeEach(() => {
    invokeMock.mockRejectedValue(new Error("daemon not running"));
  });

  it.each(everyCommand)("%s surfaces an unavailable-kind rejection", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({
      kind: "unavailable",
      message: "daemon not running",
    });
  });

  it("getStatusSafe resolves the raw unavailable envelope instead of throwing", async () => {
    await expect(getStatusSafe()).resolves.toEqual({
      ok: false,
      kind: "unavailable",
      message: "daemon not running",
    });
  });
});

describe("service application error", () => {
  beforeEach(() => {
    invokeMock.mockResolvedValue({ status: "Err", message: "session already active" });
  });

  it.each(everyCommand)("%s surfaces an app-kind rejection", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({
      kind: "app",
      message: "session already active",
    });
  });

  it("getStatusSafe resolves the raw app envelope instead of throwing", async () => {
    await expect(getStatusSafe()).resolves.toEqual({
      ok: false,
      kind: "app",
      message: "session already active",
    });
  });
});

describe("success payload", () => {
  beforeEach(() => {
    invokeMock.mockResolvedValue({ status: "Ok", data: { payload: true } });
  });

  it.each(everyCommand)("%s unwraps the Ok data", async (_name, run) => {
    await expect(run()).resolves.toEqual({ payload: true });
  });

  it("getStatusSafe wraps the data in an ok envelope", async () => {
    await expect(getStatusSafe()).resolves.toEqual({
      ok: true,
      data: { payload: true },
    });
  });
});

describe("malformed bridge response", () => {
  beforeEach(() => {
    invokeMock.mockResolvedValue({ nonsense: true });
  });

  it("maps an unrecognized response to the unavailable arm", async () => {
    await expect(mod.ping()).rejects.toMatchObject({ kind: "unavailable" });
    await expect(getStatusSafe()).resolves.toMatchObject({ ok: false, kind: "unavailable" });
  });
});
