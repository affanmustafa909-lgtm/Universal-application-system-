/** User-built Dist reports — pick any dataset + any columns. */

export type CustomReportField = {
  key: string;
  label: string;
  /** Used for number formatting in the grid */
  numeric?: boolean;
};

export type CustomReportDataset = {
  id: string;
  label: string;
  category: string;
  description: string;
  fields: CustomReportField[];
  /**
   * Prefer live catalog report query (returns columns/rows).
   * When set, runner uses fetchDistributionReport(reportId).
   */
  reportId?: string;
  /**
   * Else fetch a Dist list register and map rows to fields.
   */
  listKind?:
    | "orders"
    | "invoices"
    | "customers"
    | "companies"
    | "medicines"
    | "collections"
    | "deliveries"
    | "purchase-orders"
    | "grns"
    | "sale-returns"
    | "wholesale-returns";
};

const f = (key: string, label: string, numeric = false): CustomReportField => ({
  key,
  label,
  numeric,
});

export const CUSTOM_REPORT_DATASETS: CustomReportDataset[] = [
  // ── Sales ────────────────────────────────────────────────────────────────
  {
    id: "sales-report",
    label: "Sales report (full)",
    category: "Sales",
    description: "Complete sales lines — date, customer, salesman, company, product, qty, value",
    reportId: "sales-report",
    fields: [
      f("date", "Date"),
      f("orderNumber", "Order #"),
      f("customerCode", "Cust code"),
      f("customerName", "Customer"),
      f("salesman", "Salesman"),
      f("company", "Company"),
      f("sku", "SKU"),
      f("product", "Product"),
      f("qty", "Qty", true),
      f("freeQty", "Bonus", true),
      f("salesPkr", "Sales PKR", true),
      f("status", "Status"),
    ],
  },
  {
    id: "sales-daily",
    label: "Daily sales (orders)",
    category: "Sales",
    description: "Order-level sales list by date",
    reportId: "daily-sales",
    fields: [
      f("orderNumber", "Order #"),
      f("status", "Status"),
      f("totalPkr", "Total PKR", true),
      f("salesman", "Salesman"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "sales-sku",
    label: "SKU / product sales",
    category: "Sales",
    description: "Qty and value by SKU",
    reportId: "sku-sales",
    fields: [
      f("sku", "SKU"),
      f("name", "Product"),
      f("qty", "Qty", true),
      f("freeQty", "Bonus", true),
      f("salesPkr", "Sales PKR", true),
    ],
  },
  {
    id: "sales-customer",
    label: "Customer-wise sales",
    category: "Sales",
    description: "Orders and sales by trade customer",
    reportId: "customer-sales",
    fields: [
      f("code", "Code"),
      f("name", "Customer"),
      f("area", "Area"),
      f("orders", "Orders", true),
      f("salesPkr", "Sales PKR", true),
      f("outstandingPkr", "Outstanding", true),
    ],
  },
  {
    id: "sales-salesman",
    label: "Salesman-wise sales",
    category: "Sales",
    description: "Orders and sales by salesman",
    reportId: "salesman-sales",
    fields: [
      f("salesman", "Salesman"),
      f("orders", "Orders", true),
      f("salesPkr", "Sales PKR", true),
    ],
  },
  {
    id: "sales-city",
    label: "City-wise sales",
    category: "Sales",
    description: "Sales rolled up by city",
    reportId: "city-sales",
    fields: [
      f("city", "City"),
      f("orders", "Orders", true),
      f("salesPkr", "Sales PKR", true),
    ],
  },
  {
    id: "sales-area",
    label: "Area-wise sales",
    category: "Sales",
    description: "Sales rolled up by area",
    reportId: "area-sales",
    fields: [
      f("area", "Area"),
      f("orders", "Orders", true),
      f("salesPkr", "Sales PKR", true),
    ],
  },
  {
    id: "sales-status",
    label: "Order status pipeline",
    category: "Sales",
    description: "Count of orders by status",
    reportId: "status-pipeline",
    fields: [
      f("status", "Status"),
      f("count", "Count", true),
      f("totalPkr", "Total PKR", true),
    ],
  },
  {
    id: "sales-scheme",
    label: "Scheme utilization",
    category: "Sales",
    description: "Schemes vs free qty given on orders",
    reportId: "scheme-utilization",
    fields: [
      f("scheme", "Scheme"),
      f("medicine", "Medicine"),
      f("buyQty", "Buy qty", true),
      f("freeQty", "Free qty", true),
      f("soldQty", "Sold qty", true),
      f("freeGiven", "Free given", true),
      f("status", "Status"),
    ],
  },

  // ── Company ──────────────────────────────────────────────────────────────
  {
    id: "company-performance",
    label: "Company-wise sales",
    category: "Company",
    description: "Sales qty and value by company",
    reportId: "company-performance",
    fields: [
      f("company", "Company"),
      f("qty", "Qty", true),
      f("salesPkr", "Sales PKR", true),
    ],
  },
  {
    id: "company-sku",
    label: "Company × SKU sales",
    category: "Company",
    description: "SKU breakdown under each company",
    reportId: "company-sku-sales",
    fields: [
      f("company", "Company"),
      f("sku", "SKU"),
      f("name", "Product"),
      f("qty", "Qty", true),
      f("freeQty", "Bonus", true),
      f("salesPkr", "Sales PKR", true),
    ],
  },
  {
    id: "company-stock",
    label: "Company-wise stock",
    category: "Company",
    description: "SKU count and stock qty by company",
    reportId: "company-stock",
    fields: [
      f("company", "Company"),
      f("skus", "SKUs", true),
      f("stockQty", "Stock qty", true),
    ],
  },
  {
    id: "company-net",
    label: "Company net sales",
    category: "Company",
    description: "Sales minus wholesale returns by company",
    reportId: "company-net-sales",
    fields: [
      f("company", "Company"),
      f("salesPkr", "Sales PKR", true),
      f("returnsPkr", "Returns PKR", true),
      f("netPkr", "Net PKR", true),
    ],
  },

  // ── Recovery / Customer ──────────────────────────────────────────────────
  {
    id: "recovery-aging",
    label: "Outstanding / aging",
    category: "Recovery",
    description: "Trade customers with balance due",
    reportId: "outstanding-aging",
    fields: [
      f("code", "Code"),
      f("name", "Customer"),
      f("outstandingPkr", "Outstanding", true),
      f("creditLimitPkr", "Credit limit", true),
    ],
  },
  {
    id: "recovery-ledger",
    label: "Customer ledger summary",
    category: "Recovery",
    description: "Outstanding and credit by customer",
    reportId: "customer-ledger",
    fields: [
      f("code", "Code"),
      f("name", "Customer"),
      f("area", "Area"),
      f("phone", "Phone"),
      f("outstandingPkr", "Outstanding", true),
      f("creditLimitPkr", "Credit limit", true),
    ],
  },
  {
    id: "recovery-credit",
    label: "Credit limit alerts",
    category: "Recovery",
    description: "Customers over credit limit",
    reportId: "credit-limit-breach",
    fields: [
      f("code", "Code"),
      f("name", "Customer"),
      f("outstandingPkr", "Outstanding", true),
      f("creditLimitPkr", "Credit limit", true),
      f("overByPkr", "Over by", true),
    ],
  },
  {
    id: "recovery-collections",
    label: "Collections list",
    category: "Recovery",
    description: "Collection receipts in range",
    reportId: "collections-summary",
    fields: [
      f("collectionNumber", "Receipt #"),
      f("amountPkr", "Amount PKR", true),
      f("paymentMethod", "Method"),
      f("createdAt", "Collected at"),
    ],
  },

  // ── Stock ────────────────────────────────────────────────────────────────
  {
    id: "stock-expiry",
    label: "Stock near expiry",
    category: "Stock",
    description: "Batches expiring within 90 days",
    reportId: "stock-near-expiry",
    fields: [
      f("medicineName", "Product"),
      f("batchNumber", "Batch"),
      f("expiryDate", "Expiry"),
      f("quantity", "Qty", true),
    ],
  },
  {
    id: "stock-warehouse",
    label: "Warehouse stock",
    category: "Stock",
    description: "SKU count and qty by warehouse",
    reportId: "stock-by-warehouse",
    fields: [
      f("warehouse", "Warehouse"),
      f("skus", "SKUs", true),
      f("qty", "Qty", true),
    ],
  },
  {
    id: "stock-slow",
    label: "Slow moving stock",
    category: "Stock",
    description: "Stock with low sales movement",
    reportId: "slow-moving",
    fields: [
      f("sku", "SKU"),
      f("name", "Product"),
      f("stock", "Stock", true),
      f("soldQty", "Sold qty", true),
    ],
  },
  {
    id: "stock-batch",
    label: "Batch trace",
    category: "Stock",
    description: "Batch, expiry, qty and reserve",
    reportId: "batch-trace",
    fields: [
      f("sku", "SKU"),
      f("medicineName", "Product"),
      f("batchNumber", "Batch"),
      f("expiryDate", "Expiry"),
      f("quantity", "Qty", true),
      f("reservedQuantity", "Reserved", true),
      f("status", "Status"),
    ],
  },

  // ── Distribution ─────────────────────────────────────────────────────────
  {
    id: "dist-deliveries-pending",
    label: "Pending deliveries",
    category: "Distribution",
    description: "Open delivery tickets",
    reportId: "pending-deliveries",
    fields: [
      f("deliveryNumber", "Delivery #"),
      f("status", "Status"),
      f("riderName", "Rider"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "dist-delivery-status",
    label: "Delivery status wise",
    category: "Distribution",
    description: "Deliveries grouped by status",
    reportId: "delivery-status",
    fields: [f("status", "Status"), f("count", "Count", true)],
  },
  {
    id: "dist-pod",
    label: "POD exceptions",
    category: "Distribution",
    description: "Failed / exception deliveries",
    reportId: "pod-exceptions",
    fields: [
      f("deliveryNumber", "Delivery #"),
      f("status", "Status"),
      f("failedReason", "Failed reason"),
      f("podNotes", "POD notes"),
      f("riderName", "Rider"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "dist-route",
    label: "Route load",
    category: "Distribution",
    description: "Deliveries pending vs delivered by route",
    reportId: "route-load",
    fields: [
      f("route", "Route"),
      f("total", "Total", true),
      f("pending", "Pending", true),
      f("delivered", "Delivered", true),
    ],
  },

  // ── Field ────────────────────────────────────────────────────────────────
  {
    id: "field-visits",
    label: "Visit coverage",
    category: "Field",
    description: "Field visits in range",
    reportId: "visit-coverage",
    fields: [
      f("employeeId", "Employee"),
      f("tradeCustomerId", "Customer"),
      f("status", "Status"),
      f("productive", "Productive"),
      f("visitedAt", "Visited at"),
    ],
  },
  {
    id: "field-targets",
    label: "Target vs achievement",
    category: "Field",
    description: "Sales targets vs actual",
    reportId: "target-vs-achievement",
    fields: [
      f("employeeId", "Employee"),
      f("period", "Period"),
      f("targetPkr", "Target PKR", true),
      f("achievedPkr", "Achieved PKR", true),
      f("pct", "%", true),
    ],
  },
  {
    id: "field-pjp",
    label: "PJP adherence",
    category: "Field",
    description: "Visits vs planned PJP day",
    reportId: "pjp-adherence",
    fields: [
      f("route", "Route"),
      f("pjpDay", "PJP day"),
      f("plannedCustomers", "Planned", true),
      f("visitsOnPjpDay", "Visits", true),
      f("adherencePct", "Adherence %", true),
    ],
  },
  {
    id: "field-unvisited",
    label: "Unvisited customers",
    category: "Field",
    description: "No visit in last 14 days",
    reportId: "unvisited-customers",
    fields: [
      f("code", "Code"),
      f("name", "Customer"),
      f("area", "Area"),
      f("lastVisit", "Last visit"),
      f("outstandingPkr", "Outstanding", true),
    ],
  },

  // ── Geography ────────────────────────────────────────────────────────────
  {
    id: "geo-district",
    label: "District coverage",
    category: "Geography",
    description: "Customers, orders, sales by district",
    reportId: "district-coverage",
    fields: [
      f("district", "District"),
      f("customers", "Customers", true),
      f("orders", "Orders", true),
      f("salesPkr", "Sales PKR", true),
    ],
  },
  {
    id: "geo-province",
    label: "Province-wise sales",
    category: "Geography",
    description: "Sales rolled up by province",
    reportId: "province-sales",
    fields: [
      f("province", "Province"),
      f("orders", "Orders", true),
      f("salesPkr", "Sales PKR", true),
    ],
  },

  // ── Purchase ─────────────────────────────────────────────────────────────
  {
    id: "purchase-vs-sales",
    label: "Purchase vs sales",
    category: "Purchase",
    description: "PO totals vs distribution sales",
    reportId: "purchase-vs-sales",
    fields: [f("metric", "Metric"), f("amountPkr", "Amount PKR", true)],
  },
  {
    id: "purchase-grn-pending",
    label: "Pending GRN",
    category: "Purchase",
    description: "POs without GRN received",
    reportId: "grn-pending",
    fields: [
      f("poNumber", "PO #"),
      f("status", "Status"),
      f("totalPkr", "Total", true),
      f("orderDate", "Order date"),
      f("expectedDate", "Expected"),
      f("hasGrn", "Has GRN"),
    ],
  },
  {
    id: "register-po",
    label: "PO — Purchase orders",
    category: "Purchase",
    description: "Purchase order register — pick any columns",
    listKind: "purchase-orders",
    fields: [
      f("poNumber", "PO #"),
      f("status", "Status"),
      f("supplierName", "Supplier"),
      f("orderDate", "Order date"),
      f("expectedDate", "Expected"),
      f("totalPkr", "Total", true),
      f("paymentTerms", "Terms"),
    ],
  },
  {
    id: "register-grn",
    label: "GRN — Goods receipts",
    category: "Purchase",
    description: "GRN register — pick any columns",
    listKind: "grns",
    fields: [
      f("grnNumber", "GRN #"),
      f("status", "Status"),
      f("supplierName", "Supplier"),
      f("poNumber", "PO"),
      f("receivedDate", "Received"),
      f("totalPkr", "Total", true),
    ],
  },

  // ── Registers (live report APIs) ─────────────────────────────────────────
  {
    id: "reg-do",
    label: "DO — Dist orders (report)",
    category: "Registers",
    description: "Distribution order register from report API",
    reportId: "do-register",
    fields: [
      f("orderNumber", "Order #"),
      f("customer", "Customer"),
      f("totalPkr", "Total", true),
      f("status", "Status"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "reg-winv",
    label: "WINV — Invoices (report)",
    category: "Registers",
    description: "Wholesale invoice register from report API",
    reportId: "winv-register",
    fields: [
      f("invoiceNumber", "Invoice #"),
      f("customer", "Customer"),
      f("invoiceDate", "Date"),
      f("totalPkr", "Total", true),
      f("amountPaidPkr", "Paid", true),
      f("amountDuePkr", "Due", true),
      f("paymentMethod", "Payment"),
      f("status", "Status"),
    ],
  },
  {
    id: "reg-dlv",
    label: "DLV — Deliveries (report)",
    category: "Registers",
    description: "Delivery register from report API",
    reportId: "dlv-register",
    fields: [
      f("deliveryNumber", "Delivery #"),
      f("status", "Status"),
      f("riderName", "Rider"),
      f("collectedPkr", "Collected", true),
      f("deliveredAt", "Delivered"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "reg-col",
    label: "COL — Collections (report)",
    category: "Registers",
    description: "Collection register from report API",
    reportId: "col-register",
    fields: [
      f("collectionNumber", "Receipt #"),
      f("customer", "Customer"),
      f("amountPkr", "Amount", true),
      f("paymentMethod", "Method"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "reg-srn",
    label: "SRN — Sale returns (report)",
    category: "Registers",
    description: "Sale return register from report API",
    reportId: "srn-register",
    fields: [
      f("returnNumber", "SRN #"),
      f("totalPkr", "Total", true),
      f("refundMethod", "Refund"),
      f("reason", "Reason"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "reg-wrn",
    label: "WRN — Wholesale returns (report)",
    category: "Registers",
    description: "Wholesale return register from report API",
    reportId: "wrn-register",
    fields: [
      f("returnNumber", "WRN #"),
      f("customer", "Customer"),
      f("totalPkr", "Total", true),
      f("status", "Status"),
      f("reason", "Reason"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "reg-asn",
    label: "ASN — Assignments",
    category: "Registers",
    description: "Field assignment register",
    reportId: "asn-register",
    fields: [
      f("assignmentDate", "Date"),
      f("employee", "Employee"),
      f("taskType", "Task"),
      f("status", "Status"),
      f("targetSalesPkr", "Target sales", true),
      f("targetCollectionPkr", "Target collection", true),
    ],
  },

  // ── Rich registers (list APIs — more columns) ────────────────────────────
  {
    id: "register-orders",
    label: "DO — Dist orders (full)",
    category: "Registers",
    description: "Full distribution order register — pick any columns",
    listKind: "orders",
    fields: [
      f("orderNumber", "Order #"),
      f("status", "Status"),
      f("customerName", "Customer"),
      f("customerCode", "Customer code"),
      f("paymentMethod", "Payment"),
      f("salesmanName", "Salesman"),
      f("warehouseName", "Warehouse"),
      f("subtotalPkr", "Subtotal", true),
      f("discountPkr", "Discount", true),
      f("taxPkr", "Tax", true),
      f("totalPkr", "Total", true),
      f("bookedAt", "Booked at"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "register-invoices",
    label: "WINV — Wholesale invoices (full)",
    category: "Registers",
    description: "Invoice register — pick any columns",
    listKind: "invoices",
    fields: [
      f("invoiceNumber", "Invoice #"),
      f("invoiceDate", "Date"),
      f("status", "Status"),
      f("customerName", "Customer"),
      f("paymentMethod", "Payment"),
      f("subtotalPkr", "Subtotal", true),
      f("discountPkr", "Discount", true),
      f("taxPkr", "Tax", true),
      f("totalPkr", "Total", true),
      f("amountPaidPkr", "Paid", true),
      f("amountDuePkr", "Due", true),
    ],
  },
  {
    id: "register-collections",
    label: "COL — Collections (full)",
    category: "Registers",
    description: "Collection receipts — pick any columns",
    listKind: "collections",
    fields: [
      f("collectionNumber", "Receipt #"),
      f("customerName", "Customer"),
      f("amountPkr", "Amount", true),
      f("paymentMethod", "Method"),
      f("invoiceNumber", "Invoice"),
      f("referenceNo", "Reference"),
      f("collectedAt", "Collected at"),
      f("notes", "Notes"),
    ],
  },
  {
    id: "register-deliveries",
    label: "DLV — Deliveries (full)",
    category: "Registers",
    description: "Delivery tickets — pick any columns",
    listKind: "deliveries",
    fields: [
      f("deliveryNumber", "Delivery #"),
      f("status", "Status"),
      f("customerName", "Customer"),
      f("orderNumber", "Order"),
      f("invoiceNumber", "Invoice"),
      f("driverName", "Rider"),
      f("routeName", "Route"),
      f("vehicleLabel", "Vehicle"),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "register-srn",
    label: "SRN — Sale returns (full)",
    category: "Registers",
    description: "Sale return register — pick any columns",
    listKind: "sale-returns",
    fields: [
      f("returnNumber", "SRN #"),
      f("status", "Status"),
      f("customerName", "Customer"),
      f("totalPkr", "Total", true),
      f("createdAt", "Created"),
    ],
  },
  {
    id: "register-wrn",
    label: "WRN — Wholesale returns (full)",
    category: "Registers",
    description: "Wholesale return register — pick any columns",
    listKind: "wholesale-returns",
    fields: [
      f("returnNumber", "WRN #"),
      f("status", "Status"),
      f("customerName", "Customer"),
      f("totalPkr", "Total", true),
      f("createdAt", "Created"),
    ],
  },

  // ── Masters ──────────────────────────────────────────────────────────────
  {
    id: "register-customers",
    label: "Trade customers",
    category: "Masters",
    description: "Customer master — pick any columns",
    listKind: "customers",
    fields: [
      f("code", "Code"),
      f("name", "Name"),
      f("businessName", "Business"),
      f("phone", "Phone"),
      f("cityName", "City"),
      f("address", "Address"),
      f("creditLimitPkr", "Credit limit", true),
      f("outstandingPkr", "Outstanding", true),
      f("creditDays", "Credit days", true),
      f("ntnNumber", "NTN"),
      f("status", "Status"),
    ],
  },
  {
    id: "register-companies",
    label: "Companies",
    category: "Masters",
    description: "Company master — pick any columns",
    listKind: "companies",
    fields: [
      f("code", "Code"),
      f("name", "Name"),
      f("companyTitle", "Title"),
      f("phone", "Phone"),
      f("address", "Address"),
      f("bankName", "Bank"),
      f("transport", "Transport"),
      f("status", "Status"),
    ],
  },
  {
    id: "register-medicines",
    label: "Products / medicines",
    category: "Masters",
    description: "Product master — pick any columns",
    listKind: "medicines",
    fields: [
      f("sku", "SKU"),
      f("name", "Name"),
      f("companyName", "Company"),
      f("sellingPricePkr", "Trade / strip", true),
      f("wholesalePricePkr", "Wholesale", true),
      f("purchasePricePkr", "Purchase", true),
      f("maxRetailPricePkr", "Retail MRP", true),
      f("tabletsPerStrip", "Goli / pata", true),
      f("stripsPerBox", "Pata / pack", true),
      f("taxPct", "Sales tax %", true),
      f("status", "Status"),
    ],
  },
];

export const CUSTOM_DATASET_CATEGORIES = [
  "Sales",
  "Company",
  "Recovery",
  "Stock",
  "Distribution",
  "Field",
  "Geography",
  "Purchase",
  "Registers",
  "Masters",
] as const;

export type SavedCustomReport = {
  id: string;
  name: string;
  datasetId: string;
  columns: string[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "dist-custom-reports-v1";

export function loadSavedCustomReports(): SavedCustomReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedCustomReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomReportPreset(input: {
  id?: string;
  name: string;
  datasetId: string;
  columns: string[];
}): SavedCustomReport {
  const list = loadSavedCustomReports();
  const now = new Date().toISOString();
  const existing = input.id ? list.find((r) => r.id === input.id) : undefined;
  const next: SavedCustomReport = existing
    ? {
        ...existing,
        name: input.name.trim() || existing.name,
        datasetId: input.datasetId,
        columns: input.columns,
        updatedAt: now,
      }
    : {
        id: crypto.randomUUID(),
        name: input.name.trim() || "My custom report",
        datasetId: input.datasetId,
        columns: input.columns,
        createdAt: now,
        updatedAt: now,
      };
  const updated = existing
    ? list.map((r) => (r.id === next.id ? next : r))
    : [next, ...list];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 40)));
  return next;
}

export function deleteCustomReportPreset(id: string): void {
  const next = loadSavedCustomReports().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getDataset(id: string): CustomReportDataset | undefined {
  return CUSTOM_REPORT_DATASETS.find((d) => d.id === id);
}
