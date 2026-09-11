import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  batchesApi,
  inventoryApi,
  ledgerApi,
  valuationApi,
} from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistWidgetSection } from "../components/DistWidgetSection";
import {
  WarehouseFilter,
  formatDateTime,
  formatQty,
} from "../components/DistInventoryShared";
import { DistDataTable, DistKpiCard, DistPageShell, DistStatusBadge } from "../ui/DistUi";

/**
 * Every panel owns its own query so a single failing endpoint degrades one
 * widget instead of blanking the screen.
 */
export function DistributionInventoryDashboardPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [warehouseId, setWarehouseId] = useState("");
  const branchCode = branch?.code;
  const enabled = Boolean(branchCode);

  const dashboard = useQuery({
    queryKey: ["distribution", "inventory-dashboard", branchCode, warehouseId],
    enabled,
    queryFn: () =>
      inventoryApi.dashboard({ branchCode: branchCode!, warehouseId: warehouseId || undefined }),
  });

  const expiry = useQuery({
    queryKey: ["distribution", "inventory-expiry-buckets", branchCode, warehouseId],
    enabled,
    queryFn: () =>
      batchesApi.expiryBuckets({ branchCode: branchCode!, warehouseId: warehouseId || undefined }),
  });

  const topValue = useQuery({
    queryKey: ["distribution", "inventory-top-value", branchCode, warehouseId],
    enabled,
    queryFn: () =>
      valuationApi.report({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        page: 1,
        pageSize: 10,
      }),
  });

  const movements = useQuery({
    queryKey: ["distribution", "inventory-recent-movements", branchCode, warehouseId],
    enabled,
    queryFn: () =>
      ledgerApi.list({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        page: 1,
        pageSize: 10,
      }),
  });

  const counts = dashboard.data?.counts;
  const totals = dashboard.data?.totals;
  const valuation = dashboard.data?.valuation;

  const buckets = expiry.data?.buckets ?? [];
  const maxBucketQty = buckets.reduce((max, b) => Math.max(max, b.quantity), 0);

  return (
    <DistPageShell
      title="Inventory dashboard"
      subtitle="Live stock position, valuation, expiry exposure and pending stock documents."
      breadcrumb={[{ label: "Distribution", to: "/pops/distribution/ps" }, { label: "Inventory" }]}
      actions={
        <WarehouseFilter
          branchCode={branchCode}
          value={warehouseId}
          onChange={setWarehouseId}
          className="min-w-[12rem]"
        />
      }
      error={!branch ? "Select a branch to load inventory." : null}
    >
      <DistWidgetSection
        title="Stock position"
        subtitle="Available excludes reserved, damaged, quarantined, blocked and expired units."
        isLoading={dashboard.isLoading}
        isError={dashboard.isError}
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
        isEmpty={!dashboard.isLoading && !dashboard.isError && !dashboard.data}
        emptyTitle="No inventory data for this branch"
      >
        {totals && counts ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DistKpiCard
              label="Available qty"
              value={formatQty(totals.availableQty)}
              hint={`${formatQty(counts.skuCount)} SKUs · ${formatQty(counts.batchCount)} batches`}
              to="/pops/distribution/stock"
            />
            <DistKpiCard
              label="Physical qty"
              value={formatQty(totals.physicalQty)}
              hint={`Reserved ${formatQty(totals.reservedQty)} · on hold ${formatQty(totals.onHoldQty)}`}
            />
            <DistKpiCard
              label="Stock value"
              value={formatPkr(valuation?.availableValuePkr ?? totals.valuePkr)}
              hint={valuation?.note}
              to="/pops/distribution/inventory-reports"
            />
            <DistKpiCard
              label="Warehouses"
              value={formatQty(counts.warehouseCount)}
              hint={`${formatQty(counts.activeReservationCount)} active reservations`}
              to="/pops/distribution/warehouses"
            />
            <DistKpiCard
              label="Low stock"
              value={formatQty(counts.lowStockCount)}
              tone={counts.lowStockCount > 0 ? "warning" : "default"}
              to="/pops/distribution/stock"
            />
            <DistKpiCard
              label="Out of stock"
              value={formatQty(counts.outOfStockCount)}
              tone={counts.outOfStockCount > 0 ? "danger" : "default"}
              to="/pops/distribution/stock"
            />
            <DistKpiCard
              label="Negative stock"
              value={formatQty(counts.negativeStockCount)}
              tone={counts.negativeStockCount > 0 ? "danger" : "success"}
              hint="Negative available quantity cannot happen physically"
              to="/pops/distribution/stock"
            />
            <DistKpiCard
              label="Batches on hold"
              value={formatQty(counts.holdBatchCount)}
              tone={counts.holdBatchCount > 0 ? "warning" : "default"}
              to="/pops/distribution/batches"
            />
            <DistKpiCard
              label="Expired batches"
              value={formatQty(counts.expiredBatchCount)}
              tone={counts.expiredBatchCount > 0 ? "danger" : "success"}
              hint={`${formatQty(totals.expiredQty)} units still held`}
              to="/pops/distribution/expiry"
            />
            <DistKpiCard
              label="Near-expiry batches"
              value={formatQty(counts.nearExpiryBatchCount)}
              tone={counts.nearExpiryBatchCount > 0 ? "warning" : "default"}
              hint={`${formatQty(totals.nearExpiryQty)} units`}
              to="/pops/distribution/expiry"
            />
            <DistKpiCard
              label="Pending transfers"
              value={formatQty(counts.pendingTransferCount)}
              hint="Submitted, approved or dispatched"
              to="/pops/distribution/stock-transfers"
            />
            <DistKpiCard
              label="Adjustments awaiting approval"
              value={formatQty(counts.pendingAdjustmentCount)}
              tone={counts.pendingAdjustmentCount > 0 ? "warning" : "default"}
              to="/pops/distribution/stock-adjustments"
            />
          </div>
        ) : null}
      </DistWidgetSection>

      <DistWidgetSection
        title="Expiry exposure"
        subtitle="Bucket boundaries come from inventory settings, not from this screen."
        isLoading={expiry.isLoading}
        isError={expiry.isError}
        error={expiry.error}
        onRetry={() => void expiry.refetch()}
        isEmpty={!expiry.isLoading && !expiry.isError && buckets.length === 0}
        emptyTitle="No batches to bucket"
        emptyDescription="This branch has no batch rows in the selected warehouse."
      >
        <div className="space-y-3">
          {expiry.data ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <DistKpiCard
                label="Expired value"
                value={formatPkr(expiry.data.expired.valuePkr)}
                tone={expiry.data.expired.batchCount > 0 ? "danger" : "success"}
                hint={`${formatQty(expiry.data.expired.batchCount)} batches · ${formatQty(expiry.data.expired.quantity)} units`}
                to="/pops/distribution/expiry"
              />
              <DistKpiCard
                label="Near-expiry value"
                value={formatPkr(expiry.data.totalNearExpiryValuePkr)}
                tone={expiry.data.totalNearExpiryValuePkr > 0 ? "warning" : "default"}
                to="/pops/distribution/expiry"
              />
            </div>
          ) : null}
          <ul className="space-y-2">
            {buckets.map((bucket) => (
              <li key={bucket.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <Link
                    to={`/pops/distribution/expiry?bucket=${encodeURIComponent(bucket.label)}`}
                    className="font-medium text-slate-700 hover:text-cyan-700 dark:text-slate-200 dark:hover:text-cyan-400"
                  >
                    {bucket.label}
                  </Link>
                  <span className="tabular-nums text-slate-500">
                    {formatQty(bucket.batchCount)} batches · {formatQty(bucket.quantity)} units ·{" "}
                    {formatPkr(bucket.valuePkr)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded bg-cyan-500"
                    style={{
                      width: `${maxBucketQty > 0 ? Math.round((bucket.quantity / maxBucketQty) * 100) : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DistWidgetSection>

      <DistWidgetSection
        title="Top value products"
        subtitle="Ranked by available stock value at the configured costing method."
        isLoading={topValue.isLoading}
        isError={topValue.isError}
        error={topValue.error}
        onRetry={() => void topValue.refetch()}
        isEmpty={!topValue.isLoading && !topValue.isError && (topValue.data?.items.length ?? 0) === 0}
        emptyTitle="No valued stock"
        emptyDescription="No product in this scope currently holds available stock."
      >
        <DistDataTable
          rowKey={(r) => r.medicineId}
          rows={topValue.data?.items ?? []}
          empty="No valued stock"
          columns={[
            { key: "sku", header: "SKU", className: "font-mono text-xs", render: (r) => r.sku },
            {
              key: "name",
              header: "Product",
              render: (r) => (
                <Link
                  to={`/pops/distribution/inventory/product/${r.medicineId}`}
                  className="hover:text-cyan-700 dark:hover:text-cyan-400"
                >
                  {r.name}
                </Link>
              ),
            },
            { key: "company", header: "Company", render: (r) => r.companyName ?? "—" },
            {
              key: "qty",
              header: "Available",
              className: "text-right tabular-nums",
              render: (r) => `${formatQty(r.availableQty)} ${r.unit}`,
            },
            {
              key: "unitCost",
              header: "Unit cost",
              className: "text-right tabular-nums",
              render: (r) => formatPkr(r.unitCostPkr),
            },
            {
              key: "value",
              header: "Value",
              className: "text-right tabular-nums",
              render: (r) => formatPkr(r.availableValuePkr),
            },
            { key: "costSource", header: "Cost basis", render: (r) => r.costSource.replace(/_/g, " ") },
          ]}
        />
      </DistWidgetSection>

      <DistWidgetSection
        title="Recent stock movements"
        subtitle="Append-only ledger. Corrections are posted as reversals, never edits."
        action={
          <Link
            to="/pops/distribution/stock-ledger"
            className="text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-400"
          >
            Open movement register
          </Link>
        }
        isLoading={movements.isLoading}
        isError={movements.isError}
        error={movements.error}
        onRetry={() => void movements.refetch()}
        isEmpty={!movements.isLoading && !movements.isError && (movements.data?.items.length ?? 0) === 0}
        emptyTitle="No stock movements recorded yet"
      >
        <DistDataTable
          rowKey={(r) => r.id}
          rows={movements.data?.items ?? []}
          empty="No stock movements recorded yet"
          columns={[
            { key: "createdAt", header: "When", render: (r) => formatDateTime(r.createdAt) },
            {
              key: "movementType",
              header: "Type",
              render: (r) => (
                <DistStatusBadge
                  status={r.movementType}
                  tone={r.direction === "in" ? "success" : r.direction === "out" ? "warning" : "neutral"}
                />
              ),
            },
            { key: "medicineName", header: "Product", render: (r) => r.medicineName ?? "—" },
            { key: "batchNumber", header: "Batch", render: (r) => r.batchNumber ?? "—" },
            {
              key: "quantityDelta",
              header: "Qty",
              className: "text-right tabular-nums",
              render: (r) => (r.quantityDelta > 0 ? `+${formatQty(r.quantityDelta)}` : formatQty(r.quantityDelta)),
            },
            { key: "warehouseName", header: "Warehouse", render: (r) => r.warehouseName ?? "—" },
            { key: "userName", header: "By", render: (r) => r.userName ?? "—" },
          ]}
        />
      </DistWidgetSection>
    </DistPageShell>
  );
}
