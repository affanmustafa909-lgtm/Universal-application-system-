/**
 * Phase 5 distribution Sale Window API client.
 * Prefers `/v1/pharmacy/sales/*` endpoints; falls back when they 404
 * (backend may still be landing in parallel).
 */
import { authFetch } from "../../lib/authFetch";
import { lookupPharmacyBarcode, matchPharmacyMedicines } from "./pharmacy";
import {
  createPharmacyDistOrder,
  resolvePharmacyPrice,
} from "./pharmacy-erp";
import { listMedicinesPaged, listTradeCustomersPaged } from "./pharmacy-masters";
import type { AvailabilityAllocation } from "./pharmacy-inventory";
import { inventoryApi } from "./pharmacy-inventory";

const BASE = "/v1/pharmacy/sales";

export class SalesApiHttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "SalesApiHttpError";
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
    throw new SalesApiHttpError(res.status, message, details);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const { message, details } = await parseErrorBody(res);
    throw new SalesApiHttpError(res.status, message, details);
  }
  return (await res.json()) as T;
}

async function deleteJson<T = unknown>(path: string): Promise<T> {
  const res = await authFetch(path, { method: "DELETE" });
  if (!res.ok) {
    const { message, details } = await parseErrorBody(res);
    throw new SalesApiHttpError(res.status, message, details);
  }
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
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
  if (!(err instanceof SalesApiHttpError) || err.status !== 404) return false;
  const m = err.message || "";
  // NestJS missing-controller responses look like "Cannot GET /v1/pharmacy/sales/..."
  return /Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(m);
}

/** Soft capability flags — once a route 404s we skip it for the session. */
const capability = {
  productSearch: true,
  barcode: true,
  customerSearch: true,
  quote: true,
  validate: true,
  held: true,
  book: true,
};

export type SaleProductHit = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  pack?: string | null;
  availableQty?: number | null;
  unitPricePkr?: number | null;
  wholesalePricePkr?: number | null;
  sellingPricePkr?: number | null;
};

export type SaleCustomerHit = {
  id: string;
  name: string;
  code?: string | null;
  phone?: string | null;
  outstandingPkr?: number | null;
  creditLimitPkr?: number | null;
  creditDays?: number | null;
  areaId?: string | null;
  priceLevel?: string | null;
};

export type SaleQuoteLineInput = {
  medicineId: string;
  quantity: number;
  unitPricePkr?: number;
};

export type SaleQuoteLine = {
  medicineId: string;
  quantity: number;
  unitPricePkr: number;
  priceSource?: string | null;
  /** Normalized client field (maps from API `freeQuantity`). */
  freeQty?: number;
  freeQuantity?: number;
  schemeName?: string | null;
  schemeLabel?: string | null;
  discountPkr?: number;
  taxPkr?: number;
  netPkr?: number;
  lineTotalPkr?: number;
};

export type SaleQuoteResult = {
  lines: SaleQuoteLine[];
  subtotalPkr: number;
  discountPkr: number;
  freeUnits: number;
  taxPkr: number;
  netPkr: number;
};

export type SaleValidateIssue = {
  code?: string;
  field?: string;
  medicineId?: string;
  message: string;
  severity?: "error" | "warning" | "info";
};

export type SaleValidateResult = {
  ok: boolean;
  issues: SaleValidateIssue[];
  credit?: {
    limitPkr: number;
    outstandingPkr: number;
    projectedOutstandingPkr: number;
    availablePkr: number;
    blocked?: boolean;
    warn?: boolean;
  };
};

export type SaleBookLineInput = {
  medicineId: string;
  quantity: number;
  freeQuantity?: number;
  unitPricePkr?: number;
  discountPkr?: number;
};

export type SaleBookBody = {
  branchCode: string;
  tradeCustomerId: string;
  warehouseId?: string;
  salesmanEmployeeId?: string;
  submit?: boolean;
  creditOverride?: boolean;
  creditOverrideReason?: string;
  idempotencyKey?: string;
  lines: SaleBookLineInput[];
  notes?: string;
};

