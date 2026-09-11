import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { fetchPharmacyDistInvoices, fetchPharmacyTradeCustomers } from "../../pharmacy/api/pharmacy-erp";
import { downloadTextFile, ioApi } from "../../pharmacy/api/pharmacy-io";
import {
  DistBulkBar,
  DistButton,
  DistDataTable,
  DistFilterBar,
  DistFilterValues,
  DistStatusBadge,
  exportRowsToCsv,
} from "../ui/DistUi";
import { printDistDocument, printDistReportDocument } from "../lib/printDistOrder";

export function DistributionInvoicesPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [filters, setFilters] = useState<DistFilterValues>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const invoices = useQuery({
    queryKey: ["pharmacy", "dist-invoices", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDistInvoices(branch!.code),
  });
  const customers = useQuery({
    queryKey: ["pharmacy", "trade-customers", branch?.code],
    queryFn: () => fetchPharmacyTradeCustomers(branch?.code),
  });

  const custName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers.data ?? []) m.set(c.id, c.name);
    return m;
  }, [customers.data]);

  const rows = useMemo(() => {
    let list = invoices.data ?? [];
    if (filters.from) list = list.filter((r) => String(r.invoiceDate ?? "").slice(0, 10) >= filters.from!);
    if (filters.to) list = list.filter((r) => String(r.invoiceDate ?? "").slice(0, 10) <= filters.to!);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.invoiceNumber ?? "").toLowerCase().includes(q) ||
          (custName.get(r.tradeCustomerId) ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [invoices.data, filters, custName]);

  const selectedRows = rows.filter((r) => selectedIds.has(r.id));

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = (ids: string[], selected: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const csvCols = ["invoiceNumber", "customer", "date", "total", "due", "status"] as const;
  const toCsvRow = (r: (typeof rows)[number]) => [
    r.invoiceNumber,
    custName.get(r.tradeCustomerId) ?? "",
    r.invoiceDate,
    r.totalPkr,
    r.amountDuePkr,
    r.status,
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Wholesale invoices</h1>
          <p className="text-sm text-slate-500">Search, filter, select, export, print. No bulk delete — invoices stay in history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DistButton
            variant="secondary"
            onClick={async () => {
              if (!branch?.code) return;
              try {
                const exp = await ioApi.exportCsv({ branchCode: branch.code, module: "invoices" });
                downloadTextFile(exp.filename, exp.csv);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Export failed");
              }
            }}
          >
            Export filtered (server)
          </DistButton>
          <Link to="/pops/distribution/orders" className="text-sm text-cyan-700 dark:text-cyan-400">
            ← Sales window
          </Link>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <DistFilterBar value={filters} onChange={setFilters} />
      <DistBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <DistButton
          variant="secondary"
          onClick={() =>
            exportRowsToCsv(
              "invoices-selected.csv",
              [...csvCols],
              selectedRows.map(toCsvRow),
            )
          }
        >
          Export selected
        </DistButton>
        <DistButton
          variant="secondary"
          onClick={() => {
            void printDistReportDocument({
              title: "Wholesale invoices",
              subtitle: `${selectedRows.length} selected`,
              columns: ["invoiceNumber", "customer", "invoiceDate", "totalPkr", "amountDuePkr", "status"],
              rows: selectedRows.map((r) => ({
                invoiceNumber: r.invoiceNumber,
                customer: custName.get(r.tradeCustomerId) ?? "",
                invoiceDate: r.invoiceDate,
                totalPkr: r.totalPkr,
                amountDuePkr: r.amountDuePkr,
                status: r.status,
              })),
            }).catch((e: Error) => setError(e.message));
          }}
        >
          Print selected
        </DistButton>
      </DistBulkBar>
      <DistDataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={invoices.isLoading ? "Loading…" : "No invoices"}
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onTogglePage={togglePage}
        onExport={
          rows.length
            ? () => exportRowsToCsv("invoices.csv", [...csvCols], rows.map(toCsvRow))
            : undefined
        }
        columns={[
          { key: "invoiceNumber", header: "Invoice#" },
          {
            key: "customer",
            header: "Customer",
            render: (r) => custName.get(r.tradeCustomerId) ?? "—",
          },
          { key: "invoiceDate", header: "Date" },
          {
            key: "totalPkr",
            header: "Total",
            render: (r) => formatPkr(Number(r.totalPkr ?? 0)),
          },
          {
            key: "amountDuePkr",
            header: "Due",
            render: (r) => formatPkr(Number(r.amountDuePkr ?? 0)),
          },
          { key: "status", header: "Status", render: (r) => <DistStatusBadge status={r.status} /> },
          {
            key: "print",
            header: "",
            render: (r) => (
              <button
                type="button"
                className="text-xs text-cyan-700 dark:text-cyan-400"
                onClick={() => {
                  void printDistDocument({
                    title: "Wholesale invoice",
                    documentNumber: r.invoiceNumber,
                    partyLabel: "Customer",
                    partyName: custName.get(r.tradeCustomerId) ?? "Customer",
                    meta: [
                      { label: "Date", value: String(r.invoiceDate ?? "") },
                      { label: "Status", value: String(r.status ?? "") },
                    ],
                    lines: [{ label: r.invoiceNumber, qty: 1, unitPrice: Number(r.totalPkr ?? 0) }],
                    totalPkr: Number(r.totalPkr ?? 0),
                  }).catch((e: Error) => setError(e.message));
                }}
              >
                Print
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
