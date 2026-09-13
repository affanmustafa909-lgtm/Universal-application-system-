import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  purchaseApi,
  type PurchaseOrder,
  type PurchaseOrderLine,
} from "../../pharmacy/api/pharmacy-purchase";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import { WarehouseFilter, errorMessage, formatDate } from "../components/DistInventoryShared";
import { SupplierInvoiceSuggest } from "../components/SupplierInvoiceSuggest";
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
import { replaceUuidsInMessage } from "../lib/customerDisplay";

const DIST = "/pops/distribution";

type GrnDraftLine = {
  key: string;
  purchaseOrderLineId?: string;
  medicineId: string;
  medicineName: string;
  orderedQty: number;
  pendingQty: number;
  orderedRate: number;
  quantity: number;
  freeQuantity: number;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  unitCostPkr: number;
};

function newIdempotencyKey(): string {
  return `grn-${crypto.randomUUID()}`;
}

function buildDraftFromPo(po: PurchaseOrder): GrnDraftLine[] {
  return (po.lines ?? [])
    .map((l: PurchaseOrderLine) => {
      const ordered = l.orderedQty ?? l.quantity + (l.freeQuantity ?? 0);
      const pending =
        l.pendingQty ?? Math.max(0, ordered - (l.receivedQty ?? 0));
      if (pending <= 0) return null;
      return {
        key: l.id ?? `${l.medicineId}-${crypto.randomUUID().slice(0, 6)}`,
        purchaseOrderLineId: l.id,
        medicineId: l.medicineId,
        medicineName: l.medicineName ?? l.medicineId,
        orderedQty: ordered,
        pendingQty: pending,
        orderedRate: l.unitCostPkr,
        quantity: pending,
        freeQuantity: 0,
        batchNumber: "",
        manufacturingDate: "",
        expiryDate: "",
        unitCostPkr: l.unitCostPkr,
      } satisfies GrnDraftLine;
    })
    .filter(Boolean) as GrnDraftLine[];
}

export function DistributionPurchaseGrnPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([["distribution", "purchase"]]);
  const [searchParams] = useSearchParams();
  const poIdParam = searchParams.get("poId") ?? "";

  const [poId, setPoId] = useState(poIdParam);
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<GrnDraftLine[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [listPage, setListPage] = useState(1);

  useEffect(() => {
    if (poIdParam) setPoId(poIdParam);
  }, [poIdParam]);

  const receivable = useQuery({
    queryKey: ["distribution", "purchase", "receivable-pos", branchCode],
    enabled: Boolean(branchCode),
    queryFn: async () => {
      const statuses = ["approved", "sent", "supplier_confirmed", "partial"];
      const pages = await Promise.all(
        statuses.map((status) =>
          purchaseApi.listOrders({
            branchCode: branchCode!,
            status,
            page: 1,
            pageSize: 50,
          }),
        ),
      );
      const map = new Map<string, PurchaseOrder>();
      for (const p of pages) {
        for (const item of p.items) map.set(item.id, item);
      }
      return [...map.values()];
    },
  });

  const selectedPo = useQuery({
    queryKey: ["distribution", "purchase", "order-for-grn", poId, branchCode],
    enabled: Boolean(branchCode) && Boolean(poId),
    queryFn: () => purchaseApi.getOrder(poId, branchCode),
  });

  useEffect(() => {
    if (!selectedPo.data) return;
    setLines(buildDraftFromPo(selectedPo.data));
    if (selectedPo.data.warehouseId && !warehouseId) {
      setWarehouseId(selectedPo.data.warehouseId);
    }
    // Keep form on PO change only — do not wipe after failed post
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPo.data?.id, selectedPo.data?.revision, selectedPo.dataUpdatedAt]);

  const grnList = useQuery({
    queryKey: ["distribution", "purchase", "grns", branchCode, listPage],
    enabled: Boolean(branchCode),
    queryFn: () =>
      purchaseApi.listGrns({ branchCode: branchCode!, page: listPage, pageSize: 25 }),
  });

  const variances = useMemo(() => {
    return lines.flatMap((l) => {
      const warnings: string[] = [];
      if (l.quantity > l.pendingQty) {
        warnings.push(`${l.medicineName}: qty ${l.quantity} exceeds pending ${l.pendingQty}`);
      }
      if (l.unitCostPkr !== l.orderedRate) {
        warnings.push(
          `${l.medicineName}: cost ${l.unitCostPkr} vs PO rate ${l.orderedRate}`,
        );
      }
      if (l.expiryDate) {
        const exp = new Date(l.expiryDate);
        if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
          warnings.push(`${l.medicineName}: expiry ${l.expiryDate} is in the past`);
        }
      }
      return warnings;
    });
  }, [lines]);

  const canPost =
    Boolean(branchCode) &&
    Boolean(warehouseId) &&
    Boolean(poId) &&
    lines.length > 0 &&
    lines.every((l) => l.batchNumber.trim() && l.expiryDate && l.quantity > 0);

  const post = useMutation({
    mutationFn: () => {
      const over = lines.find((l) => l.quantity + (l.freeQuantity || 0) > l.pendingQty);
      if (over) {
        throw new Error(
          `Over-receive blocked for ${over.medicineName}: receiving ${over.quantity + (over.freeQuantity || 0)} (qty + free), pending ${over.pendingQty}`,
        );
      }
      return purchaseApi.createGrn({
        branchCode: branchCode!,
        warehouseId,
        purchaseOrderId: poId,
        supplierId: selectedPo.data?.supplierId ?? undefined,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
        receivedDate,
        notes: notes.trim() || undefined,
        idempotencyKey,
        lines: lines.map((l) => ({
          medicineId: l.medicineId,
          purchaseOrderLineId: l.purchaseOrderLineId,
          batchNumber: l.batchNumber.trim(),
          manufacturingDate: l.manufacturingDate || undefined,
          expiryDate: l.expiryDate,
          quantity: l.quantity,
          freeQuantity: l.freeQuantity,
          unitCostPkr: l.unitCostPkr,
        })),
      });
    },
    onSuccess: () => {
      setActionError(null);
      setLines([]);
      setPoId("");
      setSupplierInvoiceNumber("");
      setNotes("");
      setIdempotencyKey(newIdempotencyKey());
      invalidate();
      void grnList.refetch();
      void receivable.refetch();
    },
    onError: (e) => {
      // Do NOT clear the form on failure — operator keeps batch/expiry/qty.
      const nameById = new Map(lines.map((l) => [l.medicineId, l.medicineName]));
      setActionError(replaceUuidsInMessage(errorMessage(e, "GRN post failed"), nameById));
    },
  });

  function updateLine(key: string, patch: Partial<GrnDraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  return (
    <DistPageShell
      title="Receiving (GRN)"
      subtitle="Select PO → batch / mfg / expiry / qty / cost → validate → post. This is goods receiving."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Purchases", to: `${DIST}/purchase` },
        { label: "Receiving / GRN" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/purchase-orders`}>
            <DistButton variant="secondary">Purchase orders</DistButton>
          </Link>
          {selectedPo.data && lines.length > 0 ? (
            <DistButton
              variant="secondary"
              onClick={() => {
                const po = selectedPo.data!;
                void printDistDocument({
                  title: "Goods receipt (GRN draft)",
                  documentNumber: String(po.poNumber ?? po.id),
                  partyLabel: "Supplier",
                  partyName: String(po.supplierName ?? po.supplierId ?? "—"),
                  meta: [
                    { label: "Warehouse", value: warehouseId || "—" },
                    { label: "Received date", value: receivedDate },
                  ],
                  lines: lines.map((l) => ({
                    label: String(l.medicineName ?? l.medicineId),
                    qty: Number(l.quantity || 0),
                    unitPrice: Number(l.unitCostPkr || 0),
                  })),
                  totalPkr: lines.reduce(
                    (s, l) => s + Number(l.quantity || 0) * Number(l.unitCostPkr || 0),
                    0,
                  ),
                }).catch((e) => setActionError(errorMessage(e, "Print failed")));
              }}
            >
              Print draft
            </DistButton>
          ) : null}
        </div>
      }
      error={!branch ? "Select a branch." : null}
    >
      {actionError ? <DistErrorBanner message={actionError} /> : null}

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-500">
            Purchase order
            <DistSelect
              className="mt-1"
              value={poId}
              onChange={(e) => {
                setPoId(e.target.value);
                setActionError(null);
              }}
            >
              <option value="">Select PO…</option>
              {(receivable.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poNumber} · {p.status} · {formatPkr(p.totalPkr ?? 0)}
                </option>
              ))}
            </DistSelect>
          </label>
          <label className="text-xs text-slate-500">
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
          <label className="text-xs text-slate-500">
            Received date
            <DistInput
              type="date"
              className="mt-1"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-500">
            Supplier invoice #
            <div className="mt-1">
              <SupplierInvoiceSuggest
                branchCode={branchCode}
                value={supplierInvoiceNumber}
                onChange={setSupplierInvoiceNumber}
                supplierId={selectedPo.data?.supplierId}
              />
            </div>
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            Notes
            <DistInput className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        {selectedPo.isLoading ? <p className="text-xs text-slate-500">Loading PO lines…</p> : null}
        {selectedPo.isError ? (
          <DistErrorBanner message={errorMessage(selectedPo.error, "Could not load PO")} />
        ) : null}

        {poId && !selectedPo.isLoading && lines.length === 0 ? (
          <p className="text-sm text-slate-500">
            No pending lines on this PO (fully received, or line detail unavailable on legacy API).
          </p>
        ) : null}

        {lines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-2 py-1.5">Product</th>
                  <th className="px-2 py-1.5">Pending</th>
                  <th className="px-2 py-1.5">Qty</th>
                  <th className="px-2 py-1.5">Free</th>
                  <th className="px-2 py-1.5">Batch</th>
                  <th className="px-2 py-1.5">Mfg</th>
                  <th className="px-2 py-1.5">Expiry</th>
                  <th className="px-2 py-1.5">Cost</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1.5 font-medium">{l.medicineName}</td>
                    <td className="px-2 py-1.5 tabular-nums">{l.pendingQty}</td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        type="number"
                        min={1}
                        className="w-16"
                        value={l.quantity}
                        onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        type="number"
                        min={0}
                        className="w-14"
                        value={l.freeQuantity}
                        onChange={(e) =>
                          updateLine(l.key, { freeQuantity: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        className="w-24"
                        value={l.batchNumber}
                        onChange={(e) => updateLine(l.key, { batchNumber: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        type="date"
                        className="w-32"
                        value={l.manufacturingDate}
                        onChange={(e) => updateLine(l.key, { manufacturingDate: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        type="date"
                        className="w-32"
                        value={l.expiryDate}
                        onChange={(e) => updateLine(l.key, { expiryDate: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DistInput
                        type="number"
                        min={0}
                        className="w-20"
                        value={l.unitCostPkr}
                        onChange={(e) => updateLine(l.key, { unitCostPkr: Number(e.target.value) })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {variances.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-semibold">Variance warnings</p>
            <ul className="mt-1 list-disc pl-4">
              {variances.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <DistButton
            disabled={!canPost || post.isPending}
            onClick={() => post.mutate()}
          >
            {post.isPending ? "Posting…" : "Post GRN"}
          </DistButton>
          <span className="text-[10px] text-slate-400">Idempotency: {idempotencyKey.slice(0, 18)}…</span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent GRNs</h2>
        <DistDataTable
          loading={grnList.isLoading}
          empty="No GRNs yet"
          rowKey={(r) => r.id}
          rows={grnList.data?.items ?? []}
          columns={[
            { key: "grnNumber", header: "GRN#" },
            {
              key: "status",
              header: "Status",
              render: (r) => <DistStatusBadge status={r.status ?? "posted"} />,
            },
            {
              key: "receivedDate",
              header: "Date",
              render: (r) => formatDate(r.receivedDate),
            },
            {
              key: "totalPkr",
              header: "Total",
              className: "text-right tabular-nums",
              render: (r) => formatPkr(r.totalPkr ?? 0),
            },
            {
              key: "po",
              header: "PO",
              render: (r) =>
                r.purchaseOrderId ? (
                  <Link
                    className="text-cyan-700 hover:underline dark:text-cyan-400"
                    to={`${DIST}/purchase-orders`}
                  >
                    Linked
                  </Link>
                ) : (
                  "—"
                ),
            },
          ]}
        />
        {grnList.data ? (
          <DistPagination
            page={grnList.data.page}
            pageSize={grnList.data.pageSize}
            total={grnList.data.total}
            totalPages={grnList.data.totalPages}
            onPageChange={setListPage}
          />
        ) : null}
      </section>
    </DistPageShell>
  );
}