export type SaleBookResult = {
  id?: string;
  orderNumber?: string;
  booked?: boolean;
  status?: string;
  totalPkr?: number;
  [key: string]: unknown;
};

export type SaleHeldOrder = {
  id: string;
  orderNumber?: string;
  status?: string;
  tradeCustomerId?: string;
  customerName?: string;
  warehouseId?: string | null;
  totalPkr?: number;
  updatedAt?: string;
  lines?: SaleBookLineInput[];
  [key: string]: unknown;
};

export type SaleCartAllocation = AvailabilityAllocation;

function mapMatchToHit(m: {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  companyId?: string | null;
  wholesalePrice?: number | null;
  sellingPrice?: number | null;
  wholesalePricePkr?: number | null;
  sellingPricePkr?: number | null;
  currentStock?: number | null;
  category?: string | null;
  genericName?: string | null;
  brandName?: string | null;
}): SaleProductHit {
  return {
    id: m.id,
    name: m.name,
    sku: m.sku ?? null,
    barcode: m.barcode ?? null,
    companyId: m.companyId ?? null,
    companyName: m.brandName ?? null,
    pack: m.category ?? m.genericName ?? null,
    availableQty: m.currentStock ?? null,
    unitPricePkr: Math.round(
      Number(m.wholesalePrice ?? m.wholesalePricePkr ?? m.sellingPrice ?? m.sellingPricePkr ?? 0),
    ),
    wholesalePricePkr: m.wholesalePrice ?? m.wholesalePricePkr ?? null,
    sellingPricePkr: m.sellingPrice ?? m.sellingPricePkr ?? null,
  };
}

function normalizeProductList(raw: unknown): SaleProductHit[] {
  if (Array.isArray(raw)) {
    return raw.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id ?? r.medicineId ?? ""),
        name: String(r.name ?? ""),
        sku: (r.sku as string | null | undefined) ?? null,
        barcode: (r.barcode as string | null | undefined) ?? null,
        companyId: (r.companyId as string | null | undefined) ?? null,
        companyName: (r.companyName as string | null | undefined) ?? null,
        pack: (r.pack as string | null | undefined) ?? (r.presentation as string | null | undefined) ?? null,
        availableQty:
          r.availableQty != null
            ? Number(r.availableQty)
            : r.currentStock != null
              ? Number(r.currentStock)
              : null,
        unitPricePkr:
          r.unitPricePkr != null
            ? Number(r.unitPricePkr)
            : r.wholesalePricePkr != null
              ? Number(r.wholesalePricePkr)
              : r.sellingPricePkr != null
                ? Number(r.sellingPricePkr)
                : null,
        wholesalePricePkr: r.wholesalePricePkr != null ? Number(r.wholesalePricePkr) : null,
        sellingPricePkr: r.sellingPricePkr != null ? Number(r.sellingPricePkr) : null,
      };
    }).filter((p) => p.id && p.name);
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) {
    return normalizeProductList((raw as { items: unknown[] }).items);
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as { results?: unknown }).results)) {
    return normalizeProductList((raw as { results: unknown[] }).results);
  }
  return [];
}

function normalizeCustomers(raw: unknown): SaleCustomerHit[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : raw && typeof raw === "object" && Array.isArray((raw as { results?: unknown }).results)
        ? (raw as { results: unknown[] }).results
        : [];
  return rows
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        code: (r.code as string | null | undefined) ?? null,
        phone: (r.phone as string | null | undefined) ?? (r.mobile as string | null | undefined) ?? null,
        outstandingPkr: r.outstandingPkr != null ? Number(r.outstandingPkr) : null,
        creditLimitPkr: r.creditLimitPkr != null ? Number(r.creditLimitPkr) : null,
        creditDays: r.creditDays != null ? Number(r.creditDays) : null,
        areaId: (r.areaId as string | null | undefined) ?? null,
        priceLevel: (r.priceLevel as string | null | undefined) ?? null,
      };
    })
    .filter((c) => c.id && c.name);
}

