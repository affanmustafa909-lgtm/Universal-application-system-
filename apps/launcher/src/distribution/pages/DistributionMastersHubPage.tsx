import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchMasterDataQuality, fetchMastersOverview } from "../../pharmacy/api/pharmacy-masters";
import { usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistButton, DistKpiCard, DistPageShell, DistPanel } from "../ui/DistUi";

const QUICK_LINKS: { title: string; items: { label: string; to: string }[] }[] = [
  {
    title: "Product",
    items: [
      { label: "Medicines", to: "/pops/distribution/medicines" },
      { label: "Product masters", to: "/pops/distribution/product-masters" },
      { label: "Import", to: "/pops/distribution/import" },
    ],
  },
  {
    title: "Parties",
    items: [
      { label: "Trade customers", to: "/pops/distribution/trade-customers" },
      { label: "Suppliers", to: "/pops/distribution/suppliers" },
      { label: "Companies", to: "/pops/distribution/companies" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Warehouses", to: "/pops/distribution/warehouses" },
      { label: "Sales force", to: "/pops/distribution/sales-force" },
      { label: "Geography", to: "/pops/distribution/geo" },
    ],
  },
  {
    title: "Commercial",
    items: [{ label: "Pricing / schemes", to: "/pops/distribution/pricing" }],
  },
];

export function DistributionMastersHubPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const overview = useQuery({ queryKey: ["pharmacy", "masters-overview"], queryFn: fetchMastersOverview });
  const quality = useQuery({
    queryKey: ["pharmacy", "masters-quality", branch?.code],
    queryFn: () => fetchMasterDataQuality(branch?.code),
  });

  const o = overview.data;
  const q = quality.data;
  const alerts: { label: string; count: number; to: string }[] = q
    ? [
        {
          label: "Medicines without company",
          count: q.medicinesWithoutCompany,
          to: "/pops/distribution/medicines",
        },
        {
          label: "Medicines without price",
          count: q.medicinesWithoutPrice,
          to: "/pops/distribution/medicines",
        },
        {
          label: "Medicines without unit",
          count: q.medicinesWithoutUnit,
          to: "/pops/distribution/product-masters?tab=units",
        },
        {
          label: "Customers without route",
          count: q.customersWithoutRoute,
          to: "/pops/distribution/trade-customers",
        },
        {
          label: "Customers without salesman",
          count: q.customersWithoutSalesman,
          to: "/pops/distribution/trade-customers",
        },
        {
          label: "Linked to inactive company",
          count: q.inactiveCompanyLinkedMedicines,
          to: "/pops/distribution/medicines",
        },
      ].filter((a) => a.count > 0)
    : [];

  return (
    <DistPageShell
      title="Masters hub"
      subtitle="Reference counts, data-quality alerts, and shortcuts into product / party / ops / commercial masters."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters" },
      ]}
      actions={
        <Link to="/pops/distribution/import">
          <DistButton variant="secondary">Import CSV</DistButton>
        </Link>
      }
      loading={overview.isLoading}
      error={overview.error instanceof Error ? overview.error.message : null}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DistKpiCard label="Medicines" value={o?.medicines ?? 0} to="/pops/distribution/medicines" />
        <DistKpiCard label="Generics" value={o?.generics ?? 0} to="/pops/distribution/product-masters?tab=generics" />
        <DistKpiCard label="Brands" value={o?.brands ?? 0} to="/pops/distribution/product-masters?tab=brands" />
        <DistKpiCard label="Companies" value={o?.companies ?? 0} to="/pops/distribution/companies" />
        <DistKpiCard label="Customers" value={o?.tradeCustomers ?? 0} to="/pops/distribution/trade-customers" />
        <DistKpiCard label="Categories" value={o?.categories ?? 0} to="/pops/distribution/product-masters?tab=categories" />
        <DistKpiCard label="Dosage forms" value={o?.dosageForms ?? 0} to="/pops/distribution/product-masters?tab=dosage-forms" />
        <DistKpiCard label="Units" value={o?.units ?? 0} to="/pops/distribution/product-masters?tab=units" />
        <DistKpiCard label="Tax profiles" value={o?.taxProfiles ?? 0} to="/pops/distribution/product-masters?tab=tax-profiles" />
        <DistKpiCard label="Warehouses" value={o?.warehouses ?? 0} to="/pops/distribution/warehouses" />
      </div>

      <DistPanel title="Data quality" subtitle="Click an alert to open the related master list.">
        {quality.isLoading ? (
          <p className="text-sm text-slate-500">Checking…</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">No open data-quality issues.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {alerts.map((a) => (
              <li key={a.label}>
                <Link
                  to={a.to}
                  className="flex items-center justify-between gap-3 py-2 text-sm text-slate-800 hover:text-cyan-700 dark:text-slate-200 dark:hover:text-cyan-400"
                >
                  <span>{a.label}</span>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {a.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {q?.duplicateBarcodeCandidates?.length ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            Duplicate barcodes:{" "}
            {q.duplicateBarcodeCandidates
              .slice(0, 5)
              .map((d) => `${d.barcode} (${d.count})`)
              .join(", ")}
          </div>
        ) : null}
      </DistPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        {QUICK_LINKS.map((section) => (
          <DistPanel key={section.title} title={section.title}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {section.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="block rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-cyan-500 dark:border-slate-700 dark:text-slate-100"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </DistPanel>
        ))}
      </div>
    </DistPageShell>
  );
}
