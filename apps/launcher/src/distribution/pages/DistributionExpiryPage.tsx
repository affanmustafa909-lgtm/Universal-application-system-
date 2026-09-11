import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { batchesApi } from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import { DistWidgetSection } from "../components/DistWidgetSection";
import {
  BatchStatusBadge,
  WarehouseFilter,
  formatDate,
  formatQty,
  useCompanyOptions,
} from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistKpiCard,
  DistPageShell,
  DistSelect,
  exportRowsToCsv,
} from "../ui/DistUi";

const EXPIRED_BUCKET = "expired";

export function DistributionExpiryPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const [searchParams] = useSearchParams();

  const [warehouseId, setWarehouseId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [bucket, setBucket] = useState(searchParams.get("bucket") ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expiredPage, setExpiredPage] = useState(1);

  const companies = useCompanyOptions();

  const buckets = useQuery({
    queryKey: ["distribution", "expiry-buckets", branchCode, warehouseId, companyId],
    enabled: Boolean(branchCode),
    queryFn: () =>
      batchesApi.expiryBuckets({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        companyId: companyId || undefined,
      }),
  });

  const list = useQuery({
    queryKey: ["distribution", "expiring-batches", branchCode, warehouseId, bucket, page, pageSize],
    enabled: Boolean(branchCode),
    queryFn: () =>
      batchesApi.expiringBatches({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        bucket: bucket || undefined,
        page,
        pageSize,
      }),
  });

  const expired = useQuery({
    queryKey: ["distribution", "expired-batches", branchCode, warehouseId, expiredPage],
    enabled: Boolean(branchCode),
    queryFn: () =>
      batchesApi.expiringBatches({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        bucket: EXPIRED_BUCKET,
        page: expiredPage,
        pageSize: 25,
      }),
  });

  const bucketRows = buckets.data?.buckets ?? [];
  const rows = list.data?.items ?? [];

  const exportPage = () =>
    exportRowsToCsv(
      `expiring-batches-${bucket || "near-expiry"}-page-${page}.csv`,
      ["Batch", "SKU", "Product", "Warehouse", "Expiry", "Days left", "Available", "Value PKR", "Status"],
      rows.map((r) => [
        r.batchNumber,
        r.medicineSku,
        r.medicineName,
        r.warehouseName ?? "Unassigned",
        r.expiryDate,
        r.daysToExpiry,
        r.quantity,
        r.valuePkr,
        r.derivedStatus,
      ]),
    );

  return (
    <DistPageShell
      title="Expiry"
      subtitle="Expiry buckets are configured in inventory settings, so the bands below reflect this branch's policy rather than a fixed list."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Inventory", to: "/pops/distribution/inventory" },
        { label: "Expiry" },
      ]}
      actions={
        <>
          <WarehouseFilter
            branchCode={branchCode}
            value={warehouseId}
            onChange={(next) => {
              setWarehouseId(next);
              setPage(1);
              setExpiredPage(1);
            }}
            className="min-w-[12rem]"
          />
          <DistSelect
            className="min-w-[10rem]"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">All companies</option>
            {(companies.data?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DistSelect>
        </>
      }
      error={!branch ? "Select a branch to load expiry exposure." : null}
    >
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        Expired stock is <strong>not</strong> removed automatically. It stays on the batch, excluded from sale
        but still carrying value, until an authorised stock adjustment writes it off. Raise an{" "}
        <Link to="/pops/distribution/stock-adjustments" className="underline">
          expiry or write-off adjustment
        </Link>{" "}
        to move it out of the available bucket.
      </div>

      <DistWidgetSection
        title="Expiry buckets"
        subtitle="Click a bucket to filter the batch list below."
        isLoading={buckets.isLoading}
        isError={buckets.isError}
        error={buckets.error}
        onRetry={() => void buckets.refetch()}
        isEmpty={!buckets.isLoading && !buckets.isError && bucketRows.length === 0}
        emptyTitle="No batches to bucket"
        emptyDescription="This branch has no batch rows in the selected scope."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setBucket("");
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                bucket === ""
                  ? "border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
                  : "border-slate-300 text-slate-600 hover:border-cyan-400 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              Near expiry (settings window)
            </button>
            {bucketRows.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => {
                  setBucket(b.label);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  bucket === b.label
                    ? "border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
                    : "border-slate-300 text-slate-600 hover:border-cyan-400 dark:border-slate-700 dark:text-slate-300"
                }`}
              >
                {b.label} · {formatQty(b.batchCount)} batches · {formatPkr(b.valuePkr)}
              </button>
            ))}
          </div>
          {buckets.data ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <DistKpiCard
                label="Near-expiry value"
                value={formatPkr(buckets.data.totalNearExpiryValuePkr)}
                tone={buckets.data.totalNearExpiryValuePkr > 0 ? "warning" : "default"}
              />
              <DistKpiCard
                label="Expired value still held"
                value={formatPkr(buckets.data.expired.valuePkr)}
                tone={buckets.data.expired.batchCount > 0 ? "danger" : "success"}
                hint={`${formatQty(buckets.data.expired.batchCount)} batches · ${formatQty(buckets.data.expired.quantity)} units`}
              />
            </div>
          ) : null}
        </div>
      </DistWidgetSection>

      <DistWidgetSection
        title={bucket ? `Batches in “${bucket}”` : "Batches inside the near-expiry window"}
        subtitle="Only batches that still hold physical stock are listed."
        action={
          <DistButton variant="secondary" disabled={rows.length === 0} onClick={exportPage}>
            Export page
          </DistButton>
        }
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={() => void list.refetch()}
      >
        <div className="space-y-2">
          <DistDataTable
            rowKey={(r) => r.id}
            rows={rows}
            empty={bucket ? `No batches fall in “${bucket}”` : "No batches are inside the near-expiry window"}
            columns={[
              { key: "batchNumber", header: "Batch", className: "font-mono text-xs" },
              { key: "medicineName", header: "Product", render: (r) => r.medicineName },
              { key: "medicineSku", header: "SKU", className: "font-mono text-xs", render: (r) => r.medicineSku },
              { key: "warehouseName", header: "Warehouse", render: (r) => r.warehouseName ?? "Unassigned" },
              { key: "expiryDate", header: "Expiry", render: (r) => formatDate(r.expiryDate) },
              {
                key: "daysToExpiry",
                header: "Days left",
                className: "text-right tabular-nums",
                render: (r) => formatQty(r.daysToExpiry),
              },
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
              {
                key: "derivedStatus",
                header: "Status",
                render: (r) => <BatchStatusBadge status={r.derivedStatus} />,
              },
              {
                key: "actions",
                header: "",
                render: (r) => (
                  <Link to={`/pops/distribution/inventory/product/${r.medicineId}`}>
                    <DistButton variant="ghost" className="px-2 py-1 text-xs">
                      Open
                    </DistButton>
                  </Link>
                ),
              },
            ]}
          />
          <DistPagination
            page={list.data?.page ?? page}
            pageSize={list.data?.pageSize ?? pageSize}
            total={list.data?.total ?? 0}
            totalPages={list.data?.totalPages}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </div>
      </DistWidgetSection>

      <DistWidgetSection
        title="Expired stock"
        subtitle="Already past expiry and blocked from sale. Still valued until an authorised adjustment writes it off."
        isLoading={expired.isLoading}
        isError={expired.isError}
        error={expired.error}
        onRetry={() => void expired.refetch()}
      >
        <div className="space-y-2">
          <DistDataTable
            rowKey={(r) => r.id}
            rows={expired.data?.items ?? []}
            empty="No expired batch is holding stock"
            columns={[
              { key: "batchNumber", header: "Batch", className: "font-mono text-xs" },
              { key: "medicineName", header: "Product", render: (r) => r.medicineName },
              { key: "warehouseName", header: "Warehouse", render: (r) => r.warehouseName ?? "Unassigned" },
              { key: "expiryDate", header: "Expired on", render: (r) => formatDate(r.expiryDate) },
              {
                key: "daysToExpiry",
                header: "Days overdue",
                className: "text-right tabular-nums",
                render: (r) => formatQty(Math.abs(r.daysToExpiry)),
              },
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
                key: "valuePkr",
                header: "Value at risk",
                className: "text-right tabular-nums",
                render: (r) => formatPkr(r.valuePkr),
              },
            ]}
          />
          <DistPagination
            page={expired.data?.page ?? expiredPage}
            pageSize={expired.data?.pageSize ?? 25}
            total={expired.data?.total ?? 0}
            totalPages={expired.data?.totalPages}
            onPageChange={setExpiredPage}
          />
        </div>
      </DistWidgetSection>
    </DistPageShell>
  );
}
