/**
 * Phase 7 distribution collections / aging / recovery API client.
 * Prefers `/v1/pharmacy/collections/*`; falls back to legacy distribution
 * collections + dashboard recovery + trade ledger / invoices when routes 404.
 */
import { authFetch } from "../../lib/authFetch";
import {
  createPharmacyCollection,
  fetchDashboardRecovery,
  fetchPharmacyCollections,
  fetchPharmacyDistInvoices,
  fetchPharmacyTradeCustomerLedger,
  fetchPharmacyTradeCustomers,
  type DistDashboardRecovery,
} from "./pharmacy-erp";

const BASE = "/v1/pharmacy/collections";

export class CollectionsApiHttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "CollectionsApiHttpError";
    this.status = status;
    this.details = details;
  }
}

async function parseErrorBody(res: Response): Promise<{ message: string; details?: unknown }> {
  try {
    const j = (await res.json()) as {
      message?: string | string[];
      errors?: unknown;
      details?: unknown;
    };
    const message =
      typeof j.message === "string"
        ? j.message
        : Array.isArray(j.message)
          ? j.message.join(", ")
          : res.statusText || "Request failed";
    return { message, details: j.errors ?? j.details ?? j };
  } catch {
    return { message: res.statusText || "Request failed" };
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) {
    const { message, details } = await parseErrorBody(res);
    throw new CollectionsApiHttpError(res.status, message, details);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const { message, details } = await parseErrorBody(res);
    throw new CollectionsApiHttpError(res.status, message, details);
  }
  return (await res.json()) as T;
}

type QueryValue = string | number | boolean | undefined | null;

function qs(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const str = typeof value === "string" ? value.trim() : String(value);
    if (!str) continue;
    search.set(key, str);
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

function isRouteMissing(err: unknown): boolean {
  if (!(err instanceof CollectionsApiHttpError) || err.status !== 404) return false;
  const m = err.message || "";
  return /Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(m);
}

const capability = {
  dashboard: true,
  collections: true,
  create: true,
  allocate: true,
  aging: true,
  recovery: true,
};

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PageParams = {
  page?: number;
  pageSize?: number;
};

/** Day-based AR buckets (dueDate = invoiceDate + creditDays). */
export type AgingDayBucket =
  | "current"
  | "d1_30"
  | "d31_60"
  | "d61_90"
  | "d91_120"
  | "d120_plus";

export const AGING_BUCKET_ORDER: AgingDayBucket[] = [
  "current",
  "d1_30",
  "d31_60",
  "d61_90",
  "d91_120",
  "d120_plus",
];

export function agingDayBucketLabel(bucket: string): string {
  switch (bucket) {
    case "current":
    case "current_0_30":
      return "Current";
    case "d1_30":
      return "1–30";
    case "d31_60":
      return "31–60";
    case "d61_90":
      return "61–90";
    case "d91_120":
      return "91–120";
    case "d120_plus":
      return "120+";
    default:
      return bucket.replace(/_/g, " ");
  }
}

export function daysPastDue(
  invoiceDate: string | Date | null | undefined,
  creditDays = 0,
  asOf: Date = new Date(),
): number {
  if (!invoiceDate) return 0;
  const base = new Date(invoiceDate);
  if (Number.isNaN(base.getTime())) return 0;
  const due = new Date(base);
  due.setHours(0, 0, 0, 0);
  due.setDate(due.getDate() + Math.max(0, Number(creditDays) || 0));
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}

export function bucketFromDaysPastDue(days: number): AgingDayBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  if (days <= 120) return "d91_120";
  return "d120_plus";
}

/** Map legacy dashboard bucket ids onto Phase-7 day buckets. */
export function normalizeAgingBucketId(raw: string): AgingDayBucket | string {
  const b = String(raw || "").toLowerCase();
  if (b === "current" || b === "current_0_30" || b === "d0_30" || b === "0_30") return "current";
  if (b === "d1_30" || b === "1_30") return "d1_30";
  if (b === "d31_60" || b === "31_60") return "d31_60";
  if (b === "d61_90" || b === "61_90") return "d61_90";
  if (b === "d91_120" || b === "91_120") return "d91_120";
  if (b === "d120_plus" || b === "120_plus" || b === "d61_plus") return "d120_plus";
  return raw;
}

function asPage<T>(items: T[], page = 1, pageSize = 25): PageResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: p,
    pageSize,
    total,
    totalPages,
  };
}

