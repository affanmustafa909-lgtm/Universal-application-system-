import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../pops/ui/PageHeader";
import { usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import {
  fetchDistributionReport,
  fetchPharmacyAreas,
  fetchPharmacyCities,
} from "../../pharmacy/api/pharmacy-erp";
import { DISTRIBUTION_REPORTS, REPORT_CATEGORY_ORDER } from "../spec/reports";
import { DistCustomReportBuilder } from "../components/DistCustomReportBuilder";
import {
  DistDataTable,
  DistFilterBar,
  DistFilterValues,
  DistStatusBadge,
  exportRowsToCsv,
} from "../ui/DistUi";
import { printDistReportDocument } from "../lib/printDistOrder";

type Mode = "catalog" | "custom";

export function DistributionReportCenterPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get("mode") === "custom" ? "custom" : "catalog",
  );
  const [catFilter, setCatFilter] = useState<string>(() => {
    if (categoryParam && REPORT_CATEGORY_ORDER.includes(categoryParam as (typeof REPORT_CATEGORY_ORDER)[number])) {
      return categoryParam;
    }
    return "All";
  });
  const [selectedId, setSelectedId] = useState(() => {
    if (categoryParam === "Purchase") return "purchase-dashboard";
    return "sales-report";
  });
  const [filters, setFilters] = useState<DistFilterValues>({});
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const selected = DISTRIBUTION_REPORTS.find((r) => r.id === selectedId) ?? DISTRIBUTION_REPORTS[0];
  const cities = useQuery({ queryKey: ["pharmacy", "cities"], queryFn: fetchPharmacyCities });
  const areas = useQuery({ queryKey: ["pharmacy", "areas"], queryFn: fetchPharmacyAreas });
  const report = useQuery({
    queryKey: ["distribution", "report", selectedId, filters, branch?.code],
    enabled: mode === "catalog" && Boolean(selected?.live) && !selected?.to,
    queryFn: () =>
      fetchDistributionReport(selectedId, {
        from: filters.from,
        to: filters.to,
        cityId: filters.cityId,
        areaId: filters.areaId,
        branchCode: branch?.code,
      }),
  });

  const columns = useMemo(() => {
    const cols = report.data?.columns ?? [];
    return cols.map((key) => ({
      key,
      header: key,
      render: (row: Record<string, unknown>) => {
        const v = row[key];
        if (key === "status" && typeof v === "string") return <DistStatusBadge status={v} />;
        if (typeof v === "number" && /pkr|total|sales|outstanding|qty|quantity|amount|count/i.test(key)) {
          return Number(v).toLocaleString();
        }
        if (v instanceof Date) return v.toISOString();
        if (v == null) return "—";
        return String(v);
      },
    }));
  }, [report.data?.columns]);

  const rows = useMemo(() => {
    let list = (report.data?.rows ?? []) as Record<string, unknown>[];
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
    }
    return list;
  }, [report.data?.rows, filters.q]);

  const categories = [
    "All",
    ...REPORT_CATEGORY_ORDER.filter((c) => DISTRIBUTION_REPORTS.some((r) => r.category === c)),
  ];

  const visibleReports = DISTRIBUTION_REPORTS.filter(
    (r) => catFilter === "All" || r.category === catFilter,
  );

  async function printReport() {
    setPrintNotice(null);
    setPrinting(true);
    try {
      await printDistReportDocument({
        title: selected.title,
        subtitle: selected.description,
        columns: report.data?.columns ?? columns.map((c) => c.key),
        rows,
      });
      setPrintNotice("Print dialog opened");
    } catch (err) {
      setPrintNotice(err instanceof Error ? err.message : "Print failed");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 space-y-3">
        <PageHeader
          title="Report center"
          subtitle="Catalog reports + custom builder — pick any columns, save, export, print."
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[color:var(--line)] bg-[var(--brand-cream)]/40 p-0.5 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMode("catalog")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                mode === "catalog"
                  ? "bg-[var(--brand)] text-[color:var(--brand-fg,#fff)] shadow-sm"
                  : "text-[color:var(--muted)] hover:bg-[var(--card,#fff)] hover:text-[color:var(--ink)] dark:text-slate-300"
              }`}
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                mode === "custom"
                  ? "bg-[var(--brand)] text-[color:var(--brand-fg,#fff)] shadow-sm"
                  : "text-[color:var(--muted)] hover:bg-[var(--card,#fff)] hover:text-[color:var(--ink)] dark:text-slate-300"
              }`}
            >
              Custom builder
            </button>
          </div>
          {mode === "catalog" ? (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCatFilter(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    catFilter === c
                      ? "bg-[var(--brand)] text-[color:var(--brand-fg,#fff)]"
                      : "bg-[var(--brand-cream)] text-[color:var(--ink)] dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {mode === "custom" ? (
        <DistCustomReportBuilder onBackToCatalog={() => setMode("catalog")} />
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[16rem_1fr]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
            <div className="shrink-0 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reports</h2>
              <button
                type="button"
                className="mt-1 text-[11px] font-semibold text-[color:var(--brand)]"
                onClick={() => setMode("custom")}
              >
                + Build custom report
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
              {REPORT_CATEGORY_ORDER.filter(
                (cat) => catFilter === "All" || cat === catFilter,
              ).map((cat) => {
                const items = visibleReports.filter((r) => r.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {cat}
                    </div>
                    <ul className="space-y-1">
                      {items.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                              selectedId === r.id
                                ? "bg-[var(--brand-cream)] font-medium text-[color:var(--brand-dark,var(--brand))] ring-1 ring-[color:var(--brand)]/25"
                                : "text-slate-700 hover:bg-[var(--brand-cream)]/50 dark:text-slate-300 dark:hover:bg-slate-900"
                            }`}
                          >
                            {r.title}
                            {!r.live ? (
                              <span className="ml-1 text-[10px] text-slate-400">soon</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selected.title}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{selected.description}</p>
                {printNotice ? (
                  <p
                    className={`mt-1 text-xs ${
                      /fail|could not|error/i.test(printNotice)
                        ? "text-red-600"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {printNotice}
                  </p>
                ) : null}
              </div>
              {selected.to ? (
                <Link
                  to={selected.to}
                  className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[color:var(--brand-fg,#fff)] hover:opacity-90"
                >
                  Open report
                </Link>
              ) : selected.live ? (
                <button
                  type="button"
                  onClick={() => void printReport()}
                  disabled={printing || report.isLoading}
                  className="rounded-md border border-[color:var(--line)] px-3 py-1.5 text-xs font-medium hover:border-[color:var(--brand)] disabled:opacity-50 dark:border-slate-600"
                >
                  {printing ? "Printing…" : "Print"}
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {selected.to ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    This report has a dedicated screen with batch-level filters, pagination, and
                    export. Open it to run the report.
                  </p>
                  <Link
                    to={selected.to}
                    className="inline-block rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[color:var(--brand-fg,#fff)] hover:opacity-90"
                  >
                    Open {selected.title}
                  </Link>
                </div>
              ) : !selected.live ? (
                <p className="text-sm text-slate-500">
                  Coming online — listed by category until the query is wired.
                </p>
              ) : (
                <>
                  <DistFilterBar
                    value={filters}
                    onChange={setFilters}
                    cities={cities.data ?? []}
                    areas={areas.data ?? []}
                  />
                  {report.isError ? (
                    <p className="mt-3 text-sm text-red-600">{(report.error as Error).message}</p>
                  ) : null}
                  <div className="mt-3">
                    <DistDataTable
                      columns={columns}
                      rows={rows}
                      rowKey={(r) =>
                        String(
                          r.id ??
                            r.orderNumber ??
                            r.code ??
                            r.deliveryNumber ??
                            r.collectionNumber ??
                            JSON.stringify(r).slice(0, 48),
                        )
                      }
                      empty={report.isLoading ? "Loading…" : "No rows for these filters"}
                      onExport={
                        rows.length
                          ? () =>
                              exportRowsToCsv(
                                `${selectedId}.csv`,
                                report.data?.columns ?? [],
                                rows.map((r) =>
                                  (report.data?.columns ?? []).map((c) => String(r[c] ?? "")),
                                ),
                              )
                          : undefined
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
