import { authFetch } from "../../lib/authFetch";

function qs(branchCode: string): string {
  return new URLSearchParams({ branchCode }).toString();
}

async function getJson<T = unknown>(path: string): Promise<T> {
  const res = await authFetch(path);
  const text = await res.text();
  if (!res.ok) {
    let msg = "Request failed";
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (typeof j.message === "string") msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.join(", ");
    } catch {
      if (text.trim()) msg = text.trim();
    }
    throw new Error(msg);
  }
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

async function postJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    let msg = "Request failed";
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (typeof j.message === "string") msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.join(", ");
    } catch {
      if (text.trim()) msg = text.trim();
    }
    throw new Error(msg);
  }
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

async function patchJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "PATCH", body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    let msg = "Request failed";
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (typeof j.message === "string") msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.join(", ");
    } catch {
      if (text.trim()) msg = text.trim();
    }
    throw new Error(msg);
  }
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export const fetchPharmacyCompanies = () => getJson<any[]>("/v1/pharmacy/companies");
export const createPharmacyCompany = (body: unknown) => postJson("/v1/pharmacy/companies", body);

export const fetchPharmacyWarehouses = (branchCode: string) =>
  getJson<any[]>(`/v1/pharmacy/warehouses?${qs(branchCode)}`);
export const createPharmacyWarehouse = (body: unknown) => postJson("/v1/pharmacy/warehouses", body);

export const fetchPharmacyTerritories = () => getJson<any[]>("/v1/pharmacy/territories");
export const createPharmacyTerritory = (body: unknown) => postJson("/v1/pharmacy/territories", body);
export const fetchPharmacyProvinces = () => getJson<any[]>("/v1/pharmacy/provinces");
export const createPharmacyProvince = (body: unknown) => postJson("/v1/pharmacy/provinces", body);
export const fetchPharmacyDivisions = () => getJson<any[]>("/v1/pharmacy/divisions");
export const createPharmacyDivision = (body: unknown) => postJson("/v1/pharmacy/divisions", body);
export const fetchPharmacyDistricts = () => getJson<any[]>("/v1/pharmacy/districts");
export const createPharmacyDistrict = (body: unknown) => postJson("/v1/pharmacy/districts", body);
export const fetchPharmacyCities = () => getJson<any[]>("/v1/pharmacy/cities");
export const createPharmacyCity = (body: unknown) => postJson("/v1/pharmacy/cities", body);
export const fetchPharmacyAreas = () => getJson<any[]>("/v1/pharmacy/areas");
export const createPharmacyArea = (body: unknown) => postJson("/v1/pharmacy/areas", body);
export const fetchPharmacyGeoTerritories = () => getJson<any[]>("/v1/pharmacy/geo-territories");
export const createPharmacyGeoTerritory = (body: unknown) => postJson("/v1/pharmacy/geo-territories", body);
function asRowArray<T = Record<string, unknown>>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const o = raw as { items?: unknown; data?: unknown };
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.data)) return o.data as T[];
  }
  return [];
}

export const fetchPharmacyRoutes = async () => asRowArray(await getJson("/v1/pharmacy/routes"));
export const createPharmacyRoute = (body: unknown) => postJson("/v1/pharmacy/routes", body);

export const fetchPharmacyTradeCustomers = async (branchCode?: string) =>
  asRowArray(
    await getJson(
      branchCode ? `/v1/pharmacy/trade-customers?${qs(branchCode)}` : "/v1/pharmacy/trade-customers",
    ),
  );
export const createPharmacyTradeCustomer = (body: unknown) => postJson("/v1/pharmacy/trade-customers", body);

export const fetchPharmacySalesForce = () => getJson<any[]>("/v1/pharmacy/sales-force");
export const createPharmacySalesForce = (body: unknown) => postJson("/v1/pharmacy/sales-force", body);

export const fetchPharmacyPurchaseOrders = (branchCode: string) =>
  getJson<any[]>(`/v1/pharmacy/purchase-orders?${qs(branchCode)}`);
export const createPharmacyPurchaseOrder = (body: unknown) => postJson("/v1/pharmacy/purchase-orders", body);
export const approvePharmacyPurchaseOrder = (id: string) =>
  postJson(`/v1/pharmacy/purchase-orders/${id}/approve`, {});

export const fetchPharmacyGrns = (branchCode: string) => getJson<any[]>(`/v1/pharmacy/grns?${qs(branchCode)}`);
export const createPharmacyGrn = (body: unknown) => postJson("/v1/pharmacy/grns", body);

