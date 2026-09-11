import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isOnline, subscribeConnectivity } from "@platform/connectivity";
import { useDataModeStore } from "../stores/dataModeStore";
import { useSessionStore } from "../stores/sessionStore";

function formatAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function SyncStatusChip(): JSX.Element {
  const navigate = useNavigate();
  const [online, setOnline] = useState(isOnline());
  const syncing = useDataModeStore((s) => s.syncing);
  const lastSyncedAt = useDataModeStore((s) => s.lastSyncedAt);
  const lastSyncError = useDataModeStore((s) => s.lastSyncError);
  const connectionMode = useDataModeStore((s) => s.connectionMode);
  const offlineSession = useSessionStore((s) => s.offlineSession);

  useEffect(() => subscribeConnectivity(setOnline), []);

  const label = lastSyncError
    ? "Sync error"
    : syncing
      ? "Syncing"
      : connectionMode === "local_only"
        ? "Local only"
        : !online || offlineSession
          ? "Offline"
          : "Online";

  const tone =
    lastSyncError
      ? "border-red-400/40 bg-red-500/15 text-red-800 dark:text-red-200"
      : syncing
        ? "border-amber-400/40 bg-amber-500/15 text-amber-900 dark:text-amber-100"
        : !online || offlineSession || connectionMode === "local_only"
          ? "border-sky-400/40 bg-sky-500/15 text-sky-900 dark:text-sky-100"
          : "border-emerald-400/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";

  return (
    <button
      type="button"
      onClick={() => navigate("/pops/sync")}
      className={`fixed right-3 top-3 z-[110] rounded-full border px-3 py-1 text-[11px] font-semibold shadow-none ${tone}`}
      title={`Last sync ${formatAgo(lastSyncedAt)}`}
    >
      {label}
    </button>
  );
}
