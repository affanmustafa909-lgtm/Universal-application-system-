import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { inventoryApi, inventorySettingsApi, valuationApi } from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import { DistWidgetSection } from "../components/DistWidgetSection";
import {
  WarehouseFilter,
  errorMessage,
  formatDate,
  formatQty,
  useCompanyOptions,
} from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistInput,
  DistKpiCard,
  DistPageShell,
  DistPanel,
  DistSelect,
  DistStatusBadge,
  exportRowsToCsv,
} from "../ui/DistUi";

const REPORTS = [
  { key: "reorder", label: "Reorder suggestions" },
  { key: "slow_moving", label: "Slow moving" },
  { key: "aging", label: "Stock aging" },
  { key: "valuation", label: "Valuation" },
  { key: "integrity", label: "Reconciliation & data quality" },
] as const;

type ReportKey = (typeof REPORTS)[number]["key"];

function isReportKey(value: string | null): value is ReportKey {
  return REPORTS.some((r) => r.key === value);
}

const URGENCY_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  critical: "danger",
  high: "warning",
  normal: "neutral",
};

const SEVERITY_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

const COST_SOURCE_LABELS: Record<string, string> = {
  batch: "Batch purchase rate",
  product_cost: "Product cost price",
  product_purchase: "Product purchase price",
  none: "No cost on record",
};

