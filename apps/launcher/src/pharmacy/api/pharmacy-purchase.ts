/**
 * Phase 6 distribution pharmaceutical procurement API client.
 * Prefers `/v1/pharmacy/purchase/*`; falls back to legacy
 * `/v1/pharmacy/purchase-orders`, `/grns`, `/purchase-returns` when new routes 404
 * (backend may still be landing in parallel). Same pattern as pharmacy-sales.ts.
 */
import { authFetch } from "../../lib/authFetch";
import {
  approvePharmacyPurchaseOrder,
  createPharmacyGrn,
  createPharmacyPurchaseOrder,
  createPharmacyPurchaseReturn,
  fetchPharmacyGrns,
  fetchPharmacyPurchaseOrders,
  fetchPharmacyPurchaseReturns,
} from "./pharmacy-erp";
import { inventoryApi, type ReorderRow } from "./pharmacy-inventory";
import { fetchBranchInventory } from "../../pops/api/inventory";

const BASE = "/v1/pharmacy/purchase";

export class PurchaseApiHttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "PurchaseApiHttpError";
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
    throw new PurchaseApiHttpError(res.status, message, details);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const { message, details } = await parseErrorBody(res);
    throw new PurchaseApiHttpError(res.status, message, details);
  }
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) {
    const { message, details } = await parseErrorBody(res);
    throw new PurchaseApiHttpError(res.status, message, details);
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
  if (!(err instanceof PurchaseApiHttpError) || err.status !== 404) return false;
  const m = err.message || "";
  return /Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(m);
}