function normalizePage<T>(raw: unknown, fallbackItems?: T[]): PageResult<T> {
  if (Array.isArray(raw)) return asPage(raw as T[], 1, Math.max(25, (raw as T[]).length || 25));
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const fallback = fallbackItems ?? [];
    const items = (
      Array.isArray(o.items) ? o.items : Array.isArray(o.data) ? o.data : fallback
    ) as T[];
    const pageNum = Number(o.page ?? 1);
    const page = pageNum > 0 ? pageNum : 1;
    const sizeNum = Number(o.pageSize ?? o.limit ?? (items.length > 0 ? items.length : 25));
    const pageSize = sizeNum > 0 ? sizeNum : 25;
    const totalNum = Number(o.total ?? items.length);
    const total = Number.isFinite(totalNum) ? totalNum : items.length;
    const pagesNum = Number(o.totalPages ?? Math.max(1, Math.ceil(total / pageSize)));
    const totalPages = pagesNum > 0 ? pagesNum : 1;
    return { items, page, pageSize, total, totalPages };
  }
  return asPage(fallbackItems ?? [], 1, 25);
}

export type CollectionRow = {
  id: string;
  collectionNumber: string;
  tradeCustomerId?: string | null;
  tradeCustomerName?: string | null;
  amountPkr: number;
  paymentMethod?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  reference?: string | null;
  notes?: string | null;
  collectedAt?: string | null;
  createdAt?: string | null;
  allocations?: CollectionAllocation[];
};

export type CollectionAllocation = {
  invoiceId: string;
  invoiceNumber?: string | null;
  amountPkr: number;
  amountDuePkr?: number | null;
};

export type CollectionsDashboard = {
  generatedAt?: string;
  source?: "phase7" | "legacy";
  kpis: {
    collectedTodayPkr: number;
    collectedMonthPkr: number;
    overdueAmountPkr: number;
    overdueCustomers: number;
    openAccounts: number;
    creditExceeded: number;
    todayCount?: number;
    unallocatedPkr?: number;
    pendingCheques?: number;
    bouncedCheques?: number;
  };
  aging: { bucket: AgingDayBucket | string; amount: number; customers: number }[];
  links?: Record<string, string>;
};

export type AgingRow = {
  tradeCustomerId: string;
  code?: string | null;
  name: string;
  areaId?: string | null;
  outstandingPkr: number;
  creditLimitPkr?: number | null;
  creditDays?: number | null;
  bucket: AgingDayBucket;
  daysPastDue: number;
  creditExceeded: boolean;
  overdue: boolean;
  buckets?: Partial<Record<AgingDayBucket, number>>;
};

export type AgingResult = {
  source?: "phase7" | "legacy";
  summary: {
    totalOutstandingPkr: number;
    accounts: number;
    overdueAmountPkr: number;
    overdueCustomers: number;
    creditExceeded: number;
    byBucket: { bucket: AgingDayBucket; amount: number; customers: number }[];
  };
  items: PageResult<AgingRow>;
};

export type RecoveryQueueItem = {
  id: string;
  tradeCustomerId: string;
  code?: string | null;
  name: string;
  outstandingPkr: number;
  creditLimitPkr?: number | null;
  creditDays?: number | null;
  bucket?: AgingDayBucket;
  daysPastDue?: number;
  creditExceeded?: boolean;
  /** Backend uses critical|warning|info; legacy queue uses high|medium|low. */
  priority: "critical" | "warning" | "info" | "high" | "medium" | "low";
  reason: string;
  kind?: string | null;
  reference?: string | null;
  detail?: string | null;
  invoiceId?: string | null;
  collectionId?: string | null;
  promiseId?: string | null;
  lastCollectionAt?: string | null;
};

export type ChequeStatus = "pending" | "deposited" | "cleared" | "bounced" | "cancelled";

export type CreateCollectionInput = {
  branchCode: string;
  tradeCustomerId: string;
  amountPkr: number;
  paymentMethod?: string;
  invoiceId?: string;
  reference?: string;
  notes?: string;
  allocations?: { invoiceId: string; amountPkr: number }[];
  /** Hold as unallocated advance — does not reduce outstanding until allocate. */
  advance?: boolean;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: string;
  chequeStatus?: ChequeStatus;
  idempotencyKey?: string;
};

export type AllocateCollectionInput = {
  collectionId?: string;
  tradeCustomerId: string;
  branchCode: string;
  amountPkr: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  allocations: { invoiceId: string; amountPkr: number }[];
  advance?: boolean;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: string;
  chequeStatus?: ChequeStatus;
};

function mapCollection(row: Record<string, unknown>): CollectionRow {
  return {
    id: String(row.id ?? ""),
    collectionNumber: String(row.collectionNumber ?? row.id ?? ""),
    tradeCustomerId: (row.tradeCustomerId as string) ?? null,
    tradeCustomerName: (row.tradeCustomerName as string) ?? (row.customerName as string) ?? null,
    amountPkr: Number(row.amountPkr ?? 0),
    paymentMethod: (row.paymentMethod as string) ?? null,
    invoiceId: (row.invoiceId as string) ?? null,
    invoiceNumber: (row.invoiceNumber as string) ?? null,
    reference: (row.reference as string) ?? null,
    notes: (row.notes as string) ?? null,
    collectedAt: (row.collectedAt as string) ?? (row.createdAt as string) ?? null,
    createdAt: (row.createdAt as string) ?? null,
    allocations: Array.isArray(row.allocations)
      ? (row.allocations as CollectionAllocation[])
      : undefined,
  };
}

