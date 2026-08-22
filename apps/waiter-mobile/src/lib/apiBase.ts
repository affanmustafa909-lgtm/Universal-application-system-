/** Local API only — hosted/Railway backends are disabled. */
export const LOCAL_API_BASE_URL = "http://127.0.0.1:3000";

export function getApiBaseUrl(): string {
  const fromExpo = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.EXPO_PUBLIC_API_BASE_URL;
  const url = (fromExpo ?? LOCAL_API_BASE_URL).trim().replace(/\/$/, "");
  return url || LOCAL_API_BASE_URL;
}
