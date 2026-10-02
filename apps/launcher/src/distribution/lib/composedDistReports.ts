import { deliveryApi, type DeliveryLine, type DeliveryOrder } from "../../pharmacy/api/pharmacy-delivery";
import {
  fetchDistributionReport,
  fetchPharmacyAreas,
  fetchPharmacyCities,
  fetchPharmacyCollections,
  fetchPharmacyEmployeesPicker,
  fetchPharmacyTradeCustomers,
} from "../../pharmacy/api/pharmacy-erp";

export type CatalogReportParams = {
  from?: string;
  to?: string;
  cityId?: string;
  areaId?: string;
  branchCode?: string;
  companyId?: string;
  salesmanIds?: string[];
};

export type CatalogReportResult = {
  reportId: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

const COMPOSED = new Set(["delivery-plan", "delivery-plan-details", "customer-credit"]);

function inDateRange(raw: unknown, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (raw == null || raw === "") return true;
  const day = String(raw).slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index]!);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

async function loadDeliveries(branchCode: string, from?: string, to?: string): Promise<DeliveryOrder[]> {
  const pageSize = 100;
  const items: DeliveryOrder[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const res = await deliveryApi.listOrders({ branchCode, page, pageSize });
    items.push(...res.items);
    if (page >= res.totalPages) break;
  }
  return items.filter((row) => inDateRange(row.createdAt, from, to));
}

function planHeader(row: DeliveryOrder, lines: DeliveryLine[]) {
  const qty = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
  const deliveredQty = lines.reduce((sum, line) => sum + Number(line.deliveredQty ?? 0), 0);
  const returnedQty = lines.reduce((sum, line) => sum + Number(line.returnedQty ?? 0), 0);
  return {
    date: row.createdAt ? String(row.createdAt).slice(0, 10) : "—",
    deliveryNumber: row.deliveryNumber,
    status: row.status,
    customerCode: row.tradeCustomerCode ?? "—",
    customerName: row.tradeCustomerName ?? "—",
    route: row.routeName ? `${row.routeCode ?? ""} ${row.routeName}`.trim() : "—",
    rider: row.driverName ?? row.riderName ?? "—",
    vehicle: row.vehicleLabel ?? "—",
    orderNumber: row.orderNumber ?? "—",
    invoiceNumber: row.invoiceNumber ?? "—",
    phone: row.contactPhone ?? "—",
    address: row.address ?? "—",
    lines: lines.length,
    qty,
    deliveredQty,
    returnedQty,
    collectedPkr: row.collectedPkr ?? 0,
  };
}

async function deliveryPlan(params: CatalogReportParams, withLines: boolean): Promise<CatalogReportResult> {
  if (!params.branchCode) throw new Error("Select a branch to run the delivery plan report.");
  const headers = await loadDeliveries(params.branchCode, params.from, params.to);
  const detailed = await mapPool(headers, 6, async (row) => {
    if (row.lines?.length) return row;
    try {
      return await deliveryApi.getOrder(row.id);
    } catch {
      return row;
    }
  });

  if (!withLines) {
    return {
      reportId: "delivery-plan",
      columns: [
        "date",
        "deliveryNumber",
        "status",
        "customerCode",
        "customerName",
        "route",
        "rider",
        "vehicle",
        "orderNumber",
        "invoiceNumber",
        "phone",
        "address",
        "lines",
        "qty",
        "deliveredQty",
        "returnedQty",
        "collectedPkr",
      ],
      rows: detailed.map((row) => planHeader(row, row.lines ?? [])),
    };
  }

  const rows: Record<string, unknown>[] = [];
  for (const row of detailed) {
    const lines = row.lines ?? [];
    const header = planHeader(row, lines);
    if (lines.length === 0) {
      rows.push({
        ...header,
        sku: "—",
        product: "—",
        batch: "—",
        qty: 0,
        deliveredQty: 0,
        returnedQty: 0,
      });
      continue;
    }
    for (const line of lines) {
      rows.push({
        date: header.date,
        deliveryNumber: header.deliveryNumber,
        status: header.status,
        customerCode: header.customerCode,
        customerName: header.customerName,
        route: header.route,
        rider: header.rider,
        vehicle: header.vehicle,
        orderNumber: header.orderNumber,
        sku: line.medicineSku ?? "—",
        product: line.medicineName ?? line.productLabel ?? "—",
        batch: line.batchNumber ?? "—",
        qty: line.quantity ?? 0,
        deliveredQty: line.deliveredQty ?? 0,
        returnedQty: line.returnedQty ?? 0,
      });
    }
  }

  return {
    reportId: "delivery-plan-details",
    columns: [
      "date",
      "deliveryNumber",
      "status",
      "customerCode",
      "customerName",
      "route",
      "rider",
      "vehicle",
      "orderNumber",
      "sku",
      "product",
      "batch",
      "qty",
      "deliveredQty",
      "returnedQty",
    ],
    rows,
  };
}

