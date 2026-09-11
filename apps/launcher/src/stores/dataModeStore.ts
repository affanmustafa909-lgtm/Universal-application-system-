import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DataMode = "cloud" | "local";
export type ConnectionMode = "automatic" | "online_preferred" | "local_only";

/** Which API host the desktop/web client calls. Local only. */
export type ApiPreset = "local";

type DataModeState = {
  dataMode: DataMode;
  apiPreset: ApiPreset;
  cloudApiUrl: string;
  lastSyncedAt: string | null;
  connectionMode: ConnectionMode;
  lastSyncError: string | null;
  syncing: boolean;
  setDataMode: (mode: DataMode) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncError: (error: string | null) => void;
  setApiPreset: (preset: ApiPreset) => void;
  setCloudApiUrl: (url: string) => void;
  markSynced: () => void;
};

export const useDataModeStore = create<DataModeState>()(
  persist(
    (set) => ({
      dataMode: "cloud",
      apiPreset: "local",
      cloudApiUrl: "",
      lastSyncedAt: null,
      connectionMode: "automatic",
      lastSyncError: null,
      syncing: false,
      setDataMode: (dataMode) =>
        set({ dataMode, connectionMode: dataMode === "local" ? "local_only" : "automatic" }),
      setConnectionMode: (connectionMode) =>
        set({
          connectionMode,
          dataMode: connectionMode === "local_only" ? "local" : "cloud",
        }),
      setSyncing: (syncing) => set({ syncing }),
      setLastSyncError: (lastSyncError) => set({ lastSyncError }),
      setApiPreset: () => set({ apiPreset: "local" }),
      setCloudApiUrl: () => set({ cloudApiUrl: "" }),
      markSynced: () => set({ lastSyncedAt: new Date().toISOString() }),
    }),
    { name: "platform-data-mode-v2" },
  ),
);

export function isCloudDataMode(): boolean {
  return useDataModeStore.getState().dataMode === "cloud";
}

export function isLocalDataMode(): boolean {
  return useDataModeStore.getState().dataMode === "local";
}

export function shouldAutoSyncToCloud(): boolean {
  const { dataMode, connectionMode } = useDataModeStore.getState();
  return dataMode === "cloud" && connectionMode !== "local_only";
}
