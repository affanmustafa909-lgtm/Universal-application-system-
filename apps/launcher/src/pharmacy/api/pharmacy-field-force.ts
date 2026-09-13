/**
 * Phase 8 field-force client. Prefers `/v1/pharmacy/field-force/*`.
 * Falls back to sales-force / assignments / visits / targets when routes 404.
 */
import { authFetch } from "../../lib/authFetch";
import {
  createPharmacyAssignment,
  createPharmacySalesForce,
  createPharmacyVisit,
  fetchDashboardFieldForce,
  fetchPharmacyAssignments,
  fetchPharmacyEmployeesPicker,
  fetchPharmacySalesForce,
  fetchPharmacyTargets,
  fetchPharmacyVisits,
} from "./pharmacy-erp";

const BASE = "/v1/pharmacy/field-force";

export class FieldForceApiHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "FieldForceApiHttpError";
    this.status = status;
  }
}

async function parseError(res: Response) {
  try {
    const j = (await res.json()) as { message?: string | string[] };
    return typeof j.message === "string" ? j.message : Array.isArray(j.message) ? j.message.join(", ") : res.statusText;
  } catch {
    return res.statusText || "Request failed";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) throw new FieldForceApiHttpError(res.status, await parseError(res));
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new FieldForceApiHttpError(res.status, await parseError(res));
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    s.set(k, String(v));
  }
  const out = s.toString();
  return out ? `?${out}` : "";
}

function isMissing(err: unknown) {
  return err instanceof FieldForceApiHttpError && err.status === 404 && /Cannot (GET|POST|PATCH)/i.test(err.message);
}

const cap = { dashboard: true, salesmen: true, pjp: true, visits: true, targets: true, performance: true };

export function achievementLabel(pct: number | null | undefined) {
  if (pct == null || Number.isNaN(pct)) return "N/A";
  return `${pct}%`;
}

export type FieldForceDashboard = {
  date: string;
  kpis: {
    totalSalesmen: number;
    activeSalesmen: number;
    plannedVisits: number;
    completedVisits: number;
    inProgress: number;
    missedVisits: number;
    cancelledVisits: number;
    orders: number;
    salesPkr: number;
    collectionsPkr: number;
    visitAchievementPct: number | null;
    salesAchievementPct: number | null;
    collectionAchievementPct: number | null;
    salesTargetPkr: number;
    collectionTargetPkr: number;
  };
  alerts: { severity: string; title: string; count: number; to: string }[];
};

export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

