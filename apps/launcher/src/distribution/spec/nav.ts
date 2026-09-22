import type { PopsNavItem } from "../../pops/spec/modules";

/**
 * Medical Distribution ERP navigation — enterprise IA.
 * Only links to routes that already exist (no dead placeholders).
 */
export const distributionNavItems: PopsNavItem[] = [
  { type: "link", path: "distribution/ps", label: "PS Window" },
  {
    type: "group",
    label: "Sales",
    children: [
      { path: "distribution/orders", label: "Sale Window" },
      { path: "distribution/invoices", label: "Invoices" },
      { path: "distribution/wholesale-returns", label: "Sales Returns" },
      { path: "distribution/pricing", label: "Prices / Schemes" },
      { path: "distribution/reports", label: "Sales Report" },
    ],
  },
  {
    type: "group",
    label: "Customers",
    children: [
      { path: "distribution/trade-customers", label: "Trade Customers" },
      { path: "distribution/aging", label: "Outstanding / Aging" },
      { path: "distribution/collection", label: "Collections Dashboard" },
      { path: "distribution/collections", label: "Collections" },
    ],
  },
  {
    type: "group",
    label: "Inventory",
    children: [
      { path: "distribution/inventory", label: "Inventory Dashboard" },
      { path: "distribution/stock", label: "Stock by Product" },
      { path: "distribution/batches", label: "Batches" },
      { path: "distribution/expiry", label: "Expiry & Near Expiry" },
      { path: "distribution/stock-ledger", label: "Stock Ledger" },
      // Repointed from multi-branch/transfers, which is the restaurant ingredient transfer screen.
      { path: "distribution/stock-transfers", label: "Stock Transfers" },
      { path: "distribution/stock-adjustments", label: "Stock Adjustments" },
      { path: "distribution/stock-count", label: "Stock Count" },
      { path: "distribution/inventory-reports", label: "Inventory Reports" },
      { path: "distribution/medicines", label: "Products / Medicines" },
      { path: "distribution/warehouses", label: "Warehouses" },
      { path: "distribution/companies", label: "Companies" },
    ],
  },
  {
    type: "group",
    label: "Purchases",
    children: [
      { path: "distribution/purchase", label: "Purchase Dashboard" },
      { path: "distribution/purchase-requisitions", label: "Requisitions" },
      { path: "distribution/purchase-orders", label: "Purchase Orders" },
      { path: "distribution/purchase-grn", label: "Receiving / GRN" },
      { path: "distribution/purchase-returns", label: "Purchase Returns" },
      { path: "distribution/purchase-invoices", label: "Purchase Invoices" },
      { path: "distribution/suppliers", label: "Suppliers" },
      { path: "distribution/inventory-reports?tab=reorder", label: "Reorder Suggestions" },
      { path: "distribution/reports?category=Purchase", label: "Purchase Reports" },
      { path: "accounting/purchases", label: "Purchase Accounting" },
    ],
  },
  {
    type: "group",
    label: "Deliveries",
    children: [
      { path: "distribution/delivery", label: "Delivery Dashboard" },
      { path: "distribution/deliveries", label: "Deliveries / POD" },
      { path: "distribution/dispatch", label: "Dispatch" },
    ],
  },
  {
    type: "group",
    label: "Collections",
    children: [
      { path: "distribution/collection", label: "Collections Dashboard" },
      { path: "distribution/collections", label: "Collections" },
      { path: "distribution/aging", label: "Aging" },
      { path: "distribution/recovery", label: "Recovery" },
    ],
  },
  {
    type: "group",
    label: "Field Force",
    children: [
      { path: "distribution/field-force", label: "Dashboard" },
      { path: "distribution/sales-force", label: "Salesmen" },
      { path: "distribution/route-plan", label: "Route plan" },
      { path: "distribution/pjp", label: "PJP / Sale plan" },
      { path: "distribution/visits", label: "Today's Visits" },
      { path: "distribution/targets", label: "Targets" },
      { path: "distribution/field-performance", label: "Performance" },
      { path: "distribution/assignments", label: "Legacy assignments" },
    ],
  },
  {
    type: "group",
    label: "Geography",
    children: [{ path: "distribution/geo", label: "Province → Route" }],
  },
  {
    type: "group",
    label: "Finance & Accounts",
    children: [
      { path: "distribution/finance", label: "Finance Dashboard" },
      { path: "distribution/cash", label: "Cash session / In-Out" },
      { path: "distribution/finance/gl", label: "General Ledger" },
      { path: "distribution/finance/customer-ledger", label: "Customer Ledger" },
      { path: "distribution/finance/supplier-ledger", label: "Supplier Ledger" },
      { path: "distribution/finance/reconciliation", label: "Reconciliation" },
      { path: "distribution/finance/periods", label: "Financial Periods" },
      { path: "accounting", label: "Accounting Hub" },
      { path: "accounting/receivable", label: "Receivables" },
      { path: "accounting/payable", label: "Payables" },
      { path: "accounting/bank", label: "Bank" },
      { path: "accounting/expenses", label: "Expenses" },
      { path: "accounting/journal", label: "Journal Entries" },
      { path: "accounting/accounts", label: "Chart of Accounts" },
      { path: "accounting/reports", label: "Trial Balance / P&L / BS" },
      { path: "accounting/tax", label: "Taxes" },
    ],
  },
  {
    type: "group",
    label: "Reports",
    children: [
      { path: "distribution/reports", label: "Report Center" },
      { path: "distribution/reports?mode=custom", label: "Custom Report Builder" },
      { path: "distribution/registers", label: "Registers" },
    ],
  },
  {
    type: "group",
    label: "Masters",
    children: [
      { path: "distribution/masters", label: "Masters hub" },
      { path: "distribution/medicines", label: "Medicines" },
      { path: "distribution/product-masters", label: "Product masters" },
      { path: "distribution/trade-customers", label: "Trade customers" },
      { path: "distribution/suppliers", label: "Suppliers" },
      { path: "distribution/companies", label: "Companies" },
      { path: "distribution/warehouses", label: "Warehouses" },
      { path: "distribution/sales-force", label: "Sales force" },
      { path: "distribution/geo", label: "Territory / Route" },
      { path: "distribution/pricing", label: "Price List / Scheme" },
      { path: "distribution/import", label: "Import / Export" },
    ],
  },
  {
    type: "group",
    label: "Administration",
    children: [
      { path: "distribution/admin", label: "Admin hub" },
      { path: "distribution/audit", label: "Audit log" },
      { path: "auth", label: "Users & Roles" },
      { path: "distribution/staff", label: "Staff" },
      { path: "multi-branch", label: "Branches" },
      { path: "notifications", label: "Notifications" },
      { path: "printer", label: "Printers" },
      { path: "tax", label: "FBR / PRA" },
      { path: "security", label: "Security" },
      { path: "settings", label: "Settings" },
      { path: "closing", label: "Day Closing" },
      { path: "distribution/modules", label: "All Modules" },
    ],
  },
  {
    type: "group",
    label: "System",
    children: [
      { path: "sync", label: "Backup / Sync" },
      { path: "settings", label: "Installer / Settings" },
    ],
  },
];

export const DISTRIBUTION_ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full distribution access",
  manager: "Manager — orders, field force, recovery",
  cashier: "Order desk — booking and invoices",
  accountant: "Collections and receivables",
  hr: "Field force / HR",
};
