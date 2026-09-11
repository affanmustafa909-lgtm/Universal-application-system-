import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  STOCK_SORTS,
  STOCK_STATE_FILTERS,
  inventoryApi,
  type StockRow,
} from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import {
  StockStateBadge,
  WarehouseFilter,
  formatDate,
  formatQty,
  useCompanyOptions,
} from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistKpiCard,
  DistPageShell,
  DistSelect,
  exportRowsToCsv,
} from "../ui/DistUi";

const STATE_LABELS: Record<string, string> = {
  all: "All states",
  ok: "OK",
  low: "Low",
  out: "Out of stock",
  negative: "Negative",
  near_expiry: "Has near-expiry",
  expired: "Has expired",
  has_hold: "Has hold / blocked / quarantine",
};

const SORT_LABELS: Record<string, string> = {
  name_asc: "Name (A→Z)",
  qty_asc: "Available (low→high)",
  qty_desc: "Available (high→low)",
  value_desc: "Value (high→low)",
  expiry_asc: "Earliest expiry",
};

export function DistributionStockPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;

  const [q, setQ] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [stockState, setStockState] = useState("all");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerRow, setDrawerRow] = useState<StockRow | null>(null);

  const companies = useCompanyOptions();

  const list = useQuery({
    queryKey: [
      "distribution",
      "inventory-stock",
      branchCode,
      warehouseId,
      companyId,
      stockState,
      sort,
      q,
      page,
      pageSize,
    ],
    enabled: Boolean(branchCode),
    queryFn: () =>
      inventoryApi.listStock({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        companyId: companyId || undefined,
        stockState,
        sort,
        q: q || undefined,
        page,
        pageSize,
      }),
  });

  const resetPage = () => setPage(1);
  const rows = list.data?.items ?? [];
  const totals = list.data?.totals;
  const warehouseScoped = Boolean(warehouseId);

  const exportPage = () =>
    exportRowsToCsv(
      `stock-page-${page}.csv`,
      [
        "SKU",
        "Name",
        "Company",
        "Available",
        "Physical",
        "Reserved",
        "Damaged",
        "Quarantine",
        "Blocked",
        "Near expiry",
        "Expired",
        "Batches",
        "Value PKR",
        "State",
        "Earliest expiry",
      ],
      rows.map((r) => [
        r.sku,
        r.name,
        r.companyName ?? "",
        r.availableQty,
        r.physicalQty,
        r.reservedQty,
        r.damagedQty,
        r.quarantineQty,
        r.blockedQty,
        r.nearExpiryQty,
        r.expiredQty,
        r.batchCount,
        r.valuePkr,
        r.stockState,
        r.earliestExpiry ?? "",
      ]),
    );

  return (
    <DistPageShell
      title="Stock"
      subtitle={
        warehouseScoped
          ? "Quantities are scoped to the selected warehouse. Legacy batches with no warehouse stay visible to every warehouse in the branch."
          : "Branch-wide stock across every warehouse. Pick a warehouse to scope the quantities."
      }
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Inventory", to: "/pops/distribution/inventory" },
        { label: "Stock" },
      ]}
      error={!branch ? "Select a branch to load stock." : null}
    >
      {list.isError ? (
        <DistErrorBanner
          message={list.error instanceof Error ? list.error.message : "Failed to load stock"}
          onRetry={() => void list.refetch()}
        />
      ) : null}

      {totals ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DistKpiCard label="SKUs matched" value={formatQty(totals.skuCount)} />
          <DistKpiCard
            label="Available qty"
            value={formatQty(totals.availableQty)}
            hint={`Physical ${formatQty(totals.physicalQty)}`}
          />
          <DistKpiCard label="Stock value" value={formatPkr(totals.valuePkr)} />
          <DistKpiCard
            label="Low / out"
            value={`${formatQty(totals.lowCount)} / ${formatQty(totals.outCount)}`}
            tone={totals.outCount > 0 ? "danger" : totals.lowCount > 0 ? "warning" : "success"}
            hint={`Near expiry ${formatQty(totals.nearExpiryQty)} · expired ${formatQty(totals.expiredQty)}`}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 min-w-[14rem]"
            placeholder="SKU, name, generic, barcode…"
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
          Stock state
          <DistSelect
            className="mt-1 min-w-[12rem]"
            value={stockState}
            onChange={(e) => {
              setStockState(e.target.value);
              resetPage();
            }}
          >
            {STOCK_STATE_FILTERS.map((s) => (
              <option key={s} value={s}>
                {STATE_LABELS[s] ?? s}
              </option>
            ))}
          </DistSelect>
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
            {STOCK_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s] ?? s}
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
        rowKey={(r) => r.medicineId}
        rows={rows}
        empty="No stock matches these filters"
        onRowClick={(r) => setDrawerRow(r)}
        columns={[
          { key: "sku", header: "SKU", className: "font-mono text-xs", render: (r) => r.sku },
          { key: "name", header: "Product", render: (r) => r.name },
          {
            key: "availableQty",
            header: warehouseScoped ? "Available (warehouse)" : "Available (branch)",
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
            key: "reservedQty",
            header: "Reserved",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.reservedQty),
          },
          {
            key: "held",
            header: "Dmg / Qtn / Blk",
            className: "text-right tabular-nums",
            render: (r) =>
              `${formatQty(r.damagedQty)} / ${formatQty(r.quarantineQty)} / ${formatQty(r.blockedQty)}`,
          },
          {
            key: "nearExpiryQty",
            header: "Near expiry",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.nearExpiryQty),
          },
          {
            key: "batchCount",
            header: "Batches",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.batchCount),
          },
          {
            key: "valuePkr",
            header: "Value",
            className: "text-right tabular-nums",
            render: (r) => formatPkr(r.valuePkr),
          },
          { key: "stockState", header: "State", render: (r) => <StockStateBadge state={r.stockState} /> },
          {
            key: "earliestExpiry",
            header: "Earliest expiry",
            render: (r) => formatDate(r.earliestExpiry),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Link to={`/pops/distribution/inventory/product/${r.medicineId}`}>
                  <DistButton variant="ghost" className="px-2 py-1 text-xs">
                    Open
                  </DistButton>
                </Link>
              </span>
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
          resetPage();
        }}
      />

      <DistMasterDrawer
        open={Boolean(drawerRow)}
        title={drawerRow?.name ?? "Stock"}
        subtitle={drawerRow?.sku}
        onClose={() => setDrawerRow(null)}
        footer={
          drawerRow ? (
            <>
              <Link to={`/pops/distribution/batches?q=${encodeURIComponent(drawerRow.sku)}`}>
                <DistButton variant="secondary">Batches</DistButton>
              </Link>
              <Link to={`/pops/distribution/inventory/product/${drawerRow.medicineId}`}>
                <DistButton>Open product inventory</DistButton>
              </Link>
            </>
          ) : null
        }
      >
        {drawerRow ? (
          <dl>
            <DistDrawerField label="Company" value={drawerRow.companyName} />
            <DistDrawerField label="Unit" value={drawerRow.unit} />
            <DistDrawerField label="Rack" value={drawerRow.rackLocation} />
            <DistDrawerField label="Available" value={formatQty(drawerRow.availableQty)} />
            <DistDrawerField label="Physical" value={formatQty(drawerRow.physicalQty)} />
            <DistDrawerField label="Reserved" value={formatQty(drawerRow.reservedQty)} />
            <DistDrawerField label="Damaged" value={formatQty(drawerRow.damagedQty)} />
            <DistDrawerField label="Quarantine" value={formatQty(drawerRow.quarantineQty)} />
            <DistDrawerField label="Blocked" value={formatQty(drawerRow.blockedQty)} />
            <DistDrawerField label="Expired" value={formatQty(drawerRow.expiredQty)} />
            <DistDrawerField label="Near expiry" value={formatQty(drawerRow.nearExpiryQty)} />
            <DistDrawerField label="Batches" value={formatQty(drawerRow.batchCount)} />
            <DistDrawerField label="Value" value={formatPkr(drawerRow.valuePkr)} />
            <DistDrawerField
              label="Thresholds"
              value={`Reorder ${formatQty(drawerRow.reorderLevel)} · min ${formatQty(drawerRow.minStock)} · max ${formatQty(drawerRow.maxStock)}`}
            />
            <DistDrawerField label="State" value={<StockStateBadge state={drawerRow.stockState} />} />
            <DistDrawerField label="Earliest expiry" value={formatDate(drawerRow.earliestExpiry)} />
          </dl>
        ) : null}
      </DistMasterDrawer>
    </DistPageShell>
  );
}
