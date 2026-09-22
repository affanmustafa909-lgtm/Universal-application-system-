import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createPharmacyTradeCustomer } from "../../../../pharmacy/api/pharmacy-erp";
import { listTradeCustomersPaged } from "../../../../pharmacy/api/pharmacy-masters";
import { fetchAccounts } from "../../../api/accounting";
import { formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading } from "./AccountingUi";
import {
  emptyTradeCustomerForm,
  TradeCustomerFormFields,
  tradeCustomerFormPayload,
  type TradeCustomerForm,
  type TradeCustomerFormTab,
} from "../../../../distribution/components/TradeCustomerFormFields";
import { DistButton } from "../../../../distribution/ui/DistUi";

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];

type CoaTab = "head" | "subHead" | "subSubHead" | "detail" | "client";

const COA_TABS: Array<{ id: CoaTab; label: string }> = [
  { id: "head", label: "Head" },
  { id: "subHead", label: "Sub Head" },
  { id: "subSubHead", label: "Sub-Sub-Head" },
  { id: "detail", label: "Detail" },
  { id: "client", label: "Client" },
];

export function ChartOfAccountsPage(): JSX.Element {
  const { branch } = useAccountingAccess();
  const qc = useQueryClient();
  const [coaTab, setCoaTab] = useState<CoaTab>("client");
  const [form, setForm] = useState<TradeCustomerForm>(emptyTradeCustomerForm());
  const [formTab, setFormTab] = useState<TradeCustomerFormTab>("coaClient");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["accounting", "accounts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchAccounts(branch!.code),
  });

  const clientsQuery = useQuery({
    queryKey: ["pharmacy", "trade-customers-paged", "coa-client"],
    queryFn: () => listTradeCustomersPaged({ page: 1, pageSize: 50, status: "active" }),
  });

  const saveClient = useMutation({
    mutationFn: async () => {
      const body = tradeCustomerFormPayload(form, branch?.code);
      return createPharmacyTradeCustomer(body);
    },
    onSuccess: () => {
      setNotice(`Client saved: ${form.name || form.code}`);
      setError(null);
      setForm(emptyTradeCustomerForm());
      setFormTab("coaClient");
      void qc.invalidateQueries({ queryKey: ["pharmacy", "trade-customers-paged"] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setNotice(null);
    },
  });

  const accounts = accountsQuery.data ?? [];
  const grouped = useMemo(
    () =>
      TYPE_ORDER.map((type) => ({
    type,
    items: accounts.filter((a) => a.type === type),
      })).filter((g) => g.items.length > 0),
    [accounts],
  );

  if (accountsQuery.isLoading && coaTab !== "client") return <AccountingLoading />;
  if (accountsQuery.isError && coaTab !== "client") {
    return <AccountingError message={(accountsQuery.error as Error).message} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of accounts"
        subtitle="Head / Sub-Head / Detail ledger plus Client (party) registration — legacy CoA parity."
        actions={
          <Link
            to="/pops/distribution/trade-customers"
            className="text-xs font-semibold text-emerald-400 hover:underline"
          >
            Open trade customers →
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-2">
        {COA_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-t-md px-3 py-1.5 text-xs font-semibold ${
              coaTab === t.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
            onClick={() => setCoaTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      {coaTab === "client" ? (
        <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-white">Client registration</div>
              <p className="text-xs text-slate-400">
                Account Type, Code, Cmp_Code, Unique Name, Province, Stx/NTN/CNIC, Licence, tax flags.
              </p>
            </div>
            <DistButton
              variant="secondary"
              onClick={() => {
                setForm(emptyTradeCustomerForm());
                setFormTab("coaClient");
              }}
            >
              New client
            </DistButton>
          </div>
          <TradeCustomerFormFields
            form={form}
            setForm={setForm}
            tab={formTab}
            setTab={setFormTab}
            lookups={{ routes: [], employees: [], cities: [], areas: [] }}
            busy={saveClient.isPending}
            onSave={() => saveClient.mutate()}
            onClear={() => {
              setForm(emptyTradeCustomerForm());
              setFormTab("coaClient");
            }}
            onClose={() => setCoaTab("detail")}
          />
          <div className="overflow-x-auto">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Client list
            </div>
            <SimpleTable
              rowKey={(r) => String(r.id)}
              columns={[
                {
                  key: "accountType",
                  header: "Acct Type",
                  render: (r) => String((r as { accountType?: string }).accountType ?? "—"),
                },
                { key: "code", header: "Code" },
                {
                  key: "companyCode",
                  header: "Cmp_Code",
                  render: (r) => String((r as { companyCode?: string }).companyCode ?? "—"),
                },
                { key: "name", header: "Name" },
                {
                  key: "uniqueName",
                  header: "Unique Name",
                  render: (r) => String((r as { uniqueName?: string }).uniqueName ?? "—"),
                },
                {
                  key: "address",
                  header: "Address",
                  render: (r) => String((r as { address?: string }).address ?? "—"),
                },
                {
                  key: "postalAddress",
                  header: "Postal",
                  render: (r) => String((r as { postalAddress?: string }).postalAddress ?? "—"),
                },
                {
                  key: "province",
                  header: "Province",
                  render: (r) => String((r as { province?: string }).province ?? "—"),
                },
                {
                  key: "email",
                  header: "Email",
                  render: (r) => String((r as { email?: string }).email ?? "—"),
                },
                {
                  key: "landLine",
                  header: "Phone",
                  render: (r) => String((r as { landLine?: string }).landLine ?? "—"),
                },
                {
                  key: "phone",
                  header: "Mobile",
                  render: (r) => String((r as { phone?: string }).phone ?? "—"),
                },
                {
                  key: "fax",
                  header: "Fax",
                  render: (r) => String((r as { fax?: string }).fax ?? "—"),
                },
                {
                  key: "credit",
                  header: "Credit Limit",
                  render: (r) => formatPkr(Number((r as { creditLimitPkr?: number }).creditLimitPkr ?? 0)),
                },
                {
                  key: "partyMode",
                  header: "Party Mod",
                  render: (r) => String((r as { partyMode?: string }).partyMode ?? "—"),
                },
                {
                  key: "stxNo",
                  header: "Stx No",
                  render: (r) => String((r as { stxNo?: string }).stxNo ?? "—"),
                },
                {
                  key: "ntnNumber",
                  header: "NTN #",
                  render: (r) => String((r as { ntnNumber?: string }).ntnNumber ?? "—"),
                },
                {
                  key: "nicNumber",
                  header: "CNIC #",
                  render: (r) => String((r as { nicNumber?: string }).nicNumber ?? "—"),
                },
                {
                  key: "sector",
                  header: "Sector",
                  render: (r) => String((r as { sector?: string }).sector ?? "—"),
                },
                {
                  key: "licenceNo",
                  header: "Licence #",
                  render: (r) => String((r as { licenceNo?: string }).licenceNo ?? "—"),
                },
                {
                  key: "licenceExpiry",
                  header: "Licence Exp",
                  render: (r) => {
                    const v = (r as { licenceExpiry?: string }).licenceExpiry;
                    return v ? String(v).slice(0, 10) : "—";
                  },
                },
                {
                  key: "partyType",
                  header: "Party Type",
                  render: (r) =>
                    String(
                      (r as { partyType?: string; customerType?: string }).partyType ??
                        (r as { customerType?: string }).customerType ??
                        "—",
                    ),
                },
                {
                  key: "activeTaxPayer",
                  header: "Active Tax",
                  render: (r) => ((r as { activeTaxPayer?: boolean }).activeTaxPayer ? "Yes" : "—"),
                },
                {
                  key: "incomeTaxExempt",
                  header: "Tax Exempt",
                  render: (r) => ((r as { incomeTaxExempt?: boolean }).incomeTaxExempt ? "Yes" : "—"),
                },
                {
                  key: "advanceTaxSummary",
                  header: "Adv Tax",
                  render: (r) => ((r as { advanceTaxSummary?: boolean }).advanceTaxSummary ? "Yes" : "—"),
                },
                {
                  key: "invoiceWarranty",
                  header: "Inv Warranty",
                  render: (r) => ((r as { invoiceWarranty?: boolean }).invoiceWarranty ? "Yes" : "—"),
                },
                {
                  key: "dead",
                  header: "Dead",
                  render: (r) => ((r as { status?: string }).status !== "active" ? "Yes" : "—"),
                },
              ]}
              rows={(clientsQuery.data?.items ?? []) as unknown as Record<string, unknown>[]}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            {coaTab === "head"
              ? "Account heads (asset / liability / equity / income / expense)."
              : coaTab === "subHead"
                ? "Sub-heads grouped by account type / subtype."
                : coaTab === "subSubHead"
                  ? "Finer subtype buckets under each head."
                  : "Detail ledger accounts with running balances."}
          </p>
      {grouped.map((group) => (
        <div key={group.type} className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
          <div className="mb-3 text-sm font-medium capitalize text-emerald-300">{group.type}</div>
          <SimpleTable
            rowKey={(r) => String(r.code)}
            columns={[
              { key: "code", header: "Code" },
              { key: "name", header: "Account" },
              { key: "subtype", header: "Subtype", render: (r) => String(r.subtype ?? "—") },
              {
                key: "balance",
                header: "Balance",
                render: (r) => formatPkr(Number(r.balance)),
              },
            ]}
            rows={group.items as unknown as Record<string, unknown>[]}
          />
        </div>
      ))}
          {grouped.length === 0 ? (
            <p className="text-sm text-slate-500">No accounts seeded for this branch yet.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
