import {
  DEFAULT_BILL_RECEIPT_FIELDS,
  defaultBillPrintSettingsFor,
  newBillCustomLine,
  normalizeBillPrintSettings,
  type BillPrintSettings,
} from "./billPrintSettings";
import {
  printScopedKey,
  readScopedMapEntry,
  resolvePrintSystemId,
} from "./printSystemScope";

export type BillPrintTemplate = {
  id: string;
  name: string;
  settings: BillPrintSettings;
  updatedAt: string;
};

export type BillPrintStarterTemplate = {
  name: string;
  /** Short hint shown under the starter button. */
  description: string;
  settings: BillPrintSettings;
};

export const BILL_PRINT_TEMPLATES_CHANGED_EVENT = "pops-bill-print-templates-changed";

const STORAGE_KEY = "pops-bill-print-templates-v1";
const MAX_TEMPLATES = 8;

type Store = Record<string, BillPrintTemplate[]>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store, branchCode: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(
    new CustomEvent(BILL_PRINT_TEMPLATES_CHANGED_EVENT, { detail: { branchCode } }),
  );
}

function newTemplateId(): string {
  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadBillPrintTemplates(
  branchCode: string | undefined,
  systemId?: string | null | undefined,
): BillPrintTemplate[] {
  if (!branchCode) return [];
  const store = readStore();
  const { value, scopedKey } = readScopedMapEntry(store, branchCode, systemId);
  const list = value ?? [];
  // Migrate restaurant-family legacy list into scoped key once.
  if (value && scopedKey && !store[scopedKey]) {
    store[scopedKey] = list;
    writeStore(store, branchCode);
  }
  return list
    .map((row) => ({
      id: String(row.id),
      name: String(row.name || "Template").trim().slice(0, 40) || "Template",
      settings: normalizeBillPrintSettings(row.settings ?? {}),
      updatedAt: String(row.updatedAt || new Date().toISOString()),
    }))
    .slice(0, MAX_TEMPLATES);
}

export function saveBillPrintTemplate(
  branchCode: string,
  name: string,
  settings: BillPrintSettings,
  existingId?: string,
  systemId?: string | null | undefined,
): BillPrintTemplate {
  const store = readStore();
  const key = printScopedKey(branchCode, systemId);
  const current = store[key] ?? readScopedMapEntry(store, branchCode, systemId).value ?? [];
  const trimmed = name.trim().slice(0, 40) || "Template";
  const normalized = normalizeBillPrintSettings(settings);
  const now = new Date().toISOString();

  if (existingId) {
    const next = current.map((row) =>
      row.id === existingId
        ? { ...row, name: trimmed, settings: normalized, updatedAt: now }
        : row,
    );
    store[key] = next.slice(0, MAX_TEMPLATES);
    writeStore(store, branchCode);
    const found = next.find((row) => row.id === existingId);
    if (found) return found;
  }

  if (current.length >= MAX_TEMPLATES) {
    throw new Error(`You can save up to ${MAX_TEMPLATES} bill templates. Delete one first.`);
  }

  const created: BillPrintTemplate = {
    id: newTemplateId(),
    name: trimmed,
    settings: normalized,
    updatedAt: now,
  };
  store[key] = [...current, created];
  writeStore(store, branchCode);
  return created;
}

export function deleteBillPrintTemplate(
  branchCode: string,
  templateId: string,
  systemId?: string | null | undefined,
): void {
  const store = readStore();
  const key = printScopedKey(branchCode, systemId);
  const current = store[key] ?? readScopedMapEntry(store, branchCode, systemId).value ?? [];
  store[key] = current.filter((row) => row.id !== templateId);
  writeStore(store, branchCode);
}

export function getBillPrintTemplate(
  branchCode: string | undefined,
  templateId: string,
  systemId?: string | null | undefined,
): BillPrintTemplate | null {
  return loadBillPrintTemplates(branchCode, systemId).find((row) => row.id === templateId) ?? null;
}

function restaurantStarterTemplates(): BillPrintStarterTemplate[] {
  return [
    {
      name: "Cafe Receipt",
      description: "Centered brand · RECEIPT · thank-you footer (cafe / kitchen & bar style)",
      settings: normalizeBillPrintSettings({
        documentTitle: "RECEIPT",
        headerSubtitle: "Your address · Tel · www.yoursite.com",
        footerText: "Thank you!",
        footerSecondaryText: "WE APPRECIATE YOUR VISIT",
        layout: "compact",
        headerAlign: "center",
        baseFontSize: 13,
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          printerName: false,
          headerSubtitle: true,
          footerSecondary: true,
          discount: true,
          delivery: false,
        },
        customLines: [
          newBillCustomLine({
            id: "cafe-open",
            text: "Dine-in · Takeaway · Delivery",
            bold: false,
            zone: "header",
            enabled: true,
            fontSize: 11,
          }),
        ],
      }),
    },
    {
      name: "Bakery Slip",
      description: "Simple Item×Qty · Price · Items/Qty · no-return note",
      settings: normalizeBillPrintSettings({
        documentTitle: "BILL",
        headerSubtitle: "Address · Tel",
        footerText: "NO RETURN. NO EXCHANGE.",
        footerSecondaryText: "",
        layout: "compact",
        headerAlign: "center",
        baseFontSize: 12,
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          orderType: false,
          tableLabel: false,
          waiterName: false,
          printerName: false,
          service: false,
          tax: false,
          delivery: false,
          discount: false,
          headerSubtitle: true,
          footerSecondary: false,
          billRef: true,
        },
        customLines: [
          newBillCustomLine({
            id: "bakery-pay",
            text: "Payment: Cash / Card",
            bold: false,
            zone: "afterItems",
            enabled: true,
            fontSize: 11,
          }),
        ],
      }),
    },
    {
      name: "Restaurant Tax Bill",
      description: "GST-style header · Order/Bill/Table · ITEM QTY AMT (dining)",
      settings: normalizeBillPrintSettings({
        documentTitle: "TAX INVOICE",
        headerSubtitle: "Address · Phone · NTN / GSTIN",
        footerText: "Thank you — visit again",
        footerSecondaryText: "Prices include applicable taxes",
        layout: "standard",
        headerAlign: "center",
        baseFontSize: 13,
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          printerName: false,
          headerSubtitle: true,
          footerSecondary: true,
          billRef: true,
          waiterName: true,
          tableLabel: true,
          service: true,
          tax: true,
        },
        customLines: [
          newBillCustomLine({
            id: "rest-pax",
            text: "Pax: __",
            bold: false,
            zone: "beforeItems",
            enabled: false,
            fontSize: 11,
          }),
        ],
      }),
    },
    {
      name: "Classic Tax Invoice",
      description: "Standard Pakistani POS invoice",
      settings: normalizeBillPrintSettings({
        documentTitle: "Tax Invoice",
        footerText: "Thank you — visit again",
        layout: "standard",
        headerAlign: "center",
      }),
    },
    {
      name: "Compact Thermal",
      description: "Tight 58mm roll — fewer fields",
      settings: normalizeBillPrintSettings({
        documentTitle: "Receipt",
        layout: "compact",
        baseFontSize: 11,
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          printerName: false,
          headerSubtitle: false,
          footerSecondary: false,
          waiterName: false,
        },
      }),
    },
    {
      name: "Guest Check",
      description: "Pay-later slip",
      settings: normalizeBillPrintSettings({
        documentTitle: "Guest Check",
        footerText: "Please pay at the counter",
        customLines: [],
      }),
    },
    {
      name: "Takeaway Slip",
      description: "Pickup-ready takeaway ticket",
      settings: normalizeBillPrintSettings({
        documentTitle: "Takeaway",
        footerText: "Collect your order · Thank you",
        layout: "compact",
        customLines: [
          newBillCustomLine({
            id: "tw-ready",
            text: "Order ready for pickup",
            bold: true,
            zone: "beforeItems",
            enabled: true,
            fontSize: 13,
          }),
        ],
      }),
    },
  ];
}

