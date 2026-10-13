import type { BusinessSystemId } from "../../lib/businessSystems";
import {
  printScopedKey,
  readScopedMapEntry,
  resolvePrintSystemId,
} from "./printSystemScope";

export type BillReceiptLayout = "standard" | "compact";
export type BillHeaderAlign = "center" | "left";

/** Legacy placement hint — new layouts prefer `blockOrder`. */
export type BillCustomLineZone = "header" | "beforeItems" | "afterItems" | "footer";

export type BillCustomLine = {
  id: string;
  text: string;
  bold: boolean;
  zone: BillCustomLineZone;
  enabled: boolean;
  /** Absolute px; 0 = inherit from base receipt scale. */
  fontSize: number;
  /** Hex color e.g. #111827; empty = theme default. */
  color: string;
};

export type BillReceiptFields = {
  branchName: boolean;
  headerSubtitle: boolean;
  documentTitle: boolean;
  orderRef: boolean;
  orderType: boolean;
  tableLabel: boolean;
  billRef: boolean;
  waiterName: boolean;
  printerName: boolean;
  notes: boolean;
  timestamp: boolean;
  branchCode: boolean;
  itemHeaders: boolean;
  itemQty: boolean;
  itemAmount: boolean;
  subtotal: boolean;
  discount: boolean;
  service: boolean;
  tax: boolean;
  delivery: boolean;
  total: boolean;
  footer: boolean;
  footerSecondary: boolean;
};

/** Built-in receipt sections that can be reordered on the canvas. */
export const BILL_SYSTEM_BLOCKS = [
  "branchName",
  "headerSubtitle",
  "documentTitle",
  "meta",
  "notes",
  "timestamp",
  "items",
  "totals",
  "footer",
  "footerSecondary",
] as const;

export type BillSystemBlockId = (typeof BILL_SYSTEM_BLOCKS)[number];

export type BillBlockStyle = {
  bold: boolean;
  /** 0 = use default scaled size for that block. */
  fontSize: number;
  /** Hex color e.g. #111827; empty = theme default for that block. */
  color: string;
};

/** Preset ink colors for the receipt editor. */
export const BILL_TEXT_COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Black", value: "#111827" },
  { label: "Charcoal", value: "#374151" },
  { label: "Gray", value: "#6b7280" },
  { label: "Amber", value: "#b45309" },
  { label: "Red", value: "#b91c1c" },
  { label: "Green", value: "#047857" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Purple", value: "#6d28d9" },
];

export const DEFAULT_BLOCK_TEXT_COLOR = "#111827";

export type BillPrintSettings = {
  baseFontSize: number;
  layout: BillReceiptLayout;
  headerAlign: BillHeaderAlign;
  /** Overrides branch name on the receipt when set. */
  headerBusinessName: string;
  /** Optional tagline under the business name. */
  headerSubtitle: string;
  documentTitle: string;
  footerText: string;
  /** Optional second footer line (phone, address, NTN, etc.). */
  footerSecondaryText: string;
  fields: BillReceiptFields;
  /** Extra editable lines — drag/reorder, bold, size. */
  customLines: BillCustomLine[];
  /** Print order: system block ids + custom line ids. */
  blockOrder: string[];
  /** Per-block bold / font size (system blocks). Custom lines store style on themselves. */
  blockStyles: Record<string, BillBlockStyle>;
};

export const DEFAULT_BILL_RECEIPT_FIELDS: BillReceiptFields = {
  branchName: true,
  headerSubtitle: true,
  /** Hidden by default — thermal slips use business name only (no "TAX INVOICE"). */
  documentTitle: false,
  orderRef: true,
  orderType: true,
  tableLabel: true,
  billRef: true,
  waiterName: true,
  printerName: false,
  notes: true,
  timestamp: true,
  /** Unused on print — company name must not repeat on the date line. */
  branchCode: false,
  itemHeaders: true,
  itemQty: true,
  itemAmount: true,
  subtotal: true,
  discount: true,
  service: true,
  tax: true,
  delivery: true,
  total: true,
  footer: true,
  footerSecondary: true,
};

export const DEFAULT_BILL_BLOCK_ORDER: string[] = [...BILL_SYSTEM_BLOCKS];

