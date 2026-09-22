import type { ReactNode } from "react";
import { DistButton, DistInput, DistSelect } from "../ui/DistUi";
import type { TradeCustomerRow } from "../../pharmacy/api/pharmacy-masters";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type TradeCustomerForm = {
  code: string;
  name: string;
  businessName: string;
  oldCode: string;
  status: string;
  partyType: string;
  speciality: string;
  address: string;
  storeType: string;
  customerType: string;
  cityName: string;
  cityId: string;
  areaId: string;
  territoryId: string;
  routeId: string;
  salesmanEmployeeId: string;
  contactPerson: string;
  passportNo: string;
  nicNumber: string;
  ntnNumber: string;
  landLine: string;
  phone: string;
  whatsapp: string;
  email: string;
  customerClass: string;
  detailedAddress: string;
  regDate: string;
  creditLimitPkr: string;
  creditDays: string;
  creditCategory: string;
  monthlySalesTargetPkr: string;
  modeOfPayment: string;
  timing: string;
  visitFrequency: string;
  visitingDays: string[];
  termsOfPayment: string;
  priceLevel: string;
  discountPct: string;
  license9Enabled: boolean;
  license9No: string;
  license9Expiry: string;
  license10Enabled: boolean;
  license10No: string;
  license10Expiry: string;
  license11Enabled: boolean;
  license11No: string;
  license11Expiry: string;
  advTaxType: string;
  isFocCustomer: boolean;
  canDeductTax: boolean;
  taxPct: string;
  taxInfo: string;
  imageUrl: string;
  discountPolicyNotes: string;
  bonusPolicyNotes: string;
  companyCreditLimitsNotes: string;
  othersNotes: string;
  companyIdsNotes: string;
  blockSalesNotes: string;
  locationLat: string;
  locationLng: string;
  locationNotes: string;
  accountType: string;
  companyCode: string;
  uniqueName: string;
  postalAddress: string;
  province: string;
  fax: string;
  partyMode: string;
  stxNo: string;
  sector: string;
  licenceNo: string;
  licenceExpiry: string;
  activeTaxPayer: boolean;
  incomeTaxExempt: boolean;
  advanceTaxSummary: boolean;
  invoiceWarranty: boolean;
};

export type TradeCustomerFormTab =
  | "coaClient"
  | "information"
  | "discount"
  | "bonus"
  | "others"
  | "companyCredit"
  | "billToBill"
  | "companyIds"
  | "history"
  | "location"
  | "blockSales";

export type TradeCustomerLookups = {
  routes: Array<{ id: string; code: string; name: string }>;
  employees: Array<{ id: string; employeeCode: string; name: string }>;
  cities: Array<{ id: string; name: string }>;
  areas: Array<{ id: string; name: string }>;
};

function parseDays(raw?: string | null): string[] {
  if (!raw?.trim()) return ["Mon", "Tue", "Wed", "Thu", "Sat", "Sun"];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* ignore */
  }
  return raw.split(/[,\s]+/).filter(Boolean);
}

export function emptyTradeCustomerForm(): TradeCustomerForm {
  return {
    code: "",
    name: "",
    businessName: "",
    oldCode: "",
    status: "active",
    partyType: "PHARMA",
    speciality: "",
    address: "",
    storeType: "MEDICAL STORE",
    customerType: "Pharmacy",
    cityName: "",
    cityId: "",
    areaId: "",
    territoryId: "",
    routeId: "",
    salesmanEmployeeId: "",
    contactPerson: "",
    passportNo: "",
    nicNumber: "",
    ntnNumber: "",
    landLine: "",
    phone: "",
    whatsapp: "",
    email: "",
    customerClass: "A+",
    detailedAddress: "",
    regDate: "",
    creditLimitPkr: "0",
    creditDays: "0",
    creditCategory: "",
    monthlySalesTargetPkr: "0",
    modeOfPayment: "",
    timing: "",
    visitFrequency: "0",
    visitingDays: ["Mon", "Tue", "Wed", "Thu", "Sat", "Sun"],
    termsOfPayment: "",
    priceLevel: "wholesale",
    discountPct: "0",
    license9Enabled: false,
    license9No: "",
    license9Expiry: "",
    license10Enabled: false,
    license10No: "",
    license10Expiry: "",
    license11Enabled: false,
    license11No: "",
    license11Expiry: "",
    advTaxType: "FILER",
    isFocCustomer: false,
    canDeductTax: false,
    taxPct: "0",
    taxInfo: "",
    imageUrl: "",
    discountPolicyNotes: "",
    bonusPolicyNotes: "",
    companyCreditLimitsNotes: "",
    othersNotes: "",
    companyIdsNotes: "",
    blockSalesNotes: "",
    locationLat: "",
    locationLng: "",
    locationNotes: "",
    accountType: "Receivable",
    companyCode: "",
    uniqueName: "",
    postalAddress: "",
    province: "",
    fax: "",
    partyMode: "",
    stxNo: "",
    sector: "",
    licenceNo: "",
    licenceExpiry: "",
    activeTaxPayer: false,
    incomeTaxExempt: false,
    advanceTaxSummary: false,
    invoiceWarranty: false,
  };
}