function retailFields(
  base: ReturnType<typeof defaultBillPrintSettingsFor>,
  extra?: Partial<typeof DEFAULT_BILL_RECEIPT_FIELDS>,
) {
  return {
    ...base.fields,
    service: false,
    delivery: false,
    ...extra,
  };
}

function pharmacyStarterTemplates(
  base: ReturnType<typeof defaultBillPrintSettingsFor>,
): BillPrintStarterTemplate[] {
  return [
    {
      name: "Pharmacy Invoice",
      description: "Standard Rx / counter invoice",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "PHARMACY INVOICE",
        footerText: "Thank you — get well soon",
        footerSecondaryText: "Keep medicines away from children",
        fields: retailFields(base, { documentTitle: true }),
      }),
    },
    {
      name: "Pharmacy Compact",
      description: "Tight 58mm counter thermal",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "INVOICE",
        layout: "compact",
        baseFontSize: 12,
        fields: retailFields(base, { headerSubtitle: false, footerSecondary: false }),
      }),
    },
    {
      name: "Employee / Instation",
      description: "Staff or ward issue slip",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "INSTATION ISSUE",
        footerText: "For official use only",
        fields: retailFields(base, { documentTitle: true, orderType: true }),
      }),
    },
    {
      name: "Outstation Sale",
      description: "Outstation / credit counter sale",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "OUTSTATION SALE",
        footerText: "Payment as per credit terms",
        fields: retailFields(base, { documentTitle: true, orderType: true, notes: true }),
        customLines: [
          newBillCustomLine({
            id: "ph-out",
            text: "Channel: Outstation",
            bold: true,
            zone: "header",
            enabled: true,
            fontSize: 11,
          }),
        ],
      }),
    },
    {
      name: "Tax Invoice (Rx)",
      description: "GST / NTN style pharmacy invoice",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "TAX INVOICE",
        headerSubtitle: "Address · Phone · NTN",
        layout: "standard",
        footerSecondaryText: "Prices include applicable taxes",
        fields: retailFields(base, { documentTitle: true, tax: true, headerSubtitle: true }),
      }),
    },
    {
      name: "Return / Refund slip",
      description: "Medicine return acknowledgement",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "RETURN SLIP",
        footerText: "Refund / exchange as per policy",
        layout: "compact",
        fields: retailFields(base, { documentTitle: true, discount: true }),
      }),
    },
    {
      name: "Batch detail slip",
      description: "Shows batch / notes for dispensing",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "DISPENSE SLIP",
        footerText: "Check expiry before use",
        fields: retailFields(base, { documentTitle: true, notes: true, waiterName: true }),
        customLines: [
          newBillCustomLine({
            id: "ph-batch",
            text: "Batch & expiry on item lines",
            bold: false,
            zone: "beforeItems",
            enabled: true,
            fontSize: 11,
          }),
        ],
      }),
    },
  ];
}

