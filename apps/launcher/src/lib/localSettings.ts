import { eq } from "drizzle-orm";
import { settingsKv, type PlatformSqliteDb } from "@platform/database-sqlite";
import { safeLocalStorageSet } from "./localStorageGuard";

const SQLITE_STORAGE_KEY = "platform-sqlite-v1";
/** Cap browser dump so localStorage stays usable for login/session. */
const MAX_SQLITE_PERSIST_BYTES = 1_500_000;

export async function readSetting<T>(db: PlatformSqliteDb, key: string): Promise<T | null> {
  const rows = await db.select().from(settingsKv).where(eq(settingsKv.key, key)).limit(1);
  const row = rows[0];
  if (!row) return null;
  try {
    return JSON.parse(row.valueJson) as T;
  } catch {
    return null;
  }
}

export async function writeSetting(db: PlatformSqliteDb, key: string, value: unknown): Promise<void> {
  const now = new Date().toISOString();
  const valueJson = JSON.stringify(value);
  const existing = await db.select({ key: settingsKv.key }).from(settingsKv).where(eq(settingsKv.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(settingsKv).set({ valueJson, updatedAt: now }).where(eq(settingsKv.key, key));
    return;
  }
  await db.insert(settingsKv).values({ key, valueJson, updatedAt: now });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function loadPersistedSqliteBytes(): Uint8Array | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem(SQLITE_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    // Preferred compact format: {"e":"b64","d":"..."}
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as { e?: string; d?: string };
      if (parsed.e === "b64" && typeof parsed.d === "string") {
        return base64ToBytes(parsed.d);
      }
    }
    // Legacy: JSON number[] (very large — migrate away on next persist)
    const parsed = JSON.parse(raw) as number[];
    if (Array.isArray(parsed)) return Uint8Array.from(parsed);
    return undefined;
  } catch {
    return undefined;
  }
}

function writeSqliteBytes(bytes: Uint8Array): void {
  if (typeof localStorage === "undefined") return;
  if (bytes.byteLength > MAX_SQLITE_PERSIST_BYTES) {
    // Too big for browser quota — drop dump rather than blocking login.
    try {
      localStorage.removeItem(SQLITE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  const payload = JSON.stringify({ e: "b64", d: bytesToBase64(bytes) });
  try {
    safeLocalStorageSet(SQLITE_STORAGE_KEY, payload);
  } catch {
    try {
      localStorage.removeItem(SQLITE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePersistSqlite(exportBinary: () => Uint8Array): void {
  if (typeof localStorage === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    writeSqliteBytes(exportBinary());
  }, 400);
}

export async function persistSqliteNow(exportBinary: () => Uint8Array): Promise<void> {
  if (typeof localStorage === "undefined") return;
  writeSqliteBytes(exportBinary());
}
