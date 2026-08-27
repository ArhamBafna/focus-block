/**
 * Popup schedule CRUD: validation arms of validateSchedule exercised through
 * createSchedule/updateSchedule, plus update/delete behavior on known and
 * unknown ids.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock, type ChromeMockHandles } from "../../../background/__tests__/chrome-mock";

type IpcModule = typeof import("../ipc");
type StorageModule = typeof import("../storage");

let mock: ChromeMockHandles;
let ipc: IpcModule["ipc"];
let storage: StorageModule;

beforeEach(async () => {
  vi.resetModules();
  mock = installChromeMock();
  const importedIpc = await import("../ipc");
  ipc = importedIpc.ipc;
  storage = await import("../storage");
});

describe("createSchedule validation", () => {
  it("stores a valid schedule with normalized, sorted, de-duplicated days", async () => {
    const created = await ipc.createSchedule("09:00", "12:00", "blocklist", [3, 1, 3]);

    expect(created.id).toMatch(/^schedule-/);
    expect(created.start_time).toBe("09:00");
    expect(created.end_time).toBe("12:00");
    expect(created.days_of_week).toEqual([1, 3]);
    expect(created.ends_on).toBeNull();

    const stored = await storage.storageGet("schedules");
    expect(stored).toHaveLength(1);
    expect(stored?.[0].id).toBe(created.id);
  });

  it.each([
    ["invalid start time", ["9:00", "10:00"]],
    ["invalid end time", ["09:00", "ten"]],
    ["start not before end", ["12:00", "12:00"]],
    ["end before start", ["12:00", "09:00"]],
  ])("rejects %s", async (_label, [start, end]) => {
    await expect(ipc.createSchedule(start, end, "blocklist")).rejects.toThrow(
      /valid start|after start/
    );
    expect(await storage.storageGet("schedules")).toHaveLength(0);
  });

  it("rejects an empty weekday selection", async () => {
    await expect(ipc.createSchedule("09:00", "12:00", "blocklist", [])).rejects.toThrow(
      /at least one day/
    );
    expect(await storage.storageGet("schedules")).toHaveLength(0);
  });

  it("rejects malformed and past end dates", async () => {
    await expect(
      ipc.createSchedule("09:00", "12:00", "blocklist", undefined, "2026-02-30")
    ).rejects.toThrow(/valid end date/);
    await expect(
      ipc.createSchedule("09:00", "12:00", "blocklist", undefined, "2020-01-01")
    ).rejects.toThrow(/past/);
    expect(await storage.storageGet("schedules")).toHaveLength(0);
  });

  it("rejects an overlapping window on a shared day", async () => {
    await ipc.createSchedule("09:00", "12:00", "blocklist", [1, 2]);
    await expect(ipc.createSchedule("11:00", "13:00", "blocklist", [2])).rejects.toThrow(
      /overlaps with 09:00/
    );
    expect(await storage.storageGet("schedules")).toHaveLength(1);
  });

  it("allows touching windows on disjoint days", async () => {
    await ipc.createSchedule("09:00", "12:00", "blocklist", [1]);
    await expect(ipc.createSchedule("12:00", "14:00", "lockdown", [2])).resolves.toMatchObject({
      start_time: "12:00",
      mode: "lockdown",
    });
    expect(await storage.storageGet("schedules")).toHaveLength(2);
  });
});

describe("updateSchedule", () => {
  it("replaces fields and excludes itself from overlap checks", async () => {
    const created = await ipc.createSchedule("09:00", "12:00", "blocklist", [1]);

    const updated = await ipc.updateSchedule(created.id, "10:00", "13:00", "lockdown", [1], null);

    expect(updated).toMatchObject({ id: created.id, start_time: "10:00", mode: "lockdown" });
    const stored = await storage.storageGet("schedules");
    expect(stored).toHaveLength(1);
    expect(stored?.[0]).toMatchObject(updated);
  });

  it("still rejects overlaps against other schedules while excluding itself", async () => {
    const first = await ipc.createSchedule("09:00", "12:00", "blocklist", [1]);
    await ipc.createSchedule("14:00", "16:00", "blocklist", [1]);

    // Overlapping a *different* schedule still rejects.
    await expect(ipc.updateSchedule(first.id, "15:00", "17:00", "blocklist", [1], null)).rejects.toThrow(
      /overlaps/
    );
    // Overlapping only its own stored shape is legal (self-exclusion).
    await expect(
      ipc.updateSchedule(first.id, "10:30", "11:30", "blocklist", [1], null)
    ).resolves.toMatchObject({ start_time: "10:30" });
  });

  it("reports a vanished schedule instead of resurrecting it", async () => {
    await expect(
      ipc.updateSchedule("missing-id", "09:00", "12:00", "blocklist", [1], null)
    ).rejects.toThrow("Schedule no longer exists.");
    expect(await storage.storageGet("schedules")).toHaveLength(0);
  });
});

describe("deleteSchedule", () => {
  it("removes the matching schedule and tolerates unknown ids", async () => {
    const first = await ipc.createSchedule("09:00", "12:00", "blocklist", [1]);
    await ipc.createSchedule("14:00", "16:00", "blocklist", [1]);

    await expect(ipc.deleteSchedule(first.id)).resolves.toBeNull();
    let stored = await storage.storageGet("schedules");
    expect(stored).toHaveLength(1);
    expect(stored?.[0].start_time).toBe("14:00");

    // Unknown id: silent success, nothing changes.
    await expect(ipc.deleteSchedule("nope")).resolves.toBeNull();
    stored = await storage.storageGet("schedules");
    expect(stored).toHaveLength(1);
  });
});
