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

  const offline =
    !online || offlineSession || connectionMode === "local_only";

  const label = lastSyncError
    ? "Sync error"
    : syncing
      ? "Syncing"
      : offline
        ? "Offline"
        : "Online";

  const tone =
    lastSyncError
      ? "border-red-400/40 bg-red-500/15 text-red-800 dark:text-red-200"
      : syncing
        ? "border-amber-400/40 bg-amber-500/15 text-amber-900 dark:text-amber-100"
        : offline
          ? "border-amber-400/40 bg-amber-500/15 text-amber-900 dark:text-amber-100"
          : "border-emerald-400/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";

  const titleBits = [
    lastSyncError ? lastSyncError : null,
    `Last sync ${formatAgo(lastSyncedAt)}`,
    connectionMode === "local_only" ? "Local only mode" : null,
    offlineSession ? "Offline trusted session" : null,
    !online ? "No internet" : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => navigate("/pops/sync")}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-none ${tone}`}
      title={titleBits.join(" · ")}
      aria-label={label}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          lastSyncError ? "bg-red-500" : syncing ? "bg-amber-500" : offline ? "bg-amber-500" : "bg-emerald-500"
        }`}
      />
      {label}
    </button>
  );
}
