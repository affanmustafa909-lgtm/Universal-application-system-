export type DistReportDef = {
  id: string;
  title: string;
  category: string;
  live: boolean;
  description: string;
  /**
   * Set when the report has a dedicated screen instead of a generic
   * `/distribution/reports/:id` query — the Report Center links there rather
   * than rendering an empty table it cannot fill.
   */
  to?: string;
};

/** Catalog — all reports run against live API queries. */
export const DISTRIBUTION_REPORTS: DistReportDef[] = [
  // Sales
  {
    id: "sales-report",
    title: "Sales report",
    category: "Sales",
    live: true,
    description: "Full sales lines — date, customer, salesman, company, product, qty, value",
  },
  { id: "daily-sales", title: "Daily sales", category: "Sales", live: true, description: "Orders and totals by date" },
  { id: "city-sales", title: "City-wise sales", category: "Sales", live: true, description: "Sales rolled up by city" },
  { id: "area-sales", title: "Area-wise sales", category: "Sales", live: true, description: "Sales rolled up by area" },
  { id: "status-pipeline", title: "Order status pipeline", category: "Sales", live: true, description: "Count of orders by status" },
  { id: "scheme-utilization", title: "Scheme utilization", category: "Sales", live: true, description: "Schemes vs free qty given on orders" },
  { id: "salesman-sales", title: "Salesman-wise sales", category: "Sales", live: true, description: "Orders and sales by salesman" },
  { id: "customer-sales", title: "Customer-wise sales", category: "Sales", live: true, description: "Orders and sales by trade customer" },
  { id: "sku-sales", title: "SKU / product sales", category: "Sales", live: true, description: "Qty and value by SKU" },

  // Recovery
  { id: "outstanding-aging", title: "Outstanding / aging", category: "Recovery", live: true, description: "Trade customers with balance due" },
  { id: "collections-summary", title: "Collections summary", category: "Recovery", live: true, description: "Collections by date" },
  { id: "customer-ledger", title: "Customer ledger", category: "Recovery", live: true, description: "Outstanding and credit by customer" },
  { id: "credit-limit-breach", title: "Credit limit alerts", category: "Recovery", live: true, description: "Customers over credit limit" },

  // Stock
  { id: "stock-near-expiry", title: "Stock near expiry", category: "Stock", live: true, description: "Batches expiring within 90 days" },
  { id: "stock-by-warehouse", title: "Warehouse stock", category: "Stock", live: true, description: "SKU count and qty by warehouse" },
  { id: "slow-moving", title: "Slow moving stock", category: "Stock", live: true, description: "Stock with low sales movement" },
  { id: "batch-trace", title: "Batch trace", category: "Stock", live: true, description: "Batch, expiry, qty and reserve" },

  // Distribution
  { id: "pending-deliveries", title: "Pending deliveries", category: "Distribution", live: true, description: "Open delivery tickets" },
  { id: "delivery-status", title: "Delivery status wise", category: "Distribution", live: true, description: "Deliveries grouped by status" },
  { id: "pod-exceptions", title: "POD exceptions", category: "Distribution", live: true, description: "Failed / exception deliveries" },
  { id: "route-load", title: "Route load", category: "Distribution", live: true, description: "Deliveries pending vs delivered by route" },

  // Field
  { id: "field-force-dashboard", title: "Field force dashboard", category: "Field", live: true, description: "Today PJP / visits / achievement", to: "/pops/distribution/field-force" },
  { id: "field-performance", title: "Field performance", category: "Field", live: true, description: "Salesman / territory / route achievement", to: "/pops/distribution/field-performance" },
  { id: "visit-coverage", title: "Visit coverage", category: "Field", live: true, description: "Field visits in range" },
  { id: "target-vs-achievement", title: "Target vs achievement", category: "Field", live: true, description: "Sales targets vs actual" },
  { id: "pjp-adherence", title: "PJP adherence", category: "Field", live: true, description: "Visits vs planned PJP day" },
  { id: "unvisited-customers", title: "Unvisited customers", category: "Field", live: true, description: "No visit in last 14 days" },

  // Company
  { id: "company-performance", title: "Company-wise sales", category: "Company", live: true, description: "Sales qty and value by company" },
  { id: "company-sku-sales", title: "Company × SKU sales", category: "Company", live: true, description: "SKU breakdown under each company" },
  { id: "company-stock", title: "Company-wise stock", category: "Company", live: true, description: "SKU count and stock qty by company" },
  { id: "company-net-sales", title: "Company net sales", category: "Company", live: true, description: "Sales minus wholesale returns by company" },

  // Purchase — Phase 6 Dist screens + legacy report queries
  { id: "purchase-dashboard", title: "Purchase dashboard", category: "Purchase", live: true, description: "Procurement KPIs and quick actions", to: "/pops/distribution/purchase" },
  { id: "purchase-requisitions", title: "Requisition register", category: "Purchase", live: true, description: "Demand documents awaiting convert to PO", to: "/pops/distribution/purchase-requisitions" },
  { id: "purchase-vs-sales", title: "Purchase vs sales", category: "Purchase", live: true, description: "PO totals vs distribution sales" },
  { id: "grn-pending", title: "Pending GRN", category: "Purchase", live: true, description: "POs without GRN received", to: "/pops/distribution/purchase-grn" },
  { id: "purchase-invoices-ui", title: "Purchase invoices", category: "Purchase", live: true, description: "Documentary invoices matched to GRN", to: "/pops/distribution/purchase-invoices" },
  { id: "supplier-performance", title: "Supplier performance", category: "Purchase", live: true, description: "Supplier list with on-demand performance", to: "/pops/distribution/suppliers" },
  { id: "reorder-bridge", title: "Reorder → purchase", category: "Purchase", live: true, description: "Phase 4 reorder suggestions to raise demand", to: "/pops/distribution/inventory-reports?tab=reorder" },

  // Document registers
  { id: "srn-register", title: "SRN — Sale returns", category: "Registers", live: true, description: "Sale return note register" },
  { id: "wrn-register", title: "WRN — Wholesale returns", category: "Registers", live: true, description: "Wholesale / RTV return register" },
  { id: "winv-register", title: "WINV — Wholesale invoices", category: "Registers", live: true, description: "Wholesale invoice register" },
  { id: "grn-register", title: "GRN — Goods receipts", category: "Registers", live: true, description: "Goods receipt note register", to: "/pops/distribution/purchase-grn" },
  { id: "prn-register", title: "PRN — Purchase returns", category: "Registers", live: true, description: "Purchase return note register", to: "/pops/distribution/purchase-returns" },
  { id: "po-register", title: "PO — Purchase orders", category: "Registers", live: true, description: "Purchase order register", to: "/pops/distribution/purchase-orders" },
  { id: "do-register", title: "DO — Dist orders", category: "Registers", live: true, description: "Distribution order register" },
  { id: "dlv-register", title: "DLV — Deliveries", category: "Registers", live: true, description: "Delivery ticket register" },
  { id: "col-register", title: "COL — Collections", category: "Registers", live: true, description: "Collection register" },
  { id: "asn-register", title: "ASN — Assignments", category: "Registers", live: true, description: "Field assignment register" },
  { id: "registers-hub", title: "Registers hub", category: "Registers", live: true, description: "All live document registers", to: "/pops/distribution/registers" },
  { id: "audit-register", title: "Audit register", category: "Registers", live: true, description: "Master and inventory mutation log", to: "/pops/distribution/audit" },

  // Administration
  { id: "admin-hub", title: "Administration", category: "Administration", live: true, description: "Users, branches, printers, import jobs, audit", to: "/pops/distribution/admin" },
  { id: "io-jobs", title: "Import / export jobs", category: "Administration", live: true, description: "Templates, validation, job history", to: "/pops/distribution/import" },

  // Geography
  { id: "district-coverage", title: "District coverage", category: "Geography", live: true, description: "Customers, orders, sales by district" },
  { id: "province-sales", title: "Province-wise sales", category: "Geography", live: true, description: "Sales rolled up by province" },

  // Inventory — Phase 4. These run on the inventory API and have their own
  // screens with batch-level filters, so the catalog links instead of querying.
  { id: "inv-stock", title: "Stock by product", category: "Inventory", live: true, description: "Available, reserved, and physical stock per SKU", to: "/pops/distribution/stock" },
  { id: "inv-batches", title: "Batch register", category: "Inventory", live: true, description: "Every batch with derived expiry status and traceability", to: "/pops/distribution/batches" },
  { id: "inv-expiry", title: "Expiry & near expiry", category: "Inventory", live: true, description: "Configurable expiry buckets and expired stock", to: "/pops/distribution/expiry" },
  { id: "inv-ledger", title: "Stock movement register", category: "Inventory", live: true, description: "Authoritative append-only stock ledger", to: "/pops/distribution/stock-ledger" },
  { id: "inv-valuation", title: "Stock valuation", category: "Inventory", live: true, description: "Valuation by warehouse and company with costing basis", to: "/pops/distribution/inventory-reports" },
  { id: "inv-reorder", title: "Reorder suggestions", category: "Inventory", live: true, description: "Reorder needs using the configured formula", to: "/pops/distribution/inventory-reports?tab=reorder" },
  { id: "inv-slow-moving", title: "Slow moving stock", category: "Inventory", live: true, description: "Stock with no outbound movement in the period", to: "/pops/distribution/inventory-reports" },
  { id: "inv-aging", title: "Stock aging", category: "Inventory", live: true, description: "How long stock has been held, by bucket", to: "/pops/distribution/inventory-reports" },
  { id: "inv-transfers", title: "Stock transfers", category: "Inventory", live: true, description: "Inter-warehouse transfer register and workflow", to: "/pops/distribution/stock-transfers" },
  { id: "inv-adjustments", title: "Stock adjustments", category: "Inventory", live: true, description: "Adjustment, damage, and write-off register", to: "/pops/distribution/stock-adjustments" },
  { id: "inv-reconcile", title: "Stock reconciliation", category: "Inventory", live: true, description: "Read-only drift report between cache, batches, and ledger", to: "/pops/distribution/inventory-reports" },

  // Finance — Phase 9 Dist views + existing accounting reports (one engine)
  { id: "fin-dashboard", title: "Finance dashboard", category: "Finance", live: true, description: "Cash, bank, AR, AP, receipts, expenses", to: "/pops/distribution/finance" },
  { id: "fin-gl", title: "General ledger", category: "Finance", live: true, description: "Paginated posted journal lines", to: "/pops/distribution/finance/gl" },
  { id: "fin-supplier-ledger", title: "Supplier ledger", category: "Finance", live: true, description: "GRN and purchase-return statement", to: "/pops/distribution/finance/supplier-ledger" },
  { id: "fin-recon", title: "Financial reconciliation", category: "Finance", live: true, description: "AR/AP/GL mismatches — not auto-fixed", to: "/pops/distribution/finance/reconciliation" },
  { id: "fin-periods", title: "Financial periods", category: "Finance", live: true, description: "Open and close accounting periods", to: "/pops/distribution/finance/periods" },
  { id: "fin-tb", title: "Trial balance", category: "Finance", live: true, description: "Server-side trial balance", to: "/pops/accounting/reports" },
  { id: "fin-pl", title: "Profit & loss", category: "Finance", live: true, description: "P&L from posted journals", to: "/pops/accounting/reports" },
  { id: "fin-bs", title: "Balance sheet", category: "Finance", live: true, description: "Balance sheet from posted journals", to: "/pops/accounting/reports" },
];

export const REPORT_CATEGORY_ORDER = [
  "Sales",
  "Recovery",
  "Inventory",
  "Stock",
  "Distribution",
  "Field",
  "Company",
  "Purchase",
  "Finance",
  "Registers",
  "Administration",
  "Geography",
] as const;