function storeStarterTemplates(
  base: ReturnType<typeof defaultBillPrintSettingsFor>,
): BillPrintStarterTemplate[] {
  return [
    {
      name: "Retail Receipt",
      description: "Walk-in sales — till / cashier",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "SALES RECEIPT",
        footerText: "Thank you for shopping!",
        fields: retailFields(base, { tableLabel: false }),
      }),
    },
    {
      name: "Store Tax Invoice",
      description: "GST-style retail invoice",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "TAX INVOICE",
        layout: "standard",
        headerSubtitle: "Address · Phone · NTN",
        fields: retailFields(base, { documentTitle: true, tax: true, headerSubtitle: true }),
      }),
    },
    {
      name: "No Return Slip",
      description: "Sale with no-return footer",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "SALE",
        footerText: "NO RETURN. NO EXCHANGE.",
        fields: retailFields(base),
      }),
    },
    {
      name: "Credit Sale",
      description: "Udhaar / credit customer slip",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "CREDIT SALE",
        footerText: "Amount due as per account",
        fields: retailFields(base, { documentTitle: true, notes: true, orderType: true }),
      }),
    },
    {
      name: "Compact 58mm",
      description: "Tight thermal for small rolls",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "RECEIPT",
        layout: "compact",
        baseFontSize: 11,
        fields: retailFields(base, { headerSubtitle: false, footerSecondary: false }),
      }),
    },
    {
      name: "Wholesale counter",
      description: "Bulk / carton style sale",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "WHOLESALE SALE",
        footerText: "Goods checked and received",
        layout: "standard",
        fields: retailFields(base, { documentTitle: true, tax: true }),
      }),
    },
    {
      name: "Exchange slip",
      description: "Product exchange acknowledgement",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "EXCHANGE",
        footerText: "Exchange within 7 days with receipt",
        layout: "compact",
        fields: retailFields(base, { documentTitle: true, discount: false }),
      }),
    },
  ];
}

