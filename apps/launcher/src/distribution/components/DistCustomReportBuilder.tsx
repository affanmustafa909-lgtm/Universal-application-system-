import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchPharmacyAreas,
  fetchPharmacyCities,
  fetchPharmacyCompanies,
  fetchPharmacyEmployeesPicker,
  fetchPharmacySalesForce,
} from "../../pharmacy/api/pharmacy-erp";
import { usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { runCustomReport } from "../lib/customReportRunner";
import { printDistReportDocument } from "../lib/printDistOrder";
import {
  CUSTOM_DATASET_CATEGORIES,
  CUSTOM_REPORT_DATASETS,
  deleteCustomReportPreset,
  getDataset,
  loadSavedCustomReports,
  saveCustomReportPreset,
  type SavedCustomReport,
} from "../spec/customReports";
import {
  DistButton,
  DistDataTable,
  DistDateField,
  DistInput,
  DistSelect,
  DistStatusBadge,
  distCheckClass,
  distChipActiveClass,
  distChipClass,
  exportRowsToCsv,
} from "../ui/DistUi";

type Props = {
  onBackToCatalog?: () => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function DistCustomReportBuilder({ onBackToCatalog }: Props): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [datasetId, setDatasetId] = useState("sales-report");
  const dataset = getDataset(datasetId);
  const [columns, setColumns] = useState<string[]>(() =>
    (getDataset("sales-report")?.fields ?? CUSTOM_REPORT_DATASETS[0]?.fields ?? []).map((f) => f.key),
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cityId, setCityId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [salesmanIds, setSalesmanIds] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [presetName, setPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runCustomReport>> | null>(null);

  const cities = useQuery({ queryKey: ["pharmacy", "cities"], queryFn: fetchPharmacyCities });
  const areas = useQuery({ queryKey: ["pharmacy", "areas"], queryFn: fetchPharmacyAreas });
  const companies = useQuery({ queryKey: ["pharmacy", "companies"], queryFn: fetchPharmacyCompanies });
  const employees = useQuery({
    queryKey: ["pharmacy", "employees-picker"],
    queryFn: fetchPharmacyEmployeesPicker,
  });
  const salesForce = useQuery({
    queryKey: ["pharmacy", "sales-force"],
    queryFn: fetchPharmacySalesForce,
  });

  const employeeOptions = useMemo(() => {
    const all = employees.data ?? [];
    const sf = salesForce.data ?? [];
    const sfIds = new Set(sf.map((r: { employeeId?: string }) => String(r.employeeId ?? "")).filter(Boolean));
    // Prefer sales-force employees first, then remaining staff
    const preferred = all.filter((e) => sfIds.has(e.id));
    const rest = all.filter((e) => !sfIds.has(e.id));
    const list = preferred.length ? [...preferred, ...rest] : all;
    return list.map((e) => ({
      id: String(e.id),
      name: e.name || e.employeeCode || e.id,
      code: e.employeeCode,
      isSalesForce: sfIds.has(String(e.id)),
    }));
  }, [employees.data, salesForce.data]);

  const selectedSalesmen = useMemo(
    () => employeeOptions.filter((e) => salesmanIds.includes(e.id)),
    [employeeOptions, salesmanIds],
  );

  const saved = useMemo(() => loadSavedCustomReports(), [savedTick]);

  const datasetsByCat = useMemo(() => {
    return CUSTOM_DATASET_CATEGORIES.map((cat) => ({
      cat,
      items: CUSTOM_REPORT_DATASETS.filter((d) => d.category === cat),
    })).filter((g) => g.items.length > 0);
  }, []);

  const selectedCompany = useMemo(
    () => (companies.data ?? []).find((c: { id: string }) => c.id === companyId),
    [companies.data, companyId],
  );

  function applyDataset(id: string) {
    const d = getDataset(id);
    setDatasetId(id);
    setColumns(d ? d.fields.map((f) => f.key) : []);
    setActivePresetId(null);
    setResult(null);
    setError(null);
  }

  function toggleColumn(key: string) {
    setColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function toggleSalesman(id: string) {
    const sid = String(id);
    setSalesmanIds((prev) =>
      prev.map(String).includes(sid) ? prev.filter((x) => String(x) !== sid) : [...prev, sid],
    );
  }

  function selectAllColumns() {
    setColumns(dataset?.fields.map((f) => f.key) ?? []);
  }

  function clearColumns() {
    setColumns([]);
  }

  function setDatePreset(kind: "today" | "yesterday" | "week" | "month" | "clear") {
    if (kind === "clear") {
      setFrom("");
      setTo("");
      return;
    }
    if (kind === "today") {
      const t = todayIso();
      setFrom(t);
      setTo(t);
      return;
    }
    if (kind === "yesterday") {
      const y = daysAgoIso(1);
      setFrom(y);
      setTo(y);
      return;
    }
    if (kind === "week") {
      setFrom(daysAgoIso(6));
      setTo(todayIso());
      return;
    }
    setFrom(daysAgoIso(29));
    setTo(todayIso());
  }

  const run = useMutation({
    mutationFn: () =>
      runCustomReport({
        datasetId,
        columns,
        filters: {
          from: from || undefined,
          to: to || undefined,
          cityId: cityId || undefined,
          areaId: areaId || undefined,
          branchCode: branch?.code,
          q: q || undefined,
          companyId: companyId || undefined,
          companyName: selectedCompany?.name,
          salesmanIds: salesmanIds.length ? salesmanIds : undefined,
          salesmanNames: selectedSalesmen.map((e) => e.name),
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      const bits = [
        `${data.rows.length} row(s)`,
        `${data.columns.length} column(s)`,
        companyId ? `company=${selectedCompany?.name ?? companyId}` : null,
        salesmanIds.length ? `${salesmanIds.length} user(s)` : null,
      ].filter(Boolean);
      setNotice(`Ready — ${bits.join(", ")}`);
    },
    onError: (e: Error) => {
      setResult(null);
      setError(e.message);
      setNotice(null);
    },
  });

  function loadPreset(p: SavedCustomReport) {
    setActivePresetId(p.id);
    setPresetName(p.name);
    setDatasetId(p.datasetId);
    setColumns(p.columns);
    setResult(null);
    setError(null);
    setNotice(`Loaded “${p.name}”`);
  }

  function savePreset() {
    if (!columns.length) {
      setError("Select at least one column before saving");
      return;
    }
    const savedRow = saveCustomReportPreset({
      id: activePresetId ?? undefined,
      name: presetName || dataset?.label || "My custom report",
      datasetId,
      columns,
    });
    setActivePresetId(savedRow.id);
    setPresetName(savedRow.name);
    setSavedTick((n) => n + 1);
    setNotice(`Saved “${savedRow.name}”`);
    setError(null);
  }

  async function printResult() {
    if (!result) return;
    setNotice(null);
    try {
      const filterBits = [
        companyId ? `Company: ${selectedCompany?.name ?? companyId}` : null,
        selectedSalesmen.length
          ? `Users: ${selectedSalesmen.map((e) => e.name).join(", ")}`
          : null,
        from || to ? `Date: ${from || "…"} → ${to || "…"}` : null,
      ].filter(Boolean);
      await printDistReportDocument({
        title: presetName || dataset?.label || "Custom report",
        subtitle: [filterBits.join(" · "), `${result.rows.length} row(s)`].filter(Boolean).join(" — "),
        columns: result.columns.map((c) => result.columnLabels[c] ?? c),
        rows: result.rows.map((r) => {
          const mapped: Record<string, unknown> = {};
          for (const c of result.columns) {
            mapped[result.columnLabels[c] ?? c] = r[c];
          }
          return mapped;
        }),
        branchName: branch?.name,
        branchCode: branch?.code,
      });
      setNotice("Print dialog opened");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Print failed");
    }
  }

  const tableColumns = useMemo(() => {
    if (!result) return [];
    return result.columns.map((key) => {
      const meta = result.fieldMeta.find((f) => f.key === key);
      return {
        key,
        header: result.columnLabels[key] ?? key,
        render: (row: Record<string, unknown>) => {
          const v = row[key];
          if (key === "status" && typeof v === "string") return <DistStatusBadge status={v} />;
          if (meta?.numeric && typeof v === "number") return v.toLocaleString();
          if (v == null || v === "") return "—";
          return String(v);
        },
      };
    });
  }, [result]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Custom report builder
          </h2>
          <p className="text-xs text-slate-500">
            Pick company + users (salesmen), date, columns — e.g. today&apos;s sales against one company.
          </p>
        </div>
        {onBackToCatalog ? (
          <DistButton variant="secondary" onClick={onBackToCatalog}>
            ← Catalog reports
          </DistButton>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[14rem_1fr_minmax(0,1.2fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
          <div className="shrink-0 border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
            Saved reports
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {saved.length === 0 ? (
              <p className="px-1 py-2 text-xs text-slate-400">No saved custom reports yet</p>
            ) : (
              saved.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm ${
                    activePresetId === p.id
                      ? "bg-[var(--brand-cream)] text-[color:var(--brand-dark,var(--brand))] ring-1 ring-[color:var(--brand)]/30"
                      : "hover:bg-[var(--brand-cream)]/60 dark:hover:bg-slate-900"
                  }`}
                >
                  <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => loadPreset(p)}>
                    {p.name}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-[10px] text-red-600"
                    title="Delete"
                    onClick={() => {
                      deleteCustomReportPreset(p.id);
                      if (activePresetId === p.id) setActivePresetId(null);
                      setSavedTick((n) => n + 1);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="relative z-10 flex min-h-0 flex-col overflow-hidden rounded-xl border border-[color:var(--line)] bg-[var(--card,#fff)] dark:border-slate-800 dark:bg-slate-950/40">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
            <label className="block text-xs text-slate-500">
              Data source
              <DistSelect
                className="mt-1"
                value={datasetId}
                onChange={(e) => applyDataset(e.target.value)}
              >
                {datasetsByCat.map((g) => (
                  <optgroup key={g.cat} label={g.cat}>
                    {g.items.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </DistSelect>
            </label>
            {dataset ? (
              <p className="text-[11px] text-slate-500">{dataset.description}</p>
            ) : null}

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Columns ({columns.length}/{dataset?.fields.length ?? 0})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[color:var(--brand)]"
                    onClick={selectAllColumns}
                  >
                    Select all
                  </button>
                  <button type="button" className="text-[11px] text-[color:var(--muted)]" onClick={clearColumns}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-[color:var(--line)] bg-[var(--brand-cream)]/30 p-2 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-950/40">
                {(dataset?.fields ?? []).map((field) => {
                  const checked = columns.includes(field.key);
                  return (
                    <label
                      key={field.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-[var(--card,#fff)] dark:hover:bg-slate-900"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColumn(field.key)}
                        className={distCheckClass}
                      />
                      <span className="text-[color:var(--ink)] dark:text-slate-200">{field.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Date range
                </span>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["today", "Today"],
                      ["yesterday", "Yesterday"],
                      ["week", "7 days"],
                      ["month", "30 days"],
                      ["clear", "Clear"],
                    ] as const
                  ).map(([kind, label]) => {
                    const active =
                      kind === "today"
                        ? from === todayIso() && to === todayIso()
                        : kind === "yesterday"
                          ? from === daysAgoIso(1) && to === daysAgoIso(1)
                          : kind === "week"
                            ? from === daysAgoIso(6) && to === todayIso()
                            : kind === "month"
                              ? from === daysAgoIso(29) && to === todayIso()
                              : false;
                    return (
                      <button
                        key={kind}
                        type="button"
                        className={active ? distChipActiveClass : distChipClass}
                        onClick={() => setDatePreset(kind)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <DistDateField label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
                <DistDateField label="To" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-500 sm:col-span-2">
                Against company
                <DistSelect className="mt-1" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  <option value="">All companies</option>
                  {(companies.data ?? []).map((c: { id: string; name?: string; code?: string }) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.code ?? c.id}
                    </option>
                  ))}
                </DistSelect>
              </label>

              <label className="text-xs text-slate-500">
                City
                <DistSelect className="mt-1" value={cityId} onChange={(e) => setCityId(e.target.value)}>
                  <option value="">All cities</option>
                  {(cities.data ?? []).map((c: { id: string; name?: string }) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.id}
                    </option>
                  ))}
                </DistSelect>
              </label>
              <label className="text-xs text-slate-500">
                Area
                <DistSelect className="mt-1" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  <option value="">All areas</option>
                  {(areas.data ?? []).map((a: { id: string; name?: string }) => (
                    <option key={a.id} value={a.id}>
                      {a.name ?? a.id}
                    </option>
                  ))}
                </DistSelect>
              </label>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Users / salesmen ({salesmanIds.length} selected)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[color:var(--brand)]"
                    onClick={() => setSalesmanIds(employeeOptions.map((e) => e.id))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-[color:var(--muted)]"
                    onClick={() => setSalesmanIds([])}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {selectedSalesmen.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1">
                  {selectedSalesmen.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={distChipActiveClass}
                      title="Click to remove"
                      onClick={() => toggleSalesman(e.id)}
                    >
                      {e.name} ✕
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mb-2 text-[10px] text-[color:var(--muted)]">
                  No user selected — report includes all salesmen. Tap a name below to filter.
                </p>
              )}

              <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-[color:var(--line)] bg-[var(--brand-cream)]/30 p-2 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-950/40">
                {employeeOptions.length === 0 ? (
                  <p className="px-1 py-2 text-[11px] text-[color:var(--muted)]">
                    {employees.isLoading ? "Loading employees…" : "No employees found"}
                  </p>
                ) : (
                  employeeOptions.map((e) => {
                    const checked = salesmanIds.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggleSalesman(e.id)}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                          checked
                            ? "bg-[var(--brand)] text-[color:var(--brand-fg,#fff)] shadow-sm"
                            : "bg-[var(--card,#fff)] text-[color:var(--ink)] hover:bg-[var(--brand-cream)] dark:bg-slate-900"
                        }`}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                            checked
                              ? "border-white/80 bg-white/20"
                              : "border-[color:var(--line)]"
                          }`}
                          aria-hidden
                        >
                          {checked ? "✓" : ""}
                        </span>
                        <span className="min-w-0 truncate">
                          {e.name}
                          {e.code ? (
                            <span className={checked ? "opacity-80" : "text-[color:var(--muted)]"}>
                              {" "}
                              · {e.code}
                            </span>
                          ) : null}
                          {e.isSalesForce ? (
                            <span className={checked ? "opacity-80" : "text-[color:var(--brand)]"}>
                              {" "}
                              · SF
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-[10px] text-[color:var(--muted)]">
                Select users, then click <strong>Run report</strong>. Orders need a salesman assigned
                for this filter to match.
              </p>
            </div>

            <label className="block text-xs text-slate-500">
              Search in results
              <DistInput
                className="mt-1"
                placeholder="Filter rows…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <DistButton disabled={run.isPending || !columns.length} onClick={() => run.mutate()}>
                {run.isPending ? "Running…" : "Run report"}
              </DistButton>
              <DistInput
                className="min-w-[10rem] flex-1"
                placeholder="Save as name…"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
              <DistButton variant="secondary" onClick={savePreset} disabled={!columns.length}>
                Save
              </DistButton>
            </div>

            {notice ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        </section>

        <section className="relative z-[1] flex min-h-0 flex-col overflow-hidden rounded-xl border border-[color:var(--line)] bg-[var(--card,#fff)] dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[color:var(--line)] px-4 py-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {presetName || dataset?.label || "Result"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {result ? `${result.rows.length} row(s)` : "Run to see data"}
                {companyId ? ` · ${selectedCompany?.name ?? "company"}` : ""}
                {salesmanIds.length ? ` · ${salesmanIds.length} user(s)` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DistButton
                variant="secondary"
                disabled={!result?.rows.length}
                onClick={() => void printResult()}
              >
                Print
              </DistButton>
              <DistButton
                variant="secondary"
                disabled={!result?.rows.length}
                onClick={() => {
                  if (!result) return;
                  exportRowsToCsv(
                    `${(presetName || dataset?.id || "custom-report").replace(/\s+/g, "-")}.csv`,
                    result.columns.map((c) => result.columnLabels[c] ?? c),
                    result.rows.map((r) => result.columns.map((c) => String(r[c] ?? ""))),
                  );
                }}
              >
                Export CSV
              </DistButton>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {!result ? (
              <p className="text-sm text-slate-500">
                Select company / users / columns, then click <strong>Run report</strong>.
              </p>
            ) : (
              <DistDataTable
                columns={tableColumns}
                rows={result.rows}
                rowKey={(r) =>
                  String(r.id ?? r.orderNumber ?? r.code ?? r.invoiceNumber ?? JSON.stringify(r).slice(0, 40))
                }
                empty="No rows for these filters"
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
