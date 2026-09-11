import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  listCompaniesPaged,
  listMedicinesPaged,
  listWarehousesPaged,
} from "../../pharmacy/api/pharmacy-masters";
import { batchesApi, type BatchDerivedStatus, type BatchRow } from "../../pharmacy/api/pharmacy-inventory";
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

export type PickedMedicine = { id: string; sku: string; name: string; unit?: string };

/** Server-side medicine search. Nothing is fetched until the operator types. */
export function MedicinePicker({
  branchCode,
  onPick,
  placeholder = "Search product by name or SKU…",
}: {
  branchCode?: string;
  onPick: (medicine: PickedMedicine) => void;
  placeholder?: string;
}): JSX.Element {
  const [term, setTerm] = useState("");
  const trimmed = term.trim();

  const results = useQuery({
    queryKey: ["distribution", "inventory-medicine-search", branchCode, trimmed],
    enabled: Boolean(branchCode) && trimmed.length >= 2,
    queryFn: () =>
      listMedicinesPaged({
        branchCode: branchCode!,
        page: 1,
        pageSize: 15,
        q: trimmed,
        status: "active",
      }),
  });

  return (
    <div className="space-y-1">
      <DistInput value={term} placeholder={placeholder} onChange={(e) => setTerm(e.target.value)} />
      {trimmed.length >= 2 ? (
        results.isError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errorMessage(results.error)}</p>
        ) : results.isLoading ? (
          <p className="text-xs text-slate-500">Searching…</p>
        ) : (results.data?.items.length ?? 0) === 0 ? (
          <p className="text-xs text-slate-500">No product matches “{trimmed}”.</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
            {(results.data?.items ?? []).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-900"
                  onClick={() => {
                    onPick({ id: m.id, sku: m.sku, name: m.name, unit: m.unit });
                    setTerm("");
                  }}
                >
                  <span className="truncate text-slate-800 dark:text-slate-200">{m.name}</span>
                  <span className="font-mono text-slate-500">{m.sku}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

/** Search once, tick several products, then add them all to the working table. */
export function MedicineMultiPicker({
  branchCode,
  onAdd,
}: {
  branchCode?: string;
  onAdd: (medicines: PickedMedicine[]) => void;
}): JSX.Element {
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<PickedMedicine[]>([]);
  const trimmed = term.trim();
  const results = useQuery({
    queryKey: ["distribution", "inventory-medicine-search", branchCode, trimmed],
    enabled: Boolean(branchCode) && trimmed.length >= 2,
    queryFn: () =>
      listMedicinesPaged({
        branchCode: branchCode!,
        page: 1,
        pageSize: 20,
        q: trimmed,
        status: "active",
      }),
  });

  const toggle = (m: PickedMedicine) =>
    setPicked((prev) => (prev.some((p) => p.id === m.id) ? prev.filter((p) => p.id !== m.id) : [...prev, m]));

  return (
    <div className="space-y-2">
      <DistInput value={term} placeholder="Search products, then tick several…" onChange={(e) => setTerm(e.target.value)} />
      {trimmed.length >= 2 ? (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
          {(results.data?.items ?? []).map((m) => {
            const item = { id: m.id, sku: m.sku, name: m.name, unit: m.unit };
            const on = picked.some((p) => p.id === m.id);
            return (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-900">
                  <input type="checkbox" checked={on} onChange={() => toggle(item)} />
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className="font-mono text-slate-500">{m.sku}</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
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
}: {
  branchCode?: string;
  medicineId: string;
  warehouseId?: string;
  value: string;
  onChange: (batchId: string, batch?: BatchRow) => void;
  required?: boolean;
}): JSX.Element {
  const batches = useQuery({
    queryKey: ["distribution", "inventory-batch-picker", branchCode, medicineId, warehouseId],
    enabled: Boolean(branchCode) && Boolean(medicineId),
    queryFn: () =>
      batchesApi.list({
        branchCode: branchCode!,
        medicineId,
        warehouseId: warehouseId || undefined,
        status: "active",
        sort: "expiry_asc",
        page: 1,
        pageSize: 100,
      }),
  });

  const items = batches.data?.items ?? [];

  return (
    <div className="space-y-1">
      <DistSelect
        value={value}
        onChange={(e) => onChange(e.target.value, items.find((b) => b.id === e.target.value))}
      >
        <option value="">{required ? "Select batch…" : "FEFO (auto)"}</option>
        {items.map((b) => (
          <option key={b.id} value={b.id}>
            {b.batchNumber} · exp {b.expiryDate} · {formatQty(b.quantity)} avail
          </option>
        ))}
      </DistSelect>
      {batches.isError ? (
        <p className="text-xs text-red-600 dark:text-red-400">{errorMessage(batches.error)}</p>
      ) : !batches.isLoading && items.length === 0 ? (
        <p className="text-xs text-slate-500">No active batch with stock for this product.</p>
      ) : null}
    </div>
  );
}
