/** Local API only — hosted/Railway backends are disabled. */
export const LOCAL_API_URL = "http://127.0.0.1:3000";

type ApiPreset = "local";

export function getLiveApiUrl(): string {
  return LOCAL_API_URL;
}

export function describeLiveServer(): {
  url: string;
  dbLabel: string;
} {
  return {
    url: LOCAL_API_URL,
    dbLabel: "Local Postgres",
  };
}

export function describeApiServer(): {
  preset: ApiPreset;
  liveLabel: string | null;
  url: string;
  dbLabel: string | null;
} {
  return {
    preset: "local",
    liveLabel: null,
    url: LOCAL_API_URL,
    dbLabel: "Local Postgres",
  };
}

/** Resolves the API host for the whole app. Always local. */
export function getApiBaseUrl(): string {
  return LOCAL_API_URL;
}

export const LIVE_API_URL = LOCAL_API_URL;
export const RAILWAY_API_URL = LOCAL_API_URL;

export function describeApiPreset(_preset?: string): string {
  return LOCAL_API_URL;
}
