import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  purchaseApi,
  type SupplierHit,
} from "../../pharmacy/api/pharmacy-purchase";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import {
  BatchPicker,
  WarehouseFilter,
  errorMessage,
  formatDateTime,
  type PickedMedicine,
} from "../components/DistInventoryShared";
import { usePurchaseProductSearch } from "../purchase";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistStatusBadge,
} from "../ui/DistUi";

const DIST = "/pops/distribution";

type ReturnLine = {
  key: string;
  medicine: PickedMedicine;
  batchId: string;
  quantity: number;
  unitCostPkr: number;
};

export function DistributionPurchaseReturnsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([["distribution", "purchase"]]);

  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierLabel, setSupplierLabel] = useState("");
  const [supplierQ, setSupplierQ] = useState("");
  const [grnId, setGrnId] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([]);

  const search = usePurchaseProductSearch({
    branchCode,
    warehouseId: warehouseId || undefined,
    enabled: true,
  });

  const list = useQuery({
    queryKey: ["distribution", "purchase", "returns", branchCode, page],
    enabled: Boolean(branchCode),
    queryFn: () => purchaseApi.listReturns({ branchCode: branchCode!, page, pageSize: 25 }),
  });

  const suppliers = useQuery({
    queryKey: ["distribution", "purchase", "return-suppliers", branchCode, supplierQ],
    enabled: Boolean(branchCode) && supplierQ.trim().length >= 1,
    queryFn: () =>
      purchaseApi.searchSuppliers({ branchCode: branchCode!, q: supplierQ.trim(), limit: 30 }),
  });

  const grns = useQuery({
    queryKey: ["distribution", "purchase", "return-grns", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => purchaseApi.listGrns({ branchCode: branchCode!, page: 1, pageSize: 50 }),
  });

  const post = useMutation({
    mutationFn: () =>
      purchaseApi.createReturn({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        supplierId: supplierId || undefined,
        grnId: grnId || undefined,
        reason: reason.trim() || undefined,
        lines: lines.map((l) => ({
          medicineId: l.medicine.id,
          batchId: l.batchId || undefined,
          quantity: l.quantity,
          unitCostPkr: l.unitCostPkr,
        })),
      }),
    onSuccess: () => {
      setActionError(null);
      setLines([]);
      setReason("");
      setGrnId("");
      invalidate();
      void list.refetch();
    },
    onError: (e) => setActionError(errorMessage(e, "Return failed")),
  });

  function pickSupplier(s: SupplierHit) {
    setSupplierId(s.id);
    setSupplierLabel(s.name);
    setSupplierQ("");
  }

  return (
    <DistPageShell
      title="Purchase returns"
      subtitle="Return stock to supplier against a GRN/batch — posts stock OUT via FEFO engine."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Purchases", to: `${DIST}/purchase` },
        { label: "Returns" },
      ]}
      error={!branch ? "Select a branch." : null}
    >
      {actionError ? <DistErrorBanner message={actionError} /> : null}

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <h2 className="text-sm font-semibold">Create return</h2>
        <div className="grid gap-3 sm:grid-cols-2">
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
            GRN (optional)
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              value={grnId}
              onChange={(e) => setGrnId(e.target.value)}
            >
              <option value="">None</option>
              {(grns.data?.items ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.grnNumber} · {formatPkr(g.totalPkr)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Supplier</p>
          {supplierId ? (
            <div className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700">
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
                <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
                  {suppliers.data.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-900"
                        onClick={() => pickSupplier(s)}
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <label className="block text-xs text-slate-500">
          Reason
          <DistInput className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Add product</p>
          <DistInput
            value={search.query}
            placeholder="Search medicine…"
            onChange={(e) => search.setQuery(e.target.value)}
          />
          {search.results.length > 0 ? (
            <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
              {search.results.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-900"
                    onClick={() => {
                      setLines((prev) => [
                        ...prev,
                        {
                          key: crypto.randomUUID().slice(0, 8),
                          medicine: {
                            id: hit.id,
                            name: hit.name,
                            sku: hit.sku ?? "",
                          },
                          batchId: "",
                          quantity: 1,
                          unitCostPkr: hit.wholesalePricePkr ?? 0,
                        },
                      ]);
                      search.setQuery("");
                    }}
                  >
                    {hit.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <ul className="space-y-3">
          {lines.map((l) => (
            <li
              key={l.key}
              className="space-y-2 rounded-md border border-slate-100 p-2 dark:border-slate-800"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{l.medicine.name}</span>
                <DistButton
                  variant="ghost"
                  onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                >
                  Remove
                </DistButton>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs text-slate-500">
                  Qty
                  <DistInput
                    type="number"
                    min={1}
                    className="mt-1"
                    value={l.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x) =>
                          x.key === l.key ? { ...x, quantity: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Cost
                  <DistInput
                    type="number"
                    min={0}
                    className="mt-1"
                    value={l.unitCostPkr}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x) =>
                          x.key === l.key ? { ...x, unitCostPkr: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </label>
                <div className="text-xs text-slate-500">
                  Batch
                  <div className="mt-1">
                    <BatchPicker
                      branchCode={branchCode}
                      medicineId={l.medicine.id}
                      warehouseId={warehouseId || undefined}
                      value={l.batchId}
                      onChange={(batchId) =>
                        setLines((prev) =>
                          prev.map((x) => (x.key === l.key ? { ...x, batchId } : x)),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <DistButton
          disabled={!lines.length || post.isPending}
          onClick={() => post.mutate()}
        >
          {post.isPending ? "Posting…" : "Post return"}
        </DistButton>
      </section>

      <DistDataTable
        loading={list.isLoading}
        empty="No purchase returns"
        rowKey={(r) => r.id}
        rows={list.data?.items ?? []}
        columns={[
          { key: "returnNumber", header: "PRN#" },
          {
            key: "totalPkr",
            header: "Total",
            className: "text-right tabular-nums",
            render: (r) => formatPkr(r.totalPkr ?? 0),
          },
          { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
          {
            key: "createdAt",
            header: "Created",
            render: (r) => formatDateTime(r.createdAt),
          },
          {
            key: "status",
            header: "Status",
            render: () => <DistStatusBadge status="posted" tone="success" />,
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
        />
      ) : null}
    </DistPageShell>
  );
}