export function rowToTradeCustomerForm(r: TradeCustomerRow): TradeCustomerForm {
  return {
    ...emptyTradeCustomerForm(),
    code: r.code ?? "",
    name: r.name ?? "",
    businessName: r.businessName ?? "",
    oldCode: r.oldCode ?? "",
    status: r.status ?? "active",
    partyType: r.partyType ?? "PHARMA",
    speciality: r.speciality ?? "",
    address: r.address ?? "",
    storeType: r.storeType ?? "MEDICAL STORE",
    customerType: r.customerType ?? "Pharmacy",
    cityName: r.cityName ?? "",
    cityId: r.cityId ?? "",
    areaId: r.areaId ?? "",
    territoryId: r.territoryId ?? "",
    routeId: r.routeId ?? "",
    salesmanEmployeeId: r.salesmanEmployeeId ?? "",
    contactPerson: r.contactPerson ?? "",
    passportNo: r.passportNo ?? "",
    nicNumber: r.nicNumber ?? "",
    ntnNumber: r.ntnNumber ?? "",
    landLine: r.landLine ?? "",
    phone: r.phone ?? "",
    whatsapp: r.whatsapp ?? "",
    email: r.email ?? "",
    customerClass: r.customerClass ?? "A+",
    detailedAddress: r.detailedAddress ?? "",
    regDate: r.regDate ? String(r.regDate).slice(0, 10) : "",
    creditLimitPkr: String(r.creditLimitPkr ?? 0),
    creditDays: String(r.creditDays ?? 0),
    creditCategory: r.creditCategory ?? "",
    monthlySalesTargetPkr: String(r.monthlySalesTargetPkr ?? 0),
    modeOfPayment: r.modeOfPayment ?? "",
    timing: r.timing ?? "",
    visitFrequency: String(r.visitFrequency ?? 0),
    visitingDays: parseDays(r.visitingDaysJson),
    termsOfPayment: r.termsOfPayment ?? "",
    priceLevel: r.priceLevel ?? "wholesale",
    discountPct: String(r.discountPct ?? 0),
    license9Enabled: Boolean(r.license9No),
    license9No: r.license9No ?? "",
    license9Expiry: r.license9Expiry ? String(r.license9Expiry).slice(0, 10) : "",
    license10Enabled: Boolean(r.license10No),
    license10No: r.license10No ?? "",
    license10Expiry: r.license10Expiry ? String(r.license10Expiry).slice(0, 10) : "",
    license11Enabled: Boolean(r.license11No),
    license11No: r.license11No ?? "",
    license11Expiry: r.license11Expiry ? String(r.license11Expiry).slice(0, 10) : "",
    advTaxType: r.advTaxType ?? "FILER",
    isFocCustomer: Boolean(r.isFocCustomer),
    canDeductTax: Boolean(r.canDeductTax),
    taxPct: String(r.taxPct ?? 0),
    taxInfo: r.taxInfo ?? "",
    imageUrl: r.imageUrl ?? "",
    discountPolicyNotes: r.discountPolicyJson ?? "",
    bonusPolicyNotes: r.bonusPolicyJson ?? "",
    companyCreditLimitsNotes: r.companyCreditLimitsJson ?? "",
    othersNotes: r.othersJson ?? "",
    companyIdsNotes: r.companyIdsJson ?? "",
    blockSalesNotes: r.blockSalesJson ?? "",
    locationLat: r.locationLat ?? "",
    locationLng: r.locationLng ?? "",
    locationNotes: r.locationNotes ?? "",
    accountType: r.accountType ?? "Receivable",
    companyCode: r.companyCode ?? "",
    uniqueName: r.uniqueName ?? "",
    postalAddress: r.postalAddress ?? "",
    province: r.province ?? "",
    fax: r.fax ?? "",
    partyMode: r.partyMode ?? "",
    stxNo: r.stxNo ?? "",
    sector: r.sector ?? "",
    licenceNo: r.licenceNo ?? "",
    licenceExpiry: r.licenceExpiry ? String(r.licenceExpiry).slice(0, 10) : "",
    activeTaxPayer: Boolean(r.activeTaxPayer),
    incomeTaxExempt: Boolean(r.incomeTaxExempt),
    advanceTaxSummary: Boolean(r.advanceTaxSummary),
    invoiceWarranty: Boolean(r.invoiceWarranty),
  };
}

