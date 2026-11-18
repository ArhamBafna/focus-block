/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";

vi.mock("../lib/ipc", () => ({
  ipc: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    checkExtensionBridge: vi.fn(),
    repairExtensionBridge: vi.fn(),
  },
}));

import { ipc } from "../lib/ipc";

const getSettingsMock = vi.mocked(ipc.getSettings);
const checkExtensionBridgeMock = vi.mocked(ipc.checkExtensionBridge);
const repairExtensionBridgeMock = vi.mocked(ipc.repairExtensionBridge);

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Desktop Settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsMock.mockResolvedValue({ os_allowlist_enabled: true });
    checkExtensionBridgeMock.mockResolvedValue({
      linked: true,
      manifest_path: "C:\\path\\com.focusblock.bridge.json",
      host_path: "C:\\path\\focus-native-host.exe",
      message: "Bridge healthy",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders linked extension status when healthy", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Extension linked")).toBeTruthy();
    });

    expect(screen.queryByText("Repair")).toBeNull();
  });

  it("renders unlinked extension status and repair button when not linked", async () => {
    checkExtensionBridgeMock.mockResolvedValue({
      linked: false,
      manifest_path: null,
      host_path: null,
      message: "Registry key not found",
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Extension not linked")).toBeTruthy();
      expect(screen.getByText("Repair")).toBeTruthy();
    });
  });

  it("repairs extension bridge when Repair button is clicked", async () => {
    checkExtensionBridgeMock.mockResolvedValueOnce({
      linked: false,
      manifest_path: null,
      host_path: null,
      message: "Registry key not found",
    });
    repairExtensionBridgeMock.mockResolvedValueOnce({
      linked: true,
      manifest_path: "C:\\path\\com.focusblock.bridge.json",
      host_path: "C:\\path\\focus-native-host.exe",
      message: "Repaired",
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Repair")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Repair"));

    await waitFor(() => {
      expect(repairExtensionBridgeMock).toHaveBeenCalled();
      expect(screen.getByText("Extension linked")).toBeTruthy();
    });
  });

  it("still renders extension bridge status and repair button when getSettings fails", async () => {
    getSettingsMock.mockRejectedValueOnce(new Error("Connection refused"));
    checkExtensionBridgeMock.mockResolvedValueOnce({
      linked: false,
      manifest_path: null,
      host_path: null,
      message: "Registry key not found",
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText("Connection refused")).toBeTruthy();
      expect(screen.getByText("Extension not linked")).toBeTruthy();
      expect(screen.getByText("Repair")).toBeTruthy();
    });
  });
});
