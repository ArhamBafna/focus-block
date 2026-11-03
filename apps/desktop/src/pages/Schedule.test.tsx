/**
 * @vitest-environment happy-dom
 */

import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Schedule from "./Schedule";

vi.mock("../lib/ipc", () => ({
  ipc: {
    listSchedules: vi.fn(),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
  },
}));

import { ipc } from "../lib/ipc";

const listSchedules = vi.mocked(ipc.listSchedules);
const createSchedule = vi.mocked(ipc.createSchedule);
const deleteSchedule = vi.mocked(ipc.deleteSchedule);

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Schedule UI Component", () => {
  it("renders empty state when no schedules exist", async () => {
    listSchedules.mockResolvedValue([]);

    await act(async () => {
      render(<Schedule />);
    });

    expect(screen.getByText("Schedule")).toBeTruthy();
    expect(screen.getByText(/No schedules yet/i)).toBeTruthy();
  });

  it("renders loaded schedules with time, mode, and days", async () => {
    listSchedules.mockResolvedValue([
      {
        id: "s1",
        start_time: "09:00",
        end_time: "17:00",
        mode: "lockdown",
        days_of_week: [1, 2, 3, 4, 5],
        ends_on: null,
      },
    ]);

    await act(async () => {
      render(<Schedule />);
    });

    expect(screen.getAllByText(/Lockdown Mode/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Weekdays/i).length).toBeGreaterThanOrEqual(1);
  });

  it("submits the form to add a new schedule", async () => {
    listSchedules.mockResolvedValue([]);
    createSchedule.mockResolvedValue({
      id: "s2",
      start_time: "09:00",
      end_time: "10:00",
      mode: "blocklist",
      days_of_week: [1, 2, 3, 4, 5],
      ends_on: null,
    });

    await act(async () => {
      render(<Schedule />);
    });

    const submitBtn = screen.getByRole("button", { name: /Add schedule/i });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(createSchedule).toHaveBeenCalledWith(
      "09:00",
      "10:00",
      "blocklist",
      [1, 2, 3, 4, 5],
      null
    );
  });

  it("calls deleteSchedule when trash button is clicked", async () => {
    listSchedules.mockResolvedValue([
      {
        id: "s1",
        start_time: "09:00",
        end_time: "17:00",
        mode: "blocklist",
        days_of_week: [1, 2, 3, 4, 5],
        ends_on: null,
      },
    ]);
    deleteSchedule.mockResolvedValue(null as any);

    await act(async () => {
      render(<Schedule />);
    });

    const deleteBtn = screen.getByRole("button", { name: /Delete 09:00 schedule/i });

    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(deleteSchedule).toHaveBeenCalledWith("s1");
  });
});
