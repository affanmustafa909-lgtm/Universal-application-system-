import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listCompaniesPaged,
  listMedicinesPaged,
  listWarehousesPaged,
  listCategoryPicker,
  categoriesApi,
  type CategoryPickerItem,
} from "../../pharmacy/api/pharmacy-masters";
import {
  batchesApi,
  inventoryApi,
  type BatchDerivedStatus,
  type BatchRow,
} from "../../pharmacy/api/pharmacy-inventory";
import { DistInput, DistSelect, DistStatusBadge } from "../ui/DistUi";

/** Shared building blocks for the Phase 4 inventory screens. */

export function formatQty(value: number): string {
  return value.toLocaleString();
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function errorMessage(error: unknown, fallback = "Request failed"): string {
  return error instanceof Error ? error.message : fallback;
}

const BATCH_TONES: Record<BatchDerivedStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  expired: "danger",
  hold: "danger",
  depleted: "neutral",
  near_expiry: "warning",
  active: "success",
};

export function BatchStatusBadge({ status }: { status: BatchDerivedStatus }): JSX.Element {
  return <DistStatusBadge status={status} tone={BATCH_TONES[status]} />;
}

const STOCK_STATE_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  ok: "success",
  low: "warning",
  out: "danger",
  negative: "danger",
};

export function StockStateBadge({ state }: { state: string }): JSX.Element {
  return <DistStatusBadge status={state} tone={STOCK_STATE_TONES[state] ?? "neutral"} />;
}

export function useWarehouseOptions(branchCode?: string) {
  return useQuery({
    queryKey: ["distribution", "inventory-warehouses", branchCode],
    enabled: Boolean(branchCode),
    staleTime: 60_000,
    queryFn: () =>
      listWarehousesPaged({ branchCode: branchCode!, page: 1, pageSize: 100, status: "active" }),
  });
}

export function WarehouseFilter({
  branchCode,
  value,
  onChange,
  allLabel = "All warehouses",
  includeAll = true,
  className,
}: {
  branchCode?: string;
  value: string;
  onChange: (next: string) => void;
  allLabel?: string;
  includeAll?: boolean;
  className?: string;
}): JSX.Element {
  const warehouses = useWarehouseOptions(branchCode);
  return (
    <DistSelect className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll ? <option value="">{allLabel}</option> : <option value="">Select warehouse…</option>}
      {(warehouses.data?.items ?? []).map((w) => (
        <option key={w.id} value={w.id}>
          {w.code} — {w.name}
        </option>
      ))}
    </DistSelect>
  );
}

export function useCompanyOptions() {
  return useQuery({
    queryKey: ["distribution", "inventory-companies"],
    staleTime: 60_000,
    queryFn: () => listCompaniesPaged({ page: 1, pageSize: 100, status: "active" }),
  });
}

/** Categories for cycle-count scope — masters + medicine free-text names. */
export function useCategoryOptions(branchCode?: string) {
  return useQuery({
    queryKey: ["distribution", "inventory-categories-picker", branchCode],
    staleTime: 60_000,
    queryFn: async (): Promise<{ items: CategoryPickerItem[] }> => {
      try {
        return await listCategoryPicker({
          branchCode: branchCode || undefined,
          status: "active",
        });
      } catch {
        // Fallback until /masters/categories/picker is deployed.
        const [masters, meds] = await Promise.all([
          categoriesApi.list({ page: 1, pageSize: 200, status: "active" }),
          branchCode
            ? listMedicinesPaged({ branchCode, page: 1, pageSize: 200, status: "active" })
            : Promise.resolve(null),
        ]);
        const items: CategoryPickerItem[] = (masters.items ?? []).map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          source: "master" as const,
        }));
        const seen = new Set(items.map((i) => i.name.trim().toLowerCase()).filter(Boolean));
        for (const m of meds?.items ?? []) {
          const name = (m.category ?? "").trim();
          if (!name || seen.has(name.toLowerCase())) continue;
          if (m.categoryId && items.some((i) => i.id === m.categoryId)) continue;
          seen.add(name.toLowerCase());
          items.push({ id: `name:${name}`, code: name, name, source: "medicine" });
        }
        items.sort((a, b) => a.name.localeCompare(b.name));
        return { items };
      }
    },
  });
}

