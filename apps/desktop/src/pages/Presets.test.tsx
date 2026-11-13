/**
 * @vitest-environment happy-dom
 *
 * Presets page: starting a preset must call startSession with the preset's own
 * values, surface backend failures as a visible error, and never leave the
 * button appearing idle while a start is in flight.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Presets from "./Presets";

vi.mock("../lib/ipc", () => ({
  ipc: {
    listPresets: vi.fn(),
    createPreset: vi.fn(),
    deletePreset: vi.fn(),
    startSession: vi.fn(),
  },
}));

import { ipc } from "../lib/ipc";

const listPresets = vi.mocked(ipc.listPresets);
const deletePreset = vi.mocked(ipc.deletePreset);
const startSession = vi.mocked(ipc.startSession);

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function preset(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Deep Work",
    mode: "blocklist",
    duration_minutes: 40,
    blocklist: ["youtube.com", "instagram.com"],
    whitelist: [],
    ...overrides,
  } as Awaited<ReturnType<typeof listPresets>>[number];
}

function renderPresets() {
  return render(
    <MemoryRouter initialEntries={["/presets"]}>
      <Routes>
        <Route path="/presets" element={<Presets />} />
        <Route path="*" element={<div data-testid="home-sentinel">home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Presets page", () => {
  it("renders saved presets with mode, duration, and list size", async () => {
    listPresets.mockResolvedValue([preset(), preset({ name: "Lockdown", mode: "lockdown", duration_minutes: 60, blocklist: [] })]);

    await act(async () => {
      renderPresets();
    });

    expect(await screen.findByText("Deep Work")).toBeTruthy();
    expect(screen.getByText("40m")).toBeTruthy();
    expect(screen.getByText("2 sites")).toBeTruthy();
    expect(screen.getByText("Lockdown")).toBeTruthy();
    expect(screen.getByText("Everything")).toBeTruthy();
  });

  it("starts a session with the preset's own values and navigates home", async () => {
    listPresets.mockResolvedValue([preset()]);
    startSession.mockResolvedValue(null);

    await act(async () => {
      renderPresets();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start preset Deep Work" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("home-sentinel")).toBeTruthy();
    });
    expect(startSession).toHaveBeenCalledWith("blocklist", 40, "11111111-1111-1111-1111-111111111111");
  });

  it("shows a visible error and stays put when the start fails", async () => {
    listPresets.mockResolvedValue([preset()]);
    startSession.mockRejectedValue(new Error("Session already active"));

    await act(async () => {
      renderPresets();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start preset Deep Work" }));
    });

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Session already active/)).toBeTruthy();
    expect(screen.queryByTestId("home-sentinel")).toBeNull();
  });

  it("shows a visible error when deleting a preset fails", async () => {
    listPresets.mockResolvedValue([preset()]);
    deletePreset.mockRejectedValue(new Error("Storage write failed"));

    await act(async () => {
      renderPresets();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete preset Deep Work" }));
    });

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Storage write failed/)).toBeTruthy();
  });

  it("disables Start and Delete while a start is in flight", async () => {
    listPresets.mockResolvedValue([preset()]);
    let resolveStart!: () => void;
    startSession.mockImplementation(
      () => new Promise<null>((resolve) => { resolveStart = () => resolve(null); })
    );

    await act(async () => {
      renderPresets();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start preset Deep Work" }));
    });

    expect(screen.getByText("Starting…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Start preset Deep Work" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Delete preset Deep Work" }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      resolveStart();
    });
  });
});
