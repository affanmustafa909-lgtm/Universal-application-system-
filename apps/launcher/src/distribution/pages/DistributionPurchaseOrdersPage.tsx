import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  purchaseApi,
  type PurchaseOrder,
  type SupplierHit,
} from "../../pharmacy/api/pharmacy-purchase";
import { formatPkr, distLiveListOptions, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import { WarehouseFilter, errorMessage, formatDate, formatDateTime } from "../components/DistInventoryShared";
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
import { printDistDocument } from "../lib/printDistOrder";

const DIST = "/pops/distribution";

const STATUS_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "info",
  sent: "info",
  supplier_confirmed: "success",
  partial: "warning",
  received: "success",
  cancelled: "danger",
};

function actionsFor(status: string) {
  return {
    submit: status === "draft",
    approve: status === "draft" || status === "submitted",
    send: status === "approved",
    confirm: status === "sent" || status === "approved",
    receive: ["approved", "sent", "supplier_confirmed", "partial"].includes(status),
  };
}

export function DistributionPurchaseOrdersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([["distribution", "purchase"]]);
  const [searchParams, setSearchParams] = useSearchParams();

  const focus = searchParams.get("focus");
  const statusParam = searchParams.get("status");

  const [status, setStatus] = useState(() => {
    if (focus === "pending") return "submitted";
    return statusParam ?? "";
  });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [actionError, setActionError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [supplierLabel, setSupplierLabel] = useState("");
  const [supplierQ, setSupplierQ] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [headerTax, setHeaderTax] = useState(0);

  const cart = usePurchaseCart();
  const productSearch = usePurchaseProductSearch({
    branchCode,
    warehouseId: warehouseId || undefined,
    enabled: composerOpen,
  });

  useEffect(() => {
    if (focus === "pending") {
      setStatus((s) => s || "submitted");
    }
  }, [focus]);

  useEffect(() => {
    if (focus !== "new" && focus !== "composer") return;
    setComposerOpen(true);
    const sku = searchParams.get("sku");
    const qParam = searchParams.get("q");
    const seed = (sku || qParam || "").trim();
    if (seed) productSearch.setQuery(seed);
    // only when deep-link opens New PO
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const listStatus = focus === "pending" && !status ? "pending" : status || undefined;

  const list = useQuery({
    queryKey: [
      "distribution",
      "purchase",
      "orders",
      branchCode,
      listStatus,
      q,
      page,
      pageSize,
      focus,
    ],
    enabled: Boolean(branchCode),
    queryFn: () =>
      purchaseApi.listOrders({
        branchCode: branchCode!,
        status: listStatus,
        q: q || undefined,
        page,
        pageSize,
      }),
    ...distLiveListOptions,
  });

  const detail = useQuery({
    queryKey: ["distribution", "purchase", "order", detailId, branchCode],
    enabled: Boolean(detailId) && Boolean(branchCode),
    queryFn: () => purchaseApi.getOrder(detailId!, branchCode),
    ...distLiveListOptions,
  });

  const suppliers = useQuery({
    queryKey: ["distribution", "purchase", "supplier-search", branchCode, supplierQ],
    enabled: Boolean(branchCode) && composerOpen,
    queryFn: () =>
      purchaseApi.searchSuppliers({
        branchCode: branchCode!,
        q: supplierQ.trim() || undefined,
        limit: 30,
      }),
  });

  const after = async () => {
    setActionError(null);
    await invalidate();
    await Promise.all([list.refetch(), detail.refetch()]);
  };

  const saveDraft = useMutation({
    mutationFn: () =>
      purchaseApi.createOrder({
        branchCode: branchCode!,
        supplierId: supplierId || undefined,
        warehouseId: warehouseId || undefined,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        taxPkr: headerTax,
        discountPkr: headerDiscount,
        lines: cart.toApiLines(),
      }),
    onSuccess: (po) => {
      cart.clear();
      setComposerOpen(false);
      setDetailId(po.id);
      after();
    },
    onError: (e) => setActionError(errorMessage(e, "Failed to save PO")),
  });

  const saveSubmit = useMutation({
    mutationFn: () =>
      purchaseApi.createOrder({
        branchCode: branchCode!,
        supplierId: supplierId || undefined,
        warehouseId: warehouseId || undefined,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        taxPkr: headerTax,
        discountPkr: headerDiscount,
        submit: true,
        lines: cart.toApiLines(),
      }),
    onSuccess: (po) => {
      cart.clear();
      setComposerOpen(false);
      setDetailId(po.id);
      after();
    },
    onError: (e) => setActionError(errorMessage(e, "Failed to submit PO")),
  });

  const workflow = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "submit" | "approve" | "send" | "confirm";
    }) => {
      if (action === "submit") return purchaseApi.submitOrder(id);
      if (action === "approve") return purchaseApi.approveOrder(id);
      if (action === "send") return purchaseApi.sendOrder(id);
      return purchaseApi.confirmOrder(id);
    },
    onSuccess: after,
    onError: (e) => setActionError(errorMessage(e, "Workflow action failed")),
  });

  const totalsPreview = useMemo(() => {
    const sub = cart.totals.subtotal;
    return Math.max(0, sub + headerTax - headerDiscount);
  }, [cart.totals.subtotal, headerTax, headerDiscount]);

  function pickSupplier(s: SupplierHit) {
    setSupplierId(s.id);
    setSupplierLabel(s.name);
    setSupplierQ("");
    if (s.paymentTerms) setPaymentTerms(s.paymentTerms);
  }

  function openComposer() {
    setComposerOpen(true);
    setActionError(null);
  }

  function setStatusFilter(next: string) {
    setStatus(next);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (next) params.set("status", next);
    else params.delete("status");
    if (focus === "pending" && next && next !== "submitted") params.delete("focus");
    setSearchParams(params, { replace: true });
  }

  return (
    <DistPageShell
      title="Purchase orders"
      subtitle="Search → qty → rate → save/submit. Approve, send, confirm, then receive via GRN."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Purchases", to: `${DIST}/purchase` },
        { label: "Purchase orders" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/purchase-grn`}>
            <DistButton variant="secondary">Receive GRN</DistButton>
          </Link>
          <DistButton onClick={openComposer}>New PO</DistButton>
        </div>
      }
      error={
        !branch
          ? "Select a branch."
          : list.isError
            ? errorMessage(list.error, "Failed to load purchase orders")
            : null
      }
    >
      {actionError ? <DistErrorBanner message={actionError} onRetry={() => setActionError(null)} /> : null}
      {focus === "pending" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Showing pending purchase work from PS Window. Adjust status filter to broaden the list.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1 block min-w-[11rem]"
            value={status}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending (draft/submitted/receivable)</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="sent">Sent</option>
            <option value="supplier_confirmed">Confirmed</option>
            <option value="partial">Partial</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 block min-w-[12rem]"
            placeholder="PO#…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <DistDataTable
        loading={list.isLoading}
        empty="No purchase orders"
        rowKey={(r) => r.id}
        rows={list.data?.items ?? []}
        onRowClick={(r) => setDetailId(r.id)}
        columns={[
          { key: "poNumber", header: "PO#" },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} tone={STATUS_TONES[r.status]} />,
          },
          {
            key: "supplier",
            header: "Supplier",
            render: (r) => r.supplierName ?? (r.supplierId ? r.supplierId.slice(0, 8) : "—"),
          },
          {
            key: "orderDate",
            header: "Date",
            render: (r) => formatDate(r.orderDate),
          },
          {
            key: "totalPkr",
            header: "Total",
            className: "text-right tabular-nums",
            render: (r) => formatPkr(r.totalPkr ?? 0),
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => {
              const a = actionsFor(r.status);
              return (
                <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                  {a.approve ? (
                    <DistButton
                      variant="ghost"
                      disabled={workflow.isPending}
                      onClick={() => workflow.mutate({ id: r.id, action: "approve" })}
                    >
                      Approve
                    </DistButton>
                  ) : null}
                  {a.receive ? (
                    <Link to={`${DIST}/purchase-grn?poId=${r.id}`}>
                      <DistButton variant="ghost">GRN</DistButton>
                    </Link>
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

      {/* Composer */}
      <DistMasterDrawer
        open={composerOpen}
        title="New purchase order"
        subtitle="Multi-line PO — supplier, warehouse, products."
        widthClass="max-w-2xl"
        onClose={() => setComposerOpen(false)}
        footer={
          <>
            <span className="mr-auto text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {formatPkr(totalsPreview)}
            </span>
            <DistButton
              variant="secondary"
              disabled={!cart.lines.length || saveDraft.isPending}
              onClick={() => saveDraft.mutate()}
            >
              Save draft
            </DistButton>
            <DistButton
              disabled={!cart.lines.length || !supplierId || saveSubmit.isPending}
              onClick={() => saveSubmit.mutate()}
            >
              Submit
            </DistButton>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Supplier</p>
            {supplierId ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700">
                <span>{supplierLabel}</span>
                <DistButton
                  variant="ghost"
                  onClick={() => {
                    setSupplierId("");
                    setSupplierLabel("");
                  }}
                >
                  Change
                </DistButton>
              </div>
            ) : (
              <>
                <DistInput
                  value={supplierQ}
                  placeholder="Search supplier…"
                  onChange={(e) => setSupplierQ(e.target.value)}
                />
                {suppliers.data?.length ? (
                  <ul className="mt-1 max-h-36 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
                    {suppliers.data.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="flex w-full justify-between px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-900"
                          onClick={() => pickSupplier(s)}
                        >
                          <span>{s.name}</span>
                          <span className="text-slate-500">{s.phone ?? ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>

          <label className="block text-xs text-slate-500">
            Warehouse
            <div className="mt-1">
              <WarehouseFilter
                branchCode={branchCode}
                value={warehouseId}
                onChange={setWarehouseId}
                includeAll={false}
              />
            </div>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Expected date
              <DistInput
                type="date"
                className="mt-1"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-500">
              Payment terms
              <DistInput
                className="mt-1"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </label>
          </div>

          <label className="block text-xs text-slate-500">
            Notes
            <DistInput className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Add line</p>
            <DistInput
              value={productSearch.query}
              placeholder="Search product…"
              onChange={(e) => productSearch.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  productSearch.moveHighlight(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  productSearch.moveHighlight(-1);
                } else if (e.key === "Enter" && productSearch.highlighted) {
                  e.preventDefault();
                  cart.add({
                    medicineId: productSearch.highlighted.id,
                    name: productSearch.highlighted.name,
                    sku: productSearch.highlighted.sku,
                    unitCostPkr: productSearch.highlighted.wholesalePricePkr ?? 0,
                    qty: 1,
                  });
                  productSearch.setQuery("");
                }
              }}
            />
            {productSearch.results.length > 0 ? (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
                {productSearch.results.map((hit, i) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className={`flex w-full justify-between gap-2 px-2 py-1.5 text-left text-xs ${
                        i === productSearch.highlightIndex ? "bg-cyan-50 dark:bg-cyan-950/40" : ""
                      }`}
                      onClick={() => {
                        cart.add({
                          medicineId: hit.id,
                          name: hit.name,
                          sku: hit.sku,
                          unitCostPkr: hit.wholesalePricePkr ?? 0,
                          qty: 1,
                        });
                        productSearch.setQuery("");
                      }}
                    >
                      <span className="truncate">{hit.name}</span>
                      <span className="tabular-nums text-slate-500">
                        {hit.wholesalePricePkr != null ? formatPkr(hit.wholesalePricePkr) : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">Qty</th>
                  <th className="px-2 py-1.5">Free</th>
                  <th className="px-2 py-1.5">Rate</th>
                  <th className="px-2 py-1.5">Disc</th>
                  <th className="px-2 py-1.5"> </th>
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((l) => (
                  <tr key={l.key} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{l.name}</div>
                      <div className="font-mono text-slate-500">{l.sku}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        type="number"
                        min={1}
                        className="w-16"
                        value={l.qty}
                        onChange={(e) => cart.update(l.key, { qty: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        type="number"
                        min={0}
                        className="w-16"
                        value={l.freeQty}
                        onChange={(e) => cart.update(l.key, { freeQty: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        type="number"
                        min={0}
                        className="w-20"
                        value={l.unitCostPkr}
                        onChange={(e) => cart.update(l.key, { unitCostPkr: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        type="number"
                        min={0}
                        className="w-16"
                        value={l.discountPkr}
                        onChange={(e) => cart.update(l.key, { discountPkr: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DistButton variant="ghost" onClick={() => cart.remove(l.key)}>
                        ×
                      </DistButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Header discount
              <DistInput
                type="number"
                min={0}
                className="mt-1"
                value={headerDiscount}
                onChange={(e) => setHeaderDiscount(Number(e.target.value))}
              />
            </label>
            <label className="text-xs text-slate-500">
              Header tax
              <DistInput
                type="number"
                min={0}
                className="mt-1"
                value={headerTax}
                onChange={(e) => setHeaderTax(Number(e.target.value))}
              />
            </label>
          </div>
        </div>
      </DistMasterDrawer>

      {/* Detail */}
      <DistMasterDrawer
        open={Boolean(detailId)}
        title={detail.data?.poNumber ?? "Purchase order"}
        subtitle={detail.data?.status}
        widthClass="max-w-lg"
        onClose={() => setDetailId(null)}
        footer={
          detail.data ? (
            <>
              {detail.data.status === "submitted" ? (
                <p className="w-full text-xs text-amber-800 dark:text-amber-200">
                  Submitted — click Approve, then Receive GRN to complete the purchase.
                </p>
              ) : null}
              {actionsFor(detail.data.status).submit ? (
                <DistButton
                  disabled={workflow.isPending}
                  onClick={() => workflow.mutate({ id: detail.data!.id, action: "submit" })}
                >
                  Submit
                </DistButton>
              ) : null}
              {actionsFor(detail.data.status).approve ? (
                <DistButton
                  disabled={workflow.isPending}
                  onClick={() => workflow.mutate({ id: detail.data!.id, action: "approve" })}
                >
                  Approve
                </DistButton>
              ) : null}
              {actionsFor(detail.data.status).send ? (
                <DistButton
                  variant="secondary"
                  disabled={workflow.isPending}
                  onClick={() => workflow.mutate({ id: detail.data!.id, action: "send" })}
                >
                  Mark sent
                </DistButton>
              ) : null}
              {actionsFor(detail.data.status).confirm ? (
                <DistButton
                  variant="secondary"
                  disabled={workflow.isPending}
                  onClick={() => workflow.mutate({ id: detail.data!.id, action: "confirm" })}
                >
                  Confirm
                </DistButton>
              ) : null}
              {actionsFor(detail.data.status).receive ? (
                <Link to={`${DIST}/purchase-grn?poId=${detail.data.id}`}>
                  <DistButton>Receive GRN</DistButton>
                </Link>
              ) : null}
              <DistButton
                variant="secondary"
                onClick={() => {
                  const po = detail.data!;
                  void printDistDocument({
                    title: "Purchase order",
                    documentNumber: String(po.poNumber ?? po.id),
                    partyLabel: "Supplier",
                    partyName: String(po.supplierName ?? po.supplierId ?? "—"),
                    branchName: branch?.name,
                    branchCode: branch?.code,
                    meta: [
                      { label: "Status", value: String(po.status ?? "") },
                      { label: "Date", value: String(po.orderDate ?? "") },
                      { label: "Expected", value: String(po.expectedDate ?? "—") },
                      { label: "Terms", value: String(po.paymentTerms ?? "—") },
                    ],
                    lines: (po.lines ?? []).map((l) => ({
                      label: String(l.medicineName ?? l.medicineId ?? "Item"),
                      qty: Number(l.quantity ?? 0),
                      unitPrice: Number(l.unitCostPkr ?? 0),
                      freeQty: Number(l.freeQuantity ?? 0) || undefined,
                      note: l.medicineSku ? String(l.medicineSku) : undefined,
                    })),
                    totalPkr: Number(po.totalPkr ?? 0),
                    footerNote: "Purchase order — distribution procurement",
                  }).catch((e) => setActionError(errorMessage(e, "Print failed")));
                }}
              >
                Print
              </DistButton>
            </>
          ) : null
        }
      >
        {detail.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {detail.isError ? (
          <DistErrorBanner message={errorMessage(detail.error)} />
        ) : null}
        {detail.data ? <PoDetailBody po={detail.data} /> : null}
      </DistMasterDrawer>
    </DistPageShell>
  );
}

function PoDetailBody({ po }: { po: PurchaseOrder }): JSX.Element {
  return (
    <div className="space-y-3">
      {po.status === "submitted" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Already submitted. Do not submit again — Approve this PO, then open Receive GRN.
        </p>
      ) : null}
      <dl>
        <DistDrawerField
          label="Status"
          value={<DistStatusBadge status={po.status} tone={STATUS_TONES[po.status]} />}
        />
        <DistDrawerField label="Supplier" value={po.supplierName ?? po.supplierId} />
        <DistDrawerField label="Date" value={formatDate(po.orderDate)} />
        <DistDrawerField label="Expected" value={formatDate(po.expectedDate)} />
        <DistDrawerField label="Total" value={formatPkr(po.totalPkr ?? 0)} />
        <DistDrawerField label="Terms" value={po.paymentTerms} />
        <DistDrawerField label="Notes" value={po.notes} />
        <DistDrawerField label="Created" value={formatDateTime(po.createdAt)} />
      </dl>
      <ul className="space-y-2 text-sm">
        {(po.lines ?? []).map((l, i) => (
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
              Qty {l.quantity}
              {l.freeQuantity ? ` +${l.freeQuantity} free` : ""}
              {l.pendingQty != null ? ` · pending ${l.pendingQty}` : ""}
              {" · "}
              {formatPkr(l.unitCostPkr)}
            </div>
          </li>
        ))}
        {!po.lines?.length ? (
          <li className="text-xs text-slate-500">
            Line detail requires Phase 6 order get endpoint (legacy list is headers only).
          </li>
        ) : null}
      </ul>
    </div>
  );
}
