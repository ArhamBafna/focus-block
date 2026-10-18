/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppBlockedModal } from "./AppBlockedModal";
import type { BlockedAppEvent } from "../lib/ipc";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AppBlockedModal", () => {
  afterEach(() => {
    cleanup();
  });

  const mockEvent: BlockedAppEvent = {
    app_name: "Zoom",
    executable_path: "C:\\Users\\User\\AppData\\Roaming\\Zoom\\bin\\Zoom.exe",
    timestamp: new Date().toISOString(),
    count: 1,
  };

  it("does not render when isOpen is false", () => {
    render(
      <AppBlockedModal
        event={mockEvent}
        isOpen={false}
        onDismiss={vi.fn()}
        onBackToFocus={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders centered modal with app name and message when open", () => {
    render(
      <AppBlockedModal
        event={mockEvent}
        isOpen={true}
        onDismiss={vi.fn()}
        onBackToFocus={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Zoom Blocked")).toBeTruthy();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName.toLowerCase() === "p" &&
          (el?.textContent?.includes("FocusBlock closed Zoom to protect your focus session") ?? false)
      )
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Back to Focus/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Close alert/i })).toBeTruthy();
  });

  it("displays debounced launch count badge when count > 1", () => {
    const multiEvent: BlockedAppEvent = {
      ...mockEvent,
      count: 4,
    };

    render(
      <AppBlockedModal
        event={multiEvent}
        isOpen={true}
        onDismiss={vi.fn()}
        onBackToFocus={vi.fn()}
      />
    );

    expect(screen.getByText("Blocked 4 launch attempts")).toBeTruthy();
  });

  it("calls onBackToFocus when Back to Focus button is clicked", () => {
    const handleBackToFocus = vi.fn();
    render(
      <AppBlockedModal
        event={mockEvent}
        isOpen={true}
        onDismiss={vi.fn()}
        onBackToFocus={handleBackToFocus}
      />
    );

    const button = screen.getByRole("button", { name: /Back to Focus/i });
    fireEvent.click(button);
    expect(handleBackToFocus).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when close button is clicked", () => {
    const handleDismiss = vi.fn();
    render(
      <AppBlockedModal
        event={mockEvent}
        isOpen={true}
        onDismiss={handleDismiss}
        onBackToFocus={vi.fn()}
      />
    );

    const closeButton = screen.getByRole("button", { name: /Close alert/i });
    fireEvent.click(closeButton);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when Escape key is pressed", () => {
    const handleDismiss = vi.fn();
    render(
      <AppBlockedModal
        event={mockEvent}
        isOpen={true}
        onDismiss={handleDismiss}
        onBackToFocus={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