export const BILL_SYSTEM_BLOCK_LABELS: Record<BillSystemBlockId, string> = {
  branchName: "Business name",
  headerSubtitle: "Subtitle",
  documentTitle: "Document title",
  meta: "Order details",
  notes: "Notes",
  timestamp: "Date & time",
  items: "Items table",
  totals: "Totals",
  footer: "Footer message",
  footerSecondary: "Footer secondary",
};

export const DEFAULT_BILL_PRINT_SETTINGS: BillPrintSettings = {
  baseFontSize: 18,
  layout: "compact",
  headerAlign: "center",
  headerBusinessName: "",
  headerSubtitle: "",
  documentTitle: "TAX INVOICE",
  footerText: "THANK YOU — VISIT AGAIN",
  footerSecondaryText: "",
  fields: DEFAULT_BILL_RECEIPT_FIELDS,
  customLines: [],
  blockOrder: [...DEFAULT_BILL_BLOCK_ORDER],
  blockStyles: {},
};

/** Per-system receipt standards — never share restaurant defaults with retail systems. */
export function defaultBillPrintSettingsFor(
  systemId?: string | null | undefined,
): BillPrintSettings {
  const sys = resolvePrintSystemId(systemId);
  const clone = (partial: Partial<BillPrintSettings> & { fields?: BillReceiptFields }): BillPrintSettings =>
    normalizeBillPrintSettings({
      ...DEFAULT_BILL_PRINT_SETTINGS,
      ...partial,
      fields: partial.fields ?? DEFAULT_BILL_RECEIPT_FIELDS,
    });

  switch (sys as BusinessSystemId) {
    case "pharmacy":
      return clone({
        documentTitle: "PHARMACY INVOICE",
        footerText: "Thank you — get well soon",
        footerSecondaryText: "Medicines once sold are not returnable unless defective",
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          tableLabel: true,
          waiterName: true,
          service: false,
          delivery: false,
          orderType: true,
          documentTitle: true,
        },
      });
    case "general-store":
      return clone({
        documentTitle: "SALES RECEIPT",
        footerText: "Thank you for shopping!",
        footerSecondaryText: "",
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          tableLabel: false,
          waiterName: true,
          service: false,
          delivery: false,
          orderType: true,
          documentTitle: true,
        },
      });
    case "distribution":
      return clone({
        documentTitle: "BOOKING / INVOICE",
        footerText: "Thank you for your business",
        footerSecondaryText: "",
        layout: "standard",
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          tableLabel: false,
          waiterName: true,
          service: false,
          delivery: false,
          orderType: true,
          documentTitle: true,
        },
      });
    case "education":
      return clone({
        documentTitle: "FEE RECEIPT",
        footerText: "This is a computer-generated receipt",
        footerSecondaryText: "",
        layout: "standard",
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          tableLabel: false,
          waiterName: true,
          service: false,
          delivery: false,
          discount: true,
          tax: false,
          orderType: false,
          documentTitle: true,
        },
      });
    case "ice-cream-bar":
      return clone({
        documentTitle: "RECEIPT",
        footerText: "Thank you — enjoy!",
        footerSecondaryText: "",
        fields: {
          ...DEFAULT_BILL_RECEIPT_FIELDS,
          tableLabel: true,
          service: false,
          delivery: true,
          documentTitle: false,
        },
      });
    default:
      return {
        ...DEFAULT_BILL_PRINT_SETTINGS,
        fields: { ...DEFAULT_BILL_RECEIPT_FIELDS },
      };
  }
}

export const BILL_CUSTOM_LINE_ZONE_LABELS: Record<BillCustomLineZone, string> = {
  header: "After header",
  beforeItems: "Before items",
  afterItems: "After items",
  footer: "In footer",
};

export const BILL_LINE_FONT_MIN = 10;
export const BILL_LINE_FONT_MAX = 35;

