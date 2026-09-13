import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  purchaseApi,
  type PurchaseRequisition,
} from "../../pharmacy/api/pharmacy-purchase";
import { inventoryApi } from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import { WarehouseFilter, errorMessage, formatDateTime } from "../components/DistInventoryShared";
import { usePurchaseCart, usePurchaseProductSearch } from "../purchase";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

const DIST = "/pops/distribution";

const STATUS_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "info",
  rejected: "danger",
  converted: "success",
  partially_converted: "warning",
  cancelled: "danger",
};

export function DistributionPurchaseRequisitionsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([["distribution", "purchase"]]);
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [warehouseId, setWarehouseId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");
  const cart = usePurchaseCart();
  const search = usePurchaseProductSearch({
    branchCode,
    warehouseId: warehouseId || undefined,
    enabled: createOpen,
  });

  const list = useQuery({
    queryKey: ["distribution", "purchase", "requisitions", branchCode, status, q, page, pageSize],
    enabled: Boolean(branchCode),
    queryFn: () =>
      purchaseApi.listRequisitions({
        branchCode: branchCode!,
        status: status || undefined,
        q: q || undefined,
        page,
        pageSize,
      }),
  });

  const detail = useQuery({
    queryKey: ["distribution", "purchase", "requisition", detailId],
    enabled: Boolean(detailId),
    queryFn: () => purchaseApi.getRequisition(detailId!),
  });

  const after = () => {
    setActionError(null);
    invalidate();
    void list.refetch();
    void detail.refetch();
  };

  const create = useMutation({
    mutationFn: () =>
      purchaseApi.createRequisition({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        priority,
        notes: notes.trim() || undefined,
        lines: cart.lines.map((l) => ({
          medicineId: l.medicineId,
          requestedQty: l.qty,
          suggestedQty: l.qty,
          lastPurchasePricePkr: l.unitCostPkr || undefined,
          notes: l.notes,
        })),
      }),
    onSuccess: (created) => {
      setCreateOpen(false);
      cart.clear();
      setNotes("");
      setDetailId(created.id);
      after();
    },
    onError: (e) => setActionError(errorMessage(e, "Failed to create requisition")),
  });

  const act = useMutation({
    mutationFn: async ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: "submit" | "approve" | "reject" | "convert";
      reason?: string;
    }) => {
      if (action === "submit") return purchaseApi.submitRequisition(id);
      if (action === "approve") return purchaseApi.approveRequisition(id);
      if (action === "reject") return purchaseApi.rejectRequisition(id, reason ?? "Rejected");
      const detail = await purchaseApi.getRequisition(id);
      const supplierId = detail.preferredSupplierId;
      if (!supplierId) {
        throw new Error("Set a preferred supplier on the requisition before converting to a PO");
      }
      return purchaseApi.convertRequisition(id, {
        branchCode: branchCode!,
        supplierId,
        warehouseId: detail.warehouseId ?? undefined,
      });
    },
    onSuccess: after,
    onError: (e) => setActionError(errorMessage(e, "Action failed")),
  });

  const fromReorder = useMutation({
    mutationFn: async () => {
      const reorder = await inventoryApi.reorder({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        page: 1,
        pageSize: 100,
      });
      const items = reorder.items
        .filter((r) => r.suggestedQty > 0)
        .map((r) => ({ medicineId: r.medicineId, quantity: r.suggestedQty }));
      if (!items.length) throw new Error("No reorder suggestions with quantity > 0");
      return purchaseApi.fromReorder({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        mode: "requisition",
        items,
      });
    },
    onSuccess: (doc) => {
      setDetailId(doc.id);
      after();
    },
    onError: (e) => setActionError(errorMessage(e, "Failed to create from reorder")),
  });

  const rows = list.data?.items ?? [];

  const actionsFor = (r: PurchaseRequisition) => {
    const st = r.status;
    return {
      submit: st === "draft",
      approve: st === "submitted",
      reject: st === "submitted" || st === "draft",
      convert: st === "approved" || st === "partially_converted",
    };
  };

  return (
    <DistPageShell
      title="Purchase requisitions"
      subtitle="Demand documents — submit, approve, convert to PO. Raise from Phase 4 reorder."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Purchases", to: `${DIST}/purchase` },
        { label: "Requisitions" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <DistButton
            variant="secondary"
            disabled={!branchCode || fromReorder.isPending}
            onClick={() => fromReorder.mutate()}
          >
            From reorder
          </DistButton>
          <DistButton
            onClick={() => {
              setCreateOpen(true);
              setActionError(null);
            }}
          >
            New requisition
          </DistButton>
        </div>
      }
      error={!branch ? "Select a branch." : null}
    >
      {actionError ? <DistErrorBanner message={actionError} /> : null}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1 block min-w-[10rem]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="converted">Converted</option>
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 block min-w-[12rem]"
            value={q}
            placeholder="REQ#…"
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <DistDataTable
        loading={list.isLoading}
        empty="No requisitions"
        rowKey={(r) => r.id}
        rows={rows}
        onRowClick={(r) => setDetailId(r.id)}
        columns={[
          { key: "reqNumber", header: "REQ#" },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} tone={STATUS_TONES[r.status]} />,
          },
          { key: "priority", header: "Priority", render: (r) => r.priority ?? "—" },
          {
            key: "lines",
            header: "Lines",
            render: (r) => r.lineCount ?? r.lines?.length ?? "—",
          },
          {
            key: "createdAt",
            header: "Created",
            render: (r) => formatDateTime(r.createdAt),
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => {
              const a = actionsFor(r);
              return (
                <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                  {a.submit ? (
                    <DistButton
                      variant="ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: r.id, action: "submit" })}
                    >
                      Submit
                    </DistButton>
                  ) : null}
                  {a.approve ? (
                    <DistButton
                      variant="ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: r.id, action: "approve" })}
                    >
                      Approve
                    </DistButton>
                  ) : null}
                  {a.convert ? (
                    <DistButton
                      variant="ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: r.id, action: "convert" })}
                    >
                      Convert PO
                    </DistButton>
                  ) : null}
                </div>
              );
            },
          },
        ]}
      />

      {list.data ? (
        <DistPagination
          page={list.data.page}
          pageSize={list.data.pageSize}
          total={list.data.total}
          totalPages={list.data.totalPages}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      ) : null}

      <DistMasterDrawer
        open={createOpen}
        title="New requisition"
        subtitle="Search products — do not load the full catalogue."
        widthClass="max-w-xl"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <DistButton
              disabled={!cart.lines.length || create.isPending}
              onClick={() => create.mutate()}
            >
              Save draft
            </DistButton>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs text-slate-500">
            Warehouse
            <div className="mt-1">
              <WarehouseFilter
                branchCode={branchCode}
                value={warehouseId}
                onChange={setWarehouseId}
                includeAll={false}
                allLabel="Select warehouse…"
              />
            </div>
          </label>
          <label className="block text-xs text-slate-500">
            Priority
            <DistSelect className="mt-1" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </DistSelect>
          </label>
          <label className="block text-xs text-slate-500">
            Notes
            <DistInput className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Add product</p>
            <DistInput
              value={search.query}
              placeholder="Search medicine…"
              onChange={(e) => search.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  search.moveHighlight(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  search.moveHighlight(-1);
                } else if (e.key === "Enter" && search.highlighted) {
                  e.preventDefault();
                  cart.add({
                    medicineId: search.highlighted.id,
                    name: search.highlighted.name,
                    sku: search.highlighted.sku,
                    unitCostPkr: search.highlighted.wholesalePricePkr ?? 0,
                    qty: 1,
                  });
                  search.setQuery("");
                }
              }}
            />
            {search.isLoading ? <p className="mt-1 text-xs text-slate-500">Searching…</p> : null}
            {search.results.length > 0 ? (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
                {search.results.map((hit, i) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className={`flex w-full justify-between gap-2 px-2 py-1.5 text-left text-xs ${
                        i === search.highlightIndex ? "bg-cyan-50 dark:bg-cyan-950/40" : ""
                      }`}
                      onClick={() => {
                        cart.add({
                          medicineId: hit.id,
                          name: hit.name,
                          sku: hit.sku,
                          unitCostPkr: hit.wholesalePricePkr ?? 0,
                          qty: 1,
                        });
                        search.setQuery("");
                      }}
                    >
                      <span className="truncate">{hit.name}</span>
                      <span className="font-mono text-slate-500">{hit.sku}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {cart.lines.map((l) => (
              <li key={l.key} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.name}</div>
                  <div className="font-mono text-xs text-slate-500">{l.sku}</div>
                </div>
                <DistInput
                  type="number"
                  min={1}
                  className="w-20"
                  value={l.qty}
                  onChange={(e) => cart.update(l.key, { qty: Number(e.target.value) })}
                />
                <DistButton variant="ghost" onClick={() => cart.remove(l.key)}>
                  Remove
                </DistButton>
              </li>
            ))}
          </ul>
          {!cart.lines.length ? (
            <p className="text-xs text-slate-500">Add at least one product line.</p>
          ) : null}
        </div>
      </DistMasterDrawer>

      <DistMasterDrawer
        open={Boolean(detailId)}
        title={detail.data?.reqNumber ?? "Requisition"}
        subtitle={detail.data?.status}
        widthClass="max-w-lg"
        onClose={() => setDetailId(null)}
        footer={
          detail.data ? (
            <>
              {actionsFor(detail.data).submit ? (
                <DistButton
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: detail.data!.id, action: "submit" })}
                >
                  Submit
                </DistButton>
              ) : null}
              {actionsFor(detail.data).approve ? (
                <DistButton
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: detail.data!.id, action: "approve" })}
                >
                  Approve
                </DistButton>
              ) : null}
              {actionsFor(detail.data).reject ? (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <DistInput
                    className="min-w-[10rem] flex-1"
                    placeholder="Reject reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <DistButton
                    variant="secondary"
                    disabled={act.isPending || !rejectReason.trim()}
                    onClick={() =>
                      act.mutate({
                        id: detail.data!.id,
                        action: "reject",
                        reason: rejectReason.trim(),
                      })
                    }
                  >
                    Reject
                  </DistButton>
                </div>
              ) : null}
              {actionsFor(detail.data).convert ? (
                <DistButton
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: detail.data!.id, action: "convert" })}
                >
                  Convert to PO
                </DistButton>
              ) : null}
              <Link to={`${DIST}/purchase-orders`}>
                <DistButton variant="ghost">Open POs</DistButton>
              </Link>
            </>
          ) : null
        }
      >
        {detail.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {detail.data ? (
          <div className="space-y-3">
            <dl>
              <DistDrawerField label="Status" value={<DistStatusBadge status={detail.data.status} />} />
              <DistDrawerField label="Priority" value={detail.data.priority} />
              <DistDrawerField label="Notes" value={detail.data.notes} />
              {detail.data.rejectReason ? (
                <DistDrawerField label="Reject reason" value={detail.data.rejectReason} />
              ) : null}
            </dl>
            {detail.data.status === "submitted" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                Already submitted — click Approve (then Convert to PO). Do not submit again.
              </p>
            ) : null}
            <ul className="space-y-2 text-sm">
              {(detail.data.lines ?? []).map((l, i) => (
                <li
                  key={l.id ?? `${l.medicineId}-${i}`}
                  className="rounded-md border border-slate-100 px-2 py-1.5 dark:border-slate-800"
                >
                  <div className="font-medium">
                    {l.medicineName ?? l.medicineId}
                    {l.medicineSku ? (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">({l.medicineSku})</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    Qty {l.requestedQty}
                    {l.lastPurchasePricePkr != null
                      ? ` · last ${formatPkr(l.lastPurchasePricePkr)}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DistMasterDrawer>
    </DistPageShell>
  );
}
