/**
 * Today Sales — daily sales list with receive-amount entry.
 * Filter by salesman / company / warehouse; enter cash received today; Save.
 * Later mobile app will automate more of this flow.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collectionsApi } from "../../pharmacy/api/pharmacy-collections-ops";
import {
  fetchPharmacyCompanies,
  fetchPharmacyDistOrder,
  fetchPharmacyDistOrders,
  fetchPharmacyEmployeesPicker,
  fetchPharmacyTradeCustomers,
  fetchPharmacyWarehouses,
} from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { customerDisplayName, tradeCustomerNameMap } from "../lib/customerDisplay";
import { printDistDocument } from "../lib/printDistOrder";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
  DistKpiCard,
} from "../ui/DistUi";

type DistLine = {
  medicineName?: string;
  name?: string;
  quantity?: number;
  freeQuantity?: number;
  unitPricePkr?: number;
  companyName?: string;
  companyId?: string;
};

type TodaySaleRow = {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  salesmanId: string;
  salesmanName: string;
  warehouseId: string;
  warehouseName: string;
  companyNames: string;
  companyIds: string[];
  qty: number;
  bonus: number;
  avgPrice: number;
  totalPkr: number;
  invoiceId: string;
  amountPaidPkr: number;
  amountDuePkr: number;
  status: string;
  bookedAt: string;
  linesSummary: string;
};

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateKey(v: unknown): string {
  if (v == null || v === "") return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return "";
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const day = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clean(v: unknown): string {
  const s = String(v ?? "").trim();
  return s;
}

function mapOrderToRow(
  raw: Record<string, unknown>,
  custNames: Map<string, string>,
): TodaySaleRow {
  const lines = (Array.isArray(raw.lines) ? raw.lines : []) as DistLine[];
  let qty = 0;
  let bonus = 0;
  let lineValue = 0;
  const companySet = new Set<string>();
  const companyIds: string[] = [];
  const nameBits: string[] = [];

  for (const l of lines) {
    const q = Number(l.quantity ?? 0) || 0;
    const b = Number(l.freeQuantity ?? 0) || 0;
    const p = Number(l.unitPricePkr ?? 0) || 0;
    qty += q;
    bonus += b;
    lineValue += q * p;
    const cn = clean(l.companyName);
    if (cn) companySet.add(cn);
    const cid = clean(l.companyId);
    if (cid && !companyIds.includes(cid)) companyIds.push(cid);
    const med = clean(l.medicineName) || clean(l.name);
    if (med && nameBits.length < 3) nameBits.push(`${med}×${q}${b ? `+${b}` : ""}`);
  }

  const totalPkr = Number(raw.totalPkr ?? lineValue) || 0;
  const amountPaidPkr = Number(raw.amountPaidPkr ?? 0) || 0;
  const amountDuePkr =
    Number(raw.amountDuePkr ?? Math.max(0, totalPkr - amountPaidPkr)) || 0;
  const customerId = clean(raw.tradeCustomerId);
  const customerName =
    customerDisplayName(raw, custNames) ||
    clean(raw.customerName) ||
    clean(raw.tradeCustomerName) ||
    "Customer";

  return {
    id: clean(raw.id) || clean(raw.orderNumber) || `tmp-${clean(raw.orderNumber)}-${dateKey(raw.createdAt)}`,
    orderNumber: clean(raw.orderNumber) || "—",
    customerId,
    customerName,
    salesmanId: clean(raw.salesmanEmployeeId) || clean(raw.salesmanId),
    salesmanName: clean(raw.salesmanName) || "—",
    warehouseId: clean(raw.warehouseId),
    warehouseName: clean(raw.warehouseName) || clean(raw.warehouseCode) || "—",
    companyNames: [...companySet].join(", ") || "—",
    companyIds,
    qty,
    bonus,
    avgPrice: qty > 0 ? Math.round(lineValue / qty) : 0,
    totalPkr,
    invoiceId: clean(raw.invoiceId),
    amountPaidPkr,
    amountDuePkr,
    status: clean(raw.status) || "—",
    bookedAt: clean(raw.bookedAt) || clean(raw.createdAt),
    linesSummary: nameBits.join(", ") || `${lines.length || 0} line(s)`,
  };
}

const DRAFT_KEY = "dist-today-receive-draft-v1";

function loadDrafts(branchCode: string, day: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, Record<string, string>>;
    return map[`${branchCode}::${day}`] ?? {};
  } catch {
    return {};
  }
}

function saveDrafts(branchCode: string, day: string, drafts: Record<string, string>): void {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    map[`${branchCode}::${day}`] = drafts;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function DistributionTodaySalesPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const branchName = branch?.name ?? branchCode ?? "";
  const qc = useQueryClient();
  const day = todayIsoLocal();

  const [q, setQ] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    branchCode ? loadDrafts(branchCode, day) : {},
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchCode) return;
    setDrafts(loadDrafts(branchCode, day));
  }, [branchCode, day]);

  const customersQ = useQuery({
    queryKey: ["pharmacy", "trade-customers", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchPharmacyTradeCustomers(branchCode),
  });
  const custNames = useMemo(
    () =>
      tradeCustomerNameMap(
        (customersQ.data ?? []) as { id?: string; name?: string | null; code?: string | null }[],
      ),
    [customersQ.data],
  );

  const warehousesQ = useQuery({
    queryKey: ["pharmacy", "warehouses", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchPharmacyWarehouses(branchCode!),
    staleTime: 120_000,
  });
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

  const salesQ = useQuery({
    queryKey: ["distribution", "today-sales", branchCode, day],
    enabled: Boolean(branchCode),
    queryFn: async () => {
      const list = (await fetchPharmacyDistOrders(branchCode!)) as Record<string, unknown>[];
      const todays = list.filter((o) => {
        const dk = dateKey(o.bookedAt ?? o.createdAt ?? o.orderDate);
        return dk === day;
      });
      return Promise.all(
        todays.slice(0, 150).map(async (o) => {
          const id = clean(o.id);
          if (!id) return o;
          try {
            const detail = (await fetchPharmacyDistOrder(id)) as Record<string, unknown>;
            return { ...o, ...detail, lines: detail.lines ?? o.lines };
          } catch {
            return o;
          }
        }),
      );
    },
  });

  const collectionsQ = useQuery({
    queryKey: ["distribution", "today-sales", "collections", branchCode, day],
    enabled: Boolean(branchCode),
    queryFn: () =>
      collectionsApi.list({
        branchCode: branchCode!,
        from: day,
        to: day,
        page: 1,
        pageSize: 200,
      }),
  });

  /** Sum of today's collections tagged to an order (via notes). */
  const receivedByOrder = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of collectionsQ.data?.items ?? []) {
      const notes = String(c.notes ?? "");
      const amt = Number(c.amountPkr ?? 0) || 0;
      const m = notes.match(/TodaySales\s+(\S+)/i);
      if (m?.[1]) {
        map.set(m[1], (map.get(m[1]) ?? 0) + amt);
      }
    }
    return map;
  }, [collectionsQ.data]);

  const allRows = useMemo(
    () => (salesQ.data ?? []).map((o) => mapOrderToRow(o, custNames)),
    [salesQ.data, custNames],
  );

  const rows = useMemo(() => {
    let list = allRows;
    if (salesmanId) list = list.filter((r) => r.salesmanId === salesmanId);
    if (warehouseId) list = list.filter((r) => r.warehouseId === warehouseId);
    if (companyId) list = list.filter((r) => r.companyIds.includes(companyId));
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.orderNumber.toLowerCase().includes(needle) ||
          r.customerName.toLowerCase().includes(needle) ||
          r.salesmanName.toLowerCase().includes(needle) ||
          r.companyNames.toLowerCase().includes(needle) ||
          r.warehouseName.toLowerCase().includes(needle) ||
          r.linesSummary.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [allRows, salesmanId, warehouseId, companyId, q]);

  const kpis = useMemo(() => {
    const bill = rows.reduce((s, r) => s + r.totalPkr, 0);
    const due = rows.reduce((s, r) => s + r.amountDuePkr, 0);
    const received = rows.reduce((s, r) => s + Math.max(0, r.totalPkr - r.amountDuePkr), 0);
    return { count: rows.length, bill, due, received };
  }, [rows]);

  function setDraft(orderId: string, value: string): void {
    setDrafts((prev) => {
      const next = { ...prev, [orderId]: value };
      if (branchCode) saveDrafts(branchCode, day, next);
      return next;
    });
  }

  const saveMut = useMutation({
    mutationFn: async (row: TodaySaleRow) => {
      if (!branchCode) throw new Error("Select a branch");
      if (!row.customerId) throw new Error("Customer missing on this sale");
      const typed = Number(drafts[row.id] ?? "");
      if (!(typed > 0)) throw new Error("Enter receive amount (Rs)");
      const alreadyToday = receivedByOrder.get(row.orderNumber) ?? 0;
      const dueLeft = Math.max(0, row.amountDuePkr);
      if (dueLeft <= 0 && alreadyToday > 0) {
        throw new Error("This sale is already fully received");
      }
      const amountPkr = Math.min(typed, dueLeft > 0 ? dueLeft : typed);
      const body = {
        branchCode,
        tradeCustomerId: row.customerId,
        amountPkr,
        paymentMethod: "Cash",
        invoiceId: row.invoiceId || undefined,
        allocations:
          row.invoiceId && amountPkr > 0
            ? [{ invoiceId: row.invoiceId, amountPkr }]
            : undefined,
        advance: !row.invoiceId ? true : undefined,
        notes: `TodaySales ${row.orderNumber} · received ${day}`,
        reference: row.orderNumber,
      };
      return collectionsApi.create(body);
    },
    onMutate: (row) => setSavingId(row.id),
    onSuccess: (_data, row) => {
      setError(null);
      setNotice(`Saved receive for ${row.orderNumber}`);
      setDraft(row.id, "");
      void qc.invalidateQueries({ queryKey: ["distribution", "today-sales"] });
      void collectionsQ.refetch();
      void salesQ.refetch();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Save failed"),
    onSettled: () => setSavingId(null),
  });

  async function printRow(row: TodaySaleRow): Promise<void> {
    const receivedToday = receivedByOrder.get(row.orderNumber) ?? 0;
    const typed = Number(drafts[row.id] ?? 0) || 0;
    try {
      await printDistDocument({
        title: "Today sales slip",
        documentNumber: row.orderNumber,
        branchName,
        branchCode: branchCode ?? "",
        partyLabel: "Trade customer",
        partyName: row.customerName,
        meta: [
          { label: "Salesman", value: row.salesmanName },
          { label: "Warehouse", value: row.warehouseName },
          { label: "Company", value: row.companyNames },
          { label: "Qty / Bonus", value: `${row.qty} / ${row.bonus}` },
          { label: "Bill", value: formatPkr(row.totalPkr) },
          { label: "Due", value: formatPkr(row.amountDuePkr) },
          {
            label: "Received today",
            value: formatPkr(receivedToday + (typed > 0 ? typed : 0)),
          },
        ],
        lines: [
          {
            label: row.linesSummary || "Medicines",
            qty: row.qty || 1,
            unitPrice: row.avgPrice || row.totalPkr,
            freeQty: row.bonus || undefined,
          },
        ],
        totalPkr: row.totalPkr,
        footerNote: "Today sales — receive entry slip",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Print failed");
    }
  }

  return (
    <DistPageShell
      title="Today Sales"
      subtitle={`Aaj ki sales · ${day} · receive amount enter karke Save karo (baqi kal).`}
      breadcrumb={[
        { label: "PS Window", to: "/pops/distribution/ps" },
        { label: "Today Sales" },
      ]}
      actions={
        <>
          <Link
            to="/pops/distribution/orders"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Sale Window
          </Link>
          <DistButton
            variant="secondary"
            onClick={() => {
              void salesQ.refetch();
              void collectionsQ.refetch();
            }}
          >
            Refresh
          </DistButton>
        </>
      }
    >
      {error ? (
        <DistErrorBanner message={error} onRetry={() => setError(null)} />
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DistKpiCard label="Today sales" value={String(kpis.count)} />
        <DistKpiCard label="Bill total" value={formatPkr(kpis.bill)} />
        <DistKpiCard label="Still due" value={formatPkr(kpis.due)} tone="warning" />
        <DistKpiCard label="Received (paid)" value={formatPkr(kpis.received)} tone="success" />
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="text-xs text-slate-500">
          Search
          <div className="mt-1">
            <DistInput
              placeholder="Order, customer, medicine…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </label>
        <label className="text-xs text-slate-500">
          Salesman
          <div className="mt-1 min-w-[10rem]">
            <DistSelect value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)}>
              <option value="">All</option>
              {(salesmenQ.data ?? []).map((s: { id?: string; name?: string }) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.id}
                </option>
              ))}
            </DistSelect>
          </div>
        </label>
        <label className="text-xs text-slate-500">
          Company
          <div className="mt-1 min-w-[10rem]">
            <DistSelect value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">All</option>
              {(companiesQ.data ?? []).map((c: { id?: string; name?: string }) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.id}
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
                  {w.name ?? w.code ?? w.id}
                </option>
              ))}
            </DistSelect>
          </div>
        </label>
        <DistButton
          variant="secondary"
          onClick={() => {
            setQ("");
            setSalesmanId("");
            setCompanyId("");
            setWarehouseId("");
          }}
        >
          Clear filters
        </DistButton>
      </div>

      <p className="text-[11px] text-slate-500">
        Sirf <strong>aaj</strong> ki sales. Customer aj paisa de → Receive column mein amount likho →{" "}
        <strong>Save</strong>. Baqi due kal ke liye reh jata hai. Mobile app baad mein automate karegi.
      </p>

      <DistDataTable
        loading={salesQ.isLoading}
        empty={salesQ.isLoading ? "Loading today sales…" : "Aaj koi sale nahi"}
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: "order", header: "Order#", render: (r) => r.orderNumber },
          { key: "customer", header: "Customer", render: (r) => r.customerName },
          { key: "salesman", header: "Salesman", render: (r) => r.salesmanName },
          { key: "company", header: "Company", render: (r) => r.companyNames },
          { key: "wh", header: "Warehouse", render: (r) => r.warehouseName },
          {
            key: "meds",
            header: "Medicines",
            render: (r) => (
              <span className="max-w-[12rem] truncate text-[11px]" title={r.linesSummary}>
                {r.linesSummary}
              </span>
            ),
          },
          {
            key: "qty",
            header: "Qty",
            render: (r) => <span className="tabular-nums">{r.qty}</span>,
          },
          {
            key: "bonus",
            header: "Bonus",
            render: (r) => <span className="tabular-nums">{r.bonus || "—"}</span>,
          },
          {
            key: "price",
            header: "Avg rate",
            render: (r) => formatPkr(r.avgPrice),
          },
          {
            key: "bill",
            header: "Bill",
            render: (r) => formatPkr(r.totalPkr),
          },
          {
            key: "due",
            header: "Due",
            render: (r) => (
              <span className="tabular-nums font-medium text-amber-700 dark:text-amber-300">
                {formatPkr(r.amountDuePkr)}
              </span>
            ),
          },
          {
            key: "got",
            header: "Received today",
            render: (r) => (
              <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatPkr(receivedByOrder.get(r.orderNumber) ?? 0)}
              </span>
            ),
          },
          {
            key: "receive",
            header: "Receive (enter)",
            render: (r) => (
              <input
                type="number"
                min={0}
                step={1}
                placeholder="Rs"
                disabled={r.amountDuePkr <= 0}
                value={drafts[r.id] ?? ""}
                onChange={(e) => setDraft(r.id, e.target.value)}
                className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs tabular-nums dark:border-slate-600 dark:bg-slate-900"
              />
            ),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={savingId === r.id || r.amountDuePkr <= 0 || !(Number(drafts[r.id]) > 0)}
                  className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                  onClick={() => saveMut.mutate(r)}
                >
                  {savingId === r.id ? "…" : "Save"}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-slate-600"
                  onClick={() => void printRow(r)}
                >
                  Print
                </button>
              </div>
            ),
          },
        ]}
      />
    </DistPageShell>
  );
}