function emptyBucketSummary(): { bucket: AgingDayBucket; amount: number; customers: number }[] {
  return AGING_BUCKET_ORDER.map((bucket) => ({ bucket, amount: 0, customers: 0 }));
}

function dashboardFromLegacy(d: DistDashboardRecovery, extras?: { creditExceeded?: number; openAccounts?: number }): CollectionsDashboard {
  const aging = (d.aging ?? []).map((b) => ({
    bucket: normalizeAgingBucketId(b.bucket),
    amount: Number(b.amount ?? 0),
    customers: Number(b.customers ?? 0),
  }));
  return {
    generatedAt: d.generatedAt,
    source: "legacy",
    kpis: {
      collectedTodayPkr: Number(d.collectionToday ?? 0),
      collectedMonthPkr: Number(d.collectionMonth ?? 0),
      overdueAmountPkr: Number(d.overdueAmount ?? 0),
      overdueCustomers: Number(d.overdueCustomers ?? 0),
      openAccounts: extras?.openAccounts ?? Number(d.overdueCustomers ?? 0),
      creditExceeded: extras?.creditExceeded ?? 0,
    },
    aging,
    links: {
      collections: "/pops/distribution/collections",
      aging: "/pops/distribution/aging",
      recovery: "/pops/distribution/recovery",
    },
  };
}

function worstBucket(buckets: Partial<Record<AgingDayBucket, number>>): {
  bucket: AgingDayBucket;
  daysPastDue: number;
} {
  const order = [...AGING_BUCKET_ORDER].reverse();
  for (const b of order) {
    if (Number(buckets[b] ?? 0) > 0) {
      const days =
        b === "current"
          ? 0
          : b === "d1_30"
            ? 15
            : b === "d31_60"
              ? 45
              : b === "d61_90"
                ? 75
                : b === "d91_120"
                  ? 105
                  : 150;
      return { bucket: b, daysPastDue: days };
    }
  }
  return { bucket: "current", daysPastDue: 0 };
}

function mapAgingRow(raw: Record<string, unknown>): AgingRow {
  const nested = (raw.buckets as Partial<Record<AgingDayBucket, number>> | undefined) ?? {};
  const hasDayFields =
    "currentPkr" in raw ||
    "d1to30Pkr" in raw ||
    "d31to60Pkr" in raw ||
    "d61to90Pkr" in raw ||
    "d91to120Pkr" in raw ||
    "d120plusPkr" in raw;

  let resolvedBuckets: Partial<Record<AgingDayBucket, number>>;
  if (hasDayFields) {
    resolvedBuckets = {
      current: Number(raw.currentPkr ?? 0),
      d1_30: Number(raw.d1to30Pkr ?? 0),
      d31_60: Number(raw.d31to60Pkr ?? 0),
      d61_90: Number(raw.d61to90Pkr ?? 0),
      d91_120: Number(raw.d91to120Pkr ?? 0),
      d120_plus: Number(raw.d120plusPkr ?? 0),
    };
  } else if (Object.keys(nested).length > 0) {
    resolvedBuckets = { ...nested };
  } else if (raw.bucket) {
    const b = normalizeAgingBucketId(String(raw.bucket)) as AgingDayBucket;
    resolvedBuckets = { [b]: Number(raw.outstandingPkr ?? raw.totalDuePkr ?? 0) };
  } else {
    resolvedBuckets = { current: Number(raw.outstandingPkr ?? raw.totalDuePkr ?? 0) };
  }

  const outstanding = Number(raw.totalDuePkr ?? raw.outstandingPkr ?? 0);
  const { bucket, daysPastDue: approx } = worstBucket(resolvedBuckets);
  const days =
    raw.daysPastDue != null && Number.isFinite(Number(raw.daysPastDue))
      ? Number(raw.daysPastDue)
      : approx;
  const limit = Number(raw.creditLimitPkr ?? 0);
  const creditExceeded =
    typeof raw.creditExceeded === "boolean"
      ? raw.creditExceeded
      : limit > 0 && outstanding > limit;
  const overdueAmt =
    Number(resolvedBuckets.d1_30 ?? 0) +
    Number(resolvedBuckets.d31_60 ?? 0) +
    Number(resolvedBuckets.d61_90 ?? 0) +
    Number(resolvedBuckets.d91_120 ?? 0) +
    Number(resolvedBuckets.d120_plus ?? 0);
  const overdue =
    typeof raw.overdue === "boolean" ? raw.overdue : overdueAmt > 0 || days > 0;

  const explicitBucket = AGING_BUCKET_ORDER.includes(raw.bucket as AgingDayBucket)
    ? (raw.bucket as AgingDayBucket)
    : bucket;

  return {
    tradeCustomerId: String(raw.tradeCustomerId ?? ""),
    code: (raw.customerCode as string) ?? (raw.code as string) ?? null,
    name: String(raw.customerName ?? raw.name ?? ""),
    areaId: (raw.areaId as string) ?? null,
    outstandingPkr: outstanding,
    creditLimitPkr: limit || null,
    creditDays: raw.creditDays != null ? Number(raw.creditDays) : null,
    bucket: explicitBucket,
    daysPastDue: days,
    creditExceeded,
    overdue,
    buckets: resolvedBuckets,
  };
}

