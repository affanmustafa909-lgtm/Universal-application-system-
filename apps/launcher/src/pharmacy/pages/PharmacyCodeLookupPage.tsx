import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../../lib/authFetch";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import { pharmacyInputClass, usePharmacyAccess } from "../hooks/usePharmacy";

type LookupHit = {
  module: string;
  code: string;
  id: string;
  name: string;
  path: string;
  meta?: string;
};

async function lookupPharmacyCode(q: string, branchCode?: string) {
  const params = new URLSearchParams({ q });
  if (branchCode) params.set("branchCode", branchCode);
  const res = await authFetch(`/v1/pharmacy/lookup?${params}`);
  if (!res.ok) throw new Error("Lookup failed");
  return (await res.json()) as { query: string; count: number; exact: LookupHit | null; results: LookupHit[] };
}

async function fetchCodeCatalog() {
  const res = await authFetch("/v1/pharmacy/code-catalog");
  if (!res.ok) throw new Error("Failed to load code catalog");
  return (await res.json()) as { prefixes: { module: string; prefix: string; label: string; path: string }[] };
}

/** Fallback catalog when API not deployed yet. */
const LOCAL_PREFIXES = [
  { module: "medicine", prefix: "MED / SKU", label: "Medicines", path: "/pops/pharmacy/medicines" },
  { module: "doctor", prefix: "DOC", label: "Doctors", path: "/pops/pharmacy/doctors" },
  { module: "patient", prefix: "PAT", label: "Patients", path: "/pops/pharmacy/customers" },
  { module: "tradeCustomer", prefix: "CUS", label: "Trade customers", path: "/pops/distribution/trade-customers" },
  { module: "company", prefix: "COM", label: "Companies", path: "/pops/pharmacy/companies" },
  { module: "warehouse", prefix: "WH", label: "Warehouses", path: "/pops/pharmacy/warehouses" },
  { module: "territory", prefix: "TER", label: "Territories", path: "/pops/distribution/geo" },
  { module: "city", prefix: "CTY", label: "Cities", path: "/pops/distribution/geo" },
  { module: "area", prefix: "ARA", label: "Areas", path: "/pops/distribution/geo" },
  { module: "route", prefix: "RTE", label: "Routes", path: "/pops/distribution/geo" },
  { module: "prescription", prefix: "RX", label: "Prescriptions", path: "/pops/pharmacy/prescriptions" },
  { module: "saleInvoice", prefix: "INV", label: "Retail invoices", path: "/pops/pharmacy/sales" },
  { module: "saleReturn", prefix: "SRN", label: "Sale returns", path: "/pops/pharmacy/sale-returns" },
  { module: "purchaseOrder", prefix: "PO", label: "Purchase orders", path: "/pops/pharmacy/purchase-orders" },
  { module: "grn", prefix: "GRN", label: "GRN", path: "/pops/pharmacy/purchase-orders" },
  { module: "purchaseReturn", prefix: "PRN", label: "Purchase returns", path: "/pops/pharmacy/purchase-orders" },
  { module: "distOrder", prefix: "DO", label: "Distribution orders", path: "/pops/distribution/orders" },
  { module: "delivery", prefix: "DLV", label: "Deliveries", path: "/pops/distribution/deliveries" },
  { module: "collection", prefix: "COL", label: "Collections", path: "/pops/distribution/collections" },
  { module: "priceList", prefix: "PL", label: "Price lists", path: "/pops/distribution/pricing" },
  { module: "scheme", prefix: "SCH", label: "Schemes", path: "/pops/distribution/pricing" },
];

export function PharmacyCodeLookupPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: ["pharmacy", "code-catalog"],
    queryFn: fetchCodeCatalog,
    retry: false,
  });
  const search = useMutation({
    mutationFn: () => lookupPharmacyCode(q, branch?.code),
    onError: (e: Error) => setError(e.message),
    onSuccess: () => setError(null),
  });

  const prefixes = catalog.data?.prefixes?.length ? catalog.data.prefixes : LOCAL_PREFIXES;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find by code"
        subtitle="Har module / submodule ka unique code — DOC, PAT, MED, CUS, INV, PO, GRN, DO…"
      />

      <form
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) search.mutate();
        }}
      >
        <input
          className={`${pharmacyInputClass} min-w-[220px] flex-1 font-mono uppercase`}
          placeholder="e.g. DOC-000001, PAT-12, MED-001, INV-…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white" disabled={!q.trim() || search.isPending}>
          Search
        </button>
      </form>
      {error ? <p className="text-sm text-amber-600">{error} — code catalog below still works offline.</p> : null}

      {search.data?.exact ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-xs uppercase text-emerald-700 dark:text-emerald-400">Exact match</p>
          <p className="mt-1 font-mono text-lg font-semibold">{search.data.exact.code}</p>
          <p className="text-sm">
            {search.data.exact.module} — {search.data.exact.name}
          </p>
          <Link to={search.data.exact.path} className="mt-2 inline-block text-sm text-emerald-700 underline dark:text-emerald-400">
            Open module
          </Link>
        </div>
      ) : null}

      {search.data?.results?.length ? (
        <SimpleTable
          rowKey={(r) => `${r.module}-${r.id}-${r.code}`}
          columns={[
            { key: "code", header: "Code", render: (r) => <span className="font-mono">{r.code}</span> },
            { key: "module", header: "Module" },
            { key: "name", header: "Name" },
            { key: "meta", header: "Meta", render: (r) => r.meta ?? "—" },
            {
              key: "path",
              header: "Open",
              render: (r) => (
                <Link to={r.path} className="text-emerald-600 underline">
                  View
                </Link>
              ),
            },
          ]}
          rows={search.data.results}
        />
      ) : null}

      <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Code prefixes (all modules)</h2>
        <SimpleTable
          rowKey={(r) => r.module + r.prefix}
          columns={[
            { key: "prefix", header: "Prefix", render: (r) => <span className="font-mono font-semibold">{r.prefix}</span> },
            { key: "label", header: "Module / submodule" },
            {
              key: "path",
              header: "Screen",
              render: (r) => (
                <Link to={r.path} className="text-sm text-emerald-700 underline dark:text-emerald-400">
                  Open
                </Link>
              ),
            },
          ]}
          rows={prefixes}
        />
      </section>
    </div>
  );
}
