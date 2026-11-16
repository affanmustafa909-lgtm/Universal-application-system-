/**
 * Browser localStorage is ~5MB. Heavy caches can fill it so tiny writes like
 * platform-session-v1 fail. Mobizone ledgers are NEVER sacrificed — they live
 * primarily in IndexedDB; any leftover localStorage copies stay protected.
 */

const PROTECTED_KEYS = new Set([
  "platform-session-v1",
  "platform-system-v1",
  "platform-device-id-v1",
  "platform-installed-system-v1",
]);

const PROTECTED_PREFIXES = [
  "mobizone-db-v",
  "mobizone-db-meta-v1:",
  "mobizone-receipt-settings-v1:",
];

/** Drop these first — rebuildable / caches / bulky offline blobs. */
const SACRIFICE_EXACT = [
  "platform-sqlite-v1",
  "pops-print-history-v1",
  "pops-kitchen-completed-v1",
  "pops-org-users-print-cache-v1",
  "dist-offline-sales-v1",
];

const SACRIFICE_PREFIXES = [
  "pops-waiter-drafts-",
  "pops-waiter-last-order-",
  "pops-ice-cream-sheet-",
  "dist-sale-hold-",
  "store-pos-display:",
];

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as DOMException;
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e.code === 22 ||
    e.code === 1014
  );
}

function isProtectedKey(key: string): boolean {
  if (PROTECTED_KEYS.has(key)) return true;
  return PROTECTED_PREFIXES.some((p) => key.startsWith(p));
}

function listKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

function keySize(key: string): number {
  try {
    return (localStorage.getItem(key) ?? "").length + key.length;
  } catch {
    return 0;
  }
}

/** Approximate used bytes (UTF-16 ≈ 2 bytes/char in Chromium quota accounting). */
export function estimateLocalStorageBytes(): number {
  if (typeof localStorage === "undefined") return 0;
  let total = 0;
  for (const key of listKeys()) total += keySize(key);
  return total * 2;
}

/**
 * Free space for critical writes (login session). Prefer caches / sqlite first.
 * Never deletes Mobizone ledger or receipt settings.
 */
export function reclaimLocalStorageSpace(opts?: { keepSession?: boolean }): number {
  if (typeof localStorage === "undefined") return 0;
  let freed = 0;
  const protect = new Set(PROTECTED_KEYS);
  if (opts?.keepSession === false) protect.delete("platform-session-v1");

  const remove = (key: string) => {
    if (protect.has(key) || isProtectedKey(key)) return;
    const size = keySize(key);
    try {
      localStorage.removeItem(key);
      freed += size;
    } catch {
      /* ignore */
    }
  };

  for (const key of SACRIFICE_EXACT) remove(key);

  for (const key of listKeys()) {
    if (protect.has(key) || isProtectedKey(key)) continue;
    if (SACRIFICE_PREFIXES.some((p) => key.startsWith(p))) remove(key);
  }

  // Still tight? Drop largest unprotected non-Mobizone keys.
  if (estimateLocalStorageBytes() > 3_500_000) {
    const ranked = listKeys()
      .filter((k) => !protect.has(k) && !isProtectedKey(k))
      .map((k) => ({ k, size: keySize(k) }))
      .sort((a, b) => b.size - a.size);
    for (const { k } of ranked.slice(0, 8)) remove(k);
  }

  return freed;
}

export function safeLocalStorageSet(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
    return;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }

  reclaimLocalStorageSpace({ keepSession: key === "platform-session-v1" ? false : true });
  try {
    localStorage.setItem(key, value);
    return;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }

  // Last resort: wipe everything except the key we're writing + core identity + Mobizone.
  for (const k of listKeys()) {
    if (
      k === key ||
      k === "platform-device-id-v1" ||
      k === "platform-installed-system-v1" ||
      isProtectedKey(k)
    ) {
      continue;
    }
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  localStorage.setItem(key, value);
}

/** Call once at boot so login can persist before anything else fills the quota. */
export function ensureLocalStorageHeadroom(): void {
  if (typeof localStorage === "undefined") return;
  const probe = "__platform_quota_probe__";
  try {
    localStorage.setItem(probe, "x".repeat(50_000));
    localStorage.removeItem(probe);
  } catch (err) {
    try {
      localStorage.removeItem(probe);
    } catch {
      /* ignore */
    }
    if (isQuotaError(err)) {
      reclaimLocalStorageSpace();
    }
  }
}

export function createGuardedWebStorage(): Storage {
  return {
    get length() {
      return localStorage.length;
    },
    clear: () => localStorage.clear(),
    getItem: (key) => localStorage.getItem(key),
    key: (index) => localStorage.key(index),
    removeItem: (key) => localStorage.removeItem(key),
    setItem: (key, value) => safeLocalStorageSet(key, value),
  };
}
