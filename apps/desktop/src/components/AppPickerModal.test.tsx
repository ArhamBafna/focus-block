/**
 * @vitest-environment happy-dom
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionGlobalConfig } from "framer-motion";
import type { AppBlockTarget } from "../lib/ipc";

// Icons are extracted through Tauri; every call here stands in for a process.
const getAppIcon = vi.fn<(target: AppBlockTarget) => Promise<string | null>>();
const listInstalledApps = vi.fn();

vi.mock("../lib/app-picker", () => ({
  listInstalledApps: () => listInstalledApps(),
  getAppIcon: (target: AppBlockTarget) => getAppIcon(target),
}));

import { AppPickerModal } from "./AppPickerModal";

MotionGlobalConfig.skipAnimations = true;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A promise a test can settle by hand, so it can interleave a keystroke. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const app = (name: string, path: string) => ({
  displayName: name,
  target: { kind: "executable", path } as AppBlockTarget,
  category: "Apps",
});

describe("AppPickerModal icon loading", () => {
  afterEach(() => {
    cleanup();
    getAppIcon.mockReset();
    listInstalledApps.mockReset();
  });

  it("keeps an icon that arrives after a keystroke aborted the batch", async () => {
    const pending = deferred<string | null>();
    listInstalledApps.mockResolvedValue([app("Alpha", "C:\\Apps\\alpha.exe")]);
    getAppIcon.mockReturnValue(pending.promise);

    render(
      <AppPickerModal isOpen onClose={vi.fn()} onToggleApp={vi.fn()} blockedApps={[]} />
    );

    await screen.findByText("Alpha");
    await waitFor(() => expect(getAppIcon).toHaveBeenCalledTimes(1));

    // Typing changes the search term, which tears down the running effect while
    // the extraction for Alpha is still in flight.
    const search = screen.getByPlaceholderText("Search apps...");
    await act(async () => {
      fireEvent.change(search, { target: { value: "Al" } });
    });

    // The extraction finishes after the teardown. Its answer must survive.
    await act(async () => {
      pending.resolve("data:image/png;base64,AAAA");
    });

    await act(async () => {
      fireEvent.change(search, { target: { value: "" } });
    });

    await waitFor(() => {
      expect(document.querySelector('img[src="data:image/png;base64,AAAA"]')).not.toBeNull();
    });
    // And it was never re-extracted: the aborted run's answer was reused.
    expect(getAppIcon).toHaveBeenCalledTimes(1);
  });

  it("does not re-extract an app whose icon extraction returned nothing", async () => {
    listInstalledApps.mockResolvedValue([app("Beta", "C:\\Apps\\beta.exe")]);
    getAppIcon.mockResolvedValue(null);

    render(
      <AppPickerModal isOpen onClose={vi.fn()} onToggleApp={vi.fn()} blockedApps={[]} />
    );

    await screen.findByText("Beta");
    await waitFor(() => expect(getAppIcon).toHaveBeenCalledTimes(1));

    const search = screen.getByPlaceholderText("Search apps...");
    await act(async () => {
      fireEvent.change(search, { target: { value: "Be" } });
    });
    await act(async () => {
      fireEvent.change(search, { target: { value: "" } });
    });

    // The letter placeholder stays, and no second process is spawned for it.
    expect(getAppIcon).toHaveBeenCalledTimes(1);
    expect(document.querySelector('img[src="data:image/png;base64,AAAA"]')).toBeNull();
  });
});
