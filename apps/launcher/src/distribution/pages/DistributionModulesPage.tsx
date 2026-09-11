import { Link } from "react-router-dom";
import { DistPageShell } from "../ui/DistUi";

type Item = { label: string; to: string };

const MODULES: { title: string; items: Item[] }[] = [
  {
    title: "Home",
    items: [{ label: "PS Window", to: "/pops/distribution/ps" }],
  },
  {
    title: "Sales",
    items: [
      { label: "Sale Window", to: "/pops/distribution/orders" },
      { label: "Invoices", to: "/pops/distribution/invoices" },
      { label: "Sales Returns", to: "/pops/distribution/wholesale-returns" },
      { label: "Prices / Schemes", to: "/pops/distribution/pricing" },
    ],
  },
  {
    title: "Customers & recovery",
    items: [
      { label: "Trade Customers", to: "/pops/distribution/trade-customers" },
      { label: "Aging / Outstanding", to: "/pops/distribution/aging" },
      { label: "Collections", to: "/pops/distribution/collections" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Stock Overview", to: "/pops/distribution/inventory" },
      { label: "Products / Medicines", to: "/pops/distribution/medicines" },
      { label: "Batch & Expiry", to: "/pops/distribution/expiry" },
      { label: "Warehouses", to: "/pops/distribution/warehouses" },
      { label: "Companies", to: "/pops/distribution/companies" },
      { label: "Stock Transfer", to: "/pops/multi-branch/transfers" },
    ],
  },
  {
    title: "Purchases",
    items: [
      { label: "Purchase Dashboard", to: "/pops/distribution/purchase" },
      { label: "Requisitions", to: "/pops/distribution/purchase-requisitions" },
      { label: "Purchase Orders", to: "/pops/distribution/purchase-orders" },
      { label: "GRN", to: "/pops/distribution/purchase-grn" },
      { label: "Purchase Returns", to: "/pops/distribution/purchase-returns" },
      { label: "Purchase Invoices", to: "/pops/distribution/purchase-invoices" },
      { label: "Suppliers", to: "/pops/distribution/suppliers" },
      { label: "Reorder Suggestions", to: "/pops/distribution/inventory-reports?tab=reorder" },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Masters hub", to: "/pops/distribution/masters" },
      { label: "Medicines", to: "/pops/distribution/medicines" },
      { label: "Product masters", to: "/pops/distribution/product-masters" },
      { label: "Trade customers", to: "/pops/distribution/trade-customers" },
      { label: "Companies", to: "/pops/distribution/companies" },
      { label: "Warehouses", to: "/pops/distribution/warehouses" },
      { label: "Sales force", to: "/pops/distribution/sales-force" },
      { label: "Pricing / schemes", to: "/pops/distribution/pricing" },
      { label: "Import / Export", to: "/pops/distribution/import" },
      { label: "Admin hub", to: "/pops/distribution/admin" },
      { label: "Registers", to: "/pops/distribution/registers" },
      { label: "Audit log", to: "/pops/distribution/audit" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Deliveries / POD", to: "/pops/distribution/deliveries" },
      { label: "Field Force", to: "/pops/distribution/field-force" },
      { label: "Geography", to: "/pops/distribution/geo" },
      { label: "Report Center", to: "/pops/distribution/reports" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Finance Dashboard", to: "/pops/distribution/finance" },
      { label: "Accounting Hub", to: "/pops/accounting" },
      { label: "Receivables", to: "/pops/accounting/receivable" },
      { label: "Payables", to: "/pops/accounting/payable" },
      { label: "Cash", to: "/pops/accounting/cash" },
      { label: "Bank", to: "/pops/accounting/bank" },
    ],
  },
];

export function DistributionModulesPage(): JSX.Element {
  return (
    <DistPageShell
      title="All modules"
      subtitle="Medical distribution operating map — every link opens a live screen."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "All modules" },
      ]}
    >
      {MODULES.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.title}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-cyan-500 dark:border-slate-700 dark:text-slate-100"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </DistPageShell>
  );
}