export const fetchPharmacySaleReturns = (branchCode: string) =>
  getJson<any[]>(`/v1/pharmacy/sales/returns?${qs(branchCode)}`);
export const createPharmacySaleReturn = (body: unknown) => postJson("/v1/pharmacy/sales/returns", body);

export const fetchPharmacyPurchaseReturns = (branchCode: string) =>
  getJson<any[]>(`/v1/pharmacy/purchase-returns?${qs(branchCode)}`);
export const createPharmacyPurchaseReturn = (body: unknown) => postJson("/v1/pharmacy/purchase-returns", body);

export const fetchPharmacyDistOrders = (branchCode: string) =>
  getJson<any[]>(`/v1/pharmacy/distribution/orders?${qs(branchCode)}`);
export const fetchPharmacyDistOrder = (id: string) =>
  getJson<Record<string, unknown>>(`/v1/pharmacy/distribution/orders/${encodeURIComponent(id)}`);
export const fetchPharmacyDistInvoices = (branchCode: string) =>
  getJson<any[]>(`/v1/pharmacy/distribution/invoices?${qs(branchCode)}`);
export const createPharmacyDistOrder = (body: unknown) => postJson("/v1/pharmacy/distribution/orders", body);
export const approvePharmacyDistOrder = (id: string) =>
  postJson(`/v1/pharmacy/distribution/orders/${id}/approve`, {});
export const invoicePharmacyDistOrder = (id: string, body?: { paymentMethod?: string }) =>
  postJson(`/v1/pharmacy/distribution/orders/${id}/invoice`, body ?? {});

let cashSettleRouteOk = true;

/**
 * Approve + Cash invoice in one round-trip when the API supports `/cash-settle`.
 * Falls back to approve → invoice (still skips warehouse pipeline hops).
 */
