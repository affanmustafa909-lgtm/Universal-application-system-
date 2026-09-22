import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { isOnline, subscribeConnectivity } from "@platform/connectivity";
import { getApiBaseUrl, describeApiServer } from "../../../lib/apiBase";
import { LiveServerBadge } from "../../../components/LiveServerBadge";
import { OFFLINE_CAPABILITY_MATRIX } from "../../../lib/offlineCapability";
import {
  countAllPending,
  flushAllOfflineData,
  listSyncErrors,
  pullFromCloud,
} from "../../../lib/offlineSync";
import { getValidAccessToken, OfflineNetworkError, SessionExpiredError } from "../../../lib/authFetch";
import { useDataModeStore, type ConnectionMode } from "../../../stores/dataModeStore";
import { useSessionStore } from "../../../stores/sessionStore";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString();
}

export function SyncPage(): JSX.Element {
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((s) => s.accessToken);
  const email = useSessionStore((s) => s.email);
  const offlineSession = useSessionStore((s) => s.offlineSession);
  const lastOnlineAt = useSessionStore((s) => s.lastOnlineAt);
  const connectionMode = useDataModeStore((s) => s.connectionMode);
  const lastSyncedAt = useDataModeStore((s) => s.lastSyncedAt);
  const setConnectionMode = useDataModeStore((s) => s.setConnectionMode);
  const setSyncing = useDataModeStore((s) => s.setSyncing);
  const setLastSyncError = useDataModeStore((s) => s.setLastSyncError);
  const markSynced = useDataModeStore((s) => s.markSynced);
  const apiInfo = describeApiServer();

  const [online, setOnline] = useState(isOnline());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeConnectivity(setOnline), []);

  const pendingQuery = useQuery({
    queryKey: ["sync", "pending"],
    queryFn: countAllPending,
    refetchInterval: 5000,
  });
  const errorsQuery = useQuery({
    queryKey: ["sync", "errors"],
    queryFn: listSyncErrors,
    refetchInterval: 10_000,
  });

  const pending = pendingQuery.data;
  const pendingTotal =
    (pending?.sales ?? 0) +
    (pending?.distSales ?? 0) +
    (pending?.popsOrders ?? 0) +
    (pending?.cash ?? 0) +
    (pending?.payroll ?? 0) +
    (pending?.outbox ?? 0);

  async function run(kind: "push" | "pull" | "sync") {
    setSyncing(true);
    setLastSyncError(null);
    try {
      const token = await getValidAccessToken();
      const orgId = useSessionStore.getState().claims?.organizationId;
      if (kind === "pull" || kind === "sync") {
        if (orgId) {
          await pullFromCloud(token, orgId);
        }
      }
      if (kind === "push" || kind === "sync") {
        return await flushAllOfflineData(token);
      }
      return null;
    } finally {
      setSyncing(false);
    }
  }

  const mutation = useMutation({
    mutationFn: run,
    onSuccess: (summary, kind) => {
      const uploaded = summary
        ? summary.salesSynced +
          summary.distSalesSynced +
          summary.popsOrdersSynced +
          summary.cashSynced +
          summary.payrollSynced +
          summary.outboxPushed
        : 0;
      const failed = summary
        ? summary.salesFailed +
          summary.distSalesFailed +
          summary.popsOrdersFailed +
          summary.cashFailed +
          summary.payrollFailed
        : 0;
      setLastSyncError(null);
      markSynced();
      setNotice(
        kind === "pull"
          ? "Pull finished. Local unsynced rows were not overwritten."
          : `Cloud sync: ${uploaded} uploaded, ${failed} failed, ${summary?.conflicts ?? 0} conflicts.`,
      );
      setError(null);
      void pendingQuery.refetch();
      void errorsQuery.refetch();
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => {
      const message =
        e instanceof OfflineNetworkError
          ? e.message
          : e instanceof SessionExpiredError
            ? "Session expired — sign in again to sync."
            : e.message;
      setError(message);
      setLastSyncError(message);
      setNotice(null);
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Connection & Sync Center"
        subtitle="Local database is the operational source. Cloud is the multi-device authority. Internet is optional for offline-capable work."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button className="text-xs" disabled={mutation.isPending || !accessToken} onClick={() => mutation.mutate("sync")}>
              {mutation.isPending ? "Syncing…" : "Sync now"}
            </Button>
            <Button className="text-xs" disabled={mutation.isPending || !accessToken} onClick={() => mutation.mutate("push")}>
              Push to cloud
            </Button>
            <Button className="text-xs" disabled={mutation.isPending || !accessToken} onClick={() => mutation.mutate("pull")}>
              Pull latest
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm">
        <Badge tone={online ? "success" : "warning"}>{online ? "Internet: Online" : "Internet: Offline"}</Badge>
        <Badge tone={offlineSession ? "warning" : "info"}>{offlineSession ? "Session: Offline trusted" : "Session: Cloud"}</Badge>
        <Badge tone={connectionMode === "local_only" ? "neutral" : "info"}>
          Sync: {connectionMode === "local_only" ? "Local only" : connectionMode === "online_preferred" ? "Online preferred" : "Automatic"}
        </Badge>
        {apiInfo.preset === "live" ? <Badge tone="info">Live server</Badge> : null}
        <span className="text-slate-400">Last sync · {formatRelativeTime(lastSyncedAt)}</span>
        <span className="text-slate-400">Pending · {pendingTotal}</span>
      </div>

      {offlineSession ? (
        <div className="rounded-lg border border-sky-800/50 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
          Offline trusted session — {email ?? "signed-in user"} · last online{" "}
          {formatRelativeTime(lastOnlineAt)}. Click <strong>Sync now</strong> to reconnect; if the
          session expired you will be asked to sign in again.
        </div>
      ) : null}

      {error?.toLowerCase().includes("sign in") || error?.toLowerCase().includes("session expired") ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          <span>Cloud login expired. Sign in again to resume sync.</span>
          <Button className="text-xs" onClick={() => window.location.assign("/login")}>
            Sign in again
          </Button>
        </div>
      ) : null}

      {connectionMode === "local_only" ? (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          LOCAL ONLY — changes stay on this device. Automatic cloud writes are paused.
        </div>
      ) : null}

      {notice ? <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-300">{notice}</div> : null}
      {error ? <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-2 text-sm text-red-300">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Connection mode</div>
          <p className="text-xs text-slate-400">This controls synchronization, not whether the app works.</p>
          {(["automatic", "online_preferred", "local_only"] as ConnectionMode[]).map((mode) => (
            <label key={mode} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700/80 bg-slate-950/50 p-3">
              <input
                type="radio"
                name="connection-mode"
                className="mt-1 accent-amber-500"
                checked={connectionMode === mode}
                onChange={() => setConnectionMode(mode)}
              />
              <span>
                <span className="block text-sm font-medium text-white">
                  {mode === "automatic" ? "Automatic" : mode === "online_preferred" ? "Online preferred" : "Offline / local only"}
                </span>
                <span className="block text-xs text-slate-400">
                  {mode === "automatic"
                    ? "Use local data. Sync in the background when the API is reachable."
                    : mode === "online_preferred"
                      ? "Prefer live cloud when connected; continue locally if it drops."
                      : "No automatic cloud writes. Use Push when you choose."}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Health</div>
          <LiveServerBadge showUrl />
          {apiInfo.dbLabel ? <p className="text-xs text-slate-400">{apiInfo.dbLabel}</p> : null}
          <p className="break-all text-xs text-slate-500">{getApiBaseUrl()}</p>
          <ul className="text-xs text-slate-300">
            <li>Sales queue: {pending?.sales ?? 0}</li>
            <li>Dist Sale Window: {pending?.distSales ?? 0}</li>
            <li>POS orders: {pending?.popsOrders ?? 0}</li>
            <li>Cash / payroll: {(pending?.cash ?? 0) + (pending?.payroll ?? 0)}</li>
            <li>Durable outbox: {pending?.outbox ?? 0}</li>
            <li>Failed / conflicts: {(pending?.failed ?? 0) + (pending?.conflicts ?? 0)}</li>
          </ul>
        </div>
      </div>

      {(errorsQuery.data ?? []).length > 0 ? (
        <div className="rounded-lg border border-red-900/40 bg-slate-900/40 p-4">
          <div className="mb-2 text-sm font-medium text-white">Needs attention</div>
          <ul className="space-y-1 text-xs text-slate-300">
            {(errorsQuery.data ?? []).slice(0, 12).map((row) => (
              <li key={row.id}>
                {row.entityType ?? "change"} · {row.status} · {row.errorMessage ?? "see details"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-2 text-sm font-medium text-white">Offline capability (policy)</div>
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">Module</th>
              <th>Read</th>
              <th>Create</th>
              <th>Edit</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {OFFLINE_CAPABILITY_MATRIX.map((row) => (
              <tr key={row.module} className="border-t border-slate-800">
                <td className="py-1">{row.module}</td>
                <td>{row.read ? "Yes" : "No"}</td>
                <td>{String(row.create)}</td>
                <td>{String(row.edit)}</td>
                <td>No</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
