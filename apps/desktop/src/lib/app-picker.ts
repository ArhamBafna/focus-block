import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

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

export function listStoreApps(): Promise<StoreApp[]> {
  return invoke<StoreApp[]>("list_store_apps");
}
