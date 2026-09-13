import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ledgerApi } from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import {
  WarehouseFilter,
  errorMessage,
  formatDateTime,
  formatQty,
} from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistKpiCard,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
  exportRowsToCsv,
} from "../ui/DistUi";
import { documentReferenceLabel } from "../lib/customerDisplay";

const DIST = "/pops/distribution";

export function DistributionStockLedgerPage(): JSX.Element {
  const navigate = useNavigate();
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [movementType, setMovementType] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const resetPage = () => setPage(1);

  const movementTypes = useQuery({
    queryKey: ["distribution", "movement-types"],
    staleTime: 5 * 60_000,
    queryFn: () => ledgerApi.movementTypes(),
  });

  const filters = {
    branchCode: branchCode ?? "",
    warehouseId: warehouseId || undefined,
    movementType: movementType || undefined,
    referenceId: referenceId || undefined,
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
  };

  const list = useQuery({
    queryKey: ["distribution", "stock-ledger", filters, page, pageSize],
    enabled: Boolean(branchCode),
    queryFn: () => ledgerApi.list({ ...filters, branchCode: branchCode!, page, pageSize }),
  });

  const totals = useQuery({
    queryKey: ["distribution", "stock-ledger-totals", filters],
    enabled: Boolean(branchCode),
    queryFn: () => ledgerApi.totals({ ...filters, branchCode: branchCode! }),
  });

  const rows = list.data?.items ?? [];

  const openPurchaseForRow = (r: (typeof rows)[number]) => {
    const params = new URLSearchParams();
    params.set("focus", "new");
    if (r.medicineId) params.set("medicineId", r.medicineId);
    if (r.medicineSku) params.set("sku", r.medicineSku);
    if (r.medicineName) params.set("q", r.medicineName);
    navigate(`${DIST}/purchase-orders?${params.toString()}`);
  };

  const exportPage = () =>
    exportRowsToCsv(
      `stock-ledger-page-${page}.csv`,
      [
        "When",
        "Type",
        "Raw type",
        "Direction",
        "SKU",
        "Product",
        "Batch",
        "Expiry",
        "Warehouse",
        "Stock state",
        "Qty delta",
        "Qty after",
        "Unit cost PKR",
        "Value PKR",
        "Reference",
        "Notes",
        "By",
      ],
      rows.map((r) => [
        r.createdAt,
        r.movementType,
        r.rawMovementType,
        r.direction,
        r.medicineSku ?? "",
        r.medicineName ?? "",
        r.batchNumber ?? "",
        r.expiryDate ?? "",
        r.warehouseName ?? "",
        r.stockState,
        r.quantityDelta,
        r.quantityAfter,
        r.unitCostPkr,
        r.valuePkr,
        documentReferenceLabel(r),
        r.notes ?? "",
        r.userName ?? "",
      ]),
    );

  return (
    <DistPageShell
      title="Stock ledger"
      subtitle="Append-only movement register. Every stock change lands here; corrections are posted as reversal rows rather than edits."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Inventory", to: "/pops/distribution/inventory" },
        { label: "Stock ledger" },
      ]}
      error={!branch ? "Select a branch to load the stock ledger." : null}
    >
      {list.isError ? (
        <DistErrorBanner
          message={errorMessage(list.error, "Failed to load the stock ledger")}
          onRetry={() => void list.refetch()}
        />
      ) : null}
      {movementTypes.isError ? (
        <DistErrorBanner
          message={errorMessage(movementTypes.error, "Failed to load movement types")}
          onRetry={() => void movementTypes.refetch()}
        />
      ) : null}

      {totals.isError ? (
        <DistErrorBanner
          message={errorMessage(totals.error, "Failed to load ledger totals")}
          onRetry={() => void totals.refetch()}
        />
      ) : totals.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DistKpiCard
            label="Quantity in"
            value={formatQty(totals.data.quantityIn)}
            tone="success"
            hint={formatPkr(totals.data.valueInPkr)}
          />
          <DistKpiCard
            label="Quantity out"
            value={formatQty(totals.data.quantityOut)}
            tone="warning"
            hint={formatPkr(totals.data.valueOutPkr)}
          />
          <DistKpiCard
            label="Net quantity"
            value={formatQty(totals.data.netQuantity)}
            tone={totals.data.netQuantity < 0 ? "danger" : "default"}
          />
          <DistKpiCard label="Matching rows" value={formatQty(totals.data.rows)} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          From
          <DistInput
            className="mt-1"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              resetPage();
            }}
          />
        </label>
        <label className="text-xs text-slate-500">
          To
          <DistInput
            className="mt-1"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetPage();
            }}
          />
        </label>
        <label className="text-xs text-slate-500">
          Movement type
          <DistSelect
            className="mt-1 min-w-[12rem]"
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value);
              resetPage();
            }}
          >
            <option value="">All types</option>
            {(movementTypes.data?.types ?? []).map((t) => (
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
          Product / batch search
          <DistInput
            className="mt-1 min-w-[13rem]"
            placeholder="Product, SKU, batch, reference…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
          />
        </label>
        <label className="text-xs text-slate-500">
          Reference
          <DistInput
            className="mt-1 min-w-[11rem]"
            placeholder="Document # or id"
            value={referenceId}
            onChange={(e) => {
              setReferenceId(e.target.value);
              resetPage();
            }}
          />
        </label>
        <DistButton variant="secondary" disabled={rows.length === 0} onClick={exportPage}>
          Export page
        </DistButton>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        rows={rows}
        empty="No stock movements match these filters"
        columns={[
          { key: "createdAt", header: "When", render: (r) => formatDateTime(r.createdAt) },
          {
            key: "movementType",
            header: "Type",
            render: (r) => (
              <span className="space-y-0.5">
                <DistStatusBadge
                  status={r.movementType}
                  tone={r.direction === "in" ? "success" : r.direction === "out" ? "warning" : "neutral"}
                />
                {r.rawMovementType !== r.movementType ? (
                  <span className="block text-[10px] text-slate-400">legacy: {r.rawMovementType}</span>
                ) : null}
              </span>
            ),
          },
          { key: "medicineSku", header: "SKU", className: "font-mono text-xs", render: (r) => r.medicineSku ?? "—" },
          {
            key: "medicineName",
            header: "Product",
            render: (r) => {
              const zero = Number(r.quantityAfter) <= 0;
              if (!zero) return r.medicineName ?? "—";
              return (
                <button
                  type="button"
                  className="text-left font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-300"
                  title="Out of stock — open Purchase Orders"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPurchaseForRow(r);
                  }}
                >
                  {r.medicineName ?? "—"}
                </button>
              );
            },
          },
          { key: "batchNumber", header: "Batch", className: "font-mono text-xs", render: (r) => r.batchNumber ?? "—" },
          { key: "warehouseName", header: "Warehouse", render: (r) => r.warehouseName ?? "—" },
          { key: "stockState", header: "Bucket", render: (r) => r.stockState },
          {
            key: "quantityDelta",
            header: "Qty",
            className: "text-right tabular-nums",
            render: (r) => (r.quantityDelta > 0 ? `+${formatQty(r.quantityDelta)}` : formatQty(r.quantityDelta)),
          },
          {
            key: "quantityAfter",
            header: "Balance",
            className: "text-right tabular-nums",
            render: (r) => {
              const zero = Number(r.quantityAfter) <= 0;
              const label = formatQty(r.quantityAfter);
              if (!zero) return label;
              return (
                <button
                  type="button"
                  className="font-semibold text-red-700 hover:underline dark:text-red-300"
                  title="Out of stock — open Purchase Orders"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPurchaseForRow(r);
                  }}
                >
                  {label}
                </button>
              );
            },
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
            render: (r) => documentReferenceLabel(r),
          },
          { key: "userName", header: "By", render: (r) => r.userName ?? "—" },
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
        pageSizeOptions={[25, 50, 100, 200]}
      />
    </DistPageShell>
  );
}
