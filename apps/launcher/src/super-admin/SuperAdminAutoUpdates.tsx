import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import launcherPkg from "../../package.json";
import mobilePkg from "../../../waiter-mobile/package.json";
import { fetchAutoUpdateStatus } from "../lib/autoUpdateFeeds";
import { getApiBaseUrl } from "../lib/apiBase";
import {
  downloadAndOpenSetupExe,
  isTauriShell,
  LOCAL_UPDATES_DIR_HINT,
  openLocalUpdatesFolder,
  setupExeDownloadUrl,
  setupExeFileName,
  type SetupChannel,
} from "../lib/desktopSetupExe";
import {
  saBadgeActiveClass,
  saCardClass,
  saMutedClass,
  saSuccessPanelClass,
  saTableBodyClass,
  saTableHeadClass,
  saTableWrapClass,
} from "./superAdminTheme";

function readPackageVersions(): { desktop: string; mobile: string } {
  return {
    desktop: launcherPkg.version,
    mobile: mobilePkg.version,
  };
}

const PRIMARY: Array<{ channel: SetupChannel; feedId: string; title: string; blurb: string }> = [
  {
    channel: "suite",
    feedId: "desktop-suite",
    title: "Universal (Suite)",
    blurb: "POPS Universal Management System — all modules in one EXE",
  },
  {
    channel: "distribution",
    feedId: "desktop-distribution",
    title: "Distribution",
    blurb: "Medical Distribution System — Dist-only EXE",
  },
];

