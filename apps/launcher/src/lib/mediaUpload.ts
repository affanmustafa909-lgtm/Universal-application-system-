import { uploadPlatformMediaFile } from "./platformApi";

/** data:image/... → Blob for multipart upload */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const bin = atob(m[2]!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Compress-then-upload to Super Admin media registry.
 * Falls back to original data URL / local value when offline or API fails.
 */
export async function compressAndUploadMedia(
  dataUrlOrBlob: string | Blob,
  opts?: { filename?: string; source?: string; organizationId?: string },
): Promise<string> {
  try {
    let blob: Blob;
    let filename = opts?.filename || "upload.jpg";
    if (typeof dataUrlOrBlob === "string") {
      if (!dataUrlOrBlob.startsWith("data:")) return dataUrlOrBlob;
      const b = dataUrlToBlob(dataUrlOrBlob);
      if (!b) return dataUrlOrBlob;
      blob = b;
      if (blob.type.includes("png")) filename = filename.replace(/\.\w+$/, ".png");
      if (blob.type.includes("webp")) filename = filename.replace(/\.\w+$/, ".webp");
      if (blob.type.includes("mp4")) filename = filename.replace(/\.\w+$/, ".mp4");
      if (blob.type.includes("webm")) filename = filename.replace(/\.\w+$/, ".webm");
    } else {
      blob = dataUrlOrBlob;
    }
    const uploaded = await uploadPlatformMediaFile(blob, {
      filename,
      organizationId: opts?.organizationId,
      source: opts?.source ?? "mobizone_sync",
    });
    return uploaded.url;
  } catch {
    return typeof dataUrlOrBlob === "string" ? dataUrlOrBlob : URL.createObjectURL(dataUrlOrBlob);
  }
}
