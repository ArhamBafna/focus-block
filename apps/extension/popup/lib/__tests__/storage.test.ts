/**
 * Popup-side reader guard: an archived record left in the active slot is
 * never surfaced as a live session (issue #17).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock, type ChromeMockHandles } from "../../../background/__tests__/chrome-mock";
import { storageGet, type ArchivedSessionRecord } from "../storage";

let mock: ChromeMockHandles;

beforeEach(() => {
  mock = installChromeMock();
});

function archivedRecord(status: "completed" | "stopped"): ArchivedSessionRecord {
  return {
    id: "session-9",
    preset_id: null,
    mode: "blocklist",
    started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    planned_duration_sec: 5 * 60,
    status,
    ended_at: new Date().toISOString(),
    blocklist_snapshot: ["news.com"],
    whitelist_snapshot: [],
  };
}

describe("storageGet active_session", () => {
  it.each(["completed", "stopped"] as const)(
    "refuses to treat a %s record in the active slot as live",
    async (status) => {
      mock.data.set("active_session", archivedRecord(status));
      await expect(storageGet("active_session")).resolves.toBeNull();
    }
  );

  it("returns the live record with the end time forced back to null", async () => {
    const record = { ...archivedRecord("completed"), status: "active" as const, ended_at: null };
    // A partial write leaked an end time into a live record; reader normalizes.
    mock.data.set("active_session", { ...record, ended_at: "2026-08-22T09:00:00.000Z" });

    const result = await storageGet("active_session");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("active");
    expect(result?.ended_at).toBeNull();
  });

  it("falls back to null when nothing occupies the slot", async () => {
    await expect(storageGet("active_session")).resolves.toBeNull();
  });
});
