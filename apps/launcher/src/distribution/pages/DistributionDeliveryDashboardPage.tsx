import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { deliveryApi } from "../../pharmacy/api/pharmacy-delivery";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistWidgetSection } from "../components/DistWidgetSection";
import { DistButton, DistKpiCard, DistPageShell } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionDeliveryDashboardPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;

  const dashboard = useQuery({
    queryKey: ["distribution", "delivery-dashboard", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => deliveryApi.dashboard({ branchCode }),
  });

  const k = dashboard.data?.kpis;

  return (
    <DistPageShell
      title="Delivery dashboard"
      subtitle="Dispatch readiness, out-for-delivery, and POD outcomes."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Deliveries" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/deliveries`}>
            <DistButton variant="secondary">All deliveries</DistButton>
          </Link>
          <Link to={`${DIST}/dispatch`}>
            <DistButton>Dispatch board</DistButton>
          </Link>
        </div>
      }
      error={!branch ? "Select a branch to load deliveries." : null}
    >
      <DistWidgetSection
        title="Delivery KPIs"
        subtitle="Live counts from the delivery API (falls back to distribution dashboard when Phase 7 routes are offline)."
        isLoading={dashboard.isLoading}
        isError={dashboard.isError}
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
        isEmpty={!dashboard.isLoading && !dashboard.isError && !k}
        emptyTitle="No delivery data"
      >
        {k ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DistKpiCard label="Total" value={k.total} to={`${DIST}/deliveries`} />
            <DistKpiCard
              label="Pending / open"
              value={k.pending}
              tone={k.pending > 0 ? "warning" : "default"}
              to={`${DIST}/deliveries?status=pending`}
            />
            <DistKpiCard
              label="Ready to dispatch"
              value={k.readyForDispatch}
              tone={k.readyForDispatch > 0 ? "warning" : "default"}
              to={`${DIST}/dispatch`}
            />
            <DistKpiCard
              label="Dispatched"
              value={k.dispatched}
              to={`${DIST}/deliveries?status=dispatched`}
            />
            <DistKpiCard
              label="Out for delivery"
              value={k.outForDelivery}
              to={`${DIST}/deliveries?status=out_for_delivery`}
            />
            <DistKpiCard
              label="Delivered"
              value={k.delivered}
              tone="success"
              to={`${DIST}/deliveries?status=delivered`}
            />
            <DistKpiCard
              label="Partial / failed"
              value={k.partial + k.failed}
              tone={k.partial + k.failed > 0 ? "danger" : "default"}
              to={`${DIST}/deliveries?status=failed`}
            />
            <DistKpiCard
              label="Collected on POD"
              value={formatPkr(k.collectedPkr)}
              tone="success"
              to={`${DIST}/collections`}
            />
          </div>
        ) : null}
      </DistWidgetSection>

      {dashboard.data?.byStatus?.length ? (
        <DistWidgetSection
          title="By status"
          subtitle="Click through to filtered delivery list"
          isLoading={false}
          isError={false}
          onRetry={() => undefined}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {dashboard.data.byStatus.map((s) => (
              <DistKpiCard
                key={s.status}
                label={s.status.replace(/_/g, " ")}
                value={s.count}
                hint={s.collectedPkr ? formatPkr(s.collectedPkr) : undefined}
                to={`${DIST}/deliveries?status=${encodeURIComponent(s.status)}`}
              />
            ))}
          </div>
        </DistWidgetSection>
      ) : null}
    </DistPageShell>
  );
}