async function customerCredit(params: CatalogReportParams): Promise<CatalogReportResult> {
  const [customers, areas, cities, employees, collections] = await Promise.all([
    fetchPharmacyTradeCustomers(params.branchCode),
    fetchPharmacyAreas(),
    fetchPharmacyCities(),
    fetchPharmacyEmployeesPicker().catch(() => []),
    params.branchCode
      ? fetchPharmacyCollections(params.branchCode).catch(() => [])
      : Promise.resolve([]),
  ]);
  const receivedByCustomer = new Map<string, number>();
  for (const raw of Array.isArray(collections) ? collections : []) {
    const row = raw as Record<string, unknown>;
    const when = String(row.collectedAt ?? row.createdAt ?? "");
    if (params.from && when && when.slice(0, 10) < params.from) continue;
    if (params.to && when && when.slice(0, 10) > params.to) continue;
    const id = String(row.tradeCustomerId ?? row.customerId ?? "");
    if (!id) continue;
    receivedByCustomer.set(id, (receivedByCustomer.get(id) ?? 0) + Number(row.amountPkr ?? 0));
  }
  const areaList = Array.isArray(areas) ? areas : [];
  const cityList = Array.isArray(cities) ? cities : [];
  const areaById = new Map(
    areaList.map((area) => [String(area.id), area as { id: string; name?: string; cityId?: string }]),
  );
  const cityById = new Map(cityList.map((city) => [String(city.id), city as { id: string; name?: string }]));
  const empName = new Map(employees.map((emp) => [emp.id, emp.name]));
  const salesmanIds = new Set(params.salesmanIds ?? []);

  const rows = customers
    .filter((raw) => {
      const c = raw as Record<string, unknown>;
      if (params.areaId && String(c.areaId ?? "") !== params.areaId) return false;
      if (params.cityId) {
        const area = c.areaId ? areaById.get(String(c.areaId)) : undefined;
        const cityId = String(c.cityId ?? area?.cityId ?? "");
        if (cityId !== params.cityId) return false;
      }
      if (salesmanIds.size > 0 && !salesmanIds.has(String(c.salesmanEmployeeId ?? ""))) return false;
      return true;
    })
    .map((raw) => {
      const c = raw as Record<string, unknown>;
      const limit = Number(c.creditLimitPkr ?? 0);
      const outstanding = Number(c.outstandingPkr ?? 0);
      const received = receivedByCustomer.get(String(c.id ?? "")) ?? 0;
      const area = c.areaId ? areaById.get(String(c.areaId)) : undefined;
      const cityId = String(c.cityId ?? area?.cityId ?? "");
      const salesmanId = c.salesmanEmployeeId ? String(c.salesmanEmployeeId) : "";
      return {
        code: c.code ?? "—",
        name: c.name ?? "—",
        businessName: c.businessName ?? "—",
        phone: c.phone ?? "—",
        city: c.cityName ?? (cityId ? cityById.get(cityId)?.name ?? "—" : "—"),
        area: area?.name ?? "—",
        salesman: salesmanId ? empName.get(salesmanId) ?? "—" : "—",
        creditCategory: c.creditCategory ?? "—",
        creditLimitPkr: limit,
        creditDays: Number(c.creditDays ?? 0),
        receivedPkr: received,
        leftToReceivePkr: outstanding,
        outstandingPkr: outstanding,
        availableCreditPkr: limit - outstanding,
        overByPkr: outstanding > limit ? outstanding - limit : 0,
        openingBalancePkr: Number(c.openingBalancePkr ?? 0),
        termsOfPayment: c.termsOfPayment ?? "—",
        modeOfPayment: c.modeOfPayment ?? "—",
        monthlySalesTargetPkr: Number(c.monthlySalesTargetPkr ?? 0),
        discountPct: Number(c.discountPct ?? 0),
        priceLevel: c.priceLevel ?? "—",
        status: c.status ?? "—",
        companyCredit: c.companyCreditLimitsJson ?? "—",
      };
    })
    .sort((a, b) => b.outstandingPkr - a.outstandingPkr);

  return {
    reportId: "customer-credit",
    columns: [
      "code",
      "name",
      "businessName",
      "phone",
      "city",
      "area",
      "salesman",
      "creditCategory",
      "creditLimitPkr",
      "creditDays",
      "receivedPkr",
      "leftToReceivePkr",
      "outstandingPkr",
      "availableCreditPkr",
      "overByPkr",
      "openingBalancePkr",
      "termsOfPayment",
      "modeOfPayment",
      "monthlySalesTargetPkr",
      "discountPct",
      "priceLevel",
      "status",
      "companyCredit",
    ],
    rows,
  };
}

async function buildComposed(reportId: string, params: CatalogReportParams): Promise<CatalogReportResult> {
  if (reportId === "delivery-plan") return deliveryPlan(params, false);
  if (reportId === "delivery-plan-details") return deliveryPlan(params, true);
  if (reportId === "customer-credit") return customerCredit(params);
  throw new Error(`Report not available: ${reportId}`);
}

/** Catalog query. New reports still run if the hosted API has not been updated yet. */
export async function runCatalogReport(
  reportId: string,
  params: CatalogReportParams,
): Promise<CatalogReportResult> {
  if (!COMPOSED.has(reportId)) return fetchDistributionReport(reportId, params);
  try {
    const remote = await fetchDistributionReport(reportId, params);
    if (reportId === "customer-credit" && !remote.columns.includes("receivedPkr")) {
      return buildComposed(reportId, params);
    }
    return remote;
  } catch {
    // Hosted API does not have these report ids yet, and some 404 responses
    // cannot be re-read. Build the same columns from the live list APIs.
    return buildComposed(reportId, params);
  }
}
