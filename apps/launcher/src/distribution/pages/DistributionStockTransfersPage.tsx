import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  TRANSFER_STATUSES,
  transfersApi,
  type TransferLineInput,
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

/**
 * Server-enforced transitions. Only actions the backend would accept for the
 * current status are rendered.
 */
const ALLOWED: Record<string, { submit: boolean; approve: boolean; dispatch: boolean; receive: boolean; cancel: boolean }> = {
  draft: { submit: true, approve: false, dispatch: false, receive: false, cancel: true },
  submitted: { submit: false, approve: true, dispatch: false, receive: false, cancel: true },
  approved: { submit: false, approve: false, dispatch: true, receive: false, cancel: true },
  dispatched: { submit: false, approve: false, dispatch: false, receive: true, cancel: false },
  received: { submit: false, approve: false, dispatch: false, receive: true, cancel: false },
  completed: { submit: false, approve: false, dispatch: false, receive: false, cancel: false },
  cancelled: { submit: false, approve: false, dispatch: false, receive: false, cancel: false },
};

const NO_ACTIONS = { submit: false, approve: false, dispatch: false, receive: false, cancel: false };

type DraftLine = {
  key: string;
  medicine: PickedMedicine;
  batchId: string;
  quantity: string;
  notes: string;
};

const STATUS_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "info",
  dispatched: "warning",
  received: "info",
  completed: "success",
  cancelled: "danger",
};