export type PickedMedicine = {
  id: string;
  sku: string;
  name: string;
  unit?: string;
  availableQty?: number | null;
  stockState?: string | null;
};

function isOutOfStockMedicine(m: {
  availableQty?: number | null;
  stockState?: string | null;
  currentStock?: number | null;
}): boolean {
  if (m.stockState === "out" || m.stockState === "negative") return true;
  if (m.availableQty != null) return Number(m.availableQty) <= 0;
  if (m.currentStock != null) return Number(m.currentStock) <= 0;
  return false;
}

/** Server-side medicine search. Empty query browses first page; typing filters. */
export function MedicinePicker({
  branchCode,
  warehouseId,
  onPick,
  placeholder = "Search product by name or SKU…",
  blockZeroStock = false,
  onBlockedPick,
}: {
  branchCode?: string;
  /** When set with blockZeroStock, uses warehouse stock to mark / block OOS. */
  warehouseId?: string;
  onPick: (medicine: PickedMedicine) => void;
  placeholder?: string;
  blockZeroStock?: boolean;
  onBlockedPick?: (medicine: PickedMedicine) => void;
}): JSX.Element {
  const [term, setTerm] = useState("");
  const trimmed = term.trim();

  const results = useQuery({
    queryKey: ["distribution", "inventory-medicine-search", branchCode, warehouseId, trimmed, blockZeroStock],
    enabled: Boolean(branchCode),
    queryFn: async () => {
      // Always use StockAvailability (listStock) so Avail matches Stock / Sale / Product inventory.
      const stock = await inventoryApi.listStock({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        q: trimmed || undefined,
        page: 1,
        pageSize: 20,
        strictWarehouse: Boolean(blockZeroStock && warehouseId),
      });
      return {
        items: stock.items.map((s) => ({
          id: s.medicineId,
          sku: s.sku,
          name: s.name,
          unit: s.unit,
          availableQty: s.availableQty,
          stockState: s.stockState,
        })),
      };
    },
  });

  return (
    <div className="space-y-1">
      {blockZeroStock && !warehouseId ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Select source warehouse first — zero / expired stock cannot be added.
        </p>
      ) : null}
      <DistInput value={term} placeholder={placeholder} onChange={(e) => setTerm(e.target.value)} />
      {results.isError ? (
        <p className="text-xs text-red-600 dark:text-red-400">{errorMessage(results.error)}</p>
      ) : results.isLoading ? (
        <p className="text-xs text-slate-500">{trimmed ? "Searching…" : "Loading products…"}</p>
      ) : (results.data?.items.length ?? 0) === 0 ? (
        <p className="text-xs text-slate-500">
          {trimmed ? `No product matches “${trimmed}”.` : "No active products."}
        </p>
      ) : (
        <ul className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
          {(results.data?.items ?? []).map((m) => {
            const oos = blockZeroStock && isOutOfStockMedicine(m);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={oos && !onBlockedPick}
                  title={oos ? "Out of stock / expired — cannot add" : undefined}
                  className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs ${
                    oos
                      ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
                      : "hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                  onClick={() => {
                    if (oos) {
                      onBlockedPick?.(m);
                      return;
                    }
                    onPick(m);
                    setTerm("");
                  }}
                >
                  <span className={`truncate ${oos ? "font-semibold" : "text-slate-800 dark:text-slate-200"}`}>
                    {m.name}
                    {oos ? " · Out of stock" : ""}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-500">
                    {m.sku}
                    {m.availableQty != null ? ` · Avail ${m.availableQty}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Search once, tick several products, then add them all to the working table. */
export function MedicineMultiPicker({
  branchCode,
  warehouseId,
  onAdd,
  blockZeroStock = false,
  onBlockedPick,
}: {
  branchCode?: string;
  warehouseId?: string;
  onAdd: (medicines: PickedMedicine[]) => void;
  blockZeroStock?: boolean;
  onBlockedPick?: (medicine: PickedMedicine) => void;
}): JSX.Element {
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<PickedMedicine[]>([]);
  const trimmed = term.trim();
  const results = useQuery({
    queryKey: ["distribution", "inventory-medicine-multi", branchCode, warehouseId, trimmed, blockZeroStock],
    enabled: Boolean(branchCode),
    queryFn: async () => {
      const stock = await inventoryApi.listStock({
        branchCode: branchCode!,
        warehouseId: warehouseId || undefined,
        q: trimmed || undefined,
        page: 1,
        pageSize: 25,
        strictWarehouse: Boolean(blockZeroStock && warehouseId),
      });
      return {
        items: stock.items.map((s) => ({
          id: s.medicineId,
          sku: s.sku,
          name: s.name,
          unit: s.unit,
          availableQty: s.availableQty,
          stockState: s.stockState,
        })),
      };
    },
  });

  const toggle = (m: PickedMedicine) => {
    if (blockZeroStock && isOutOfStockMedicine(m)) {
      onBlockedPick?.(m);
      return;
    }
    setPicked((prev) => (prev.some((p) => p.id === m.id) ? prev.filter((p) => p.id !== m.id) : [...prev, m]));
  };

  return (
    <div className="space-y-2">
      {blockZeroStock && !warehouseId ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Select source warehouse first — zero / expired stock cannot be added.
        </p>
      ) : null}
      <DistInput value={term} placeholder="Browse or filter products, then tick several…" onChange={(e) => setTerm(e.target.value)} />
      {results.isLoading ? (
        <p className="text-xs text-slate-500">{trimmed ? "Searching…" : "Loading products…"}</p>
      ) : (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
          {(results.data?.items ?? []).map((m) => {
            const oos = blockZeroStock && isOutOfStockMedicine(m);
            const on = picked.some((p) => p.id === m.id);
            return (
              <li key={m.id}>
                {oos ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 bg-red-50 px-2 py-1.5 text-left text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200"
                    onClick={() => onBlockedPick?.(m)}
                    title="Out of stock / expired — open Purchase Orders"
                  >
                    <span className="w-4 text-center font-bold">×</span>
                    <span className="flex-1 truncate font-semibold">
                      {m.name} · Out of stock
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {m.sku}
                      {m.availableQty != null ? ` · ${m.availableQty}` : ""}
                    </span>
                  </button>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-900">
                    <input type="checkbox" checked={on} onChange={() => toggle(m)} />
                    <span className="flex-1 truncate font-medium">{m.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {m.sku}
                      {m.availableQty != null ? ` · ${m.availableQty}` : ""}
                    </span>
                  </label>
                )}
              </li>
            );
          })}
          {(results.data?.items.length ?? 0) === 0 ? (
            <li className="px-2 py-2 text-xs text-slate-500">
              {trimmed ? `No matches for “${trimmed}”.` : "No active products."}
            </li>
          ) : null}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          disabled={picked.length === 0}
          onClick={() => {
            onAdd(picked);
            setPicked([]);
            setTerm("");
          }}
        >
          Add {picked.length || ""} item{picked.length === 1 ? "" : "s"}
        </button>
        {picked.length > 0 ? (
          <button type="button" className="text-xs text-slate-500" onClick={() => setPicked([])}>
            Clear picks
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Batch dropdown scoped to one medicine, loaded from the batch list endpoint. */
export function BatchPicker({
  branchCode,
  medicineId,
  warehouseId,
  value,
  onChange,
  required,
  onAvailabilityChange,
  /**
   * sellable — transfers / sales: active unexpired only, strict warehouse.
   * adjustable — stock adjustments: any batch with physical qty (incl. expired).
   */
  stockMode = "sellable",
}: {
  branchCode?: string;
  medicineId: string;
  warehouseId?: string;
  value: string;
  onChange: (batchId: string, batch?: BatchRow) => void;
  required?: boolean;
  /** Fires when we know whether usable batches exist for this mode. */
  onAvailabilityChange?: (info: { hasStock: boolean; availableQty: number }) => void;
  stockMode?: "sellable" | "adjustable";
}): JSX.Element {
  const adjustable = stockMode === "adjustable";

  const batches = useQuery({
    queryKey: [
      "distribution",
      "inventory-batch-picker",
      branchCode,
      medicineId,
      warehouseId,
      stockMode,
    ],
    enabled: Boolean(branchCode) && Boolean(medicineId),
    queryFn: () =>
      batchesApi.list({
        branchCode: branchCode!,
        medicineId,
        warehouseId: warehouseId || undefined,
        // Transfers must not invent stock from NULL-warehouse batches.
        // Adjustments need every batch that still has physical units in scope.
        strictWarehouse: !adjustable && Boolean(warehouseId),
        status: adjustable ? "all" : "active",
        sort: "expiry_asc",
        page: 1,
        pageSize: 100,
      }),
  });

  const usable = (batches.data?.items ?? []).filter((b) => {
    const physical = Number(b.physicalQty ?? b.quantity ?? 0);
    if (physical <= 0 && Number(b.quantity ?? 0) <= 0) return false;
    if (adjustable) {
      // Expiry / damage / quarantine write-offs need the real batch, including expired.
      return physical > 0 || Number(b.quantity ?? 0) > 0;
    }
    return (
      Number(b.quantity) > 0 &&
      b.derivedStatus !== "expired" &&
      b.derivedStatus !== "depleted" &&
      b.derivedStatus !== "hold"
    );
  });
  const availableQty = usable.reduce(
    (s, b) => s + Number(adjustable ? b.physicalQty ?? b.quantity ?? 0 : b.quantity ?? 0),
    0,
  );
  const hasStock = usable.length > 0 && availableQty > 0;

  useEffect(() => {
    if (batches.isLoading) return;
    onAvailabilityChange?.({ hasStock, availableQty });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify when stock answer changes
  }, [batches.isLoading, hasStock, availableQty, medicineId, warehouseId, stockMode]);

  return (
    <div className="space-y-1">
      {!batches.isLoading && !hasStock ? (
        <p
          className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${
            adjustable
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
          }`}
        >
          {adjustable
            ? "No batch with quantity found for this product in the selected warehouse."
            : "No active batch with stock — product is out of stock or expired. Remove this line or open Purchase Orders."}
        </p>
      ) : null}
      <DistSelect
        value={value}
        disabled={!hasStock && !batches.isLoading}
        onChange={(e) => onChange(e.target.value, usable.find((b) => b.id === e.target.value))}
      >
        <option value="">{required ? "Select batch…" : "FEFO (auto)"}</option>
        {usable.map((b) => {
          const qty = Number(adjustable ? b.physicalQty ?? b.quantity : b.quantity);
          const tag =
            b.derivedStatus === "expired"
              ? " · EXPIRED"
              : b.derivedStatus === "near_expiry"
                ? " · near expiry"
                : b.derivedStatus === "hold"
                  ? " · on hold"
                  : "";
          return (
            <option key={b.id} value={b.id}>
              {b.batchNumber} · exp {b.expiryDate} · {formatQty(qty)}
              {tag}
            </option>
          );
        })}
      </DistSelect>
      {batches.isError ? (
        <p className="text-xs text-red-600 dark:text-red-400">{errorMessage(batches.error)}</p>
      ) : null}
    </div>
  );
}
