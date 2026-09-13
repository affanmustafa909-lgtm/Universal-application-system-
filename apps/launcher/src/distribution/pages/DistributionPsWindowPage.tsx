import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchDashboardActionCenter,
  fetchDashboardCompanyPerformance,
  fetchDashboardDeliveries,
  fetchDashboardFieldForce,
  fetchDashboardRecovery,
  fetchDashboardSalesmen,
  fetchDashboardSalesTrend,
  fetchDashboardStockHealth,
  fetchDashboardSummary,
  fetchDashboardTopCustomers,
  fetchDashboardTopProducts,
  fetchPharmacyCompanies,
  fetchPharmacyEmployeesPicker,
  fetchPharmacyWarehouses,
  type DistMetricComparison,
} from "../../pharmacy/api/pharmacy-erp";
import { usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPsFilterBar } from "../components/DistPsFilterBar";
import { DistSalesTrendChart } from "../components/DistSalesTrendChart";
import { DistWidgetSection } from "../components/DistWidgetSection";
import {
  agingBucketLabel,
  clearDashboardFilters,
  dashboardFilterKey,
  formatMetricDelta,
  formatPkr,
  parseDashboardFilters,
  toApiParams,
  writeDashboardFilters,
  type DistDashboardUrlFilters,
} from "../lib/dashboardFilters";
import {
  DistEmptyState,
  DistKpiCard,
  DistPageShell,
  DistPanel,
  distBtnPrimaryClass,
  distBtnSecondaryClass,
} from "../ui/DistUi";

const QUICK = [
  { to: "/pops/distribution/orders", label: "Sale Window", hint: "Book · FEFO · credit" },
  { to: "/pops/distribution/invoices", label: "Invoices", hint: "Wholesale register" },
  { to: "/pops/distribution/aging", label: "Aging", hint: "Recovery" },
  { to: "/pops/distribution/deliveries", label: "Deliveries", hint: "POD" },
  { to: "/pops/distribution/collections", label: "Collections", hint: "Cash / bank" },
  { to: "/pops/distribution/finance", label: "Finance", hint: "Cash · AR · AP · GL" },
  { to: "/pops/distribution/expiry", label: "Expiry", hint: "Batch risk" },
  { to: "/pops/distribution/purchase-orders", label: "Purchase orders", hint: "Inbound" },
  { to: "/pops/distribution/reports", label: "Reports", hint: "Live center" },
] as const;

const DASHBOARD_ROOT = ["distribution", "dashboard"] as const;
const WIDGET_STALE = 50_000;

function actionTone(severity: "CRITICAL" | "WARNING" | "INFO"): string {
  if (severity === "CRITICAL")
    return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200";
  if (severity === "WARNING")
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100";
  return "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100";
}

function moneyTone(m?: DistMetricComparison): "default" | "success" | "warning" | "danger" {
  if (!m) return "default";
  if (m.pct == null) return "default";
  if (m.pct > 0) return "success";
  if (m.pct < 0) return "danger";
  return "default";
}

function RankLinkTable({
  empty,
  rows,
}: {
  empty: string;
  rows: { key: string; primary: string; secondary?: string; value: string; to?: string }[];
}): JSX.Element {
  if (rows.length === 0) return <DistEmptyState title={empty} />;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.map((r, i) => (
        <li key={r.key} className="flex items-center gap-3 py-2 text-sm">
          <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
          <div className="min-w-0 flex-1">
            {r.to ? (
              <Link to={r.to} className="truncate font-medium text-cyan-700 hover:underline dark:text-cyan-400">
                {r.primary}
              </Link>
            ) : (
              <div className="truncate font-medium text-slate-900 dark:text-slate-100">{r.primary}</div>
            )}
            {r.secondary ? <div className="truncate text-[11px] text-slate-500">{r.secondary}</div> : null}
          </div>
          <div className="shrink-0 tabular-nums text-slate-700 dark:text-slate-200">{r.value}</div>
        </li>
      ))}
    </ul>
  );
}

