import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { achievementLabel, fieldForceApi } from "../../pharmacy/api/pharmacy-field-force";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistWidgetSection } from "../components/DistWidgetSection";
import { DistButton, DistKpiCard, DistPageShell } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionFieldForceDashboardPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [sp] = useSearchParams();
  const date = sp.get("date") ?? new Date().toISOString().slice(0, 10);
  const employeeId = sp.get("salesman") ?? undefined;

  const dash = useQuery({
    queryKey: ["distribution", "field-force", "dashboard", branch?.code, date, employeeId],
    enabled: Boolean(branch?.code),
    queryFn: () => fieldForceApi.dashboard({ branchCode: branch!.code, date, employeeId }),
  });
  const k = dash.data?.kpis;

  return (
    <DistPageShell
      title="Field Force"
      subtitle="Today's PJP, visits, sales, collections, and achievement."
      breadcrumb={[{ label: "Distribution", to: `${DIST}/ps` }, { label: "Field Force" }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/visits?date=${date}`}>
            <DistButton>Today's visits</DistButton>
          </Link>
          <Link to={`${DIST}/pjp`}>
            <DistButton variant="secondary">PJP</DistButton>
          </Link>
        </div>
      }
      error={!branch ? "Select a branch to load field force." : null}
    >
      <DistWidgetSection
        title="Today"
        subtitle={date}
        isLoading={dash.isLoading}
        isError={dash.isError}
        error={dash.error}
        onRetry={() => void dash.refetch()}
        isEmpty={!dash.isLoading && !k}
        emptyTitle="No field-force data"
      >
        {k ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DistKpiCard label="Active salesmen" value={k.activeSalesmen} to={`${DIST}/sales-force`} />
            <DistKpiCard label="Planned visits" value={k.plannedVisits} to={`${DIST}/visits?date=${date}`} />
            <DistKpiCard
              label="Completed"
              value={k.completedVisits}
              tone="success"
              to={`${DIST}/visits?date=${date}&status=completed`}
            />
            <DistKpiCard
              label="Missed"
              value={k.missedVisits}
              tone={k.missedVisits > 0 ? "danger" : "default"}
              to={`${DIST}/visits?date=${date}&status=missed`}
            />
            <DistKpiCard label="In progress" value={k.inProgress} to={`${DIST}/visits?date=${date}&status=started`} />
            <DistKpiCard label="Orders" value={k.orders} to={`${DIST}/orders`} />
            <DistKpiCard label="Sales" value={formatPkr(k.salesPkr)} to={`${DIST}/invoices`} />
            <DistKpiCard label="Collections" value={formatPkr(k.collectionsPkr)} to={`${DIST}/collections`} />
            <DistKpiCard label="Visit achievement" value={achievementLabel(k.visitAchievementPct)} />
            <DistKpiCard label="Sales achievement" value={achievementLabel(k.salesAchievementPct)} />
            <DistKpiCard label="Collection achievement" value={achievementLabel(k.collectionAchievementPct)} />
          </div>
        ) : null}
      </DistWidgetSection>

      {dash.data?.alerts?.length ? (
        <DistWidgetSection title="Action center" subtitle="Click through to the filtered list" isLoading={false} isError={false} onRetry={() => undefined}>
          <div className="grid gap-3 sm:grid-cols-3">
            {dash.data.alerts.map((a) => (
              <DistKpiCard
                key={a.title}
                label={a.title}
                value={a.count}
                tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "default"}
                to={a.to}
              />
            ))}
          </div>
        </DistWidgetSection>
      ) : null}
    </DistPageShell>
  );
}
