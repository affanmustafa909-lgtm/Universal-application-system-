import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { financeApi } from "../../pharmacy/api/pharmacy-finance";
import { purchaseApi } from "../../pharmacy/api/pharmacy-purchase";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistButton, DistDataTable, DistPageShell, DistPanel, distInputClass } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionSupplierLedgerPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [sp, setSp] = useSearchParams();
  const supplierId = sp.get("supplierId") ?? "";
  const [q, setQ] = useState("");

  const suppliers = useQuery({
    queryKey: ["distribution", "suppliers", "picker", q, branch?.code],
    queryFn: () => purchaseApi.searchSuppliers({ q, branchCode: branch?.code ?? "", limit: 50 }),
    enabled: Boolean(branch?.code),
  });
  const list = useMemo(() => {
    const raw = suppliers.data as { items?: Array<{ id: string; name?: string }> } | Array<{ id: string; name?: string }>;
    return Array.isArray(raw) ? raw : raw?.items ?? [];
  }, [suppliers.data]);

  const ledger = useQuery({
    queryKey: ["distribution", "finance", "supplier-ledger", supplierId, branch?.code],
    enabled: Boolean(supplierId),
    queryFn: () => financeApi.supplierLedger(supplierId, branch?.code),
  });
  const lines = (ledger.data?.lines ?? []) as Array<Record<string, unknown>>;

  return (
    <DistPageShell
      title="Supplier ledger"
      subtitle="GRNs and purchase returns. AP GL is the accounting balance — this is the operational statement."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Finance", to: `${DIST}/finance` },
        { label: "Supplier ledger" },
      ]}
      actions={
        <Link to="/pops/accounting/payable">
          <DistButton variant="secondary">AP register</DistButton>
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <DistPanel title="Suppliers">
          <input className={distInputClass} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-2 max-h-[480px] space-y-1 overflow-auto text-sm">
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1.5 text-left ${s.id === supplierId ? "bg-cyan-50 dark:bg-cyan-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                  onClick={() => setSp({ supplierId: s.id })}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </DistPanel>
        <DistPanel
          title="Statement"
          subtitle={
            ledger.data
              ? `Closing ${formatPkr(Number(ledger.data.closingBalance ?? 0))}`
              : "Select a supplier"
          }
        >
          {!supplierId ? (
            <p className="text-sm text-slate-500">Select a supplier to load GRNs and purchase returns.</p>
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
              rows={lines}
              rowKey={(r) => `${r.type}-${r.reference}`}
              loading={ledger.isLoading}
              empty="No GRNs or purchase returns for this supplier."
            />
          )}
        </DistPanel>
      </div>
    </DistPageShell>
  );
}
