import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  deletePlatformMedia,
  downloadPlatformMedia,
  fetchPlatformMedia,
  fetchPlatformMediaSummary,
  flagPlatformMedia,
  platformMediaAbsoluteUrl,
  reindexPlatformMenuMedia,
  type PlatformMediaAsset,
  type PlatformMediaSummaryRow,
} from "../lib/platformApi";
import {
  saBtnDangerClass,
  saBtnGhostClass,
  saBtnPrimaryClass,
  saCardClass,
  saPageSubClass,
  saPageTitleClass,
  saStatClass,
  saTableHeadClass,
  saTableWrapClass,
} from "./superAdminTheme";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function SuperAdminFilesPage(): JSX.Element {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<PlatformMediaSummaryRow | null>(null);
  const [kindFilter, setKindFilter] = useState<"" | "image" | "video">("");
  const [flagFilter, setFlagFilter] = useState<"" | "flagged" | "approved" | "rejected">("");
  const [review, setReview] = useState<PlatformMediaAsset | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["platform", "media", "summary"],
    queryFn: fetchPlatformMediaSummary,
  });

  const list = useQuery({
    queryKey: [
      "platform",
      "media",
      "list",
      selected?.organizationId,
      selected?.uploadedByUserId,
      kindFilter,
      flagFilter,
    ],
    enabled: Boolean(selected),
    queryFn: () =>
      fetchPlatformMedia({
        organizationId: selected?.organizationId,
        userId: selected?.uploadedByUserId ?? undefined,
        kind: kindFilter || undefined,
        flagStatus: flagFilter || undefined,
        limit: 100,
      }),
  });

  const reindex = useMutation({
    mutationFn: reindexPlatformMenuMedia,
    onSuccess: (r) => {
      setMsg(`Menu reindex: imported ${r.imported}, skipped ${r.skipped}`);
      void qc.invalidateQueries({ queryKey: ["platform", "media"] });
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "Reindex failed"),
  });

  const totals = summary.data?.totals;
  const rows = useMemo(() => summary.data?.byUser ?? [], [summary.data?.byUser]);

  async function onFlag(asset: PlatformMediaAsset, status: "flagged" | "approved" | "rejected" | "none") {
    try {
      await flagPlatformMedia(asset.id, { status });
      setMsg(`Marked ${asset.originalName || asset.id} as ${status}`);
      void qc.invalidateQueries({ queryKey: ["platform", "media"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Flag failed");
    }
  }

  async function onDelete(asset: PlatformMediaAsset) {
    if (!confirm(`Delete ${asset.originalName || asset.id}?`)) return;
    try {
      await deletePlatformMedia(asset.id);
      setMsg("Deleted");
      if (review?.id === asset.id) setReview(null);
      void qc.invalidateQueries({ queryKey: ["platform", "media"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className={saPageTitleClass}>File Manager</h1>
        <p className={saPageSubClass}>
          Per-user media inventory — review, flag, download, delete. Images are compressed on upload.
        </p>
      </div>

      {msg ? <p className="text-sm text-teal-700 dark:text-teal-300">{msg}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={saStatClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users with media</p>
          <p className="mt-1 text-2xl font-bold">{totals?.usersWithMedia ?? "—"}</p>
        </div>
        <div className={saStatClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total size</p>
          <p className="mt-1 text-2xl font-bold">{formatBytes(totals?.totalBytes ?? 0)}</p>
        </div>
        <div className={saStatClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assets</p>
          <p className="mt-1 text-2xl font-bold">{totals?.assetCount ?? "—"}</p>
        </div>
        <div className={saStatClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Flagged</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {totals?.flaggedCount ?? "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={saBtnGhostClass}
          disabled={reindex.isPending}
          onClick={() => reindex.mutate()}
        >
          {reindex.isPending ? "Indexing…" : "Reindex menu uploads"}
        </button>
        <button
          type="button"
          className={saBtnGhostClass}
          onClick={() => void qc.invalidateQueries({ queryKey: ["platform", "media"] })}
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <div className={saTableWrapClass}>
          <table className="min-w-full text-sm">
            <thead className={saTableHeadClass}>
              <tr>
                <th className="px-3 py-2">User / business</th>
                <th className="px-3 py-2">Images</th>
                <th className="px-3 py-2">Videos</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Flagged</th>
              </tr>
            </thead>
            <tbody>
              {summary.isLoading ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>
                    No media registered yet. Uploads from MobiZone (online) and menu reindex appear here.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const active =
                    selected?.organizationId === row.organizationId &&
                    selected?.uploadedByUserId === row.uploadedByUserId;
                  return (
                    <tr
                      key={`${row.organizationId}:${row.uploadedByUserId ?? "none"}`}
                      className={`cursor-pointer border-t border-slate-100 dark:border-white/5 ${
                        active ? "bg-teal-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                      onClick={() => setSelected(row)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-semibold">{row.userEmail}</div>
                        <div className="text-xs text-slate-500">{row.organizationName}</div>
                      </td>
                      <td className="px-3 py-2">{row.imageCount}</td>
                      <td className="px-3 py-2">{row.videoCount}</td>
                      <td className="px-3 py-2 font-medium">{formatBytes(row.totalBytes)}</td>
                      <td className="px-3 py-2">{row.flaggedCount}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={saCardClass}>
          {!selected ? (
            <p className="text-sm text-slate-500">Select a user to review their files.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{selected.userEmail}</p>
                  <p className="text-xs text-slate-500">
                    {selected.organizationName} · {formatBytes(selected.totalBytes)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-[#0B1220]"
                    value={kindFilter}
                    onChange={(e) => setKindFilter(e.target.value as "" | "image" | "video")}
                  >
                    <option value="">All kinds</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                  </select>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-[#0B1220]"
                    value={flagFilter}
                    onChange={(e) =>
                      setFlagFilter(e.target.value as "" | "flagged" | "approved" | "rejected")
                    }
                  >
                    <option value="">All flags</option>
                    <option value="flagged">Flagged</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {list.isLoading ? (
                <p className="mt-4 text-sm text-slate-500">Loading files…</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(list.data?.items ?? []).map((asset) => (
                    <div
                      key={asset.id}
                      className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10"
                    >
                      <button
                        type="button"
                        className="block w-full bg-slate-100 dark:bg-black/30"
                        onClick={() => setReview(asset)}
                      >
                        {asset.kind === "video" ? (
                          <video
                            src={platformMediaAbsoluteUrl(asset.url)}
                            className="h-28 w-full object-cover"
                            muted
                          />
                        ) : (
                          <img
                            src={platformMediaAbsoluteUrl(asset.url)}
                            alt={asset.originalName}
                            className="h-28 w-full object-cover"
                          />
                        )}
                      </button>
                      <div className="space-y-1 p-2 text-[11px]">
                        <div className="truncate font-semibold">{asset.originalName || asset.id}</div>
                        <div className="text-slate-500">
                          {formatBytes(asset.byteSize)} · {asset.flagStatus}
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          <button
                            type="button"
                            className={saBtnGhostClass + " !px-2 !py-1 !text-[11px]"}
                            onClick={() => setReview(asset)}
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            className={saBtnGhostClass + " !px-2 !py-1 !text-[11px]"}
                            onClick={() => void onFlag(asset, "flagged")}
                          >
                            Flag
                          </button>
                          <button
                            type="button"
                            className={saBtnGhostClass + " !px-2 !py-1 !text-[11px]"}
                            onClick={() =>
                              void downloadPlatformMedia(asset.id, asset.originalName || "media")
                            }
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            className={saBtnDangerClass + " !px-2 !py-1 !text-[11px]"}
                            onClick={() => void onDelete(asset)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(list.data?.items ?? []).length === 0 ? (
                    <p className="col-span-full text-sm text-slate-500">No files for this filter.</p>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {review ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 dark:bg-[#111827]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{review.originalName}</p>
                <p className="text-xs text-slate-500">
                  {formatBytes(review.byteSize)} · {review.mimeType} · {review.flagStatus}
                </p>
              </div>
              <button type="button" className={saBtnGhostClass} onClick={() => setReview(null)}>
                Close
              </button>
            </div>
            {review.kind === "video" ? (
              <video
                src={platformMediaAbsoluteUrl(review.url)}
                controls
                className="max-h-[60vh] w-full rounded-xl bg-black"
              />
            ) : (
              <img
                src={platformMediaAbsoluteUrl(review.url)}
                alt={review.originalName}
                className="max-h-[60vh] w-full rounded-xl object-contain"
              />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={saBtnPrimaryClass}
                onClick={() => void onFlag(review, "approved")}
              >
                Approve
              </button>
              <button
                type="button"
                className={saBtnGhostClass}
                onClick={() => void onFlag(review, "flagged")}
              >
                Flag
              </button>
              <button
                type="button"
                className={saBtnGhostClass}
                onClick={() => void onFlag(review, "rejected")}
              >
                Reject
              </button>
              <button
                type="button"
                className={saBtnGhostClass}
                onClick={() =>
                  void downloadPlatformMedia(review.id, review.originalName || "media")
                }
              >
                Download
              </button>
              <button
                type="button"
                className={saBtnDangerClass}
                onClick={() => void onDelete(review)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