export function newBillCustomLine(
  partial?: Partial<Omit<BillCustomLine, "id">> & { id?: string },
): BillCustomLine {
  return {
    id: partial?.id ?? `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text: partial?.text ?? "New line",
    bold: partial?.bold ?? false,
    zone: partial?.zone ?? "footer",
    enabled: partial?.enabled ?? true,
    fontSize: clampLineFont(partial?.fontSize ?? 0),
    color: normalizeHexColor(partial?.color ?? ""),
  };
}

export function isBillSystemBlock(id: string): id is BillSystemBlockId {
  return (BILL_SYSTEM_BLOCKS as readonly string[]).includes(id);
}

/** Enabled custom lines for a print zone (legacy zone helpers). */
export function customLinesForZone(
  settings: BillPrintSettings | null | undefined,
  zone: BillCustomLineZone,
): BillCustomLine[] {
  return (settings?.customLines ?? []).filter(
    (line) => line.enabled && line.zone === zone && line.text.trim().length > 0,
  );
}

export function getBlockStyle(
  settings: BillPrintSettings,
  blockId: string,
): BillBlockStyle {
  const raw = settings.blockStyles?.[blockId];
  return {
    bold: Boolean(raw?.bold),
    fontSize: clampLineFont(raw?.fontSize ?? 0),
    color: normalizeHexColor(raw?.color ?? ""),
  };
}

export function resolveBlockFontSize(
  settings: BillPrintSettings,
  blockId: string,
  fallbackPx: number,
): number {
  const custom = settings.customLines.find((line) => line.id === blockId);
  if (custom) {
    return custom.fontSize > 0 ? custom.fontSize : fallbackPx;
  }
  const style = getBlockStyle(settings, blockId);
  return style.fontSize > 0 ? style.fontSize : fallbackPx;
}

/** Resolve ink color for a block/line; empty means use CSS default for that element. */
export function resolveBlockColor(
  settings: BillPrintSettings,
  blockId: string,
  fallback = "",
): string {
  const custom = settings.customLines.find((line) => line.id === blockId);
  if (custom) {
    return custom.color || fallback;
  }
  const style = getBlockStyle(settings, blockId);
  return style.color || fallback;
}

/** Accept #RGB / #RRGGBB; return normalized #rrggbb or "". */
export function normalizeHexColor(value: string | undefined | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const short = /^#([0-9a-fA-F]{3})$/.exec(raw);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(raw);
  if (full) return `#${full[1]}`.toLowerCase();
  return "";
}

export const BILL_PRINT_SETTINGS_CHANGED_EVENT = "pops-bill-print-settings-changed";

const STORAGE_KEY = "pops-bill-print-settings-v2";
const ACTIVE_TEMPLATE_KEY = "pops-bill-print-active-template-v1";

export const BILL_FONT_SIZE_MIN = 10;
export const BILL_FONT_SIZE_MAX = 35;

export const BILL_FIELD_GROUPS: { label: string; keys: (keyof BillReceiptFields)[] }[] = [
  {
    label: "Header",
    keys: ["branchName", "headerSubtitle", "documentTitle"],
  },
  {
    label: "Order details",
    keys: ["orderRef", "orderType", "tableLabel", "billRef", "waiterName", "printerName", "notes"],
  },
  {
    label: "Footer meta",
    keys: ["timestamp"],
  },
  {
    label: "Line items",
    keys: ["itemHeaders", "itemQty", "itemAmount"],
  },
  {
    label: "Totals",
    keys: ["subtotal", "discount", "service", "tax", "delivery", "total"],
  },
  {
    label: "Closing",
    keys: ["footer", "footerSecondary"],
  },
];

/** Fields that belong only to restaurant / parlour receipts — hide elsewhere. */
const RESTAURANT_ONLY_BILL_FIELDS = new Set<keyof BillReceiptFields>([
  "service",
  "delivery",
]);

export function billFieldGroupsForSystem(
  systemId?: string | null | undefined,
): { label: string; keys: (keyof BillReceiptFields)[] }[] {
  const sys = resolvePrintSystemId(systemId);
  const restaurantFamily = sys === "restaurant" || sys === "ice-cream-bar";
  return BILL_FIELD_GROUPS.map((group) => {
    let keys = group.keys.filter((key) => key !== "branchCode" && key !== "printerName");
    if (!restaurantFamily) {
      keys = keys.filter((key) => !RESTAURANT_ONLY_BILL_FIELDS.has(key));
    }
    if (sys === "pharmacy") {
      // Station stays; rename via labels. No dine-in delivery/service.
      keys = keys.filter((key) => key !== "delivery" && key !== "service");
    }
    if (sys === "education") {
      keys = keys.filter(
        (key) => key !== "tableLabel" && key !== "orderType" && key !== "delivery" && key !== "service",
      );
    }
    if (sys === "distribution") {
      keys = keys.filter((key) => key !== "tableLabel" && key !== "delivery" && key !== "service");
    }
    if (sys === "general-store") {
      keys = keys.filter((key) => key !== "service" && key !== "delivery");
    }
    return { ...group, keys };
  }).filter((group) => group.keys.length > 0);
}

export const BILL_FIELD_LABELS: Record<keyof BillReceiptFields, string> = {
  branchName: "Business name",
  headerSubtitle: "Header subtitle",
  documentTitle: "Document title",
  orderRef: "Order #",
  orderType: "Order type",
  tableLabel: "Table / station",
  billRef: "Invoice #",
  waiterName: "Cashier / staff",
  printerName: "Printer",
  notes: "Notes",
  timestamp: "Date & time",
  branchCode: "Branch code (unused)",
  itemHeaders: "Column headers",
  itemQty: "Quantity column",
  itemAmount: "Amount column",
  subtotal: "Subtotal",
  discount: "Discount",
  service: "Service charge",
  tax: "Sales tax",
  delivery: "Delivery",
  total: "Grand total",
  footer: "Footer message",
  footerSecondary: "Footer secondary line",
};

/** Field labels that match the active ERP (no restaurant wording on pharmacy/store). */
export function billFieldLabelsForSystem(
  systemId?: string | null | undefined,
): Record<keyof BillReceiptFields, string> {
  const sys = resolvePrintSystemId(systemId);
  const base = { ...BILL_FIELD_LABELS };
  if (sys === "pharmacy") {
    return {
      ...base,
      orderRef: "Invoice #",
      orderType: "Channel",
      tableLabel: "Station / counter",
      billRef: "Rx / Invoice #",
      waiterName: "Pharmacist / staff",
    };
  }
  if (sys === "general-store") {
    return {
      ...base,
      orderRef: "Sale #",
      orderType: "Sale type",
      tableLabel: "Till / counter",
      billRef: "Invoice #",
      waiterName: "Cashier",
    };
  }
  if (sys === "distribution") {
    return {
      ...base,
      orderRef: "Booking #",
      orderType: "Doc type",
      tableLabel: "Desk",
      billRef: "Invoice #",
      waiterName: "Staff",
    };
  }
  if (sys === "education") {
    return {
      ...base,
      orderRef: "Receipt #",
      orderType: "Type",
      tableLabel: "Counter",
      billRef: "Fee receipt #",
      waiterName: "Staff",
    };
  }
  if (sys === "ice-cream-bar") {
    return {
      ...base,
      tableLabel: "Station",
      waiterName: "Cashier",
    };
  }
  return base;
}

function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BILL_PRINT_SETTINGS.baseFontSize;
  return Math.max(BILL_FONT_SIZE_MIN, Math.min(BILL_FONT_SIZE_MAX, Math.round(value)));
}

