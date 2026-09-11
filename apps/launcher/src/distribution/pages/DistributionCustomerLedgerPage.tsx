import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { financeApi } from "../../pharmacy/api/pharmacy-finance";
import { fetchPharmacyTradeCustomers } from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistButton, DistDataTable, DistPageShell, DistPanel, distInputClass } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionCustomerLedgerPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [sp, setSp] = useSearchParams();
  const customerId = sp.get("customerId") ?? "";
  const [q, setQ] = useState("");

  const customers = useQuery({
    queryKey: ["distribution", "trade-customers", "picker", branch?.code],
    queryFn: () => fetchPharmacyTradeCustomers(branch?.code),
  });
  const list = useMemo(() => {
    const rows = (Array.isArray(customers.data) ? customers.data : []) as Array<{
      id: string;
      name?: string;
      code?: string;
      outstandingPkr?: number;
    }>;
    const needle = q.trim().toLowerCase();
    return needle
      ? rows.filter((r) => `${r.name ?? ""} ${r.code ?? ""}`.toLowerCase().includes(needle))
      : rows;
  }, [customers.data, q]);

  const ledger = useQuery({
    queryKey: ["distribution", "finance", "customer-ledger", customerId],
    enabled: Boolean(customerId),
    queryFn: () => financeApi.customerLedger(customerId),
  });
  const statement = (ledger.data?.statement ?? []) as Array<Record<string, unknown>>;

  return (
    <DistPageShell
      title="Customer ledger"
      subtitle="Opening, sales, collections, returns, and closing from the trade-customer engine."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Finance", to: `${DIST}/finance` },
        { label: "Customer ledger" },
      ]}
      actions={
        <Link to={`${DIST}/aging`}>
          <DistButton variant="secondary">AR aging</DistButton>
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <DistPanel title="Customers">
          <input className={distInputClass} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-2 max-h-[480px] space-y-1 overflow-auto text-sm">
            {list.slice(0, 80).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1.5 text-left ${c.id === customerId ? "bg-cyan-50 dark:bg-cyan-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                  onClick={() => setSp({ customerId: c.id })}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {c.code} · {formatPkr(c.outstandingPkr ?? 0)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </DistPanel>
        <DistPanel
          title="Statement"
          subtitle={
            ledger.data
              ? `Closing ${formatPkr(Number(ledger.data.closingBalance ?? ledger.data.outstandingPkr ?? 0))}`
              : "Select a customer"
          }
        >
          {!customerId ? (
            <p className="text-sm text-slate-500">Select a trade customer to load the ledger.</p>
          ) : ledger.isError ? (
            <p className="text-sm text-red-700">Could not load ledger.</p>
          ) : (
            <DistDataTable
              columns={[
                { key: "date", header: "Date" },
                { key: "type", header: "Type" },
                { key: "reference", header: "Reference" },
                { key: "debit", header: "Debit", render: (r) => formatPkr(Number(r.debit ?? 0)) },
                { key: "credit", header: "Credit", render: (r) => formatPkr(Number(r.credit ?? 0)) },
                { key: "runningBalance", header: "Balance", render: (r) => formatPkr(Number(r.runningBalance ?? 0)) },
              ]}
              rows={statement}
              rowKey={(r) => `${r.type}-${r.reference}-${r.date}`}
              loading={ledger.isLoading}
              empty="No journal lines for this customer yet."
            />
          )}
        </DistPanel>
      </div>
    </DistPageShell>
  );
}
