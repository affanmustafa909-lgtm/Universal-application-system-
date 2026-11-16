import { useCallback, useEffect, useState } from "react";
import { mutedClass } from "../../pops/lib/themeClasses";
import {
  disconnectGoogleDrive,
  fetchGoogleDriveStatus,
  startGoogleDriveConnect,
  type GoogleDriveStatus,
} from "../lib/googleDriveApi";
import {
  MzPage,
  MzPrimaryButton,
  MzScreenTitle,
  MzSecondaryButton,
  MzSection,
} from "../ui/MobizoneUi";

export function MobizoneGoogleDrivePage(): JSX.Element {
  const [status, setStatus] = useState<GoogleDriveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchGoogleDriveStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // After Google OAuth popup/tab finishes, refresh status automatically.
  useEffect(() => {
    function onMessage(ev: MessageEvent): void {
      const data = ev.data as { source?: string; status?: string } | null;
      if (!data || data.source !== "mz-google-drive") return;
      void refresh().then(() => {
        setMsg(
          data.status === "connected"
            ? "Google Drive connected — status refreshed."
            : "Google Drive connect finished — check status.",
        );
      });
    }
    function onStorage(ev: StorageEvent): void {
      if (ev.key !== "mz-google-drive-oauth" || !ev.newValue) return;
      void refresh().then(() => setMsg("Google Drive connected — status refreshed."));
    }
    function onFocus(): void {
      void refresh();
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function onConnect(): Promise<void> {
    setBusy(true);
    setMsg(null);
    try {
      const url = await startGoogleDriveConnect();
      // Named popup so Google callback can window.close() + postMessage back.
      const popup = window.open(url, "mz_google_drive", "width=520,height=720");
      if (!popup) {
        window.location.assign(url);
        return;
      }
      setMsg("Google window opened — finish sign-in; this page will refresh when done.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect(): Promise<void> {
    setBusy(true);
    setMsg(null);
    try {
      const next = await disconnectGoogleDrive();
      setStatus(next);
      setMsg("Google Drive disconnected. New photos stay in the app only.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MzPage>
      <MzScreenTitle
        title="Google Drive"
        subtitle="Optional — if connected, MobiZone photos & documents upload to this shop’s Drive instead of bloating the API."
      />

      <MzSection title="Connection (optional)">
        {!status ? (
          <p className={mutedClass}>Checking…</p>
        ) : !status.configured ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Server is missing <code className="text-xs">GOOGLE_DRIVE_*</code> env vars. Add them on
            Railway (see <code className="text-xs">local/google-drive.env.example</code>) and redeploy.
          </p>
        ) : status.connected ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">Connected</p>
            <dl className="grid gap-2 rounded-xl border border-[var(--mz-border)] bg-[var(--mz-surface-2,#0f1a22)]/40 px-3 py-3">
              <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
                <dt className={mutedClass}>Google account</dt>
                <dd className="font-medium text-[var(--mz-text)] break-all">
                  {status.email || "—"}
                </dd>
              </div>
              {status.displayName ? (
                <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
                  <dt className={mutedClass}>Name</dt>
                  <dd className="text-[var(--mz-text)]">{status.displayName}</dd>
                </div>
              ) : null}
              {status.connectedAt ? (
                <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
                  <dt className={mutedClass}>Connected since</dt>
                  <dd className="text-[var(--mz-text)]">
                    {new Date(status.connectedAt).toLocaleString()}
                  </dd>
                </div>
              ) : null}
              <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
                <dt className={mutedClass}>Drive folder</dt>
                <dd className="text-[var(--mz-text)] break-all">
                  {status.folderUrl ? (
                    <a
                      className="font-medium text-teal-700 underline dark:text-teal-300"
                      href={status.folderUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {status.folderName || "Open folder"}
                    </a>
                  ) : (
                    <span className="font-medium">{status.folderName || "POPS-MobiZone-…"}</span>
                  )}
                </dd>
              </div>
            </dl>
            {!status.email ? (
              <p className="text-amber-700 dark:text-amber-300">
                Account email missing — click Refresh status once. If still blank, Disconnect then
                Connect again.
              </p>
            ) : null}
            <p className={mutedClass}>
              New camera / document attachments upload into this shop’s Drive folder above.
            </p>
          </div>
        ) : (
          <p className={mutedClass}>
            Not connected. App works as before (local / data URLs). Connect only if you want files on
            the user’s Google Drive.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {status?.configured && !status.connected ? (
            <MzPrimaryButton disabled={busy} onClick={() => void onConnect()}>
              Connect Google Drive
            </MzPrimaryButton>
          ) : null}
          {status?.connected ? (
            <MzSecondaryButton disabled={busy} onClick={() => void onDisconnect()}>
              Disconnect
            </MzSecondaryButton>
          ) : null}
          <MzSecondaryButton disabled={busy} onClick={() => void refresh()}>
            Refresh status
          </MzSecondaryButton>
        </div>
        {msg ? <p className={`mt-3 text-sm ${mutedClass}`}>{msg}</p> : null}
      </MzSection>
    </MzPage>
  );
}
