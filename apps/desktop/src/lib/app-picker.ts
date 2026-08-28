import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppBlockTarget } from "./ipc";

export interface DiscoveredApp {
  displayName: string;
  target: AppBlockTarget;
  iconDataUri?: string | null;
  category: string;
}

export interface StoreApp {
  displayName: string;
  packageFamilyName: string;
}

export async function pickExecutable(): Promise<string | null> {
  const result = await open({
    multiple: false,
    filters: [{ name: "Windows applications", extensions: ["exe"] }],
  });
  return typeof result === "string" ? result : null;
}

export async function pickFolder(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false });
  return typeof result === "string" ? result : null;
}

export function listInstalledApps(): Promise<DiscoveredApp[]> {
  const isTauri =
    typeof window !== "undefined" &&
    ((window as any).__TAURI_INTERNALS__ !== undefined ||
      (window as any).__TAURI_IPC__ !== undefined);

  if (!isTauri) {
    return Promise.resolve([]);
  }
  return invoke<DiscoveredApp[]>("list_installed_apps");
}

export function listStoreApps(): Promise<StoreApp[]> {
  return invoke<StoreApp[]>("list_store_apps");
}

export function getAppIcon(target: AppBlockTarget): Promise<string | null> {
  const isTauri =
    typeof window !== "undefined" &&
    ((window as any).__TAURI_INTERNALS__ !== undefined ||
      (window as any).__TAURI_IPC__ !== undefined);

  if (!isTauri) {
    return Promise.resolve(null);
  }
  return invoke<string | null>("get_app_icon", { target });
}
