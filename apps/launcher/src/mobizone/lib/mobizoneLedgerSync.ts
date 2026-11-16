import { authFetch } from "../../lib/authFetch";
import {
  loadMobizoneDb,
  replaceMobizoneDbFromCloud,
  type MobizoneDb,
} from "./mobizoneStore";

export type MobizoneLedgerCloudPayload = {
  branchCode: string;
  revisedAt: string | null;
  db: MobizoneDb | null;
  updatedAt?: string | null;
};

const META_PREFIX = "mobizone-db-meta-v1:";
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
let syncing = false;

function metaKey(branchCode: string): string {
  return `${META_PREFIX}${branchCode || "MAIN"}`;
}

export function getLocalLedgerRevisedAt(branchCode: string): string | null {
  try {
    const raw = localStorage.getItem(metaKey(branchCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { revisedAt?: string };
    return parsed.revisedAt ?? null;
  } catch {
    return null;
  }
}

export function setLocalLedgerRevisedAt(branchCode: string, revisedAt: string): void {
  try {
    localStorage.setItem(metaKey(branchCode), JSON.stringify({ revisedAt }));
  } catch {
    /* ignore */
  }
}

function scrubDbForCloud(db: MobizoneDb): MobizoneDb {
  const raw = JSON.stringify(db).replace(/"(data:[^"]{512,})"/g, '""');
  return JSON.parse(raw) as MobizoneDb;
}

function isDbEmpty(db: MobizoneDb | null | undefined): boolean {
  if (!db) return true;
  return (
    db.devices.length === 0 &&
    db.sales.length === 0 &&
    db.purchases.length === 0 &&
    db.customers.length === 0 &&
    db.ledger.length === 0 &&
    !(db.cashOpeningBalancePkr > 0)
  );
}

function countRows(db: MobizoneDb | null | undefined): number {
  if (!db) return 0;
  return (
    db.devices.length +
    db.sales.length +
    db.purchases.length +
    db.customers.length +
    db.ledger.length +
    db.expenses.length +
    db.vouchers.length
  );
}

export async function fetchCloudMobizoneLedger(
  branchCode: string,
): Promise<MobizoneLedgerCloudPayload | null> {
  const code = encodeURIComponent((branchCode || "MAIN").trim());
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 12_000) : null;
  try {
    const res = await authFetch(
      `/v1/operations/mobizone-ledger?branchCode=${code}`,
      ctrl ? { signal: ctrl.signal } : undefined,
    );
    if (!res.ok) return null;
    return (await res.json()) as MobizoneLedgerCloudPayload;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function pushMobizoneLedgerToCloud(branchCode: string): Promise<boolean> {
  if (!branchCode || syncing) return false;
  const local = loadMobizoneDb(branchCode);
  if (isDbEmpty(local)) return false;
  const revisedAt = getLocalLedgerRevisedAt(branchCode) || new Date().toISOString();
  setLocalLedgerRevisedAt(branchCode, revisedAt);
  const payload = {
    branchCode,
    revisedAt,
    db: scrubDbForCloud(local),
  };
  try {
    const res = await authFetch("/v1/operations/mobizone-ledger", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Debounced push after local writes so laptop ↔ mobile stay aligned. */
export function scheduleMobizoneLedgerPush(branchCode: string, delayMs = 1800): void {
  if (!branchCode) return;
  const prev = pushTimers.get(branchCode);
  if (prev) clearTimeout(prev);
  pushTimers.set(
    branchCode,
    setTimeout(() => {
      pushTimers.delete(branchCode);
      void pushMobizoneLedgerToCloud(branchCode);
    }, delayMs),
  );
}

/**
 * Pull cloud ledger when local is empty or clearly older.
 * Returns true if local DB was replaced from cloud.
 */
export async function pullMobizoneLedgerFromCloud(branchCode: string): Promise<boolean> {
  if (!branchCode || syncing) return false;
  syncing = true;
  try {
    const cloud = await fetchCloudMobizoneLedger(branchCode);
    if (!cloud?.db || isDbEmpty(cloud.db)) return false;

    const local = loadMobizoneDb(branchCode);
    const localAt = getLocalLedgerRevisedAt(branchCode);
    const cloudAt = cloud.revisedAt || cloud.updatedAt || null;

    const preferCloud =
      isDbEmpty(local) ||
      countRows(cloud.db) > countRows(local) * 1.05 ||
      (cloudAt && localAt && cloudAt > localAt) ||
      (cloudAt && !localAt);

    if (!preferCloud) {
      // Local is newer / richer — push so other devices catch up.
      if (!isDbEmpty(local)) void pushMobizoneLedgerToCloud(branchCode);
      return false;
    }

    replaceMobizoneDbFromCloud(branchCode, cloud.db);
    if (cloudAt) setLocalLedgerRevisedAt(branchCode, cloudAt);
    return true;
  } finally {
    syncing = false;
  }
}

/** Manual Sync button — pull then push. */
export async function syncMobizoneLedgerNow(branchCode: string): Promise<"pulled" | "pushed" | "ok" | "offline"> {
  if (!branchCode) return "offline";
  const pulled = await pullMobizoneLedgerFromCloud(branchCode);
  if (pulled) return "pulled";
  const pushed = await pushMobizoneLedgerToCloud(branchCode);
  if (pushed) return "pushed";
  const cloud = await fetchCloudMobizoneLedger(branchCode);
  return cloud ? "ok" : "offline";
}
