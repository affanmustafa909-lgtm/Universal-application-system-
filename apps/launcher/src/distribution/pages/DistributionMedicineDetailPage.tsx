import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getMedicineDetail,
  setMedicineStatus,
  updateMedicine,
} from "../../pharmacy/api/pharmacy-masters";
import {
  brandsApi,
  categoriesApi,
  dosageFormsApi,
  genericsApi,
  listCompaniesPaged,
  listWarehousesPaged,
  taxProfilesApi,
  unitsApi,
} from "../../pharmacy/api/pharmacy-masters";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import {
  DistButton,
  DistPageShell,
  DistPanel,
  DistStatusBadge,
} from "../ui/DistUi";
import {
  detailToForm,
  emptyForm,
  formPayload,
  MedicineFormFields,
  type MedicineForm,
} from "./DistributionMedicinesPage";

type Tab = "overview" | "commercial" | "inventory" | "pricing" | "audit";

export function DistributionMedicineDetailPage(): JSX.Element {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([["pharmacy", "masters-medicines"], ["pharmacy", "medicine-detail", id]]);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MedicineForm>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["pharmacy", "medicine-detail", id],
    enabled: Boolean(id),
    queryFn: () => getMedicineDetail(id),
  });

  const companies = useQuery({
    queryKey: ["pharmacy", "companies-picker"],
    queryFn: () => listCompaniesPaged({ page: 1, pageSize: 100, status: "active" }),
    staleTime: 60_000,
  });
  const generics = useQuery({
    queryKey: ["pharmacy", "generics-picker"],
    queryFn: () => genericsApi.list({ page: 1, pageSize: 100, status: "active" }),
    staleTime: 60_000,
  });
  const brandsQ = useQuery({
    queryKey: ["pharmacy", "brands-picker"],
    queryFn: () => brandsApi.list({ page: 1, pageSize: 100, status: "active" }),
    staleTime: 60_000,
  });
  const categories = useQuery({
    queryKey: ["pharmacy", "categories-picker"],
    queryFn: () => categoriesApi.list({ page: 1, pageSize: 100, status: "active" }),
    staleTime: 60_000,
  });
  const dosageForms = useQuery({
    queryKey: ["pharmacy", "dosage-picker"],
    queryFn: () => dosageFormsApi.list({ page: 1, pageSize: 100, status: "active" }),
    staleTime: 60_000,
  });
  const units = useQuery({
    queryKey: ["pharmacy", "units-picker"],
    queryFn: () => unitsApi.list({ page: 1, pageSize: 100, status: "active" }),
    staleTime: 60_000,
  });
  const taxProfiles = useQuery({
    queryKey: ["pharmacy", "tax-picker"],
    queryFn: () => taxProfilesApi.list({ page: 1, pageSize: 100, status: "active" }),
    staleTime: 60_000,
  });
  const warehouses = useQuery({
    queryKey: ["pharmacy", "warehouses-picker", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => listWarehousesPaged({ branchCode: branch!.code, page: 1, pageSize: 100, status: "active" }),
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: () => updateMedicine(id, formPayload(form, branch?.code ?? "", false)),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      setError(null);
      void detail.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: () =>
      setMedicineStatus(id, detail.data?.status === "active" ? "inactive" : "active"),
    onSuccess: () => {
      invalidate();
      void detail.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const d = detail.data;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "commercial", label: "Commercial" },
    { id: "inventory", label: "Inventory Config" },
    { id: "pricing", label: "Pricing note" },
    { id: "audit", label: "Audit" },
  ];

  return (
    <DistPageShell
      title={d?.name ?? "Medicine"}
      subtitle={d ? `${d.sku} · ${d.status}` : undefined}
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Medicines", to: "/pops/distribution/medicines" },
        { label: d?.sku ?? id },
      ]}
      loading={detail.isLoading}
      error={error ?? (detail.error instanceof Error ? detail.error.message : null)}
      actions={
        d ? (
          <>
            <DistStatusBadge status={d.status} />
            <DistButton
              variant="secondary"
              onClick={() => {
                setForm(detailToForm(d));
                setEditing(true);
              }}
            >
              Edit
            </DistButton>
            <DistButton variant="ghost" onClick={() => toggle.mutate()}>
              {d.status === "active" ? "Deactivate" : "Activate"}
            </DistButton>
            <DistButton variant="ghost" onClick={() => navigate("/pops/distribution/medicines")}>
              Back
            </DistButton>
          </>
        ) : null
      }
    >
      {d ? (
        <>
          <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab === t.id
                    ? "bg-cyan-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {editing ? (
            <DistPanel
              title="Edit medicine"
              action={
                <div className="flex gap-2">
                  <DistButton variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </DistButton>
                  <DistButton disabled={save.isPending} onClick={() => save.mutate()}>
                    Save
                  </DistButton>
                </div>
              }
            >
              <MedicineFormFields
                form={form}
                setForm={setForm}
                companies={companies.data?.items ?? []}
                generics={generics.data?.items ?? []}
                brands={brandsQ.data?.items ?? []}
                categories={categories.data?.items ?? []}
                dosageForms={dosageForms.data?.items ?? []}
                units={units.data?.items ?? []}
                taxProfiles={taxProfiles.data?.items ?? []}
                warehouses={warehouses.data?.items ?? []}
              />
            </DistPanel>
          ) : null}

          {tab === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <DistPanel title="Identity">
                <dl className="space-y-1 text-sm">
                  <Row k="SKU" v={d.sku} />
                  <Row k="Name" v={d.name} />
                  <Row k="Barcode" v={d.barcode} />
                  <Row k="Strength" v={d.dosageStrength} />
                  <Row k="Presentation" v={d.presentation} />
                </dl>
              </DistPanel>
              <DistPanel title="Linked masters">
                <dl className="space-y-1 text-sm">
                  <Row
                    k="Company"
                    v={
                      d.refs?.company ? (
                        <Link className="text-cyan-700 hover:underline" to="/pops/distribution/companies">
                          {d.companyName}
                        </Link>
                      ) : (
                        d.manufacturer ?? "—"
                      )
                    }
                  />
                  <Row k="Generic" v={d.genericNameMaster ?? d.genericName} />
                  <Row k="Brand" v={d.brandNameMaster ?? d.brandName} />
                  <Row k="Category" v={d.categoryNameMaster ?? d.category} />
                  <Row k="Dosage form" v={d.dosageFormName} />
                  <Row k="Unit" v={d.unitNameMaster ?? d.unit} />
                  <Row
                    k="Tax profile"
                    v={
                      d.taxProfileName
                        ? `${d.taxProfileName}${d.taxProfileRatePct != null ? ` (${d.taxProfileRatePct}%)` : ""}`
                        : "—"
                    }
                  />
                </dl>
              </DistPanel>
            </div>
          ) : null}

          {tab === "commercial" ? (
            <DistPanel title="Prices">
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <Row k="Purchase" v={formatPkr(d.purchasePricePkr ?? 0)} />
                <Row k="Cost" v={formatPkr(d.costPricePkr ?? 0)} />
                <Row k="Wholesale" v={formatPkr(d.wholesalePricePkr ?? 0)} />
                <Row k="Dealer" v={formatPkr(d.dealerPricePkr ?? 0)} />
                <Row k="Retail" v={formatPkr(d.sellingPricePkr ?? 0)} />
                <Row k="Tax %" v={d.taxPct ?? 0} />
              </dl>
            </DistPanel>
          ) : null}

          {tab === "inventory" ? (
            <DistPanel title="Inventory configuration">
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <Row k="Current stock" v={d.currentStock} />
                <Row k="Reorder level" v={d.reorderLevel} />
                <Row k="Min / Max" v={`${d.minStock ?? 0} / ${d.maxStock ?? 0}`} />
                <Row k="Pack" v={`${d.tabletsPerStrip ?? 1} tabs × ${d.stripsPerBox ?? 1} strips`} />
                <Row k="Batch tracking" v={d.batchTrackingEnabled ? "Yes" : "No"} />
                <Row k="Expiry tracking" v={d.expiryTrackingEnabled ? "Yes" : "No"} />
                <Row k="FEFO" v={d.fefoEnabled ? "Yes" : "No"} />
                <Row k="Controlled" v={d.isControlled ? "Yes" : "No"} />
                <Row k="Rx required" v={d.prescriptionRequired ? "Yes" : "No"} />
                <Row k="Restricted" v={d.restrictedSale ? "Yes" : "No"} />
              </dl>
            </DistPanel>
          ) : null}

          {tab === "pricing" ? (
            <DistPanel title="Pricing note">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                List/scheme overrides are managed in{" "}
                <Link className="text-cyan-700 hover:underline" to="/pops/distribution/pricing">
                  Pricing / schemes
                </Link>
                . Medicine base wholesale is {formatPkr(d.wholesalePricePkr ?? 0)}.
              </p>
            </DistPanel>
          ) : null}

          {tab === "audit" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <DistPanel title="Sales history">
                <p className="text-sm text-slate-500">History loads in Phase 4/5.</p>
              </DistPanel>
              <DistPanel title="Purchase history">
                <p className="text-sm text-slate-500">History loads in Phase 4/5.</p>
              </DistPanel>
            </div>
          ) : null}
        </>
      ) : null}
    </DistPageShell>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 dark:border-slate-800">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="text-right text-slate-800 dark:text-slate-200">{v ?? "—"}</dd>
    </div>
  );
}
