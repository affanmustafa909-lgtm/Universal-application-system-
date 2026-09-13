import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ADJUSTMENT_STATUSES,
  ADJUSTMENT_TYPES,
  ADJUSTMENT_TYPES_REQUIRING_BATCH,
  adjustmentsApi,
  type AdjustmentLineInput,
  type AdjustmentType,
} from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import {
  BatchPicker,
  MedicineMultiPicker,
  MedicinePicker,
  WarehouseFilter,
  errorMessage,
  formatDate,
  formatDateTime,
  formatQty,
  type PickedMedicine,
} from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

const ALLOWED: Record<string, { submit: boolean; approve: boolean; reject: boolean }> = {
  draft: { submit: true, approve: false, reject: true },
  pending_approval: { submit: false, approve: true, reject: true },
  approved: { submit: false, approve: true, reject: false },
  rejected: { submit: false, approve: false, reject: false },
  posted: { submit: false, approve: false, reject: false },
  cancelled: { submit: false, approve: false, reject: false },
};

const NO_ACTIONS = { submit: false, approve: false, reject: false };

const STATUS_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "info",
  rejected: "danger",
  posted: "success",
  cancelled: "danger",
};

const TYPE_EFFECTS: Record<AdjustmentType, string> = {
  increase: "Adds units to the available bucket.",
  decrease: "Removes units from the available bucket.",
  write_off: "Removes units from the available bucket.",
  damage: "Moves units from available into the damaged bucket. A batch is required.",
  expiry: "Moves units from available into the blocked bucket. A batch is required.",
  quarantine: "Moves units from available into quarantine. A batch is required.",
  release: "Moves units from quarantine back into available. A batch is required.",
};

type DraftLine = {
  key: string;
  medicine: PickedMedicine;
  batchId: string;
  quantity: string;
  notes: string;
};

export function DistributionStockAdjustmentsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([
    ["distribution", "stock-adjustments"],
    ["distribution", "inventory-dashboard"],
    ["distribution", "inventory-stock"],
  ]);

  const [status, setStatus] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [createType, setCreateType] = useState<AdjustmentType>("decrease");
  const [createWarehouse, setCreateWarehouse] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const resetPage = () => setPage(1);
  const batchRequired = ADJUSTMENT_TYPES_REQUIRING_BATCH.includes(createType);

  const list = useQuery({
    queryKey: [
      "distribution",
      "stock-adjustments",
      branchCode,
      status,
      adjustmentType,
      warehouseId,
      q,
      from,
      to,
      page,
      pageSize,
    ],
    enabled: Boolean(branchCode),
    queryFn: () =>
      adjustmentsApi.list({
        branchCode: branchCode!,
        status: status || undefined,
        adjustmentType: adjustmentType || undefined,
        warehouseId: warehouseId || undefined,
        q: q || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize,
      }),
  });

  const detail = useQuery({
    queryKey: ["distribution", "stock-adjustment-detail", branchCode, detailId],
    enabled: Boolean(branchCode) && Boolean(detailId),
    queryFn: () => adjustmentsApi.detail(detailId!, { branchCode: branchCode! }),
  });

  const afterMutation = () => {
    setActionError(null);
    invalidate();
    void list.refetch();
    void detail.refetch();
  };

  const onMutationError = (fallback: string) => (e: unknown) => setActionError(errorMessage(e, fallback));

  const create = useMutation({
    mutationFn: () => {
      const payload: AdjustmentLineInput[] = lines.map((l) => ({
        medicineId: l.medicine.id,
        batchId: l.batchId || null,
        quantity: Number(l.quantity),
        notes: l.notes.trim() || null,
      }));
      return adjustmentsApi.create({
        branchCode: branchCode!,
        warehouseId: createWarehouse,
        adjustmentType: createType,
        reason: createReason.trim(),
        notes: createNotes.trim() || undefined,
        lines: payload,
      });
    },
    onSuccess: (created) => {
      setCreateOpen(false);
      setLines([]);
      setCreateReason("");
      setCreateNotes("");
      setDetailId(created.id);
      afterMutation();
    },
    onError: onMutationError("Failed to create the adjustment"),
  });

  const submit = useMutation({
    mutationFn: (id: string) => adjustmentsApi.submit(id, { branchCode: branchCode! }),
    onSuccess: afterMutation,
    onError: onMutationError("Failed to submit the adjustment"),
  });

  const approve = useMutation({
    mutationFn: (id: string) => adjustmentsApi.approve(id, { branchCode: branchCode! }),
    onSuccess: afterMutation,
    onError: onMutationError("Failed to approve the adjustment"),
  });

  const reject = useMutation({
    mutationFn: (id: string) =>
      adjustmentsApi.reject(id, { branchCode: branchCode!, reason: rejectReason.trim() }),
    onSuccess: () => {
      setRejectReason("");
      afterMutation();
    },
    onError: onMutationError("Failed to reject the adjustment"),
  });

  const adjustment = detail.data;
  const allowed = adjustment ? (ALLOWED[adjustment.status] ?? NO_ACTIONS) : NO_ACTIONS;
  const busy = submit.isPending || approve.isPending || reject.isPending;

  const createValid =
    Boolean(branchCode) &&
    Boolean(createWarehouse) &&
    Boolean(createReason.trim()) &&
    lines.length > 0 &&
    lines.every(
      (l) =>
        Number(l.quantity) > 0 &&
        Number.isInteger(Number(l.quantity)) &&
        (!batchRequired || Boolean(l.batchId)),
    );

  const addLine = (medicine: PickedMedicine) =>
    setLines((prev) => [
      ...prev,
      { key: `${medicine.id}-${prev.length}-${Date.now()}`, medicine, batchId: "", quantity: "1", notes: "" },
    ]);
  const addLines = (medicines: PickedMedicine[]) => medicines.forEach(addLine);

  const patchLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <DistPageShell
      title="Stock adjustments"
      subtitle="Stock is never changed silently. Every correction is a numbered document with a mandatory reason, an approval trail and one ledger entry per line."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Inventory", to: "/pops/distribution/inventory" },
        { label: "Stock adjustments" },
      ]}
      actions={
        <DistButton
          disabled={!branchCode}
          onClick={() => {
            setActionError(null);
            setCreateOpen(true);
          }}
        >
          + New adjustment
        </DistButton>
      }
      error={!branch ? "Select a branch to load stock adjustments." : null}
    >
      {list.isError ? (
        <DistErrorBanner
          message={errorMessage(list.error, "Failed to load stock adjustments")}
          onRetry={() => void list.refetch()}
        />
      ) : null}
      {actionError ? <DistErrorBanner message={actionError} /> : null}

      <div className="flex flex-wrap items-end gap-2">
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
            <option value="">All statuses</option>
            {ADJUSTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          Type
          <DistSelect
            className="mt-1 min-w-[10rem]"
            value={adjustmentType}
            onChange={(e) => {
              setAdjustmentType(e.target.value);
              resetPage();
            }}
          >
            <option value="">All types</option>
            {ADJUSTMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </DistSelect>
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
          From date
          <DistInput className="mt-1" type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
        </label>
        <label className="text-xs text-slate-500">
          To date
          <DistInput className="mt-1" type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
        </label>
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 min-w-[12rem]"
            placeholder="Number, reason, notes…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
          />
        </label>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        rows={list.data?.items ?? []}
        empty="No adjustments match these filters"
        onRowClick={(r) => {
          setDetailId(r.id);
          setActionError(null);
        }}
        columns={[
          { key: "adjustmentNumber", header: "Number", className: "font-mono text-xs" },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} tone={STATUS_TONES[r.status] ?? "neutral"} />,
          },
          { key: "adjustmentType", header: "Type", render: (r) => r.adjustmentType.replace(/_/g, " ") },
          { key: "warehouseName", header: "Warehouse", render: (r) => r.warehouseName ?? "—" },
          { key: "reason", header: "Reason", render: (r) => r.reason },
          {
            key: "lineCount",
            header: "Lines",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.lineCount),
          },
          {
            key: "totalQuantity",
            header: "Net qty",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.totalQuantity),
          },
          {
            key: "totalValuePkr",
            header: "Value",
            className: "text-right tabular-nums",
            render: (r) => formatPkr(r.totalValuePkr),
          },
          { key: "createdAt", header: "Created", render: (r) => formatDate(r.createdAt) },
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
        open={Boolean(detailId)}
        title={adjustment ? `Adjustment ${adjustment.adjustmentNumber}` : "Adjustment"}
        subtitle={adjustment ? adjustment.adjustmentType.replace(/_/g, " ") : undefined}
        widthClass="max-w-3xl"
        onClose={() => setDetailId(null)}
        footer={
          adjustment ? (
            <>
              {allowed.submit ? (
                <DistButton variant="secondary" disabled={busy} onClick={() => submit.mutate(adjustment.id)}>
                  Submit
                </DistButton>
              ) : null}
              {allowed.approve ? (
                <DistButton disabled={busy} onClick={() => approve.mutate(adjustment.id)}>
                  Approve &amp; post
                </DistButton>
              ) : null}
              {allowed.reject ? (
                <DistButton
                  variant="ghost"
                  disabled={busy || !rejectReason.trim()}
                  onClick={() => reject.mutate(adjustment.id)}
                >
                  Reject
                </DistButton>
              ) : null}
            </>
          ) : null
        }
      >
        {detail.isError ? (
          <DistErrorBanner
            message={errorMessage(detail.error, "Failed to load the adjustment")}
            onRetry={() => void detail.refetch()}
          />
        ) : detail.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : adjustment ? (
          <div className="space-y-4">
            <dl>
              <DistDrawerField
                label="Status"
                value={
                  <DistStatusBadge status={adjustment.status} tone={STATUS_TONES[adjustment.status] ?? "neutral"} />
                }
              />
              <DistDrawerField label="Type" value={adjustment.adjustmentType.replace(/_/g, " ")} />
              <DistDrawerField
                label="Warehouse"
                value={`${adjustment.warehouseName ?? "—"} (${adjustment.warehouseCode ?? "—"})`}
              />
              <DistDrawerField label="Reason" value={adjustment.reason} />
              <DistDrawerField label="Notes" value={adjustment.notes} />
              <DistDrawerField label="Reject reason" value={adjustment.rejectReason} />
              <DistDrawerField label="Net quantity" value={formatQty(adjustment.totalQuantity)} />
              <DistDrawerField label="Value" value={formatPkr(adjustment.totalValuePkr)} />
              <DistDrawerField
                label="Approval"
                value={
                  adjustment.requiresApproval
                    ? "Needs a second person to approve before it touches stock"
                    : "Posts straight away under this branch's approval policy"
                }
              />
              <DistDrawerField label="Approved" value={formatDateTime(adjustment.approvedAt)} />
              <DistDrawerField label="Rejected" value={formatDateTime(adjustment.rejectedAt)} />
              <DistDrawerField label="Posted" value={formatDateTime(adjustment.postedAt)} />
            </dl>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lines</h3>
              <DistDataTable
                rowKey={(r) => r.id}
                rows={adjustment.lines}
                empty="This adjustment has no lines"
                columns={[
                  { key: "medicineSku", header: "SKU", className: "font-mono text-xs" },
                  { key: "medicineName", header: "Product" },
                  { key: "batchNumber", header: "Batch", render: (r) => r.batchNumber ?? "—" },
                  { key: "expiryDate", header: "Expiry", render: (r) => formatDate(r.expiryDate) },
                  {
                    key: "quantity",
                    header: "Qty",
                    className: "text-right tabular-nums",
                    render: (r) =>
                      r.quantity > 0 ? `+${formatQty(r.quantity)} ${r.unit}` : `${formatQty(r.quantity)} ${r.unit}`,
                  },
                  { key: "stockState", header: "Target bucket", render: (r) => r.stockState },
                  {
                    key: "unitCostPkr",
                    header: "Unit cost",
                    className: "text-right tabular-nums",
                    render: (r) => formatPkr(r.unitCostPkr),
                  },
                  {
                    key: "valuePkr",
                    header: "Value",
                    className: "text-right tabular-nums",
                    render: (r) => formatPkr(r.valuePkr),
                  },
                ]}
              />
            </section>

            {allowed.reject ? (
              <label className="block text-xs text-slate-500">
                Rejection reason (required)
                <DistInput
                  className="mt-1"
                  value={rejectReason}
                  placeholder="Why is this adjustment being rejected?"
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </label>
            ) : null}

            {adjustment.status === "posted" ? (
              <p className="text-xs text-slate-500">
                Posted documents are immutable. Correct a mistake with a new adjustment in the opposite
                direction so both movements stay in the ledger.
              </p>
            ) : null}
          </div>
        ) : null}
      </DistMasterDrawer>

      <DistMasterDrawer
        open={createOpen}
        title="New stock adjustment"
        subtitle="Created as a draft. Stock only moves when the document is posted."
        widthClass="max-w-3xl"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <DistButton disabled={!createValid || create.isPending} onClick={() => create.mutate()}>
              Create draft
            </DistButton>
          </>
        }
      >
        <div className="space-y-4">
          {create.isError ? (
            <DistErrorBanner message={errorMessage(create.error, "Failed to create the adjustment")} />
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Adjustment type
              <DistSelect
                className="mt-1"
                value={createType}
                onChange={(e) => setCreateType(e.target.value as AdjustmentType)}
              >
                {ADJUSTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </DistSelect>
            </label>
            <label className="text-xs text-slate-500">
              Warehouse
              <WarehouseFilter
                branchCode={branchCode}
                value={createWarehouse}
                onChange={setCreateWarehouse}
                includeAll={false}
                className="mt-1"
              />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Reason <span className="font-semibold text-red-600 dark:text-red-400">(required)</span>
              <DistInput
                className="mt-1"
                value={createReason}
                placeholder="Stock is never adjusted without a reason"
                onChange={(e) => setCreateReason(e.target.value)}
              />
              {!createReason.trim() ? (
                <span className="mt-1 block text-red-600 dark:text-red-400">
                  The backend rejects an adjustment with no reason.
                </span>
              ) : null}
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Notes
              <DistInput className="mt-1" value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} />
            </label>
          </div>

          <p className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {TYPE_EFFECTS[createType]}
          </p>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add products</h3>
            <MedicineMultiPicker branchCode={branchCode} onAdd={addLines} />
            <p className="text-[11px] text-slate-500">Or add one at a time:</p>
            <MedicinePicker branchCode={branchCode} onPick={addLine} />
          </section>

          {lines.length === 0 ? (
            <p className="text-xs text-slate-500">
              No lines yet. An adjustment needs at least one line with a positive whole quantity.
            </p>
          ) : (
            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="space-y-2 rounded-md border border-slate-200 p-2 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{line.medicine.name}</div>
                      <div className="font-mono text-slate-500">{line.medicine.sku}</div>
                    </div>
                    <DistButton
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    >
                      Remove
                    </DistButton>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="text-xs text-slate-500">
                      Batch{batchRequired ? " (required)" : " (optional)"}
                      <div className="mt-1">
                        <BatchPicker
                          branchCode={branchCode}
                          medicineId={line.medicine.id}
                          warehouseId={createWarehouse || undefined}
                          value={line.batchId}
                          onChange={(batchId) => patchLine(line.key, { batchId })}
                          required={batchRequired}
                          stockMode="adjustable"
                        />
                      </div>
                      {batchRequired && !line.batchId ? (
                        <span className="mt-1 block text-red-600 dark:text-red-400">
                          A “{createType.replace(/_/g, " ")}” adjustment requires a batch on every line.
                        </span>
                      ) : null}
                    </label>
                    <label className="text-xs text-slate-500">
                      Quantity (magnitude)
                      <DistInput
                        className="mt-1"
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-500">
                      Line notes
                      <DistInput
                        className="mt-1"
                        value={line.notes}
                        onChange={(e) => patchLine(line.key, { notes: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