function clampLineFont(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(BILL_LINE_FONT_MIN, Math.min(BILL_LINE_FONT_MAX, Math.round(value)));
}

function normalizeFields(input: Partial<BillReceiptFields> | undefined): BillReceiptFields {
  const merged = { ...DEFAULT_BILL_RECEIPT_FIELDS, ...input };
  // Never reprint company name on the date line (legacy "branchCode" flag).
  merged.branchCode = false;
  return merged;
}

function normalizeCustomLines(input: unknown): BillCustomLine[] {
  if (!Array.isArray(input)) return [];
  const zones: BillCustomLineZone[] = ["header", "beforeItems", "afterItems", "footer"];
  return input
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Partial<BillCustomLine>;
      const zone = zones.includes(row.zone as BillCustomLineZone)
        ? (row.zone as BillCustomLineZone)
        : "footer";
      const text = String(row.text ?? "").slice(0, 120);
      // Drop signature underline lines — no longer used on receipts.
      if (/^\s*signature\s*:?\s*_+\s*$/i.test(text)) return null;
      return {
        id: String(row.id ?? `line-${index}`),
        text,
        bold: Boolean(row.bold),
        zone,
        enabled: row.enabled !== false,
        fontSize: clampLineFont(Number(row.fontSize ?? 0)),
        color: normalizeHexColor(row.color),
      } satisfies BillCustomLine;
    })
    .filter((line): line is BillCustomLine => Boolean(line))
    .slice(0, 24);
}