function distributionStarterTemplates(
  base: ReturnType<typeof defaultBillPrintSettingsFor>,
): BillPrintStarterTemplate[] {
  return [
    {
      name: "Booking Invoice",
      description: "Wholesale booking / order invoice",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "BOOKING INVOICE",
        footerText: "Goods once sold are not returnable",
        fields: retailFields(base, { documentTitle: true, tableLabel: false }),
      }),
    },
    {
      name: "Delivery challan",
      description: "Dispatch / delivery reference",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "DELIVERY CHALLAN",
        layout: "compact",
        footerText: "Please check goods on delivery",
        fields: retailFields(base, { documentTitle: true, tax: false }),
      }),
    },
    {
      name: "Tax Invoice (Dist)",
      description: "GST / NTN wholesale invoice",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "TAX INVOICE",
        headerSubtitle: "Address · Phone · NTN / STRN",
        layout: "standard",
        footerSecondaryText: "Prices exclusive of freight unless noted",
        fields: retailFields(base, { documentTitle: true, tax: true, headerSubtitle: true }),
      }),
    },
    {
      name: "Order confirmation",
      description: "Booking acknowledgement before dispatch",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "ORDER CONFIRMATION",
        footerText: "Subject to stock availability",
        fields: retailFields(base, { documentTitle: true, notes: true }),
      }),
    },
    {
      name: "Credit note slip",
      description: "Return / credit note thermal",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "CREDIT NOTE",
        footerText: "Adjusted against outstanding",
        layout: "compact",
        fields: retailFields(base, { documentTitle: true, discount: true }),
      }),
    },
    {
      name: "Compact booking",
      description: "58mm booking desk slip",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "BOOKING",
        layout: "compact",
        baseFontSize: 12,
        fields: retailFields(base, { headerSubtitle: false, footerSecondary: false }),
      }),
    },
    {
      name: "Trade customer slip",
      description: "Named trade account invoice",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "TRADE INVOICE",
        footerText: "Thank you for your business",
        fields: retailFields(base, { documentTitle: true, notes: true, waiterName: true }),
        customLines: [
          newBillCustomLine({
            id: "dist-trade",
            text: "Trade customer account",
            bold: false,
            zone: "header",
            enabled: true,
            fontSize: 11,
          }),
        ],
      }),
    },
  ];
}