/** Super Admin — auto-update feed status + Universal / Distribution EXE open. */
export function SuperAdminAutoUpdates(): JSX.Element {
  const versions = readPackageVersions();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const feeds = useQuery({
    queryKey: ["auto-update-feeds", versions.desktop, versions.mobile],
    queryFn: () =>
      fetchAutoUpdateStatus({
        desktopVersion: versions.desktop,
        mobileVersion: versions.mobile,
      }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const allLive = feeds.data?.every((f) => f.ok) ?? false;

  async function runDownloadOpen(channel: SetupChannel) {
    setActionErr(null);
    setActionMsg(null);
    const row = feeds.data?.find((f) => f.id === (channel === "suite" ? "desktop-suite" : "desktop-distribution"));
    const version = row?.publishedVersion || versions.desktop;
    const url =
      (row?.publishedUrl && row.publishedUrl.endsWith(".exe")
        ? row.publishedUrl
        : null) || setupExeDownloadUrl(channel, version);
    // Prefer direct .exe asset URL when publishedUrl points at latest-*.json
    const exeUrl = url.endsWith(".json") ? setupExeDownloadUrl(channel, version) : url;
    const fileName = setupExeFileName(channel, version);
    setBusy(channel);
    try {
      const result = await downloadAndOpenSetupExe({ url: exeUrl, fileName });
      setActionMsg(
        result.mode === "tauri"
          ? `Opened installer from local folder:\n${result.path}`
          : `Browser download started for ${fileName}. Run the EXE after it finishes.`,
      );
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Download / open failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={saCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Auto-update (EXE + APK)</p>
          <p className={`mt-1 text-sm ${saMutedClass}`}>
            Builds bake Active server{" "}
            <span className="font-mono text-[11px]">{getApiBaseUrl()}</span>. Primary channels:{" "}
            <strong>Universal</strong> and <strong>Distribution</strong>. Setup EXEs save to{" "}
            <span className="font-mono text-[11px]">{LOCAL_UPDATES_DIR_HINT}</span> then open
            automatically in the desktop app.
          </p>
        </div>
        {feeds.isLoading ? (
          <span className="text-xs text-slate-500">Checking feeds…</span>
        ) : allLive ? (
          <span className={saBadgeActiveClass}>All feeds live</span>
        ) : (
          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
            Publish needed
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {PRIMARY.map((p) => {
          const row = feeds.data?.find((f) => f.id === p.feedId);
          const ver = row?.publishedVersion || versions.desktop;
          return (
            <div
              key={p.channel}
              className="rounded-xl border border-teal-600/20 bg-teal-50/40 p-3 dark:border-teal-500/20 dark:bg-teal-500/10"
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.title}</p>
              <p className={`mt-0.5 text-xs ${saMutedClass}`}>{p.blurb}</p>
              <p className="mt-2 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                Published: {row?.publishedVersion ? `v${row.publishedVersion}` : "—"} · Repo v
                {versions.desktop}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  onClick={() => void runDownloadOpen(p.channel)}
                >
                  {busy === p.channel ? "Downloading…" : "Download & open EXE"}
                </button>
                <a
                  href={setupExeDownloadUrl(p.channel, ver)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white dark:border-white/20 dark:text-slate-200"
                >
                  Direct link
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/5"
          onClick={() => {
            void openLocalUpdatesFolder()
              .then((path) => setActionMsg(`Opened local folder:\n${path}`))
              .catch((e) =>
                setActionErr(
                  e instanceof Error
                    ? e.message
                    : isTauriShell()
                      ? "Could not open folder"
                      : "Open folder works in desktop EXE only — path: " + LOCAL_UPDATES_DIR_HINT,
                ),
              );
          }}
        >
          Open local EXE folder
        </button>
      </div>

      {actionMsg ? (
        <pre className={`${saSuccessPanelClass} mt-3 whitespace-pre-wrap text-xs`}>{actionMsg}</pre>
      ) : null}
      {actionErr ? (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
          {actionErr}
        </p>
      ) : null}

      <div className={`${saTableWrapClass} mt-4`}>
        <table className="min-w-full text-sm">
          <thead className={saTableHeadClass}>
            <tr>
              <th className="px-4 py-2 text-left">Channel</th>
              <th className="px-4 py-2 text-left">Repo version</th>
              <th className="px-4 py-2 text-left">Published</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className={saTableBodyClass}>
            {feeds.isLoading ? (
              <tr>
                <td colSpan={4} className={`px-4 py-4 ${saMutedClass}`}>
                  Loading GitHub update feeds…
                </td>
              </tr>
            ) : (
              (feeds.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2">{row.label}</td>
                  <td className="px-4 py-2 font-mono text-xs">v{row.localVersion}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {row.publishedVersion ? `v${row.publishedVersion}` : "—"}
                    {row.error ? (
                      <div className="text-[10px] text-rose-600 dark:text-rose-300">{row.error}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    {row.ok ? (
                      <span className={saBadgeActiveClass}>Live</span>
                    ) : row.publishedVersion && row.publishedUrl ? (
                      <a
                        href={row.publishedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-700 underline dark:text-teal-300"
                      >
                        Feed v{row.publishedVersion}
                      </a>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300">Pending publish</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {allLive && !feeds.isLoading ? (
        <div className={`${saSuccessPanelClass} mt-4`}>
          Installed apps will auto-update to v{versions.desktop} desktop / v{versions.mobile} mobile on
          next check (live API).
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-white/10 dark:bg-white/5">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Publish Universal + Distribution</p>
        <ol className={`mt-2 list-decimal space-y-1 pl-4 ${saMutedClass}`}>
          <li>
            <code className="rounded bg-slate-900/10 px-1 py-0.5 font-mono dark:bg-black/30">
              pnpm installer:universal
            </code>{" "}
            then{" "}
            <code className="rounded bg-slate-900/10 px-1 py-0.5 font-mono dark:bg-black/30">
              pnpm installer:distribution
            </code>
          </li>
          <li>
            Publish feeds:{" "}
            <code className="rounded bg-slate-900/10 px-1 py-0.5 font-mono dark:bg-black/30">
              pnpm --filter @platform/launcher publish:desktop suite
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-900/10 px-1 py-0.5 font-mono dark:bg-black/30">
              pnpm --filter @platform/launcher publish:desktop distribution
            </code>
          </li>
          <li>
            Open local build folder:{" "}
            <code className="rounded bg-slate-900/10 px-1 py-0.5 font-mono dark:bg-black/30">
              local\open-universal-distribution-exe.bat
            </code>
          </li>
        </ol>
      </div>
    </div>
  );
}
