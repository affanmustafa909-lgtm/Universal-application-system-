import {
  fetchDistributionReport,
  fetchPharmacyCollections,
  fetchPharmacyCompanies,
  fetchPharmacyDeliveries,
  fetchPharmacyDistInvoices,
  fetchPharmacyDistOrders,
  fetchPharmacyGrns,
  fetchPharmacyPurchaseOrders,
  fetchPharmacySaleReturns,
  fetchPharmacyTradeCustomers,
  fetchPharmacyWholesaleReturns,
} from "../../pharmacy/api/pharmacy-erp";
import { listMedicinesPaged } from "../../pharmacy/api/pharmacy-masters";
import {
  getDataset,
  type CustomReportDataset,
  type CustomReportField,
} from "../spec/customReports";

export type CustomReportRunFilters = {
  from?: string;
  to?: string;
  cityId?: string;
  areaId?: string;
  branchCode?: string;
  q?: string;
  /** Scope report to one company (against this company). */
  companyId?: string;
  companyName?: string;
  /** One or more salesman / user ids. */
  salesmanIds?: string[];
  salesmanNames?: string[];
};

export type CustomReportRunResult = {
  columns: string[];
  columnLabels: Record<string, string>;
  rows: Record<string, unknown>[];
  fieldMeta: CustomReportField[];
};

function pick(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = row[k] ?? null;
  return out;
}

function asRows(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}));
}

function normalizeListRow(row: Record<string, unknown>): Record<string, unknown> {
  // Soft aliases so templates stay stable across API shapes / report vs list.
  return {
    ...row,
    customer:
      row.customer ?? row.customerName ?? row.tradeCustomerName ?? row.partyName ?? row.name ?? null,
    customerName:
      row.customerName ?? row.customer ?? row.tradeCustomerName ?? row.partyName ?? row.name ?? null,
    customerCode: row.customerCode ?? row.code ?? null,
    salesman: row.salesman ?? row.salesmanName ?? row.employeeName ?? row.employee ?? null,
    salesmanName: row.salesmanName ?? row.salesman ?? row.employeeName ?? row.employee ?? null,
    salesmanEmployeeId:
      row.salesmanEmployeeId ?? row.employeeId ?? row.salesmanId ?? null,
    warehouse: row.warehouse ?? row.warehouseName ?? null,
    warehouseName: row.warehouseName ?? row.warehouse ?? null,
    company: row.company ?? row.companyName ?? row.manufacturerName ?? row.manufacturer ?? null,
    companyName: row.companyName ?? row.company ?? row.manufacturerName ?? row.manufacturer ?? null,
    companyId: row.companyId ?? null,
    supplierName: row.supplierName ?? null,
    driverName: row.driverName ?? row.riderName ?? null,
    riderName: row.riderName ?? row.driverName ?? null,
    route: row.route ?? row.routeName ?? null,
    routeName: row.routeName ?? row.route ?? null,
    city: row.city ?? row.cityName ?? null,
    cityName: row.cityName ?? row.city ?? null,
    area: row.area ?? row.areaName ?? null,
    salesPkr: row.salesPkr ?? row.totalPkr ?? null,
  };
}

async function loadListRows(
  dataset: CustomReportDataset,
  filters: CustomReportRunFilters,
): Promise<Record<string, unknown>[]> {
  const branch = filters.branchCode || "";
  switch (dataset.listKind) {
    case "orders":
      return asRows(await fetchPharmacyDistOrders(branch)).map(normalizeListRow);
    case "invoices":
      return asRows(await fetchPharmacyDistInvoices(branch)).map(normalizeListRow);
    case "customers":
      return asRows(await fetchPharmacyTradeCustomers(branch || undefined)).map(normalizeListRow);
    case "companies":
      return asRows(await fetchPharmacyCompanies()).map(normalizeListRow);
    case "medicines": {
      const page = await listMedicinesPaged({
        branchCode: branch || "MAIN",
        page: 1,
        pageSize: 500,
        q: filters.q,
      });
      return asRows(page.items).map(normalizeListRow);
    }
    case "collections":
      return asRows(await fetchPharmacyCollections(branch)).map(normalizeListRow);
    case "deliveries":
      return asRows(await fetchPharmacyDeliveries(branch)).map(normalizeListRow);
    case "purchase-orders":
      return asRows(await fetchPharmacyPurchaseOrders(branch)).map(normalizeListRow);
    case "grns":
      return asRows(await fetchPharmacyGrns(branch)).map(normalizeListRow);
    case "sale-returns":
      return asRows(await fetchPharmacySaleReturns(branch)).map(normalizeListRow);
    case "wholesale-returns":
      return asRows(await fetchPharmacyWholesaleReturns(branch)).map(normalizeListRow);
    default:
      return [];
  }
}

