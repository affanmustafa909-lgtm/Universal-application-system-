import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPharmacyMedicine } from "../../pharmacy/api/pharmacy";
import { createPharmacyCompany } from "../../pharmacy/api/pharmacy-erp";
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
  type CompanyRow,
  type MedicineMasterDetail,
  type MedicineMasterRow,
} from "../../pharmacy/api/pharmacy-masters";
import { inventoryApi } from "../../pharmacy/api/pharmacy-inventory";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistBulkMedicineCreate } from "../components/DistBulkCreate";
import { DistPagination } from "../components/DistPagination";
import { formatPackLabel, medicinePackPrices } from "../lib/medicinePackPricing";
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

type MasterOption = { id: string; code: string; name: string; parentId?: string | null };

type CompanyTargetDraft = {
  code: string;
  companyTitle: string;
  name: string;
  address: string;
  address2: string;
  bankName: string;
  bankBranch: string;
  transport: string;
  salesmanCommissionPct: string;
  showForAdvTax: string;
};

const emptyCompanyTarget = (): CompanyTargetDraft => ({
  code: "",
  companyTitle: "",
  name: "",
  address: "",
  address2: "",
  bankName: "",
  bankBranch: "",
  transport: "",
  salesmanCommissionPct: "0",
  showForAdvTax: "Yes",
});

const BUILTIN_MASTERS: Record<
  "generics" | "brands" | "categories" | "dosage-forms" | "units" | "tax-profiles",
  { code: string; name: string }[]
> = {
  generics: [
    { code: "GENERIC", name: "General" },
    { code: "PARA", name: "Paracetamol" },
    { code: "AMOX", name: "Amoxicillin" },
  ],
  brands: [
    { code: "OWN", name: "Own brand" },
    { code: "GENERIC-B", name: "Generic brand" },
  ],
  categories: [
    { code: "TAB", name: "Tablet" },
    { code: "CAP", name: "Capsule" },
    { code: "SYR", name: "Syrup" },
    { code: "INJ", name: "Injection" },
    { code: "CRM", name: "Cream" },
    { code: "DRP", name: "Drops" },
  ],
  "dosage-forms": [
    { code: "TAB", name: "Tablet" },
    { code: "CAP", name: "Capsule" },
    { code: "SYR", name: "Syrup" },
    { code: "INJ", name: "Injection" },
    { code: "SUS", name: "Suspension" },
  ],
  units: [
    { code: "STRIP", name: "Strip" },
    { code: "BOX", name: "Box" },
    { code: "BOTTLE", name: "Bottle" },
    { code: "PCS", name: "Piece" },
    { code: "PACK", name: "Pack" },
  ],
  "tax-profiles": [
    { code: "TAX0", name: "No tax" },
    { code: "TAX17", name: "Sales tax 17%" },
  ],
};

function slugCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16);
  return base || `M-${Date.now().toString(36).toUpperCase()}`;
}