export function tradeCustomerFormPayload(form: TradeCustomerForm, branchCode?: string) {
  return {
    branchCode,
    code: form.code.trim(),
    name: form.name.trim(),
    businessName: form.businessName.trim() || undefined,
    oldCode: form.oldCode.trim() || undefined,
    status: form.status,
    partyType: form.partyType.trim() || undefined,
    speciality: form.speciality.trim() || undefined,
    address: form.address.trim() || undefined,
    storeType: form.storeType.trim() || undefined,
    customerType: form.customerType,
    cityName: form.cityName.trim() || undefined,
    cityId: form.cityId || undefined,
    areaId: form.areaId || undefined,
    territoryId: form.territoryId || undefined,
    routeId: form.routeId || undefined,
    salesmanEmployeeId: form.salesmanEmployeeId || undefined,
    contactPerson: form.contactPerson.trim() || undefined,
    passportNo: form.passportNo.trim() || undefined,
    nicNumber: form.nicNumber.trim() || undefined,
    ntnNumber: form.ntnNumber.trim() || undefined,
    landLine: form.landLine.trim() || undefined,
    phone: form.phone.trim() || undefined,
    whatsapp: form.whatsapp.trim() || undefined,
    email: form.email.trim() || undefined,
    customerClass: form.customerClass.trim() || undefined,
    detailedAddress: form.detailedAddress.trim() || undefined,
    regDate: form.regDate || undefined,
    creditLimitPkr: Number(form.creditLimitPkr) || 0,
    creditDays: Number(form.creditDays) || 0,
    creditCategory: form.creditCategory.trim() || undefined,
    monthlySalesTargetPkr: Number(form.monthlySalesTargetPkr) || 0,
    modeOfPayment: form.modeOfPayment.trim() || undefined,
    timing: form.timing.trim() || undefined,
    visitFrequency: Number(form.visitFrequency) || 0,
    visitingDays: form.visitingDays,
    termsOfPayment: form.termsOfPayment.trim() || undefined,
    priceLevel: form.priceLevel,
    discountPct: Number(form.discountPct) || 0,
    license9No: form.license9Enabled ? form.license9No.trim() : "",
    license9Expiry: form.license9Enabled ? form.license9Expiry : "",
    license10No: form.license10Enabled ? form.license10No.trim() : "",
    license10Expiry: form.license10Enabled ? form.license10Expiry : "",
    license11No: form.license11Enabled ? form.license11No.trim() : "",
    license11Expiry: form.license11Enabled ? form.license11Expiry : "",
    advTaxType: form.advTaxType.trim() || undefined,
    isFocCustomer: form.isFocCustomer,
    canDeductTax: form.canDeductTax,
    taxPct: Number(form.taxPct) || 0,
    taxInfo: form.taxInfo.trim() || undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    discountPolicyJson: form.discountPolicyNotes.trim() || undefined,
    bonusPolicyJson: form.bonusPolicyNotes.trim() || undefined,
    companyCreditLimitsJson: form.companyCreditLimitsNotes.trim() || undefined,
    companyIdsJson: form.companyIdsNotes.trim() || undefined,
    blockSalesJson: form.blockSalesNotes.trim() || undefined,
    othersJson: form.othersNotes.trim() || undefined,
    locationLat: form.locationLat.trim() || undefined,
    locationLng: form.locationLng.trim() || undefined,
    locationNotes: form.locationNotes.trim() || undefined,
    accountType: form.accountType.trim() || undefined,
    companyCode: form.companyCode.trim() || undefined,
    uniqueName: form.uniqueName.trim() || undefined,
    postalAddress: form.postalAddress.trim() || undefined,
    province: form.province.trim() || undefined,
    fax: form.fax.trim() || undefined,
    partyMode: form.partyMode.trim() || undefined,
    stxNo: form.stxNo.trim() || undefined,
    sector: form.sector.trim() || undefined,
    licenceNo: form.licenceNo.trim() || undefined,
    licenceExpiry: form.licenceExpiry || undefined,
    activeTaxPayer: form.activeTaxPayer,
    incomeTaxExempt: form.incomeTaxExempt,
    advanceTaxSummary: form.advanceTaxSummary,
    invoiceWarranty: form.invoiceWarranty,
  };
}

