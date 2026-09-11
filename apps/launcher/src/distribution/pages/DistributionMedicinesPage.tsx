import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPharmacyMedicine } from "../../pharmacy/api/pharmacy";
import {
  brandsApi,
  categoriesApi,
  dosageFormsApi,
  genericsApi,
  getMedicineDetail,
  listCompaniesPaged,
  listMedicinesPaged,
  listWarehousesPaged,
  setMedicineStatus,
  taxProfilesApi,
  unitsApi,
  updateMedicine,
  type MedicineMasterDetail,
  type MedicineMasterRow,
} from "../../pharmacy/api/pharmacy-masters";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import {
  DistBulkBar,
  DistButton,
  DistDataTable,
  DistInput,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
  exportRowsToCsv,
} from "../ui/DistUi";

type MedicineForm = {
  sku: string;
  name: string;
  genericName: string;
  brandName: string;
  category: string;
  manufacturer: string;
  companyId: string;
  genericId: string;
  brandId: string;
  categoryId: string;
  dosageFormId: string;
  unitId: string;
  taxProfileId: string;
  barcode: string;
  purchasePrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  dealerPrice: string;
  costPrice: string;
  taxPct: string;
  reorderLevel: string;
  minStock: string;
  maxStock: string;
  tabletsPerStrip: string;
  stripsPerBox: string;
  dosageStrength: string;
  presentation: string;
  unit: string;
  preferredWarehouseId: string;
  aisleLocation: string;
  rackLocation: string;
  shelfLocation: string;
  isControlled: boolean;
  prescriptionRequired: boolean;
  batchTrackingEnabled: boolean;
  expiryTrackingEnabled: boolean;
  fefoEnabled: boolean;
  restrictedSale: boolean;
};

const emptyForm = (): MedicineForm => ({
  sku: "",
  name: "",
  genericName: "",
  brandName: "",
  category: "Tablet",
  manufacturer: "",
  companyId: "",
  genericId: "",
  brandId: "",
  categoryId: "",
  dosageFormId: "",
  unitId: "",
  taxProfileId: "",
  barcode: "",
  purchasePrice: "0",
  sellingPrice: "0",
  wholesalePrice: "0",
  dealerPrice: "0",
  costPrice: "0",
  taxPct: "0",
  reorderLevel: "10",
  minStock: "0",
  maxStock: "0",
  tabletsPerStrip: "1",
  stripsPerBox: "1",
  dosageStrength: "",
  presentation: "",
  unit: "Piece",
  preferredWarehouseId: "",
  aisleLocation: "",
  rackLocation: "",
  shelfLocation: "",
  isControlled: false,
  prescriptionRequired: false,
  batchTrackingEnabled: true,
  expiryTrackingEnabled: true,
  fefoEnabled: true,
  restrictedSale: false,
});

function detailToForm(d: MedicineMasterDetail): MedicineForm {
  return {
    sku: d.sku ?? "",
    name: d.name ?? "",
    genericName: d.genericName ?? "",
    brandName: d.brandName ?? "",
    category: d.category ?? "Tablet",
    manufacturer: d.manufacturer ?? "",
    companyId: d.companyId ?? "",
    genericId: d.genericId ?? "",
    brandId: d.brandId ?? "",
    categoryId: d.categoryId ?? "",
    dosageFormId: d.dosageFormId ?? "",
    unitId: d.unitId ?? "",
    taxProfileId: d.taxProfileId ?? "",
    barcode: d.barcode ?? "",
    purchasePrice: String(d.purchasePricePkr ?? 0),
    sellingPrice: String(d.sellingPricePkr ?? 0),
    wholesalePrice: String(d.wholesalePricePkr ?? 0),
    dealerPrice: String(d.dealerPricePkr ?? 0),
    costPrice: String(d.costPricePkr ?? 0),
    taxPct: String(d.taxPct ?? 0),
    reorderLevel: String(d.reorderLevel ?? 10),
    minStock: String(d.minStock ?? 0),
    maxStock: String(d.maxStock ?? 0),
    tabletsPerStrip: String(d.tabletsPerStrip ?? 1),
    stripsPerBox: String(d.stripsPerBox ?? 1),
    dosageStrength: d.dosageStrength ?? "",
    presentation: d.presentation ?? "",
    unit: d.unit ?? "Piece",
    preferredWarehouseId: d.preferredWarehouseId ?? "",
    aisleLocation: d.aisleLocation ?? "",
    rackLocation: d.rackLocation ?? "",
    shelfLocation: d.shelfLocation ?? "",
    isControlled: Boolean(d.isControlled),
    prescriptionRequired: Boolean(d.prescriptionRequired),
    batchTrackingEnabled: d.batchTrackingEnabled !== false,
    expiryTrackingEnabled: d.expiryTrackingEnabled !== false,
    fefoEnabled: d.fefoEnabled !== false,
    restrictedSale: Boolean(d.restrictedSale),
  };
}

