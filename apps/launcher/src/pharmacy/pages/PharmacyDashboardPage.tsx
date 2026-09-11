import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatedBarChart } from "../../pops/components/dashboard/AnimatedBarChart";
import { AnimatedDonutChart } from "../../pops/components/dashboard/AnimatedDonutChart";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass } from "../../pops/lib/themeClasses";
import { fetchPharmacyDashboard } from "../api/pharmacy";
import { formatPkr, usePharmacyAccess } from "../hooks/usePharmacy";
import { PharmacyStatCard } from "../ui/PharmacyUi";

const CHART_COLORS = ["#10b981", "#14b8a6", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444"];

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

export function PharmacyDashboardPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const dashboardQuery = useQuery({
    queryKey: ["pharmacy", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 30_000,
    queryFn: () => fetchPharmacyDashboard(branch!.code),
  });

  if (dashboardQuery.isLoading) {
    return <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">Loading pharmacy dashboard…</div>;
  }
  if (dashboardQuery.isError) {
    return <div className={noticeErrorClass}>{(dashboardQuery.error as Error).message}</div>;
  }

  const m = dashboardQuery.data as Record<string, any>;
  const n = (k: string, fallback = 0) => Number(m[k] ?? fallback);
  const arr = <T,>(k: string): T[] => (Array.isArray(m[k]) ? m[k] : []);

  const paymentSegments = arr<{ label: string; value: number }>("paymentBreakdown").map((p, i) => ({
    label: p.label,
    value: p.value,
    color: CHART_COLORS[i % CHART_COLORS.length]!,
  }));
  const stockSegments = arr<{ label: string; value: number }>("stockHealth").map((s, i) => ({
    label: s.label,
    value: s.value,
    color: i === 0 ? "#10b981" : i === 1 ? "#f59e0b" : "#ef4444",
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pharmacy + Distribution dashboard"
        subtitle={`${branch?.name ?? "Branch"} — full retail, wholesale, stock, and finance overview.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/pops/pharmacy/pos" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
              POS
            </Link>
            <Link to="/pops/distribution/orders" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-700">
              Distribution
            </Link>
            <Link to="/pops/pharmacy/modules" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-700">
              All modules
            </Link>
          </div>
        }
      />

      <Section title="Sales & profit">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <PharmacyStatCard label="Total sales" value={formatPkr(n("totalSales", n("revenueMonth")))} />
          <PharmacyStatCard label="Total purchases" value={formatPkr(n("totalPurchases", n("totalPurchasesMonth")))} />
          <PharmacyStatCard label="Gross profit" value={formatPkr(n("grossProfit", n("profitMonth")))} tone="success" />
          <PharmacyStatCard label="Net profit" value={formatPkr(n("netProfit", n("profitMonth")))} tone={n("netProfit", n("profitMonth")) >= 0 ? "success" : "danger"} />
          <PharmacyStatCard label="Retail sales (mo)" value={formatPkr(n("retailSalesMonth", n("revenueMonth")))} />
          <PharmacyStatCard label="Wholesale (mo)" value={formatPkr(n("wholesaleSalesMonth", n("distributionSalesMonth")))} />
        </div>
      </Section>

      <Section title="Today">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <PharmacyStatCard label="Today sales" value={formatPkr(n("todaySales", n("totalSalesToday")))} tone="success" />
          <PharmacyStatCard label="Today purchases" value={formatPkr(n("todayPurchases"))} />
          <PharmacyStatCard label="Today expenses" value={formatPkr(n("todayExpenses"))} />
          <PharmacyStatCard label="Today collections" value={formatPkr(n("todayCollections"))} />
          <PharmacyStatCard label="Today payments" value={formatPkr(n("todayPayments"))} />
          <PharmacyStatCard label="Bills today" value={n("transactionCountToday")} />
        </div>
      </Section>

      <Section title="Cash, bank & ledgers">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PharmacyStatCard label="Cash in hand" value={formatPkr(n("cashInHand"))} />
          <PharmacyStatCard label="Bank balance" value={formatPkr(n("bankBalance"))} />
          <PharmacyStatCard label="Customer receivables" value={formatPkr(n("customerReceivables"))} tone="warning" />
          <PharmacyStatCard label="Supplier payables" value={formatPkr(n("supplierPayables"))} tone="warning" />
        </div>
      </Section>

      <Section title="Masters & stock">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <PharmacyStatCard label="Customers" value={n("totalCustomers", n("customerCount"))} />
          <PharmacyStatCard label="Suppliers" value={n("totalSuppliers")} />
          <PharmacyStatCard label="Products" value={n("totalProducts")} />
          <PharmacyStatCard label="Stock value" value={formatPkr(n("totalStockValue"))} />
          <PharmacyStatCard label="Low stock" value={n("lowStockCount")} tone="warning" />
          <PharmacyStatCard label="Out of stock" value={n("outOfStockCount")} tone="danger" />
          <PharmacyStatCard label="Near expiry" value={n("nearExpiryCount", n("expiringCount"))} tone="warning" />
          <PharmacyStatCard label="Expired" value={n("expiredCount")} tone="danger" />
          <PharmacyStatCard label="Pending orders" value={n("pendingOrders")} tone={n("pendingOrders") > 0 ? "warning" : "default"} />
          <PharmacyStatCard label="Pending cust. pay" value={n("pendingCustomerPayments")} />
          <PharmacyStatCard label="Pending supp. pay" value={n("pendingSupplierPayments")} />
          <PharmacyStatCard label="Stock units" value={n("availableStock").toLocaleString()} />
        </div>
      </Section>

      <Section title="Returns & channels">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PharmacyStatCard label="Sales returns (mo)" value={formatPkr(n("salesReturnTotal"))} />
          <PharmacyStatCard label="Purchase returns (mo)" value={formatPkr(n("purchaseReturnTotal"))} />
          <PharmacyStatCard label="Distribution (mo)" value={formatPkr(n("distributionSalesMonth"))} />
          <PharmacyStatCard label="Month revenue" value={formatPkr(n("revenueMonth"))} tone="success" />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily / weekly sales" subtitle="Last 7 days">
          <AnimatedBarChart
            chartId="pharmacy-daily-sales"
            points={arr<{ date: string; amount: number }>("weeklySales").length
              ? arr<{ date: string; amount: number }>("weeklySales").map((d) => ({
                  label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
                  value: d.amount,
                  color: "#10b981",
                }))
              : arr<{ date: string; amount: number }>("dailySales").map((d) => ({
                  label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
                  value: d.amount,
                  color: "#10b981",
                }))}
          />
        </ChartCard>
        <ChartCard title="Monthly revenue" subtitle="Last 6 months">
          <AnimatedBarChart
            chartId="pharmacy-monthly-revenue"
            points={arr<{ month: string; amount: number }>("monthlyRevenue").map((d) => ({
              label: d.month,
              value: d.amount,
              color: "#0ea5e9",
            }))}
          />
        </ChartCard>
        <ChartCard title="Payment mix">
          <AnimatedDonutChart chartId="pharmacy-payments" segments={paymentSegments} />
        </ChartCard>
        <ChartCard title="Stock health">
          <AnimatedDonutChart chartId="pharmacy-stock" segments={stockSegments} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top selling medicines">
          <ul className="space-y-2 text-sm">
            {arr<{ name: string; qty: number; revenue: number }>("topMedicines").map((x) => (
              <li key={x.name} className="flex justify-between gap-2 border-b border-slate-100 pb-1 dark:border-slate-800">
                <span>{x.name}</span>
                <span className="text-slate-500">
                  {x.qty} · {formatPkr(x.revenue)}
                </span>
              </li>
            ))}
            {!arr("topMedicines").length ? <li className="text-slate-500">No sales yet</li> : null}
          </ul>
        </ChartCard>
        <ChartCard title="Slow moving medicines">
          <ul className="space-y-2 text-sm">
            {arr<{ name: string; qty: number; revenue: number }>("slowMovingMedicines").map((x) => (
              <li key={x.name} className="flex justify-between gap-2 border-b border-slate-100 pb-1 dark:border-slate-800">
                <span>{x.name}</span>
                <span className="text-slate-500">
                  {x.qty} · {formatPkr(x.revenue)}
                </span>
              </li>
            ))}
            {!arr("slowMovingMedicines").length ? <li className="text-slate-500">No data</li> : null}
          </ul>
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(
          [
            ["Recent sales", "recentSales"],
            ["Recent purchases", "recentPurchases"],
            ["Recent payments", "recentPayments"],
            ["Recent receipts", "recentReceipts"],
            ["Recent activities", "recentActivities"],
          ] as const
        ).map(([title, key]) => (
          <ChartCard key={key} title={title}>
            <ul className="max-h-48 space-y-2 overflow-auto text-sm">
              {arr<{ label: string; amount?: number; at?: string }>(key).map((row, i) => (
                <li key={`${key}-${i}`} className="flex justify-between gap-2">
                  <span className="truncate">{row.label}</span>
                  <span className="shrink-0 text-slate-500">
                    {row.amount != null ? formatPkr(row.amount) : row.at?.slice(0, 16) ?? ""}
                  </span>
                </li>
              ))}
              {!arr(key).length ? <li className="text-slate-500">None</li> : null}
            </ul>
          </ChartCard>
        ))}
        <ChartCard title="Alerts">
          <ul className="max-h-48 space-y-2 overflow-auto text-sm">
            {arr<{ severity: string; message: string }>("alerts")
              .slice(0, 12)
              .map((a, i) => (
                <li key={i} className={a.severity === "danger" ? "text-red-500" : a.severity === "warning" ? "text-amber-600" : "text-slate-600"}>
                  {a.message}
                </li>
              ))}
            {!arr("alerts").length ? <li className="text-slate-500">No alerts</li> : null}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}
