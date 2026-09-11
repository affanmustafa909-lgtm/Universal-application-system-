import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { achievementLabel, fieldForceApi } from "../../pharmacy/api/pharmacy-field-force";
import { formatPkr } from "../../pharmacy/hooks/usePharmacy";
import { DistDataTable, DistKpiCard, DistPageShell, DistStatusBadge } from "../ui/DistUi";

const DIST = "/pops/distribution";
const TABS = ["overview", "customers", "pjp", "visits", "targets"] as const;

export function DistributionSalesmanDetailPage(): JSX.Element {
  const { employeeId = "" } = useParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("overview");
  const today = new Date().toISOString().slice(0, 10);

  const profile = useQuery({
    queryKey: ["distribution", "field-force", "salesman", employeeId],
    enabled: Boolean(employeeId),
    queryFn: () => fieldForceApi.salesman(employeeId),
  });
  const dash = useQuery({
    queryKey: ["distribution", "field-force", "dash", employeeId, today],
    enabled: Boolean(employeeId),
    queryFn: () => fieldForceApi.dashboard({ employeeId, date: today }),
  });
  const customers = useQuery({
    queryKey: ["distribution", "field-force", "sm-cust", employeeId],
    enabled: tab === "customers" && Boolean(employeeId),
    queryFn: () => fieldForceApi.salesmanCustomers(employeeId),
  });
  const visits = useQuery({
    queryKey: ["distribution", "field-force", "sm-vis", employeeId],
    enabled: tab === "visits" && Boolean(employeeId),
    queryFn: () => fieldForceApi.visits({ employeeId, page: 1, pageSize: 25 }),
  });
  const pjp = useQuery({
    queryKey: ["distribution", "field-force", "sm-pjp", employeeId],
    enabled: tab === "pjp" && Boolean(employeeId),
    queryFn: () => fieldForceApi.pjp({ employeeId }),
  });
  const targets = useQuery({
    queryKey: ["distribution", "field-force", "sm-tgt", employeeId],
    enabled: tab === "targets" && Boolean(employeeId),
    queryFn: () => fieldForceApi.targets({ employeeId }),
  });

  const p = profile.data ?? {};
  const k = dash.data?.kpis;

  return (
    <DistPageShell
      title={String(p.employeeName ?? "Salesman")}
      subtitle={`${String(p.employeeCode ?? "")} · ${String(p.fieldRole ?? "Salesman")}`}
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Salesmen", to: `${DIST}/sales-force` },
        { label: String(p.employeeName ?? "Detail") },
      ]}
    >
      <div className="flex flex-wrap items-center gap-2">
        <DistStatusBadge status={String(p.status ?? "active")} />
        <span className="text-sm text-slate-500">{String(p.territoryName ?? "No territory")}</span>
        <Link className="text-sm font-semibold text-cyan-700" to={`${DIST}/visits?salesman=${employeeId}&date=${today}`}>
          Today's visits
        </Link>
      </div>
      {k ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DistKpiCard label="Planned today" value={k.plannedVisits} />
          <DistKpiCard label="Completed" value={k.completedVisits} tone="success" />
          <DistKpiCard label="Missed" value={k.missedVisits} tone={k.missedVisits ? "danger" : "default"} />
          <DistKpiCard label="Visit %" value={achievementLabel(k.visitAchievementPct)} />
          <DistKpiCard label="Sales" value={formatPkr(k.salesPkr)} />
          <DistKpiCard label="Collections" value={formatPkr(k.collectionsPkr)} />
          <DistKpiCard label="Sales %" value={achievementLabel(k.salesAchievementPct)} />
          <DistKpiCard label="Collection %" value={achievementLabel(k.collectionAchievementPct)} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              tab === t ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Daily visit target {String(p.dailyVisitTarget ?? 0)} · Monthly sales {formatPkr(Number(p.monthlySalesTargetPkr ?? 0))} ·
          Working days {String(p.workingDays ?? "—")}
        </p>
      ) : null}
      {tab === "customers" ? (
        <DistDataTable
          loading={customers.isLoading}
          rows={(customers.data?.items ?? []) as Record<string, unknown>[]}
          rowKey={(r) => String(r.id)}
          empty="No assigned customers"
          columns={[
            { key: "code", header: "Code" },
            { key: "name", header: "Customer" },
            { key: "outstandingPkr", header: "Outstanding", render: (r) => formatPkr(Number(r.outstandingPkr ?? 0)) },
          ]}
        />
      ) : null}
      {tab === "pjp" ? (
        <DistDataTable
          loading={pjp.isLoading}
          rows={(pjp.data?.items ?? []) as Record<string, unknown>[]}
          rowKey={(r) => String(r.id)}
          empty="No PJP"
          columns={[
            { key: "pjpNumber", header: "PJP#" },
            { key: "name", header: "Name" },
            { key: "status", header: "Status" },
            { key: "version", header: "Ver" },
          ]}
        />
      ) : null}
      {tab === "visits" ? (
        <DistDataTable
          loading={visits.isLoading}
          rows={(visits.data?.items ?? []) as Record<string, unknown>[]}
          rowKey={(r) => String(r.id)}
          empty="No visits"
          columns={[
            { key: "plannedDate", header: "Date" },
            { key: "customerName", header: "Customer" },
            { key: "status", header: "Status" },
            { key: "outcome", header: "Outcome" },
          ]}
        />
      ) : null}
      {tab === "targets" ? (
        <DistDataTable
          loading={targets.isLoading}
          rows={(targets.data?.items ?? []) as Record<string, unknown>[]}
          rowKey={(r) => String(r.id)}
          empty="No targets"
          columns={[
            { key: "periodStart", header: "From" },
            { key: "periodEnd", header: "To" },
            { key: "targetSalesPkr", header: "Sales tgt", render: (r) => formatPkr(Number(r.targetSalesPkr ?? 0)) },
            { key: "salesAchievementPct", header: "%", render: (r) => achievementLabel(r.salesAchievementPct as number | null) },
          ]}
        />
      ) : null}
    </DistPageShell>
  );
}