/** Server product search; on 404 falls back to medicines/match only. */
export async function searchSaleProducts(params: {
  branchCode: string;
  q: string;
  warehouseId?: string;
  limit?: number;
}): Promise<SaleProductHit[]> {
  const q = params.q.trim();
  if (!q) return [];

  if (capability.productSearch) {
    try {
      const raw = await getJson<unknown>(
        `${BASE}/products/search${qs({
          branchCode: params.branchCode,
          q,
          warehouseId: params.warehouseId,
          limit: params.limit ?? 40,
          pageSize: params.limit ?? 40,
        })}`,
      );
      return normalizeProductList(raw);
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.productSearch = false;
      } else {
        throw err;
      }
    }
  }

  // Prefer paged masters search (server `q`); fall back to medicines/match.
  try {
    const page = await listMedicinesPaged({
      branchCode: params.branchCode,
      q,
      page: 1,
      pageSize: params.limit ?? 40,
      status: "active",
    });
    return (page.items ?? []).map((m) =>
      mapMatchToHit({
        id: m.id,
        name: m.name,
        sku: m.sku,
        barcode: m.barcode,
        companyId: m.companyId,
        wholesalePricePkr: m.wholesalePricePkr,
        sellingPricePkr: m.sellingPricePkr,
        currentStock: m.currentStock,
        category: m.category,
        genericName: m.genericName,
        brandName: m.brandName,
      }),
    );
  } catch {
    const matched = await matchPharmacyMedicines(params.branchCode, q);
    return matched.map(mapMatchToHit).slice(0, params.limit ?? 40);
  }
}

/** Exact barcode lookup; on 404 falls back to medicines/barcode. */
export async function lookupSaleProductBarcode(params: {
  branchCode: string;
  code: string;
  warehouseId?: string;
}): Promise<SaleProductHit | null> {
  const code = params.code.trim();
  if (!code) return null;

  if (capability.barcode) {
    try {
      const raw = await getJson<unknown>(
        `${BASE}/products/barcode${qs({
          branchCode: params.branchCode,
          code,
          barcode: code,
          warehouseId: params.warehouseId,
        })}`,
      );
      const list = normalizeProductList(raw);
      return list[0] ?? null;
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.barcode = false;
      } else if (err instanceof SalesApiHttpError && err.status === 404) {
        return null;
      } else {
        throw err;
      }
    }
  }

  try {
    const hit = await lookupPharmacyBarcode(params.branchCode, code);
    return hit ? mapMatchToHit(hit as Parameters<typeof mapMatchToHit>[0]) : null;
  } catch {
    return null;
  }
}

/** Server customer search; on 404 uses paged trade-customers `q`. */
export async function searchSaleCustomers(params: {
  branchCode?: string;
  q: string;
  limit?: number;
}): Promise<SaleCustomerHit[]> {
  const q = params.q.trim();
  if (!q) return [];

  if (capability.customerSearch) {
    try {
      const raw = await getJson<unknown>(
        `${BASE}/customers/search${qs({
          branchCode: params.branchCode,
          q,
          limit: params.limit ?? 25,
          pageSize: params.limit ?? 25,
        })}`,
      );
      return normalizeCustomers(raw);
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.customerSearch = false;
      } else {
        throw err;
      }
    }
  }

  const page = await listTradeCustomersPaged({
    branchCode: params.branchCode,
    q,
    page: 1,
    pageSize: params.limit ?? 25,
    status: "active",
  });
  return normalizeCustomers(page.items ?? page);
}

