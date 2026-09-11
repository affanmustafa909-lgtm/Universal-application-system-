import { Link } from "react-router-dom";
import { DistPageShell } from "../ui/DistUi";

const DIST = "/pops/distribution";

const REGISTERS = [
  { to: `${DIST}/orders`, label: "Sales / DO register", hint: "Distribution orders" },
  { to: `${DIST}/invoices`, label: "WINV register", hint: "Wholesale invoices" },
  { to: `${DIST}/wholesale-returns`, label: "WRN register", hint: "Wholesale returns" },
  { to: `${DIST}/purchase-orders`, label: "PO register" },
  { to: `${DIST}/purchase-grn`, label: "GRN register" },
  { to: `${DIST}/purchase-invoices`, label: "Purchase invoice register" },
  { to: `${DIST}/purchase-returns`, label: "PRN register" },
  { to: `${DIST}/deliveries`, label: "Delivery / POD register" },
  { to: `${DIST}/collections`, label: "Collection register" },
  { to: `${DIST}/stock-transfers`, label: "Stock transfer register" },
  { to: `${DIST}/stock-adjustments`, label: "Stock adjustment register" },
  { to: `${DIST}/stock-count`, label: "Stock count register" },
  { to: `${DIST}/batches`, label: "Batch register" },
  { to: `${DIST}/expiry`, label: "Expiry register" },
  { to: `${DIST}/finance/gl`, label: "Journal / GL register" },
  { to: "/pops/accounting/expenses", label: "Expense register" },
  { to: `${DIST}/audit`, label: "Audit register" },
];

export function DistributionRegistersPage(): JSX.Element {
  return (
    <DistPageShell
      title="Registers"
      subtitle="Each register is the live list for that document — not a second dataset."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Reports", to: `${DIST}/reports` },
        { label: "Registers" },
      ]}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REGISTERS.map((r) => (
          <Link
            key={r.to}
            to={r.to}
            className="rounded-lg border border-slate-200 p-4 hover:border-cyan-500 dark:border-slate-800"
          >
            <div className="font-semibold">{r.label}</div>
            {r.hint ? <p className="mt-1 text-xs text-slate-500">{r.hint}</p> : null}
          </Link>
        ))}
      </div>
    </DistPageShell>
  );
}
