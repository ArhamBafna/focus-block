import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "./memory-storage";

type IpcModule = typeof import("./ipc");

let ipc: IpcModule["ipc"];

beforeEach(async () => {
  vi.resetModules();
  delete (globalThis as unknown as { window?: unknown }).window;
  (globalThis as unknown as { localStorage?: unknown }).localStorage = new MemoryStorage();
  const imported = await import("./ipc");
  ipc = imported.ipc;
});

describe("Schedule mock IPC and validation", () => {
  it("starts with an empty schedule list", async () => {
    const list = await ipc.listSchedules();
    expect(list).toEqual([]);
  });

  it("creates, updates, and deletes a schedule", async () => {
    const created = await ipc.createSchedule(
      "09:00",
      "17:00",
      "blocklist",
      [1, 2, 3, 4, 5],
      null
    );
    expect(created.id).toBeDefined();
    expect(created.start_time).toBe("09:00");
    expect(created.end_time).toBe("17:00");
    expect(created.mode).toBe("blocklist");
    expect(created.days_of_week).toEqual([1, 2, 3, 4, 5]);
    expect(created.ends_on).toBeNull();

    let list = await ipc.listSchedules();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);

    const updated = await ipc.updateSchedule(
      created.id,
      "08:30",
      "18:00",
      "lockdown",
      [1, 2, 3],
      null
    );
    expect(updated.start_time).toBe("08:30");
    expect(updated.end_time).toBe("18:00");
    expect(updated.mode).toBe("lockdown");
    expect(updated.days_of_week).toEqual([1, 2, 3]);

    list = await ipc.listSchedules();
    expect(list[0].start_time).toBe("08:30");

    await ipc.deleteSchedule(created.id);
    list = await ipc.listSchedules();
    expect(list).toEqual([]);
  });

  it("rejects invalid start and end times", async () => {
    await expect(
      ipc.createSchedule("17:00", "09:00", "blocklist", [1], null)
    ).rejects.toThrow("End time must be after start time.");

    await expect(
      ipc.createSchedule("invalid", "10:00", "blocklist", [1], null)
    ).rejects.toThrow("Enter valid start and end times.");
  });

  it("rejects overlapping schedules on shared days", async () => {
    await ipc.createSchedule("09:00", "12:00", "blocklist", [1, 2, 3], null);

    // Overlaps on Tuesday (day 2)
    await expect(
      ipc.createSchedule("10:00", "14:00", "lockdown", [2, 4], null)
    ).rejects.toThrow("overlaps with 09:00–12:00");

    // Does not overlap on Friday (day 5)
    await expect(
      ipc.createSchedule("10:00", "14:00", "lockdown", [5], null)
    ).resolves.toBeDefined();
  });
  it("stops active session when active schedule is deleted", async () => {
    const created = await ipc.createSchedule("09:00", "17:00", "lockdown", [1, 2, 3], null);
    const mockSession = {
      id: "sess-1",
      preset_id: null,
      mode: "lockdown" as const,
      started_at: new Date().toISOString(),
      ended_at: null,
      planned_duration_sec: 3600,
      status: "active" as const,
      blocklist_snapshot: [],
      whitelist_snapshot: [],
      scheduled_schedule_id: created.id,
    };
    localStorage.setItem("mock_active_session", JSON.stringify(mockSession));

    let status = await ipc.getStatus();
    expect(status.active_session).toBeDefined();

    await ipc.deleteSchedule(created.id);

    status = await ipc.getStatus();
    expect(status.active_session).toBeNull();
  });
});