export async function cashSettlePharmacyDistOrder(id: string): Promise<{
  id?: string;
  invoiceNumber?: string;
  totalPkr?: number;
  amountDuePkr?: number;
  amountPaidPkr?: number;
  [key: string]: unknown;
}> {
  if (cashSettleRouteOk) {
    try {
      return await postJson(`/v1/pharmacy/distribution/orders/${id}/cash-settle`, {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Cannot POST|Not Found|404|cash-settle/i.test(msg)) {
        cashSettleRouteOk = false;
      } else {
        throw err;
      }
    }
  }
  await approvePharmacyDistOrder(id);
  return invoicePharmacyDistOrder(id, { paymentMethod: "Cash" }) as Promise<{
    id?: string;
    invoiceNumber?: string;
    totalPkr?: number;
    amountDuePkr?: number;
    amountPaidPkr?: number;
    [key: string]: unknown;
  }>;
}

export const advancePharmacyDistOrder = (id: string, status: string) =>
  postJson(`/v1/pharmacy/distribution/orders/${id}/advance`, { status });

export const fetchDistributionPsWindow = (branchCode?: string) =>
  getJson<DistributionPsWindow>(
    branchCode
      ? `/v1/pharmacy/distribution/ps-window?${qs(branchCode)}`
      : "/v1/pharmacy/distribution/ps-window",
  );

export const fetchDistributionPsWidgets = (branchCode?: string) =>
  getJson<DistributionPsWidgets>(
    branchCode
      ? `/v1/pharmacy/distribution/ps-window/widgets?${qs(branchCode)}`
      : "/v1/pharmacy/distribution/ps-window/widgets",
  );

/** Shared query params for `/v1/pharmacy/distribution/dashboard/*`. */
export type DistributionDashboardParams = {
  branchCode?: string;
  warehouseId?: string;
  companyId?: string;
  salesmanId?: string;
  territoryId?: string;
  routeId?: string;
  from?: string;
  to?: string;
  preset?: string;
  limit?: number;
};

export type DistMetricComparison = {
  current: number;
  previous: number;
  pct: number | null;
};

export type DistDashboardSummary = {
  generatedAt: string;
  filters: {
    preset: string;
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    branchId: string | null;
    warehouseId: string | null;
    companyId: string | null;
    salesmanId: string | null;
    territoryId: string | null;
    routeId: string | null;
  };
  sales: {
    gross: DistMetricComparison;
    returns: DistMetricComparison;
    net: DistMetricComparison;
    cash: DistMetricComparison;
    credit: DistMetricComparison;
    discounts: DistMetricComparison;
    orders: DistMetricComparison;
    invoices: DistMetricComparison;
    aov: DistMetricComparison;
  };
  collections: {
    period: DistMetricComparison;
    month: number;
    outstanding: number;
    overdue: number;
    overdueCustomers: number;
    achievementPct: { current: number | null; previous: number | null; pct: number | null };
  };
  profitability:
    | {
        reliable: true;
        coveragePct: number;
        cogs: number;
        grossProfit: number;
        marginPct: number;
      }
    | {
        reliable: false;
        coveragePct: number;
        reason?: string;
      };
  inventory: {
    lowStockSkus: number;
    stockValuePkr: number;
    skuCount: number;
    expiredBatches: number;
    nearExpiry7: number;
    nearExpiry30: number;
  };
  operations: {
    pendingOrders: number;
    pendingApproval: number;
    pendingDeliveries: number;
    pendingPurchaseOrders: number;
  };
  field: {
    planned: number;
    completed: number;
    missed: number;
  };
};

export type DistDashboardSalesTrend = {
  generatedAt: string;
  preset: string;
  from: string;
  to: string;
  points: { date: string; sales: number; returns: number; netSales: number }[];
};

export type DistDashboardTopProducts = {
  generatedAt: string;
  reliable: boolean;
  items: {
    medicineId: string;
    name: string;
    sku: string | null;
    quantity: number;
    netSales: number;
    href: string;
    cogs?: number;
    profit?: number;
    marginPct?: number;
  }[];
};

export type DistDashboardTopCustomers = {
  generatedAt: string;
  items: {
    tradeCustomerId: string;
    name: string;
    code: string | null;
    sales: number;
    returns: number;
    net: number;
    collections: number;
    outstanding: number;
    overdue: boolean;
    href: string;
  }[];
};

export type DistDashboardCompanyPerformance = {
  generatedAt: string;
  items: {
    companyId: string;
    name: string;
    code: string | null;
    quantity: number;
    netSales: number;
    invoices: number;
    href: string;
  }[];
};

export type DistDashboardSalesmen = {
  generatedAt: string;
  items: {
    employeeId: string;
    name: string;
    sales: number;
    invoices: number;
    collections: number;
    target: number;
    achievementPct: number | null;
    achievementLabel: string;
  }[];
};

export type DistDashboardActionItem = {
  id: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  count: number;
  description: string;
  href: string;
};

export type DistDashboardActionCenter = {
  generatedAt: string;
  groups: {
    CRITICAL: DistDashboardActionItem[];
    WARNING: DistDashboardActionItem[];
    INFO: DistDashboardActionItem[];
  };
  items: DistDashboardActionItem[];
};

export type DistDashboardStockHealth = {
  generatedAt: string;
  skuCount: number;
  totalUnits: number;
  stockValuePkr: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  expiry: {
    expired: number;
    d0to7: number;
    d8to30: number;
    d31to60: number;
    d61to90: number;
    expiredValuePkr: number;
    nearExpiryValuePkr: number;
  };
};

export type DistDashboardRecovery = {
  generatedAt: string;
  aging: { bucket: string; amount: number; customers: number }[];
  collectionToday: number;
  collectionMonth: number;
  overdueAmount: number;
  overdueCustomers: number;
};

export type DistDashboardDeliveries = {
  generatedAt: string;
  total: number;
  collectedPkr: number;
  byStatus: { status: string; count: number; collectedPkr: number }[];
};

export type DistDashboardFieldForce = {
  generatedAt: string;
  summary: { planned: number; completed: number; missed: number };
  salesmen: {
    employeeId: string;
    name: string;
    planned: number;
    visited: number;
    missed: number;
    orders: number;
    sales: number;
    collection: number;
  }[];
};

function dashboardQs(params: DistributionDashboardParams): string {
  const q = new URLSearchParams();
  if (params.branchCode) q.set("branchCode", params.branchCode);
  if (params.warehouseId) q.set("warehouseId", params.warehouseId);
  if (params.companyId) q.set("companyId", params.companyId);
  if (params.salesmanId) q.set("salesmanId", params.salesmanId);
  if (params.territoryId) q.set("territoryId", params.territoryId);
  if (params.routeId) q.set("routeId", params.routeId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.preset) q.set("preset", params.preset);
  if (params.limit != null) q.set("limit", String(params.limit));
  return q.toString();
}

function dashboardPath(segment: string, params: DistributionDashboardParams): string {
  const q = dashboardQs(params);
  return q
    ? `/v1/pharmacy/distribution/dashboard/${segment}?${q}`
    : `/v1/pharmacy/distribution/dashboard/${segment}`;
}

export const fetchDashboardSummary = (params: DistributionDashboardParams) =>
  getJson<DistDashboardSummary>(dashboardPath("summary", params));

export const fetchDashboardSalesTrend = (params: DistributionDashboardParams) =>
  getJson<DistDashboardSalesTrend>(dashboardPath("sales-trend", params));

export const fetchDashboardTopProducts = (params: DistributionDashboardParams) =>
  getJson<DistDashboardTopProducts>(dashboardPath("top-products", params));

export const fetchDashboardTopCustomers = (params: DistributionDashboardParams) =>
  getJson<DistDashboardTopCustomers>(dashboardPath("top-customers", params));

export const fetchDashboardCompanyPerformance = (params: DistributionDashboardParams) =>
  getJson<DistDashboardCompanyPerformance>(dashboardPath("company-performance", params));

export const fetchDashboardSalesmen = (params: DistributionDashboardParams) =>
  getJson<DistDashboardSalesmen>(dashboardPath("salesmen", params));

export const fetchDashboardActionCenter = (params: DistributionDashboardParams) =>
  getJson<DistDashboardActionCenter>(dashboardPath("action-center", params));

export const fetchDashboardStockHealth = (params: DistributionDashboardParams) =>
  getJson<DistDashboardStockHealth>(dashboardPath("stock-health", params));

export const fetchDashboardRecovery = (params: DistributionDashboardParams) =>
  getJson<DistDashboardRecovery>(dashboardPath("recovery", params));

export const fetchDashboardDeliveries = (params: DistributionDashboardParams) =>
  getJson<DistDashboardDeliveries>(dashboardPath("deliveries", params));

export const fetchDashboardFieldForce = (params: DistributionDashboardParams) =>
  getJson<DistDashboardFieldForce>(dashboardPath("field-force", params));

export type DistributionPsAction = {
  id: string;
  severity: "danger" | "warning" | "info";
  label: string;
  count: number;
  href: string;
};

export type DistributionPsWindow = {
  generatedAt?: string;
  today?: {
    ordersToday: number;
    salesTodayPkr: number;
    netSalesTodayPkr: number;
    cashSalesTodayPkr: number;
    creditSalesTodayPkr: number;
    returnsTodayPkr: number;
    returnsTodayCount: number;
    collectionsTodayPkr: number;
    collectionsTodayCount: number;
    outstandingPkr: number;
    purchaseTodayPkr: number;
    grossProfitTodayPkr: number;
    lowStockSkus: number;
    nearExpiryBatches: number;
    expiredBatches: number;
    pendingDeliveries: number;
    pendingOrders: number;
    heldOrders: number;
    invoicesToday: number;
  };
  comparisons?: {
    salesYesterdayPkr: number;
    salesMonthPkr: number;
    salesLastMonthPkr: number;
  };
  sales: {
    ordersToday: number;
    salesTodayPkr: number;
    pendingApproval: number;
    inWarehousePipeline: number;
    heldOrders?: number;
    creditOverridesToday?: number;
  };
  stock: {
    nearExpiryBatches: number;
    nearExpiry7?: number;
    nearExpiry30?: number;
    expiredBatches?: number;
    nearExpiryValuePkr?: number;
    lowStockSkus?: number;
    stockValuePkr?: number;
  };
  distribution: {
    pendingDeliveries: number;
    outstandingPkr: number;
    overdueAccounts: number;
    creditExceeded?: number;
    pendingPurchaseOrders?: number;
  };
  field: {
    visitsToday: number;
    assignmentsOpen: number;
  };
  actions?: DistributionPsAction[];
};

export type DistributionPsWidgets = {
  generatedAt?: string;
  topMedicines: { medicineId: string; name: string; sku: string | null; qty: number; amountPkr: number }[];
  topCustomers: {
    tradeCustomerId: string;
    name: string;
    code: string | null;
    amountPkr: number;
    invoices: number;
  }[];
  topCompanies: { companyId: string; name: string; code: string | null; amountPkr: number }[];
  salesmanPerformance: { employeeId: string; name: string; amountPkr: number; orders: number }[];
  routePerformance: {
    routeId: string | null;
    name: string | null;
    code: string | null;
    deliveries: number;
    delivered: number;
    collectedPkr: number;
  }[];
  recoveryPerformance: { employeeId: string; name: string; amountPkr: number; receipts: number }[];
  aging: {
    currentPkr: number;
    d31to60Pkr: number;
    d61to90Pkr: number;
    d91to120Pkr: number;
    d120plusPkr: number;
  };
};

export const fetchDistributionReport = (
  reportId: string,
  params: {
    from?: string;
    to?: string;
    cityId?: string;
    areaId?: string;
    branchCode?: string;
    companyId?: string;
    salesmanIds?: string[];
  },
) => {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.cityId) q.set("cityId", params.cityId);
  if (params.areaId) q.set("areaId", params.areaId);
  if (params.branchCode) q.set("branchCode", params.branchCode);
  if (params.companyId) q.set("companyId", params.companyId);
  if (params.salesmanIds?.length) q.set("salesmanIds", params.salesmanIds.join(","));
  const suffix = q.toString() ? `?${q}` : "";
  return getJson<{ reportId: string; columns: string[]; rows: any[] }>(
    `/v1/pharmacy/distribution/reports/${reportId}${suffix}`,
  );
};
export const fetchPharmacyDeliveries = (branchCode: string) =>
  getJson<any[]>(`/v1/pharmacy/distribution/deliveries?${qs(branchCode)}`);
