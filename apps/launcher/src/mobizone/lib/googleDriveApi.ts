import { authFetch } from "../../lib/authFetch";

export type GoogleDriveStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  displayName: string | null;
  connectedAt: string | null;
  folderName: string | null;
  folderId: string | null;
  folderUrl: string | null;
  androidClientId: string | null;
};

export type GoogleDriveUploadResult = {
  fileId: string;
  webViewLink: string | null;
  webContentLink: string | null;
  mimeType: string;
  name: string;
};

export async function fetchGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  const res = await authFetch("/v1/google-drive/status");
  if (!res.ok) {
    return {
      configured: false,
      connected: false,
      email: null,
      displayName: null,
      connectedAt: null,
      folderName: null,
      folderId: null,
      folderUrl: null,
      androidClientId: null,
    };
  }
  return (await res.json()) as GoogleDriveStatus;
}

export function googleDriveWebReturnTo(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:1420/pops/mobizone/google-drive";
  return `${window.location.origin}/pops/mobizone/google-drive`;
}

export async function startGoogleDriveConnect(returnTo?: string): Promise<string> {
  const res = await authFetch("/v1/google-drive/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnTo: returnTo || googleDriveWebReturnTo() }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Could not start Google Drive connect (${res.status})`);
  }
  const data = (await res.json()) as { url: string };
  if (!data.url) throw new Error("Missing Google auth URL");
  return data.url;
}

export async function disconnectGoogleDrive(): Promise<GoogleDriveStatus> {
  const res = await authFetch("/v1/google-drive/disconnect", { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Could not disconnect (${res.status})`);
  }
  return (await res.json()) as GoogleDriveStatus;
}

/** If Drive is connected, upload and return a Drive link; otherwise return the original data URL. */
export async function maybeUploadToGoogleDrive(
  dataUrl: string,
  fileName?: string,
): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  try {
    const status = await fetchGoogleDriveStatus();
    if (!status.configured || !status.connected) return dataUrl;
    const res = await authFetch("/v1/google-drive/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, fileName }),
    });
    if (!res.ok) return dataUrl;
    const uploaded = (await res.json()) as GoogleDriveUploadResult;
    return uploaded.webViewLink || uploaded.webContentLink || dataUrl;
  } catch {
    return dataUrl;
  }
}
