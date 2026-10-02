import { formatSummaryValue, summarizeReportRows } from "../lib/reportSummary";

export function DistReportSummary({
  columns,
  rows,
  labelFor,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  labelFor: (key: string) => string;
}): JSX.Element | null {
  if (!rows.length) return null;
  const items = summarizeReportRows(columns, rows, labelFor);
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatSummaryValue(item)}
          </div>
        </div>
      ))}
    </div>
  );
}
