import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { achievementLabel, fieldForceApi } from "../../pharmacy/api/pharmacy-field-force";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDataTable, DistInput, DistPageShell, DistSelect } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionFieldPerformancePage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [sp, setSp] = useSearchParams();
  const group = (sp.get("group") as "salesman" | "territory" | "route") || "salesman";
  const from = sp.get("from") ?? new Date().toISOString().slice(0, 8) + "01";
  const to = sp.get("to") ?? new Date().toISOString().slice(0, 10);

  const perf = useQuery({
    queryKey: ["distribution", "field-force", "performance", branch?.code, group, from, to],
    queryFn: () => fieldForceApi.performance({ branchCode: branch?.code, group, from, to }),
  });
  const cov = useQuery({
    queryKey: ["distribution", "field-force", "coverage", branch?.code, from, to],
    queryFn: () => fieldForceApi.coverage({ from, to }),
  });

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp);
    next.set(k, v);
    setSp(next, { replace: true });
  };

  return (
    <DistPageShell
      title="Field performance"
      subtitle="Salesman, territory, and route achievement. Coverage uses unique customers, not duplicate visits."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Field Force", to: `${DIST}/field-force` },
        { label: "Performance" },
      ]}
    >
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800">
        <label className="text-xs text-slate-500">
          Group
          <DistSelect className="mt-1" value={group} onChange={(e) => set("group", e.target.value)}>
            <option value="salesman">Salesman</option>
            <option value="territory">Territory</option>
            <option value="route">Route</option>
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          From
          <DistInput type="date" className="mt-1" value={from} onChange={(e) => set("from", e.target.value)} />
        </label>
        <label className="text-xs text-slate-500">
          To
          <DistInput type="date" className="mt-1" value={to} onChange={(e) => set("to", e.target.value)} />
        </label>
        <p className="text-xs text-slate-500">
          Coverage {String(cov.data?.visitedCustomers ?? "—")} / {String(cov.data?.plannedCustomers ?? "—")} (
          {achievementLabel(cov.data?.coveragePct as number | null)})
        </p>
      </div>
      <DistDataTable
        loading={perf.isLoading}
        rows={(perf.data?.items ?? []) as Record<string, unknown>[]}
        rowKey={(r) => String(r.employeeId ?? r.territoryId ?? r.routeId ?? r.name)}
        empty="No performance rows"
        columns={[
          { key: "name", header: group === "salesman" ? "Salesman" : group === "territory" ? "Territory" : "Route" },
          { key: "plannedVisits", header: "Planned" },
          { key: "completedVisits", header: "Done" },
          { key: "missedVisits", header: "Missed" },
          { key: "visitAchievementPct", header: "Visit %", render: (r) => achievementLabel(r.visitAchievementPct as number | null) },
          { key: "orders", header: "Orders" },
          { key: "salesPkr", header: "Sales", render: (r) => formatPkr(Number(r.salesPkr ?? 0)) },
          { key: "salesAchievementPct", header: "Sales %", render: (r) => achievementLabel(r.salesAchievementPct as number | null) },
          { key: "collectionsPkr", header: "Collection", render: (r) => formatPkr(Number(r.collectionsPkr ?? 0)) },
          {
            key: "collectionAchievementPct",
            header: "Col %",
            render: (r) => achievementLabel(r.collectionAchievementPct as number | null),
          },
        ]}
      />
    </DistPageShell>
  );
}