const INFO_TABS: Array<{ id: TradeCustomerFormTab; label: string }> = [
  { id: "coaClient", label: "Client (CoA)" },
  { id: "information", label: "Information" },
  { id: "discount", label: "Discount Policy" },
  { id: "bonus", label: "Bonus Policy" },
  { id: "others", label: "Others" },
  { id: "companyCredit", label: "Company Wise Credit Limit" },
];

const TOP_TABS: Array<{ id: TradeCustomerFormTab; label: string }> = [
  { id: "billToBill", label: "Bill To Bill Detail" },
  { id: "companyIds", label: "Company Ids" },
  { id: "history", label: "History" },
  { id: "location", label: "Location Map" },
  { id: "blockSales", label: "Block Sales" },
];

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <label className={`text-xs text-slate-500 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/40">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {children}
    </div>
  );
}

type Props = {
  form: TradeCustomerForm;
  setForm: (next: TradeCustomerForm) => void;
  tab: TradeCustomerFormTab;
  setTab: (tab: TradeCustomerFormTab) => void;
  lookups: TradeCustomerLookups;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
  busy?: boolean;
  editingId?: string | null;
};

export function TradeCustomerFormFields({
  form,
  setForm,
  tab,
  setTab,
  lookups,
  onSave,
  onClear,
  onClose,
  busy,
  editingId,
}: Props): JSX.Element {
  const set = (patch: Partial<TradeCustomerForm>) => setForm({ ...form, ...patch });
  const toggleDay = (day: string) => {
    const has = form.visitingDays.includes(day);
    set({
      visitingDays: has ? form.visitingDays.filter((d) => d !== day) : [...form.visitingDays, day],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <DistButton type="button" disabled={busy} onClick={onSave}>
          {busy ? "Saving…" : "Save & Close"}
        </DistButton>
        <DistButton type="button" variant="secondary" onClick={onClear}>
          Clear
        </DistButton>
        <DistButton type="button" variant="ghost" onClick={onClose}>
          Close
        </DistButton>
        <DistButton
          type="button"
          variant="secondary"
          onClick={() =>
            window.alert(
              "FBR customer sync will pull NTN / filer status when the org FBR connector is configured.",
            )
          }
        >
          Sync With FBR Data
        </DistButton>
        <span className="ml-auto text-[11px] text-slate-500">
          {editingId ? `ID · ${form.code || editingId.slice(0, 8)}` : "New customer"}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Customer / Code">
          <DistInput value={form.code} onChange={(e) => set({ code: e.target.value })} required />
        </Field>
        <Field label="Name" className="sm:col-span-2">
          <DistInput value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        </Field>
        <Field label="Old Id">
          <DistInput value={form.oldCode} onChange={(e) => set({ oldCode: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.status !== "active"}
            onChange={(e) => set({ status: e.target.checked ? "inactive" : "active" })}
          />
          In Active
        </label>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {TOP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-t-md px-3 py-1.5 text-xs font-semibold ${
              tab === t.id
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {INFO_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === t.id
                ? "bg-amber-500 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "coaClient" ? (
        <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3 dark:border-sky-800 dark:bg-sky-950/20">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Chart of Account · Client
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Account Type">
              <DistSelect
                value={form.accountType}
                onChange={(e) => set({ accountType: e.target.value })}
              >
                <option>Receivable</option>
                <option>Payable</option>
                <option>Both</option>
                <option>Other</option>
              </DistSelect>
            </Field>
            <Field label="Code">
              <DistInput value={form.code} onChange={(e) => set({ code: e.target.value })} required />
            </Field>
            <Field label="Cmp_Code">
              <DistInput
                value={form.companyCode}
                onChange={(e) => set({ companyCode: e.target.value })}
              />
            </Field>
            <Field label="Party Type">
              <DistSelect value={form.partyType} onChange={(e) => set({ partyType: e.target.value })}>
                <option>PHARMA</option>
                <option>GENERAL</option>
                <option>HOSPITAL</option>
                <option>INSTITUTION</option>
              </DistSelect>
            </Field>
            <Field label="Name" className="sm:col-span-2">
              <DistInput value={form.name} onChange={(e) => set({ name: e.target.value })} required />
            </Field>
            <Field label="Unique Name" className="sm:col-span-2">
              <DistInput
                value={form.uniqueName}
                onChange={(e) => set({ uniqueName: e.target.value })}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <DistInput value={form.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <Field label="Postal Address" className="sm:col-span-2">
              <DistInput
                value={form.postalAddress}
                onChange={(e) => set({ postalAddress: e.target.value })}
              />
            </Field>
            <Field label="Province">
              <DistSelect value={form.province} onChange={(e) => set({ province: e.target.value })}>
                <option value="">—</option>
                <option>Punjab</option>
                <option>Sindh</option>
                <option>Khyber Pakhtunkhwa</option>
                <option>Balochistan</option>
                <option>Islamabad</option>
                <option>AJK</option>
                <option>Gilgit-Baltistan</option>
              </DistSelect>
            </Field>
            <Field label="Sector">
              <DistInput value={form.sector} onChange={(e) => set({ sector: e.target.value })} />
            </Field>
            <Field label="Area">
              <DistSelect value={form.areaId} onChange={(e) => set({ areaId: e.target.value })}>
                <option value="">—</option>
                {lookups.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </DistSelect>
            </Field>
            <Field label="Email">
              <DistInput value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <DistInput value={form.landLine} onChange={(e) => set({ landLine: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <DistInput value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Fax">
              <DistInput value={form.fax} onChange={(e) => set({ fax: e.target.value })} />
            </Field>
            <Field label="Credit Limit">
              <DistInput
                type="number"
                value={form.creditLimitPkr}
                onChange={(e) => set({ creditLimitPkr: e.target.value })}
              />
            </Field>
            <Field label="Party Mod">
              <DistSelect value={form.partyMode} onChange={(e) => set({ partyMode: e.target.value })}>
                <option value="">—</option>
                <option>Cash</option>
                <option>Credit</option>
                <option>Both</option>
              </DistSelect>
            </Field>
            <Field label="Stx No">
              <DistInput value={form.stxNo} onChange={(e) => set({ stxNo: e.target.value })} />
            </Field>
            <Field label="NTN #">
              <DistInput value={form.ntnNumber} onChange={(e) => set({ ntnNumber: e.target.value })} />
            </Field>
            <Field label="CNIC #">
              <DistInput value={form.nicNumber} onChange={(e) => set({ nicNumber: e.target.value })} />
            </Field>
            <Field label="Licence #">
              <DistInput value={form.licenceNo} onChange={(e) => set({ licenceNo: e.target.value })} />
            </Field>
            <Field label="Licence Exp. Date">
              <DistInput
                type="date"
                value={form.licenceExpiry}
                onChange={(e) => set({ licenceExpiry: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.activeTaxPayer}
                onChange={(e) => set({ activeTaxPayer: e.target.checked })}
              />
              Active Tax Payer
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.incomeTaxExempt}
                onChange={(e) => set({ incomeTaxExempt: e.target.checked })}
              />
              Income Tax Exempt
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.status !== "active"}
                onChange={(e) => set({ status: e.target.checked ? "inactive" : "active" })}
              />
              Dead
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.advanceTaxSummary}
                onChange={(e) => set({ advanceTaxSummary: e.target.checked })}
              />
              Advance Tax Summary
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.invoiceWarranty}
                onChange={(e) => set({ invoiceWarranty: e.target.checked })}
              />
              Invoice Warranty
            </label>
          </div>
        </div>
      ) : null}

      {tab === "information" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Field label="Type">
              <DistSelect value={form.partyType} onChange={(e) => set({ partyType: e.target.value })}>
                <option>PHARMA</option>
                <option>GENERAL</option>
                <option>HOSPITAL</option>
                <option>INSTITUTION</option>
              </DistSelect>
            </Field>
            <Field label="Speciality">
              <DistInput value={form.speciality} onChange={(e) => set({ speciality: e.target.value })} />
            </Field>
            <Field label="Address">
              <DistInput value={form.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <Field label="Customer / Store type">
              <DistSelect value={form.storeType} onChange={(e) => set({ storeType: e.target.value })}>
                <option>MEDICAL STORE</option>
                <option>WHOLESALE</option>
                <option>HOSPITAL</option>
                <option>CLINIC</option>
                <option>DISTRIBUTOR</option>
              </DistSelect>
            </Field>
            <Field label="Billing type">
              <DistSelect
                value={form.customerType}
                onChange={(e) => set({ customerType: e.target.value })}
              >
                <option>Pharmacy</option>
                <option>Retailer</option>
                <option>Wholesaler</option>
                <option>Hospital</option>
              </DistSelect>
            </Field>
            <Field label="City">
              <DistInput
                value={form.cityName}
                onChange={(e) => set({ cityName: e.target.value })}
                list="dist-city-names"
                placeholder="City name"
              />
              <datalist id="dist-city-names">
                {lookups.cities.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Area">
              <DistSelect value={form.areaId} onChange={(e) => set({ areaId: e.target.value })}>
                <option value="">—</option>
                {lookups.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </DistSelect>
            </Field>
            <Field label="Contact person">
              <DistInput
                value={form.contactPerson}
                onChange={(e) => set({ contactPerson: e.target.value })}
              />
            </Field>
            <Field label="Passport No">
              <DistInput value={form.passportNo} onChange={(e) => set({ passportNo: e.target.value })} />
            </Field>
            <Field label="NIC#">
              <DistInput value={form.nicNumber} onChange={(e) => set({ nicNumber: e.target.value })} />
            </Field>
            <Field label="Class">
              <DistSelect
                value={form.customerClass}
                onChange={(e) => set({ customerClass: e.target.value })}
              >
                <option>A+</option>
                <option>A</option>
                <option>B</option>
                <option>C</option>
              </DistSelect>
            </Field>
            <Field label="Detailed address">
              <textarea
                className="min-h-[4.5rem] w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={form.detailedAddress}
                onChange={(e) => set({ detailedAddress: e.target.value })}
              />
            </Field>
            <Field label="Reg. Date">
              <DistInput
                type="date"
                value={form.regDate}
                onChange={(e) => set({ regDate: e.target.value })}
              />
            </Field>
            <Field label="N.T.N No">
              <DistInput value={form.ntnNumber} onChange={(e) => set({ ntnNumber: e.target.value })} />
            </Field>
            <Field label="Land Line">
              <DistInput value={form.landLine} onChange={(e) => set({ landLine: e.target.value })} />
            </Field>
            <Field label="Mobile / Phone">
              <DistInput value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="WhatsApp">
              <DistInput value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />
            </Field>
            <Field label="Email">
              <DistInput value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
          </div>

          <div className="space-y-2">
            <Field label="Credit Limit">
              <DistInput
                type="number"
                value={form.creditLimitPkr}
                onChange={(e) => set({ creditLimitPkr: e.target.value })}
              />
            </Field>
            <Field label="Credit Days">
              <DistInput
                type="number"
                value={form.creditDays}
                onChange={(e) => set({ creditDays: e.target.value })}
              />
            </Field>
            <Field label="Credit Category">
              <DistInput
                value={form.creditCategory}
                onChange={(e) => set({ creditCategory: e.target.value })}
              />
            </Field>
            <Field label="Monthly Sales target">
              <DistInput
                type="number"
                value={form.monthlySalesTargetPkr}
                onChange={(e) => set({ monthlySalesTargetPkr: e.target.value })}
              />
            </Field>
            <Field label="Mode Of Payment">
              <DistInput
                value={form.modeOfPayment}
                onChange={(e) => set({ modeOfPayment: e.target.value })}
              />
            </Field>
            <Field label="Timing">
              <DistInput value={form.timing} onChange={(e) => set({ timing: e.target.value })} />
            </Field>
            <Field label="Visit Frequency">
              <DistInput
                type="number"
                value={form.visitFrequency}
                onChange={(e) => set({ visitFrequency: e.target.value })}
              />
            </Field>
            <div>
              <div className="mb-1 text-xs text-slate-500">Visiting Days</div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <label key={d} className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={form.visitingDays.includes(d)}
                      onChange={() => toggleDay(d)}
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Terms Of Payment">
              <DistInput
                value={form.termsOfPayment}
                onChange={(e) => set({ termsOfPayment: e.target.value })}
              />
            </Field>
            <Field label="Route">
              <DistSelect value={form.routeId} onChange={(e) => set({ routeId: e.target.value })}>
                <option value="">—</option>
                {lookups.routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </DistSelect>
            </Field>
            <Field label="Salesman">
              <DistSelect
                value={form.salesmanEmployeeId}
                onChange={(e) => set({ salesmanEmployeeId: e.target.value })}
              >
                <option value="">—</option>
                {lookups.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeCode} — {e.name}
                  </option>
                ))}
              </DistSelect>
            </Field>
            <Field label="Price level">
              <DistSelect value={form.priceLevel} onChange={(e) => set({ priceLevel: e.target.value })}>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="dealer">Dealer</option>
              </DistSelect>
            </Field>
            <Field label="Default discount %">
              <DistInput
                type="number"
                value={form.discountPct}
                onChange={(e) => set({ discountPct: e.target.value })}
              />
            </Field>

            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Licenses</div>
              <CheckRow
                checked={form.license9Enabled}
                onChange={(v) => set({ license9Enabled: v })}
                label="License 9 No"
              >
                <DistInput
                  className="min-w-[10rem] flex-1"
                  disabled={!form.license9Enabled}
                  value={form.license9No}
                  onChange={(e) => set({ license9No: e.target.value })}
                />
                <DistInput
                  type="date"
                  disabled={!form.license9Enabled}
                  value={form.license9Expiry}
                  onChange={(e) => set({ license9Expiry: e.target.value })}
                />
              </CheckRow>
              <CheckRow
                checked={form.license10Enabled}
                onChange={(v) => set({ license10Enabled: v })}
                label="License 10 No"
              >
                <DistInput
                  className="min-w-[10rem] flex-1"
                  disabled={!form.license10Enabled}
                  value={form.license10No}
                  onChange={(e) => set({ license10No: e.target.value })}
                />
                <DistInput
                  type="date"
                  disabled={!form.license10Enabled}
                  value={form.license10Expiry}
                  onChange={(e) => set({ license10Expiry: e.target.value })}
                />
              </CheckRow>
              <CheckRow
                checked={form.license11Enabled}
                onChange={(v) => set({ license11Enabled: v })}
                label="License 11 No"
              >
                <DistInput
                  className="min-w-[10rem] flex-1"
                  disabled={!form.license11Enabled}
                  value={form.license11No}
                  onChange={(e) => set({ license11No: e.target.value })}
                />
                <DistInput
                  type="date"
                  disabled={!form.license11Enabled}
                  value={form.license11Expiry}
                  onChange={(e) => set({ license11Expiry: e.target.value })}
                />
              </CheckRow>
            </div>
            <Field label="Adv. Tax Type">
              <DistSelect value={form.advTaxType} onChange={(e) => set({ advTaxType: e.target.value })}>
                <option>FILER</option>
                <option>NON-FILER</option>
                <option>EXEMPT</option>
              </DistSelect>
            </Field>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.isFocCustomer}
                onChange={(e) => set({ isFocCustomer: e.target.checked })}
              />
              Is FOC Customer
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.canDeductTax}
                onChange={(e) => set({ canDeductTax: e.target.checked })}
              />
              Can Deduct Tax
            </label>
            <Field label="Tax%">
              <DistInput
                type="number"
                value={form.taxPct}
                onChange={(e) => set({ taxPct: e.target.value })}
              />
            </Field>
            <Field label="Tax notes">
              <DistInput value={form.taxInfo} onChange={(e) => set({ taxInfo: e.target.value })} />
            </Field>
            <Field label="Image URL">
              <DistInput
                value={form.imageUrl}
                onChange={(e) => set({ imageUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
            <div className="flex min-h-[10rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-900/50">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="max-h-40 max-w-full object-contain" />
              ) : (
                "No image data"
              )}
            </div>
            <Field label="Business name">
              <DistInput
                value={form.businessName}
                onChange={(e) => set({ businessName: e.target.value })}
              />
            </Field>
          </div>
        </div>
      ) : null}

      {tab === "discount" ? (
        <Field label="Discount policy notes / rules">
          <textarea
            className="min-h-[12rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.discountPolicyNotes}
            onChange={(e) => set({ discountPolicyNotes: e.target.value })}
            placeholder="Company-wise or slab discount rules…"
          />
        </Field>
      ) : null}

      {tab === "bonus" ? (
        <Field label="Bonus policy notes / schemes">
          <textarea
            className="min-h-[12rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.bonusPolicyNotes}
            onChange={(e) => set({ bonusPolicyNotes: e.target.value })}
            placeholder="Buy X get Y, company bonuses…"
          />
        </Field>
      ) : null}

      {tab === "others" ? (
        <Field label="Other notes">
          <textarea
            className="min-h-[12rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.othersNotes}
            onChange={(e) => set({ othersNotes: e.target.value })}
          />
        </Field>
      ) : null}

      {tab === "companyCredit" ? (
        <Field label="Company-wise credit limits">
          <textarea
            className="min-h-[12rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.companyCreditLimitsNotes}
            onChange={(e) => set({ companyCreditLimitsNotes: e.target.value })}
            placeholder="One line per manufacturer / company credit ceiling…"
          />
        </Field>
      ) : null}

      {tab === "billToBill" ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          Bill-to-bill invoice ledger opens from the customer detail page after save (outstanding,
          aging, collections).
        </p>
      ) : null}

      {tab === "companyIds" ? (
        <Field label="External / company IDs map">
          <textarea
            className="min-h-[10rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.companyIdsNotes}
            onChange={(e) => set({ companyIdsNotes: e.target.value })}
            placeholder="Manufacturer code mappings for this trade customer…"
          />
        </Field>
      ) : null}

      {tab === "history" ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          Master change history is written to the audit log on every Save. Open the customer detail
          drawer for ledger activity.
        </p>
      ) : null}

      {tab === "location" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Latitude">
            <DistInput value={form.locationLat} onChange={(e) => set({ locationLat: e.target.value })} />
          </Field>
          <Field label="Longitude">
            <DistInput value={form.locationLng} onChange={(e) => set({ locationLng: e.target.value })} />
          </Field>
          <Field label="Location notes" className="sm:col-span-2">
            <textarea
              className="min-h-[6rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={form.locationNotes}
              onChange={(e) => set({ locationNotes: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {tab === "blockSales" ? (
        <Field label="Block sales rules / reasons">
          <textarea
            className="min-h-[10rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={form.blockSalesNotes}
            onChange={(e) => set({ blockSalesNotes: e.target.value })}
            placeholder="Blocked companies, SKUs, or reasons…"
          />
        </Field>
      ) : null}
    </div>
  );
}