function zoneInsertIndex(order: string[], zone: BillCustomLineZone): number {
  if (zone === "header") {
    const i = order.indexOf("documentTitle");
    return i >= 0 ? i + 1 : 0;
  }
  if (zone === "beforeItems") {
    const i = order.indexOf("items");
    return i >= 0 ? i : order.length;
  }
  if (zone === "afterItems") {
    const i = order.indexOf("totals");
    return i >= 0 ? i : order.length;
  }
  const i = order.indexOf("footerSecondary");
  return i >= 0 ? i + 1 : order.length;
}

/** Merge system blocks + custom line ids into a stable print order. */
export function normalizeBlockOrder(
  orderInput: unknown,
  customLines: BillCustomLine[],
): string[] {
  const customIds = new Set(customLines.map((line) => line.id));
  const seen = new Set<string>();
  const order: string[] = [];

  const push = (id: string) => {
    if (!id || seen.has(id)) return;
    if (!isBillSystemBlock(id) && !customIds.has(id)) return;
    seen.add(id);
    order.push(id);
  };

  if (Array.isArray(orderInput)) {
    for (const raw of orderInput) push(String(raw));
  }

  for (const id of BILL_SYSTEM_BLOCKS) {
    if (!seen.has(id)) {
      const defIndex = DEFAULT_BILL_BLOCK_ORDER.indexOf(id);
      let insertAt = order.length;
      for (let i = defIndex + 1; i < DEFAULT_BILL_BLOCK_ORDER.length; i++) {
        const nextId = DEFAULT_BILL_BLOCK_ORDER[i];
        const found = order.indexOf(nextId);
        if (found >= 0) {
          insertAt = found;
          break;
        }
      }
      order.splice(insertAt, 0, id);
      seen.add(id);
    }
  }

  for (const line of customLines) {
    if (!seen.has(line.id)) {
      const at = zoneInsertIndex(order, line.zone);
      order.splice(at, 0, line.id);
      seen.add(line.id);
    }
  }

  return order;
}

function normalizeBlockStyles(input: unknown): Record<string, BillBlockStyle> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, BillBlockStyle> = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<BillBlockStyle>;
    out[key] = {
      bold: Boolean(row.bold),
      fontSize: clampLineFont(Number(row.fontSize ?? 0)),
      color: normalizeHexColor(row.color),
    };
  }
  return out;
}

function migrateLegacy(raw: unknown): Partial<BillPrintSettings> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  if ("fields" in obj || "layout" in obj || "customLines" in obj || "blockOrder" in obj) {
    return obj as Partial<BillPrintSettings>;
  }
  if ("baseFontSize" in obj) return { baseFontSize: obj.baseFontSize as number };
  return {};
}

export function normalizeBillPrintSettings(input: Partial<BillPrintSettings>): BillPrintSettings {
  const layout = input.layout === "compact" ? "compact" : "standard";
  const headerAlign = input.headerAlign === "left" ? "left" : "center";
  const headerBusinessName = (input.headerBusinessName ?? "").trim().slice(0, 64);
  const headerSubtitle = (input.headerSubtitle ?? "").trim().slice(0, 80);
  const documentTitle =
    (input.documentTitle ?? DEFAULT_BILL_PRINT_SETTINGS.documentTitle).trim() ||
    DEFAULT_BILL_PRINT_SETTINGS.documentTitle;
  const footerText =
    (input.footerText ?? DEFAULT_BILL_PRINT_SETTINGS.footerText).trim() ||
    DEFAULT_BILL_PRINT_SETTINGS.footerText;
  const footerSecondaryText = (input.footerSecondaryText ?? "").trim().slice(0, 120);
  const baseFontSize = clampFontSize(input.baseFontSize ?? DEFAULT_BILL_PRINT_SETTINGS.baseFontSize);
  const customLines = normalizeCustomLines(input.customLines);
  return {
    baseFontSize,
    layout,
    headerAlign,
    headerBusinessName,
    headerSubtitle,
    documentTitle: documentTitle.slice(0, 48),
    footerText: footerText.slice(0, 120),
    footerSecondaryText,
    fields: normalizeFields(input.fields),
    customLines,
    blockOrder: normalizeBlockOrder(input.blockOrder, customLines),
    blockStyles: normalizeBlockStyles(input.blockStyles),
  };
}

