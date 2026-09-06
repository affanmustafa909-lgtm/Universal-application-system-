export const LOCAL_API_URL = "http://127.0.0.1:3000";
export const LIVE_API_URL = "https://backend-system-production-28a3.up.railway.app";
export const ICE_CREAM_LIVE_API_URL = "https://backend-system-production-28a3.up.railway.app";
export const RAILWAY_API_URL = LIVE_API_URL;

function defaultLiveUrl(): string {
  return LIVE_API_URL;
}

type ApiPreset = "local" | "live";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function isLocalUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/** Hosted API baked in at build time via VITE_API_BASE_URL. */
export function getLiveApiUrl(): string {
  const fromEnv = normalizeUrl(import.meta.env.VITE_API_BASE_URL ?? "");
  if (fromEnv && !isLocalUrl(fromEnv)) return fromEnv;
  return defaultLiveUrl();
}

export function describeLiveServer(): {
  url: string;
  dbLabel: string;
} {
  return {
    url: getLiveApiUrl(),
    dbLabel: "Live Railway",
  };
}

export function getApiBaseUrl(): string {
  const fromEnv = normalizeUrl(import.meta.env.VITE_API_BASE_URL ?? "");
  if (fromEnv) return fromEnv;
  return defaultLiveUrl();
}

export function describeApiServer(): {
  preset: ApiPreset;
  liveLabel: string | null;
  url: string;
  dbLabel: string | null;
} {
  const url = getApiBaseUrl();
  const local = isLocalUrl(url);
  return {
    preset: local ? "local" : "live",
    liveLabel: local ? null : "Live",
    url,
    dbLabel: local ? "Local Postgres" : "Live Railway",
  };
}

export function describeApiPreset(_preset?: string): string {
  return getApiBaseUrl();
}