function formPayload(form: MedicineForm, branchCode: string, forCreate: boolean) {
  const base: Record<string, unknown> = {
    sku: form.sku.trim(),
    name: form.name.trim(),
    genericName: form.genericName.trim() || undefined,
    brandName: form.brandName.trim() || undefined,
    category: form.category || "Tablet",
    manufacturer: form.manufacturer.trim() || undefined,
    companyId: form.companyId || undefined,
    genericId: form.genericId || undefined,
    brandId: form.brandId || undefined,
    categoryId: form.categoryId || undefined,
    dosageFormId: form.dosageFormId || undefined,
    unitId: form.unitId || undefined,
    taxProfileId: form.taxProfileId || undefined,
    barcode: form.barcode.trim() || undefined,
    purchasePrice: Number(form.purchasePrice) || 0,
    sellingPrice: Number(form.sellingPrice) || 0,
    wholesalePrice: Number(form.wholesalePrice) || 0,
    dealerPrice: Number(form.dealerPrice) || 0,
    costPrice: Number(form.costPrice) || 0,
    taxPct: Number(form.taxPct) || 0,
    reorderLevel: Number(form.reorderLevel) || 10,
    minStock: Number(form.minStock) || 0,
    maxStock: Number(form.maxStock) || 0,
    tabletsPerStrip: Number(form.tabletsPerStrip) || 1,
    stripsPerBox: Number(form.stripsPerBox) || 1,
    dosageStrength: form.dosageStrength.trim() || undefined,
    presentation: form.presentation.trim() || undefined,
    unit: form.unit.trim() || "Piece",
    preferredWarehouseId: form.preferredWarehouseId || undefined,
    aisleLocation: form.aisleLocation.trim() || undefined,
    rackLocation: form.rackLocation.trim() || undefined,
    shelfLocation: form.shelfLocation.trim() || undefined,
    isControlled: form.isControlled,
    prescriptionRequired: form.prescriptionRequired,
    batchTrackingEnabled: form.batchTrackingEnabled,
    expiryTrackingEnabled: form.expiryTrackingEnabled,
    fefoEnabled: form.fefoEnabled,
    restrictedSale: form.restrictedSale,
  };
  if (forCreate) {
    return { ...base, branchCode, currentStock: 0 };
  }
  return {
    ...base,
    purchasePricePkr: base.purchasePrice,
    sellingPricePkr: base.sellingPrice,
    wholesalePricePkr: base.wholesalePrice,
    dealerPricePkr: base.dealerPrice,
    costPricePkr: base.costPrice,
  };
}

function MasterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; code: string; name: string }[];
}) {
  return (
    <label className="text-xs text-slate-500">
      {label}
      <DistSelect className="mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.code} — {o.name}
          </option>
        ))}
      </DistSelect>
    </label>
  );
}

