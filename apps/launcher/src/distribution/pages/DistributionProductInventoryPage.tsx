import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  batchesApi,
  inventoryApi,
  ledgerApi,
} from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import { DistWidgetSection } from "../components/DistWidgetSection";
import {
  BatchStatusBadge,
  WarehouseFilter,
  formatDate,
  formatDateTime,
  formatQty,
} from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistKpiCard,
  DistPageShell,
  DistStatusBadge,
} from "../ui/DistUi";

const TABS = ["overview", "batches", "movements", "purchases", "sales"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  batches: "Batches",
  movements: "Movements",
  purchases: "Purchases",
  sales: "Sales",
};

export function DistributionProductInventoryPage(): JSX.Element {
  const { medicineId = "" } = useParams<{ medicineId: string }>();
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;

  const [tab, setTab] = useState<Tab>("overview");
  const [warehouseId, setWarehouseId] = useState("");
  const [batchPage, setBatchPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);

  const detail = useQuery({
    queryKey: ["distribution", "product-inventory", branchCode, medicineId, warehouseId],
    enabled: Boolean(branchCode) && Boolean(medicineId),
    queryFn: () =>
      inventoryApi.productInventory(medicineId, {
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
      }),
  });

  const batches = useQuery({
    queryKey: ["distribution", "product-batches", branchCode, medicineId, warehouseId, batchPage],
    enabled: Boolean(branchCode) && Boolean(medicineId) && tab === "batches",
    queryFn: () =>
      batchesApi.list({
        branchCode: branchCode!,
        medicineId,
        warehouseId: warehouseId || undefined,
        status: "all",
        sort: "expiry_asc",
        page: batchPage,
        pageSize: 25,
      }),
  });

  const movements = useQuery({
    queryKey: ["distribution", "product-movements", branchCode, medicineId, warehouseId, movementPage],
    enabled: Boolean(branchCode) && Boolean(medicineId) && tab === "movements",
    queryFn: () =>
      ledgerApi.list({
        branchCode: branchCode!,
        medicineId,
        warehouseId: warehouseId || undefined,
        page: movementPage,
        pageSize: 50,
      }),
  });

  const medicine = detail.data?.medicine;
  const stock = detail.data?.stock;

  return (
    <DistPageShell
      title={medicine?.name ?? "Product inventory"}
      subtitle={medicine ? `${medicine.sku} · ${medicine.companyName ?? "No company"}` : undefined}
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Inventory", to: "/pops/distribution/inventory" },
        { label: "Stock", to: "/pops/distribution/stock" },
        { label: medicine?.sku ?? "Product" },
      ]}
      actions={
        <>
          <WarehouseFilter
            branchCode={branchCode}
            value={warehouseId}
            onChange={setWarehouseId}
            className="min-w-[12rem]"
          />
          <Link to={`/pops/distribution/medicines/${medicineId}`}>
            <DistButton variant="secondary">Product master</DistButton>
          </Link>
        </>
      }
      error={!branch ? "Select a branch to load product inventory." : null}
    >
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-800">
        {TABS.map((t) => (
          <DistButton
            key={t}
            variant={tab === t ? "primary" : "ghost"}
            className="px-3 py-1 text-xs"
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </DistButton>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <DistWidgetSection
            title="Stock numbers"
            subtitle="Available excludes reserved, damaged, quarantined, blocked and expired units."
            isLoading={detail.isLoading}
            isError={detail.isError}
            error={detail.error}
            onRetry={() => void detail.refetch()}
            isEmpty={!detail.isLoading && !detail.isError && !stock}
            emptyTitle="No stock record for this product"
          >
            {stock && medicine ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DistKpiCard
                    label="Available"
                    value={`${formatQty(stock.availableQty)} ${medicine.unit}`}
                  />
                  <DistKpiCard label="Physical" value={formatQty(stock.physicalQty)} />
                  <DistKpiCard label="Reserved" value={formatQty(stock.reservedQty)} />
                  <DistKpiCard label="Value" value={formatPkr(stock.valuePkr)} />
                  <DistKpiCard
                    label="Damaged"
                    value={formatQty(stock.damagedQty)}
                    tone={stock.damagedQty > 0 ? "warning" : "default"}
                  />
                  <DistKpiCard
                    label="Quarantine"
                    value={formatQty(stock.quarantineQty)}
                    tone={stock.quarantineQty > 0 ? "warning" : "default"}
                  />
                  <DistKpiCard
                    label="Blocked"
                    value={formatQty(stock.blockedQty)}
                    tone={stock.blockedQty > 0 ? "warning" : "default"}
                  />
                  <DistKpiCard
                    label="Expired"
                    value={formatQty(stock.expiredQty)}
                    tone={stock.expiredQty > 0 ? "danger" : "success"}
                  />
                  <DistKpiCard
                    label="On hold"
                    value={formatQty(stock.onHoldQty)}
                    tone={stock.onHoldQty > 0 ? "danger" : "default"}
                  />
                  <DistKpiCard
                    label="Near expiry"
                    value={formatQty(stock.nearExpiryQty)}
                    tone={stock.nearExpiryQty > 0 ? "warning" : "default"}
                  />
                  <DistKpiCard label="Batches" value={formatQty(stock.batchCount)} />
                  <DistKpiCard
                    label="Thresholds"
                    value={`${formatQty(medicine.reorderLevel)} / ${formatQty(medicine.minStock)} / ${formatQty(medicine.maxStock)}`}
                    hint="Reorder / min / max"
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>
                    Tracking: batch {medicine.batchTrackingEnabled ? "on" : "off"} · expiry{" "}
                    {medicine.expiryTrackingEnabled ? "on" : "off"} · FEFO{" "}
                    {medicine.fefoEnabled ? "on" : "off"}
                  </span>
                  <span>
                    Location: aisle {medicine.aisleLocation ?? "—"} · rack {medicine.rackLocation ?? "—"} ·
                    shelf {medicine.shelfLocation ?? "—"}
                  </span>
                </div>
              </div>
            ) : null}
          </DistWidgetSection>

          <DistWidgetSection
            title="By warehouse"
            subtitle="Batches with no warehouse are pre-Phase-4 rows and are reported as unassigned."
            isLoading={detail.isLoading}
            isError={detail.isError}
            error={detail.error}
            onRetry={() => void detail.refetch()}
            isEmpty={!detail.isLoading && !detail.isError && (detail.data?.byWarehouse.length ?? 0) === 0}
            emptyTitle="No warehouse holds this product"
          >
            <DistDataTable
              rowKey={(r) => r.warehouseId ?? "unassigned"}
              rows={detail.data?.byWarehouse ?? []}
              empty="No warehouse holds this product"
              columns={[
                { key: "warehouseName", header: "Warehouse", render: (r) => r.warehouseName },
                {
                  key: "availableQty",
                  header: "Available",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.availableQty),
                },
                {
                  key: "physicalQty",
                  header: "Physical",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.physicalQty),
                },
                {
                  key: "batchCount",
                  header: "Batches",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.batchCount),
                },
                {
                  key: "valuePkr",
                  header: "Value",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.valuePkr),
                },
              ]}
            />
          </DistWidgetSection>
        </>
      ) : null}

      {tab === "batches" ? (
        <DistWidgetSection
          title="Batches"
          subtitle="Every batch of this product, including depleted and expired ones."
          isLoading={batches.isLoading}
          isError={batches.isError}
          error={batches.error}
          onRetry={() => void batches.refetch()}
        >
          <div className="space-y-2">
            <DistDataTable
              rowKey={(r) => r.id}
              rows={batches.data?.items ?? []}
              empty="No batches for this product"
              columns={[
                { key: "batchNumber", header: "Batch", className: "font-mono text-xs" },
                { key: "expiryDate", header: "Expiry", render: (r) => formatDate(r.expiryDate) },
                {
                  key: "daysToExpiry",
                  header: "Days left",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.daysToExpiry),
                },
                { key: "warehouseName", header: "Warehouse", render: (r) => r.warehouseName ?? "Unassigned" },
                {
                  key: "quantity",
                  header: "Available",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.quantity),
                },
                {
                  key: "physicalQty",
                  header: "Physical",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.physicalQty),
                },
                {
                  key: "purchaseRatePkr",
                  header: "Cost",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.purchaseRatePkr),
                },
                {
                  key: "valuePkr",
                  header: "Value",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.valuePkr),
                },
                {
                  key: "derivedStatus",
                  header: "Status",
                  render: (r) => <BatchStatusBadge status={r.derivedStatus} />,
                },
              ]}
            />
            <DistPagination
              page={batches.data?.page ?? batchPage}
              pageSize={batches.data?.pageSize ?? 25}
              total={batches.data?.total ?? 0}
              totalPages={batches.data?.totalPages}
              onPageChange={setBatchPage}
            />
          </div>
        </DistWidgetSection>
      ) : null}

      {tab === "movements" ? (
        <DistWidgetSection
          title="Stock ledger"
          subtitle="Append-only. A mistake is corrected with a reversal row, never by editing history."
          isLoading={movements.isLoading}
          isError={movements.isError}
          error={movements.error}
          onRetry={() => void movements.refetch()}
        >
          <div className="space-y-2">
            <DistDataTable
              rowKey={(r) => r.id}
              rows={movements.data?.items ?? []}
              empty="No movements recorded for this product"
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
                { key: "batchNumber", header: "Batch", render: (r) => r.batchNumber ?? "—" },
                {
                  key: "quantityDelta",
                  header: "Qty",
                  className: "text-right tabular-nums",
                  render: (r) =>
                    r.quantityDelta > 0 ? `+${formatQty(r.quantityDelta)}` : formatQty(r.quantityDelta),
                },
                {
                  key: "quantityAfter",
                  header: "Balance",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.quantityAfter),
                },
                {
                  key: "valuePkr",
                  header: "Value",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.valuePkr),
                },
                {
                  key: "reference",
                  header: "Reference",
                  render: (r) => (r.referenceType ? `${r.referenceType}${r.referenceId ? ` · ${r.referenceId}` : ""}` : "—"),
                },
                { key: "userName", header: "By", render: (r) => r.userName ?? "—" },
              ]}
            />
            <DistPagination
              page={movements.data?.page ?? movementPage}
              pageSize={movements.data?.pageSize ?? 50}
              total={movements.data?.total ?? 0}
              totalPages={movements.data?.totalPages}
              onPageChange={setMovementPage}
            />
          </div>
        </DistWidgetSection>
      ) : null}

      {tab === "purchases" ? (
        <DistWidgetSection
          title="Purchase history"
          subtitle="Last 10 goods receipts carrying this product."
          isLoading={detail.isLoading}
          isError={detail.isError}
          error={detail.error}
          onRetry={() => void detail.refetch()}
        >
          <DistDataTable
            rowKey={(r) => `${r.grnId}-${r.batchNumber}`}
            rows={detail.data?.purchaseHistory ?? []}
            empty="No goods receipt has included this product"
            columns={[
              { key: "grnNumber", header: "GRN", className: "font-mono text-xs" },
              { key: "date", header: "Date", render: (r) => formatDate(r.date) },
              { key: "supplierName", header: "Supplier", render: (r) => r.supplierName ?? "—" },
              { key: "batchNumber", header: "Batch", className: "font-mono text-xs" },
              {
                key: "quantity",
                header: "Qty",
                className: "text-right tabular-nums",
                render: (r) => formatQty(r.quantity),
              },
              {
                key: "unitCostPkr",
                header: "Unit cost",
                className: "text-right tabular-nums",
                render: (r) => formatPkr(r.unitCostPkr),
              },
            ]}
          />
        </DistWidgetSection>
      ) : null}

      {tab === "sales" ? (
        <DistWidgetSection
          title="Sales history"
          subtitle="Last 10 distribution invoices carrying this product."
          isLoading={detail.isLoading}
          isError={detail.isError}
          error={detail.error}
          onRetry={() => void detail.refetch()}
        >
          <DistDataTable
            rowKey={(r) => `${r.invoiceId}-${r.quantity}`}
            rows={detail.data?.salesHistory ?? []}
            empty="No invoice has included this product"
            columns={[
              { key: "invoiceNumber", header: "Invoice", className: "font-mono text-xs" },
              { key: "date", header: "Date", render: (r) => formatDate(r.date) },
              { key: "customerName", header: "Customer", render: (r) => r.customerName ?? "—" },
              {
                key: "quantity",
                header: "Qty",
                className: "text-right tabular-nums",
                render: (r) => formatQty(r.quantity),
              },
              {
                key: "unitPricePkr",
                header: "Unit price",
                className: "text-right tabular-nums",
                render: (r) => formatPkr(r.unitPricePkr),
              },
            ]}
          />
        </DistWidgetSection>
      ) : null}
    </DistPageShell>
  );
}
