/**
 * Bonus Reports hub — free/bonus qty by company, salesman, customer, warehouse,
 * product, scheme, plus line detail. Built from live sales-report + scheme-utilization.
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchDistributionReport,
  fetchPharmacyCompanies,
  fetchPharmacyEmployeesPicker,
  fetchPharmacyWarehouses,
} from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { printDistReportDocument } from "../lib/printDistOrder";
import {
  DistButton,
  DistDataTable,
  DistDateField,
  DistErrorBanner,
  DistInput,
  DistKpiCard,
  DistPageShell,
  DistSelect,
  exportRowsToCsv,
} from "../ui/DistUi";

const TABS = [
  { key: "summary", label: "Summary" },
  { key: "company", label: "By Company" },
  { key: "salesman", label: "By Salesman" },
  { key: "customer", label: "By Customer" },
  { key: "warehouse", label: "By Warehouse" },
  { key: "product", label: "By Product" },
  { key: "scheme", label: "Schemes" },
  { key: "detail", label: "Line detail" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(v: string | null): v is TabKey {
  return TABS.some((t) => t.key === v);
}

type BonusLine = {
  date: string;
  orderNumber: string;
  customerCode: string;
  customerName: string;
  tradeCustomerId?: string | null;
  salesman: string;
  salesmanEmployeeId?: string | null;
  warehouse: string;
  warehouseId?: string | null;
  company: string;
  companyId?: string | null;
  sku: string;
  product: string;
  qty: number;
  freeQty: number;
  bonusValuePkr: number;
  salesPkr: number;
  status: string;
  unitPricePkr?: number;
};

type AggRow = {
  key: string;
  label: string;
  secondary?: string;
  lines: number;
  soldQty: number;
  bonusQty: number;
  bonusValuePkr: number;
  salesPkr: number;
  bonusPct: number;
};

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

function normalizeLine(r: Record<string, unknown>): BonusLine {
  const freeQty = num(r.freeQty);
  const unit = num(r.unitPricePkr);
  const bonusValuePkr = num(r.bonusValuePkr) || Math.round(freeQty * unit);
  return {
    date: str(r.date, ""),
    orderNumber: str(r.orderNumber),
    customerCode: str(r.customerCode),
    customerName: str(r.customerName),
    tradeCustomerId: r.tradeCustomerId ? String(r.tradeCustomerId) : null,
    salesman: str(r.salesman, "Unassigned"),
    salesmanEmployeeId: r.salesmanEmployeeId ? String(r.salesmanEmployeeId) : null,
    warehouse: str(r.warehouse, "Unassigned"),
    warehouseId: r.warehouseId ? String(r.warehouseId) : null,
    company: str(r.company, "Unassigned"),
    companyId: r.companyId ? String(r.companyId) : null,
    sku: str(r.sku),
    product: str(r.product),
    qty: num(r.qty),
    freeQty,
    bonusValuePkr,
    salesPkr: num(r.salesPkr),
    status: str(r.status),
    unitPricePkr: unit,
  };
}

function aggregate(
  lines: BonusLine[],
  keyFn: (l: BonusLine) => string,
  labelFn: (l: BonusLine) => string,
  secondaryFn?: (l: BonusLine) => string,
): AggRow[] {
  const map = new Map<string, AggRow>();
  for (const l of lines) {
    if (l.freeQty <= 0 && l.qty <= 0) continue;
    const key = keyFn(l);
    const cur = map.get(key) ?? {
      key,
      label: labelFn(l),
      secondary: secondaryFn?.(l),
      lines: 0,
      soldQty: 0,
      bonusQty: 0,
      bonusValuePkr: 0,
      salesPkr: 0,
      bonusPct: 0,
    };
    cur.lines += 1;
    cur.soldQty += l.qty;
    cur.bonusQty += l.freeQty;
    cur.bonusValuePkr += l.bonusValuePkr;
    cur.salesPkr += l.salesPkr;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      bonusPct: r.soldQty > 0 ? Math.round((r.bonusQty / r.soldQty) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.bonusQty - a.bonusQty || b.bonusValuePkr - a.bonusValuePkr);
}

export function DistributionBonusReportsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const branchName = branch?.name ?? branchCode ?? "";
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [tab, setTab] = useState<TabKey>(() => (isTabKey(tabParam) ? tabParam : "summary"));
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [companyId, setCompanyId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [bonusOnly, setBonusOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isTabKey(tabParam) && tabParam !== tab) setTab(tabParam);
  }, [tabParam, tab]);

  function selectTab(next: TabKey) {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  const companiesQ = useQuery({
    queryKey: ["pharmacy", "companies"],
    queryFn: () => fetchPharmacyCompanies(),
    staleTime: 120_000,
  });
  const salesmenQ = useQuery({
    queryKey: ["pharmacy", "employees-picker"],
    queryFn: () => fetchPharmacyEmployeesPicker(),
    staleTime: 120_000,
  });
  const warehousesQ = useQuery({
    queryKey: ["pharmacy", "warehouses", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchPharmacyWarehouses(branchCode!),
    staleTime: 120_000,
  });

  const salesQ = useQuery({
    queryKey: [
      "distribution",
      "bonus-reports",
      "sales",
      branchCode,
      from,
      to,
      companyId,
      salesmanId,
    ],
    enabled: Boolean(branchCode),
    queryFn: () =>
      fetchDistributionReport("sales-report", {
        branchCode: branchCode!,
        from,
        to,
        companyId: companyId || undefined,
        salesmanIds: salesmanId ? [salesmanId] : undefined,
      }),
  });

  const schemeQ = useQuery({
    queryKey: ["distribution", "bonus-reports", "schemes", branchCode, from, to, companyId],
    enabled: Boolean(branchCode) && tab === "scheme",
    queryFn: () =>
      fetchDistributionReport("scheme-utilization", {
        branchCode: branchCode!,
        from,
        to,
        companyId: companyId || undefined,
      }),
  });

  const lines = useMemo(() => {
    const raw = (salesQ.data?.rows ?? []) as Record<string, unknown>[];
    let list = raw.map(normalizeLine);
    if (warehouseId) {
      list = list.filter((l) => l.warehouseId === warehouseId);
    }
    if (bonusOnly) {
      list = list.filter((l) => l.freeQty > 0);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.orderNumber.toLowerCase().includes(needle) ||
          l.customerName.toLowerCase().includes(needle) ||
          l.customerCode.toLowerCase().includes(needle) ||
          l.salesman.toLowerCase().includes(needle) ||
          l.company.toLowerCase().includes(needle) ||
          l.warehouse.toLowerCase().includes(needle) ||
          l.product.toLowerCase().includes(needle) ||
          l.sku.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [salesQ.data, warehouseId, bonusOnly, q]);

  const byCompany = useMemo(
    () =>
      aggregate(
        lines,
        (l) => l.companyId || l.company,
        (l) => l.company,
      ),
    [lines],
  );
  const bySalesman = useMemo(
    () =>
      aggregate(
        lines,
        (l) => l.salesmanEmployeeId || l.salesman,
        (l) => l.salesman,
      ),
    [lines],
  );
  const byCustomer = useMemo(
    () =>
      aggregate(
        lines,
        (l) => l.tradeCustomerId || l.customerCode || l.customerName,
        (l) => l.customerName,
        (l) => l.customerCode,
      ),
    [lines],
  );
  const byWarehouse = useMemo(
    () =>
      aggregate(
        lines,
        (l) => l.warehouseId || l.warehouse,
        (l) => l.warehouse,
      ),
    [lines],
  );
  const byProduct = useMemo(
    () =>
      aggregate(
        lines,
        (l) => l.sku || l.product,
        (l) => l.product,
        (l) => l.sku,
      ),
    [lines],
  );

  const kpis = useMemo(() => {
    const soldQty = lines.reduce((s, l) => s + l.qty, 0);
    const bonusQty = lines.reduce((s, l) => s + l.freeQty, 0);
    const bonusValuePkr = lines.reduce((s, l) => s + l.bonusValuePkr, 0);
    const salesPkr = lines.reduce((s, l) => s + l.salesPkr, 0);
    const orders = new Set(lines.map((l) => l.orderNumber)).size;
    return {
      lines: lines.length,
      orders,
      soldQty,
      bonusQty,
      bonusValuePkr,
      salesPkr,
      bonusPct: soldQty > 0 ? Math.round((bonusQty / soldQty) * 1000) / 10 : 0,
    };
  }, [lines]);

  const summaryRows = useMemo(
    () => [
      { metric: "Bonus lines", value: String(kpis.lines) },
      { metric: "Orders with bonus", value: String(kpis.orders) },
      { metric: "Sold qty", value: String(kpis.soldQty) },
      { metric: "Bonus qty (free)", value: String(kpis.bonusQty) },
      { metric: "Bonus % of sold", value: `${kpis.bonusPct}%` },
      { metric: "Bonus value (at rate)", value: formatPkr(kpis.bonusValuePkr) },
      { metric: "Sales value", value: formatPkr(kpis.salesPkr) },
      { metric: "Companies", value: String(byCompany.length) },
      { metric: "Salesmen", value: String(bySalesman.length) },
      { metric: "Customers", value: String(byCustomer.length) },
      { metric: "Warehouses", value: String(byWarehouse.length) },
      { metric: "Products", value: String(byProduct.length) },
    ],
    [kpis, byCompany.length, bySalesman.length, byCustomer.length, byWarehouse.length, byProduct.length],
  );

  const aggForTab: AggRow[] = useMemo(() => {
    if (tab === "company") return byCompany;
    if (tab === "salesman") return bySalesman;
    if (tab === "customer") return byCustomer;
    if (tab === "warehouse") return byWarehouse;
    if (tab === "product") return byProduct;
    return [];
  }, [tab, byCompany, bySalesman, byCustomer, byWarehouse, byProduct]);

  const schemeRows = useMemo(() => {
    const rows = (schemeQ.data?.rows ?? []) as Record<string, unknown>[];
    return rows.map((r, i) => ({
      key: `${str(r.scheme)}-${str(r.medicine)}-${i}`,
      scheme: str(r.scheme),
      medicine: str(r.medicine),
      buyQty: num(r.buyQty),
      freeQty: num(r.freeQty),
      soldQty: num(r.soldQty),
      freeGiven: num(r.freeGiven),
      status: str(r.status),
    }));
  }, [schemeQ.data]);

  function printCurrent(): void {
    void (async () => {
      try {
        if (tab === "summary") {
          await printDistReportDocument({
            title: "Bonus report — Summary",
            subtitle: `${from} → ${to}`,
            branchName,
            branchCode,
            columns: ["Metric", "Value"],
            rows: summaryRows.map((r) => ({ Metric: r.metric, Value: r.value })),
          });
          return;
        }
        if (tab === "scheme") {
          await printDistReportDocument({
            title: "Bonus report — Schemes",
            subtitle: `${from} → ${to}`,
            branchName,
            branchCode,
            columns: ["Scheme", "Medicine", "Buy", "Free", "Sold", "Free given", "Status"],
            rows: schemeRows.map((r) => ({
              Scheme: r.scheme,
              Medicine: r.medicine,
              Buy: r.buyQty,
              Free: r.freeQty,
              Sold: r.soldQty,
              "Free given": r.freeGiven,
              Status: r.status,
            })),
          });
          return;
        }
        if (tab === "detail") {
          await printDistReportDocument({
            title: "Bonus report — Line detail",
            subtitle: `${from} → ${to} · ${lines.length} lines`,
            branchName,
            branchCode,
            columns: [
              "Date",
              "Order",
              "Customer",
              "Salesman",
              "Warehouse",
              "Company",
              "Product",
              "Qty",
              "Bonus",
              "Bonus value",
            ],
            rows: lines.slice(0, 500).map((l) => ({
              Date: l.date,
              Order: l.orderNumber,
              Customer: l.customerName,
              Salesman: l.salesman,
              Warehouse: l.warehouse,
              Company: l.company,
              Product: l.product,
              Qty: l.qty,
              Bonus: l.freeQty,
              "Bonus value": l.bonusValuePkr,
            })),
          });
          return;
        }
        const title = TABS.find((t) => t.key === tab)?.label ?? "Bonus";
        await printDistReportDocument({
          title: `Bonus report — ${title}`,
          subtitle: `${from} → ${to}`,
          branchName,
          branchCode,
          columns: ["Name", "Lines", "Sold", "Bonus", "Bonus %", "Bonus value", "Sales"],
          rows: aggForTab.map((r) => ({
            Name: r.secondary ? `${r.label} (${r.secondary})` : r.label,
            Lines: r.lines,
            Sold: r.soldQty,
            Bonus: r.bonusQty,
            "Bonus %": `${r.bonusPct}%`,
            "Bonus value": r.bonusValuePkr,
            Sales: r.salesPkr,
          })),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Print failed");
      }
    })();
  }

  function exportCurrent(): void {
    if (tab === "summary") {
      exportRowsToCsv(
        "bonus-summary.csv",
        ["metric", "value"],
        summaryRows.map((r) => [r.metric, r.value]),
      );
      return;
    }
    if (tab === "scheme") {
      exportRowsToCsv(
        "bonus-schemes.csv",
        ["scheme", "medicine", "buyQty", "freeQty", "soldQty", "freeGiven", "status"],
        schemeRows.map((r) => [
          r.scheme,
          r.medicine,
          r.buyQty,
          r.freeQty,
          r.soldQty,
          r.freeGiven,
          r.status,
        ]),
      );
      return;
    }
    if (tab === "detail") {
      exportRowsToCsv(
        "bonus-detail.csv",
        [
          "date",
          "orderNumber",
          "customer",
          "salesman",
          "warehouse",
          "company",
          "sku",
          "product",
          "qty",
          "bonus",
          "bonusValue",
          "sales",
        ],
        lines.map((l) => [
          l.date,
          l.orderNumber,
          l.customerName,
          l.salesman,
          l.warehouse,
          l.company,
          l.sku,
          l.product,
          l.qty,
          l.freeQty,
          l.bonusValuePkr,
          l.salesPkr,
        ]),
      );
      return;
    }
    exportRowsToCsv(
      `bonus-by-${tab}.csv`,
      ["name", "code", "lines", "soldQty", "bonusQty", "bonusPct", "bonusValue", "sales"],
      aggForTab.map((r) => [
        r.label,
        r.secondary ?? "",
        r.lines,
        r.soldQty,
        r.bonusQty,
        r.bonusPct,
        r.bonusValuePkr,
        r.salesPkr,
      ]),
    );
  }

  const loading = salesQ.isLoading || (tab === "scheme" && schemeQ.isLoading);
  const loadError =
    salesQ.error instanceof Error
      ? salesQ.error.message
      : schemeQ.error instanceof Error
        ? schemeQ.error.message
        : null;

  return (
    <DistPageShell
      title="Bonus Reports"
      subtitle="Free / bonus qty & value — company, salesman, customer, warehouse, product, schemes"
      breadcrumb={[
        { label: "Report Center", to: "/pops/distribution/reports" },
        { label: "Bonus Reports" },
      ]}
      actions={
        <>
          <Link
            to="/pops/distribution/customer-reports?tab=bonus"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
          >
            Customer Bonus
          </Link>
          <Link
            to="/pops/distribution/bonus-attach"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
          >
            Bonus Attach
          </Link>
          <Link
            to="/pops/distribution/pricing"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
          >
            Schemes / Prices
          </Link>
          <DistButton variant="secondary" onClick={exportCurrent}>
            Export CSV
          </DistButton>
          <DistButton variant="secondary" onClick={printCurrent}>
            Print
          </DistButton>
          <DistButton
            variant="secondary"
            onClick={() => {
              void salesQ.refetch();
              if (tab === "scheme") void schemeQ.refetch();
            }}
          >
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
            void salesQ.refetch();
          }}
        />
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
          Company
          <div className="mt-1 min-w-[10rem]">
            <DistSelect value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">All</option>
              {(companiesQ.data ?? []).map((c: { id?: string; name?: string }) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </DistSelect>
          </div>
        </label>
        <label className="text-xs text-slate-500">
          Salesman
          <div className="mt-1 min-w-[10rem]">
            <DistSelect value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)}>
              <option value="">All</option>
              {(salesmenQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </DistSelect>
          </div>
        </label>
        <label className="text-xs text-slate-500">
          Warehouse
          <div className="mt-1 min-w-[10rem]">
            <DistSelect value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">All</option>
              {(warehousesQ.data ?? []).map((w: { id?: string; name?: string; code?: string }) => (
                <option key={w.id} value={w.id}>
                  {w.name ?? w.code}
                </option>
              ))}
            </DistSelect>
          </div>
        </label>
        <label className="text-xs text-slate-500">
          Search
          <div className="mt-1">
            <DistInput
              placeholder="Order, customer, product…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="accent-cyan-600"
            checked={bonusOnly}
            onChange={(e) => setBonusOnly(e.target.checked)}
          />
          Bonus lines only
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <DistKpiCard label="Bonus lines" value={kpis.lines} />
        <DistKpiCard label="Bonus qty" value={kpis.bonusQty} tone="warning" />
        <DistKpiCard label="Bonus %" value={`${kpis.bonusPct}%`} />
        <DistKpiCard label="Bonus value" value={formatPkr(kpis.bonusValuePkr)} tone="danger" />
        <DistKpiCard label="Sold qty" value={kpis.soldQty} />
        <DistKpiCard label="Sales value" value={formatPkr(kpis.salesPkr)} tone="success" />
      </div>

      {tab === "summary" ? (
        <DistDataTable
          loading={loading}
          empty="No bonus data in range"
          rows={summaryRows}
          rowKey={(r) => r.metric}
          columns={[
            { key: "metric", header: "Metric", render: (r) => r.metric },
            { key: "value", header: "Value", render: (r) => r.value },
          ]}
        />
      ) : null}

      {tab === "scheme" ? (
        <DistDataTable
          loading={loading}
          empty="No scheme utilization in range"
          rows={schemeRows}
          rowKey={(r) => r.key}
          columns={[
            { key: "scheme", header: "Scheme", render: (r) => r.scheme },
            { key: "medicine", header: "Medicine", render: (r) => r.medicine },
            { key: "buy", header: "Buy qty", render: (r) => r.buyQty },
            { key: "free", header: "Scheme free", render: (r) => r.freeQty },
            { key: "sold", header: "Sold qty", render: (r) => r.soldQty },
            {
              key: "given",
              header: "Free given",
              render: (r) => (
                <span className="font-semibold text-amber-700 dark:text-amber-300">{r.freeGiven}</span>
              ),
            },
            { key: "status", header: "Status", render: (r) => r.status },
          ]}
        />
      ) : null}

      {tab === "detail" ? (
        <DistDataTable
          loading={loading}
          empty="No bonus lines in range"
          rows={lines}
          rowKey={(r) =>
            `${r.date}|${r.orderNumber}|${r.sku}|${r.product}|${r.qty}|${r.freeQty}|${r.salesPkr}`
          }
          columns={[
            { key: "date", header: "Date", render: (r) => r.date },
            { key: "order", header: "Order", render: (r) => r.orderNumber },
            { key: "customer", header: "Customer", render: (r) => r.customerName },
            { key: "salesman", header: "Salesman", render: (r) => r.salesman },
            { key: "wh", header: "Warehouse", render: (r) => r.warehouse },
            { key: "co", header: "Company", render: (r) => r.company },
            { key: "product", header: "Product", render: (r) => r.product },
            { key: "qty", header: "Qty", render: (r) => r.qty },
            {
              key: "bonus",
              header: "Bonus",
              render: (r) => (
                <span className="font-semibold text-amber-700 dark:text-amber-300">{r.freeQty}</span>
              ),
            },
            {
              key: "bval",
              header: "Bonus value",
              render: (r) => formatPkr(r.bonusValuePkr),
            },
            { key: "sales", header: "Sales", render: (r) => formatPkr(r.salesPkr) },
          ]}
        />
      ) : null}

      {tab !== "summary" && tab !== "scheme" && tab !== "detail" ? (
        <DistDataTable
          loading={loading}
          empty={`No bonus data for ${TABS.find((t) => t.key === tab)?.label ?? tab}`}
          rows={aggForTab}
          rowKey={(r) => r.key}
          columns={[
            {
              key: "name",
              header: "Name",
              render: (r) => (
                <div>
                  <div className="font-medium">{r.label}</div>
                  {r.secondary ? (
                    <div className="text-[11px] text-slate-500">{r.secondary}</div>
                  ) : null}
                </div>
              ),
            },
            { key: "lines", header: "Lines", render: (r) => r.lines },
            { key: "sold", header: "Sold qty", render: (r) => r.soldQty },
            {
              key: "bonus",
              header: "Bonus qty",
              render: (r) => (
                <span className="font-semibold text-amber-700 dark:text-amber-300">{r.bonusQty}</span>
              ),
            },
            { key: "pct", header: "Bonus %", render: (r) => `${r.bonusPct}%` },
            {
              key: "bval",
              header: "Bonus value",
              render: (r) => formatPkr(r.bonusValuePkr),
            },
            { key: "sales", header: "Sales", render: (r) => formatPkr(r.salesPkr) },
          ]}
        />
      ) : null}
    </DistPageShell>
  );
}