function educationStarterTemplates(
  base: ReturnType<typeof defaultBillPrintSettingsFor>,
): BillPrintStarterTemplate[] {
  return [
    {
      name: "Fee Receipt",
      description: "Standard tuition fee receipt",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "FEE RECEIPT",
        footerText: "Computer-generated — no signature required",
        fields: retailFields(base, { documentTitle: true, tax: false, orderType: false }),
      }),
    },
    {
      name: "Admission fee",
      description: "New admission / registration fee",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "ADMISSION FEE",
        footerText: "Welcome to our institution",
        fields: retailFields(base, { documentTitle: true, notes: true }),
      }),
    },
    {
      name: "Exam fee slip",
      description: "Examination / board fee",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "EXAM FEE",
        footerText: "Non-refundable",
        layout: "compact",
        fields: retailFields(base, { documentTitle: true }),
      }),
    },
    {
      name: "Transport fee",
      description: "Van / bus fee receipt",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "TRANSPORT FEE",
        footerText: "Valid for the stated month",
        fields: retailFields(base, { documentTitle: true, notes: true }),
      }),
    },
    {
      name: "Fine / misc receipt",
      description: "Library fine or miscellaneous",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "MISC RECEIPT",
        footerText: "Thank you",
        layout: "compact",
        fields: retailFields(base, { documentTitle: true }),
      }),
    },
    {
      name: "Installment receipt",
      description: "Partial fee / installment",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "INSTALLMENT RECEIPT",
        footerText: "Balance as per fee ledger",
        fields: retailFields(base, { documentTitle: true, discount: true, notes: true }),
      }),
    },
    {
      name: "Compact fee slip",
      description: "Short thermal fee acknowledgement",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "FEE",
        layout: "compact",
        baseFontSize: 12,
        fields: retailFields(base, {
          documentTitle: true,
          headerSubtitle: false,
          footerSecondary: false,
        }),
      }),
    },
  ];
}

function iceCreamStarterTemplates(
  base: ReturnType<typeof defaultBillPrintSettingsFor>,
): BillPrintStarterTemplate[] {
  return [
    {
      name: "Parlour Receipt",
      description: "Standard scoop shop receipt",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "RECEIPT",
        footerText: "Thank you — enjoy!",
        fields: { ...base.fields, service: false, tableLabel: true },
        customLines: [
          newBillCustomLine({
            id: "scoop-hint",
            text: "Dine-in · Takeaway",
            bold: false,
            zone: "header",
            enabled: true,
            fontSize: 11,
          }),
        ],
      }),
    },
    {
      name: "Takeaway Scoop Slip",
      description: "Pickup-ready parlour ticket",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "TAKEAWAY",
        footerText: "Collect your order · Thank you",
        layout: "compact",
        fields: { ...base.fields, service: false },
      }),
    },
    {
      name: "Compact Thermal",
      description: "Tight 58mm parlour roll",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "Receipt",
        layout: "compact",
        baseFontSize: 11,
        fields: { ...base.fields, service: false, headerSubtitle: false },
      }),
    },
    {
      name: "Dine-in parlour",
      description: "Table / station dine-in slip",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "DINE-IN",
        footerText: "Enjoy your scoops!",
        fields: { ...base.fields, service: false, tableLabel: true, orderType: true },
      }),
    },
    {
      name: "Party / catering",
      description: "Bulk order / party pack",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "PARTY ORDER",
        footerText: "Ready time as confirmed",
        layout: "standard",
        fields: { ...base.fields, service: false, notes: true },
      }),
    },
    {
      name: "Tax Invoice (Parlour)",
      description: "GST-style parlour invoice",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "TAX INVOICE",
        headerSubtitle: "Address · Phone",
        layout: "standard",
        fields: { ...base.fields, service: false, tax: true, documentTitle: true },
      }),
    },
    {
      name: "Delivery scoop slip",
      description: "Rider / delivery order",
      settings: normalizeBillPrintSettings({
        ...base,
        documentTitle: "DELIVERY",
        footerText: "Handle with care — keep frozen",
        layout: "compact",
        fields: { ...base.fields, service: false, delivery: true, notes: true },
      }),
    },
  ];
}

/**
 * Built-in layouts per business system (~7 each).
 * Cafe / Guest Check / Kitchen-style starters only for restaurant.
 * Never cross-mix designs across systems.
 */
export function starterBillPrintTemplates(
  systemId?: string | null | undefined,
): BillPrintStarterTemplate[] {
  const sys = resolvePrintSystemId(systemId);
  const base = defaultBillPrintSettingsFor(sys);

  if (sys === "pharmacy") return pharmacyStarterTemplates(base);
  if (sys === "general-store") return storeStarterTemplates(base);
  if (sys === "distribution") return distributionStarterTemplates(base);
  if (sys === "education") return educationStarterTemplates(base);
  if (sys === "ice-cream-bar") return iceCreamStarterTemplates(base);
  return restaurantStarterTemplates();
}
