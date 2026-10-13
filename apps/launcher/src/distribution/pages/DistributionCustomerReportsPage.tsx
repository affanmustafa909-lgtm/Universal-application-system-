/**
 * Customer Reports hub — sales, credit, ledger, bonus, aging.
 * Each saved view gets a stable CUST-xxxx report number.
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchDistributionReport } from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { printDistReportDocument } from "../lib/printDistOrder";
import {
  deleteCustomerReportPreset,
  loadSavedCustomerReports,
  saveCustomerReportPreset,
  type SavedCustomerReport,
} from "../spec/savedCustomerReports";
import {
  DistButton,
  DistDataTable,
  DistDateField,
  DistErrorBanner,
  DistInput,
  DistKpiCard,
  DistPageShell,
  exportRowsToCsv,
} from "../ui/DistUi";

const TABS = [
  { key: "sales", label: "Customer sales", reportId: "customer-sales" },
  { key: "credit", label: "Customer credit", reportId: "customer-credit" },
  { key: "ledger", label: "Customer ledger", reportId: "customer-ledger" },
  { key: "bonus", label: "Bonus by customer", reportId: "sales-report" },
  { key: "aging", label: "Outstanding / aging", reportId: "outstanding-aging" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(v: string | null): v is TabKey {
  return TABS.some((t) => t.key === v);
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  return isoDaysAgo(0);
}

function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}

function str(v: unknown, fallback = "—"): string {
  const s = String(v ?? "").trim();
  return s || fallback;
}

type BonusAgg = {
  key: string;
  code: string;
  name: string;
  lines: number;
  soldQty: number;
  bonusQty: number;
  bonusValuePkr: number;
  salesPkr: number;
};

export function DistributionCustomerReportsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const branchName = branch?.name ?? branchCode ?? "";
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const customerQ = searchParams.get("q") ?? "";

  const [tab, setTab] = useState<TabKey>(() => (isTabKey(tabParam) ? tabParam : "sales"));
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [q, setQ] = useState(customerQ);
  const [error, setError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activeReportNumber, setActiveReportNumber] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isTabKey(tabParam) && tabParam !== tab) setTab(tabParam);
  }, [tabParam, tab]);

  useEffect(() => {
    if (customerQ && customerQ !== q) setQ(customerQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate from URL once
  }, [customerQ]);

  function selectTab(next: TabKey) {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  const tabDef = TABS.find((t) => t.key === tab) ?? TABS[0];

  const reportQ = useQuery({
    queryKey: ["distribution", "customer-reports", tabDef.reportId, branchCode, from, to, tab],
    enabled: Boolean(branchCode),
    queryFn: () =>
      fetchDistributionReport(tabDef.reportId, {
        branchCode: branchCode!,
        from,
        to,
      }),
  });

  const saved = useMemo(() => loadSavedCustomerReports(), [savedTick]);

  const bonusRows = useMemo(() => {
    if (tab !== "bonus") return [] as BonusAgg[];
    const raw = (reportQ.data?.rows ?? []) as Record<string, unknown>[];
    const map = new Map<string, BonusAgg>();
    for (const r of raw) {
      const freeQty = num(r.freeQty);
      if (freeQty <= 0) continue;
      const key = str(r.tradeCustomerId, str(r.customerCode, str(r.customerName, "unknown")));
      const cur = map.get(key) ?? {
        key,
        code: str(r.customerCode),
        name: str(r.customerName),
        lines: 0,
        soldQty: 0,
        bonusQty: 0,
        bonusValuePkr: 0,
        salesPkr: 0,
      };
      cur.lines += 1;
      cur.soldQty += num(r.qty);
      cur.bonusQty += freeQty;
      cur.bonusValuePkr += num(r.bonusValuePkr) || Math.round(freeQty * num(r.unitPricePkr));
      cur.salesPkr += num(r.salesPkr);
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.bonusQty - a.bonusQty);
  }, [tab, reportQ.data]);

  const tableRows = useMemo(() => {
    let list: Record<string, unknown>[] =
      tab === "bonus"
        ? (bonusRows as unknown as Record<string, unknown>[])
        : ((reportQ.data?.rows ?? []) as Record<string, unknown>[]);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((r) => JSON.stringify(r).toLowerCase().includes(needle));
    }
    return list;
  }, [tab, bonusRows, reportQ.data, q]);

  const columns = useMemo(() => {
    if (tab === "bonus") {
      return [
        { key: "code", header: "Code", render: (r: Record<string, unknown>) => str(r.code) },
        { key: "name", header: "Customer", render: (r: Record<string, unknown>) => str(r.name) },
        { key: "lines", header: "Lines", render: (r: Record<string, unknown>) => num(r.lines) },
        { key: "sold", header: "Sold qty", render: (r: Record<string, unknown>) => num(r.soldQty) },
        {
          key: "bonus",
          header: "Bonus qty",
          render: (r: Record<string, unknown>) => (
            <span className="font-semibold text-amber-700 dark:text-amber-300">{num(r.bonusQty)}</span>
          ),
        },
        {
          key: "bval",
          header: "Bonus value",
          render: (r: Record<string, unknown>) => formatPkr(num(r.bonusValuePkr)),
        },
        {
          key: "sales",
          header: "Sales",
          render: (r: Record<string, unknown>) => formatPkr(num(r.salesPkr)),
        },
      ];
    }
    const keys = reportQ.data?.columns ?? [];
    return keys.map((key) => ({
      key,
      header: key.replace(/([A-Z])/g, " $1").replace(/Pkr$/i, " PKR"),
      render: (row: Record<string, unknown>) => {
        const v = row[key];
        if (typeof v === "number" && /pkr|total|sales|outstanding|qty|amount|count|days|pct|over|bonus|free/i.test(key)) {
          return /pkr|sales|outstanding|amount|value|credit|received|over/i.test(key)
            ? formatPkr(v)
            : v.toLocaleString();
        }
        if (v == null) return "—";
        return String(v);
      },
    }));
  }, [tab, reportQ.data]);

  const kpis = useMemo(() => {
    if (tab === "bonus") {
      return {
        rows: bonusRows.length,
        bonusQty: bonusRows.reduce((s, r) => s + r.bonusQty, 0),
        bonusValue: bonusRows.reduce((s, r) => s + r.bonusValuePkr, 0),
        sales: bonusRows.reduce((s, r) => s + r.salesPkr, 0),
      };
    }
    const sales = tableRows.reduce((s, r) => s + num(r.salesPkr ?? r.totalPkr), 0);
    const outstanding = tableRows.reduce((s, r) => s + num(r.outstandingPkr), 0);
    return {
      rows: tableRows.length,
      bonusQty: tableRows.reduce((s, r) => s + num(r.freeQty ?? r.bonusQty), 0),
      bonusValue: 0,
      sales: sales || outstanding,
    };
  }, [tab, bonusRows, tableRows]);

  function loadPreset(p: SavedCustomerReport) {
    setActivePresetId(p.id);
    setActiveReportNumber(p.reportNumber);
    setPresetName(p.name);
    if (isTabKey(p.tab)) selectTab(p.tab);
    if (p.from) setFrom(p.from);
    if (p.to) setTo(p.to);
    if (p.q != null) setQ(p.q);
    setNotice(`Loaded ${p.reportNumber} — “${p.name}”`);
  }

  function savePreset() {
    const savedRow = saveCustomerReportPreset({
      id: activePresetId ?? undefined,
      name: presetName || tabDef.label,
      tab,
      from,
      to,
      q: q || undefined,
    });
    setActivePresetId(savedRow.id);
    setActiveReportNumber(savedRow.reportNumber);
    setPresetName(savedRow.name);
    setSavedTick((n) => n + 1);
    setNotice(`Saved ${savedRow.reportNumber} — “${savedRow.name}”`);
    setError(null);
  }

  async function printCurrent() {
    try {
      const titleBase = presetName || tabDef.label;
      const title = activeReportNumber ? `${activeReportNumber} — ${titleBase}` : titleBase;
      if (tab === "bonus") {
        await printDistReportDocument({
          title,
          subtitle: `${from} → ${to}`,
          branchName,
          branchCode,
          columns: ["Code", "Customer", "Lines", "Sold", "Bonus", "Bonus value", "Sales"],
          rows: (tableRows as unknown as BonusAgg[]).map((r) => ({
            Code: r.code,
            Customer: r.name,
            Lines: r.lines,
            Sold: r.soldQty,
            Bonus: r.bonusQty,
            "Bonus value": r.bonusValuePkr,
            Sales: r.salesPkr,
          })),
        });
      } else {
        const keys = reportQ.data?.columns ?? [];
        await printDistReportDocument({
          title,
          subtitle: `${from} → ${to}`,
          branchName,
          branchCode,
          columns: keys,
          rows: tableRows.map((r) => {
            const out: Record<string, unknown> = {};
            for (const k of keys) out[k] = r[k];
            return out;
          }),
        });
      }
      setNotice(
        activeReportNumber
          ? `Print opened for ${activeReportNumber}`
          : "Print opened — save report first to assign a report number",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Print failed");
    }
  }

  function exportCurrent() {
    if (tab === "bonus") {
      exportRowsToCsv(
        `customer-bonus-${activeReportNumber ?? "export"}.csv`,
        ["code", "name", "lines", "soldQty", "bonusQty", "bonusValue", "sales"],
        (tableRows as unknown as BonusAgg[]).map((r) => [
          r.code,
          r.name,
          r.lines,
          r.soldQty,
          r.bonusQty,
          r.bonusValuePkr,
          r.salesPkr,
        ]),
      );
      return;
    }
    const keys = reportQ.data?.columns ?? [];
    exportRowsToCsv(
      `customer-${tab}-${activeReportNumber ?? "export"}.csv`,
      keys,
      tableRows.map((r) => keys.map((k) => String(r[k] ?? ""))),
    );
  }

  const loadError = reportQ.error instanceof Error ? reportQ.error.message : null;

  return (
    <DistPageShell
      title="Customer Reports"
      subtitle={
        activeReportNumber
          ? `${activeReportNumber} · sales, credit, ledger, bonus & aging`
          : "Sales, credit, ledger, bonus & aging — save to assign CUST-xxxx"
      }
      breadcrumb={[
        { label: "Report Center", to: "/pops/distribution/reports" },
        { label: "Customer Reports" },
      ]}
      actions={
        <>
          <Link
            to="/pops/distribution/bonus-reports?tab=customer"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
          >
            Bonus hub
          </Link>
          <Link
            to="/pops/distribution/trade-customers"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
          >
            Trade customers
          </Link>
          <DistButton variant="secondary" onClick={() => void exportCurrent()}>
            Export CSV
          </DistButton>
          <DistButton variant="secondary" onClick={() => void printCurrent()}>
            Print
          </DistButton>
          <DistButton variant="secondary" onClick={() => void reportQ.refetch()}>
            Refresh
          </DistButton>
        </>
      }
    >
      {error || loadError ? (
        <DistErrorBanner
          message={error || loadError || ""}
          onRetry={() => {
            setError(null);
            void reportQ.refetch();
          }}
        />
      ) : null}
      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                on
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="text-xs text-slate-500">
          From
          <div className="mt-1">
            <DistDateField value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
        </label>
        <label className="text-xs text-slate-500">
          To
          <div className="mt-1">
            <DistDateField value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </label>
        <label className="text-xs text-slate-500">
          Search
          <div className="mt-1">
            <DistInput
              placeholder="Code, name, area…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </label>
        <label className="text-xs text-slate-500">
          Save as
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <DistInput
              placeholder={tabDef.label}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <DistButton onClick={savePreset}>
              {activeReportNumber ? `Update ${activeReportNumber}` : "Save + number"}
            </DistButton>
          </div>
        </label>
      </div>

      {saved.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Saved customer reports
          </div>
          <ul className="flex flex-wrap gap-2">
            {saved.map((p) => (
              <li key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => loadPreset(p)}
                  className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                    activePresetId === p.id
                      ? "border-cyan-600 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
                      : "border-slate-200 hover:border-cyan-400 dark:border-slate-700"
                  }`}
                  title={`${p.name} · ${p.tab}`}
                >
                  {p.reportNumber}
                  <span className="ml-1 font-normal text-slate-500">{p.name}</span>
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-[10px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  title={`Delete ${p.reportNumber}`}
                  onClick={() => {
                    if (!window.confirm(`Delete saved report ${p.reportNumber}?`)) return;
                    deleteCustomerReportPreset(p.id);
                    if (activePresetId === p.id) {
                      setActivePresetId(null);
                      setActiveReportNumber(null);
                    }
                    setSavedTick((n) => n + 1);
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DistKpiCard label="Rows" value={kpis.rows} />
        <DistKpiCard
          label={tab === "bonus" ? "Bonus qty" : "Sales / outstanding"}
          value={tab === "bonus" ? kpis.bonusQty : formatPkr(kpis.sales)}
          tone={tab === "bonus" ? "warning" : "success"}
        />
        {tab === "bonus" ? (
          <DistKpiCard label="Bonus value" value={formatPkr(kpis.bonusValue)} tone="danger" />
        ) : null}
        <DistKpiCard label="Report #" value={activeReportNumber ?? "— unsaved"} />
      </div>

      <DistDataTable
        loading={reportQ.isLoading}
        empty={`No ${tabDef.label.toLowerCase()} rows in range`}
        rows={tableRows}
        rowKey={(r) =>
          String(r.key ?? r.code ?? r.id ?? r.name ?? JSON.stringify(r).slice(0, 80))
        }
        columns={columns}
      />
    </DistPageShell>
  );
}
