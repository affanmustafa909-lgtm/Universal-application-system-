import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { fetchAccounts } from "../../pops/api/accounting";
import { financeApi } from "../../pharmacy/api/pharmacy-finance";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import { DistButton, DistDataTable, DistPageShell, DistPanel, distInputClass, distSelectClass } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionGeneralLedgerPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const accounts = useQuery({
    queryKey: ["accounting", "accounts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchAccounts(branch!.code),
  });

  const ledger = useQuery({
    queryKey: ["distribution", "finance", "gl", branch?.code, accountId, from, to, source, page],
    enabled: Boolean(branch?.code),
    queryFn: () =>
      financeApi.ledger(branch!.code, {
        accountId: accountId || undefined,
        from: from || undefined,
        to: to || undefined,
        source: source || undefined,
        page,
        pageSize,
      }),
  });

  const items = (ledger.data?.items ?? []) as Array<Record<string, unknown>>;
  const total = Number(ledger.data?.total ?? 0);

  return (
    <DistPageShell
      title="General ledger"
      subtitle="Server-side pagination. Balances come from posted journal lines."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Finance", to: `${DIST}/finance` },
        { label: "General ledger" },
      ]}
      actions={
        <Link to="/pops/accounting/journal">
          <DistButton>New journal</DistButton>
        </Link>
      }
    >
      <DistPanel title="Filters">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-500">
            Account
            <select
              className={`mt-1 ${distSelectClass}`}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All journals</option>
              {(accounts.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            From
            <input className={`mt-1 ${distInputClass}`} type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </label>
          <label className="text-xs text-slate-500">
            To
            <input className={`mt-1 ${distInputClass}`} type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </label>
          <label className="text-xs text-slate-500">
            Source
            <input className={`mt-1 ${distInputClass}`} value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} placeholder="dist_invoice" />
          </label>
        </div>
        {accountId ? (
          <p className="mt-2 text-sm text-slate-600">
            Opening {formatPkr(Number(ledger.data?.openingBalance ?? 0))}
          </p>
        ) : null}
      </DistPanel>

      <DistDataTable
        columns={
          accountId
            ? [
                { key: "date", header: "Date" },
                { key: "entryRef", header: "Journal" },
                { key: "source", header: "Source" },
                { key: "sourceRef", header: "Reference" },
                { key: "debit", header: "Debit", render: (r) => formatPkr(Number(r.debit ?? 0)) },
                { key: "credit", header: "Credit", render: (r) => formatPkr(Number(r.credit ?? 0)) },
                { key: "runningBalance", header: "Balance", render: (r) => formatPkr(Number(r.runningBalance ?? 0)) },
              ]
            : [
                { key: "entryDate", header: "Date" },
                { key: "entryRef", header: "Journal" },
                { key: "source", header: "Source" },
                { key: "sourceRef", header: "Reference" },
                { key: "description", header: "Description" },
                { key: "status", header: "Status" },
              ]
        }
        rows={items}
        rowKey={(r) => String(r.journalId ?? r.id ?? r.entryRef)}
        loading={ledger.isLoading}
        empty="No journal entries for this period."
      />
      <DistPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </DistPageShell>
  );
}
