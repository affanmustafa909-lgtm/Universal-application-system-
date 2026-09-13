import { createOfflineQueue, type OfflineQueueEntry } from "@platform/connectivity";
import type { SaleBookBody, SaleCustomerHit, SaleProductHit } from "../../pharmacy/api/pharmacy-sales";

const OFFLINE_QUEUE_KEY = "dist-sale-offline-queue-v1";
const CUSTOMER_CACHE_KEY = "dist-sale-customer-cache-v1";
const PRODUCT_CACHE_KEY = "dist-sale-product-cache-v1";
const MAX_CACHE_PER_BRANCH = 200;

export type DistOfflineSalePayload = SaleBookBody & {
  /** Display-only — helps Sync / Held UI before cloud replay. */
  customerName?: string;
  totalPkr?: number;
};

export type DistOfflineSaleEntry = OfflineQueueEntry<DistOfflineSalePayload>;

const offlineSales = createOfflineQueue<DistOfflineSalePayload>(OFFLINE_QUEUE_KEY);

export function enqueueDistOfflineSale(payload: DistOfflineSalePayload): DistOfflineSaleEntry {
  return offlineSales.enqueue(payload);
}

export function loadDistOfflineSales(): DistOfflineSaleEntry[] {
  return offlineSales.load();
}

export function removeDistOfflineSale(id: string): void {
  offlineSales.remove(id);
}

export function bumpDistOfflineSaleAttempt(id: string): void {
  offlineSales.markAttempt(id);
}

type BranchCache<T> = Record<string, T[]>;

function readBranchCache<T>(key: string, branchCode: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BranchCache<T>;
    return Array.isArray(parsed[branchCode]) ? parsed[branchCode]! : [];
  } catch {
    return [];
  }
}

function writeBranchCache<T extends { id: string }>(key: string, branchCode: string, rows: T[]): void {
  try {
    const raw = localStorage.getItem(key);
    const parsed = (raw ? (JSON.parse(raw) as BranchCache<T>) : {}) as BranchCache<T>;
    const existing = Array.isArray(parsed[branchCode]) ? parsed[branchCode]! : [];
    const byId = new Map<string, T>();
    for (const row of [...rows, ...existing]) {
      if (row?.id) byId.set(row.id, row);
    }
    parsed[branchCode] = [...byId.values()].slice(0, MAX_CACHE_PER_BRANCH);
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch {
    // ignore quota / private mode
  }
}

export function cacheDistCustomers(branchCode: string, hits: SaleCustomerHit[]): void {
  if (!branchCode || !hits.length) return;
  writeBranchCache(CUSTOMER_CACHE_KEY, branchCode, hits);
}

export function cacheDistProducts(branchCode: string, hits: SaleProductHit[]): void {
  if (!branchCode || !hits.length) return;
  writeBranchCache(PRODUCT_CACHE_KEY, branchCode, hits);
}

function matchesQuery(haystack: string, q: string): boolean {
  return haystack.toLowerCase().includes(q.toLowerCase());
}

export function searchCachedDistCustomers(branchCode: string, q: string): SaleCustomerHit[] {
  const all = readBranchCache<SaleCustomerHit>(CUSTOMER_CACHE_KEY, branchCode);
  const query = q.trim();
  if (!query) return all.slice(0, 40);
  return all
    .filter(
      (c) =>
        matchesQuery(c.name ?? "", query) ||
        matchesQuery(c.code ?? "", query) ||
        matchesQuery(c.phone ?? "", query),
    )
    .slice(0, 40);
}

export function searchCachedDistProducts(branchCode: string, q: string): SaleProductHit[] {
  const all = readBranchCache<SaleProductHit>(PRODUCT_CACHE_KEY, branchCode);
  const query = q.trim();
  if (!query) return all.slice(0, 40);
  return all
    .filter(
      (p) =>
        matchesQuery(p.name ?? "", query) ||
        matchesQuery(p.sku ?? "", query) ||
        matchesQuery(p.barcode ?? "", query) ||
        matchesQuery(p.companyName ?? "", query),
    )
    .slice(0, 40);
}

export function pendingDistOfflineLabel(entry: DistOfflineSaleEntry): string {
  const submit = entry.payload.submit !== false;
  return `${submit ? "PENDING" : "HOLD"}-${entry.id.slice(0, 8).toUpperCase()}`;
}
