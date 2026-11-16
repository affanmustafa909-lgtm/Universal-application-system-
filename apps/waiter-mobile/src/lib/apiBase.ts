import Constants from "expo-constants";

/** Same live Railway API as Zivra desktop EXE — all tenants/users are centralized here. */
export const LIVE_API_BASE_URL = "https://backend-system-production-28a3.up.railway.app";
export const LOCAL_API_BASE_URL = "http://127.0.0.1:3000";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function isLocalUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/**
 * Resolve API base for every APK / Expo client.
 * Priority: build-time env → app.config extra → live Railway (never silent localhost in release).
 */
export function getApiBaseUrl(): string {
  const fromProcess = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.EXPO_PUBLIC_API_BASE_URL;
  const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  const raw = normalizeUrl(String(fromProcess || fromExtra || ""));

  if (raw) {
    // Release/store builds must not stick on localhost if a bad .env leaked in.
    if (isLocalUrl(raw) && !__DEV__) {
      return LIVE_API_BASE_URL;
    }
    return raw;
  }

  return __DEV__ ? LOCAL_API_BASE_URL : LIVE_API_BASE_URL;
}
