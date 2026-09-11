import { formatPkr } from "../lib/dashboardFilters";

type Point = { date: string; sales: number; returns: number; netSales: number };

/** Lightweight CSS bar chart — no chart library. */
export function DistSalesTrendChart({ points }: { points: Point[] }): JSX.Element {
  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No sales in this period.</p>;
  }

  const max = Math.max(...points.map((p) => p.netSales), 1);
  const showEvery = points.length > 14 ? Math.ceil(points.length / 8) : 1;

  return (
    <div className="space-y-2">
      <div className="flex h-36 items-end gap-px overflow-x-auto rounded-md border border-slate-100 bg-slate-50/80 px-1 pt-2 dark:border-slate-800 dark:bg-slate-900/40">
        {points.map((p) => {
          const h = Math.max(2, Math.round((p.netSales / max) * 100));
          return (
            <div
              key={p.date}
              className="group relative flex min-w-[6px] flex-1 flex-col justify-end"
              title={`${p.date}: ${formatPkr(p.netSales)}`}
            >
              <div
                className="mx-auto w-full max-w-[14px] rounded-t bg-cyan-500/90 transition group-hover:bg-cyan-600"
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-2 text-[10px] tabular-nums text-slate-400">
        {points
          .filter((_, i) => i % showEvery === 0 || i === points.length - 1)
          .map((p) => (
            <span key={p.date}>{p.date.slice(5)}</span>
          ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span>
          Peak net <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatPkr(max)}</span>
        </span>
        <span>
          Total net{" "}
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {formatPkr(points.reduce((s, p) => s + p.netSales, 0))}
          </span>
        </span>
      </div>
    </div>
  );
}