export const createPharmacyDelivery = (body: unknown) => postJson("/v1/pharmacy/distribution/deliveries", body);
export const updatePharmacyDelivery = (id: string, body: unknown) =>
  patchJson(`/v1/pharmacy/distribution/deliveries/${id}`, body);

export const fetchPharmacyCollections = (branchCode: string) =>
  getJson<any[]>(`/v1/pharmacy/distribution/collections?${qs(branchCode)}`);
export const createPharmacyCollection = (body: unknown) =>
  postJson("/v1/pharmacy/distribution/collections", body);

export const fetchPharmacyAssignments = (branchCode?: string) =>
  getJson<any[]>(
    branchCode
      ? `/v1/pharmacy/distribution/assignments?${qs(branchCode)}`
      : "/v1/pharmacy/distribution/assignments",
  );
export const createPharmacyAssignment = (body: unknown) =>
  postJson("/v1/pharmacy/distribution/assignments", body);

export const fetchPharmacyVisits = () => getJson<any[]>("/v1/pharmacy/distribution/visits");
export const createPharmacyVisit = (body: unknown) => postJson("/v1/pharmacy/distribution/visits", body);

export const fetchPharmacyTargets = () => getJson<any[]>("/v1/pharmacy/distribution/targets");
export const createPharmacyTarget = (body: unknown) => postJson("/v1/pharmacy/distribution/targets", body);