/** Cart-level pricing quote; on 404 resolves each line via pricing/resolve. */
export async function quoteSalePricing(body: {
  branchCode: string;
  tradeCustomerId: string;
  priceLevel?: string;
  warehouseId?: string;
  lines: SaleQuoteLineInput[];
}): Promise<SaleQuoteResult> {
  const normalizeLines = (lines: SaleQuoteLine[]): SaleQuoteLine[] =>
    lines.map((l) => ({
      ...l,
      freeQty: Number(l.freeQty ?? l.freeQuantity ?? 0),
      freeQuantity: Number(l.freeQuantity ?? l.freeQty ?? 0),
      schemeName: l.schemeName ?? l.schemeLabel ?? null,
      schemeLabel: l.schemeLabel ?? l.schemeName ?? null,
      netPkr: Number(l.netPkr ?? l.lineTotalPkr ?? l.quantity * l.unitPricePkr - Number(l.discountPkr ?? 0)),
    }));

  if (capability.quote) {
    try {
      const raw = await postJson<
        SaleQuoteResult | { lines: SaleQuoteLine[]; totals?: { subtotalPkr?: number; discountPkr?: number; taxPkr?: number; totalPkr?: number }; schemeSummary?: unknown }
      >(`${BASE}/pricing/quote`, body);
      const lines = normalizeLines((raw as { lines: SaleQuoteLine[] }).lines ?? []);
      if ("subtotalPkr" in raw && typeof (raw as SaleQuoteResult).subtotalPkr === "number") {
        const r = raw as SaleQuoteResult;
        return {
          ...r,
          lines,
          freeUnits: lines.reduce((s, l) => s + Number(l.freeQty ?? 0), 0),
        };
      }
      const totals = (raw as { totals?: { subtotalPkr?: number; discountPkr?: number; taxPkr?: number; totalPkr?: number } })
        .totals;
      const subtotalPkr =
        totals?.subtotalPkr ?? lines.reduce((s, l) => s + l.quantity * l.unitPricePkr, 0);
      const discountPkr =
        totals?.discountPkr ?? lines.reduce((s, l) => s + Number(l.discountPkr ?? 0), 0);
      const freeUnits = lines.reduce((s, l) => s + Number(l.freeQty ?? 0), 0);
      const taxPkr = totals?.taxPkr ?? lines.reduce((s, l) => s + Number(l.taxPkr ?? 0), 0);
      const netPkr =
        totals?.totalPkr ??
        lines.reduce((s, l) => s + Number(l.netPkr ?? 0), 0);
      return { lines, subtotalPkr, discountPkr, freeUnits, taxPkr, netPkr };
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.quote = false;
      } else {
        throw err;
      }
    }
  }

  const lines: SaleQuoteLine[] = [];
  for (const line of body.lines) {
    let unitPricePkr = line.unitPricePkr ?? 0;
    let priceSource: string | null = line.unitPricePkr != null ? "cart" : null;
    try {
      const resolved = await resolvePharmacyPrice({
        medicineId: line.medicineId,
        tradeCustomerId: body.tradeCustomerId,
        priceLevel: body.priceLevel ?? "wholesale",
        qty: String(line.quantity),
      });
      if (resolved?.unitPricePkr != null) {
        unitPricePkr = resolved.unitPricePkr;
        priceSource = resolved.source ?? "resolve";
      }
    } catch {
      // keep cart / zero price
    }
    const netPkr = line.quantity * unitPricePkr;
    lines.push({
      medicineId: line.medicineId,
      quantity: line.quantity,
      unitPricePkr,
      priceSource,
      freeQty: 0,
      freeQuantity: 0,
      discountPkr: 0,
      taxPkr: 0,
      netPkr,
    });
  }
  const subtotalPkr = lines.reduce((s, l) => s + l.quantity * l.unitPricePkr, 0);
  return {
    lines,
    subtotalPkr,
    discountPkr: 0,
    freeUnits: 0,
    taxPkr: 0,
    netPkr: subtotalPkr,
  };
}

/** Structured validate; on 404 returns ok:true (book path still enforces server rules). */
export async function validateSale(body: SaleBookBody): Promise<SaleValidateResult> {
  if (capability.validate) {
    try {
      const raw = await postJson<
        SaleValidateResult | { valid?: boolean; errors?: SaleValidateIssue[]; warnings?: SaleValidateIssue[]; credit?: SaleValidateResult["credit"] }
      >(`${BASE}/validate`, body);
      if ("ok" in raw && typeof (raw as SaleValidateResult).ok === "boolean") {
        return raw as SaleValidateResult;
      }
      const wrapped = raw as {
        valid?: boolean;
        errors?: SaleValidateIssue[];
        warnings?: SaleValidateIssue[];
        credit?: SaleValidateResult["credit"];
      };
      const issues = [
        ...(wrapped.errors ?? []).map((e) => ({ ...e, severity: (e.severity ?? "error") as "error" | "warning" | "info" })),
        ...(wrapped.warnings ?? []).map((e) => ({
          ...e,
          severity: (e.severity ?? "warning") as "error" | "warning" | "info",
        })),
      ];
      return {
        ok: Boolean(wrapped.valid),
        issues,
        credit: wrapped.credit,
      };
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.validate = false;
      } else {
        throw err;
      }
    }
  }
  return { ok: true, issues: [] };
}

