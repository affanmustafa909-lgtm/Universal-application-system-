/**
 * Phase 7 distribution delivery / dispatch / POD API client.
 * Prefers `/v1/pharmacy/delivery/*`; falls back to legacy
 * `/v1/pharmacy/distribution/deliveries` + dashboard deliveries when new routes 404.
 */
import { authFetch } from "../../lib/authFetch";
import {
  createPharmacyDelivery,
  fetchDashboardDeliveries,
  fetchPharmacyDeliveries,
  updatePharmacyDelivery,
  type DistDashboardDeliveries,
} from "./pharmacy-erp";

const BASE = "/v1/pharmacy/delivery";

export class DeliveryApiHttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "DeliveryApiHttpError";
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
    throw new DeliveryApiHttpError(res.status, message, details);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const { message, details } = await parseErrorBody(res);
    throw new DeliveryApiHttpError(res.status, message, details);
  }
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) {
    const { message, details } = await parseErrorBody(res);
    throw new DeliveryApiHttpError(res.status, message, details);
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
  if (!(err instanceof DeliveryApiHttpError) || err.status !== 404) return false;
  const m = err.message || "";
  return /Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(m);
}

/** Soft capability flags — once a route 404s we skip it for the session. */
const capability = {
  dashboard: true,
  orders: true,
  orderMutations: true,
  pod: true,
  dispatch: true,
  assign: true,
  drivers: true,
  vehicles: true,
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

export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "dispatched"
  | "out_for_delivery"
  | "delivered"
  | "partial"
  | "failed"
  | "refused"
  | "cancelled"
  | string;

export type DeliveryOrder = {
  id: string;
  deliveryNumber: string;
  status: DeliveryStatus;
  branchCode?: string | null;
  branchName?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  orderTotalPkr?: number | null;
  invoiceTotalPkr?: number | null;
  tradeCustomerId?: string | null;
  tradeCustomerName?: string | null;
  tradeCustomerCode?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  riderName?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  vehicleLabel?: string | null;
  routeId?: string | null;
  routeName?: string | null;
  routeCode?: string | null;
  collectedPkr?: number | null;
  podNotes?: string | null;
  failedReason?: string | null;
  receiverName?: string | null;
  signatureText?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  createdAt?: string | null;
  lines?: DeliveryLine[];
};

export type DeliveryLine = {
  id?: string;
  medicineId?: string | null;
  productLabel?: string | null;
  medicineName?: string | null;
  medicineSku?: string | null;
  batchNumber?: string | null;
  quantity?: number;
  deliveredQty?: number;
  returnedQty?: number;
  unitPricePkr?: number;
};

export type DeliveryDashboard = {
  generatedAt?: string;
  source?: "phase7" | "legacy";
  kpis: {
    total: number;
    pending: number;
    assigned: number;
    readyForDispatch: number;
    dispatched: number;
    outForDelivery: number;
    delivered: number;
    partial: number;
    failed: number;
    refused: number;
    collectedPkr: number;
  };
  byStatus: { status: string; count: number; collectedPkr: number }[];
  links?: Record<string, string>;
};

export type DeliveryDriver = {
  id: string;
  name: string;
  code?: string | null;
  phone?: string | null;
  status?: string | null;
  vehicleId?: string | null;
};

export type DeliveryVehicle = {
  id: string;
  label: string;
  plateNumber?: string | null;
  status?: string | null;
};

export type CreateDeliveryInput = {
  branchCode: string;
  orderId?: string;
  invoiceId?: string;
  tradeCustomerId?: string;
  riderName?: string;
  driverId?: string;
  vehicleId?: string;
  routeId?: string;
  notes?: string;
};

export type AssignDeliveryInput = {
  driverId?: string;
  vehicleId?: string;
  routeId?: string;
  riderName?: string;
};

export type DispatchDeliveryInput = {
  driverId?: string;
  vehicleId?: string;
  routeId?: string;
  riderName?: string;
  notes?: string;
};

export type PodOutcome = "delivered" | "partial" | "failed" | "refused";

export type PodDeliveryInput = {
  status: PodOutcome;
  podNotes?: string;
  failedReason?: string;
  collectedPkr?: number;
  receiverName?: string;
  signatureText?: string;
};

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function mapLegacyDelivery(row: Record<string, unknown>): DeliveryOrder {
  const linesRaw = Array.isArray(row.lines) ? (row.lines as Record<string, unknown>[]) : undefined;
  const tradeCustomerName = pickStr(
    row.tradeCustomerName,
    row.customerName,
    row.contactName,
    row.trade_customer_name,
  );
  const routeName = pickStr(row.routeName, row.route_name, row.routeCode, row.route_code);
  return {
    id: String(row.id ?? ""),
    deliveryNumber: String(row.deliveryNumber ?? row.id ?? ""),
    status: String(row.status ?? "pending"),
    branchCode: pickStr(row.branchCode, row.branch_code),
    branchName: pickStr(row.branchName, row.branch_name),
    orderId: pickStr(row.orderId, row.order_id),
    orderNumber: pickStr(row.orderNumber, row.order_number),
    invoiceId: pickStr(row.invoiceId, row.invoice_id),
    invoiceNumber: pickStr(row.invoiceNumber, row.invoice_number),
    orderTotalPkr: row.orderTotalPkr != null ? Number(row.orderTotalPkr) : null,
    invoiceTotalPkr: row.invoiceTotalPkr != null ? Number(row.invoiceTotalPkr) : null,
    tradeCustomerId: pickStr(row.tradeCustomerId, row.trade_customer_id),
    tradeCustomerName,
    tradeCustomerCode: pickStr(row.tradeCustomerCode, row.customerCode, row.trade_customer_code),
    contactName: pickStr(row.contactName, row.contact_name),
    contactPhone: pickStr(row.contactPhone, row.contact_phone),
    address: pickStr(row.address),
    riderName: pickStr(row.riderName, row.rider_name),
    driverId: pickStr(row.driverId, row.driver_id),
    driverName: pickStr(row.driverName, row.driver_name),
    vehicleId: pickStr(row.vehicleId, row.vehicle_id),
    vehicleLabel: pickStr(row.vehicleLabel, row.vehicle_label),
    routeId: pickStr(row.routeId, row.route_id),
    routeName,
    routeCode: pickStr(row.routeCode, row.route_code),
    collectedPkr: row.collectedPkr != null ? Number(row.collectedPkr) : null,
    podNotes: pickStr(row.podNotes, row.pod_notes),
    failedReason: pickStr(row.failedReason, row.failed_reason),
    receiverName: pickStr(row.receiverName, row.receiver_name),
    signatureText: pickStr(row.signatureText, row.signature_text),
    dispatchedAt: (row.dispatchedAt as string) ?? null,
    deliveredAt: (row.deliveredAt as string) ?? null,
    createdAt: (row.createdAt as string) ?? null,
    lines: linesRaw?.map((l) => ({
      id: l.id != null ? String(l.id) : undefined,
      medicineId: (l.medicineId as string) ?? null,
      productLabel: (l.productLabel as string) ?? null,
      medicineName: (l.medicineName as string) ?? null,
      medicineSku: (l.medicineSku as string) ?? null,
      batchNumber: (l.batchNumber as string) ?? null,
      quantity: Number(l.quantity ?? 0),
      deliveredQty: Number(l.deliveredQty ?? 0),
      returnedQty: Number(l.returnedQty ?? 0),
      unitPricePkr: Number(l.unitPricePkr ?? 0),
    })),
  };
}

function dashboardFromLegacy(d: DistDashboardDeliveries): DeliveryDashboard {
  const byStatus = d.byStatus ?? [];
  const count = (status: string) =>
    byStatus
      .filter((s) => String(s.status).toLowerCase() === status)
      .reduce((sum, s) => sum + Number(s.count ?? 0), 0);
  const pendingish = byStatus
    .filter((s) => {
      const st = String(s.status).toLowerCase();
      return st !== "delivered" && st !== "cancelled" && st !== "refused";
    })
    .reduce((sum, s) => sum + Number(s.count ?? 0), 0);
  return {
    generatedAt: d.generatedAt,
    source: "legacy",
    kpis: {
      total: Number(d.total ?? 0),
      pending: count("pending") || pendingish,
      assigned: count("assigned"),
      readyForDispatch: count("ready") + count("packed") + count("assigned") + count("pending"),
      dispatched: count("dispatched"),
      outForDelivery: count("out_for_delivery"),
      delivered: count("delivered"),
      partial: count("partial"),
      failed: count("failed"),
      refused: count("refused"),
      collectedPkr: Number(d.collectedPkr ?? 0),
    },
    byStatus: byStatus.map((s) => ({
      status: String(s.status),
      count: Number(s.count ?? 0),
      collectedPkr: Number(s.collectedPkr ?? 0),
    })),
    links: {
      deliveries: "/pops/distribution/deliveries",
      dispatch: "/pops/distribution/dispatch",
    },
  };
}

/** Phase-7 DeliveryDashboardService returns flat KPI fields (no nested `kpis`). */
function dashboardFromPhase7Flat(raw: Record<string, unknown>): DeliveryDashboard {
  const n = (key: string) => Number(raw[key] ?? 0);
  const ready = n("ready");
  const pendingDispatch = n("pendingDispatch");
  const dispatched = n("dispatched");
  const outForDelivery = n("outForDelivery");
  const deliveredToday = n("deliveredToday");
  const failed = n("failed");
  const podPending = n("podPending");
  const totalOpen = n("totalOpen");
  const byStatus = (
    [
      { status: "ready", count: ready },
      { status: "pending", count: pendingDispatch },
      { status: "dispatched", count: dispatched },
      { status: "out_for_delivery", count: outForDelivery },
      { status: "delivered", count: deliveredToday },
      { status: "failed", count: failed },
      { status: "pod_pending", count: podPending },
    ] as const
  )
    .filter((s) => s.count > 0)
    .map((s) => ({ status: s.status, count: s.count, collectedPkr: 0 }));

  return {
    generatedAt: typeof raw.asOf === "string" ? raw.asOf : undefined,
    source: "phase7",
    kpis: {
      total:
        totalOpen ||
        ready + pendingDispatch + dispatched + outForDelivery + failed + podPending,
      pending: pendingDispatch + ready,
      assigned: 0,
      readyForDispatch: ready + pendingDispatch,
      dispatched,
      outForDelivery,
      delivered: deliveredToday,
      partial: 0,
      failed,
      refused: 0,
      collectedPkr: 0,
    },
    byStatus,
    links: {
      deliveries: "/pops/distribution/deliveries",
      dispatch: "/pops/distribution/dispatch",
    },
  };
}

function normalizeDeliveryDashboard(raw: unknown): DeliveryDashboard {
  if (raw && typeof raw === "object" && "kpis" in (raw as object)) {
    return { ...(raw as DeliveryDashboard), source: (raw as DeliveryDashboard).source ?? "phase7" };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (
      "ready" in o ||
      "pendingDispatch" in o ||
      "outForDelivery" in o ||
      "deliveredToday" in o ||
      "totalOpen" in o
    ) {
      return dashboardFromPhase7Flat(o);
    }
    if ("byStatus" in o || "total" in o) {
      return dashboardFromLegacy(o as DistDashboardDeliveries);
    }
  }
  return dashboardFromPhase7Flat({});
}

function filterLegacy(
  items: DeliveryOrder[],
  params: { status?: string; q?: string; routeId?: string },
): DeliveryOrder[] {
  let list = items;
  if (params.status) {
    const st = params.status.toLowerCase();
    if (st === "pending") {
      list = list.filter((r) => {
        const s = String(r.status).toLowerCase();
        return s !== "delivered" && s !== "cancelled" && s !== "refused";
      });
    } else if (st === "ready" || st === "dispatch") {
      list = list.filter((r) => {
        const s = String(r.status).toLowerCase();
        return ["pending", "assigned", "ready", "packed"].includes(s);
      });
    } else {
      list = list.filter((r) => String(r.status).toLowerCase() === st);
    }
  }
  if (params.routeId) list = list.filter((r) => r.routeId === params.routeId);
  if (params.q) {
    const q = params.q.toLowerCase();
    list = list.filter(
      (r) =>
        r.deliveryNumber.toLowerCase().includes(q) ||
        String(r.riderName ?? "").toLowerCase().includes(q) ||
        String(r.tradeCustomerName ?? "").toLowerCase().includes(q) ||
        String(r.orderNumber ?? "").toLowerCase().includes(q) ||
        String(r.invoiceNumber ?? "").toLowerCase().includes(q),
    );
  }
  return list;
}

export const deliveryApi = {
  async dashboard(params: { branchCode?: string }): Promise<DeliveryDashboard> {
    if (capability.dashboard) {
      try {
        const raw = await getJson<unknown>(
          `${BASE}/dashboard${qs({ branchCode: params.branchCode })}`,
        );
        return normalizeDeliveryDashboard(raw);
      } catch (err) {
        if (isRouteMissing(err)) capability.dashboard = false;
        else throw err;
      }
    }
    const legacy = await fetchDashboardDeliveries({ branchCode: params.branchCode });
    return dashboardFromLegacy(legacy);
  },

  async listOrders(
    params: PageParams & {
      branchCode: string;
      status?: string;
      q?: string;
      routeId?: string;
      driverId?: string;
    },
  ): Promise<PageResult<DeliveryOrder>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    if (capability.orders) {
      try {
        const raw = await getJson<unknown>(
          `${BASE}/orders${qs({
            branchCode: params.branchCode,
            status: params.status,
            q: params.q,
            routeId: params.routeId,
            driverId: params.driverId,
            page,
            pageSize,
          })}`,
        );
        const normalized = normalizePage<Record<string, unknown>>(raw);
        return {
          ...normalized,
          items: normalized.items.map(mapLegacyDelivery),
        };
      } catch (err) {
        if (isRouteMissing(err)) capability.orders = false;
        else throw err;
      }
    }
    const rows = (await fetchPharmacyDeliveries(params.branchCode)) as Record<string, unknown>[];
    const mapped = filterLegacy(rows.map(mapLegacyDelivery), params);
    return asPage(mapped, page, pageSize);
  },

  async getOrder(id: string): Promise<DeliveryOrder> {
    if (capability.orders) {
      try {
        const raw = await getJson<Record<string, unknown>>(`${BASE}/orders/${encodeURIComponent(id)}`);
        return mapLegacyDelivery(raw);
      } catch (err) {
        if (isRouteMissing(err)) capability.orders = false;
        else throw err;
      }
    }
    throw new DeliveryApiHttpError(404, "Delivery detail API not available");
  },

  async createOrder(body: CreateDeliveryInput): Promise<DeliveryOrder> {
    if (capability.orderMutations) {
      try {
        const raw = await postJson<Record<string, unknown>>(`${BASE}/orders`, body);
        return mapLegacyDelivery(raw);
      } catch (err) {
        if (isRouteMissing(err)) capability.orderMutations = false;
        else throw err;
      }
    }
    const raw = (await createPharmacyDelivery(body)) as Record<string, unknown>;
    return mapLegacyDelivery(raw);
  },

  async assign(id: string, body: AssignDeliveryInput): Promise<DeliveryOrder> {
    if (capability.assign) {
      try {
        const raw = await patchJson<Record<string, unknown>>(`${BASE}/orders/${id}/assign`, body);
        return mapLegacyDelivery(raw);
      } catch (err) {
        if (isRouteMissing(err)) capability.assign = false;
        else throw err;
      }
    }
    const raw = (await updatePharmacyDelivery(id, {
      ...body,
      status: "assigned",
      riderName: body.riderName,
    })) as Record<string, unknown>;
    return mapLegacyDelivery(raw);
  },

  async dispatch(id: string, body: DispatchDeliveryInput = {}): Promise<DeliveryOrder> {
    if (capability.dispatch) {
      try {
        const raw = await patchJson<Record<string, unknown>>(`${BASE}/orders/${id}/dispatch`, body);
        return mapLegacyDelivery(raw);
      } catch (err) {
        if (isRouteMissing(err)) capability.dispatch = false;
        else throw err;
      }
    }
    const raw = (await updatePharmacyDelivery(id, {
      ...body,
      status: "dispatched",
      riderName: body.riderName,
    })) as Record<string, unknown>;
    return mapLegacyDelivery(raw);
  },

  async pod(id: string, body: PodDeliveryInput): Promise<DeliveryOrder> {
    if (capability.pod) {
      try {
        const raw = await patchJson<Record<string, unknown>>(`${BASE}/orders/${id}/pod`, body);
        return mapLegacyDelivery(raw);
      } catch (err) {
        if (isRouteMissing(err)) capability.pod = false;
        else throw err;
      }
    }
    const raw = (await updatePharmacyDelivery(id, {
      status: body.status,
      podNotes: body.podNotes,
      failedReason: body.failedReason,
      collectedPkr: body.collectedPkr ?? 0,
      receiverName: body.receiverName,
      signatureText: body.signatureText ?? body.receiverName,
    })) as Record<string, unknown>;
    return mapLegacyDelivery(raw);
  },

  async listDrivers(params: { branchCode?: string; q?: string } = {}): Promise<DeliveryDriver[]> {
    if (!capability.drivers) return [];
    try {
      const raw = await getJson<unknown>(
        `${BASE}/drivers${qs({ branchCode: params.branchCode, q: params.q, pageSize: 100 })}`,
      );
      const rows = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
          ? (raw as { items: Record<string, unknown>[] }).items
          : [];
      return rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          code: (row.code as string) ?? null,
          phone: (row.phone as string) ?? null,
          status: (row.status as string) ?? null,
          vehicleId: (row.vehicleId as string) ?? null,
        };
      }).filter((d) => d.id && d.name);
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.drivers = false;
        return [];
      }
      throw err;
    }
  },

  async createDriver(body: {
    branchCode?: string;
    name: string;
    code?: string;
    phone?: string;
    vehicleId?: string;
  }): Promise<DeliveryDriver> {
    if (!capability.drivers) {
      throw new DeliveryApiHttpError(404, "Drivers API not available");
    }
    try {
      const code =
        body.code?.trim() ||
        `DRV-${body.name
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "")
          .slice(0, 8) || Date.now().toString(36).toUpperCase()}`;
      const raw = await postJson<Record<string, unknown>>(`${BASE}/drivers`, {
        branchCode: body.branchCode,
        name: body.name.trim(),
        code,
        phone: body.phone,
        vehicleId: body.vehicleId,
        status: "active",
      });
      return {
        id: String(raw.id ?? ""),
        name: String(raw.name ?? body.name),
        code: (raw.code as string) ?? code,
        phone: (raw.phone as string) ?? body.phone ?? null,
        status: (raw.status as string) ?? "active",
        vehicleId: (raw.vehicleId as string) ?? body.vehicleId ?? null,
      };
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.drivers = false;
        throw new DeliveryApiHttpError(404, "Drivers API not available");
      }
      throw err;
    }
  },

  async listVehicles(params: { branchCode?: string; q?: string } = {}): Promise<DeliveryVehicle[]> {
    if (!capability.vehicles) return [];
    try {
      const raw = await getJson<unknown>(
        `${BASE}/vehicles${qs({ branchCode: params.branchCode, q: params.q, pageSize: 100 })}`,
      );
      const rows = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
          ? (raw as { items: Record<string, unknown>[] }).items
          : [];
      return rows.map((r) => {
        const row = r as Record<string, unknown>;
        const code = String(row.code ?? "");
        const plate = String(row.registrationNo ?? row.plateNumber ?? "");
        return {
          id: String(row.id ?? ""),
          label: code || plate || String(row.label ?? "Vehicle"),
          plateNumber: plate || null,
          status: (row.status as string) ?? null,
        };
      }).filter((v) => v.id);
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.vehicles = false;
        return [];
      }
      throw err;
    }
  },

  async createVehicle(body: {
    branchCode?: string;
    label: string;
    plateNumber?: string;
  }): Promise<DeliveryVehicle> {
    if (!capability.vehicles) {
      throw new DeliveryApiHttpError(404, "Vehicles API not available");
    }
    try {
      const label = body.label.trim();
      const plate = (body.plateNumber ?? label).trim();
      const code =
        label
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 16) || `VEH-${Date.now().toString(36).toUpperCase()}`;
      const raw = await postJson<Record<string, unknown>>(`${BASE}/vehicles`, {
        branchCode: body.branchCode,
        code,
        registrationNo: plate || code,
        status: "available",
      });
      return {
        id: String(raw.id ?? ""),
        label: String(raw.code ?? code),
        plateNumber: (raw.registrationNo as string) ?? plate,
        status: (raw.status as string) ?? "available",
      };
    } catch (err) {
      if (isRouteMissing(err)) {
        capability.vehicles = false;
        throw new DeliveryApiHttpError(404, "Vehicles API not available");
      }
      throw err;
    }
  },

  capabilities() {
    return { ...capability };
  },
};