export function DistributionInventoryReportsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [report, setReport] = useState<ReportKey>(() =>
    isReportKey(tabParam) ? tabParam : "reorder",
  );
  const [warehouseId, setWarehouseId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [slowMovingDays, setSlowMovingDays] = useState("");
  const [valuationQ, setValuationQ] = useState("");

  const [reorderPage, setReorderPage] = useState(1);
  const [slowPage, setSlowPage] = useState(1);
  const [agingPage, setAgingPage] = useState(1);
  const [valuationPage, setValuationPage] = useState(1);
  const [reconcilePage, setReconcilePage] = useState(1);

  useEffect(() => {
    if (isReportKey(tabParam) && tabParam !== report) {
      setReport(tabParam);
    }
  }, [tabParam, report]);

  function selectReport(next: ReportKey) {
    setReport(next);
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  const enabled = Boolean(branchCode);
  const companies = useCompanyOptions();

  const settings = useQuery({
    queryKey: ["distribution", "inventory-settings", branchCode],
    enabled,
    queryFn: () => inventorySettingsApi.get({ branchCode: branchCode! }),
  });

  const reorder = useQuery({
    queryKey: ["distribution", "inventory-reorder", branchCode, warehouseId, companyId, reorderPage],
    enabled: enabled && report === "reorder",
    queryFn: () =>
      inventoryApi.reorder({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        companyId: companyId || undefined,
        page: reorderPage,
        pageSize: 50,
      }),
  });

  const slowMoving = useQuery({
    queryKey: ["distribution", "inventory-slow-moving", branchCode, warehouseId, slowMovingDays, slowPage],
    enabled: enabled && report === "slow_moving",
    queryFn: () =>
      inventoryApi.slowMoving({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        days: slowMovingDays ? Number(slowMovingDays) : undefined,
        page: slowPage,
        pageSize: 50,
      }),
  });

  const aging = useQuery({
    queryKey: ["distribution", "inventory-aging", branchCode, warehouseId, agingPage],
    enabled: enabled && report === "aging",
    queryFn: () =>
      inventoryApi.aging({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        page: agingPage,
        pageSize: 50,
      }),
  });

  const valuationParams = {
    branchCode: branchCode!,
    warehouseId: warehouseId || undefined,
    companyId: companyId || undefined,
  };

  const valuationSummary = useQuery({
    queryKey: ["distribution", "valuation-summary", branchCode, warehouseId, companyId],
    enabled: enabled && report === "valuation",
    queryFn: () => valuationApi.summary(valuationParams),
  });

  const valuationByWarehouse = useQuery({
    queryKey: ["distribution", "valuation-by-warehouse", branchCode, warehouseId, companyId],
    enabled: enabled && report === "valuation",
    queryFn: () => valuationApi.byWarehouse(valuationParams),
  });

  const valuationByCompany = useQuery({
    queryKey: ["distribution", "valuation-by-company", branchCode, warehouseId, companyId],
    enabled: enabled && report === "valuation",
    queryFn: () => valuationApi.byCompany(valuationParams),
  });

  const valuationReport = useQuery({
    queryKey: [
      "distribution",
      "valuation-report",
      branchCode,
      warehouseId,
      companyId,
      valuationQ,
      valuationPage,
    ],
    enabled: enabled && report === "valuation",
    queryFn: () =>
      valuationApi.report({ ...valuationParams, q: valuationQ || undefined, page: valuationPage, pageSize: 50 }),
  });

  const reconcile = useQuery({
    queryKey: ["distribution", "inventory-reconcile", branchCode, reconcilePage],
    enabled: enabled && report === "integrity",
    queryFn: () => inventoryApi.reconcile({ branchCode: branchCode!, page: reconcilePage, pageSize: 50 }),
  });

  const dataQuality = useQuery({
    queryKey: ["distribution", "inventory-data-quality", branchCode],
    enabled: enabled && report === "integrity",
    queryFn: () => inventoryApi.dataQuality({ branchCode: branchCode! }),
  });

  const showCompanyFilter = report === "reorder" || report === "valuation";
  const showWarehouseFilter = report !== "integrity";

  return (
    <DistPageShell
      title="Inventory reports"
      subtitle="Reorder, slow moving, aging, valuation and integrity checks, all computed on the server from live stock."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Inventory", to: "/pops/distribution/inventory" },
        { label: "Reports" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {showWarehouseFilter ? (
            <WarehouseFilter
              branchCode={branchCode}
              value={warehouseId}
              onChange={setWarehouseId}
              className="min-w-[12rem]"
            />
          ) : null}
        </div>
      }
      error={!branch ? "Select a branch to load inventory reports." : null}
    >
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => selectReport(r.key)}
            className={
              report === r.key
                ? "rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                : "rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {showCompanyFilter || report === "slow_moving" ? (
        <div className="flex flex-wrap items-end gap-2">
          {showCompanyFilter ? (
            <label className="text-xs text-slate-500">
              Company
              <DistSelect
                className="mt-1 min-w-[14rem]"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setReorderPage(1);
                  setValuationPage(1);
                }}
              >
                <option value="">All companies</option>
                {(companies.data?.items ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </DistSelect>
            </label>
          ) : null}
          {report === "slow_moving" ? (
            <label className="text-xs text-slate-500">
              No movement for (days)
              <DistInput
                className="mt-1 w-40"
                type="number"
                min={1}
                placeholder={settings.data ? String(settings.data.slowMovingDays) : "from settings"}
                value={slowMovingDays}
                onChange={(e) => {
                  setSlowMovingDays(e.target.value);
                  setSlowPage(1);
                }}
              />
            </label>
          ) : null}
          {report === "valuation" ? (
            <label className="text-xs text-slate-500">
              Search product
              <DistInput
                className="mt-1 min-w-[14rem]"
                value={valuationQ}
                onChange={(e) => {
                  setValuationQ(e.target.value);
                  setValuationPage(1);
                }}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {report === "reorder" ? (
        <DistWidgetSection
          title="Reorder suggestions"
          subtitle={
            reorder.data
              ? `Formula in use: ${reorder.data.formula}`
              : settings.data
                ? `Formula in use: ${settings.data.reorderFormula} · lead time ${settings.data.reorderLeadTimeDays}d · safety ${settings.data.reorderSafetyDays}d`
                : undefined
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Link to="/pops/distribution/purchase-requisitions">
                <DistButton variant="secondary">Raise requisition</DistButton>
              </Link>
              <Link to="/pops/distribution/purchase-orders">
                <DistButton variant="secondary">Create PO</DistButton>
              </Link>
            </div>
          }
          isLoading={reorder.isLoading}
          isError={reorder.isError}
          error={reorder.error}
          onRetry={() => void reorder.refetch()}
          isEmpty={reorder.data?.items.length === 0}
          emptyTitle="Nothing needs reordering"
          emptyDescription="No product is below its reorder point under the current formula."
        >
          <DistDataTable
            rowKey={(r) => r.medicineId}
            rows={reorder.data?.items ?? []}
            empty="Nothing needs reordering"
            onExport={() =>
              exportRowsToCsv(
                "reorder-suggestions.csv",
                ["SKU", "Product", "Company", "Available", "Reorder level", "Min", "Max", "Avg daily sales", "Days of cover", "Suggested", "Urgency", "Reason"],
                (reorder.data?.items ?? []).map((r) => [
                  r.sku,
                  r.name,
                  r.companyName ?? "",
                  r.availableQty,
                  r.reorderLevel,
                  r.minStock,
                  r.maxStock,
                  r.avgDailySales,
                  r.daysOfCover ?? "",
                  r.suggestedQty,
                  r.urgency,
                  r.reason,
                ]),
              )
            }
            columns={[
              { key: "sku", header: "SKU", className: "font-mono text-xs" },
              {
                key: "name",
                header: "Product",
                render: (r) => (
                  <Link
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    to={`/pops/distribution/inventory/product/${r.medicineId}`}
                  >
                    {r.name}
                  </Link>
                ),
              },
              { key: "companyName", header: "Company", render: (r) => r.companyName ?? "—" },
              {
                key: "availableQty",
                header: "Available",
                className: "text-right tabular-nums",
                render: (r) => `${formatQty(r.availableQty)} ${r.unit}`,
              },
              {
                key: "reorderLevel",
                header: "Reorder level",
                className: "text-right tabular-nums",
                render: (r) => formatQty(r.reorderLevel),
              },
              {
                key: "avgDailySales",
                header: "Avg daily sales",
                className: "text-right tabular-nums",
                render: (r) => r.avgDailySales.toLocaleString(),
              },
              {
                key: "daysOfCover",
                header: "Days of cover",
                className: "text-right tabular-nums",
                render: (r) => (r.daysOfCover == null ? "No consumption" : formatQty(r.daysOfCover)),
              },
              {
                key: "suggestedQty",
                header: "Suggested qty",
                className: "text-right tabular-nums font-semibold",
                render: (r) => formatQty(r.suggestedQty),
              },
              {
                key: "urgency",
                header: "Urgency",
                render: (r) => <DistStatusBadge status={r.urgency} tone={URGENCY_TONES[r.urgency] ?? "neutral"} />,
              },
              { key: "reason", header: "Reason", render: (r) => r.reason },
            ]}
          />
          <DistPagination
            page={reorder.data?.page ?? reorderPage}
            pageSize={reorder.data?.pageSize ?? 50}
            total={reorder.data?.total ?? 0}
            totalPages={reorder.data?.totalPages}
            onPageChange={setReorderPage}
          />
        </DistWidgetSection>
      ) : null}

      {report === "slow_moving" ? (
        <DistWidgetSection
          title="Slow moving stock"
          subtitle={
            settings.data
              ? `Default window is ${settings.data.slowMovingDays} days from inventory settings.`
              : undefined
          }
          isLoading={slowMoving.isLoading}
          isError={slowMoving.isError}
          error={slowMoving.error}
          onRetry={() => void slowMoving.refetch()}
          isEmpty={slowMoving.data?.items.length === 0}
          emptyTitle="Nothing is sitting still"
          emptyDescription="Every product with stock has moved inside the window."
        >
          <DistDataTable
            rowKey={(r) => r.medicineId}
            rows={slowMoving.data?.items ?? []}
            empty="Nothing is sitting still"
            onExport={() =>
              exportRowsToCsv(
                "slow-moving.csv",
                ["SKU", "Product", "Available", "Value PKR", "Last movement", "Days since movement", "Units sold in period"],
                (slowMoving.data?.items ?? []).map((r) => [
                  r.sku,
                  r.name,
                  r.availableQty,
                  r.valuePkr,
                  r.lastMovementAt ?? "",
                  r.daysSinceMovement ?? "",
                  r.unitsSoldInPeriod,
                ]),
              )
            }
            columns={[
              { key: "sku", header: "SKU", className: "font-mono text-xs" },
              {
                key: "name",
                header: "Product",
                render: (r) => (
                  <Link
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    to={`/pops/distribution/inventory/product/${r.medicineId}`}
                  >
                    {r.name}
                  </Link>
                ),
              },
              {
                key: "availableQty",
                header: "Available",
                className: "text-right tabular-nums",
                render: (r) => formatQty(r.availableQty),
              },
              {
                key: "valuePkr",
                header: "Tied-up value",
                className: "text-right tabular-nums",
                render: (r) => formatPkr(r.valuePkr),
              },
              { key: "lastMovementAt", header: "Last movement", render: (r) => formatDate(r.lastMovementAt) },
              {
                key: "daysSinceMovement",
                header: "Days idle",
                className: "text-right tabular-nums",
                render: (r) => (r.daysSinceMovement == null ? "Never moved" : formatQty(r.daysSinceMovement)),
              },
              {
                key: "unitsSoldInPeriod",
                header: "Units sold in window",
                className: "text-right tabular-nums",
                render: (r) => formatQty(r.unitsSoldInPeriod),
              },
            ]}
          />
          <DistPagination
            page={slowMoving.data?.page ?? slowPage}
            pageSize={slowMoving.data?.pageSize ?? 50}
            total={slowMoving.data?.total ?? 0}
            totalPages={slowMoving.data?.totalPages}
            onPageChange={setSlowPage}
          />
        </DistWidgetSection>
      ) : null}

      {report === "aging" ? (
        <DistWidgetSection
          title="Stock aging"
          subtitle="How long each batch has been sitting since it was received."
          isLoading={aging.isLoading}
          isError={aging.isError}
          error={aging.error}
          onRetry={() => void aging.refetch()}
          isEmpty={aging.data?.items.items.length === 0}
          emptyTitle="No stock to age"
          emptyDescription="No batch in this warehouse carries a quantity."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(aging.data?.buckets ?? []).map((b) => (
              <DistKpiCard
                key={b.label}
                label={b.label}
                value={formatPkr(b.valuePkr)}
                hint={`${formatQty(b.batchCount)} batches · ${formatQty(b.quantity)} units`}
              />
            ))}
          </div>
          <DistDataTable
            rowKey={(r) => r.batchId}
            rows={aging.data?.items.items ?? []}
            empty="No stock to age"
            onExport={() =>
              exportRowsToCsv(
                "stock-aging.csv",
                ["SKU", "Product", "Batch", "Expiry", "Warehouse", "Available", "Physical", "Value PKR", "Received", "Age days", "Bucket"],
                (aging.data?.items.items ?? []).map((r) => [
                  r.sku,
                  r.name,
                  r.batchNumber,
                  r.expiryDate,
                  r.warehouseName ?? "",
                  r.quantity,
                  r.physicalQty,
                  r.valuePkr,
                  r.receivedAt,
                  r.ageDays,
                  r.bucket,
                ]),
              )
            }
            columns={[
              { key: "sku", header: "SKU", className: "font-mono text-xs" },
              { key: "name", header: "Product" },
              { key: "batchNumber", header: "Batch", className: "font-mono text-xs" },
              { key: "expiryDate", header: "Expiry", render: (r) => formatDate(r.expiryDate) },
              { key: "warehouseName", header: "Warehouse", render: (r) => r.warehouseName ?? "—" },
              {
                key: "quantity",
                header: "Available",
                className: "text-right tabular-nums",
                render: (r) => formatQty(r.quantity),
              },
              {
                key: "valuePkr",
                header: "Value",
                className: "text-right tabular-nums",
                render: (r) => formatPkr(r.valuePkr),
              },
              { key: "receivedAt", header: "Received", render: (r) => formatDate(r.receivedAt) },
              {
                key: "ageDays",
                header: "Age (days)",
                className: "text-right tabular-nums",
                render: (r) => formatQty(r.ageDays),
              },
              { key: "bucket", header: "Bucket" },
            ]}
          />
          <DistPagination
            page={aging.data?.items.page ?? agingPage}
            pageSize={aging.data?.items.pageSize ?? 50}
            total={aging.data?.items.total ?? 0}
            totalPages={aging.data?.items.totalPages}
            onPageChange={setAgingPage}
          />
        </DistWidgetSection>
      ) : null}

      {report === "valuation" ? (
        <>
          <DistWidgetSection
            title="Valuation summary"
            isLoading={valuationSummary.isLoading}
            isError={valuationSummary.isError}
            error={valuationSummary.error}
            onRetry={() => void valuationSummary.refetch()}
          >
            {valuationSummary.data ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DistKpiCard
                    label="Available stock value"
                    value={formatPkr(valuationSummary.data.availableValuePkr)}
                    hint={`${formatQty(valuationSummary.data.availableQty)} units`}
                  />
                  <DistKpiCard
                    label="Physical stock value"
                    value={formatPkr(valuationSummary.data.physicalValuePkr)}
                    hint={`${formatQty(valuationSummary.data.physicalQty)} units incl. held buckets`}
                  />
                  <DistKpiCard
                    label="Near expiry value"
                    value={formatPkr(valuationSummary.data.nearExpiryValuePkr)}
                    tone={valuationSummary.data.nearExpiryValuePkr > 0 ? "warning" : "default"}
                  />
                  <DistKpiCard
                    label="Expired value"
                    value={formatPkr(valuationSummary.data.expiredValuePkr)}
                    tone={valuationSummary.data.expiredValuePkr > 0 ? "danger" : "success"}
                  />
                  <DistKpiCard label="Damaged" value={formatPkr(valuationSummary.data.damagedValuePkr)} />
                  <DistKpiCard label="Quarantine" value={formatPkr(valuationSummary.data.quarantineValuePkr)} />
                  <DistKpiCard label="Blocked" value={formatPkr(valuationSummary.data.blockedValuePkr)} />
                  <DistKpiCard
                    label="Batches valued"
                    value={formatQty(valuationSummary.data.batchesValued)}
                    hint={`${formatQty(valuationSummary.data.batchesMissingCost)} with no cost · ${formatQty(valuationSummary.data.fallbackUsedCount)} using a fallback cost`}
                    tone={valuationSummary.data.batchesMissingCost > 0 ? "warning" : "default"}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Costing method: {valuationSummary.data.costingMethod}. {valuationSummary.data.note}
                </p>
              </>
            ) : null}
          </DistWidgetSection>

          <DistWidgetSection
            title="By warehouse"
            isLoading={valuationByWarehouse.isLoading}
            isError={valuationByWarehouse.isError}
            error={valuationByWarehouse.error}
            onRetry={() => void valuationByWarehouse.refetch()}
            isEmpty={valuationByWarehouse.data?.length === 0}
            emptyTitle="No warehouse holds stock"
          >
            <DistDataTable
              rowKey={(r) => r.warehouseId ?? "unassigned"}
              rows={valuationByWarehouse.data ?? []}
              empty="No warehouse holds stock"
              columns={[
                {
                  key: "warehouseName",
                  header: "Warehouse",
                  render: (r) => (r.warehouseCode ? `${r.warehouseName} (${r.warehouseCode})` : r.warehouseName),
                },
                {
                  key: "availableQty",
                  header: "Available",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.availableQty),
                },
                {
                  key: "availableValuePkr",
                  header: "Available value",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.availableValuePkr),
                },
                {
                  key: "physicalValuePkr",
                  header: "Physical value",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.physicalValuePkr),
                },
                {
                  key: "batchCount",
                  header: "Batches",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.batchCount),
                },
              ]}
            />
          </DistWidgetSection>

          <DistWidgetSection
            title="By company"
            isLoading={valuationByCompany.isLoading}
            isError={valuationByCompany.isError}
            error={valuationByCompany.error}
            onRetry={() => void valuationByCompany.refetch()}
            isEmpty={valuationByCompany.data?.length === 0}
            emptyTitle="No company holds stock"
          >
            <DistDataTable
              rowKey={(r) => r.companyId ?? "unassigned"}
              rows={valuationByCompany.data ?? []}
              empty="No company holds stock"
              columns={[
                { key: "companyName", header: "Company" },
                {
                  key: "skuCount",
                  header: "SKUs",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.skuCount),
                },
                {
                  key: "availableQty",
                  header: "Available",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.availableQty),
                },
                {
                  key: "availableValuePkr",
                  header: "Available value",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.availableValuePkr),
                },
                {
                  key: "batchCount",
                  header: "Batches",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.batchCount),
                },
              ]}
            />
          </DistWidgetSection>

          <DistWidgetSection
            title="Valuation by product"
            isLoading={valuationReport.isLoading}
            isError={valuationReport.isError}
            error={valuationReport.error}
            onRetry={() => void valuationReport.refetch()}
            isEmpty={valuationReport.data?.items.length === 0}
            emptyTitle="No product matches these filters"
          >
            <DistDataTable
              rowKey={(r) => r.medicineId}
              rows={valuationReport.data?.items ?? []}
              empty="No product matches these filters"
              onExport={() =>
                exportRowsToCsv(
                  "valuation-by-product.csv",
                  ["SKU", "Product", "Company", "Unit", "Available", "Physical", "Unit cost PKR", "Available value PKR", "Cost source"],
                  (valuationReport.data?.items ?? []).map((r) => [
                    r.sku,
                    r.name,
                    r.companyName ?? "",
                    r.unit,
                    r.availableQty,
                    r.physicalQty,
                    r.unitCostPkr,
                    r.availableValuePkr,
                    r.costSource,
                  ]),
                )
              }
              columns={[
                { key: "sku", header: "SKU", className: "font-mono text-xs" },
                {
                  key: "name",
                  header: "Product",
                  render: (r) => (
                    <Link
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      to={`/pops/distribution/inventory/product/${r.medicineId}`}
                    >
                      {r.name}
                    </Link>
                  ),
                },
                { key: "companyName", header: "Company", render: (r) => r.companyName ?? "—" },
                {
                  key: "availableQty",
                  header: "Available",
                  className: "text-right tabular-nums",
                  render: (r) => `${formatQty(r.availableQty)} ${r.unit}`,
                },
                {
                  key: "physicalQty",
                  header: "Physical",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.physicalQty),
                },
                {
                  key: "unitCostPkr",
                  header: "Unit cost",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.unitCostPkr),
                },
                {
                  key: "availableValuePkr",
                  header: "Value",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.availableValuePkr),
                },
                {
                  key: "costSource",
                  header: "Cost source",
                  render: (r) => COST_SOURCE_LABELS[r.costSource] ?? r.costSource,
                },
              ]}
            />
            <DistPagination
              page={valuationReport.data?.page ?? valuationPage}
              pageSize={valuationReport.data?.pageSize ?? 50}
              total={valuationReport.data?.total ?? 0}
              totalPages={valuationReport.data?.totalPages}
              onPageChange={setValuationPage}
            />
          </DistWidgetSection>
        </>
      ) : null}

      {report === "integrity" ? (
        <>
          <DistPanel title="These checks report drift — they never repair it">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              These two tools are <strong>read-only</strong>. Reconciliation compares the cached stock figure, the
              sum of batch quantities and the net of the stock ledger and <strong>reports</strong> any drift — it
              does not repair it. Correcting a discrepancy is a deliberate act: post a stock adjustment, or run a
              stock count and post its variance, so the correction lands in the ledger with an author and a reason.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link to="/pops/distribution/stock-adjustments">
                <DistButton variant="secondary">Open stock adjustments</DistButton>
              </Link>
              <Link to="/pops/distribution/stock-count">
                <DistButton variant="secondary">Open stock count</DistButton>
              </Link>
            </div>
          </DistPanel>

          <DistWidgetSection
            title="Stock reconciliation"
            subtitle={
              reconcile.data
                ? `${formatQty(reconcile.data.discrepancyCount)} discrepancies across ${formatQty(reconcile.data.checkedSkus)} SKUs checked`
                : undefined
            }
            isLoading={reconcile.isLoading}
            isError={reconcile.isError}
            error={reconcile.error}
            onRetry={() => void reconcile.refetch()}
            isEmpty={reconcile.data?.items.items.length === 0}
            emptyTitle="No drift found"
            emptyDescription="The cached stock figure, the batch quantities and the ledger all agree."
          >
            <DistDataTable
              rowKey={(r) => r.medicineId}
              rows={reconcile.data?.items.items ?? []}
              empty="No drift found"
              onExport={() =>
                exportRowsToCsv(
                  "stock-reconciliation.csv",
                  ["SKU", "Product", "Cached stock", "Batch sum", "Cache drift", "Ledger net", "Ledger drift", "Note"],
                  (reconcile.data?.items.items ?? []).map((r) => [
                    r.sku,
                    r.name,
                    r.cachedCurrentStock,
                    r.batchSumQuantity,
                    r.cacheDrift,
                    r.ledgerNetQuantity,
                    r.ledgerDrift,
                    r.note,
                  ]),
                )
              }
              columns={[
                { key: "sku", header: "SKU", className: "font-mono text-xs" },
                {
                  key: "name",
                  header: "Product",
                  render: (r) => (
                    <Link
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      to={`/pops/distribution/inventory/product/${r.medicineId}`}
                    >
                      {r.name}
                    </Link>
                  ),
                },
                {
                  key: "cachedCurrentStock",
                  header: "Cached",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.cachedCurrentStock),
                },
                {
                  key: "batchSumQuantity",
                  header: "Batch sum",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.batchSumQuantity),
                },
                {
                  key: "cacheDrift",
                  header: "Cache drift",
                  className: "text-right tabular-nums",
                  render: (r) =>
                    r.cacheDrift === 0 ? (
                      "0"
                    ) : (
                      <span className="font-semibold text-red-700 dark:text-red-400">{formatQty(r.cacheDrift)}</span>
                    ),
                },
                {
                  key: "ledgerNetQuantity",
                  header: "Ledger net",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.ledgerNetQuantity),
                },
                {
                  key: "ledgerDrift",
                  header: "Ledger drift",
                  className: "text-right tabular-nums",
                  render: (r) =>
                    r.ledgerDrift === 0 ? (
                      "0"
                    ) : (
                      <span className="font-semibold text-red-700 dark:text-red-400">{formatQty(r.ledgerDrift)}</span>
                    ),
                },
                { key: "note", header: "Note" },
              ]}
            />
            <DistPagination
              page={reconcile.data?.items.page ?? reconcilePage}
              pageSize={reconcile.data?.items.pageSize ?? 50}
              total={reconcile.data?.items.total ?? 0}
              totalPages={reconcile.data?.items.totalPages}
              onPageChange={setReconcilePage}
            />
          </DistWidgetSection>

          <DistWidgetSection
            title="Inventory data quality"
            subtitle="Structural problems in the inventory data that no amount of counting will fix."
            isLoading={dataQuality.isLoading}
            isError={dataQuality.isError}
            error={dataQuality.error}
            onRetry={() => void dataQuality.refetch()}
            isEmpty={dataQuality.data?.length === 0}
            emptyTitle="No data quality issues"
          >
            <DistDataTable
              rowKey={(r) => r.check}
              rows={dataQuality.data ?? []}
              empty="No data quality issues"
              columns={[
                { key: "check", header: "Check", render: (r) => r.check.replace(/_/g, " ") },
                {
                  key: "severity",
                  header: "Severity",
                  render: (r) => <DistStatusBadge status={r.severity} tone={SEVERITY_TONES[r.severity] ?? "neutral"} />,
                },
                {
                  key: "count",
                  header: "Affected",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.count),
                },
                { key: "description", header: "What it means" },
              ]}
            />
          </DistWidgetSection>
        </>
      ) : null}

      {settings.isError ? (
        <p className="text-xs text-slate-500">
          Inventory settings could not be loaded ({errorMessage(settings.error, "unknown error")}), so the default
          windows shown as placeholders are unavailable. The reports themselves still use the server-side settings.
        </p>
      ) : null}
    </DistPageShell>
  );
}