export function DistributionStockTransfersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([
    ["distribution", "stock-transfers"],
    ["distribution", "inventory-dashboard"],
    ["distribution", "inventory-stock"],
  ]);

  const [status, setStatus] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [createFrom, setCreateFrom] = useState("");
  const [createTo, setCreateTo] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [cancelReason, setCancelReason] = useState("");
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  const resetPage = () => setPage(1);

  const list = useQuery({
    queryKey: [
      "distribution",
      "stock-transfers",
      branchCode,
      status,
      fromWarehouseId,
      toWarehouseId,
      q,
      from,
      to,
      page,
      pageSize,
    ],
    enabled: Boolean(branchCode),
    queryFn: () =>
      transfersApi.list({
        branchCode: branchCode!,
        status: status || undefined,
        fromWarehouseId: fromWarehouseId || undefined,
        toWarehouseId: toWarehouseId || undefined,
        q: q || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize,
      }),
  });

  const detail = useQuery({
    queryKey: ["distribution", "stock-transfer-detail", branchCode, detailId],
    enabled: Boolean(branchCode) && Boolean(detailId),
    queryFn: () => transfersApi.detail(detailId!, { branchCode: branchCode! }),
  });

  const afterMutation = () => {
    setActionError(null);
    invalidate();
    void list.refetch();
    void detail.refetch();
  };

  const onMutationError = (fallback: string) => (e: unknown) =>
    setActionError(errorMessage(e, fallback));

  const create = useMutation({
    mutationFn: () => {
      const payload: TransferLineInput[] = lines.map((l) => ({
        medicineId: l.medicine.id,
        batchId: l.batchId || undefined,
        quantity: Number(l.quantity),
        notes: l.notes.trim() || undefined,
      }));
      return transfersApi.create({
        branchCode: branchCode!,
        fromWarehouseId: createFrom,
        toWarehouseId: createTo,
        reason: createReason.trim() || undefined,
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
    onError: onMutationError("Failed to create the transfer"),
  });

  const submit = useMutation({
    mutationFn: (id: string) => transfersApi.submit(id, { branchCode: branchCode! }),
    onSuccess: afterMutation,
    onError: onMutationError("Failed to submit the transfer"),
  });

  const approve = useMutation({
    mutationFn: (id: string) => transfersApi.approve(id, { branchCode: branchCode! }),
    onSuccess: afterMutation,
    onError: onMutationError("Failed to approve the transfer"),
  });

  const dispatch = useMutation({
    mutationFn: (id: string) => transfersApi.dispatch(id, { branchCode: branchCode! }),
    onSuccess: afterMutation,
    onError: onMutationError("Failed to dispatch the transfer"),
  });

  const receive = useMutation({
    mutationFn: (input: { id: string; lines?: { lineId: string; receivedQuantity: number }[] }) =>
      transfersApi.receive(input.id, { branchCode: branchCode!, lines: input.lines }),
    onSuccess: () => {
      setReceiveQty({});
      afterMutation();
    },
    onError: onMutationError("Failed to receive the transfer"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      transfersApi.cancel(id, { branchCode: branchCode!, reason: cancelReason.trim() }),
    onSuccess: () => {
      setCancelReason("");
      afterMutation();
    },
    onError: onMutationError("Failed to cancel the transfer"),
  });

  const transfer = detail.data;
  const allowed = transfer ? (ALLOWED[transfer.status] ?? NO_ACTIONS) : NO_ACTIONS;
  const busy =
    submit.isPending || approve.isPending || dispatch.isPending || receive.isPending || cancel.isPending;

  const createValid =
    Boolean(branchCode) &&
    Boolean(createFrom) &&
    Boolean(createTo) &&
    createFrom !== createTo &&
    lines.length > 0 &&
    lines.every((l) => Number(l.quantity) > 0 && Number.isInteger(Number(l.quantity)));

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
      title="Stock transfers"
      subtitle="Warehouse-to-warehouse movements. Stock leaves the source on dispatch and lands at the destination on receipt; a shortage is recorded on the line, never written off."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Inventory", to: "/pops/distribution/inventory" },
        { label: "Stock transfers" },
      ]}
      actions={
        <DistButton
          disabled={!branchCode}
          onClick={() => {
            setActionError(null);
            setCreateOpen(true);
          }}
        >
          + New transfer
        </DistButton>
      }
      error={!branch ? "Select a branch to load stock transfers." : null}
    >
      {list.isError ? (
        <DistErrorBanner
          message={errorMessage(list.error, "Failed to load stock transfers")}
          onRetry={() => void list.refetch()}
        />
      ) : null}
      {actionError ? <DistErrorBanner message={actionError} /> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1 min-w-[10rem]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              resetPage();
            }}
          >
            <option value="">All statuses</option>
            {TRANSFER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          From warehouse
          <WarehouseFilter
            branchCode={branchCode}
            value={fromWarehouseId}
            onChange={(next) => {
              setFromWarehouseId(next);
              resetPage();
            }}
            className="mt-1 min-w-[12rem]"
          />
        </label>
        <label className="text-xs text-slate-500">
          To warehouse
          <WarehouseFilter
            branchCode={branchCode}
            value={toWarehouseId}
            onChange={(next) => {
              setToWarehouseId(next);
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
            placeholder="Transfer number, reason, notes…"
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
        empty="No transfers match these filters"
        onRowClick={(r) => {
          setDetailId(r.id);
          setActionError(null);
          setReceiveQty({});
        }}
        columns={[
          { key: "transferNumber", header: "Number", className: "font-mono text-xs" },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} tone={STATUS_TONES[r.status] ?? "neutral"} />,
          },
          { key: "transferDate", header: "Date", render: (r) => formatDate(r.transferDate) },
          {
            key: "route",
            header: "Route",
            render: (r) => `${r.fromWarehouseName ?? "—"} → ${r.toWarehouseName ?? "—"}`,
          },
          {
            key: "lineCount",
            header: "Lines",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.lineCount),
          },
          {
            key: "totalQuantity",
            header: "Qty",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.totalQuantity),
          },
          {
            key: "totalReceivedQuantity",
            header: "Received",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.totalReceivedQuantity),
          },
          {
            key: "totalShortage",
            header: "Shortage",
            className: "text-right tabular-nums",
            render: (r) =>
              r.totalShortage > 0 ? (
                <span className="font-semibold text-red-700 dark:text-red-400">{formatQty(r.totalShortage)}</span>
              ) : (
                "—"
              ),
          },
          {
            key: "totalValuePkr",
            header: "Value",
            className: "text-right tabular-nums",
            render: (r) => formatPkr(r.totalValuePkr),
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
        open={Boolean(detailId)}
        title={transfer ? `Transfer ${transfer.transferNumber}` : "Transfer"}
        subtitle={transfer ? `${transfer.fromBranch.name} → ${transfer.toBranch.name}` : undefined}
        widthClass="max-w-3xl"
        onClose={() => setDetailId(null)}
        footer={
          transfer ? (
            <>
              {allowed.submit ? (
                <DistButton variant="secondary" disabled={busy} onClick={() => submit.mutate(transfer.id)}>
                  Submit
                </DistButton>
              ) : null}
              {allowed.approve ? (
                <DistButton variant="secondary" disabled={busy} onClick={() => approve.mutate(transfer.id)}>
                  Approve
                </DistButton>
              ) : null}
              {allowed.dispatch ? (
                <DistButton disabled={busy} onClick={() => dispatch.mutate(transfer.id)}>
                  Dispatch
                </DistButton>
              ) : null}
              {allowed.receive ? (
                <DistButton
                  disabled={busy}
                  onClick={() =>
                    receive.mutate({
                      id: transfer.id,
                      lines: transfer.lines.map((l) => ({
                        lineId: l.id,
                        receivedQuantity:
                          receiveQty[l.id] === undefined || receiveQty[l.id] === ""
                            ? l.receivedQuantity
                            : Math.max(0, Math.floor(Number(receiveQty[l.id]))),
                      })),
                    })
                  }
                >
                  Record receipt
                </DistButton>
              ) : null}
              {allowed.cancel ? (
                <DistButton
                  variant="ghost"
                  disabled={busy || !cancelReason.trim()}
                  onClick={() => cancel.mutate(transfer.id)}
                >
                  Cancel transfer
                </DistButton>
              ) : null}
            </>
          ) : null
        }
      >
        {detail.isError ? (
          <DistErrorBanner
            message={errorMessage(detail.error, "Failed to load the transfer")}
            onRetry={() => void detail.refetch()}
          />
        ) : detail.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : transfer ? (
          <div className="space-y-4">
            <dl>
              <DistDrawerField
                label="Status"
                value={<DistStatusBadge status={transfer.status} tone={STATUS_TONES[transfer.status] ?? "neutral"} />}
              />
              <DistDrawerField label="Date" value={formatDate(transfer.transferDate)} />
              <DistDrawerField
                label="From"
                value={`${transfer.fromWarehouseName ?? "—"} (${transfer.fromWarehouseCode ?? "—"})`}
              />
              <DistDrawerField
                label="To"
                value={`${transfer.toWarehouseName ?? "—"} (${transfer.toWarehouseCode ?? "—"})`}
              />
              <DistDrawerField label="Reason" value={transfer.reason} />
              <DistDrawerField label="Notes" value={transfer.notes} />
              <DistDrawerField label="Cancel reason" value={transfer.cancelReason} />
              <DistDrawerField label="Quantity" value={formatQty(transfer.totalQuantity)} />
              <DistDrawerField label="Received" value={formatQty(transfer.totalReceivedQuantity)} />
              <DistDrawerField
                label="Shortage"
                value={
                  transfer.totalShortage > 0 ? (
                    <span className="font-semibold text-red-700 dark:text-red-400">
                      {formatQty(transfer.totalShortage)}
                    </span>
                  ) : (
                    "None"
                  )
                }
              />
              <DistDrawerField label="Value" value={formatPkr(transfer.totalValuePkr)} />
              <DistDrawerField label="Submitted" value={formatDateTime(transfer.submittedAt)} />
              <DistDrawerField label="Approved" value={formatDateTime(transfer.approvedAt)} />
              <DistDrawerField label="Dispatched" value={formatDateTime(transfer.dispatchedAt)} />
              <DistDrawerField label="Received at" value={formatDateTime(transfer.receivedAt)} />
              <DistDrawerField label="Completed" value={formatDateTime(transfer.completedAt)} />
            </dl>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lines</h3>
              <DistDataTable
                rowKey={(r) => r.id}
                rows={transfer.lines}
                empty="This transfer has no lines"
                columns={[
                  { key: "medicineSku", header: "SKU", className: "font-mono text-xs" },
                  { key: "medicineName", header: "Product" },
                  { key: "batchNumber", header: "Batch", render: (r) => r.batchNumber ?? "FEFO" },
                  { key: "expiryDate", header: "Expiry", render: (r) => formatDate(r.expiryDate) },
                  {
                    key: "quantity",
                    header: "Sent",
                    className: "text-right tabular-nums",
                    render: (r) => `${formatQty(r.quantity)} ${r.unit}`,
                  },
                  {
                    key: "receivedQuantity",
                    header: "Received",
                    className: "text-right tabular-nums",
                    render: (r) => formatQty(r.receivedQuantity),
                  },
                  {
                    key: "shortage",
                    header: "Shortage",
                    className: "text-right tabular-nums",
                    render: (r) =>
                      r.shortage > 0 ? (
                        <span className="font-semibold text-red-700 dark:text-red-400">{formatQty(r.shortage)}</span>
                      ) : (
                        "—"
                      ),
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

            {allowed.receive ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Record received quantities
                </h3>
                <p className="text-xs text-slate-500">
                  Enter the running total received per line, not a delta. A received quantity cannot be lowered
                  — correct an over-receipt with a stock adjustment. Leaving a line blank keeps its current
                  received quantity.
                </p>
                <div className="space-y-2">
                  {transfer.lines.map((line) => {
                    const raw = receiveQty[line.id];
                    const entered = raw === undefined || raw === "" ? line.receivedQuantity : Number(raw);
                    const shortage = Math.max(0, line.quantity - (Number.isFinite(entered) ? entered : 0));
                    return (
                      <div key={line.id} className="flex flex-wrap items-end gap-2 text-xs">
                        <div className="min-w-[12rem] flex-1">
                          <div className="font-medium text-slate-800 dark:text-slate-200">{line.medicineName}</div>
                          <div className="text-slate-500">
                            {line.medicineSku} · sent {formatQty(line.quantity)} {line.unit} · batch{" "}
                            {line.batchNumber ?? "—"}
                          </div>
                        </div>
                        <DistInput
                          className="w-28"
                          type="number"
                          min={line.receivedQuantity}
                          max={line.quantity}
                          value={raw ?? String(line.receivedQuantity)}
                          onChange={(e) => setReceiveQty((prev) => ({ ...prev, [line.id]: e.target.value }))}
                        />
                        <span
                          className={
                            shortage > 0
                              ? "font-semibold text-red-700 dark:text-red-400"
                              : "text-emerald-700 dark:text-emerald-400"
                          }
                        >
                          {shortage > 0 ? `Shortage ${formatQty(shortage)}` : "Complete"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {allowed.cancel ? (
              <label className="block text-xs text-slate-500">
                Cancellation reason (required)
                <DistInput
                  className="mt-1"
                  value={cancelReason}
                  placeholder="Why is this transfer being cancelled?"
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </label>
            ) : null}

            {transfer.status === "dispatched" || transfer.status === "received" ? (
              <p className="text-xs text-slate-500">
                Stock has already left the source warehouse, so this transfer can no longer be cancelled. It
                must be received, with any shortage left visible on the line.
              </p>
            ) : null}
          </div>
        ) : null}
      </DistMasterDrawer>

      <DistMasterDrawer
        open={createOpen}
        title="New stock transfer"
        subtitle="Created as a draft. Stock only moves on dispatch."
        widthClass="max-w-3xl"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <DistButton variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </DistButton>
            <DistButton disabled={!createValid || create.isPending} onClick={() => create.mutate()}>
              Create draft
            </DistButton>
          </>
        }
      >
        <div className="space-y-4">
          {create.isError ? (
            <DistErrorBanner message={errorMessage(create.error, "Failed to create the transfer")} />
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Source warehouse
              <WarehouseFilter
                branchCode={branchCode}
                value={createFrom}
                onChange={setCreateFrom}
                includeAll={false}
                className="mt-1"
              />
            </label>
            <label className="text-xs text-slate-500">
              Destination warehouse
              <WarehouseFilter
                branchCode={branchCode}
                value={createTo}
                onChange={setCreateTo}
                includeAll={false}
                className="mt-1"
              />
            </label>
            <label className="text-xs text-slate-500">
              Reason
              <DistInput className="mt-1" value={createReason} onChange={(e) => setCreateReason(e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">
              Notes
              <DistInput className="mt-1" value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} />
            </label>
          </div>

          {createFrom && createTo && createFrom === createTo ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              Source and destination warehouse must differ.
            </p>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add products</h3>
            <MedicineMultiPicker branchCode={branchCode} onAdd={addLines} />
            <p className="text-[11px] text-slate-500">Or add one at a time:</p>
            <MedicinePicker branchCode={branchCode} onPick={addLine} />
          </section>

          {lines.length === 0 ? (
            <p className="text-xs text-slate-500">
              No lines yet. A transfer needs at least one line with a positive whole quantity.
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
                      Batch (optional — FEFO when blank)
                      <div className="mt-1">
                        <BatchPicker
                          branchCode={branchCode}
                          medicineId={line.medicine.id}
                          warehouseId={createFrom || undefined}
                          value={line.batchId}
                          onChange={(batchId) => patchLine(line.key, { batchId })}
                        />
                      </div>
                    </label>
                    <label className="text-xs text-slate-500">
                      Quantity
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