function MedicineFormFields({
  form,
  setForm,
  companies,
  generics,
  brands,
  categories,
  dosageForms,
  units,
  taxProfiles,
  warehouses,
}: {
  form: MedicineForm;
  setForm: (f: MedicineForm) => void;
  companies: { id: string; code: string; name: string }[];
  generics: { id: string; code: string; name: string }[];
  brands: { id: string; code: string; name: string }[];
  categories: { id: string; code: string; name: string }[];
  dosageForms: { id: string; code: string; name: string }[];
  units: { id: string; code: string; name: string }[];
  taxProfiles: { id: string; code: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
}) {
  const set = (patch: Partial<MedicineForm>) => setForm({ ...form, ...patch });
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identity</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-500">
            SKU / Code
            <DistInput className="mt-1" value={form.sku} onChange={(e) => set({ sku: e.target.value })} required />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            Name
            <DistInput className="mt-1" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </label>
          <label className="text-xs text-slate-500">
            Barcode
            <DistInput className="mt-1" value={form.barcode} onChange={(e) => set({ barcode: e.target.value })} />
          </label>
          <label className="text-xs text-slate-500">
            Strength
            <DistInput
              className="mt-1"
              value={form.dosageStrength}
              onChange={(e) => set({ dosageStrength: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Presentation
            <DistInput
              className="mt-1"
              value={form.presentation}
              onChange={(e) => set({ presentation: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pharmaceutical</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <MasterSelect label="Generic" value={form.genericId} onChange={(v) => set({ genericId: v })} options={generics} />
          <MasterSelect label="Brand" value={form.brandId} onChange={(v) => set({ brandId: v })} options={brands} />
          <MasterSelect label="Company" value={form.companyId} onChange={(v) => set({ companyId: v })} options={companies} />
          <MasterSelect
            label="Category"
            value={form.categoryId}
            onChange={(v) => set({ categoryId: v })}
            options={categories}
          />
          <MasterSelect
            label="Dosage form"
            value={form.dosageFormId}
            onChange={(v) => set({ dosageFormId: v })}
            options={dosageForms}
          />
          <MasterSelect label="Unit" value={form.unitId} onChange={(v) => set({ unitId: v })} options={units} />
          <MasterSelect
            label="Tax profile"
            value={form.taxProfileId}
            onChange={(v) => set({ taxProfileId: v })}
            options={taxProfiles}
          />
          <label className="text-xs text-slate-500">
            Free-text generic
            <DistInput
              className="mt-1"
              value={form.genericName}
              onChange={(e) => set({ genericName: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Free-text brand
            <DistInput className="mt-1" value={form.brandName} onChange={(e) => set({ brandName: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Commercial</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["purchasePrice", "Purchase"],
              ["costPrice", "Cost"],
              ["wholesalePrice", "Wholesale"],
              ["dealerPrice", "Dealer"],
              ["sellingPrice", "Retail"],
              ["taxPct", "Tax %"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-xs text-slate-500">
              {label}
              <DistInput
                className="mt-1"
                type="number"
                value={form[key]}
                onChange={(e) => set({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inventory config</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-500">
            Reorder level
            <DistInput
              className="mt-1"
              type="number"
              value={form.reorderLevel}
              onChange={(e) => set({ reorderLevel: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Min stock
            <DistInput
              className="mt-1"
              type="number"
              value={form.minStock}
              onChange={(e) => set({ minStock: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Max stock
            <DistInput
              className="mt-1"
              type="number"
              value={form.maxStock}
              onChange={(e) => set({ maxStock: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Tabs / strip
            <DistInput
              className="mt-1"
              type="number"
              value={form.tabletsPerStrip}
              onChange={(e) => set({ tabletsPerStrip: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Strips / box
            <DistInput
              className="mt-1"
              type="number"
              value={form.stripsPerBox}
              onChange={(e) => set({ stripsPerBox: e.target.value })}
            />
          </label>
          <MasterSelect
            label="Preferred warehouse"
            value={form.preferredWarehouseId}
            onChange={(v) => set({ preferredWarehouseId: v })}
            options={warehouses}
          />
          {(
            [
              ["batchTrackingEnabled", "Batch tracking"],
              ["expiryTrackingEnabled", "Expiry tracking"],
              ["fefoEnabled", "FEFO"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={form[key]} onChange={(e) => set({ [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Restrictions</h3>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["isControlled", "Controlled"],
              ["prescriptionRequired", "Rx required"],
              ["restrictedSale", "Restricted sale"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={form[key]} onChange={(e) => set({ [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

export function DistributionMedicinesPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const navigate = useNavigate();
  const invalidate = useInvalidatePharmacy([
    ["pharmacy", "masters-medicines"],
    ["pharmacy", "masters-overview"],
  ]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [companyId, setCompanyId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MedicineForm>(emptyForm);
  const [afterSave, setAfterSave] = useState<"stay" | "new" | "view">("stay");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const list = useQuery({
    queryKey: ["pharmacy", "masters-medicines", branch?.code, page, pageSize, q, status, companyId],
    enabled: Boolean(branch?.code),
    queryFn: () =>
      listMedicinesPaged({
        branchCode: branch!.code,
        page,
        pageSize,
        q: q || undefined,
        status: status || undefined,
        companyId: companyId || undefined,
      }),
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
  const brands = useQuery({
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

  const drawer = useQuery({
    queryKey: ["pharmacy", "medicine-detail", drawerId],
    enabled: Boolean(drawerId),
    queryFn: () => getMedicineDetail(drawerId!),
  });

  const companyMap = useMemo(() => {
    const m = new Map((companies.data?.items ?? []).map((c) => [c.id, c.name]));
    return m;
  }, [companies.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!branch?.code) throw new Error("Select a branch");
      if (editingId) {
        return updateMedicine(editingId, formPayload(form, branch.code, false));
      }
      return createPharmacyMedicine(formPayload(form, branch.code, true));
    },
    onSuccess: (row) => {
      invalidate();
      setError(null);
      const id = (row as { id?: string }).id;
      if (afterSave === "new") {
        setEditingId(null);
        setForm(emptyForm());
        setFormOpen(true);
      } else if (afterSave === "view" && id) {
        setFormOpen(false);
        navigate(`/pops/distribution/medicines/${id}`);
      } else {
        setFormOpen(false);
        setEditingId(null);
        setForm(emptyForm());
      }
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deactivate = useMutation({
    mutationFn: (row: MedicineMasterRow) =>
      setMedicineStatus(row.id, row.status === "active" ? "inactive" : "active"),
    onSuccess: () => {
      invalidate();
      void list.refetch();
      if (drawerId) void drawer.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const d = await getMedicineDetail(id);
      setEditingId(id);
      setForm(detailToForm(d));
      setFormOpen(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load medicine");
    }
  };

  const refOpts = {
    companies: companies.data?.items ?? [],
    generics: generics.data?.items ?? [],
    brands: brands.data?.items ?? [],
    categories: categories.data?.items ?? [],
    dosageForms: dosageForms.data?.items ?? [],
    units: units.data?.items ?? [],
    taxProfiles: taxProfiles.data?.items ?? [],
    warehouses: warehouses.data?.items ?? [],
  };

  return (
    <DistPageShell
      title="Medicines"
      subtitle="Server-paged product master with company / status filters."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Medicines" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/pops/distribution/import">
            <DistButton variant="secondary">Import / template</DistButton>
          </Link>
          <DistButton onClick={openCreate}>+ Add Medicine</DistButton>
        </div>
      }
      error={error ?? (!branch ? "Select a branch to load medicines." : null)}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 min-w-[14rem]"
            placeholder="SKU, name, barcode…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="text-xs text-slate-500">
          Company
          <DistSelect
            className="mt-1 min-w-[10rem]"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {(companies.data?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </DistSelect>
        </label>
      </div>

      <DistBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
        <DistButton
          variant="secondary"
          onClick={() => {
            const selected = (list.data?.items ?? []).filter((r) => selectedIds.has(r.id));
            exportRowsToCsv(
              "medicines-selected.csv",
              ["sku", "name", "generic", "status", "wholesale"],
              selected.map((r) => [r.sku, r.name, r.genericName ?? "", r.status, r.wholesalePricePkr ?? 0]),
            );
          }}
        >
          Export selected
        </DistButton>
        <DistButton
          variant="secondary"
          onClick={() => {
            const selected = (list.data?.items ?? []).filter((r) => selectedIds.has(r.id));
            if (selected.length === 0) return;
            if (!window.confirm(`Deactivate ${selected.length} product(s)? This is a status change, not a hard delete.`)) return;
            for (const row of selected) {
              if (row.status === "active") deactivate.mutate(row);
            }
          }}
        >
          Deactivate selected
        </DistButton>
      </DistBulkBar>

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        empty="No medicines"
        onRowClick={(r) => setDrawerId(r.id)}
        rows={list.data?.items ?? []}
        selectedIds={selectedIds}
        onToggleRow={(id) =>
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onTogglePage={(ids, selected) =>
          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const id of ids) {
              if (selected) next.add(id);
              else next.delete(id);
            }
            return next;
          })
        }
        onExport={
          (list.data?.items ?? []).length
            ? () =>
                exportRowsToCsv(
                  "medicines-page.csv",
                  ["sku", "name", "generic", "status", "wholesale"],
                  (list.data?.items ?? []).map((r) => [
                    r.sku,
                    r.name,
                    r.genericName ?? "",
                    r.status,
                    r.wholesalePricePkr ?? 0,
                  ]),
                )
            : undefined
        }
        columns={[
          { key: "sku", header: "Code", className: "font-mono text-xs", render: (r) => r.sku },
          { key: "name", header: "Name" },
          {
            key: "company",
            header: "Company",
            render: (r) => (r.companyId ? companyMap.get(r.companyId) ?? "—" : r.manufacturer ?? "—"),
          },
          { key: "genericName", header: "Generic", render: (r) => r.genericName ?? "—" },
          {
            key: "pack",
            header: "Pack",
            render: (r) => `${r.tabletsPerStrip ?? 1}×${r.stripsPerBox ?? 1}`,
          },
          {
            key: "wholesale",
            header: "Wholesale",
            render: (r) => formatPkr(r.wholesalePricePkr ?? 0),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} />,
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                <DistButton variant="ghost" className="px-2 py-1 text-xs" onClick={() => void openEdit(r.id)}>
                  Edit
                </DistButton>
                <Link to={`/pops/distribution/medicines/${r.id}`}>
                  <DistButton variant="ghost" className="px-2 py-1 text-xs">
                    View Full
                  </DistButton>
                </Link>
                <DistButton
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => deactivate.mutate(r)}
                >
                  {r.status === "active" ? "Deactivate" : "Activate"}
                </DistButton>
              </div>
            ),
          },
        ]}
      />
      <DistPagination
        page={list.data?.page ?? page}
        pageSize={list.data?.pageSize ?? pageSize}
        total={list.data?.total ?? 0}
        totalPages={list.data?.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      <DistMasterDrawer
        open={Boolean(drawerId)}
        title={drawer.data?.name ?? "Medicine"}
        subtitle={drawer.data?.sku}
        onClose={() => setDrawerId(null)}
        footer={
          <>
            <DistButton variant="secondary" onClick={() => drawerId && void openEdit(drawerId)}>
              Edit
            </DistButton>
            {drawerId ? (
              <Link to={`/pops/distribution/medicines/${drawerId}`}>
                <DistButton>View Full</DistButton>
              </Link>
            ) : null}
          </>
        }
      >
        {drawer.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : drawer.data ? (
          <dl>
            <DistDrawerField label="Company" value={drawer.data.companyName ?? drawer.data.manufacturer} />
            <DistDrawerField label="Generic" value={drawer.data.genericNameMaster ?? drawer.data.genericName} />
            <DistDrawerField label="Brand" value={drawer.data.brandNameMaster ?? drawer.data.brandName} />
            <DistDrawerField label="Category" value={drawer.data.categoryNameMaster ?? drawer.data.category} />
            <DistDrawerField label="Dosage" value={drawer.data.dosageFormName} />
            <DistDrawerField label="Unit" value={drawer.data.unitNameMaster ?? drawer.data.unit} />
            <DistDrawerField label="Wholesale" value={formatPkr(drawer.data.wholesalePricePkr ?? 0)} />
            <DistDrawerField label="Retail" value={formatPkr(drawer.data.sellingPricePkr ?? 0)} />
            <DistDrawerField label="Stock" value={drawer.data.currentStock} />
            <DistDrawerField label="Status" value={<DistStatusBadge status={drawer.data.status} />} />
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Not found</p>
        )}
      </DistMasterDrawer>

      <DistMasterDrawer
        open={formOpen}
        title={editingId ? "Edit medicine" : "Add medicine"}
        onClose={() => setFormOpen(false)}
        widthClass="max-w-3xl"
        footer={
          <>
            <DistButton variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </DistButton>
            <DistButton
              variant="secondary"
              disabled={save.isPending}
              onClick={() => {
                setAfterSave("new");
                save.mutate();
              }}
            >
              Save & New
            </DistButton>
            <DistButton
              variant="secondary"
              disabled={save.isPending}
              onClick={() => {
                setAfterSave("view");
                save.mutate();
              }}
            >
              Save & View
            </DistButton>
            <DistButton
              disabled={save.isPending}
              onClick={() => {
                setAfterSave("stay");
                save.mutate();
              }}
            >
              Save
            </DistButton>
          </>
        }
      >
        <MedicineFormFields form={form} setForm={setForm} {...refOpts} />
      </DistMasterDrawer>
    </DistPageShell>
  );
}

/** Exported for detail page reuse of form helpers if needed later. */
export { MedicineFormFields, detailToForm, emptyForm, formPayload };
export type { MedicineForm };