export const fieldForceApi = {
  async dashboard(params: { branchCode?: string; employeeId?: string; date?: string }) {
    if (cap.dashboard) {
      try {
        return await getJson<FieldForceDashboard>(`${BASE}/dashboard${qs(params)}`);
      } catch (err) {
        if (!isMissing(err)) throw err;
        cap.dashboard = false;
      }
    }
    const legacy = await fetchDashboardFieldForce(params);
    const s = (legacy as { summary?: { planned?: number; completed?: number; missed?: number } })?.summary;
    return {
      date: params.date ?? new Date().toISOString().slice(0, 10),
      kpis: {
        totalSalesmen: 0,
        activeSalesmen: 0,
        plannedVisits: Number(s?.planned ?? 0),
        completedVisits: Number(s?.completed ?? 0),
        inProgress: 0,
        missedVisits: Number(s?.missed ?? 0),
        cancelledVisits: 0,
        orders: 0,
        salesPkr: 0,
        collectionsPkr: 0,
        visitAchievementPct: null,
        salesAchievementPct: null,
        collectionAchievementPct: null,
        salesTargetPkr: 0,
        collectionTargetPkr: 0,
      },
      alerts: [],
    } satisfies FieldForceDashboard;
  },

  async salesmen(params: { branchCode?: string; q?: string; status?: string; page?: number; pageSize?: number }) {
    if (cap.salesmen) {
      try {
        return await getJson<PageResult<Record<string, unknown>>>(`${BASE}/salesmen${qs(params)}`);
      } catch (err) {
        if (!isMissing(err)) throw err;
        cap.salesmen = false;
      }
    }
    const rows = (await fetchPharmacySalesForce()) as Record<string, unknown>[];
    const employees = await fetchPharmacyEmployeesPicker();
    const names = new Map(employees.map((e) => [e.id, e]));
    const items = rows.map((r) => {
      const emp = names.get(String(r.employeeId));
      return {
        ...r,
        employeeName: emp?.name,
        employeeCode: emp?.employeeCode,
      };
    });
    return { items, page: 1, pageSize: items.length, total: items.length, totalPages: 1 };
  },

  salesman(employeeId: string) {
    return getJson<Record<string, unknown>>(`${BASE}/salesmen/${employeeId}`);
  },

  salesmanCustomers(employeeId: string) {
    return getJson<PageResult<Record<string, unknown>>>(`${BASE}/salesmen/${employeeId}/customers`);
  },

  upsertSalesman(body: unknown) {
    return postJson(`${BASE}/salesmen`, body).catch(async (err) => {
      if (!isMissing(err)) throw err;
      return createPharmacySalesForce(body);
    });
  },

  assignCustomer(body: unknown) {
    return postJson(`${BASE}/assignments/customer`, body);
  },

  route(routeId: string) {
    return getJson<Record<string, unknown>>(`${BASE}/routes/${routeId}`);
  },

  addRouteCustomer(routeId: string, body: unknown) {
    return postJson(`${BASE}/routes/${routeId}/customers`, body);
  },

  reorderRoute(routeId: string, customerIds: string[]) {
    return postJson(`${BASE}/routes/${routeId}/reorder`, { customerIds });
  },

  async pjp(params: { employeeId?: string; status?: string; branchCode?: string; page?: number }) {
    if (cap.pjp) {
      try {
        return await getJson<PageResult<Record<string, unknown>>>(`${BASE}/pjp${qs(params)}`);
      } catch (err) {
        if (!isMissing(err)) throw err;
        cap.pjp = false;
      }
    }
    throw new FieldForceApiHttpError(404, "PJP API is not available on this server");
  },

  getPjp(id: string) {
    return getJson<Record<string, unknown>>(`${BASE}/pjp/${id}`);
  },

  createPjp(body: unknown) {
    return postJson(`${BASE}/pjp`, body);
  },

  generateVisits(body: unknown) {
    return postJson(`${BASE}/visits/generate`, body);
  },

  closeDay(body: unknown) {
    return postJson(`${BASE}/visits/close-day`, body);
  },

  async visits(params: Record<string, string | number | undefined>) {
    if (cap.visits) {
      try {
        return await getJson<PageResult<Record<string, unknown>>>(`${BASE}/visits${qs(params)}`);
      } catch (err) {
        if (!isMissing(err)) throw err;
        cap.visits = false;
      }
    }
    const rows = (await fetchPharmacyVisits()) as Record<string, unknown>[];
    return { items: rows, page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 };
  },

  visit(id: string) {
    return getJson<{ visit: Record<string, unknown>; customer: Record<string, unknown> | null }>(`${BASE}/visits/${id}`);
  },

  startVisit(id: string, body: unknown = {}) {
    return postJson(`${BASE}/visits/${id}/start`, body).catch(async (err) => {
      if (!isMissing(err)) throw err;
      return createPharmacyVisit(body);
    });
  },

  completeVisit(id: string, body: unknown) {
    return postJson(`${BASE}/visits/${id}/complete`, body);
  },

  missVisit(id: string, reason?: string) {
    return postJson(`${BASE}/visits/${id}/miss`, { reason });
  },

  rescheduleVisit(id: string, body: { newDate: string; reason: string }) {
    return postJson(`${BASE}/visits/${id}/reschedule`, body);
  },

  async targets(params: Record<string, string | number | undefined>) {
    if (cap.targets) {
      try {
        return await getJson<PageResult<Record<string, unknown>>>(`${BASE}/targets${qs(params)}`);
      } catch (err) {
        if (!isMissing(err)) throw err;
        cap.targets = false;
      }
    }
    const rows = (await fetchPharmacyTargets()) as Record<string, unknown>[];
    return { items: rows, page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 };
  },

  createTarget(body: unknown) {
    return postJson(`${BASE}/targets`, body);
  },

  async performance(params: { from?: string; to?: string; group?: string; branchCode?: string }) {
    if (cap.performance) {
      try {
        return await getJson<{ items: Record<string, unknown>[] }>(`${BASE}/performance${qs(params)}`);
      } catch (err) {
        if (!isMissing(err)) throw err;
        cap.performance = false;
      }
    }
    return { items: [] };
  },

  coverage(params: { employeeId?: string; from?: string; to?: string }) {
    return getJson<Record<string, unknown>>(`${BASE}/coverage${qs(params)}`);
  },

  /** Legacy assignment create — still used as a fallback daily brief. */
  createAssignment(body: unknown) {
    return createPharmacyAssignment(body);
  },

  listAssignments(branchCode?: string) {
    return fetchPharmacyAssignments(branchCode);
  },
};
