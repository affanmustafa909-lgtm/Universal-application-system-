import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { financeApi } from "../../pharmacy/api/pharmacy-finance";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistWidgetSection } from "../components/DistWidgetSection";
import { DistButton, DistKpiCard, DistPageShell, DistPanel } from "../ui/DistUi";

const DIST = "/pops/distribution";
const ACC = "/pops/accounting";

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function DistributionFinanceDashboardPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const dash = useQuery({
    queryKey: ["distribution", "finance", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => financeApi.dashboard(branch!.code),
  });
  const k = (dash.data?.kpis ?? {}) as Record<string, unknown>;
  const aging = (dash.data?.receivablesAging ?? {}) as Record<string, unknown>;
  const expenses = (dash.data?.expenseBreakdown ?? []) as Array<{ category?: string; amountPkr?: number }>;
  const trend = (dash.data?.revenueTrend ?? []) as Array<{ month?: string; amountPkr?: number }>;
  const checks = ((dash.data?.control ?? []) as Array<Record<string, unknown>>).filter(
    (c) => c.severity && c.severity !== "ok",
  );

  return (
    <DistPageShell
      title="Finance"
      subtitle="Cash, bank, AR, AP, and journals from the shared accounting engine — not a second ledger."
      breadcrumb={[{ label: "Distribution", to: `${DIST}/ps` }, { label: "Finance" }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/cash`}>
            <DistButton variant="secondary">Cash session</DistButton>
          </Link>
          <Link to={`${DIST}/finance/gl`}>
            <DistButton>General ledger</DistButton>
          </Link>
          <Link to={`${ACC}/journal`}>
            <DistButton variant="secondary">Journal entry</DistButton>
          </Link>
          <Link to={`${DIST}/finance/reconciliation`}>
            <DistButton variant="secondary">Reconciliation</DistButton>
          </Link>
        </div>
      }
      error={!branch ? "Select a branch to load finance." : null}
    >
      <DistWidgetSection
        title="Balances"
        subtitle="Server-side GL and Dist outstanding"
        isLoading={dash.isLoading}
        isError={dash.isError}
        error={dash.error}
        onRetry={() => void dash.refetch()}
        isEmpty={!dash.isLoading && !dash.data}
        emptyTitle="No finance data for this branch"
        emptyDescription="Post a sale, collection, GRN, or expense to seed the ledger."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DistKpiCard label="Cash" value={formatPkr(num(k.cashBalance))} to={`${DIST}/cash`} />
          <DistKpiCard label="Bank" value={formatPkr(num(k.bankBalance))} to={`${ACC}/bank`} />
          <DistKpiCard
            label="Accounts receivable"
            value={formatPkr(num(k.accountsReceivable))}
            tone={num(k.accountsReceivable) > 0 ? "warning" : "default"}
            to={`${DIST}/aging`}
          />
          <DistKpiCard label="Accounts payable" value={formatPkr(num(k.accountsPayable))} to={`${ACC}/payable`} />
          <DistKpiCard label="Today's receipts" value={formatPkr(num(k.todayReceipts))} to={`${DIST}/collections`} />
          <DistKpiCard label="Today's expenses" value={formatPkr(num(k.todayPayments))} to={`${ACC}/expenses`} />
          <DistKpiCard label="Monthly revenue" value={formatPkr(num(k.monthlyRevenue))} to={`${DIST}/invoices`} />
          <DistKpiCard
            label="Tax payable"
            value={formatPkr(num(k.taxPayable))}
            to={`${ACC}/tax`}
          />
          <DistKpiCard
            label="Gross profit"
            value={k.grossProfit == null ? "N/A" : formatPkr(num(k.grossProfit))}
            hint="Shown only when COGS postings are reliable"
            to={`${ACC}/reports`}
          />
          <DistKpiCard label="Net (P&L)" value={formatPkr(num(k.netProfit))} to={`${ACC}/reports`} />
        </div>
      </DistWidgetSection>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DistPanel title="Receivables aging" subtitle="Same buckets as Collections / Recovery">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                ["Current", aging.currentPkr, `${DIST}/aging`],
                ["1–30", aging.d1to30Pkr, `${DIST}/aging?bucket=d1_30`],
                ["31–60", aging.d31to60Pkr, `${DIST}/aging?bucket=d31_60`],
                ["61–90", aging.d61to90Pkr, `${DIST}/aging?bucket=d61_90`],
                ["91–120", aging.d91to120Pkr, `${DIST}/aging?bucket=d91_120`],
                ["120+", aging.d120plusPkr, `${DIST}/aging?bucket=d120_plus`],
              ] as const
            ).map(([label, value, to]) => (
              <DistKpiCard key={label} label={label} value={formatPkr(num(value))} to={to} />
            ))}
          </div>
        </DistPanel>
        <DistPanel title="Expense breakdown" subtitle="This month" action={<Link className="text-sm text-cyan-700" to={`${ACC}/expenses`}>Register</Link>}>
          {expenses.length === 0 ? (
            <p className="text-sm text-slate-500">No posted expenses this month.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {expenses.map((e) => (
                <li key={e.category} className="flex justify-between gap-3">
                  <span>{e.category ?? "Other"}</span>
                  <span className="font-medium">{formatPkr(e.amountPkr ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </DistPanel>
      </div>

      <DistPanel title="Revenue trend" subtitle="Wholesale invoices by month">
        {trend.length === 0 ? (
          <p className="text-sm text-slate-500">No wholesale invoices in the last six months.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {trend.map((r) => (
              <li key={r.month} className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                <div className="text-xs text-slate-500">{r.month}</div>
                <div className="font-semibold">{formatPkr(r.amountPkr ?? 0)}</div>
              </li>
            ))}
          </ul>
        )}
      </DistPanel>

      {checks.length > 0 ? (
        <DistPanel title="Control exceptions" subtitle="Differences are shown, not auto-corrected">
          <ul className="space-y-2 text-sm">
            {checks.map((c) => (
              <li key={String(c.code)}>
                <Link className="text-cyan-800 hover:underline dark:text-cyan-300" to={`${DIST}/finance/reconciliation`}>
                  {String(c.label)} — difference {formatPkr(num(c.differencePkr))}
                </Link>
              </li>
            ))}
          </ul>
        </DistPanel>
      ) : null}
    </DistPageShell>
  );
}