export function loadBillPrintSettings(
  branchCode: string | undefined,
  systemId?: string | null | undefined,
): BillPrintSettings {
  const defaults = defaultBillPrintSettingsFor(systemId);
  if (!branchCode) return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacyRaw = localStorage.getItem("pops-bill-print-settings-v1");
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as Record<string, Partial<BillPrintSettings>>;
        const { value } = readScopedMapEntry(legacy, branchCode, systemId);
        if (value) return normalizeBillPrintSettings(migrateLegacy(value));
      }
      return defaults;
    }
    const parsed = JSON.parse(raw) as Record<string, Partial<BillPrintSettings>>;
    const { value, scopedKey, systemId: sys } = readScopedMapEntry(parsed, branchCode, systemId);
    if (!value) return defaults;
    const next = normalizeBillPrintSettings(migrateLegacy(value));
    // One-time: hide TAX INVOICE on thermal slips (restaurant family only).
    if (
      (sys === "restaurant" || sys === "ice-cream-bar") &&
      next.fields.documentTitle &&
      /^tax\s*invoice$/i.test(next.documentTitle.trim())
    ) {
      next.fields = { ...next.fields, documentTitle: false };
    }
    // Persist under scoped key so suite systems stop sharing one blob.
    if (scopedKey && !parsed[scopedKey]) {
      parsed[scopedKey] = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return next;
  } catch {
    return defaults;
  }
}

export function saveBillPrintSettings(
  branchCode: string,
  settings: BillPrintSettings,
  systemId?: string | null | undefined,
): void {
  const next = normalizeBillPrintSettings(settings);
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? (JSON.parse(raw) as Record<string, BillPrintSettings>) : {};
  const key = printScopedKey(branchCode, systemId);
  parsed[key] = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  window.dispatchEvent(
    new CustomEvent(BILL_PRINT_SETTINGS_CHANGED_EVENT, {
      detail: { branchCode, systemId: resolvePrintSystemId(systemId), settings: next },
    }),
  );
}

export function loadActiveBillTemplateId(
  branchCode: string | undefined,
  systemId?: string | null | undefined,
): string | null {
  if (!branchCode || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    const { value } = readScopedMapEntry(parsed, branchCode, systemId);
    return value || null;
  } catch {
    return null;
  }
}

export function saveActiveBillTemplateId(
  branchCode: string,
  templateId: string | null,
  systemId?: string | null | undefined,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const key = printScopedKey(branchCode, systemId);
    if (templateId) parsed[key] = templateId;
    else delete parsed[key];
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

/** Scale receipt typography relative to the default body size (readable on thermal). */
export function billReceiptFontSizes(baseFontSize: number): {
  body: number;
  branchName: number;
  docType: number;
  metaChip: number;
  metaChipBillRef: number;
  notes: number;
  timestamp: number;
  th: number;
  itemName: number;
  qty: number;
  amt: number;
  rowLabel: number;
  rowValue: number;
  grandLabel: number;
  grandValue: number;
  footer: number;
  headerSubtitle: number;
  footerSecondary: number;
} {
  const r = baseFontSize / DEFAULT_BILL_PRINT_SETTINGS.baseFontSize;
  const px = (n: number) => Math.round(n * r * 10) / 10;
  return {
    body: baseFontSize,
    branchName: px(26),
    docType: px(16),
    metaChip: px(18),
    metaChipBillRef: px(22),
    notes: px(16),
    timestamp: px(16),
    th: px(16),
    itemName: px(20),
    qty: px(20),
    amt: px(19),
    rowLabel: px(18),
    rowValue: px(19),
    grandLabel: px(20),
    grandValue: px(24),
    footer: px(16),
    headerSubtitle: px(15),
    footerSecondary: px(15),
  };
}