export function DistributionPsWindowPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const filters = useMemo(() => parseDashboardFilters(searchParams), [searchParams]);
  const filterKey = useMemo(
    () => dashboardFilterKey(filters, branch?.code),
    [filters, branch?.code],
  );
  const apiParams = useMemo(() => toApiParams(filters, branch?.code), [filters, branch?.code]);
  const enabled = Boolean(branch?.code);

  const applyFilters = (next: DistDashboardUrlFilters) => {
    setSearchParams(writeDashboardFilters(searchParams, next), { replace: true });
  };

  const clearFilters = () => {
    setSearchParams(clearDashboardFilters(searchParams), { replace: true });
  };

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: [...DASHBOARD_ROOT] });
  };

  const warehousesQ = useQuery({
    queryKey: ["pharmacy", "warehouses", branch?.code],
    queryFn: () => fetchPharmacyWarehouses(branch!.code),
    enabled,
    staleTime: 120_000,
  });
  const companiesQ = useQuery({
    queryKey: ["pharmacy", "companies"],
    queryFn: () => fetchPharmacyCompanies(),
    staleTime: 120_000,
  });
  const salesmenQ = useQuery({
    queryKey: ["pharmacy", "employees-picker"],
    queryFn: () => fetchPharmacyEmployeesPicker(),
    staleTime: 120_000,
  });

  const summaryQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "summary", ...filterKey],
    queryFn: () => fetchDashboardSummary(apiParams),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const trendQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "sales-trend", ...filterKey],
    queryFn: () => fetchDashboardSalesTrend(apiParams),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const actionsQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "action-center", ...filterKey],
    queryFn: () => fetchDashboardActionCenter(apiParams),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const stockQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "stock-health", ...filterKey],
    queryFn: () => fetchDashboardStockHealth(apiParams),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const recoveryQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "recovery", ...filterKey],
    queryFn: () => fetchDashboardRecovery(apiParams),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const deliveriesQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "deliveries", ...filterKey],
    queryFn: () => fetchDashboardDeliveries(apiParams),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const topProductsQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "top-products", ...filterKey],
    queryFn: () => fetchDashboardTopProducts({ ...apiParams, limit: 10 }),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const topCustomersQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "top-customers", ...filterKey],
    queryFn: () => fetchDashboardTopCustomers({ ...apiParams, limit: 10 }),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const companiesPerfQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "company-performance", ...filterKey],
    queryFn: () => fetchDashboardCompanyPerformance(apiParams),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const salesmenPerfQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "salesmen", ...filterKey],
    queryFn: () => fetchDashboardSalesmen(apiParams),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const fieldQ = useQuery({
    queryKey: [...DASHBOARD_ROOT, "field-force", ...filterKey],
    queryFn: () => fetchDashboardFieldForce(apiParams),
    enabled,
    staleTime: WIDGET_STALE,
    refetchOnWindowFocus: false,
  });

  const s = summaryQ.data;
  const lastUpdated = s?.generatedAt
    ? new Date(s.generatedAt).toLocaleString()
    : null;

  const warehouseOptions = (warehousesQ.data ?? []).map((w: { id: string; name?: string; code?: string }) => ({
    id: w.id,
    label: w.name ?? w.code ?? w.id,
  }));
  const companyOptions = (companiesQ.data ?? []).map((c: { id: string; name?: string; code?: string }) => ({
    id: c.id,
    label: c.code ? `${c.name ?? c.id} (${c.code})` : (c.name ?? c.id),
  }));
  const salesmanOptions = (salesmenQ.data ?? []).map((e) => ({
    id: e.id,
    label: e.employeeCode ? `${e.name} (${e.employeeCode})` : e.name,
  }));

  return (
    <DistPageShell
      title="PS Window"
      subtitle="Distribution command center — filtered KPIs, action queue, and live rankings."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "PS Window" },
      ]}
      actions={
        <>
          {lastUpdated ? (
            <span className="hidden text-xs tabular-nums text-slate-500 sm:inline">
              Last updated {lastUpdated}
            </span>
          ) : null}
          <button type="button" className={distBtnSecondaryClass} onClick={refreshAll}>
            Refresh
          </button>
          <Link to="/pops/distribution/orders" className={distBtnPrimaryClass}>
            Open Sale Window
          </Link>
        </>
      }
    >
      <DistPsFilterBar
        value={filters}
        onApply={applyFilters}
        onClear={clearFilters}
        warehouses={warehouseOptions}
        companies={companyOptions}
        salesmen={salesmanOptions}
      />

      {!enabled ? (
        <DistEmptyState title="Select a branch" description="Branch context is required for dashboard data." />
      ) : (
        <>
          <DistPanel title="Quick scenes" subtitle="Jump into daily ops">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK.map((item) => (
          <Link
            key={item.to}
            to={item.to}
                  className="rounded-lg border border-slate-200 bg-white p-3 transition hover:border-cyan-500 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-cyan-600"
          >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{item.hint}</div>
          </Link>
        ))}
      </div>
          </DistPanel>

          <DistWidgetSection
            title="Summary KPIs"
            subtitle="Sales · collections · inventory · operations · field"
            isLoading={summaryQ.isLoading && !s}
            isError={summaryQ.isError}
            error={summaryQ.error}
            onRetry={() => void summaryQ.refetch()}
            action={
              lastUpdated ? (
                <span className="text-xs tabular-nums text-slate-500 sm:hidden">Updated {lastUpdated}</span>
              ) : undefined
            }
          >
            {s ? (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sales</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                    <DistKpiCard
                      label="Gross sales"
                      value={formatPkr(s.sales.gross.current)}
                      delta={formatMetricDelta(s.sales.gross)}
                      tone={moneyTone(s.sales.gross)}
                      to="/pops/distribution/orders"
                    />
                    <DistKpiCard
                      label="Net sales"
                      value={formatPkr(s.sales.net.current)}
                      delta={formatMetricDelta(s.sales.net)}
                      tone={moneyTone(s.sales.net)}
                      to="/pops/distribution/invoices"
                    />
                    <DistKpiCard
                      label="Cash sales"
                      value={formatPkr(s.sales.cash.current)}
                      delta={formatMetricDelta(s.sales.cash)}
                      to="/pops/distribution/invoices"
                    />
                    <DistKpiCard
                      label="Credit sales"
                      value={formatPkr(s.sales.credit.current)}
                      delta={formatMetricDelta(s.sales.credit)}
                      to="/pops/distribution/invoices"
                    />
                    <DistKpiCard
                      label="Returns"
                      value={formatPkr(s.sales.returns.current)}
                      delta={formatMetricDelta(s.sales.returns)}
                      tone={(s.sales.returns.current ?? 0) > 0 ? "warning" : "default"}
                      to="/pops/distribution/wholesale-returns"
                    />
        <DistKpiCard
                      label="Orders"
                      value={s.sales.orders.current}
                      delta={formatMetricDelta(s.sales.orders)}
          to="/pops/distribution/orders"
        />
                    <DistKpiCard
                      label="Invoices"
                      value={s.sales.invoices.current}
                      delta={formatMetricDelta(s.sales.invoices)}
                      to="/pops/distribution/invoices"
                    />
                    <DistKpiCard
                      label="AOV"
                      value={formatPkr(s.sales.aov.current)}
                      delta={formatMetricDelta(s.sales.aov)}
                      to="/pops/distribution/reports"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Collections
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                    <DistKpiCard
                      label="Collections (period)"
                      value={formatPkr(s.collections.period.current)}
                      delta={formatMetricDelta(s.collections.period)}
                      tone="success"
                      to="/pops/distribution/collections"
                    />
                    <DistKpiCard
                      label="Collections (month)"
                      value={formatPkr(s.collections.month)}
                      to="/pops/distribution/collections"
                    />
        <DistKpiCard
          label="Outstanding"
                      value={formatPkr(s.collections.outstanding)}
                      tone={s.collections.outstanding > 0 ? "warning" : "default"}
                      to="/pops/distribution/aging"
                    />
                    <DistKpiCard
                      label="Overdue"
                      value={formatPkr(s.collections.overdue)}
                      hint={`${s.collections.overdueCustomers} customers`}
                      tone={s.collections.overdue > 0 ? "danger" : "default"}
                      to="/pops/distribution/aging?focus=overdue"
                    />
                    <DistKpiCard
                      label="Collection achievement"
                      value={
                        s.collections.achievementPct.current == null
                          ? "N/A"
                          : `${s.collections.achievementPct.current}%`
                      }
                      delta={
                        s.collections.achievementPct.pct == null
                          ? "vs prior: N/A"
                          : `vs prior: ${s.collections.achievementPct.pct > 0 ? "+" : ""}${s.collections.achievementPct.pct}%`
                      }
                      to="/pops/distribution/collections"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Profitability
                  </h3>
                  {s.profitability.reliable ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <DistKpiCard
                        label="Gross profit"
                        value={formatPkr(s.profitability.grossProfit)}
                        tone={s.profitability.grossProfit >= 0 ? "success" : "danger"}
                        to="/pops/distribution/reports"
                      />
                      <DistKpiCard
                        label="Margin"
                        value={`${s.profitability.marginPct}%`}
                        to="/pops/distribution/reports"
                      />
                      <DistKpiCard
                        label="COGS"
                        value={formatPkr(s.profitability.cogs)}
                        to="/pops/distribution/reports"
                      />
                      <DistKpiCard
                        label="Cost coverage"
                        value={`${s.profitability.coveragePct}%`}
                        hint="Lines with known batch/cost"
                        to="/pops/distribution/reports"
                      />
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                      {s.profitability.reason ??
                        `Profit figures hidden — cost coverage ${s.profitability.coveragePct}% is below the reliability threshold.`}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Inventory & operations
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                    <DistKpiCard
                      label="Low stock"
                      value={s.inventory.lowStockSkus}
                      tone={s.inventory.lowStockSkus > 0 ? "warning" : "default"}
                      to="/pops/distribution/inventory?focus=lowStock"
                    />
                    <DistKpiCard
                      label="Near expiry (7d)"
                      value={s.inventory.nearExpiry7}
                      tone={s.inventory.nearExpiry7 > 0 ? "warning" : "default"}
                      to="/pops/distribution/expiry?focus=near"
                    />
                    <DistKpiCard
                      label="Near expiry (30d)"
                      value={s.inventory.nearExpiry30}
                      tone={s.inventory.nearExpiry30 > 0 ? "warning" : "default"}
                      to="/pops/distribution/expiry?focus=near"
                    />
                    <DistKpiCard
                      label="Expired batches"
                      value={s.inventory.expiredBatches}
                      tone={s.inventory.expiredBatches > 0 ? "danger" : "default"}
                      to="/pops/distribution/expiry?focus=expired"
                    />
                    <DistKpiCard
                      label="Stock value"
                      value={formatPkr(s.inventory.stockValuePkr)}
                      to="/pops/distribution/inventory"
                    />
                    <DistKpiCard
                      label="Pending orders"
                      value={s.operations.pendingOrders}
                      to="/pops/distribution/orders?focus=pending"
                    />
                    <DistKpiCard
                      label="Pending approval"
                      value={s.operations.pendingApproval}
                      tone={s.operations.pendingApproval > 0 ? "warning" : "default"}
                      to="/pops/distribution/orders?focus=pendingApproval"
                    />
                    <DistKpiCard
                      label="Pending deliveries"
                      value={s.operations.pendingDeliveries}
                      to="/pops/distribution/deliveries?focus=pending"
                    />
                    <DistKpiCard
                      label="Pending POs"
                      value={s.operations.pendingPurchaseOrders}
                      to="/pops/distribution/purchase-orders?focus=pending"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Field</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DistKpiCard
                      label="Planned visits"
                      value={s.field.planned}
                      to="/pops/distribution/visits"
                    />
                    <DistKpiCard
                      label="Completed"
                      value={s.field.completed}
                      tone="success"
                      to="/pops/distribution/visits"
                    />
                    <DistKpiCard
                      label="Missed"
                      value={s.field.missed}
                      tone={s.field.missed > 0 ? "warning" : "default"}
                      to="/pops/distribution/visits"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </DistWidgetSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <DistWidgetSection
              title="Sales trend"
              subtitle="Daily net sales for the selected period"
              isLoading={trendQ.isLoading && !trendQ.data}
              isError={trendQ.isError}
              error={trendQ.error}
              onRetry={() => void trendQ.refetch()}
              isEmpty={!trendQ.isLoading && (trendQ.data?.points.length ?? 0) === 0}
              emptyTitle="No trend points"
            >
              <DistSalesTrendChart points={trendQ.data?.points ?? []} />
            </DistWidgetSection>

            <DistWidgetSection
              title="Action center"
              subtitle="Needs attention — click to open"
              isLoading={actionsQ.isLoading && !actionsQ.data}
              isError={actionsQ.isError}
              error={actionsQ.error}
              onRetry={() => void actionsQ.refetch()}
              isEmpty={!actionsQ.isLoading && (actionsQ.data?.items.length ?? 0) === 0}
              emptyTitle="All clear"
              emptyDescription="No pending approvals, stock risks, or overdue queues."
              action={
                <span className="text-xs tabular-nums text-slate-500">
                  {actionsQ.data?.items.length ?? 0} open
                </span>
              }
            >
              <div className="space-y-3">
                {(["CRITICAL", "WARNING", "INFO"] as const).map((sev) => {
                  const group = actionsQ.data?.groups[sev] ?? [];
                  if (group.length === 0) return null;
                  return (
                    <div key={sev}>
                      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {sev}
                      </h3>
                      <ul className="space-y-2">
                        {group.map((a) => (
                          <li key={a.id}>
                            <Link
                              to={a.href}
                              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm font-medium transition hover:opacity-90 ${actionTone(a.severity)}`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate">{a.title}</span>
                                <span className="block truncate text-[11px] font-normal opacity-80">
                                  {a.description}
                                </span>
                              </span>
                              <span className="tabular-nums">{a.count}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </DistWidgetSection>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DistWidgetSection
              title="Stock health"
              subtitle="SKU coverage and expiry buckets"
              isLoading={stockQ.isLoading && !stockQ.data}
              isError={stockQ.isError}
              error={stockQ.error}
              onRetry={() => void stockQ.refetch()}
            >
              {stockQ.data ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DistKpiCard label="Active SKUs" value={stockQ.data.skuCount} to="/pops/distribution/inventory" />
                    <DistKpiCard
                      label="Stock value"
                      value={formatPkr(stockQ.data.stockValuePkr)}
                      to="/pops/distribution/inventory"
                    />
                    <DistKpiCard
                      label="Low stock"
                      value={stockQ.data.lowStockSkus}
                      tone={stockQ.data.lowStockSkus > 0 ? "warning" : "default"}
                      to="/pops/distribution/inventory?focus=lowStock"
                    />
                    <DistKpiCard
                      label="Out of stock"
                      value={stockQ.data.outOfStockSkus}
                      tone={stockQ.data.outOfStockSkus > 0 ? "danger" : "default"}
                      to="/pops/distribution/inventory?focus=out"
                    />
                    <DistKpiCard
                      label="Expired value"
                      value={formatPkr(stockQ.data.expiry.expiredValuePkr)}
                      tone={stockQ.data.expiry.expiredValuePkr > 0 ? "danger" : "default"}
                      to="/pops/distribution/expiry?focus=expired"
                    />
                    <DistKpiCard
                      label="Near-expiry value"
                      value={formatPkr(stockQ.data.expiry.nearExpiryValuePkr)}
                      tone={stockQ.data.expiry.nearExpiryValuePkr > 0 ? "warning" : "default"}
                      to="/pops/distribution/expiry?focus=near"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {(
                      [
                        ["Expired", stockQ.data.expiry.expired, "expired"],
                        ["0–7d", stockQ.data.expiry.d0to7, "near"],
                        ["8–30d", stockQ.data.expiry.d8to30, "near"],
                        ["31–60d", stockQ.data.expiry.d31to60, "near"],
                        ["61–90d", stockQ.data.expiry.d61to90, "near"],
                      ] as const
                    ).map(([label, count, focus]) => (
                      <Link
                        key={label}
                        to={`/pops/distribution/expiry?focus=${focus}`}
                        className="rounded-md border border-slate-100 px-2 py-2 text-center text-xs hover:border-cyan-400 dark:border-slate-800"
                      >
                        <div className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{count}</div>
                        <div className="text-slate-500">{label}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </DistWidgetSection>

            <DistWidgetSection
              title="Recovery / aging"
              subtitle="Open dues by invoice age"
              isLoading={recoveryQ.isLoading && !recoveryQ.data}
              isError={recoveryQ.isError}
              error={recoveryQ.error}
              onRetry={() => void recoveryQ.refetch()}
              action={
                <Link to="/pops/distribution/aging" className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                  Open aging →
                </Link>
              }
            >
              {recoveryQ.data ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DistKpiCard
                      label="Collected today"
                      value={formatPkr(recoveryQ.data.collectionToday)}
                      tone="success"
                      to="/pops/distribution/collections"
                    />
                    <DistKpiCard
                      label="Collected month"
                      value={formatPkr(recoveryQ.data.collectionMonth)}
                      to="/pops/distribution/collections"
                    />
                    <DistKpiCard
                      label="Overdue amount"
                      value={formatPkr(recoveryQ.data.overdueAmount)}
                      tone={recoveryQ.data.overdueAmount > 0 ? "danger" : "default"}
                      to="/pops/distribution/aging?focus=overdue"
                    />
                    <DistKpiCard
                      label="Overdue customers"
                      value={recoveryQ.data.overdueCustomers}
                      tone={recoveryQ.data.overdueCustomers > 0 ? "warning" : "default"}
                      to="/pops/distribution/aging?focus=overdue"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {recoveryQ.data.aging.map((b) => (
                      <DistKpiCard
                        key={b.bucket}
                        label={agingBucketLabel(b.bucket)}
                        value={formatPkr(b.amount)}
                        hint={`${b.customers} customers`}
                        tone={
                          b.bucket === "d120_plus"
                            ? "danger"
                            : b.bucket === "d61_90" || b.bucket === "d91_120"
                              ? "warning"
                              : "default"
                        }
                        to="/pops/distribution/aging"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </DistWidgetSection>
          </div>

          <DistWidgetSection
            title="Delivery status"
            subtitle="Deliveries in the selected period"
            isLoading={deliveriesQ.isLoading && !deliveriesQ.data}
            isError={deliveriesQ.isError}
            error={deliveriesQ.error}
            onRetry={() => void deliveriesQ.refetch()}
            isEmpty={!deliveriesQ.isLoading && (deliveriesQ.data?.total ?? 0) === 0}
            emptyTitle="No deliveries in period"
            action={
              <Link
                to="/pops/distribution/deliveries"
                className="text-xs font-semibold text-cyan-700 dark:text-cyan-400"
              >
                Open deliveries →
              </Link>
            }
          >
            {deliveriesQ.data ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DistKpiCard
                    label="Total deliveries"
                    value={deliveriesQ.data.total}
                    to="/pops/distribution/deliveries"
                  />
                  <DistKpiCard
                    label="Collected on delivery"
                    value={formatPkr(deliveriesQ.data.collectedPkr)}
                    tone="success"
          to="/pops/distribution/collections"
        />
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {deliveriesQ.data.byStatus.map((row) => (
                    <Link
                      key={row.status}
                      to={`/pops/distribution/deliveries?focus=${encodeURIComponent(row.status)}`}
                      className="rounded-md border border-slate-100 px-3 py-2 text-sm hover:border-cyan-400 dark:border-slate-800"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {String(row.status ?? "—").replace(/_/g, " ")}
                      </div>
                      <div className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {row.count}
                      </div>
                      <div className="text-xs text-slate-500">{formatPkr(row.collectedPkr)}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </DistWidgetSection>

          <DistPanel title="Rankings" subtitle="Independent widgets — period filters apply">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Top products
                </h3>
                {topProductsQ.isError ? (
                  <DistWidgetInlineError
                    error={topProductsQ.error}
                    onRetry={() => void topProductsQ.refetch()}
                  />
                ) : topProductsQ.isLoading && !topProductsQ.data ? (
                  <p className="py-6 text-center text-xs text-slate-400">Loading…</p>
                ) : (
                  <RankLinkTable
                    empty="No product sales in period"
                    rows={(topProductsQ.data?.items ?? []).map((r) => ({
                      key: r.medicineId,
                      primary: r.name,
                      secondary: r.sku ?? undefined,
                      value: formatPkr(r.netSales),
                      to: r.href || `/pops/pharmacy/medicines?focus=${r.medicineId}`,
                    }))}
                  />
                )}
              </div>

              <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Top customers
                </h3>
                {topCustomersQ.isError ? (
                  <DistWidgetInlineError
                    error={topCustomersQ.error}
                    onRetry={() => void topCustomersQ.refetch()}
                  />
                ) : topCustomersQ.isLoading && !topCustomersQ.data ? (
                  <p className="py-6 text-center text-xs text-slate-400">Loading…</p>
                ) : (
                  <RankLinkTable
                    empty="No customer sales in period"
                    rows={(topCustomersQ.data?.items ?? []).map((r) => ({
                      key: r.tradeCustomerId,
                      primary: r.name,
                      secondary: r.code ? `${r.code}${r.overdue ? " · overdue" : ""}` : r.overdue ? "Overdue" : undefined,
                      value: formatPkr(r.net),
                      to: r.href || `/pops/distribution/trade-customers?focus=${r.tradeCustomerId}`,
                    }))}
                  />
                )}
              </div>

              <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Top companies
                </h3>
                {companiesPerfQ.isError ? (
                  <DistWidgetInlineError
                    error={companiesPerfQ.error}
                    onRetry={() => void companiesPerfQ.refetch()}
                  />
                ) : companiesPerfQ.isLoading && !companiesPerfQ.data ? (
                  <p className="py-6 text-center text-xs text-slate-400">Loading…</p>
                ) : (
                  <RankLinkTable
                    empty="No company sales in period"
                    rows={(companiesPerfQ.data?.items ?? []).map((r) => ({
                      key: r.companyId,
                      primary: r.name,
                      secondary: r.code ?? `${r.invoices} inv`,
                      value: formatPkr(r.netSales),
                      to: r.href,
                    }))}
                  />
                )}
              </div>

              <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Salesmen
                </h3>
                {salesmenPerfQ.isError ? (
                  <DistWidgetInlineError
                    error={salesmenPerfQ.error}
                    onRetry={() => void salesmenPerfQ.refetch()}
                  />
                ) : salesmenPerfQ.isLoading && !salesmenPerfQ.data ? (
                  <p className="py-6 text-center text-xs text-slate-400">Loading…</p>
                ) : (
                  <RankLinkTable
                    empty="No salesman-linked sales"
                    rows={(salesmenPerfQ.data?.items ?? []).map((r) => ({
                      key: r.employeeId,
                      primary: r.name,
                      secondary: `Ach ${r.achievementPct == null ? "N/A" : `${r.achievementPct}%`} · ${r.invoices} inv`,
                      value: formatPkr(r.sales),
                    }))}
                  />
                )}
              </div>

              <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800 lg:col-span-2 xl:col-span-1">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Field force
                </h3>
                {fieldQ.isError ? (
                  <DistWidgetInlineError error={fieldQ.error} onRetry={() => void fieldQ.refetch()} />
                ) : fieldQ.isLoading && !fieldQ.data ? (
                  <p className="py-6 text-center text-xs text-slate-400">Loading…</p>
                ) : (
                  <>
                    {fieldQ.data ? (
                      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-md bg-slate-50 py-2 dark:bg-slate-900/50">
                          <div className="font-semibold tabular-nums">{fieldQ.data.summary.planned}</div>
                          <div className="text-slate-500">Planned</div>
                        </div>
                        <div className="rounded-md bg-slate-50 py-2 dark:bg-slate-900/50">
                          <div className="font-semibold tabular-nums">{fieldQ.data.summary.completed}</div>
                          <div className="text-slate-500">Done</div>
                        </div>
                        <div className="rounded-md bg-slate-50 py-2 dark:bg-slate-900/50">
                          <div className="font-semibold tabular-nums">{fieldQ.data.summary.missed}</div>
                          <div className="text-slate-500">Missed</div>
                        </div>
                      </div>
                    ) : null}
                    <RankLinkTable
                      empty="No field assignments in period"
                      rows={(fieldQ.data?.salesmen ?? []).map((r) => ({
                        key: r.employeeId,
                        primary: r.name,
                        secondary: `${r.visited}/${r.planned} visits · ${r.orders} orders`,
                        value: formatPkr(r.sales),
                      }))}
                    />
                  </>
                )}
              </div>
      </div>
          </DistPanel>
        </>
      )}
    </DistPageShell>
  );
}

function DistWidgetInlineError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div className="space-y-2 py-2">
      <p className="text-xs text-red-600 dark:text-red-300">{(error as Error)?.message || "Failed"}</p>
      <button type="button" className={distBtnSecondaryClass} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
