import type { PopsNavItem } from "../../pops/spec/modules";

/** Pharmacy retail ERP navigation (distribution lives in its own system). */
export const pharmacyNavItems: PopsNavItem[] = [
  { type: "link", path: "pharmacy/dashboard", label: "Dashboard" },
  { type: "link", path: "pharmacy/lookup", label: "Find by code" },
  { type: "link", path: "pharmacy/modules", label: "All modules" },
  {
    type: "group",
    label: "Pharmacy retail",
    children: [
      { path: "pharmacy/pos", label: "POS billing" },
      { path: "pharmacy/sales", label: "Retail sales" },
      { path: "pharmacy/sale-returns", label: "Sales returns" },
      { path: "pharmacy/customers", label: "Patients" },
      { path: "pharmacy/prescriptions", label: "Prescriptions" },
      { path: "pharmacy/doctors", label: "Doctor CRM" },
      { path: "pharmacy/shifts", label: "Shifts" },
      { path: "pharmacy/khata", label: "Khata / credit" },
      { path: "pharmacy/controlled-drugs", label: "Controlled drugs" },
      { path: "pharmacy/refill-reminders", label: "Refills" },
    ],
  },
  {
    type: "group",
    label: "Products & inventory",
    children: [
      { path: "pharmacy/medicines", label: "Medicines / products" },
      { path: "pharmacy/companies", label: "Companies" },
      { path: "pharmacy/warehouses", label: "Warehouses" },
      { path: "pharmacy/inventory", label: "Stock & reorder" },
      { path: "pharmacy/expiry", label: "Batches & expiry" },
      { path: "pharmacy/rack-map", label: "Rack / shelf / bin" },
      { path: "multi-branch/transfers", label: "Stock / branch transfer" },
    ],
  },
  {
    type: "group",
    label: "Purchase",
    children: [
      { path: "pharmacy/suppliers", label: "Suppliers" },
      { path: "pharmacy/purchase-orders", label: "PO / GRN" },
      { path: "pharmacy/purchase-statement", label: "Purchase reports" },
      { path: "pharmacy/supplier-payments", label: "Supplier payments" },
      { path: "accounting/purchases", label: "Purchase accounting" },
    ],
  },
  {
    type: "group",
    label: "Accounts & finance",
    children: [
      { path: "accounting", label: "Accounting hub" },
      { path: "accounting/cash", label: "Cash" },
      { path: "accounting/bank", label: "Bank" },
      { path: "accounting/receivable", label: "Receivables" },
      { path: "accounting/payable", label: "Payables" },
      { path: "accounting/expenses", label: "Expenses" },
      { path: "accounting/journal", label: "Journal / vouchers" },
      { path: "accounting/accounts", label: "Chart of accounts" },
      { path: "accounting/reports", label: "P&L / TB / BS" },
      { path: "accounting/audit-logs", label: "Audit logs" },
      { path: "pharmacy/finance", label: "Finance summary" },
    ],
  },
  {
    type: "group",
    label: "Reports",
    children: [
      { path: "pharmacy/reports", label: "Report center" },
      { path: "pharmacy/sales-month", label: "Sales by period" },
      { path: "pharmacy/profit-loss", label: "Profit reports" },
      { path: "pharmacy/expired", label: "Expiry reports" },
      { path: "pharmacy/tax-compliance", label: "Tax reports" },
      { path: "multi-branch/reports", label: "Consolidated" },
    ],
  },
  {
    type: "group",
    label: "Administration",
    children: [
      { path: "auth", label: "Users & roles" },
      { path: "pharmacy/staff", label: "Staff" },
      { path: "pharmacy/staff-panel", label: "Staff panel" },
      { path: "pharmacy/admin-panel", label: "Admin panel" },
      { path: "multi-branch", label: "Branches" },
      { path: "notifications", label: "Notifications" },
      { path: "printer", label: "Printing" },
      { path: "tax", label: "FBR / PRA" },
      { path: "security", label: "Security" },
      { path: "settings", label: "Settings" },
      { path: "closing", label: "Day closing" },
      { path: "sync", label: "Backup / sync" },
    ],
  },
];

export const PHARMACY_ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full access, users, reports, inventory",
  pharmacist: "Pharmacist — prescriptions, dispensing, controlled drugs",
  cashier: "Cashier — billing, payments, Khata, limited inventory",
  inventory_manager: "Inventory manager — stock, purchases, expiry",
  manager: "Manager — analytics, finance, shift oversight",
};