function summaryFromAgingTotals(
  totals: Record<string, unknown> | undefined,
  items: AgingRow[],
  totalAccounts?: number,
): AgingResult["summary"] {
  if (totals && typeof totals === "object") {
    const byBucket = emptyBucketSummary().map((slot) => {
      const key =
        slot.bucket === "current"
          ? "currentPkr"
          : slot.bucket === "d1_30"
            ? "d1to30Pkr"
            : slot.bucket === "d31_60"
              ? "d31to60Pkr"
              : slot.bucket === "d61_90"
                ? "d61to90Pkr"
                : slot.bucket === "d91_120"
                  ? "d91to120Pkr"
                  : "d120plusPkr";
      return {
        ...slot,
        amount: Number(totals[key] ?? 0),
        customers: items.filter((r) => Number(r.buckets?.[slot.bucket] ?? 0) > 0).length,
      };
    });
    const overdueAmountPkr = byBucket
      .filter((b) => b.bucket !== "current")
      .reduce((s, b) => s + b.amount, 0);
    return {
      totalOutstandingPkr: Number(totals.totalDuePkr ?? overdueAmountPkr + Number(totals.currentPkr ?? 0)),
      accounts: totalAccounts ?? items.length,
      overdueAmountPkr,
      overdueCustomers: items.filter((r) => r.overdue).length,
      creditExceeded: items.filter((r) => r.creditExceeded).length,
      byBucket,
    };
  }
  return summarizeAging(items);
}

function mapRecoveryItem(raw: Record<string, unknown>): RecoveryQueueItem {
  const priorityRaw = String(raw.priority ?? "info").toLowerCase();
  const priority = (
    ["critical", "warning", "info", "high", "medium", "low"].includes(priorityRaw)
      ? priorityRaw
      : "info"
  ) as RecoveryQueueItem["priority"];

  const tradeCustomerId = String(raw.tradeCustomerId ?? "");
  const id = String(
    raw.id ??
      raw.invoiceId ??
      raw.collectionId ??
      raw.promiseId ??
      `${tradeCustomerId}:${raw.kind ?? "item"}:${raw.reference ?? ""}`,
  );

  const bucketRaw = raw.bucket != null ? normalizeAgingBucketId(String(raw.bucket)) : undefined;
  const bucket = AGING_BUCKET_ORDER.includes(bucketRaw as AgingDayBucket)
    ? (bucketRaw as AgingDayBucket)
    : undefined;

  return {
    id,
    tradeCustomerId,
    code: (raw.customerCode as string) ?? (raw.code as string) ?? null,
    name: String(raw.customerName ?? raw.name ?? ""),
    outstandingPkr: Number(raw.amountPkr ?? raw.outstandingPkr ?? 0),
    creditLimitPkr: raw.creditLimitPkr != null ? Number(raw.creditLimitPkr) : null,
    creditDays: raw.creditDays != null ? Number(raw.creditDays) : null,
    bucket,
    daysPastDue: raw.daysPastDue != null ? Number(raw.daysPastDue) : undefined,
    creditExceeded: typeof raw.creditExceeded === "boolean" ? raw.creditExceeded : undefined,
    priority,
    reason: String(raw.detail ?? raw.reason ?? raw.reference ?? raw.kind ?? "Recovery item"),
    kind: (raw.kind as string) ?? null,
    reference: (raw.reference as string) ?? null,
    detail: (raw.detail as string) ?? null,
    invoiceId: (raw.invoiceId as string) ?? null,
    collectionId: (raw.collectionId as string) ?? null,
    promiseId: (raw.promiseId as string) ?? null,
    lastCollectionAt: (raw.lastCollectionAt as string) ?? null,
  };
}

function dashboardFromPhase7Flat(
  raw: Record<string, unknown>,
  extras?: {
    aging?: CollectionsDashboard["aging"];
    openAccounts?: number;
    overdueAmountPkr?: number;
    overdueCustomers?: number;
    creditExceeded?: number;
    collectedMonthPkr?: number;
  },
): CollectionsDashboard {
  return {
    generatedAt: typeof raw.asOf === "string" ? raw.asOf : undefined,
    source: "phase7",
    kpis: {
      collectedTodayPkr: Number(raw.todayPkr ?? raw.collectedTodayPkr ?? 0),
      collectedMonthPkr: Number(extras?.collectedMonthPkr ?? raw.collectedMonthPkr ?? 0),
      overdueAmountPkr: Number(extras?.overdueAmountPkr ?? raw.overdueAmountPkr ?? 0),
      overdueCustomers: Number(extras?.overdueCustomers ?? raw.overdueCustomers ?? 0),
      openAccounts: Number(extras?.openAccounts ?? raw.openAccounts ?? 0),
      creditExceeded: Number(extras?.creditExceeded ?? raw.creditExceeded ?? 0),
      todayCount: Number(raw.todayCount ?? 0),
      unallocatedPkr: Number(raw.unallocatedPkr ?? 0),
      pendingCheques: Number(raw.pendingCheques ?? 0),
      bouncedCheques: Number(raw.bouncedCheques ?? 0),
    },
    aging: extras?.aging ?? emptyBucketSummary(),
    links: {
      collections: "/pops/distribution/collections",
      aging: "/pops/distribution/aging",
      recovery: "/pops/distribution/recovery",
    },
  };
}

