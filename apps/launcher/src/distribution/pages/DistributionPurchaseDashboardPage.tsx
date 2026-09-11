import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { purchaseApi } from "../../pharmacy/api/pharmacy-purchase";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistWidgetSection } from "../components/DistWidgetSection";
import { DistButton, DistKpiCard, DistPageShell } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionPurchaseDashboardPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const enabled = Boolean(branchCode);

  const dashboard = useQuery({
    queryKey: ["distribution", "purchase-dashboard", branchCode],
    enabled,
    queryFn: () => purchaseApi.dashboard({ branchCode: branchCode! }),
  });

  const k = dashboard.data?.kpis;

  return (
    <DistPageShell
      title="Purchase dashboard"
      subtitle="Pharmaceutical procurement — requisitions, POs, GRN, invoices and returns."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Purchases" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/purchase-requisitions`}>
            <DistButton variant="secondary">Create requisition</DistButton>
          </Link>
          <Link to={`${DIST}/purchase-orders`}>
            <DistButton>Create PO</DistButton>
          </Link>
          <Link to={`${DIST}/purchase-grn`}>
            <DistButton variant="secondary">Receive GRN</DistButton>
          </Link>
        </div>
      }
      error={!branch ? "Select a branch to load purchases." : null}
    >
      <DistWidgetSection
        title="Procurement KPIs"
        subtitle="Live counts from the purchase API (falls back to PO/GRN registers when Phase 6 routes are offline)."
        isLoading={dashboard.isLoading}
        isError={dashboard.isError}
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
        isEmpty={!dashboard.isLoading && !dashboard.isError && !k}
        emptyTitle="No purchase data"
      >
        {k ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DistKpiCard
              label="Pending approvals"
              value={k.pendingApprovals}
              tone={k.pendingApprovals > 0 ? "warning" : "default"}
              to={`${DIST}/purchase-orders?status=submitted&focus=pending`}
            />
            <DistKpiCard
              label="Open requisitions"
              value={k.openRequisitions}
              to={`${DIST}/purchase-requisitions?status=submitted`}
            />
            <DistKpiCard
              label="Open purchase orders"
              value={k.openOrders}
              to={`${DIST}/purchase-orders?status=`}
            />
            <DistKpiCard
              label="Pending GRN"
              value={k.pendingGrn}
              tone={k.pendingGrn > 0 ? "warning" : "default"}
              to={`${DIST}/purchase-grn`}
            />
            <DistKpiCard
              label="Partial receipts"
              value={k.partialOrders}
              tone={k.partialOrders > 0 ? "warning" : "default"}
              to={`${DIST}/purchase-orders?status=partial`}
            />
            <DistKpiCard
              label="Returns today"
              value={k.returnsToday}
              to={`${DIST}/purchase-returns`}
            />
            <DistKpiCard
              label="Open invoices"
              value={k.invoicesOpen}
              to={`${DIST}/purchase-invoices`}
            />
            <DistKpiCard
              label="Reorder SKUs"
              value={k.reorderSkus}
              tone={k.reorderSkus > 0 ? "warning" : "success"}
              to={`${DIST}/inventory-reports?tab=reorder`}
            />
            {k.purchaseTodayPkr != null ? (
              <DistKpiCard
                label="GRN value today"
                value={formatPkr(k.purchaseTodayPkr)}
                to={`${DIST}/purchase-grn`}
              />
            ) : null}
            {k.purchaseMonthPkr != null ? (
              <DistKpiCard label="Purchase month" value={formatPkr(k.purchaseMonthPkr)} />
            ) : null}
          </div>
        ) : null}
      </DistWidgetSection>

      <DistWidgetSection
        title="Quick actions"
        subtitle="Jump into the dense procurement workflow."
        isLoading={false}
        isError={false}
        onRetry={() => undefined}
      >
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/purchase-requisitions`}>
            <DistButton variant="secondary">Requisitions</DistButton>
          </Link>
          <Link to={`${DIST}/purchase-orders`}>
            <DistButton variant="secondary">Purchase orders</DistButton>
          </Link>
          <Link to={`${DIST}/purchase-grn`}>
            <DistButton variant="secondary">GRN</DistButton>
          </Link>
          <Link to={`${DIST}/purchase-returns`}>
            <DistButton variant="secondary">Returns</DistButton>
          </Link>
          <Link to={`${DIST}/purchase-invoices`}>
            <DistButton variant="secondary">Invoices</DistButton>
          </Link>
          <Link to={`${DIST}/inventory-reports?tab=reorder`}>
            <DistButton variant="secondary">Reorder suggestions</DistButton>
          </Link>
          <Link to={`${DIST}/purchase-orders?focus=pending`}>
            <DistButton variant="secondary">Approvals</DistButton>
          </Link>
          <Link to={`${DIST}/suppliers`}>
            <DistButton variant="secondary">Suppliers</DistButton>
          </Link>
          <Link to={`${DIST}/reports?category=Purchase`}>
            <DistButton variant="ghost">Purchase reports</DistButton>
          </Link>
        </div>
      </DistWidgetSection>
    </DistPageShell>
  );
}
