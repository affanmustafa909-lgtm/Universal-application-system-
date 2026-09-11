import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BATCH_HOLD_STATUSES,
  BATCH_STATUS_FILTERS,
  batchesApi,
} from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import {
  BatchStatusBadge,
  WarehouseFilter,
  errorMessage,
  formatDate,
  formatDateTime,
  formatQty,
  useCompanyOptions,
} from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
  exportRowsToCsv,
} from "../ui/DistUi";

const STATUS_LABELS: Record<string, string> = {
  all: "All batches",
  active: "Active with stock",
  hold: "On hold",
  expired: "Expired",
  near_expiry: "Near expiry",
  zero: "Depleted",
};

const SORTS = ["expiry_asc", "expiry_desc", "qty_desc", "medicine_asc", "created_desc"] as const;

const SORT_LABELS: Record<string, string> = {
  expiry_asc: "Expiry (soonest)",
  expiry_desc: "Expiry (latest)",
  qty_desc: "Quantity (high→low)",
  medicine_asc: "Product (A→Z)",
  created_desc: "Newest received",
};

export function DistributionBatchesPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const [searchParams] = useSearchParams();
  const invalidate = useInvalidatePharmacy([
    ["distribution", "inventory-batches"],
    ["distribution", "inventory-dashboard"],
  ]);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [expiringInDays, setExpiringInDays] = useState("");
  const [sort, setSort] = useState("expiry_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [holdStatus, setHoldStatus] = useState("blocked");
  const [holdReason, setHoldReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const companies = useCompanyOptions();
  const resetPage = () => setPage(1);

  const days = Number(expiringInDays);
  const expiringFilter =
    expiringInDays.trim() && Number.isFinite(days) && days >= 0 ? Math.floor(days) : undefined;

  const list = useQuery({
    queryKey: [
      "distribution",
      "inventory-batches",
      branchCode,
      warehouseId,
      companyId,
      status,
      expiringFilter,
      sort,
      q,
      page,
      pageSize,
    ],
    enabled: Boolean(branchCode),
    queryFn: () =>
      batchesApi.list({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        companyId: companyId || undefined,
        status,
        expiringInDays: expiringFilter,
        sort,
        q: q || undefined,
        page,
        pageSize,
      }),
  });

  const detail = useQuery({
    queryKey: ["distribution", "batch-detail", branchCode, drawerId],
    enabled: Boolean(branchCode) && Boolean(drawerId),
    queryFn: () => batchesApi.detail(drawerId!, { branchCode: branchCode! }),
  });

  const setHold = useMutation({
    mutationFn: (input: { batchId: string; status: string; reason?: string }) =>
      batchesApi.setHold(input.batchId, {
        branchCode: branchCode!,
        status: input.status,
        reason: input.reason,
      }),
    onSuccess: () => {
      setActionError(null);
      setHoldReason("");
      invalidate();
      void list.refetch();
      void detail.refetch();
    },
    onError: (e: unknown) => setActionError(errorMessage(e, "Failed to update the batch hold")),
  });

  const rows = list.data?.items ?? [];

  const exportPage = () =>
    exportRowsToCsv(
      `batches-page-${page}.csv`,
      [
        "Batch",
        "SKU",
        "Product",
        "Company",
        "Warehouse",
        "Manufactured",
        "Expiry",
        "Days to expiry",
        "Available",
        "Physical",
        "Reserved",
        "Damaged",
        "Quarantine",
        "Blocked",
        "Cost PKR",
        "Value PKR",
        "Raw status",
        "Derived status",
        "Hold reason",
      ],
      rows.map((r) => [
        r.batchNumber,
        r.medicineSku,
        r.medicineName,
        r.companyName ?? "",
        r.warehouseName ?? "Unassigned",
        r.manufacturingDate ?? "",
        r.expiryDate,
        r.daysToExpiry,
        r.quantity,
        r.physicalQty,
        r.reservedQuantity,
        r.damagedQuantity,
        r.quarantineQuantity,
        r.blockedQuantity,
        r.purchaseRatePkr,
        r.valuePkr,
        r.status,
        r.derivedStatus,
        r.holdReason ?? "",
      ]),
    );

  const batch = detail.data;
  const isOnHold = Boolean(batch && batch.status.toLowerCase() !== "active");

  return (
    <DistPageShell
      title="Batches"
      subtitle="Batch register with derived status, traceability and manual hold. Holds flag the batch only — quantities move through stock adjustments."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Inventory", to: "/pops/distribution/inventory" },
        { label: "Batches" },
      ]}
      error={!branch ? "Select a branch to load batches." : null}
    >
      {list.isError ? (
        <DistErrorBanner message={errorMessage(list.error, "Failed to load batches")} onRetry={() => void list.refetch()} />
      ) : null}
      {actionError ? <DistErrorBanner message={actionError} /> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 min-w-[14rem]"
            placeholder="Batch number, product, SKU…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
          />
        </label>
        <label className="text-xs text-slate-500">
          Warehouse
          <WarehouseFilter
            branchCode={branchCode}
            value={warehouseId}
            onChange={(next) => {
              setWarehouseId(next);
              resetPage();
            }}
            className="mt-1 min-w-[12rem]"
          />
        </label>
        <label className="text-xs text-slate-500">
          Company
          <DistSelect
            className="mt-1 min-w-[10rem]"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              resetPage();
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
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1 min-w-[11rem]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              resetPage();
            }}
          >
            {BATCH_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          Expiring within (days)
          <DistInput
            className="mt-1 w-28"
            type="number"
            min={0}
            placeholder="Any"
            value={expiringInDays}
            onChange={(e) => {
              setExpiringInDays(e.target.value);
              resetPage();
            }}
          />
        </label>
        <label className="text-xs text-slate-500">
          Sort
          <DistSelect
            className="mt-1 min-w-[11rem]"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              resetPage();
            }}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </DistSelect>
        </label>
        <DistButton variant="secondary" disabled={rows.length === 0} onClick={exportPage}>
          Export page
        </DistButton>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        rows={rows}
        empty="No batches match these filters"
        onRowClick={(r) => {
          setDrawerId(r.id);
          setActionError(null);
        }}
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
            key: "physicalQty",
            header: "Physical",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.physicalQty),
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
        page={list.data?.page ?? page}
        pageSize={list.data?.pageSize ?? pageSize}
        total={list.data?.total ?? 0}
        totalPages={list.data?.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          resetPage();
        }}
      />

      <DistMasterDrawer
        open={Boolean(drawerId)}
        title={batch ? `Batch ${batch.batchNumber}` : "Batch"}
        subtitle={batch ? `${batch.medicineName} · ${batch.medicineSku}` : undefined}
        widthClass="max-w-2xl"
        onClose={() => setDrawerId(null)}
        footer={
          batch ? (
            <>
              {isOnHold ? (
                <DistButton
                  disabled={setHold.isPending}
                  onClick={() => setHold.mutate({ batchId: batch.id, status: "active" })}
                >
                  Release hold
                </DistButton>
              ) : (
                <DistButton
                  disabled={setHold.isPending || !holdReason.trim()}
                  onClick={() =>
                    setHold.mutate({ batchId: batch.id, status: holdStatus, reason: holdReason.trim() })
                  }
                >
                  Place on hold
                </DistButton>
              )}
            </>
          ) : null
        }
      >
        {detail.isError ? (
          <DistErrorBanner
            message={errorMessage(detail.error, "Failed to load the batch")}
            onRetry={() => void detail.refetch()}
          />
        ) : detail.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : batch ? (
          <div className="space-y-4">
            <dl>
              <DistDrawerField label="Status" value={<BatchStatusBadge status={batch.derivedStatus} />} />
              <DistDrawerField label="Raw status" value={batch.status} />
              <DistDrawerField label="Hold reason" value={batch.holdReason} />
              <DistDrawerField label="Company" value={batch.companyName} />
              <DistDrawerField label="Warehouse" value={batch.warehouseName ?? "Unassigned (legacy)"} />
              <DistDrawerField label="Manufactured" value={formatDate(batch.manufacturingDate)} />
              <DistDrawerField
                label="Expiry"
                value={`${formatDate(batch.expiryDate)} (${formatQty(batch.daysToExpiry)} days)`}
              />
              <DistDrawerField label="Available" value={formatQty(batch.quantity)} />
              <DistDrawerField label="Physical" value={formatQty(batch.physicalQty)} />
              <DistDrawerField label="Reserved" value={formatQty(batch.reservedQuantity)} />
              <DistDrawerField label="Damaged" value={formatQty(batch.damagedQuantity)} />
              <DistDrawerField label="Quarantine" value={formatQty(batch.quarantineQuantity)} />
              <DistDrawerField label="Blocked" value={formatQty(batch.blockedQuantity)} />
              <DistDrawerField label="Purchase rate" value={formatPkr(batch.purchaseRatePkr)} />
              <DistDrawerField label="Sale rate" value={formatPkr(batch.saleRatePkr)} />
              <DistDrawerField label="Value" value={formatPkr(batch.valuePkr)} />
            </dl>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Traceability</h3>
              <dl>
                <DistDrawerField label="Supplier" value={batch.traceability.supplierName} />
                <DistDrawerField label="GRN" value={batch.traceability.grnNumber} />
                <DistDrawerField label="Received" value={formatDateTime(batch.traceability.receivedAt)} />
              </dl>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Who received this batch
              </h3>
              <p className="text-xs text-slate-500">
                Customers invoiced from this exact batch — the recall contact list.
              </p>
              <DistDataTable
                rowKey={(r) => `${r.invoiceId}-${r.quantity}`}
                rows={batch.traceability.soldToCustomers}
                empty="This batch has not been invoiced to any customer"
                columns={[
                  { key: "invoiceNumber", header: "Invoice", className: "font-mono text-xs" },
                  { key: "invoiceDate", header: "Date", render: (r) => formatDate(r.invoiceDate) },
                  { key: "customerName", header: "Customer", render: (r) => r.customerName ?? "—" },
                  {
                    key: "quantity",
                    header: "Qty",
                    className: "text-right tabular-nums",
                    render: (r) => formatQty(r.quantity),
                  },
                ]}
              />
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active reservations
              </h3>
              <DistDataTable
                rowKey={(r) => r.id}
                rows={batch.reservations}
                empty="No active reservation holds stock from this batch"
                columns={[
                  { key: "referenceType", header: "Reference", render: (r) => `${r.referenceType} · ${r.referenceId}` },
                  {
                    key: "quantity",
                    header: "Qty",
                    className: "text-right tabular-nums",
                    render: (r) => formatQty(r.quantity),
                  },
                  { key: "createdAt", header: "Created", render: (r) => formatDateTime(r.createdAt) },
                  { key: "expiresAt", header: "Expires", render: (r) => formatDateTime(r.expiresAt) },
                ]}
              />
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Movements</h3>
              <DistDataTable
                rowKey={(r) => r.id}
                rows={batch.movements}
                empty="No ledger rows reference this batch"
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
                  {
                    key: "quantityDelta",
                    header: "Qty",
                    className: "text-right tabular-nums",
                    render: (r) =>
                      r.quantityDelta > 0 ? `+${formatQty(r.quantityDelta)}` : formatQty(r.quantityDelta),
                  },
                  { key: "userName", header: "By", render: (r) => r.userName ?? "—" },
                ]}
              />
            </section>

            {isOnHold ? (
              <p className="text-xs text-slate-500">
                Releasing clears the hold flag and the hold reason. Quantities are not moved — use a stock
                adjustment to move units between buckets.
              </p>
            ) : (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Place on hold</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs text-slate-500">
                    Hold status
                    <DistSelect
                      className="mt-1"
                      value={holdStatus}
                      onChange={(e) => setHoldStatus(e.target.value)}
                    >
                      {BATCH_HOLD_STATUSES.filter((s) => s !== "active").map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </DistSelect>
                  </label>
                  <label className="text-xs text-slate-500">
                    Reason (required)
                    <DistInput
                      className="mt-1"
                      value={holdReason}
                      placeholder="Why is this batch being held?"
                      onChange={(e) => setHoldReason(e.target.value)}
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  A hold stops the batch being allocated to sales. It does not move quantities out of the
                  available bucket.
                </p>
              </section>
            )}

            <Link
              to={`/pops/distribution/inventory/product/${batch.medicineId}`}
              className="inline-block text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-400"
            >
              Open product inventory
            </Link>
          </div>
        ) : null}
      </DistMasterDrawer>
    </DistPageShell>
  );
}