export async function fetchHeldSales(params: {
  branchCode: string;
}): Promise<SaleHeldOrder[]> {
  if (capability.held) {
    try {
      const raw = await getJson<unknown>(`${BASE}/held${qs({ branchCode: params.branchCode })}`);
      if (Array.isArray(raw)) return raw as SaleHeldOrder[];
      if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) {
        return (raw as { items: SaleHeldOrder[] }).items;
      }
      return [];
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.held = false;
      } else {
        throw err;
      }
    }
  }
  return [];
}

export async function deleteHeldSale(orderId: string): Promise<void> {
  if (!capability.held) return;
  try {
    await deleteJson(`${BASE}/held/${encodeURIComponent(orderId)}`);
  } catch (err) {
    if (isRouteMissing(err)) {
      capability.held = false;
      return;
    }
    throw err;
  }
}

/**
 * Book / hold (submit:false). Prefers sales/book; on 404 uses createPharmacyDistOrder.
 * Normalizes `{ booked, order }` from sales/book into a flat order result.
 */
export async function bookSale(body: SaleBookBody): Promise<SaleBookResult> {
  if (capability.book && body.submit !== false) {
    try {
      const raw = await postJson<
        SaleBookResult | { booked?: boolean; order?: SaleBookResult; validation?: { valid?: boolean; errors?: { message: string }[] } }
      >(`${BASE}/book`, body);
      if (raw && typeof raw === "object" && "order" in raw && (raw as { order?: SaleBookResult }).order) {
        const wrapped = raw as {
          booked?: boolean;
          order: SaleBookResult;
          validation?: { valid?: boolean; errors?: { message: string }[] };
        };
        if (wrapped.booked === false) {
          const msg =
            wrapped.validation?.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
            "Sale validation failed";
          throw new Error(msg);
        }
        return { ...wrapped.order, booked: true };
      }
      return raw as SaleBookResult;
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.book = false;
      } else {
        throw err;
      }
    }
  }

  return (await createPharmacyDistOrder({
    branchCode: body.branchCode,
    tradeCustomerId: body.tradeCustomerId,
    warehouseId: body.warehouseId,
    salesmanEmployeeId: body.salesmanEmployeeId,
    submit: body.submit !== false,
    creditOverride: body.creditOverride || undefined,
    creditOverrideReason: body.creditOverrideReason,
    idempotencyKey: body.idempotencyKey,
    notes: body.notes,
    lines: body.lines.map((l) => ({
      medicineId: l.medicineId,
      quantity: l.quantity,
      freeQuantity: l.freeQuantity,
      unitPricePkr: l.unitPricePkr,
      discountPkr: l.discountPkr,
    })),
  })) as SaleBookResult;
}

/** FEFO availability for cart lines (Phase 4). */
export async function checkSaleAvailability(body: {
  branchCode: string;
  warehouseId?: string;
  lines: { medicineId: string; quantity: number; batchId?: string | null }[];
}) {
  return inventoryApi.checkAvailability(body);
}

export function formatSaleValidateErrors(result: SaleValidateResult): string {
  if (result.ok && !result.issues.length) return "";
  const errs = result.issues.filter((i) => (i.severity ?? "error") === "error");
  const msgs = (errs.length ? errs : result.issues).map((i) => i.message);
  if (msgs.length) return msgs.join("; ");
  if (result.credit?.blocked) return "Credit limit would be exceeded";
  return "Validation failed";
}

export function salesApiCapabilities() {
  return { ...capability };
}
