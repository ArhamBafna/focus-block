import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

describe("app-picker", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
  });

  it("returns empty array in non-tauri environment", async () => {
    delete (globalThis as any).window;
    const { listInstalledApps } = await import("./app-picker");
    const apps = await listInstalledApps();
    expect(apps).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes list_installed_apps in tauri environment", async () => {
    (globalThis as any).window = { __TAURI_INTERNALS__: {} };
    const mockApps = [
      {
        displayName: "Google Chrome",
        target: { kind: "executable", path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
        iconDataUri: "data:image/png;base64,mock",
        category: "Browsers",
      },
    ];
    invokeMock.mockResolvedValueOnce(mockApps);

    const { listInstalledApps } = await import("./app-picker");
    const apps = await listInstalledApps();

    expect(invokeMock).toHaveBeenCalledWith("list_installed_apps");
    expect(apps).toEqual(mockApps);
  });

  it("resolves null for getAppIcon in non-tauri environment", async () => {
    delete (globalThis as any).window;
    const { getAppIcon } = await import("./app-picker");
    const icon = await getAppIcon({ kind: "executable", path: "C:\\test.exe" });
    expect(icon).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes get_app_icon in tauri environment", async () => {
    (globalThis as any).window = { __TAURI_INTERNALS__: {} };
    const target = { kind: "executable" as const, path: "C:\\test.exe" };
    invokeMock.mockResolvedValueOnce("data:image/png;base64,sampleicon");

    const { getAppIcon } = await import("./app-picker");
    const icon = await getAppIcon(target);

    expect(invokeMock).toHaveBeenCalledWith("get_app_icon", { target });
    expect(icon).toBe("data:image/png;base64,sampleicon");
  });
});
