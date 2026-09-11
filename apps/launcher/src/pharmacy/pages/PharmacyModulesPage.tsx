import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";

type Item = { label: string; to?: string; note?: string };

const MODULES: { title: string; items: Item[] }[] = [
  {
    title: "1. Dashboard",
    items: [
      { label: "Full KPI dashboard", to: "/pops/pharmacy/dashboard" },
      { label: "Reports hub", to: "/pops/pharmacy/reports" },
    ],
  },
  {
    title: "2. Medicine / Product Master",
    items: [
      { label: "Medicines & products", to: "/pops/pharmacy/medicines" },
      { label: "Companies / manufacturers", to: "/pops/pharmacy/companies" },
      { label: "Rack / shelf map", to: "/pops/pharmacy/rack-map" },
    ],
  },
  {
    title: "3. Pharmacy / Retail Sales",
    items: [
      { label: "POS billing", to: "/pops/pharmacy/pos" },
      { label: "Sales history", to: "/pops/pharmacy/sales" },
      { label: "Sale returns", to: "/pops/pharmacy/sale-returns" },
      { label: "Shifts & cash", to: "/pops/pharmacy/shifts" },
      { label: "Khata / credit", to: "/pops/pharmacy/khata" },
    ],
  },
  {
    title: "4–5. Customers & Suppliers",
    items: [
      { label: "Patients (retail)", to: "/pops/pharmacy/customers" },
      { label: "Doctors", to: "/pops/pharmacy/doctors" },
      { label: "Suppliers", to: "/pops/pharmacy/suppliers" },
      { label: "AR customers (accounts)", to: "/pops/accounting/customers" },
      { label: "AP vendors (accounts)", to: "/pops/accounting/vendors" },
    ],
  },
  {
    title: "6. Purchase Management",
    items: [
      { label: "PO & GRN", to: "/pops/pharmacy/purchase-orders" },
      { label: "Purchase statement", to: "/pops/pharmacy/purchase-statement" },
      { label: "Supplier payments", to: "/pops/pharmacy/supplier-payments" },
      { label: "Accounting purchases", to: "/pops/accounting/purchases" },
    ],
  },
  {
    title: "7–9. Inventory, Batch, Warehouse",
    items: [
      { label: "Stock levels & alerts", to: "/pops/pharmacy/inventory" },
      { label: "Batch & expiry", to: "/pops/pharmacy/expiry" },
      { label: "Warehouses", to: "/pops/pharmacy/warehouses" },
      { label: "Stock transfers (branch)", to: "/pops/multi-branch/transfers" },
      { label: "Inventory accounting", to: "/pops/accounting/inventory" },
    ],
  },
  {
    title: "10–12. Accounts & Returns",
    items: [
      { label: "Accounting hub", to: "/pops/accounting" },
      { label: "Cash management", to: "/pops/accounting/cash" },
      { label: "Bank accounts", to: "/pops/accounting/bank" },
      { label: "Receivables", to: "/pops/accounting/receivable" },
      { label: "Payables", to: "/pops/accounting/payable" },
      { label: "Journal / vouchers", to: "/pops/accounting/journal" },
      { label: "Chart of accounts", to: "/pops/accounting/accounts" },
      { label: "Expenses", to: "/pops/accounting/expenses" },
      { label: "P&L / financial reports", to: "/pops/accounting/reports" },
      { label: "Sale returns", to: "/pops/pharmacy/sale-returns" },
      { label: "Audit logs", to: "/pops/accounting/audit-logs" },
    ],
  },
  {
    title: "13–14. Prescriptions & Doctors",
    items: [
      { label: "Prescriptions", to: "/pops/pharmacy/prescriptions" },
      { label: "Doctors", to: "/pops/pharmacy/doctors" },
      { label: "Controlled drugs", to: "/pops/pharmacy/controlled-drugs" },
      { label: "Refill reminders", to: "/pops/pharmacy/refill-reminders" },
    ],
  },
  {
    title: "15. Tax",
    items: [
      { label: "FBR / PRA tax", to: "/pops/tax" },
      { label: "Tax compliance", to: "/pops/pharmacy/tax-compliance" },
      { label: "Accounting tax", to: "/pops/accounting/tax" },
    ],
  },
  {
    title: "16. Reports",
    items: [
      { label: "All pharmacy reports", to: "/pops/pharmacy/reports" },
      { label: "Sales month", to: "/pops/pharmacy/sales-month" },
      { label: "Profit / loss", to: "/pops/pharmacy/profit-loss" },
      { label: "Expired products", to: "/pops/pharmacy/expired" },
      { label: "Finance summary", to: "/pops/pharmacy/finance" },
      { label: "Accounting reports", to: "/pops/accounting/reports" },
      { label: "Consolidated multi-branch", to: "/pops/multi-branch/reports" },
    ],
  },
  {
    title: "17. Admin",
    items: [
      { label: "Users & roles", to: "/pops/auth" },
      { label: "Staff", to: "/pops/pharmacy/staff" },
      { label: "Multi-branch", to: "/pops/multi-branch" },
      { label: "Notifications", to: "/pops/notifications" },
      { label: "Printer", to: "/pops/printer" },
      { label: "Security / audit", to: "/pops/security" },
      { label: "Settings", to: "/pops/settings" },
      { label: "Day closing", to: "/pops/closing" },
      { label: "Sync", to: "/pops/sync" },
    ],
  },
];

export function PharmacyModulesPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="All modules"
        subtitle="Pharmacy retail ERP — wholesale / distribution is a separate Medical Distribution system."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {MODULES.map((mod) => (
          <section key={mod.title} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{mod.title}</h2>
            <ul className="mt-3 space-y-1.5">
              {mod.items.map((item) => (
                <li key={item.label}>
                  {item.to ? (
                    <Link to={item.to} className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-500">
                      {item.label}
                      {item.note ? ` — ${item.note}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
