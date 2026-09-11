import { useEffect, useState } from "react";
import {
  DIST_DATE_PRESETS,
  type DistDashboardUrlFilters,
  type DistDatePreset,
} from "../lib/dashboardFilters";
import {
  distBtnPrimaryClass,
  distBtnSecondaryClass,
  distInputClass,
  distSelectClass,
} from "../ui/DistUi";

type Option = { id: string; label: string };

export function DistPsFilterBar({
  value,
  onApply,
  onClear,
  warehouses,
  companies,
  salesmen,
}: {
  value: DistDashboardUrlFilters;
  onApply: (next: DistDashboardUrlFilters) => void;
  onClear: () => void;
  warehouses: Option[];
  companies: Option[];
  salesmen: Option[];
}): JSX.Element {
  const [draft, setDraft] = useState<DistDashboardUrlFilters>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const setPreset = (preset: DistDatePreset) => {
    const next: DistDashboardUrlFilters = {
      ...draft,
      preset,
      ...(preset === "custom" ? {} : { from: undefined, to: undefined }),
    };
    setDraft(next);
    if (preset !== "custom") onApply(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Period</span>
        {DIST_DATE_PRESETS.map((p) => {
          const active = draft.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={
                active
                  ? "rounded-md bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white"
                  : "rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              }
              onClick={() => setPreset(p.id)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {draft.preset === "custom" ? (
          <>
            <label className="text-xs text-slate-500">
              From
              <input
                type="date"
                className={`mt-1 block ${distInputClass}`}
                value={draft.from ?? ""}
                onChange={(e) => setDraft({ ...draft, from: e.target.value || undefined })}
              />
            </label>
            <label className="text-xs text-slate-500">
              To
              <input
                type="date"
                className={`mt-1 block ${distInputClass}`}
                value={draft.to ?? ""}
                onChange={(e) => setDraft({ ...draft, to: e.target.value || undefined })}
              />
            </label>
          </>
        ) : null}

        <label className="text-xs text-slate-500">
          Warehouse
          <select
            className={`mt-1 block min-w-[10rem] ${distSelectClass}`}
            value={draft.warehouseId ?? ""}
            onChange={(e) => setDraft({ ...draft, warehouseId: e.target.value || undefined })}
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-500">
          Company
          <select
            className={`mt-1 block min-w-[10rem] ${distSelectClass}`}
            value={draft.companyId ?? ""}
            onChange={(e) => setDraft({ ...draft, companyId: e.target.value || undefined })}
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-500">
          Salesman
          <select
            className={`mt-1 block min-w-[10rem] ${distSelectClass}`}
            value={draft.salesmanId ?? ""}
            onChange={(e) => setDraft({ ...draft, salesmanId: e.target.value || undefined })}
          >
            <option value="">All salesmen</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className={distBtnPrimaryClass} onClick={() => onApply(draft)}>
          Apply
        </button>
        <button type="button" className={distBtnSecondaryClass} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
