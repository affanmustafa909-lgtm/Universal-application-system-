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

function appVariant(): string {
  return String(
    (Constants.expoConfig?.extra as { appVariant?: string } | undefined)?.appVariant ?? "",
  ).toLowerCase();
}

/**
 * Resolve API base for every APK / Expo client.
 * MobiZone always uses the live Railway API (same users as desktop EXE).
 */
export function getApiBaseUrl(): string {
  // Phone-shop APK must never hit localhost — same accounts as desktop.
  if (appVariant() === "mobizone") {
    return LIVE_API_BASE_URL;
  }

  const fromProcess = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.EXPO_PUBLIC_API_BASE_URL;
  const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  const raw = normalizeUrl(String(fromProcess || fromExtra || ""));

  if (raw) {
    if (isLocalUrl(raw) && !__DEV__) {
      return LIVE_API_BASE_URL;
    }
    return raw;
  }

  return __DEV__ ? LOCAL_API_BASE_URL : LIVE_API_BASE_URL;
}