function MasterSelect({
  label,
  value,
  onChange,
  options,
  mastersTab,
  onCreate,
  required,
  builtins,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: MasterOption[];
  /** Product masters tab deep-link when list is empty. */
  mastersTab?: string;
  onCreate?: (input: { code: string; name: string }) => Promise<MasterOption>;
  required?: boolean;
  /** Always-shown fallbacks when API list is empty (e.g. Tablet, Strip). */
  builtins?: { code: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const merged = useMemo(() => {
    if (options.length > 0) return options;
    return (builtins ?? []).map((b) => ({
      id: `builtin:${b.code}`,
      code: b.code,
      name: b.name,
    }));
  }, [options, builtins]);

  const submitCreate = async () => {
    if (!onCreate || !newName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const name = newName.trim();
      const created = await onCreate({ code: slugCode(name), name });
      onChange(created.id);
      setNewName("");
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (raw: string) => {
    if (!raw.startsWith("builtin:")) {
      onChange(raw);
      return;
    }
    const code = raw.slice("builtin:".length);
    const hit = (builtins ?? []).find((b) => b.code === code) ?? {
      code,
      name: code,
    };
    if (!onCreate) {
      onChange(raw);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const created = await onCreate({ code: hit.code, name: hit.name });
      onChange(created.id);
    } catch (e) {
      // Still allow free-text selection via synthetic id so Save works
      onChange(raw);
      setErr(e instanceof Error ? e.message : "Saved as free text — master create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="text-xs text-slate-500">
      {label}
      {required ? " *" : ""}
      <DistSelect
        className="mt-1"
        value={value}
        disabled={busy}
        onChange={(e) => void pick(e.target.value)}
      >
        <option value="">—</option>
        {merged.map((o) => (
          <option key={o.id} value={o.id}>
            {o.code} — {o.name}
            {o.id.startsWith("builtin:") ? " (add)" : ""}
          </option>
        ))}
      </DistSelect>
      {options.length === 0 && (builtins?.length ?? 0) > 0 ? (
        <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-300">
          List khali thi — common options dikha rahe hain. Select karo to save ho jayegi.
        </span>
      ) : null}
      {options.length === 0 && !(builtins?.length ?? 0) ? (
        <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-300">
          List empty.{" "}
          {mastersTab ? (
            <Link
              className="font-semibold underline"
              to={`/pops/distribution/product-masters?tab=${mastersTab}`}
              target="_blank"
              rel="noreferrer"
            >
              Product masters
            </Link>
          ) : null}{" "}
          ya + Quick add.
        </span>
      ) : null}
      {onCreate ? (
        adding ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <DistInput
              className="min-w-0 flex-1"
              placeholder="Name…"
              value={newName}
              disabled={busy}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitCreate();
                }
              }}
            />
            <DistButton
              type="button"
              className="px-2 py-1 text-[11px]"
              disabled={busy || !newName.trim()}
              onClick={() => void submitCreate()}
            >
              Add
            </DistButton>
            <button
              type="button"
              className="text-[11px] text-slate-500"
              onClick={() => {
                setAdding(false);
                setErr(null);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-1 text-[11px] font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
            onClick={() => setAdding(true)}
          >
            + Quick add
          </button>
        )
      ) : null}
      {err ? <span className="mt-1 block text-[11px] text-red-600">{err}</span> : null}
    </label>
  );
}

export type MedicineForm = {
  sku: string;
  name: string;
  genericName: string;
  brandName: string;
  category: string;
  manufacturer: string;
  companyId: string;
  genericId: string;
  brandId: string;
  /** Parent category (Group). */
  groupId: string;
  categoryId: string;
  dosageFormId: string;
  unitId: string;
  taxProfileId: string;
  barcode: string;
  alternateBarcode: string;
  companyProductCode: string;
  purchasePrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  dealerPrice: string;
  costPrice: string;
  minSalePrice: string;
  maxRetailPrice: string;
  taxPct: string;
  extraTaxPct: string;
  salesTaxType: string;
  extSalesTaxType: string;
  fbrProductType: string;
  advTaxEnabled: boolean;
  saleOnTradePrice: boolean;
  schemeDisc1Pct: string;
  schemeDisc2Pct: string;
  schemeQty: string;
  schemeBonusQty: string;
  discOnRetailPct: string;
  reorderLevel: string;
  suggestedReorderQty: string;
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
  sortOrder: string;
  holdQty: string;
  locked: boolean;
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
  groupId: "",
  categoryId: "",
  dosageFormId: "",
  unitId: "",
  taxProfileId: "",
  barcode: "",
  alternateBarcode: "",
  companyProductCode: "",
  purchasePrice: "0",
  sellingPrice: "0",
  wholesalePrice: "0",
  dealerPrice: "0",
  costPrice: "0",
  minSalePrice: "0",
  maxRetailPrice: "0",
  taxPct: "0",
  extraTaxPct: "0",
  salesTaxType: "None",
  extSalesTaxType: "",
  fbrProductType: "",
  advTaxEnabled: false,
  saleOnTradePrice: false,
  schemeDisc1Pct: "0",
  schemeDisc2Pct: "0",
  schemeQty: "0",
  schemeBonusQty: "0",
  discOnRetailPct: "0",
  reorderLevel: "10",
  suggestedReorderQty: "0",
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
  sortOrder: "0",
  holdQty: "0",
  locked: false,
  isControlled: false,
  prescriptionRequired: false,
  batchTrackingEnabled: true,
  expiryTrackingEnabled: true,
  fefoEnabled: true,
  restrictedSale: false,
});

function detailToForm(d: MedicineMasterDetail): MedicineForm {
  const parentId = d.refs?.category?.parentId ?? null;
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
    groupId: parentId ? parentId : d.categoryId ?? "",
    categoryId: parentId ? d.categoryId ?? "" : "",
    dosageFormId: d.dosageFormId ?? "",
    unitId: d.unitId ?? "",
    taxProfileId: d.taxProfileId ?? "",
    barcode: d.barcode ?? "",
    alternateBarcode: d.alternateBarcode ?? "",
    companyProductCode: d.companyProductCode ?? "",
    purchasePrice: String(d.purchasePricePkr ?? 0),
    sellingPrice: String(d.sellingPricePkr ?? 0),
    wholesalePrice: String(d.wholesalePricePkr ?? 0),
    dealerPrice: String(d.dealerPricePkr ?? 0),
    costPrice: String(d.costPricePkr ?? 0),
    minSalePrice: String(d.minSalePricePkr ?? 0),
    maxRetailPrice: String(d.maxRetailPricePkr ?? 0),
    taxPct: String(d.taxPct ?? 0),
    extraTaxPct: String(d.extraTaxPct ?? 0),
    salesTaxType: d.salesTaxType ?? "None",
    extSalesTaxType: d.extSalesTaxType ?? "",
    fbrProductType: d.fbrProductType ?? "",
    advTaxEnabled: Boolean(d.advTaxEnabled),
    saleOnTradePrice: Boolean(d.saleOnTradePrice),
    schemeDisc1Pct: String(d.schemeDisc1Pct ?? 0),
    schemeDisc2Pct: String(d.schemeDisc2Pct ?? 0),
    schemeQty: String(d.schemeQty ?? 0),
    schemeBonusQty: String(d.schemeBonusQty ?? 0),
    discOnRetailPct: String(d.discOnRetailPct ?? 0),
    reorderLevel: String(d.reorderLevel ?? 10),
    suggestedReorderQty: String(d.suggestedReorderQty ?? 0),
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
    sortOrder: String(d.sortOrder ?? 0),
    holdQty: String(d.holdQty ?? 0),
    locked: Boolean(d.locked),
    isControlled: Boolean(d.isControlled),
    prescriptionRequired: Boolean(d.prescriptionRequired),
    batchTrackingEnabled: d.batchTrackingEnabled !== false,
    expiryTrackingEnabled: d.expiryTrackingEnabled !== false,
    fefoEnabled: d.fefoEnabled !== false,
    restrictedSale: Boolean(d.restrictedSale),
  };
}

function formPayload(form: MedicineForm, branchCode: string, forCreate: boolean) {
  const id = (v: string) => (v && !v.startsWith("builtin:") ? v : undefined);
  const resolvedCategoryId = id(form.categoryId) || id(form.groupId);
  const base: Record<string, unknown> = {
    sku: form.sku.trim(),
    name: form.name.trim(),
    genericName: form.genericName.trim() || undefined,
    brandName: form.brandName.trim() || undefined,
    category: form.category || "Tablet",
    manufacturer: form.manufacturer.trim() || undefined,
    companyId: id(form.companyId),
    genericId: id(form.genericId),
    brandId: id(form.brandId),
    categoryId: resolvedCategoryId,
    dosageFormId: id(form.dosageFormId),
    unitId: id(form.unitId),
    taxProfileId: id(form.taxProfileId),
    barcode: form.barcode.trim() || undefined,
    alternateBarcode: form.alternateBarcode.trim() || undefined,
    companyProductCode: form.companyProductCode.trim() || undefined,
    purchasePrice: Number(form.purchasePrice) || 0,
    sellingPrice: Number(form.sellingPrice) || 0,
    wholesalePrice: Number(form.wholesalePrice) || 0,
    dealerPrice: Number(form.dealerPrice) || 0,
    costPrice: Number(form.costPrice) || 0,
    minSalePrice: Number(form.minSalePrice) || 0,
    maxRetailPrice: Number(form.maxRetailPrice) || 0,
    taxPct: Number(form.taxPct) || 0,
    extraTaxPct: Number(form.extraTaxPct) || 0,
    salesTaxType: form.salesTaxType.trim() || undefined,
    extSalesTaxType: form.extSalesTaxType.trim() || undefined,
    fbrProductType: form.fbrProductType.trim() || undefined,
    advTaxEnabled: form.advTaxEnabled,
    saleOnTradePrice: form.saleOnTradePrice,
    schemeDisc1Pct: Number(form.schemeDisc1Pct) || 0,
    schemeDisc2Pct: Number(form.schemeDisc2Pct) || 0,
    schemeQty: Number(form.schemeQty) || 0,
    schemeBonusQty: Number(form.schemeBonusQty) || 0,
    discOnRetailPct: Number(form.discOnRetailPct) || 0,
    reorderLevel: Number(form.reorderLevel) || 10,
    suggestedReorderQty: Number(form.suggestedReorderQty) || 0,
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
    sortOrder: Number(form.sortOrder) || 0,
    holdQty: Number(form.holdQty) || 0,
    locked: form.locked,
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
    minSalePricePkr: base.minSalePrice,
    maxRetailPricePkr: base.maxRetailPrice,
  };
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
  onCreateMaster,
  onCreateCompany,
  onSeedDefaults,
  seedingDefaults,
  companyLastCode,
}: {
  form: MedicineForm;
  setForm: (f: MedicineForm) => void;
  companies: MasterOption[];
  generics: MasterOption[];
  brands: MasterOption[];
  categories: MasterOption[];
  dosageForms: MasterOption[];
  units: MasterOption[];
  taxProfiles: MasterOption[];
  warehouses: MasterOption[];
  onCreateMaster?: (
    kind: "generics" | "brands" | "categories" | "dosage-forms" | "units" | "tax-profiles",
    input: { code: string; name: string; parentId?: string },
  ) => Promise<MasterOption>;
  onCreateCompany?: (draft: CompanyTargetDraft) => Promise<MasterOption>;
  onSeedDefaults?: () => void;
  seedingDefaults?: boolean;
  companyLastCode?: number;
}) {
  const set = (patch: Partial<MedicineForm>) => setForm({ ...form, ...patch });
  const [showCompanyTarget, setShowCompanyTarget] = useState(false);
  const [companyDraft, setCompanyDraft] = useState<CompanyTargetDraft>(emptyCompanyTarget());
  const [companyBusy, setCompanyBusy] = useState(false);
  const [companyErr, setCompanyErr] = useState<string | null>(null);
  const retailPack = medicinePackPrices(form.sellingPrice, form.tabletsPerStrip, form.stripsPerBox);
  const wholesalePack = medicinePackPrices(form.wholesalePrice, form.tabletsPerStrip, form.stripsPerBox);
  const tradePrice = Number(form.sellingPrice) || 0;
  const salesTaxValue = Math.round((tradePrice * (Number(form.taxPct) || 0)) / 100);
  const extraTaxValue = Math.round((tradePrice * (Number(form.extraTaxPct) || 0)) / 100);

  const groupOptions = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories],
  );
  const subGroupOptions = useMemo(
    () =>
      form.groupId
        ? categories.filter((c) => c.parentId === form.groupId)
        : categories.filter((c) => Boolean(c.parentId)),
    [categories, form.groupId],
  );

  const setStripFromPack = (packPkr: number, field: "sellingPrice" | "wholesalePrice") => {
    const spb = Math.max(1, Math.round(Number(form.stripsPerBox) || 1));
    set({ [field]: String(Math.round(packPkr / spb)) });
  };
  const setStripFromGoli = (goliPkr: number, field: "sellingPrice" | "wholesalePrice") => {
    const tps = Math.max(1, Math.round(Number(form.tabletsPerStrip) || 1));
    set({ [field]: String(Math.round(goliPkr * tps)) });
  };

  const mastersEmpty =
    categories.length === 0 ||
    dosageForms.length === 0 ||
    units.length === 0 ||
    generics.length === 0;

  const saveCompanyTarget = async () => {
    if (!onCreateCompany) return;
    if (!companyDraft.code.trim() || !companyDraft.name.trim()) {
      setCompanyErr("Code aur Company Name zaroori hain");
      return;
    }
    setCompanyBusy(true);
    setCompanyErr(null);
    try {
      const created = await onCreateCompany(companyDraft);
      set({ companyId: created.id, manufacturer: companyDraft.companyTitle || companyDraft.name });
      setCompanyDraft(emptyCompanyTarget());
      setShowCompanyTarget(false);
    } catch (e) {
      setCompanyErr(e instanceof Error ? e.message : "Company create failed");
    } finally {
      setCompanyBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {mastersEmpty ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Product masters khali thin — dropdowns me <strong>Tablet / Capsule / Strip</strong> waghera common options
          dikh rahe hain. Select karo (auto-save), ya{" "}
          <button
            type="button"
            className="font-semibold underline disabled:opacity-50"
            disabled={seedingDefaults || !onSeedDefaults}
            onClick={() => onSeedDefaults?.()}
          >
            {seedingDefaults ? "Adding…" : "sab defaults load karo"}
          </button>
          .
        </p>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identity</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <MasterSelect
            label="Company"
            required
            value={form.companyId}
            onChange={(v) => set({ companyId: v })}
            options={companies}
          />
          <div className="flex items-end">
            <DistButton
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setShowCompanyTarget((v) => !v);
                setCompanyErr(null);
                if (!companyDraft.code && companyLastCode) {
                  setCompanyDraft((d) => ({ ...d, code: String(companyLastCode + 1) }));
                }
              }}
            >
              {showCompanyTarget ? "Hide Company Target" : "+ New company (Company Target)"}
            </DistButton>
          </div>
          <label className="text-xs text-slate-500">
            Code (SKU)
            <DistInput className="mt-1" value={form.sku} onChange={(e) => set({ sku: e.target.value })} required />
          </label>
          <label className="text-xs text-slate-500">
            Alternate Code
            <DistInput
              className="mt-1"
              value={form.alternateBarcode}
              onChange={(e) => set({ alternateBarcode: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            Name
            <DistInput className="mt-1" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </label>
          <label className="text-xs text-slate-500">
            Company Prd Code
            <DistInput
              className="mt-1"
              value={form.companyProductCode}
              onChange={(e) => set({ companyProductCode: e.target.value })}
            />
          </label>
          <MasterSelect
            label="Group"
            value={form.groupId}
            onChange={(v) => {
              const opt = groupOptions.find((c) => c.id === v);
              set({
                groupId: v,
                categoryId: "",
                category: opt?.name || form.category || "Tablet",
              });
            }}
            options={groupOptions.length ? groupOptions : categories}
            mastersTab="categories"
            builtins={BUILTIN_MASTERS.categories}
            onCreate={
              onCreateMaster
                ? async (input) => {
                    const created = await onCreateMaster("categories", input);
                    set({ groupId: created.id, categoryId: "", category: created.name });
                    return created;
                  }
                : undefined
            }
          />
          <MasterSelect
            label="Sub Group"
            value={form.categoryId}
            onChange={(v) => {
              if (!v) {
                set({ categoryId: "" });
                return;
              }
              if (v.startsWith("builtin:")) {
                const code = v.slice("builtin:".length);
                const hit = BUILTIN_MASTERS.categories.find((b) => b.code === code);
                set({ categoryId: "", category: hit?.name || form.category || "Tablet" });
                return;
              }
              const opt = categories.find((c) => c.id === v);
              set({
                categoryId: v,
                groupId: opt?.parentId || form.groupId,
                category: opt?.name || form.category || "Tablet",
              });
            }}
            options={subGroupOptions}
            mastersTab="categories"
            builtins={form.groupId ? undefined : BUILTIN_MASTERS.categories}
            onCreate={
              onCreateMaster
                ? async (input) => {
                    const created = await onCreateMaster("categories", {
                      ...input,
                      parentId: form.groupId || undefined,
                    });
                    set({ categoryId: created.id, category: created.name });
                    return created;
                  }
                : undefined
            }
          />
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
              placeholder="e.g. Box of 10 strips"
            />
          </label>
        </div>

        {showCompanyTarget ? (
          <div className="mt-3 space-y-2 rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-800 dark:bg-sky-950/30">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              Company Target — new company for this product
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-slate-500">
                Code
                <DistInput
                  className="mt-1"
                  value={companyDraft.code}
                  onChange={(e) => setCompanyDraft({ ...companyDraft, code: e.target.value })}
                  required
                />
                <span className="mt-0.5 block text-[10px] text-slate-400">
                  Last Code: {companyLastCode || "—"}
                </span>
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2">
                Company Title
                <DistInput
                  className="mt-1"
                  value={companyDraft.companyTitle}
                  onChange={(e) => setCompanyDraft({ ...companyDraft, companyTitle: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
                Company Name
                <DistInput
                  className="mt-1"
                  value={companyDraft.name}
                  onChange={(e) => setCompanyDraft({ ...companyDraft, name: e.target.value })}
                  required
                />
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
                Company Address 1
                <DistInput
                  className="mt-1"
                  value={companyDraft.address}
                  onChange={(e) => setCompanyDraft({ ...companyDraft, address: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
                Company Address 2
                <DistInput
                  className="mt-1"
                  value={companyDraft.address2}
                  onChange={(e) => setCompanyDraft({ ...companyDraft, address2: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500">
                Bank
                <DistInput
                  className="mt-1"
                  value={companyDraft.bankName}
                  onChange={(e) => setCompanyDraft({ ...companyDraft, bankName: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500">
                Branch
                <DistInput
                  className="mt-1"
                  value={companyDraft.bankBranch}
                  onChange={(e) => setCompanyDraft({ ...companyDraft, bankBranch: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500">
                Transport
                <DistInput
                  className="mt-1"
                  value={companyDraft.transport}
                  onChange={(e) => setCompanyDraft({ ...companyDraft, transport: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500">
                Salesman Commission %Age
                <DistInput
                  className="mt-1"
                  type="number"
                  value={companyDraft.salesmanCommissionPct}
                  onChange={(e) =>
                    setCompanyDraft({ ...companyDraft, salesmanCommissionPct: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-slate-500">
                Show Company For Adv. Tax
                <DistSelect
                  className="mt-1"
                  value={companyDraft.showForAdvTax}
                  onChange={(e) => setCompanyDraft({ ...companyDraft, showForAdvTax: e.target.value })}
                >
                  <option>Yes</option>
                  <option>No</option>
                </DistSelect>
              </label>
            </div>
            {companyErr ? <p className="text-xs text-red-600">{companyErr}</p> : null}
            <div className="flex flex-wrap gap-2">
              <DistButton type="button" disabled={companyBusy || !onCreateCompany} onClick={() => void saveCompanyTarget()}>
                {companyBusy ? "Saving company…" : "Create company & select"}
              </DistButton>
              <DistButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCompanyTarget(false);
                  setCompanyDraft(emptyCompanyTarget());
                  setCompanyErr(null);
                }}
              >
                Cancel
              </DistButton>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company &amp; formula</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <MasterSelect
            label="Gen. Code / Formula"
            value={form.genericId}
            onChange={(v) => set({ genericId: v.startsWith("builtin:") ? "" : v })}
            options={generics}
            mastersTab="generics"
            builtins={BUILTIN_MASTERS.generics}
            onCreate={onCreateMaster ? (input) => onCreateMaster("generics", input) : undefined}
          />
          <label className="text-xs text-slate-500">
            Gen. Name (free text)
            <DistInput
              className="mt-1"
              value={form.genericName}
              onChange={(e) => set({ genericName: e.target.value })}
              placeholder="e.g. Paracetamol 500mg"
            />
          </label>
          <MasterSelect
            label="Brand"
            value={form.brandId}
            onChange={(v) => {
              if (v.startsWith("builtin:")) {
                const code = v.slice("builtin:".length);
                const hit = BUILTIN_MASTERS.brands.find((b) => b.code === code);
                set({ brandId: "", brandName: hit?.name || form.brandName });
                return;
              }
              set({ brandId: v });
            }}
            options={brands}
            mastersTab="brands"
            builtins={BUILTIN_MASTERS.brands}
            onCreate={onCreateMaster ? (input) => onCreateMaster("brands", input) : undefined}
          />
          <label className="text-xs text-slate-500">
            Brand (free text)
            <DistInput
              className="mt-1"
              value={form.brandName}
              onChange={(e) => set({ brandName: e.target.value })}
              placeholder="e.g. Panadol"
            />
          </label>
          <label className="text-xs text-slate-500">
            Manufacturer
            <DistInput
              className="mt-1"
              value={form.manufacturer}
              onChange={(e) => set({ manufacturer: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Category (free text)
            <DistInput
              className="mt-1"
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
              placeholder="e.g. Tablet"
            />
          </label>
          <MasterSelect
            label="Dosage form"
            value={form.dosageFormId}
            onChange={(v) => set({ dosageFormId: v.startsWith("builtin:") ? "" : v })}
            options={dosageForms}
            mastersTab="dosage-forms"
            builtins={BUILTIN_MASTERS["dosage-forms"]}
            onCreate={onCreateMaster ? (input) => onCreateMaster("dosage-forms", input) : undefined}
          />
          <MasterSelect
            label="Unit"
            value={form.unitId}
            onChange={(v) => {
              if (v.startsWith("builtin:")) {
                const code = v.slice("builtin:".length);
                const hit = BUILTIN_MASTERS.units.find((b) => b.code === code);
                set({ unitId: "", unit: hit?.name || form.unit });
                return;
              }
              const opt = units.find((u) => u.id === v);
              set({ unitId: v, unit: opt?.name || form.unit });
            }}
            options={units}
            mastersTab="units"
            builtins={BUILTIN_MASTERS.units}
            onCreate={
              onCreateMaster
                ? async (input) => {
                    const created = await onCreateMaster("units", input);
                    set({ unitId: created.id, unit: created.name });
                    return created;
                  }
                : undefined
            }
          />
          <MasterSelect
            label="Tax profile"
            value={form.taxProfileId}
            onChange={(v) => set({ taxProfileId: v.startsWith("builtin:") ? "" : v })}
            options={taxProfiles}
            mastersTab="tax-profiles"
            builtins={BUILTIN_MASTERS["tax-profiles"]}
            onCreate={onCreateMaster ? (input) => onCreateMaster("tax-profiles", input) : undefined}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pack size</h3>
        <p className="text-[11px] text-slate-500">
          Unit in a Pack = goli / pata · Unit in a Case = pata / box — prices neeche auto calculate hoti hain.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-500">
            Unit in a Pack (goli / pata)
            <DistInput
              className="mt-1"
              type="number"
              min={1}
              value={form.tabletsPerStrip}
              onChange={(e) => set({ tabletsPerStrip: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Unit in a Case (pata / pack)
            <DistInput
              className="mt-1"
              type="number"
              min={1}
              value={form.stripsPerBox}
              onChange={(e) => set({ stripsPerBox: e.target.value })}
            />
          </label>
          <div className="flex items-end rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 sm:col-span-2">
            Pack layout:{" "}
            <span className="ml-1 font-semibold">{formatPackLabel(form.tabletsPerStrip, form.stripsPerBox)}</span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rates &amp; prices</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-500">
            Trade Price (1 pata)
            <DistInput
              className="mt-1"
              type="number"
              value={form.sellingPrice}
              onChange={(e) => set({ sellingPrice: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Cut Rate / W.Rate
            <DistInput
              className="mt-1"
              type="number"
              value={form.wholesalePrice}
              onChange={(e) => set({ wholesalePrice: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Pur. Rate
            <DistInput
              className="mt-1"
              type="number"
              value={form.purchasePrice}
              onChange={(e) => set({ purchasePrice: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Min Sale Rate
            <DistInput
              className="mt-1"
              type="number"
              value={form.minSalePrice}
              onChange={(e) => set({ minSalePrice: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Retail Price / MRP
            <DistInput
              className="mt-1"
              type="number"
              value={form.maxRetailPrice}
              onChange={(e) => set({ maxRetailPrice: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Cost
            <DistInput
              className="mt-1"
              type="number"
              value={form.costPrice}
              onChange={(e) => set({ costPrice: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Dealer
            <DistInput
              className="mt-1"
              type="number"
              value={form.dealerPrice}
              onChange={(e) => set({ dealerPrice: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Sale On TP
            <DistSelect
              className="mt-1"
              value={form.saleOnTradePrice ? "Y" : "N"}
              onChange={(e) => set({ saleOnTradePrice: e.target.value === "Y" })}
            >
              <option value="N">N</option>
              <option value="Y">Y</option>
            </DistSelect>
          </label>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
            Retail pack breakdown
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-slate-500">
              1 pata (strip) Rs
              <DistInput
                className="mt-1"
                type="number"
                value={form.sellingPrice}
                onChange={(e) => set({ sellingPrice: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-500">
              1 goli Rs
              <DistInput
                className="mt-1"
                type="number"
                value={String(retailPack.goliPkr)}
                onChange={(e) => setStripFromGoli(Number(e.target.value) || 0, "sellingPrice")}
              />
            </label>
            <label className="text-xs text-slate-500">
              1 pack / box Rs
              <DistInput
                className="mt-1"
                type="number"
                value={String(retailPack.packPkr)}
                onChange={(e) => setStripFromPack(Number(e.target.value) || 0, "sellingPrice")}
              />
            </label>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Wholesale pack breakdown
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-slate-500">
              1 pata (strip) Rs
              <DistInput
                className="mt-1"
                type="number"
                value={form.wholesalePrice}
                onChange={(e) => set({ wholesalePrice: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-500">
              1 goli Rs
              <DistInput
                className="mt-1"
                type="number"
                value={String(wholesalePack.goliPkr)}
                onChange={(e) => setStripFromGoli(Number(e.target.value) || 0, "wholesalePrice")}
              />
            </label>
            <label className="text-xs text-slate-500">
              1 pack / box Rs
              <DistInput
                className="mt-1"
                type="number"
                value={String(wholesalePack.packPkr)}
                onChange={(e) => setStripFromPack(Number(e.target.value) || 0, "wholesalePrice")}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Taxation</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-500">
            Sales Tax Type
            <DistSelect
              className="mt-1"
              value={form.salesTaxType || "None"}
              onChange={(e) => set({ salesTaxType: e.target.value })}
            >
              <option value="None">None</option>
              <option value="Inclusive">Inclusive</option>
              <option value="Exclusive">Exclusive</option>
              <option value="Exempt">Exempt</option>
            </DistSelect>
          </label>
          <label className="text-xs text-slate-500">
            Ext. STax Type
            <DistInput
              className="mt-1"
              value={form.extSalesTaxType}
              onChange={(e) => set({ extSalesTaxType: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Product FBR Type
            <DistInput
              className="mt-1"
              value={form.fbrProductType}
              onChange={(e) => set({ fbrProductType: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Adv. Tax Y/N
            <DistSelect
              className="mt-1"
              value={form.advTaxEnabled ? "Y" : "N"}
              onChange={(e) => set({ advTaxEnabled: e.target.value === "Y" })}
            >
              <option value="N">N</option>
              <option value="Y">Y</option>
            </DistSelect>
          </label>
          <label className="text-xs text-slate-500">
            Sales Tax %
            <DistInput
              className="mt-1"
              type="number"
              value={form.taxPct}
              onChange={(e) => set({ taxPct: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Sales Tax Value
            <DistInput className="mt-1" type="number" value={String(salesTaxValue)} readOnly />
          </label>
          <label className="text-xs text-slate-500">
            Extra STax %
            <DistInput
              className="mt-1"
              type="number"
              value={form.extraTaxPct}
              onChange={(e) => set({ extraTaxPct: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Extra STax Value
            <DistInput className="mt-1" type="number" value={String(extraTaxValue)} readOnly />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schemes &amp; discounts</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-500">
            Scheme Disc 1 %
            <DistInput
              className="mt-1"
              type="number"
              value={form.schemeDisc1Pct}
              onChange={(e) => set({ schemeDisc1Pct: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Scheme Disc 2 %
            <DistInput
              className="mt-1"
              type="number"
              value={form.schemeDisc2Pct}
              onChange={(e) => set({ schemeDisc2Pct: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Scheme Qty
            <DistInput
              className="mt-1"
              type="number"
              value={form.schemeQty}
              onChange={(e) => set({ schemeQty: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Scheme Bonus
            <DistInput
              className="mt-1"
              type="number"
              value={form.schemeBonusQty}
              onChange={(e) => set({ schemeBonusQty: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Disc. on Retail %
            <DistInput
              className="mt-1"
              type="number"
              value={form.discOnRetailPct}
              onChange={(e) => set({ discOnRetailPct: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inventory config</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MasterSelect
            label="Default Godown"
            value={form.preferredWarehouseId}
            onChange={(v) => set({ preferredWarehouseId: v })}
            options={warehouses}
          />
          <label className="text-xs text-slate-500">
            Hold
            <DistInput
              className="mt-1"
              type="number"
              value={form.holdQty}
              onChange={(e) => set({ holdQty: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Sort Order
            <DistInput
              className="mt-1"
              type="number"
              value={form.sortOrder}
              onChange={(e) => set({ sortOrder: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Locked
            <DistSelect
              className="mt-1"
              value={form.locked ? "Y" : "N"}
              onChange={(e) => set({ locked: e.target.value === "Y" })}
            >
              <option value="N">N</option>
              <option value="Y">Y</option>
            </DistSelect>
          </label>
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
            Suggested reorder qty
            <DistInput
              className="mt-1"
              type="number"
              value={form.suggestedReorderQty}
              onChange={(e) => set({ suggestedReorderQty: e.target.value })}
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
            Aisle
            <DistInput
              className="mt-1"
              value={form.aisleLocation}
              onChange={(e) => set({ aisleLocation: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Rack
            <DistInput
              className="mt-1"
              value={form.rackLocation}
              onChange={(e) => set({ rackLocation: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            Shelf
            <DistInput
              className="mt-1"
              value={form.shelfLocation}
              onChange={(e) => set({ shelfLocation: e.target.value })}
            />
          </label>
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
  const [bulkOpen, setBulkOpen] = useState(false);
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
    queryFn: async () => {
      const active = await genericsApi.list({ page: 1, pageSize: 100, status: "active" });
      if (active.items.length) return active;
      return genericsApi.list({ page: 1, pageSize: 100 });
    },
    staleTime: 60_000,
  });
  const brands = useQuery({
    queryKey: ["pharmacy", "brands-picker"],
    queryFn: async () => {
      const active = await brandsApi.list({ page: 1, pageSize: 100, status: "active" });
      if (active.items.length) return active;
      return brandsApi.list({ page: 1, pageSize: 100 });
    },
    staleTime: 60_000,
  });
  const categories = useQuery({
    queryKey: ["pharmacy", "categories-picker"],
    queryFn: async () => {
      const active = await categoriesApi.list({ page: 1, pageSize: 100, status: "active" });
      if (active.items.length) return active;
      return categoriesApi.list({ page: 1, pageSize: 100 });
    },
    staleTime: 60_000,
  });
  const dosageForms = useQuery({
    queryKey: ["pharmacy", "dosage-picker"],
    queryFn: async () => {
      const active = await dosageFormsApi.list({ page: 1, pageSize: 100, status: "active" });
      if (active.items.length) return active;
      return dosageFormsApi.list({ page: 1, pageSize: 100 });
    },
    staleTime: 60_000,
  });
  const units = useQuery({
    queryKey: ["pharmacy", "units-picker"],
    queryFn: async () => {
      const active = await unitsApi.list({ page: 1, pageSize: 100, status: "active" });
      if (active.items.length) return active;
      return unitsApi.list({ page: 1, pageSize: 100 });
    },
    staleTime: 60_000,
  });
  const taxProfiles = useQuery({
    queryKey: ["pharmacy", "tax-picker"],
    queryFn: async () => {
      const active = await taxProfilesApi.list({ page: 1, pageSize: 100, status: "active" });
      if (active.items.length) return active;
      return taxProfilesApi.list({ page: 1, pageSize: 100 });
    },
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

  const drawerStock = useQuery({
    queryKey: ["pharmacy", "medicine-drawer-stock", branch?.code, drawerId],
    enabled: Boolean(drawerId) && Boolean(branch?.code),
    queryFn: () =>
      inventoryApi.productInventory(drawerId!, {
        branchCode: branch!.code,
      }),
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

  const bulkSave = useMutation({
    mutationFn: async (rows: Array<{ sku: string; name: string; purchasePrice: string; wholesalePrice: string; sellingPrice: string }>) => {
      if (!branch?.code) throw new Error("Select a branch");
      const errors: string[] = [];
      for (const r of rows) {
        try {
          await createPharmacyMedicine({
            branchCode: branch.code,
            sku: r.sku.trim(),
            name: r.name.trim(),
            purchasePrice: Number(r.purchasePrice) || 0,
            wholesalePrice: Number(r.wholesalePrice) || 0,
            sellingPrice: Number(r.sellingPrice) || 0,
            currentStock: 0,
          });
        } catch (e) {
          errors.push(`${r.sku}: ${e instanceof Error ? e.message : "failed"}`);
        }
      }
      if (errors.length) throw new Error(errors.slice(0, 5).join("; "));
    },
    onSuccess: () => {
      setBulkOpen(false);
      setError(null);
      invalidate();
      void list.refetch();
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

  const queryClient = useQueryClient();
  const invalidateMastersPickers = () => {
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "generics-picker"] });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "brands-picker"] });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "categories-picker"] });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "dosage-picker"] });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "units-picker"] });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "tax-picker"] });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "ref-masters"] });
  };

  const createMaster = async (
    kind: "generics" | "brands" | "categories" | "dosage-forms" | "units" | "tax-profiles",
    input: { code: string; name: string; parentId?: string },
  ): Promise<MasterOption> => {
    const apis = {
      generics: genericsApi,
      brands: brandsApi,
      categories: categoriesApi,
      "dosage-forms": dosageFormsApi,
      units: unitsApi,
      "tax-profiles": taxProfilesApi,
    } as const;
    const body: Record<string, unknown> = { code: input.code, name: input.name };
    if (kind === "tax-profiles") {
      body.ratePct = 0;
      body.taxType = "percentage";
    }
    if (kind === "brands" && form.companyId) {
      body.companyId = form.companyId;
    }
    if (kind === "categories" && input.parentId) {
      body.parentId = input.parentId;
    }
    const row = await apis[kind].create(body);
    invalidateMastersPickers();
    return { id: row.id, code: row.code, name: row.name, parentId: row.parentId ?? input.parentId ?? null };
  };

  const seedDefaults = useMutation({
    mutationFn: async () => {
      const ensure = async (
        kind: "categories" | "dosage-forms" | "units" | "tax-profiles" | "generics" | "brands",
        rows: { code: string; name: string }[],
        existing: MasterOption[],
      ) => {
        const have = new Set(existing.map((e) => e.code.toUpperCase()));
        for (const row of rows) {
          if (have.has(row.code.toUpperCase())) continue;
          try {
            await createMaster(kind, { code: row.code, name: row.name });
            have.add(row.code.toUpperCase());
          } catch {
            // Unique collision / permission — continue seeding others
          }
        }
      };
      await ensure("categories", BUILTIN_MASTERS.categories, categories.data?.items ?? []);
      await ensure("dosage-forms", BUILTIN_MASTERS["dosage-forms"], dosageForms.data?.items ?? []);
      await ensure("units", BUILTIN_MASTERS.units, units.data?.items ?? []);
      await ensure("tax-profiles", BUILTIN_MASTERS["tax-profiles"], taxProfiles.data?.items ?? []);
      await ensure("generics", BUILTIN_MASTERS.generics, generics.data?.items ?? []);
      await ensure("brands", BUILTIN_MASTERS.brands, brands.data?.items ?? []);
      const tax17 = (await taxProfilesApi.list({ page: 1, pageSize: 50 })).items.find(
        (t) => t.code.toUpperCase() === "TAX17",
      );
      if (tax17 && Number(tax17.ratePct ?? 0) === 0) {
        try {
          await taxProfilesApi.update(tax17.id, { ratePct: 17, taxType: "percentage" });
        } catch {
          /* ignore */
        }
      }
    },
    onSuccess: () => {
      invalidateMastersPickers();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const seededOnce = useRef(false);
  useEffect(() => {
    if (!formOpen || seededOnce.current || seedDefaults.isPending) return;
    const empty =
      (categories.data?.items.length ?? 0) === 0 &&
      (units.data?.items.length ?? 0) === 0 &&
      (dosageForms.data?.items.length ?? 0) === 0 &&
      !categories.isLoading &&
      !units.isLoading &&
      !dosageForms.isLoading;
    if (!empty) return;
    seededOnce.current = true;
    seedDefaults.mutate();
  }, [
    formOpen,
    categories.data,
    units.data,
    dosageForms.data,
    categories.isLoading,
    units.isLoading,
    dosageForms.isLoading,
    seedDefaults,
  ]);

  const companyLastCode = useMemo(() => {
    const codes = (companies.data?.items ?? [])
      .map((r: CompanyRow) => Number(String(r.code).replace(/\D/g, "")))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    return codes.length ? Math.max(...codes) : 0;
  }, [companies.data?.items]);

  const createCompanyFromProduct = async (draft: CompanyTargetDraft): Promise<MasterOption> => {
    const row = (await createPharmacyCompany({
      code: draft.code.trim(),
      name: draft.name.trim(),
      companyTitle: draft.companyTitle.trim() || undefined,
      manufacturerName: draft.companyTitle.trim() || draft.name.trim() || undefined,
      address: draft.address.trim() || undefined,
      address2: draft.address2.trim() || undefined,
      bankName: draft.bankName.trim() || undefined,
      bankBranch: draft.bankBranch.trim() || undefined,
      transport: draft.transport.trim() || undefined,
      salesmanCommissionPct: Number(draft.salesmanCommissionPct) || 0,
      showForAdvTax: draft.showForAdvTax.trim() || undefined,
    })) as CompanyRow;
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "companies-paged"] });
    void queryClient.invalidateQueries({ queryKey: ["pharmacy", "companies-picker"] });
    return { id: row.id, code: row.code, name: row.name };
  };

  const refOpts = {
    companies: (companies.data?.items ?? []).map((c: CompanyRow) => ({
      id: c.id,
      code: c.code,
      name: c.name,
    })),
    generics: generics.data?.items ?? [],
    brands: brands.data?.items ?? [],
    categories: categories.data?.items ?? [],
    dosageForms: dosageForms.data?.items ?? [],
    units: units.data?.items ?? [],
    taxProfiles: taxProfiles.data?.items ?? [],
    warehouses: warehouses.data?.items ?? [],
    onCreateMaster: createMaster,
    onCreateCompany: createCompanyFromProduct,
    companyLastCode,
    onSeedDefaults: () => seedDefaults.mutate(),
    seedingDefaults: seedDefaults.isPending,
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
          <DistButton
            variant="secondary"
            onClick={() => {
              setBulkOpen(true);
              setFormOpen(false);
            }}
          >
            + Add multiple
          </DistButton>
          <DistButton onClick={openCreate}>+ Add Medicine</DistButton>
        </div>
      }
      error={error ?? (!branch ? "Select a branch to load medicines." : null)}
    >
      {bulkOpen ? (
        <DistBulkMedicineCreate
          busy={bulkSave.isPending}
          onClose={() => setBulkOpen(false)}
          onSave={async (rows) => {
            await bulkSave.mutateAsync(rows);
          }}
        />
      ) : null}
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
          { key: "genericName", header: "Formula", render: (r) => r.genericName ?? "—" },
          {
            key: "pack",
            header: "Pack",
            render: (r) => formatPackLabel(r.tabletsPerStrip, r.stripsPerBox),
          },
          {
            key: "pata",
            header: "Pata Rs",
            render: (r) => {
              const p = medicinePackPrices(r.wholesalePricePkr ?? r.sellingPricePkr, r.tabletsPerStrip, r.stripsPerBox);
              return formatPkr(p.pataPkr);
            },
          },
          {
            key: "goli",
            header: "Goli Rs",
            render: (r) => {
              const p = medicinePackPrices(r.wholesalePricePkr ?? r.sellingPricePkr, r.tabletsPerStrip, r.stripsPerBox);
              return formatPkr(p.goliPkr);
            },
          },
          {
            key: "box",
            header: "Pack Rs",
            render: (r) => {
              const p = medicinePackPrices(r.wholesalePricePkr ?? r.sellingPricePkr, r.tabletsPerStrip, r.stripsPerBox);
              return formatPkr(p.packPkr);
            },
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
            <DistDrawerField label="Formula" value={drawer.data.genericNameMaster ?? drawer.data.genericName} />
            <DistDrawerField label="Brand" value={drawer.data.brandNameMaster ?? drawer.data.brandName} />
            <DistDrawerField label="Category" value={drawer.data.categoryNameMaster ?? drawer.data.category} />
            <DistDrawerField label="Dosage" value={drawer.data.dosageFormName} />
            <DistDrawerField label="Unit" value={drawer.data.unitNameMaster ?? drawer.data.unit} />
            <DistDrawerField
              label="Pack"
              value={formatPackLabel(drawer.data.tabletsPerStrip, drawer.data.stripsPerBox)}
            />
            {(() => {
              const p = medicinePackPrices(
                drawer.data.wholesalePricePkr ?? drawer.data.sellingPricePkr,
                drawer.data.tabletsPerStrip,
                drawer.data.stripsPerBox,
              );
              return (
                <>
                  <DistDrawerField label="1 pata" value={formatPkr(p.pataPkr)} />
                  <DistDrawerField label="1 goli" value={formatPkr(p.goliPkr)} />
                  <DistDrawerField label="1 pack" value={formatPkr(p.packPkr)} />
                </>
              );
            })()}
            <DistDrawerField label="Wholesale" value={formatPkr(drawer.data.wholesalePricePkr ?? 0)} />
            <DistDrawerField label="Retail" value={formatPkr(drawer.data.sellingPricePkr ?? 0)} />
            <DistDrawerField
              label="Available"
              value={
                drawerStock.isLoading
                  ? "…"
                  : drawerStock.data?.stock?.availableQty != null
                    ? drawerStock.data.stock.availableQty
                    : "—"
              }
            />
            <DistDrawerField
              label="Physical"
              value={
                drawerStock.isLoading
                  ? "…"
                  : drawerStock.data?.stock?.physicalQty != null
                    ? drawerStock.data.stock.physicalQty
                    : "—"
              }
            />
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
export type { MedicineForm };
export { MedicineFormFields, detailToForm, emptyForm, formPayload };
