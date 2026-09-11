import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Link } from "react-router-dom";

/** Dense, professional Dist ERP chrome — cyan accent, low decoration. */
export const distInputClass =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export const distSelectClass = distInputClass;

export const distBtnPrimaryClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50";

export const distBtnSecondaryClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

export const distBtnGhostClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800";

export function DistStatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}): JSX.Element {
  const resolved =
    tone ??
    (/(delivered|paid|approved|invoiced|active|complete)/i.test(status)
      ? "success"
      : /(pending|draft|booked|picking|packed|dispatched|stock_reserved|ready)/i.test(status)
        ? "warning"
        : /(cancel|fail|expired|overdue)/i.test(status)
          ? "danger"
          : /(ready|open)/i.test(status)
            ? "info"
            : "neutral");
  const cls =
    resolved === "success"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : resolved === "warning"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : resolved === "danger"
          ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
          : resolved === "info"
            ? "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export type DistFilterValues = {
  from?: string;
  to?: string;
  cityId?: string;
  areaId?: string;
  q?: string;
};

export function DistFilterBar({
  value,
  onChange,
  cities,
  areas,
  extra,
}: {
  value: DistFilterValues;
  onChange: (next: DistFilterValues) => void;
  cities?: { id: string; name: string }[];
  areas?: { id: string; name: string; cityId?: string }[];
  extra?: ReactNode;
}): JSX.Element {
  const filteredAreas = (areas ?? []).filter((a) => !value.cityId || a.cityId === value.cityId);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <label className="text-xs text-slate-500">
        From
        <input
          type="date"
          className={`mt-1 block ${distInputClass}`}
          value={value.from ?? ""}
          onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        />
      </label>
      <label className="text-xs text-slate-500">
        To
        <input
          type="date"
          className={`mt-1 block ${distInputClass}`}
          value={value.to ?? ""}
          onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        />
      </label>
      {cities ? (
        <label className="text-xs text-slate-500">
          City
          <select
            className={`mt-1 block min-w-[10rem] ${distSelectClass}`}
            value={value.cityId ?? ""}
            onChange={(e) => onChange({ ...value, cityId: e.target.value || undefined, areaId: undefined })}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {areas ? (
        <label className="text-xs text-slate-500">
          Area
          <select
            className={`mt-1 block min-w-[10rem] ${distSelectClass}`}
            value={value.areaId ?? ""}
            onChange={(e) => onChange({ ...value, areaId: e.target.value || undefined })}
          >
            <option value="">All areas</option>
            {filteredAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-xs text-slate-500">
        Search
        <input
          className={`mt-1 block min-w-[12rem] ${distInputClass}`}
          placeholder="Search…"
          value={value.q ?? ""}
          onChange={(e) => onChange({ ...value, q: e.target.value || undefined })}
        />
      </label>
      {extra}
    </div>
  );
}

export type DistColumn<T> = {
  key: string;
  header: ReactNode;
  className?: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
};

export function DistDataTable<T extends object>({
  columns,
  rows,
  rowKey,
  empty = "No rows",
  onExport,
  loading,
  onRowClick,
  selectedIds,
  onToggleRow,
  onTogglePage,
}: {
  columns: DistColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  onExport?: () => void;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
  onTogglePage?: (ids: string[], selected: boolean) => void;
}): JSX.Element {
  const selectable = Boolean(selectedIds && onToggleRow);
  const pageIds = rows.map(rowKey);
  const pageSelected = selectable && pageIds.length > 0 && pageIds.every((id) => selectedIds!.has(id));
  const colSpan = columns.length + (selectable ? 1 : 0);
  return (
    <div className="space-y-2">
      {onExport ? (
        <div className="flex justify-end">
          <button type="button" onClick={onExport} className={distBtnSecondaryClass}>
            Export CSV
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/90">
            <tr>
              {selectable ? (
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={pageSelected}
                    onChange={() => onTogglePage?.(pageIds, !pageSelected)}
                    aria-label="Select current page"
                  />
                </th>
              ) : null}
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2.5 ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-10">
                  <DistLoadingBlock label="Loading…" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-10">
                  <DistEmptyState title={empty} />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = rowKey(row);
                return (
                  <tr
                    key={id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/40 ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectable ? (
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds!.has(id)}
                          onChange={() => onToggleRow!(id)}
                          aria-label={`Select ${id}`}
                        />
                      </td>
                    ) : null}
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2.5 text-slate-800 dark:text-slate-200 ${c.className ?? ""}`}>
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DistBulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}): JSX.Element | null {
  if (count <= 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm dark:border-cyan-900 dark:bg-cyan-950/40">
      <strong>{count} selected</strong>
      {children}
      <button type="button" className={distBtnGhostClass} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

export function DistPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DistKpiCard({
  label,
  value,
  hint,
  to,
  tone = "default",
  delta,
}: {
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
  tone?: "default" | "success" | "warning" | "danger";
  delta?: string;
}): JSX.Element {
  const toneBorder =
    tone === "success"
      ? "border-emerald-300/70 hover:border-emerald-500 dark:border-emerald-800"
      : tone === "warning"
        ? "border-amber-300/70 hover:border-amber-500 dark:border-amber-800"
        : tone === "danger"
          ? "border-red-300/70 hover:border-red-500 dark:border-red-900"
          : "border-slate-200 hover:border-cyan-500 dark:border-slate-800 dark:hover:border-cyan-600";
  const valueClass =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "text-amber-800 dark:text-amber-200"
        : tone === "danger"
          ? "text-red-700 dark:text-red-300"
          : "text-slate-900 dark:text-white";
  const inner = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
      {delta ? <div className="mt-1 text-xs font-medium text-slate-500">{delta}</div> : null}
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={`block rounded-lg border bg-white p-4 transition dark:bg-slate-950/40 ${toneBorder}`}>
        {inner}
      </Link>
    );
  }
  return <div className={`rounded-lg border bg-white p-4 dark:bg-slate-950/40 ${toneBorder}`}>{inner}</div>;
}

export function DistBreadcrumb({
  items,
}: {
  items: { label: string; to?: string }[];
}): JSX.Element {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? <span className="text-slate-300 dark:text-slate-600">/</span> : null}
          {item.to ? (
            <Link to={item.to} className="hover:text-cyan-700 dark:hover:text-cyan-400">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function DistPageShell({
  title,
  subtitle,
  breadcrumb,
  actions,
  loading,
  error,
  children,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: { label: string; to?: string }[];
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-4">
      {breadcrumb?.length ? <DistBreadcrumb items={breadcrumb} /> : null}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {error ? <DistErrorBanner message={error} /> : null}
      {loading ? <DistLoadingBlock label="Loading…" /> : children}
    </div>
  );
}

export function DistEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description ? <p className="max-w-sm text-xs text-slate-500">{description}</p> : null}
      {action}
    </div>
  );
}

export function DistErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
    >
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className={distBtnSecondaryClass} onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function DistLoadingBlock({ label = "Loading…" }: { label?: string }): JSX.Element {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={label}>
      <div className="h-3 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
        <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
        <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
        <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
      </div>
      <p className="text-center text-xs text-slate-400">{label}</p>
    </div>
  );
}

export function DistButton({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }): JSX.Element {
  const base =
    variant === "primary" ? distBtnPrimaryClass : variant === "secondary" ? distBtnSecondaryClass : distBtnGhostClass;
  return <button type={type} className={[base, className].filter(Boolean).join(" ")} {...props} />;
}

export const DistInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function DistInput({ className, ...props }, ref) {
    return <input ref={ref} className={[distInputClass, className].filter(Boolean).join(" ")} {...props} />;
  },
);

export function DistSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return <select className={[distSelectClass, className].filter(Boolean).join(" ")} {...props} />;
}

export function exportRowsToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const body = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