async function deriveAgingFromInvoices(branchCode?: string): Promise<AgingRow[]> {
  const [customers, invoices] = await Promise.all([
    fetchPharmacyTradeCustomers(branchCode),
    branchCode ? fetchPharmacyDistInvoices(branchCode) : Promise.resolve([]),
  ]);
  const custById = new Map<string, Record<string, unknown>>();
  for (const c of customers as Record<string, unknown>[]) {
    custById.set(String(c.id), c);
  }

  const bucketMap = new Map<string, Partial<Record<AgingDayBucket, number>>>();
  const maxDays = new Map<string, number>();

  for (const inv of invoices as Record<string, unknown>[]) {
    const due = Number(inv.amountDuePkr ?? inv.outstandingPkr ?? 0);
    if (!(due > 0)) continue;
    const customerId = String(inv.tradeCustomerId ?? "");
    if (!customerId) continue;
    const cust = custById.get(customerId);
    const creditDays = Number(cust?.creditDays ?? inv.creditDays ?? 0);
    const invoiceDate = (inv.invoiceDate as string) ?? (inv.createdAt as string) ?? null;
    const days = daysPastDue(invoiceDate, creditDays);
    const bucket = bucketFromDaysPastDue(days);
    const cur = bucketMap.get(customerId) ?? {};
    cur[bucket] = Number(cur[bucket] ?? 0) + due;
    bucketMap.set(customerId, cur);
    maxDays.set(customerId, Math.max(maxDays.get(customerId) ?? 0, days));
  }

  const rows: AgingRow[] = [];
  for (const c of customers as Record<string, unknown>[]) {
    const outstanding = Number(c.outstandingPkr ?? 0);
    if (!(outstanding > 0)) continue;
    const id = String(c.id);
    const buckets = bucketMap.get(id) ?? { current: outstanding };
    const { bucket, daysPastDue: approxDays } = worstBucket(buckets);
    const days = maxDays.get(id) ?? approxDays;
    const limit = Number(c.creditLimitPkr ?? 0);
    const creditExceeded = limit > 0 && outstanding > limit;
    rows.push({
      tradeCustomerId: id,
      code: (c.code as string) ?? null,
      name: String(c.name ?? ""),
      areaId: (c.areaId as string) ?? null,
      outstandingPkr: outstanding,
      creditLimitPkr: limit || null,
      creditDays: c.creditDays != null ? Number(c.creditDays) : null,
      bucket: bucketFromDaysPastDue(days),
      daysPastDue: days,
      creditExceeded,
      overdue: days > 0,
      buckets,
    });
  }

  return rows.sort((a, b) => b.outstandingPkr - a.outstandingPkr);
}

function summarizeAging(rows: AgingRow[]): AgingResult["summary"] {
  const byBucket = emptyBucketSummary();
  const bucketCustomers = new Map<AgingDayBucket, Set<string>>();
  for (const b of AGING_BUCKET_ORDER) bucketCustomers.set(b, new Set());

  let overdueAmountPkr = 0;
  let overdueCustomers = 0;
  let creditExceeded = 0;

  for (const row of rows) {
    if (row.overdue) {
      overdueAmountPkr += row.outstandingPkr;
      overdueCustomers += 1;
    }
    if (row.creditExceeded) creditExceeded += 1;

    if (row.buckets) {
      for (const b of AGING_BUCKET_ORDER) {
        const amt = Number(row.buckets[b] ?? 0);
        if (amt > 0) {
          const slot = byBucket.find((x) => x.bucket === b)!;
          slot.amount += amt;
          bucketCustomers.get(b)!.add(row.tradeCustomerId);
        }
      }
    } else {
      const slot = byBucket.find((x) => x.bucket === row.bucket)!;
      slot.amount += row.outstandingPkr;
      bucketCustomers.get(row.bucket)!.add(row.tradeCustomerId);
    }
  }

  for (const slot of byBucket) {
    slot.customers = bucketCustomers.get(slot.bucket)?.size ?? 0;
  }

  return {
    totalOutstandingPkr: rows.reduce((s, r) => s + r.outstandingPkr, 0),
    accounts: rows.length,
    overdueAmountPkr,
    overdueCustomers,
    creditExceeded,
    byBucket,
  };
}