export const fetchPharmacyEmployeesPicker = () =>
  getJson<{ id: string; employeeCode: string; name: string }[]>("/v1/pharmacy/employees-picker");

export const fetchPharmacyTradeCustomerLedger = (id: string) => getJson<any>(`/v1/pharmacy/trade-customers/${id}/ledger`);

export const fetchPharmacyWholesaleReturns = (branchCode: string) =>
  getJson<any[]>(`/v1/pharmacy/distribution/wholesale-returns?${qs(branchCode)}`);
export const createPharmacyWholesaleReturn = (body: unknown) =>
  postJson("/v1/pharmacy/distribution/wholesale-returns", body);

export const fetchPharmacyPriceLists = () => getJson<any[]>("/v1/pharmacy/pricing/lists");
export const createPharmacyPriceList = (body: unknown) => postJson("/v1/pharmacy/pricing/lists", body);
export const fetchPharmacySchemes = () => getJson<any[]>("/v1/pharmacy/pricing/schemes");
export const createPharmacyScheme = (body: unknown) => postJson("/v1/pharmacy/pricing/schemes", body);
export const resolvePharmacyPrice = (params: Record<string, string>) => {
  const q = new URLSearchParams(params).toString();
  return getJson<{ unitPricePkr: number; source: string }>(`/v1/pharmacy/pricing/resolve?${q}`);
};

export type PharmacyLookupHit = {
  module: string;
  code: string;
  id: string;
  name: string;
  path: string;
  meta?: string;
};

export type PharmacyLookupResult = {
  query: string;
  count: number;
  exact: PharmacyLookupHit | null;
  results: PharmacyLookupHit[];
};

/** Global document / master code search (server-side). */
export function fetchPharmacyLookup(q: string, branchCode?: string) {
  const params = new URLSearchParams({ q: q.trim() });
  if (branchCode) params.set("branchCode", branchCode);
  return getJson<PharmacyLookupResult>(`/v1/pharmacy/lookup?${params}`);
}
