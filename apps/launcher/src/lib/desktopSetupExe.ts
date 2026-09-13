import { PLATFORM_EDITION } from "./edition";
import { DESKTOP_FEEDS, DESKTOP_REPO } from "./autoUpdateFeeds";

export function isTauriShell(): boolean {
  const w = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    isTauri?: boolean;
  };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__ || w.isTauri);
}

/** Local folder hint shown in UI. */
export const LOCAL_UPDATES_DIR_HINT = "%LOCALAPPDATA%\\POPS\\updates";

export type SetupChannel = "suite" | "distribution";

export function setupExeFileName(channel: SetupChannel, version: string): string {
  if (channel === "distribution") {
    return `Medical-Distribution-System_${version}_x64-setup.exe`;
  }
  return `POPS-Universal-Management-System_${version}_x64-setup.exe`;
}

export function setupExeDownloadUrl(channel: SetupChannel, version: string): string {
  const feed = DESKTOP_FEEDS[channel === "suite" ? "suite" : "distribution"];
  return feed.downloadTag(version);
}

/** Current app edition → which setup channel to offer on the update banner. */
export function currentSetupChannel(): SetupChannel | null {
  if (PLATFORM_EDITION === "distribution") return "distribution";
  if (PLATFORM_EDITION === "suite") return "suite";
  return null;
}

/**
 * Download setup EXE to local POPS\updates and open the installer.
 * Falls back to browser tab when not running inside Tauri.
 */
export async function downloadAndOpenSetupExe(opts: {
  url: string;
  fileName: string;
}): Promise<{ path: string; mode: "tauri" | "browser" }> {
  if (isTauriShell()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string>("download_and_open_setup_exe", {
      url: opts.url,
      fileName: opts.fileName,
    });
    return { path, mode: "tauri" };
  }
  window.open(opts.url, "_blank", "noopener,noreferrer");
  return { path: opts.url, mode: "browser" };
}

/** Open `%LOCALAPPDATA%\POPS\updates` in Explorer (desktop EXE only). */
export async function openLocalUpdatesFolder(): Promise<string> {
  if (!isTauriShell()) {
    throw new Error("Open folder is only available in the desktop EXE.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("open_updates_folder");
}

export { DESKTOP_REPO };