/** Soft capability flags — once a route 404s we skip it for the session. */
const capability = {
  dashboard: true,
  requisitions: true,
  orders: true,
  orderGet: true,
  orderMutations: true,
  grns: true,
  invoices: true,
  returns: true,
  suppliers: true,
  fromReorder: true,
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

// ─── Types ───────────────────────────────────────────────────────────────────

export type PurchaseDashboard = {
  generatedAt?: string;
  kpis: {
    pendingApprovals: number;
    openRequisitions: number;
    openOrders: number;
    pendingGrn: number;
    partialOrders: number;
    returnsToday: number;
    invoicesOpen: number;
    reorderSkus: number;
    purchaseTodayPkr?: number;
    purchaseMonthPkr?: number;
  };
  links?: Record<string, string>;
};

export type PurchaseRequisitionLine = {
  id?: string;
  medicineId: string;
  medicineName?: string | null;
  medicineSku?: string | null;
  requestedQty: number;
  suggestedQty?: number;
  convertedQty?: number;
  preferredSupplierId?: string | null;
  lastPurchasePricePkr?: number | null;
  notes?: string | null;
};

export type PurchaseRequisition = {
  id: string;
  reqNumber: string;
  status: string;
  priority?: string;
  warehouseId?: string | null;
  preferredSupplierId?: string | null;
  requiredDate?: string | null;
  notes?: string | null;
  rejectReason?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
  lines?: PurchaseRequisitionLine[];
  lineCount?: number;
};

export type PurchaseOrderLine = {
  id?: string;
  medicineId: string;
  medicineName?: string | null;
  medicineSku?: string | null;
  quantity: number;
  freeQuantity?: number;
  receivedQty?: number;
  orderedQty?: number;
  pendingQty?: number;
  unitCostPkr: number;
  discountPkr?: number;
  taxPkr?: number;
  lineTotalPkr?: number;
  notes?: string | null;
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  supplierId?: string | null;
  supplierName?: string | null;
  warehouseId?: string | null;
  requisitionId?: string | null;
  orderDate: string;
  expectedDate?: string | null;
  notes?: string | null;
  subtotalPkr?: number;
  taxPkr?: number;
  discountPkr?: number;
  totalPkr: number;
  paymentTerms?: string | null;
  supplierReference?: string | null;
  revision?: number;
  submittedAt?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  confirmedAt?: string | null;
  createdAt?: string;
  lines?: PurchaseOrderLine[];
};

export type PurchaseGrnLine = {
  id?: string;
  medicineId: string;
  medicineName?: string | null;
  purchaseOrderLineId?: string | null;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate: string;
  quantity: number;
  freeQuantity?: number;
  unitCostPkr: number;
  lineTotalPkr?: number;
  batchId?: string | null;
};

export type PurchaseGrn = {
  id: string;
  grnNumber: string;
  status?: string;
  warehouseId: string;
  purchaseOrderId?: string | null;
  supplierId?: string | null;
  supplierInvoiceNumber?: string | null;
  receivedDate: string;
  totalPkr: number;
  notes?: string | null;
  createdAt?: string;
  lines?: PurchaseGrnLine[];
};

export type PurchaseInvoice = {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber?: string | null;
  status: string;
  supplierId: string;
  supplierName?: string | null;
  grnId?: string | null;
  purchaseOrderId?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  totalPkr: number;
  amountPaidPkr?: number;
  accountingNote?: string | null;
  createdAt?: string;
};

export type PurchaseReturn = {
  id: string;
  returnNumber: string;
  supplierId?: string | null;
  grnId?: string | null;
  warehouseId?: string | null;
  reason?: string | null;
  totalPkr: number;
  createdAt?: string;
  lines?: {
    id?: string;
    medicineId: string;
    batchId?: string | null;
    quantity: number;
    unitCostPkr?: number;
    lineTotalPkr?: number;
  }[];
};

export type SupplierHit = {
  id: string;
  code?: string | null;
  name: string;
  phone?: string | null;
  paymentTerms?: string | null;
  status?: string | null;
  email?: string | null;
  address?: string | null;
};

export type SupplierPerformance = {
  supplier: SupplierHit & Record<string, unknown>;
  orderCount: number;
  purchaseTotalPkr: number;
  grnCount?: number;
  receivedCount?: number;
  returnCount?: number;
  onTimePct?: number | null;
  onTimeRate?: number | null;
  fillRate?: number | null;
  returnRate?: number | null;
  avgLeadDays?: number | null;
};

export type CreatePoLineInput = {
  medicineId: string;
  quantity: number;
  freeQuantity?: number;
  unitCostPkr?: number;
  discountPkr?: number;
  taxPkr?: number;
  notes?: string;
};

export type CreatePoInput = {
  branchCode: string;
  supplierId?: string;
  warehouseId?: string;
  requisitionId?: string;
  orderDate?: string;
  expectedDate?: string;
  notes?: string;
  taxPkr?: number;
  discountPkr?: number;
  paymentTerms?: string;
  idempotencyKey?: string;
  submit?: boolean;
  lines: CreatePoLineInput[];
};

export type CreateGrnLineInput = {
  medicineId: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate: string;
  quantity: number;
  freeQuantity?: number;
  unitCostPkr?: number;
  purchaseOrderLineId?: string;
};

export type CreateGrnInput = {
  branchCode: string;
  warehouseId: string;
  purchaseOrderId?: string;
  supplierId?: string;
  supplierInvoiceNumber?: string;
  receivedDate?: string;
  notes?: string;
  idempotencyKey?: string;
  lines: CreateGrnLineInput[];
};

export type CreateRequisitionInput = {
  branchCode: string;
  warehouseId?: string;
  preferredSupplierId?: string;
  priority?: string;
  requiredDate?: string;
  notes?: string;
  lines: {
    medicineId: string;
    requestedQty: number;
    suggestedQty?: number;
    preferredSupplierId?: string;
    lastPurchasePricePkr?: number;
    notes?: string;
  }[];
};

export type CreateReturnInput = {
  branchCode: string;
  warehouseId?: string;
  supplierId?: string;
  grnId?: string;
  reason?: string;
  lines: { medicineId: string; batchId?: string; quantity: number; unitCostPkr?: number }[];
};

export type CreateInvoiceInput = {
  branchCode: string;
  supplierId: string;
  grnId?: string;
  purchaseOrderId?: string;
  supplierInvoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  notes?: string;
  post?: boolean;
};

function mapLegacyPo(raw: Record<string, unknown>): PurchaseOrder {
  return {
    id: String(raw.id),
    poNumber: String(raw.poNumber ?? raw.po_number ?? ""),
    status: String(raw.status ?? "draft"),
    supplierId: (raw.supplierId as string) ?? null,
    warehouseId: (raw.warehouseId as string) ?? null,
    orderDate: String(raw.orderDate ?? raw.order_date ?? ""),
    expectedDate: (raw.expectedDate as string) ?? null,
    notes: (raw.notes as string) ?? null,
    subtotalPkr: Number(raw.subtotalPkr ?? 0),
    taxPkr: Number(raw.taxPkr ?? 0),
    discountPkr: Number(raw.discountPkr ?? 0),
    totalPkr: Number(raw.totalPkr ?? 0),
    approvedAt: (raw.approvedAt as string) ?? null,
    createdAt: (raw.createdAt as string) ?? undefined,
    lines: Array.isArray(raw.lines)
      ? (raw.lines as Record<string, unknown>[]).map((l) => ({
          id: l.id ? String(l.id) : undefined,
          medicineId: String(l.medicineId),
          quantity: Number(l.quantity ?? 0),
          freeQuantity: Number(l.freeQuantity ?? 0),
          receivedQty: Number(l.receivedQty ?? 0),
          unitCostPkr: Number(l.unitCostPkr ?? 0),
          discountPkr: Number(l.discountPkr ?? 0),
          taxPkr: Number(l.taxPkr ?? 0),
          lineTotalPkr: Number(l.lineTotalPkr ?? 0),
          pendingQty: Math.max(
            0,
            Number(l.quantity ?? 0) + Number(l.freeQuantity ?? 0) - Number(l.receivedQty ?? 0),
          ),
          orderedQty: Number(l.quantity ?? 0) + Number(l.freeQuantity ?? 0),
        }))
      : undefined,
  };
}

function mapLegacyGrn(raw: Record<string, unknown>): PurchaseGrn {
  return {
    id: String(raw.id),
    grnNumber: String(raw.grnNumber ?? ""),
    status: String(raw.status ?? "posted"),
    warehouseId: String(raw.warehouseId ?? ""),
    purchaseOrderId: (raw.purchaseOrderId as string) ?? null,
    supplierId: (raw.supplierId as string) ?? null,
    supplierInvoiceNumber: (raw.supplierInvoiceNumber as string) ?? null,
    receivedDate: String(raw.receivedDate ?? ""),
    totalPkr: Number(raw.totalPkr ?? 0),
    notes: (raw.notes as string) ?? null,
    createdAt: (raw.createdAt as string) ?? undefined,
    lines: Array.isArray(raw.lines)
      ? (raw.lines as Record<string, unknown>[]).map((l) => ({
          id: l.id ? String(l.id) : undefined,
          medicineId: String(l.medicineId),
          purchaseOrderLineId: (l.purchaseOrderLineId as string) ?? null,
          batchNumber: String(l.batchNumber ?? ""),
          manufacturingDate: (l.manufacturingDate as string) ?? null,
          expiryDate: String(l.expiryDate ?? ""),
          quantity: Number(l.quantity ?? 0),
          freeQuantity: Number(l.freeQuantity ?? 0),
          unitCostPkr: Number(l.unitCostPkr ?? 0),
          lineTotalPkr: Number(l.lineTotalPkr ?? 0),
          batchId: (l.batchId as string) ?? null,
        }))
      : undefined,
  };
}

function mapLegacyReturn(raw: Record<string, unknown>): PurchaseReturn {
  return {
    id: String(raw.id),
    returnNumber: String(raw.returnNumber ?? ""),
    supplierId: (raw.supplierId as string) ?? null,
    grnId: (raw.grnId as string) ?? null,
    warehouseId: (raw.warehouseId as string) ?? null,
    reason: (raw.reason as string) ?? null,
    totalPkr: Number(raw.totalPkr ?? 0),
    createdAt: (raw.createdAt as string) ?? undefined,
    lines: Array.isArray(raw.lines)
      ? (raw.lines as Record<string, unknown>[]).map((l) => ({
          id: l.id ? String(l.id) : undefined,
          medicineId: String(l.medicineId),
          batchId: (l.batchId as string) ?? null,
          quantity: Number(l.quantity ?? 0),
          unitCostPkr: Number(l.unitCostPkr ?? 0),
          lineTotalPkr: Number(l.lineTotalPkr ?? 0),
        }))
      : undefined,
  };
}

const PENDING_APPROVAL = new Set(["draft", "submitted"]);
const OPEN_ORDER = new Set([
  "draft",
  "submitted",
  "approved",
  "sent",
  "supplier_confirmed",
  "partial",
]);
const PENDING_GRN = new Set(["approved", "sent", "supplier_confirmed", "partial"]);

async function legacyDashboard(branchCode: string): Promise<PurchaseDashboard> {
  const [pos, grns, returns, reorder] = await Promise.all([
    fetchPharmacyPurchaseOrders(branchCode).catch(() => []),
    fetchPharmacyGrns(branchCode).catch(() => []),
    fetchPharmacyPurchaseReturns(branchCode).catch(() => []),
    inventoryApi.reorder({ branchCode, page: 1, pageSize: 1 }).catch(() => null),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const returnsToday = (returns as { createdAt?: string }[]).filter((r) =>
    String(r.createdAt ?? "").startsWith(today),
  ).length;
  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      pendingApprovals: (pos as { status?: string }[]).filter((p) =>
        PENDING_APPROVAL.has(String(p.status ?? "")),
      ).length,
      openRequisitions: 0,
      openOrders: (pos as { status?: string }[]).filter((p) => OPEN_ORDER.has(String(p.status ?? "")))
        .length,
      pendingGrn: (pos as { status?: string }[]).filter((p) => PENDING_GRN.has(String(p.status ?? "")))
        .length,
      partialOrders: (pos as { status?: string }[]).filter((p) => p.status === "partial").length,
      returnsToday,
      invoicesOpen: 0,
      reorderSkus: reorder?.total ?? 0,
      purchaseTodayPkr: (grns as { receivedDate?: string; totalPkr?: number }[])
        .filter((g) => String(g.receivedDate ?? "") === today)
        .reduce((s, g) => s + Number(g.totalPkr ?? 0), 0),
    },
  };
}

async function legacyOrdersPage(
  branchCode: string,
  params: PageParams & { status?: string; q?: string; supplierId?: string },
): Promise<PageResult<PurchaseOrder>> {
  let rows = ((await fetchPharmacyPurchaseOrders(branchCode)) as Record<string, unknown>[]).map(
    mapLegacyPo,
  );
  if (params.status) {
    const st = params.status.trim().toLowerCase();
    if (st === "pending") {
      rows = rows.filter((r) => PENDING_APPROVAL.has(r.status) || PENDING_GRN.has(r.status));
    } else {
      rows = rows.filter((r) => r.status.toLowerCase() === st);
    }
  }
  if (params.supplierId) rows = rows.filter((r) => r.supplierId === params.supplierId);
  if (params.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.poNumber.toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q) ||
        (r.supplierName ?? "").toLowerCase().includes(q),
    );
  }
  return asPage(rows, params.page ?? 1, params.pageSize ?? 25);
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function fetchPurchaseDashboard(params: {
  branchCode: string;
}): Promise<PurchaseDashboard> {
  if (capability.dashboard) {
    try {
      const raw = await getJson<PurchaseDashboard | { kpis: { key: string; label: string; value: number; to?: string }[] }>(
        `${BASE}/dashboard${qs(params)}`,
      );
      return normalizeDashboard(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.dashboard = false;
      else throw err;
    }
  }
  return legacyDashboard(params.branchCode);
}

function normalizeDashboard(
  raw: PurchaseDashboard | { kpis: { key: string; label: string; value: number; to?: string }[]; generatedAt?: string },
): PurchaseDashboard {
  const kpisRaw = (raw as { kpis?: unknown }).kpis;
  if (Array.isArray(kpisRaw) && kpisRaw.length && "key" in (kpisRaw[0] as object)) {
    const byKey = Object.fromEntries(
      (kpisRaw as { key: string; value: number }[]).map((k) => [k.key, Number(k.value) || 0]),
    );
    return {
      generatedAt: (raw as { generatedAt?: string }).generatedAt,
      kpis: {
        pendingApprovals: byKey.pending_approvals ?? 0,
        openRequisitions: byKey.pending_requisitions ?? 0,
        openOrders: byKey.pending_pos ?? 0,
        pendingGrn: byKey.partial_pos ?? 0,
        partialOrders: byKey.partial_pos ?? 0,
        returnsToday: byKey.returns_count ?? 0,
        invoicesOpen: 0,
        reorderSkus: byKey.low_stock ?? 0,
        purchaseTodayPkr: byKey.purchase_today,
        purchaseMonthPkr: byKey.purchase_month,
      },
      links: {
        pendingApprovals: `${DIST_BASE}/purchase-orders?status=submitted`,
        openRequisitions: `${DIST_BASE}/purchase-requisitions?status=submitted`,
        openOrders: `${DIST_BASE}/purchase-orders`,
        pendingGrn: `${DIST_BASE}/purchase-grn`,
        partialOrders: `${DIST_BASE}/purchase-orders?status=partial`,
        returns: `${DIST_BASE}/purchase-returns`,
        invoices: `${DIST_BASE}/purchase-invoices`,
        reorder: `${DIST_BASE}/inventory-reports`,
        confirmations: `${DIST_BASE}/purchase-orders?status=sent`,
      },
    };
  }
  return raw as PurchaseDashboard;
}

const DIST_BASE = "/pops/distribution";

// ─── Requisitions ────────────────────────────────────────────────────────────

export async function listPurchaseRequisitions(
  params: PageParams & { branchCode: string; status?: string; q?: string },
): Promise<PageResult<PurchaseRequisition>> {
  if (capability.requisitions) {
    try {
      const raw = await getJson<unknown>(`${BASE}/requisitions${qs(params)}`);
      return normalizePage<PurchaseRequisition>(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.requisitions = false;
      else throw err;
    }
  }
  return asPage([], params.page ?? 1, params.pageSize ?? 25);
}

export async function getPurchaseRequisition(id: string): Promise<PurchaseRequisition> {
  if (capability.requisitions) {
    try {
      return await getJson<PurchaseRequisition>(`${BASE}/requisitions/${id}`);
    } catch (err) {
      if (isRouteMissing(err)) capability.requisitions = false;
      else throw err;
    }
  }
  throw new PurchaseApiHttpError(404, "Purchase requisitions API is not available yet");
}

export async function createPurchaseRequisition(
  body: CreateRequisitionInput,
): Promise<PurchaseRequisition> {
  if (capability.requisitions) {
    try {
      return await postJson<PurchaseRequisition>(`${BASE}/requisitions`, body);
    } catch (err) {
      if (isRouteMissing(err)) capability.requisitions = false;
      else throw err;
    }
  }
  throw new PurchaseApiHttpError(
    404,
    "Purchase requisitions API is not available yet — deploy Phase 6 purchase routes",
  );
}

async function requisitionAction(
  id: string,
  action: "submit" | "approve" | "reject" | "convert",
  body: Record<string, unknown> = {},
): Promise<PurchaseRequisition | PurchaseOrder> {
  if (capability.requisitions) {
    try {
      return await postJson(`${BASE}/requisitions/${id}/${action}`, body);
    } catch (err) {
      if (isRouteMissing(err)) capability.requisitions = false;
      else throw err;
    }
  }
  throw new PurchaseApiHttpError(404, `Requisition ${action} is not available yet`);
}

export const submitPurchaseRequisition = (id: string) => requisitionAction(id, "submit");
export const approvePurchaseRequisition = (id: string) => requisitionAction(id, "approve");
export const rejectPurchaseRequisition = (id: string, reason: string) =>
  requisitionAction(id, "reject", { reason });
export const convertPurchaseRequisition = (
  id: string,
  body: { supplierId: string; warehouseId?: string; branchCode?: string },
) => requisitionAction(id, "convert", body);

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function listPurchaseOrders(
  params: PageParams & {
    branchCode: string;
    status?: string;
    supplierId?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<PageResult<PurchaseOrder>> {
  if (capability.orders) {
    try {
      const raw = await getJson<unknown>(`${BASE}/orders${qs(params)}`);
      return normalizePage<PurchaseOrder>(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.orders = false;
      else throw err;
    }
  }
  return legacyOrdersPage(params.branchCode, params);
}

export async function getPurchaseOrder(id: string, branchCode?: string): Promise<PurchaseOrder> {
  if (capability.orderGet) {
    try {
      return await getJson<PurchaseOrder>(`${BASE}/orders/${id}`);
    } catch (err) {
      if (isRouteMissing(err)) capability.orderGet = false;
      else if (!(err instanceof PurchaseApiHttpError && err.status === 404)) throw err;
      // fall through for entity 404 when using legacy
    }
  }
  if (branchCode) {
    const page = await legacyOrdersPage(branchCode, { page: 1, pageSize: 500 });
    const found = page.items.find((p) => p.id === id);
    if (found) {
      // Legacy list has no lines — try to load via create response shape is unavailable;
      // return header; detail UI will show empty lines until new API lands.
      return found;
    }
  }
  throw new PurchaseApiHttpError(404, "Purchase order not found");
}

export async function createPurchaseOrder(body: CreatePoInput): Promise<PurchaseOrder> {
  if (capability.orders) {
    try {
      const raw = await postJson<Record<string, unknown>>(`${BASE}/orders`, body);
      return mapLegacyPo(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.orders = false;
      else throw err;
    }
  }
  const raw = (await createPharmacyPurchaseOrder({
    branchCode: body.branchCode,
    supplierId: body.supplierId,
    orderDate: body.orderDate,
    expectedDate: body.expectedDate,
    notes: body.notes,
    taxPkr: body.taxPkr,
    discountPkr: body.discountPkr,
    lines: body.lines.map((l) => ({
      medicineId: l.medicineId,
      quantity: l.quantity,
      freeQuantity: l.freeQuantity,
      unitCostPkr: l.unitCostPkr ?? 0,
    })),
  })) as Record<string, unknown>;
  let po = mapLegacyPo(raw);
  if (body.submit && po.id) {
    try {
      po = await submitPurchaseOrder(po.id);
    } catch {
      // draft saved; submit may not exist on legacy
    }
  }
  return po;
}

async function orderAction(
  id: string,
  action: "submit" | "approve" | "send" | "confirm" | "cancel",
  body: Record<string, unknown> = {},
): Promise<PurchaseOrder> {
  if (capability.orderMutations) {
    try {
      const raw = await postJson<Record<string, unknown>>(`${BASE}/orders/${id}/${action}`, body);
      return mapLegacyPo(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.orderMutations = false;
      else throw err;
    }
  }
  if (action === "approve" || action === "submit") {
    const raw = (await approvePharmacyPurchaseOrder(id)) as Record<string, unknown>;
    return mapLegacyPo(raw);
  }
  throw new PurchaseApiHttpError(
    404,
    `PO ${action} requires Phase 6 purchase routes (legacy only supports approve)`,
  );
}

export const submitPurchaseOrder = (id: string) => orderAction(id, "submit");
export const approvePurchaseOrder = (id: string) => orderAction(id, "approve");
export const sendPurchaseOrder = (id: string) => orderAction(id, "send");
export const confirmPurchaseOrder = (
  id: string,
  body?: { confirmedDeliveryDate?: string; supplierReference?: string; confirmedQtyNotes?: string },
) => orderAction(id, "confirm", body ?? {});
export const cancelPurchaseOrder = (id: string, reason?: string) =>
  orderAction(id, "cancel", reason ? { reason } : {});

export async function updatePurchaseOrderDraft(
  id: string,
  patch: {
    supplierId?: string | null;
    expectedDate?: string | null;
    notes?: string | null;
    paymentTerms?: string | null;
    warehouseId?: string | null;
    taxPkr?: number;
    discountPkr?: number;
    lines?: CreatePoLineInput[];
  },
): Promise<PurchaseOrder> {
  if (capability.orders) {
    try {
      const raw = await patchJson<Record<string, unknown>>(`${BASE}/orders/${id}`, patch);
      return mapLegacyPo(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.orders = false;
      else throw err;
    }
  }
  throw new PurchaseApiHttpError(404, "Draft PO update requires Phase 6 purchase routes");
}

// ─── GRNs ────────────────────────────────────────────────────────────────────

export async function listPurchaseGrns(
  params: PageParams & { branchCode: string; q?: string; purchaseOrderId?: string },
): Promise<PageResult<PurchaseGrn>> {
  if (capability.grns) {
    try {
      const raw = await getJson<unknown>(`${BASE}/grns${qs(params)}`);
      return normalizePage<PurchaseGrn>(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.grns = false;
      else throw err;
    }
  }
  let rows = ((await fetchPharmacyGrns(params.branchCode)) as Record<string, unknown>[]).map(
    mapLegacyGrn,
  );
  if (params.purchaseOrderId) {
    rows = rows.filter((g) => g.purchaseOrderId === params.purchaseOrderId);
  }
  if (params.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    rows = rows.filter((g) => g.grnNumber.toLowerCase().includes(q));
  }
  return asPage(rows, params.page ?? 1, params.pageSize ?? 25);
}

export async function getPurchaseGrn(id: string, branchCode?: string): Promise<PurchaseGrn> {
  if (capability.grns) {
    try {
      return await getJson<PurchaseGrn>(`${BASE}/grns/${id}`);
    } catch (err) {
      if (isRouteMissing(err)) capability.grns = false;
      else if (!(err instanceof PurchaseApiHttpError && err.status === 404)) throw err;
    }
  }
  if (branchCode) {
    const page = await listPurchaseGrns({ branchCode, page: 1, pageSize: 500 });
    const found = page.items.find((g) => g.id === id);
    if (found) return found;
  }
  throw new PurchaseApiHttpError(404, "GRN not found");
}

export async function createPurchaseGrn(body: CreateGrnInput): Promise<PurchaseGrn> {
  if (capability.grns) {
    try {
      const raw = await postJson<Record<string, unknown>>(`${BASE}/grns`, body);
      return mapLegacyGrn(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.grns = false;
      else throw err;
    }
  }
  const raw = (await createPharmacyGrn(body)) as Record<string, unknown>;
  return mapLegacyGrn(raw);
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export async function listPurchaseInvoices(
  params: PageParams & { branchCode: string; status?: string; q?: string },
): Promise<PageResult<PurchaseInvoice>> {
  if (capability.invoices) {
    try {
      const raw = await getJson<unknown>(`${BASE}/invoices${qs(params)}`);
      return normalizePage<PurchaseInvoice>(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.invoices = false;
      else throw err;
    }
  }
  return asPage([], params.page ?? 1, params.pageSize ?? 25);
}

export async function createPurchaseInvoice(body: CreateInvoiceInput): Promise<PurchaseInvoice> {
  if (capability.invoices) {
    try {
      return await postJson<PurchaseInvoice>(`${BASE}/invoices`, body);
    } catch (err) {
      if (isRouteMissing(err)) capability.invoices = false;
      else throw err;
    }
  }
  throw new PurchaseApiHttpError(
    404,
    "Purchase invoices API is not available yet — deploy Phase 6 purchase routes",
  );
}

// ─── Returns ─────────────────────────────────────────────────────────────────

export async function listPurchaseReturns(
  params: PageParams & { branchCode: string; q?: string },
): Promise<PageResult<PurchaseReturn>> {
  if (capability.returns) {
    try {
      const raw = await getJson<unknown>(`${BASE}/returns${qs(params)}`);
      return normalizePage<PurchaseReturn>(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.returns = false;
      else throw err;
    }
  }
  const rows = (
    (await fetchPharmacyPurchaseReturns(params.branchCode)) as Record<string, unknown>[]
  ).map(mapLegacyReturn);
  return asPage(rows, params.page ?? 1, params.pageSize ?? 25);
}

export async function createPurchaseReturn(body: CreateReturnInput): Promise<PurchaseReturn> {
  if (capability.returns) {
    try {
      const raw = await postJson<Record<string, unknown>>(`${BASE}/returns`, body);
      return mapLegacyReturn(raw);
    } catch (err) {
      if (isRouteMissing(err)) capability.returns = false;
      else throw err;
    }
  }
  const raw = (await createPharmacyPurchaseReturn(body)) as Record<string, unknown>;
  return mapLegacyReturn(raw);
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export async function searchPurchaseSuppliers(params: {
  branchCode: string;
  q?: string;
  limit?: number;
}): Promise<SupplierHit[]> {
  if (capability.suppliers) {
    try {
      const raw = await getJson<unknown>(
        `${BASE}/suppliers/search${qs({
          branchCode: params.branchCode,
          q: params.q,
          limit: params.limit ?? 50,
        })}`,
      );
      if (Array.isArray(raw)) return raw as SupplierHit[];
      if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) {
        return (raw as { items: SupplierHit[] }).items;
      }
      return [];
    } catch (err) {
      if (isRouteMissing(err)) capability.suppliers = false;
      else throw err;
    }
  }
  const inv = await fetchBranchInventory(params.branchCode);
  const q = (params.q ?? "").trim().toLowerCase();
  let suppliers: SupplierHit[] = (inv.suppliers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    code: null,
    phone: s.phone,
    paymentTerms: s.paymentTerms,
    email: s.email,
    address: s.address,
    status: s.active ? "active" : "inactive",
  }));
  if (q) {
    suppliers = suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
  }
  return suppliers.slice(0, params.limit ?? 50);
}

export async function fetchSupplierPerformance(
  supplierId: string,
  params: { branchCode?: string },
): Promise<SupplierPerformance> {
  if (capability.suppliers) {
    try {
      const raw = await getJson<SupplierPerformance & {
        supplierId?: string;
        supplierName?: string;
        receivedCount?: number;
        onTimeRate?: number | null;
        fillRate?: number | null;
        returnRate?: number | null;
      }>(`${BASE}/suppliers/${supplierId}/performance${qs(params)}`);
      const onTimeRate = raw.onTimeRate ?? null;
      return {
        supplier:
          raw.supplier ??
          ({
            id: raw.supplierId ?? supplierId,
            name: raw.supplierName ?? "Supplier",
          } as SupplierHit),
        orderCount: Number(raw.orderCount ?? 0),
        purchaseTotalPkr: Number(raw.purchaseTotalPkr ?? 0),
        grnCount: raw.grnCount ?? raw.receivedCount ?? 0,
        receivedCount: raw.receivedCount,
        returnCount: raw.returnCount,
        onTimePct:
          raw.onTimePct != null
            ? raw.onTimePct
            : onTimeRate != null
              ? Math.round(onTimeRate * 1000) / 10
              : null,
        onTimeRate,
        fillRate: raw.fillRate ?? null,
        returnRate: raw.returnRate ?? null,
        avgLeadDays: raw.avgLeadDays ?? null,
      };
    } catch (err) {
      if (isRouteMissing(err)) capability.suppliers = false;
      else throw err;
    }
  }
  // Legacy: derive from PO list + inventory supplier row
  const branchCode = params.branchCode;
  let supplier: SupplierHit = { id: supplierId, name: "Supplier" };
  if (branchCode) {
    const inv = await fetchBranchInventory(branchCode);
    const hit = (inv.suppliers ?? []).find((s) => s.id === supplierId);
    if (hit) {
      supplier = {
        id: hit.id,
        name: hit.name,
        code: null,
        phone: hit.phone ?? null,
        paymentTerms: hit.paymentTerms ?? null,
        email: hit.email ?? null,
        address: hit.address ?? null,
        status: hit.active ? "active" : "inactive",
      };
    }
    const pos = await legacyOrdersPage(branchCode, { supplierId, page: 1, pageSize: 500 });
    return {
      supplier,
      orderCount: pos.total,
      purchaseTotalPkr: pos.items.reduce((s, p) => s + Number(p.totalPkr ?? 0), 0),
    };
  }
  return { supplier, orderCount: 0, purchaseTotalPkr: 0 };
}

// ─── From reorder ────────────────────────────────────────────────────────────

export async function createFromReorder(body: {
  branchCode: string;
  warehouseId?: string;
  preferredSupplierId?: string;
  mode?: "requisition" | "order";
  items: { medicineId: string; quantity: number; unitCostPkr?: number }[];
}): Promise<PurchaseRequisition | PurchaseOrder> {
  // Direct PO path — from-reorder API only creates requisitions.
  if (body.mode === "order") {
    return createPurchaseOrder({
      branchCode: body.branchCode,
      warehouseId: body.warehouseId,
      supplierId: body.preferredSupplierId,
      lines: body.items.map((i) => ({
        medicineId: i.medicineId,
        quantity: Math.max(1, Math.round(i.quantity)),
        unitCostPkr: i.unitCostPkr ?? 0,
      })),
    });
  }

  if (capability.fromReorder) {
    try {
      return await postJson(`${BASE}/requisitions/from-reorder`, {
        branchCode: body.branchCode,
        warehouseId: body.warehouseId,
        preferredSupplierId: body.preferredSupplierId,
        medicineIds: body.items.map((i) => i.medicineId),
        notes: "From reorder suggestions",
      });
    } catch (err) {
      if (isRouteMissing(err)) capability.fromReorder = false;
      else throw err;
    }
  }
  try {
    return await createPurchaseRequisition({
      branchCode: body.branchCode,
      warehouseId: body.warehouseId,
      preferredSupplierId: body.preferredSupplierId,
      lines: body.items.map((i) => ({
        medicineId: i.medicineId,
        requestedQty: Math.max(1, Math.round(i.quantity)),
        suggestedQty: Math.max(1, Math.round(i.quantity)),
        lastPurchasePricePkr: i.unitCostPkr,
      })),
    });
  } catch {
    return createPurchaseOrder({
      branchCode: body.branchCode,
      warehouseId: body.warehouseId,
      supplierId: body.preferredSupplierId,
      notes: "Created from reorder suggestions",
      lines: body.items.map((i) => ({
        medicineId: i.medicineId,
        quantity: Math.max(1, Math.round(i.quantity)),
        unitCostPkr: i.unitCostPkr ?? 0,
      })),
    });
  }
}

export function reorderRowsToItems(rows: ReorderRow[]): {
  medicineId: string;
  quantity: number;
  unitCostPkr?: number;
}[] {
  return rows
    .filter((r) => r.medicineId && (r.suggestedQty ?? 0) > 0)
    .map((r) => ({
      medicineId: r.medicineId,
      quantity: Math.max(1, Math.round(r.suggestedQty)),
    }));
}

export const purchaseApi = {
  dashboard: fetchPurchaseDashboard,
  listRequisitions: listPurchaseRequisitions,
  getRequisition: getPurchaseRequisition,
  createRequisition: createPurchaseRequisition,
  submitRequisition: submitPurchaseRequisition,
  approveRequisition: approvePurchaseRequisition,
  rejectRequisition: rejectPurchaseRequisition,
  convertRequisition: convertPurchaseRequisition,
  listOrders: listPurchaseOrders,
  getOrder: getPurchaseOrder,
  createOrder: createPurchaseOrder,
  updateOrderDraft: updatePurchaseOrderDraft,
  submitOrder: submitPurchaseOrder,
  approveOrder: approvePurchaseOrder,
  sendOrder: sendPurchaseOrder,
  confirmOrder: confirmPurchaseOrder,
  cancelOrder: cancelPurchaseOrder,
  listGrns: listPurchaseGrns,
  getGrn: getPurchaseGrn,
  createGrn: createPurchaseGrn,
  listInvoices: listPurchaseInvoices,
  createInvoice: createPurchaseInvoice,
  listReturns: listPurchaseReturns,
  createReturn: createPurchaseReturn,
  searchSuppliers: searchPurchaseSuppliers,
  supplierPerformance: fetchSupplierPerformance,
  fromReorder: createFromReorder,
};
