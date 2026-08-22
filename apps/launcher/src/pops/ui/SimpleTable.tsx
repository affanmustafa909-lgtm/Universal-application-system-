import type { ReactNode } from "react";

export type SimpleColumn<T> = {
  id?: string;
  key: keyof T | string;
  header: ReactNode;
  className?: string;
  render?: (row: T) => ReactNode;
};

export function SimpleTable<T extends object>({
  columns,
  rows,
  rowKey,
  onRowClick,
}: {
  columns: SimpleColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--line)] bg-white shadow-card dark:border-slate-800/70 dark:bg-slate-900/20">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead className="border-b border-[color:var(--line)] bg-[var(--bg)] text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)] dark:border-slate-800/80 dark:bg-slate-900/50 dark:text-slate-400">
          <tr>
            {columns.map((c, i) => (
              <th key={c.id ?? `${String(c.key)}-${i}`} className={`px-3 py-2.5 ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--line)] dark:divide-slate-800/80">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={[
                "transition hover:bg-[var(--brand-cream)]",
                onRowClick ? "cursor-pointer" : "",
              ].join(" ")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c, i) => (
                <td key={c.id ?? `${String(c.key)}-${i}`} className={`px-3 py-2.5 text-[color:var(--ink)] dark:text-slate-200 ${c.className ?? ""}`}>
                  {c.render ? c.render(row) : String(row[c.key as keyof T] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
