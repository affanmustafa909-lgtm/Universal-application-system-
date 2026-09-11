import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";

const GROUPS: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: "Sales",
    links: [
      { to: "/pops/pharmacy/sales-month", label: "Daily / weekly / monthly sales" },
      { to: "/pops/pharmacy/sales-statement", label: "Sales statement / detail" },
      { to: "/pops/pharmacy/sales", label: "Invoice-wise sales history" },
      { to: "/pops/pharmacy/sale-returns", label: "Sales returns" },
      { to: "/pops/distribution/orders", label: "Wholesale / distribution sales" },
      { to: "/pops/pharmacy/profit-loss", label: "Net sales / P&L" },
    ],
  },
  {
    title: "Purchase & suppliers",
    links: [
      { to: "/pops/pharmacy/purchase-orders", label: "Purchase / GRN" },
      { to: "/pops/pharmacy/purchase-statement", label: "Purchase summary" },
      { to: "/pops/pharmacy/supplier-payments", label: "Supplier payments / outstanding" },
      { to: "/pops/pharmacy/suppliers", label: "Supplier list" },
      { to: "/pops/accounting/payable", label: "Payable ageing" },
      { to: "/pops/accounting/vendors", label: "Supplier ledger (AP)" },
    ],
  },
  {
    title: "Inventory / batch / expiry",
    links: [
      { to: "/pops/pharmacy/inventory", label: "Current / low / out of stock" },
      { to: "/pops/pharmacy/expiry", label: "Batch & near-expiry" },
      { to: "/pops/pharmacy/expired", label: "Expired stock report" },
      { to: "/pops/pharmacy/warehouses", label: "Warehouse stock" },
      { to: "/pops/pharmacy/medicines", label: "Product / company stock" },
      { to: "/pops/multi-branch/transfers", label: "Stock transfer report" },
    ],
  },
  {
    title: "Customers / doctors / distribution",
    links: [
      { to: "/pops/pharmacy/customers", label: "Patient list & history" },
      { to: "/pops/distribution/trade-customers", label: "Trade / pharmacy / hospital customers" },
      { to: "/pops/pharmacy/khata", label: "Customer outstanding / receipts" },
      { to: "/pops/pharmacy/doctors", label: "Doctor-wise prescriptions / sales" },
      { to: "/pops/distribution/geo", label: "Area / territory / route" },
      { to: "/pops/distribution/collections", label: "Distribution collections" },
      { to: "/pops/distribution/deliveries", label: "Delivery pending / delivered" },
      { to: "/pops/distribution/assignments", label: "Salesman / MR activity" },
      { to: "/pops/accounting/receivable", label: "Receivable ageing" },
    ],
  },
  {
    title: "Accounts & profit",
    links: [
      { to: "/pops/accounting/cash", label: "Cash book" },
      { to: "/pops/accounting/bank", label: "Bank book" },
      { to: "/pops/accounting/journal", label: "Day book / journal" },
      { to: "/pops/accounting/accounts", label: "General ledger / CoA" },
      { to: "/pops/accounting/reports", label: "Trial balance / P&L / balance sheet" },
      { to: "/pops/accounting/expenses", label: "Expense reports" },
      { to: "/pops/pharmacy/finance", label: "Finance summary" },
      { to: "/pops/pharmacy/profit-loss", label: "Product / invoice profit" },
      { to: "/pops/closing", label: "Daily closing" },
    ],
  },
  {
    title: "Tax / schemes / compliance",
    links: [
      { to: "/pops/pharmacy/tax-compliance", label: "Tax summary" },
      { to: "/pops/tax", label: "FBR / PRA invoices" },
      { to: "/pops/distribution/pricing", label: "Schemes & price lists" },
      { to: "/pops/pharmacy/controlled-drugs", label: "Controlled medicine report" },
      { to: "/pops/pharmacy/prescriptions", label: "Prescription report" },
      { to: "/pops/pharmacy/refill-reminders", label: "Refill report" },
    ],
  },
];

export function PharmacyReportsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Report center"
        subtitle="Sales, purchase, inventory, expiry, customers, suppliers, accounts, distribution, and tax."
        actions={
          <Link to="/pops/pharmacy/dashboard" className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700">
            Dashboard
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{g.title}</h2>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-1">
              {g.links.map((l) => (
                <li key={l.to + l.label}>
                  <Link to={l.to} className="text-sm text-emerald-700 hover:underline dark:text-emerald-400">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
