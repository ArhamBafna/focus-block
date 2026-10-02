/**
 * @vitest-environment jsdom
 *
 * Full desktop flow E2E test.
 * Simulates user journey: Blocklists -> Add Apps Modal -> Select App -> Home -> Focus -> Stop -> History.
 */

import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ipc } from "../lib/ipc";
import * as appPicker from "../lib/app-picker";

vi.mock("../lib/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ipc")>();
  return {
    ...actual,
    ipc: {
      ...actual.ipc,
      getStatusSafe: vi.fn(),
      listAppBlockTargets: vi.fn(),
      addAppBlockTarget: vi.fn(),
      startSession: vi.fn(),
      stopSession: vi.fn(),
      listHistory: vi.fn(),
      listBlocklist: vi.fn(),
      listWhitelist: vi.fn(),
    },
  };
});

vi.mock("../lib/app-picker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/app-picker")>();
  return {
    ...actual,
    listInstalledApps: vi.fn(),
    getCachedInstalledApps: vi.fn(),
    getAppIcon: vi.fn().mockResolvedValue(null),
  };
});

const getStatusSafe = vi.mocked(ipc.getStatusSafe);
const listAppBlockTargets = vi.mocked(ipc.listAppBlockTargets);
const addAppBlockTarget = vi.mocked(ipc.addAppBlockTarget);
const startSession = vi.mocked(ipc.startSession);
const stopSession = vi.mocked(ipc.stopSession);
const listHistory = vi.mocked(ipc.listHistory);
const listBlocklist = vi.mocked(ipc.listBlocklist);
const listWhitelist = vi.mocked(ipc.listWhitelist);
const listInstalledApps = vi.mocked(appPicker.listInstalledApps);

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.clearAllMocks();

  getStatusSafe.mockResolvedValue({
    ok: true,
    data: { health: { running: true, version: "0.1.0" }, active_session: null },
  });
  listAppBlockTargets.mockResolvedValue({ targets: [] });
  listHistory.mockResolvedValue([]);
  listBlocklist.mockResolvedValue([]);
  listWhitelist.mockResolvedValue([]);
  listInstalledApps.mockResolvedValue([
    {
      displayName: "Notepad",
      target: { kind: "executable", path: "C:\\Windows\\System32\\notepad.exe" },
      category: "Desktop App",
      iconDataUri: null,
    },
  ]);
});

afterEach(() => {
  cleanup();
});

describe("Desktop E2E Flow", () => {
  it("completes the full flow: add app -> start session -> stop session -> check history", async () => {
    render(<App />);

    // 1. Initial Load (Home)
    expect(await screen.findByText(/ready to focus/i)).toBeTruthy();

    // 2. Navigate to Blocklists
    const blockLink = screen.getByTitle("Block");
    fireEvent.click(blockLink);
    expect(await screen.findByText(/Blocked Applications/i)).toBeTruthy();

    // 3. Add Application via Add Apps button
    const addAppBtn = await screen.findByRole("button", { name: /Add Apps/i });
    fireEvent.click(addAppBtn);
    expect(await screen.findByText(/Block Applications/i)).toBeTruthy();

    // Select Notepad
    const notepadItem = await screen.findByText("Notepad");
    addAppBlockTarget.mockResolvedValue(1);
    listAppBlockTargets.mockResolvedValue({
      targets: [{ id: 1, target: { kind: "executable", path: "C:\\Windows\\System32\\notepad.exe" } }],
    });
    fireEvent.click(notepadItem);

    await waitFor(() => {
      expect(addAppBlockTarget).toHaveBeenCalled();
    });

    // 4. Navigate back to Home
    const focusLink = screen.getByTitle("Focus");
    fireEvent.click(focusLink);
    expect(await screen.findByText(/ready to focus/i)).toBeTruthy();

    // 5. Start Focus Session
    startSession.mockResolvedValue(null);
    getStatusSafe.mockResolvedValue({
      ok: true,
      data: {
        health: { running: true, version: "0.1.0" },
        active_session: {
          session: {
            id: "test-session",
            preset_id: null,
            mode: "blocklist",
            started_at: new Date().toISOString(),
            planned_duration_sec: 25 * 60,
            ended_at: null,
            status: "active",
            blocklist_snapshot: [],
            whitelist_snapshot: [],
          },
          elapsed_sec: 0,
          remaining_sec: 1500,
        },
      },
    });

    const startBtn = await screen.findByRole("button", { name: /^focus$/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(startSession).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Focus Mode Active/i)).toBeTruthy();

    // 6. Stop Session
    stopSession.mockResolvedValue(null);
    getStatusSafe.mockResolvedValue({
      ok: true,
      data: { health: { running: true, version: "0.1.0" }, active_session: null },
    });

    const stopBtn = await screen.findByRole("button", { name: /Stop Session/i });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(stopSession).toHaveBeenCalled();
    });
    expect(await screen.findByText(/ready to focus/i)).toBeTruthy();

    // 7. Check History
    listHistory.mockResolvedValue([
      {
        id: "test-session",
        preset_id: null,
        mode: "blocklist",
        started_at: new Date().toISOString(),
        planned_duration_sec: 25 * 60,
        ended_at: new Date().toISOString(),
        status: "stopped",
        blocklist_snapshot: [],
        whitelist_snapshot: [],
      },
    ]);

    const historyLink = screen.getByTitle("History");
    fireEvent.click(historyLink);

    expect(await screen.findByText(/blocklist Session/i)).toBeTruthy();
    expect(await screen.findByText(/stopped/i)).toBeTruthy();
  });
});
