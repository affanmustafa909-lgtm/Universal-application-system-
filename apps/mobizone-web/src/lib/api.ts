export const LIVE_API_BASE_URL = "https://backend-system-production-28a3.up.railway.app";

export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  return (fromEnv || LIVE_API_BASE_URL).replace(/\/$/, "");
}

export async function apiFetch(path: string, init: RequestInit = {}, token?: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
}