function rowHasCompanyField(r: Record<string, unknown>): boolean {
  return r.company != null || r.companyName != null || r.companyId != null;
}

function rowHasSalesmanField(r: Record<string, unknown>): boolean {
  return (
    r.salesman != null ||
    r.salesmanName != null ||
    r.salesmanEmployeeId != null ||
    r.employeeId != null ||
    r.employee != null
  );
}

function filterRows(
  rows: Record<string, unknown>[],
  filters: CustomReportRunFilters,
): Record<string, unknown>[] {
  let list = rows;
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }
  // Soft date filter on common date fields when from/to provided
  if (filters.from || filters.to) {
    const fromMs = filters.from ? Date.parse(filters.from) : null;
    const toMs = filters.to ? Date.parse(filters.to) + 86_400_000 - 1 : null;
    list = list.filter((r) => {
      const raw =
        r.date ??
        r.invoiceDate ??
        r.orderDate ??
        r.bookedAt ??
        r.collectedAt ??
        r.receivedDate ??
        r.createdAt ??
        r.expiryDate;
      if (raw == null) return true;
      const ms = Date.parse(String(raw));
      if (!Number.isFinite(ms)) return true;
      if (fromMs != null && ms < fromMs) return false;
      if (toMs != null && ms > toMs) return false;
      return true;
    });
  }

  if (filters.companyId || filters.companyName) {
    const wantId = filters.companyId ?? "";
    const wantName = (filters.companyName ?? "").toLowerCase();
    list = list.filter((r) => {
      if (!rowHasCompanyField(r)) return true;
      const id = String(r.companyId ?? "");
      const name = String(r.company ?? r.companyName ?? "").toLowerCase();
      if (wantId && id === wantId) return true;
      if (wantName && (name === wantName || name.includes(wantName))) return true;
      return false;
    });
  }

  if (filters.salesmanIds?.length || filters.salesmanNames?.length) {
    const idSet = new Set((filters.salesmanIds ?? []).map(String));
    const nameSet = new Set((filters.salesmanNames ?? []).map((n) => n.toLowerCase().trim()).filter(Boolean));
    list = list.filter((r) => {
      const id = String(r.salesmanEmployeeId ?? r.employeeId ?? r.salesmanId ?? "");
      const name = String(r.salesman ?? r.salesmanName ?? r.employee ?? "").toLowerCase().trim();
      if (id && idSet.has(id)) return true;
      if (name && (nameSet.has(name) || [...nameSet].some((n) => name.includes(n) || n.includes(name)))) {
        return true;
      }
      // If row has no salesman info at all, drop it when filter is active
      // (otherwise employee select appears to do nothing).
      if (!rowHasSalesmanField(r)) return false;
      return false;
    });
  }

  return list;
}

/** Run a user-built report: fetch source data, keep only selected columns. */
export async function runCustomReport(opts: {
  datasetId: string;
  columns: string[];
  filters: CustomReportRunFilters;
}): Promise<CustomReportRunResult> {
  const dataset = getDataset(opts.datasetId);
  if (!dataset) throw new Error("Unknown dataset");

  const allowed = new Set(dataset.fields.map((f) => f.key));
  const columns = (opts.columns.length ? opts.columns : dataset.fields.map((f) => f.key)).filter(
    (c) => allowed.has(c),
  );
  if (!columns.length) throw new Error("Select at least one column");

  let rows: Record<string, unknown>[] = [];

  if (dataset.reportId) {
    const res = await fetchDistributionReport(dataset.reportId, {
      from: opts.filters.from,
      to: opts.filters.to,
      cityId: opts.filters.cityId,
      areaId: opts.filters.areaId,
      branchCode: opts.filters.branchCode,
      companyId: opts.filters.companyId,
      salesmanIds: opts.filters.salesmanIds,
    });
    rows = asRows(res.rows).map(normalizeListRow);
  } else if (dataset.listKind) {
    rows = await loadListRows(dataset, opts.filters);
  }

  rows = filterRows(rows, opts.filters).map((r) => pick(r, columns));

  const columnLabels: Record<string, string> = {};
  for (const field of dataset.fields) {
    if (columns.includes(field.key)) columnLabels[field.key] = field.label;
  }

  return {
    columns,
    columnLabels,
    rows,
    fieldMeta: dataset.fields.filter((f) => columns.includes(f.key)),
  };
}
