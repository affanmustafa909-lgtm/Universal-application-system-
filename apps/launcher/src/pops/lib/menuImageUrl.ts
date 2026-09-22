import { getApiBaseUrl } from "../../lib/apiBase";

/**
 * Turn a stored menu image path into a full URL for <img src>.
 * - Absolute http(s) → unchanged
 * - `/shehryar/...` → frontend public assets (Vite / Tauri bundle)
 * - `/uploads/...` → API static files
 */
export function resolveMenuImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (path.startsWith("/shehryar/")) {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${path}`;
    }
    return path;
  }

  return `${getApiBaseUrl()}${path}`;
}
