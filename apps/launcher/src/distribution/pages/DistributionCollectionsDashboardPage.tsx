import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  agingDayBucketLabel,
  collectionsApi,
} from "../../pharmacy/api/pharmacy-collections-ops";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistWidgetSection } from "../components/DistWidgetSection";
import { DistButton, DistKpiCard, DistPageShell } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionCollectionsDashboardPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;

  const dashboard = useQuery({
    queryKey: ["distribution", "collections-dashboard", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => collectionsApi.dashboard({ branchCode }),
  });

  const k = dashboard.data?.kpis;
  const aging = dashboard.data?.aging ?? [];
  const todayCount = Number(k?.todayCount ?? 0);
  const unallocatedPkr = Number(k?.unallocatedPkr ?? 0);
  const pendingCheques = Number(k?.pendingCheques ?? 0);
  const bouncedCheques = Number(k?.bouncedCheques ?? 0);

  return (
    <DistPageShell
      title="Collections dashboard"
      subtitle="Receipts today, AR aging buckets, cheques, and recovery shortcuts."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Collections" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/collections`}>
            <DistButton>Record collection</DistButton>
          </Link>
          <Link to={`${DIST}/aging`}>
            <DistButton variant="secondary">Aging</DistButton>
          </Link>
          <Link to={`${DIST}/recovery`}>
            <DistButton variant="secondary">Recovery queue</DistButton>
          </Link>
        </div>
      }
      error={!branch ? "Select a branch to load collections." : null}
    >
      <DistWidgetSection
        title="Collections KPIs"
        subtitle="Live figures from the collections API (aging strip enriched when available)."
        isLoading={dashboard.isLoading}
        isError={dashboard.isError}
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
        isEmpty={!dashboard.isLoading && !dashboard.isError && !k}
        emptyTitle="No collections data"
      >
        {k ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DistKpiCard
              label="Collected today"
              value={formatPkr(k.collectedTodayPkr)}
              hint={todayCount ? `${todayCount} receipt(s)` : undefined}
              tone="success"
              to={`${DIST}/collections`}
            />
            <DistKpiCard
              label="Collected month"
              value={formatPkr(k.collectedMonthPkr)}
              to={`${DIST}/collections`}
            />
            <DistKpiCard
              label="Open accounts"
              value={k.openAccounts}
              to={`${DIST}/aging`}
            />
            <DistKpiCard
              label="Overdue"
              value={formatPkr(k.overdueAmountPkr)}
              hint={k.overdueCustomers ? `${k.overdueCustomers} customers` : undefined}
              tone={k.overdueAmountPkr > 0 ? "warning" : "default"}
              to={`${DIST}/aging?focus=overdue`}
            />
            <DistKpiCard
              label="Credit exceeded"
              value={k.creditExceeded}
              tone={k.creditExceeded > 0 ? "danger" : "default"}
              to={`${DIST}/aging?focus=creditExceeded`}
            />
            <DistKpiCard
              label="Unallocated advances"
              value={formatPkr(unallocatedPkr)}
              tone={unallocatedPkr > 0 ? "warning" : "default"}
              to={`${DIST}/collections`}
            />
            <DistKpiCard
              label="Pending cheques"
              value={pendingCheques}
              tone={pendingCheques > 0 ? "warning" : "default"}
              to={`${DIST}/collections`}
            />
            <DistKpiCard
              label="Bounced cheques"
              value={bouncedCheques}
              tone={bouncedCheques > 0 ? "danger" : "default"}
              to={`${DIST}/recovery`}
            />
          </div>
        ) : null}
      </DistWidgetSection>

      <DistWidgetSection
        title="Aging buckets"
        subtitle="Day-based AR (invoice date + credit days)."
        isLoading={dashboard.isLoading}
        isError={false}
        onRetry={() => void dashboard.refetch()}
        isEmpty={!dashboard.isLoading && aging.length === 0}
        emptyTitle="No aging totals yet"
      >
        {aging.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {aging.map((b) => (
              <DistKpiCard
                key={String(b.bucket)}
                label={agingDayBucketLabel(String(b.bucket))}
                value={formatPkr(b.amount)}
                hint={b.customers ? `${b.customers} acct` : undefined}
                tone={
                  String(b.bucket) === "current"
                    ? "default"
                    : String(b.bucket) === "d120_plus" || String(b.bucket) === "d91_120"
                      ? "danger"
                      : "warning"
                }
                to={
                  String(b.bucket) === "current"
                    ? `${DIST}/aging?bucket=current`
                    : `${DIST}/aging?bucket=${encodeURIComponent(String(b.bucket))}`
                }
              />
            ))}
          </div>
        ) : null}
      </DistWidgetSection>

      <DistWidgetSection
        title="Quick actions"
        subtitle="Jump into collection, aging, or recovery work."
        isLoading={false}
        isError={false}
        onRetry={() => undefined}
      >
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/collections`}>
            <DistButton variant="secondary">Collections list</DistButton>
          </Link>
          <Link to={`${DIST}/aging?focus=overdue`}>
            <DistButton variant="secondary">Overdue aging</DistButton>
          </Link>
          <Link to={`${DIST}/aging?focus=creditExceeded`}>
            <DistButton variant="secondary">Credit exceeded</DistButton>
          </Link>
          <Link to={`${DIST}/recovery`}>
            <DistButton variant="secondary">Recovery queue</DistButton>
          </Link>
          <Link to={`${DIST}/trade-customers`}>
            <DistButton variant="ghost">Trade customers</DistButton>
          </Link>
        </div>
      </DistWidgetSection>
    </DistPageShell>
  );
}
