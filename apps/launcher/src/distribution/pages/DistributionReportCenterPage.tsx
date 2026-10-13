import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../pops/ui/PageHeader";
import { usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { fetchPharmacyAreas, fetchPharmacyCities } from "../../pharmacy/api/pharmacy-erp";
import { runCatalogReport } from "../lib/composedDistReports";
import { DISTRIBUTION_REPORTS, REPORT_CATEGORY_ORDER } from "../spec/reports";
import { DistCustomReportBuilder } from "../components/DistCustomReportBuilder";
import {
  DistButton,
  DistDataTable,
  DistFilterBar,
  DistFilterValues,
  DistStatusBadge,
  exportRowsToCsv,
} from "../ui/DistUi";
import { DistReportSummary } from "../components/DistReportSummary";
import {
  DIST_SAVED_REPORTS_CHANGED_EVENT,
  deleteSavedDistReport,
  loadSavedDistReports,
  saveDistReportToArchive,
  type SavedDistReport,
} from "../lib/distSavedReports";
import {
  loadDistReportPrintSettings,
  peekNextReportNumber,
} from "../lib/distReportSettings";
import { printDistReportDocument } from "../lib/printDistOrder";
import { summarizeReportRows, summarySubtitle } from "../lib/reportSummary";
import { sessionCanManageUsers } from "../../pops/lib/roleAccess";
import { usePopsStore } from "../../stores/popsStore";
import { useSessionStore } from "../../stores/sessionStore";

type Mode = "catalog" | "custom" | "saved";

const COLUMN_LABELS: Record<string, string> = {
  deliveryNumber: "Delivery #",
  customerCode: "Cust code",
  customerName: "Customer",
  orderNumber: "Order #",
  invoiceNumber: "Invoice #",
  creditLimitPkr: "Credit",
  creditDays: "Credit days",
  receivedPkr: "Received",
  leftToReceivePkr: "Left to receive",
  outstandingPkr: "Outstanding",
  availableCreditPkr: "Available credit",
  overByPkr: "Over credit",
  openingBalancePkr: "Opening balance",
  creditCategory: "Credit category",
  termsOfPayment: "Terms",
  modeOfPayment: "Payment mode",
  monthlySalesTargetPkr: "Monthly target",
  discountPct: "Discount %",
  priceLevel: "Price level",
  businessName: "Business",
  companyCredit: "Company credit",
  deliveredQty: "Delivered",
  returnedQty: "Returned",
  collectedPkr: "Collected",
  salesPkr: "Sales PKR",
};

function columnHeader(key: string): string {
  if (COLUMN_LABELS[key]) return COLUMN_LABELS[key];
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/Pkr$/i, " PKR");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function DistributionReportCenterPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const displayRole = usePopsStore((s) => s.displayRole);
  const claims = useSessionStore((s) => s.claims);
  const canAdminDelete = displayRole === "admin" || sessionCanManageUsers(claims);
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const modeParam = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(() =>
    modeParam === "custom" ? "custom" : modeParam === "saved" ? "saved" : "catalog",
  );
  const [savedTick, setSavedTick] = useState(0);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [catFilter, setCatFilter] = useState<string>(() => {
    if (categoryParam && REPORT_CATEGORY_ORDER.includes(categoryParam as (typeof REPORT_CATEGORY_ORDER)[number])) {
      return categoryParam;
    }
    return "All";
  });
  const reportParam = searchParams.get("report");
  const [selectedId, setSelectedId] = useState(() => {
    if (reportParam && DISTRIBUTION_REPORTS.some((r) => r.id === reportParam)) return reportParam;
    if (categoryParam === "Purchase") return "purchase-dashboard";
    return "sales-report";
  });
  useEffect(() => {
    if (reportParam && DISTRIBUTION_REPORTS.some((r) => r.id === reportParam)) {
      setSelectedId(reportParam);
      setMode("catalog");
    }
  }, [reportParam]);
  useEffect(() => {
    if (modeParam === "custom" || modeParam === "saved" || modeParam === "catalog") {
      setMode(modeParam);
    }
  }, [modeParam]);
  useEffect(() => {
    const onChange = () => setSavedTick((n) => n + 1);
    window.addEventListener(DIST_SAVED_REPORTS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DIST_SAVED_REPORTS_CHANGED_EVENT, onChange);
  }, []);
  const [filters, setFilters] = useState<DistFilterValues>({});
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const savedReports = useMemo(() => loadSavedDistReports(), [savedTick]);
  const activeSaved = savedReports.find((r) => r.id === activeSavedId) ?? null;
  const selected = DISTRIBUTION_REPORTS.find((r) => r.id === selectedId) ?? DISTRIBUTION_REPORTS[0];
  const cities = useQuery({ queryKey: ["pharmacy", "cities"], queryFn: fetchPharmacyCities });
  const areas = useQuery({ queryKey: ["pharmacy", "areas"], queryFn: fetchPharmacyAreas });
  const report = useQuery({
    queryKey: ["distribution", "report", selectedId, filters, branch?.code],
    enabled: mode === "catalog" && Boolean(selected?.live) && !selected?.to,
    queryFn: () =>
      runCatalogReport(selectedId, {
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
      header: columnHeader(key),
      render: (row: Record<string, unknown>) => {
        const v = row[key];
        if (key === "status" && typeof v === "string") return <DistStatusBadge status={v} />;
        if (typeof v === "number" && /pkr|total|sales|outstanding|qty|quantity|amount|count|days|pct|over/i.test(key)) {
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

  function buildLabeledGrid(): {
    keys: string[];
    labels: string[];
    labeledRows: Record<string, unknown>[];
  } {
    const keys = report.data?.columns ?? columns.map((c) => c.key);
    const labels = keys.map(columnHeader);
    const labeledRows = rows.map((row) => {
      const labeled: Record<string, unknown> = {};
      keys.forEach((key, index) => {
        labeled[labels[index]!] = row[key];
      });
      return labeled;
    });
    return { keys, labels, labeledRows };
  }

  function saveCatalogReport() {
    if (!selected?.live || selected.to) {
      setPrintNotice("Open the dedicated screen for this report, or pick a live catalog report.");
      return;
    }
    if (!rows.length) {
      setPrintNotice("No rows to save — adjust filters and run again.");
      return;
    }
    const { keys, labels, labeledRows } = buildLabeledGrid();
    const look = loadDistReportPrintSettings(branch?.code).look;
    const saved = saveDistReportToArchive({
      branchCode: branch?.code,
      name: saveName.trim() || selected.title,
      source: "catalog",
      reportId: selected.id,
      columns: keys,
      columnLabels: labels,
      filters: {
        from: filters.from,
        to: filters.to,
        cityId: filters.cityId,
        areaId: filters.areaId,
        q: filters.q,
      },
      rows: labeledRows,
      look,
    });
    setSaveName("");
    setSavedTick((n) => n + 1);
    setActiveSavedId(saved.id);
    setPrintNotice(`Saved ${saved.reportNumber} — open Saved reports section`);
  }

  async function printReport(fromSaved?: SavedDistReport | null) {
    setPrintNotice(null);
    setPrinting(true);
    try {
      if (fromSaved?.rows?.length && fromSaved.columnLabels?.length) {
        await printDistReportDocument({
          title: fromSaved.name,
          subtitle: `${fromSaved.rowCount} row(s) · ${fromSaved.source}`,
          reportNumber: fromSaved.reportNumber,
          columns: fromSaved.columnLabels,
          rows: fromSaved.rows,
          branchName: branch?.name,
          branchCode: branch?.code,
        });
        setPrintNotice(`Print opened for ${fromSaved.reportNumber}`);
        return;
      }

      const { keys, labels, labeledRows } = buildLabeledGrid();
      const totals = summarySubtitle(summarizeReportRows(keys, rows, columnHeader));
      // Auto-save + number on print
      const saved = saveDistReportToArchive({
        branchCode: branch?.code,
        name: saveName.trim() || selected.title,
        source: "catalog",
        reportId: selected.id,
        columns: keys,
        columnLabels: labels,
        filters: {
          from: filters.from,
          to: filters.to,
          cityId: filters.cityId,
          areaId: filters.areaId,
          q: filters.q,
        },
        rows: labeledRows,
        look: loadDistReportPrintSettings(branch?.code).look,
      });
      setSavedTick((n) => n + 1);
      setActiveSavedId(saved.id);
      await printDistReportDocument({
        title: selected.title,
        subtitle: [selected.description, totals].filter(Boolean).join(" — "),
        reportNumber: saved.reportNumber,
        columns: labels,
        rows: labeledRows,
        branchName: branch?.name,
        branchCode: branch?.code,
      });
      setPrintNotice(
        `Print opened for ${saved.reportNumber} (${loadDistReportPrintSettings(branch?.code).look} look)`,
      );
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
          subtitle="Catalog · custom builder · numbered Saved reports — print with brand / watermark looks."
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[color:var(--line)] bg-[var(--brand-cream)]/40 p-0.5 dark:border-slate-700">
            {(
              [
                ["catalog", "Catalog"],
                ["custom", "Custom builder"],
                ["saved", `Saved (${savedReports.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  mode === id
                    ? "bg-[var(--brand)] text-[color:var(--brand-fg,#fff)] shadow-sm"
                    : "text-[color:var(--muted)] hover:bg-[var(--card,#fff)] hover:text-[color:var(--ink)] dark:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
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
      ) : mode === "saved" ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[16rem_1fr]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
            <div className="shrink-0 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Saved reports
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Next # {peekNextReportNumber(branch?.code)} · sequence in Customize → A4 documents
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {savedReports.length === 0 ? (
                <p className="px-2 py-3 text-xs text-slate-400">
                  No numbered reports yet — Save or Print from Catalog / Custom builder.
                </p>
              ) : (
                savedReports.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-1 rounded-md px-2 py-1.5 ${
                      activeSavedId === r.id
                        ? "bg-[var(--brand-cream)] ring-1 ring-[color:var(--brand)]/30"
                        : "hover:bg-[var(--brand-cream)]/50"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm"
                      onClick={() => setActiveSavedId(r.id)}
                    >
                      <span className="mr-1.5 font-mono text-[10px] font-semibold text-[color:var(--brand)]">
                        {r.reportNumber}
                      </span>
                      <span className="truncate">{r.name}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {r.source} · {r.rowCount} rows
                      </span>
                    </button>
                    {canAdminDelete ? (
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-red-600"
                        title={`Delete ${r.reportNumber}`}
                        onClick={() => {
                          if (!window.confirm(`Delete ${r.reportNumber}?`)) return;
                          deleteSavedDistReport(r.id);
                          if (activeSavedId === r.id) setActiveSavedId(null);
                          setSavedTick((n) => n + 1);
                        }}
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </aside>
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
            {!activeSaved ? (
              <div className="p-6 text-sm text-slate-500">
                Select a numbered report from the left. Each Save / Print assigns the next sequence
                number from Customize settings.
              </div>
            ) : (
              <>
                <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {activeSaved.reportNumber} · {activeSaved.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {activeSaved.source} · {activeSaved.rowCount} rows · look{" "}
                      {activeSaved.look ?? loadDistReportPrintSettings(branch?.code).look}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DistButton
                      variant="secondary"
                      disabled={!activeSaved.rows?.length || printing}
                      onClick={() => void printReport(activeSaved)}
                    >
                      {printing ? "Printing…" : "Print"}
                    </DistButton>
                    {activeSaved.source === "custom" ? (
                      <DistButton variant="secondary" onClick={() => setMode("custom")}>
                        Open builder
                      </DistButton>
                    ) : (
                      <DistButton
                        variant="secondary"
                        onClick={() => {
                          setSelectedId(activeSaved.reportId);
                          setMode("catalog");
                        }}
                      >
                        Open catalog
                      </DistButton>
                    )}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  {activeSaved.rows?.length && activeSaved.columnLabels ? (
                    <DistDataTable
                      columns={activeSaved.columnLabels.map((label) => ({
                        key: label,
                        header: label,
                        render: (row: Record<string, unknown>) => {
                          const v = row[label];
                          if (typeof v === "number") return v.toLocaleString();
                          if (v == null || v === "") return "—";
                          return String(v);
                        },
                      }))}
                      rows={activeSaved.rows}
                      rowKey={(r) => JSON.stringify(r).slice(0, 48)}
                      empty="Snapshot empty"
                    />
                  ) : (
                    <p className="text-sm text-slate-500">
                      No row snapshot stored — re-run from Catalog / Custom and Save again.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
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
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Save as name…"
                    className="w-36 rounded-md border border-[color:var(--line)] bg-transparent px-2 py-1.5 text-xs dark:border-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => saveCatalogReport()}
                    disabled={report.isLoading || !rows.length}
                    className="rounded-md border border-[color:var(--line)] px-3 py-1.5 text-xs font-medium hover:border-[color:var(--brand)] disabled:opacity-50 dark:border-slate-600"
                  >
                    Save → {peekNextReportNumber(branch?.code)}
                  </button>
                  <button
                    type="button"
                    onClick={() => void printReport()}
                    disabled={printing || report.isLoading || !rows.length}
                    className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[color:var(--brand-fg,#fff)] disabled:opacity-50"
                  >
                    {printing ? "Printing…" : "Print + number"}
                  </button>
                </div>
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
                  {selectedId === "delivery-plan" ? (
                    <p className="mt-2 text-xs text-slate-500">Click a delivery to open its line details.</p>
                  ) : null}
                  {report.isError ? (
                    <p className="mt-3 text-sm text-red-600">{(report.error as Error).message}</p>
                  ) : null}
                  <DistReportSummary
                    columns={report.data?.columns ?? []}
                    rows={rows}
                    labelFor={columnHeader}
                  />
                  <div className="mt-3">
                    <DistDataTable
                      columns={columns}
                      rows={rows}
                      rowKey={(r) =>
                        [
                          r.id,
                          r.code,
                          r.deliveryNumber,
                          r.orderNumber,
                          r.sku,
                          r.product,
                          r.batch,
                          r.qty,
                          r.collectionNumber,
                        ]
                          .filter((part) => part != null && part !== "")
                          .join("|") || JSON.stringify(r).slice(0, 80)
                      }
                      onRowClick={
                        selectedId === "delivery-plan"
                          ? (row) => {
                              const number = String(row.deliveryNumber ?? "");
                              setSelectedId("delivery-plan-details");
                              setFilters((current) => ({ ...current, q: number }));
                            }
                          : undefined
                      }
                      empty={report.isLoading ? "Loading…" : "No rows for these filters"}
                      onExport={
                        rows.length
                          ? () =>
                              exportRowsToCsv(
                                `${selectedId}.csv`,
                                (report.data?.columns ?? []).map(columnHeader),
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