function recoveryPriority(row: AgingRow): RecoveryQueueItem["priority"] {
  if (row.creditExceeded || row.bucket === "d120_plus") return "critical";
  if (row.bucket === "d91_120" || row.bucket === "d61_90") return "high";
  if (row.bucket === "d31_60") return "medium";
  return "low";
}

function recoveryReason(row: AgingRow): string {
  const parts: string[] = [];
  if (row.creditExceeded) parts.push("Credit limit exceeded");
  if (row.overdue) parts.push(`${row.daysPastDue}d past due (${agingDayBucketLabel(row.bucket)})`);
  else parts.push("Open balance");
  return parts.join(" · ");
}

export const collectionsOpsApi = {
  async dashboard(params: { branchCode?: string }): Promise<CollectionsDashboard> {
    if (capability.dashboard) {
      try {
        const raw = await getJson<unknown>(
          `${BASE}/dashboard${qs({ branchCode: params.branchCode })}`,
        );
        if (raw && typeof raw === "object" && "kpis" in (raw as object)) {
          return {
            ...(raw as CollectionsDashboard),
            source: (raw as CollectionsDashboard).source ?? "phase7",
          };
        }

        const flat = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        let agingExtras: {
          aging?: CollectionsDashboard["aging"];
          openAccounts?: number;
          overdueAmountPkr?: number;
          overdueCustomers?: number;
          creditExceeded?: number;
        } = {};
        try {
          const agingRes = await collectionsOpsApi.aging({
            branchCode: params.branchCode,
            page: 1,
            pageSize: 1,
          });
          agingExtras = {
            aging: agingRes.summary.byBucket,
            openAccounts: agingRes.summary.accounts,
            overdueAmountPkr: agingRes.summary.overdueAmountPkr,
            overdueCustomers: agingRes.summary.overdueCustomers,
            creditExceeded: agingRes.summary.creditExceeded,
          };
        } catch {
          // Aging optional for dashboard strip.
        }
        return dashboardFromPhase7Flat(flat, agingExtras);
      } catch (err) {
        if (isRouteMissing(err)) capability.dashboard = false;
        else throw err;
      }
    }
    const [recovery, customers] = await Promise.all([
      fetchDashboardRecovery({ branchCode: params.branchCode }),
      fetchPharmacyTradeCustomers(params.branchCode),
    ]);
    const openAccounts = (customers as { outstandingPkr?: number }[]).filter(
      (c) => Number(c.outstandingPkr ?? 0) > 0,
    ).length;
    const creditExceeded = (customers as { outstandingPkr?: number; creditLimitPkr?: number }[]).filter(
      (c) =>
        Number(c.creditLimitPkr ?? 0) > 0 &&
        Number(c.outstandingPkr ?? 0) > Number(c.creditLimitPkr ?? 0),
    ).length;
    return dashboardFromLegacy(recovery, { openAccounts, creditExceeded });
  },

  async list(
    params: PageParams & {
      branchCode: string;
      q?: string;
      tradeCustomerId?: string;
      from?: string;
      to?: string;
    },
  ): Promise<PageResult<CollectionRow>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    if (capability.collections) {
      try {
        const raw = await getJson<unknown>(
          `${BASE}${qs({
            branchCode: params.branchCode,
            q: params.q,
            tradeCustomerId: params.tradeCustomerId,
            from: params.from,
            to: params.to,
            page,
            pageSize,
          })}`,
        );
        const normalized = normalizePage<Record<string, unknown>>(raw);
        let items = normalized.items.map(mapCollection);
        const needNames = items.some((r) => !r.tradeCustomerName && r.tradeCustomerId);
        if (needNames) {
          try {
            const customers = (await fetchPharmacyTradeCustomers(params.branchCode)) as {
              id?: string;
              name?: string;
              code?: string;
            }[];
            const byId = new Map(
              customers.filter((c) => c.id).map((c) => [c.id!, (c.name || c.code || "").trim()]),
            );
            items = items.map((r) => ({
              ...r,
              tradeCustomerName:
                r.tradeCustomerName ||
                (r.tradeCustomerId ? byId.get(r.tradeCustomerId) || null : null),
            }));
          } catch {
            /* best-effort name enrich */
          }
        }
        return { ...normalized, items };
      } catch (err) {
        if (isRouteMissing(err)) capability.collections = false;
        else throw err;
      }
    }
    let rows = ((await fetchPharmacyCollections(params.branchCode)) as Record<string, unknown>[]).map(
      mapCollection,
    );
    if (params.tradeCustomerId) {
      rows = rows.filter((r) => r.tradeCustomerId === params.tradeCustomerId);
    }
    // Enrich names when API only returned UUIDs (legacy / undeployed backends).
    const needNames = rows.some((r) => !r.tradeCustomerName && r.tradeCustomerId);
    if (needNames) {
      try {
        const customers = (await fetchPharmacyTradeCustomers(params.branchCode)) as {
          id?: string;
          name?: string;
          code?: string;
        }[];
        const byId = new Map(
          customers.filter((c) => c.id).map((c) => [c.id!, (c.name || c.code || "").trim()]),
        );
        rows = rows.map((r) => ({
          ...r,
          tradeCustomerName:
            r.tradeCustomerName ||
            (r.tradeCustomerId ? byId.get(r.tradeCustomerId) || null : null),
        }));
      } catch {
        /* best-effort */
      }
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.collectionNumber.toLowerCase().includes(q) ||
          String(r.tradeCustomerName ?? "").toLowerCase().includes(q) ||
          String(r.reference ?? "").toLowerCase().includes(q),
      );
    }
    return asPage(rows, page, pageSize);
  },

  async create(body: CreateCollectionInput): Promise<CollectionRow> {
    const allocations = (body.allocations ?? []).filter((a) => a.amountPkr > 0);

    if (capability.create) {
      try {
        const raw = await postJson<Record<string, unknown>>(BASE, {
          ...body,
          invoiceId: body.invoiceId ?? (allocations.length === 1 ? allocations[0]?.invoiceId : undefined),
          allocations: allocations.length ? allocations : undefined,
        });
        return mapCollection(raw);
      } catch (err) {
        if (isRouteMissing(err)) capability.create = false;
        else throw err;
      }
    }

    // Legacy fallback: one collection per allocation (keeps invoice amountDue in sync).
    if (allocations.length > 1) {
      let last: CollectionRow | null = null;
      for (const alloc of allocations) {
        const raw = (await createPharmacyCollection({
          branchCode: body.branchCode,
          tradeCustomerId: body.tradeCustomerId,
          amountPkr: alloc.amountPkr,
          paymentMethod: body.paymentMethod ?? "Cash",
          invoiceId: alloc.invoiceId,
          reference: body.reference,
          notes: body.notes,
        })) as Record<string, unknown>;
        last = mapCollection(raw);
      }
      return last!;
    }

    const raw = (await createPharmacyCollection({
      branchCode: body.branchCode,
      tradeCustomerId: body.tradeCustomerId,
      amountPkr: body.amountPkr,
      paymentMethod: body.paymentMethod ?? "Cash",
      invoiceId: body.invoiceId ?? allocations[0]?.invoiceId,
      reference: body.reference,
      notes: body.notes,
    })) as Record<string, unknown>;
    return mapCollection(raw);
  },

  async allocate(body: AllocateCollectionInput): Promise<CollectionRow> {
    const allocations = body.allocations.filter((a) => a.amountPkr > 0);

    // Prefer POST /:id/allocate when collectionId is present — there is no POST /allocate.
    if (body.collectionId && capability.allocate) {
      try {
        const raw = await postJson<Record<string, unknown>>(`${BASE}/${body.collectionId}/allocate`, {
          allocations,
        });
        return mapCollection(raw);
      } catch (err) {
        if (isRouteMissing(err)) capability.allocate = false;
        else throw err;
      }
    }

    return this.create({
      branchCode: body.branchCode,
      tradeCustomerId: body.tradeCustomerId,
      amountPkr: body.amountPkr,
      paymentMethod: body.paymentMethod,
      reference: body.reference,
      notes: body.notes,
      allocations,
      advance: body.advance,
      chequeNumber: body.chequeNumber,
      chequeBank: body.chequeBank,
      chequeDate: body.chequeDate,
      chequeStatus: body.chequeStatus,
    });
  },

  async aging(
    params: PageParams & {
      branchCode?: string;
      bucket?: AgingDayBucket | "all" | "overdue";
      q?: string;
      areaId?: string;
      creditExceededOnly?: boolean;
    },
  ): Promise<AgingResult> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;

    if (capability.aging) {
      try {
        const raw = await getJson<unknown>(
          `${BASE}/aging${qs({
            branchCode: params.branchCode,
            bucket: params.bucket === "all" ? undefined : params.bucket,
            q: params.q,
            areaId: params.areaId,
            creditExceededOnly: params.creditExceededOnly ? true : undefined,
            page,
            pageSize,
          })}`,
        );

        if (raw && typeof raw === "object") {
          const o = raw as Record<string, unknown>;
          const pageRaw = normalizePage<Record<string, unknown>>(raw);
          let items = pageRaw.items.map(mapAgingRow);

          // Client-side filters when backend returns unfiltered day-bucket rows.
          if (params.creditExceededOnly) items = items.filter((r) => r.creditExceeded);
          if (params.areaId) items = items.filter((r) => r.areaId === params.areaId);
          if (params.q) {
            const q = params.q.toLowerCase();
            items = items.filter(
              (r) =>
                r.name.toLowerCase().includes(q) || String(r.code ?? "").toLowerCase().includes(q),
            );
          }
          if (params.bucket === "overdue") items = items.filter((r) => r.overdue);
          else if (params.bucket && params.bucket !== "all") {
            const bucket = params.bucket;
            items = items.filter(
              (r) => r.bucket === bucket || Number(r.buckets?.[bucket] ?? 0) > 0,
            );
          }

          const summary =
            o.summary && typeof o.summary === "object"
              ? (o.summary as AgingResult["summary"])
              : summaryFromAgingTotals(
                  o.totals as Record<string, unknown> | undefined,
                  items,
                  Number(o.total ?? items.length),
                );

          return {
            source: "phase7",
            summary,
            items: {
              ...pageRaw,
              items,
              total: Number(o.total ?? items.length),
              totalPages: Math.max(
                1,
                Number(o.totalPages ?? Math.ceil(Number(o.total ?? items.length) / pageSize)),
              ),
            },
          };
        }
      } catch (err) {
        if (isRouteMissing(err)) capability.aging = false;
        else throw err;
      }
    }

    const allRows = await deriveAgingFromInvoices(params.branchCode);
    let rows = allRows;
    if (params.creditExceededOnly) rows = rows.filter((r) => r.creditExceeded);
    if (params.areaId) rows = rows.filter((r) => r.areaId === params.areaId);
    if (params.q) {
      const q = params.q.toLowerCase();
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || String(r.code ?? "").toLowerCase().includes(q),
      );
    }
    if (params.bucket === "overdue") rows = rows.filter((r) => r.overdue);
    else if (params.bucket && params.bucket !== "all") {
      rows = rows.filter((r) => r.bucket === params.bucket);
    }

    return {
      source: "legacy",
      summary: summarizeAging(allRows),
      items: asPage(rows, page, pageSize),
    };
  },

  async recovery(
    params: PageParams & {
      branchCode?: string;
      q?: string;
      priority?: string;
    },
  ): Promise<PageResult<RecoveryQueueItem>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;

    if (capability.recovery) {
      try {
        const raw = await getJson<unknown>(
          `${BASE}/recovery${qs({
            branchCode: params.branchCode,
            q: params.q,
            priority: params.priority,
            page,
            pageSize,
          })}`,
        );
        const normalized = normalizePage<Record<string, unknown>>(raw);
        return {
          ...normalized,
          items: normalized.items.map(mapRecoveryItem),
        };
      } catch (err) {
        if (isRouteMissing(err)) capability.recovery = false;
        else throw err;
      }
    }

    const aging = await deriveAgingFromInvoices(params.branchCode);
    let queue: RecoveryQueueItem[] = aging
      .filter((r) => r.overdue || r.creditExceeded)
      .map((r) => ({
        id: r.tradeCustomerId,
        tradeCustomerId: r.tradeCustomerId,
        code: r.code,
        name: r.name,
        outstandingPkr: r.outstandingPkr,
        creditLimitPkr: r.creditLimitPkr,
        creditDays: r.creditDays,
        bucket: r.bucket,
        daysPastDue: r.daysPastDue,
        creditExceeded: r.creditExceeded,
        priority: recoveryPriority(r),
        reason: recoveryReason(r),
      }))
      .sort((a, b) => {
        const rank: Record<string, number> = {
          critical: 0,
          warning: 1,
          high: 1,
          medium: 2,
          info: 3,
          low: 3,
        };
        const d = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
        if (d !== 0) return d;
        return b.outstandingPkr - a.outstandingPkr;
      });

    if (params.priority) {
      queue = queue.filter((r) => r.priority === params.priority);
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      queue = queue.filter(
        (r) => r.name.toLowerCase().includes(q) || String(r.code ?? "").toLowerCase().includes(q),
      );
    }
    return asPage(queue, page, pageSize);
  },

  /** Open invoices for allocation UI — uses customer ledger when available. */
  async openInvoicesForCustomer(tradeCustomerId: string): Promise<
    {
      id: string;
      invoiceNumber: string;
      invoiceDate?: string | null;
      totalPkr: number;
      amountDuePkr: number;
      amountPaidPkr?: number;
    }[]
  > {
    const ledger = await fetchPharmacyTradeCustomerLedger(tradeCustomerId);
    const invoices = (ledger?.invoices ?? []) as Record<string, unknown>[];
    return invoices
      .map((inv) => ({
        id: String(inv.id ?? ""),
        invoiceNumber: String(inv.invoiceNumber ?? inv.id ?? ""),
        invoiceDate: (inv.invoiceDate as string) ?? (inv.createdAt as string) ?? null,
        totalPkr: Number(inv.totalPkr ?? 0),
        amountDuePkr: Number(inv.amountDuePkr ?? 0),
        amountPaidPkr: inv.amountPaidPkr != null ? Number(inv.amountPaidPkr) : undefined,
      }))
      .filter((inv) => inv.amountDuePkr > 0);
  },

  async customerLedger(tradeCustomerId: string): Promise<Record<string, unknown>> {
    return (await fetchPharmacyTradeCustomerLedger(tradeCustomerId)) as Record<string, unknown>;
  },

  capabilities() {
    return { ...capability };
  },
};

/** Alias preferred by Dist Phase-7 pages. */
export const collectionsApi = collectionsOpsApi;
