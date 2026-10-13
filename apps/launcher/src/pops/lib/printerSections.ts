/** Printer sections (Kitchen, Bar, Grill, ...) — per-system + branch, localStorage-backed. */
import { KITCHEN_SALE_PRINT_SECTIONS } from "./kitchenSaleReport";
import {
  printScopedKey,
  readScopedMapEntry,
  resolvePrintSystemId,
} from "./printSystemScope";

export type PrinterSection = {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  /** Default sections ship with the app; custom sections are user-created and fully deletable. */
  isSystem: boolean;
  sortOrder: number;
};

export const DEFAULT_PRINTER_SECTIONS: PrinterSection[] = [
  ...KITCHEN_SALE_PRINT_SECTIONS.map((s) => ({ ...s })),
  { id: "kitchen", name: "Kitchen", icon: "🍳", color: "#f59e0b", enabled: true, isSystem: true, sortOrder: 3 },
  { id: "bar", name: "Bar", icon: "🍸", color: "#8b5cf6", enabled: true, isSystem: true, sortOrder: 4 },
  { id: "waiter", name: "Waiter", icon: "🧑‍🍳", color: "#38bdf8", enabled: true, isSystem: true, sortOrder: 5 },
  { id: "grill", name: "Grill", icon: "🔥", color: "#ef4444", enabled: true, isSystem: true, sortOrder: 6 },
  { id: "dessert", name: "Dessert", icon: "🍰", color: "#f472b6", enabled: true, isSystem: true, sortOrder: 7 },
  { id: "drinks", name: "Drinks", icon: "🥤", color: "#22d3ee", enabled: true, isSystem: true, sortOrder: 8 },
  { id: "cashier", name: "Cashier", icon: "🧾", color: "#a3e635", enabled: true, isSystem: true, sortOrder: 9 },
  { id: "pickup", name: "Pickup", icon: "📦", color: "#fb923c", enabled: true, isSystem: true, sortOrder: 10 },
  { id: "delivery", name: "Delivery", icon: "🛵", color: "#34d399", enabled: true, isSystem: true, sortOrder: 11 },
];

/** General Store defaults — same printer workflow, retail-oriented sections. */
export const DEFAULT_STORE_PRINTER_SECTIONS: PrinterSection[] = [
  { id: "receipt", name: "Receipt", icon: "🧾", color: "#a3e635", enabled: true, isSystem: true, sortOrder: 0 },
  { id: "counter", name: "Counter", icon: "🛒", color: "#38bdf8", enabled: true, isSystem: true, sortOrder: 1 },
  { id: "warehouse", name: "Warehouse", icon: "📦", color: "#fb923c", enabled: true, isSystem: true, sortOrder: 2 },
  { id: "returns", name: "Returns", icon: "↩️", color: "#f472b6", enabled: true, isSystem: true, sortOrder: 3 },
  { id: "label", name: "Label", icon: "🏷️", color: "#22d3ee", enabled: true, isSystem: true, sortOrder: 4 },
  { id: "back-office", name: "Back office", icon: "🖨️", color: "#94a3b8", enabled: true, isSystem: true, sortOrder: 5 },
];

/** Medical Distribution — booking / invoice / warehouse (no kitchen / bar / waiter). */
export const DEFAULT_DISTRIBUTION_PRINTER_SECTIONS: PrinterSection[] = [
  { id: "receipt", name: "Booking / invoice", icon: "🧾", color: "#22d3ee", enabled: true, isSystem: true, sortOrder: 0 },
  { id: "counter", name: "Order desk", icon: "🖥️", color: "#38bdf8", enabled: true, isSystem: true, sortOrder: 1 },
  { id: "warehouse", name: "Warehouse", icon: "📦", color: "#fb923c", enabled: true, isSystem: true, sortOrder: 2 },
  { id: "returns", name: "Returns (WRN/SRN)", icon: "↩️", color: "#f472b6", enabled: true, isSystem: true, sortOrder: 3 },
  { id: "label", name: "Labels", icon: "🏷️", color: "#a3e635", enabled: true, isSystem: true, sortOrder: 4 },
  { id: "back-office", name: "Back office", icon: "🖨️", color: "#94a3b8", enabled: true, isSystem: true, sortOrder: 5 },
];

/** Pharmacy retail — counter / Rx (no kitchen stations). */
export const DEFAULT_PHARMACY_PRINTER_SECTIONS: PrinterSection[] = [
  { id: "receipt", name: "Receipt", icon: "🧾", color: "#34d399", enabled: true, isSystem: true, sortOrder: 0 },
  { id: "counter", name: "Counter", icon: "💊", color: "#38bdf8", enabled: true, isSystem: true, sortOrder: 1 },
  { id: "warehouse", name: "Store room", icon: "📦", color: "#fb923c", enabled: true, isSystem: true, sortOrder: 2 },
  { id: "returns", name: "Returns", icon: "↩️", color: "#f472b6", enabled: true, isSystem: true, sortOrder: 3 },
  { id: "label", name: "Labels", icon: "🏷️", color: "#22d3ee", enabled: true, isSystem: true, sortOrder: 4 },
  { id: "back-office", name: "Back office", icon: "🖨️", color: "#94a3b8", enabled: true, isSystem: true, sortOrder: 5 },
];

export type PrinterSectionPreset =
  | "restaurant"
  | "general-store"
  | "distribution"
  | "pharmacy"
  | "ice-cream-bar"
  | "education";

/** Ice cream parlour stations — scoop / counter, not grill/bar restaurant defaults. */
export const DEFAULT_ICE_CREAM_PRINTER_SECTIONS: PrinterSection[] = [
  { id: "kitchen", name: "Scoop station", icon: "🍦", color: "#f59e0b", enabled: true, isSystem: true, sortOrder: 0 },
  { id: "dessert", name: "Toppings", icon: "🍒", color: "#f472b6", enabled: true, isSystem: true, sortOrder: 1 },
  { id: "drinks", name: "Drinks", icon: "🥤", color: "#22d3ee", enabled: true, isSystem: true, sortOrder: 2 },
  { id: "cashier", name: "Cashier", icon: "🧾", color: "#a3e635", enabled: true, isSystem: true, sortOrder: 3 },
  { id: "pickup", name: "Takeaway", icon: "📦", color: "#fb923c", enabled: true, isSystem: true, sortOrder: 4 },
  { id: "delivery", name: "Delivery", icon: "🛵", color: "#34d399", enabled: true, isSystem: true, sortOrder: 5 },
];

/** Education — office / fee receipts only (no kitchen). */
export const DEFAULT_EDUCATION_PRINTER_SECTIONS: PrinterSection[] = [
  { id: "receipt", name: "Fee receipt", icon: "🧾", color: "#38bdf8", enabled: true, isSystem: true, sortOrder: 0 },
  { id: "counter", name: "Front office", icon: "🖥️", color: "#a3e635", enabled: true, isSystem: true, sortOrder: 1 },
  { id: "back-office", name: "Back office", icon: "🖨️", color: "#94a3b8", enabled: true, isSystem: true, sortOrder: 2 },
];

const RESTAURANT_LEAK_IDS = new Set([
  "kitchen",
  "bar",
  "waiter",
  "grill",
  "dessert",
  "drinks",
  "cashier",
  "pickup",
  "delivery",
  ...KITCHEN_SALE_PRINT_SECTIONS.map((s) => s.id),
]);

export function defaultPrinterSectionsFor(preset: PrinterSectionPreset = "restaurant"): PrinterSection[] {
  if (preset === "general-store") return DEFAULT_STORE_PRINTER_SECTIONS;
  if (preset === "distribution") return DEFAULT_DISTRIBUTION_PRINTER_SECTIONS;
  if (preset === "pharmacy") return DEFAULT_PHARMACY_PRINTER_SECTIONS;
  if (preset === "ice-cream-bar") return DEFAULT_ICE_CREAM_PRINTER_SECTIONS;
  if (preset === "education") return DEFAULT_EDUCATION_PRINTER_SECTIONS;
  return DEFAULT_PRINTER_SECTIONS;
}

export function printerSectionPresetForSystem(
  systemId: string | null | undefined,
): PrinterSectionPreset {
  if (systemId === "general-store") return "general-store";
  if (systemId === "distribution") return "distribution";
  if (systemId === "pharmacy") return "pharmacy";
  if (systemId === "ice-cream-bar") return "ice-cream-bar";
  if (systemId === "education") return "education";
  return "restaurant";
}

function systemIdForSectionPreset(preset: PrinterSectionPreset): string {
  return preset;
}

export const PRINTER_SECTIONS_CHANGED_EVENT = "pops-printer-sections-changed";

const STORAGE_KEY = "pops-printer-sections-v1";

function readAll(): Record<string, PrinterSection[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PrinterSection[]>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PrinterSection[]>, branchCode: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(PRINTER_SECTIONS_CHANGED_EVENT, { detail: { branchCode } }));
  } catch {
    // ignore storage errors
  }
}

export function loadPrinterSections(
  branchCode: string | undefined,
  preset: PrinterSectionPreset = "restaurant",
): PrinterSection[] {
  const defaults = defaultPrinterSectionsFor(preset);
  if (!branchCode) return defaults;
  const all = readAll();
  const sys = systemIdForSectionPreset(preset);
  const { value: stored, scopedKey } = readScopedMapEntry(all, branchCode, sys);
  if (!stored || stored.length === 0) return defaults;

  let merged = stored;

  // Ensure Kitchen Sale Report sections exist on older restaurant branches only.
  if (preset === "restaurant") {
    const missingSale = KITCHEN_SALE_PRINT_SECTIONS.filter(
      (sale) => !stored.some((s) => s.id === sale.id),
    );
    if (missingSale.length > 0) {
      merged = [
        ...missingSale.map((s, i) => ({
          ...s,
          sortOrder: Math.min(...stored.map((x) => x.sortOrder), 0) - missingSale.length + i,
        })),
        ...stored,
      ];
      savePrinterSections(branchCode, merged, preset);
    }
  }

  // Non-restaurant-family: strip Kitchen/Bar/Waiter leftovers; keep custom sections.
  const restaurantFamily = preset === "restaurant" || preset === "ice-cream-bar";
  if (!restaurantFamily && merged.some((s) => RESTAURANT_LEAK_IDS.has(s.id))) {
    const customs = merged.filter((s) => !s.isSystem && !RESTAURANT_LEAK_IDS.has(s.id));
    const next = [
      ...defaults,
      ...customs.map((s, i) => ({ ...s, sortOrder: defaults.length + i })),
    ];
    savePrinterSections(branchCode, next, preset);
    return next;
  }

  // Persist under scoped key so suite systems stop sharing one section list.
  if (scopedKey && !all[scopedKey]) {
    savePrinterSections(branchCode, merged, preset);
  }

  return [...merged].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function savePrinterSections(
  branchCode: string,
  sections: PrinterSection[],
  preset: PrinterSectionPreset = "restaurant",
): void {
  const all = readAll();
  const key = printScopedKey(branchCode, systemIdForSectionPreset(preset));
  all[key] = sections;
  writeAll(all, branchCode);
}

function newSectionId(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "section"}-${Date.now().toString(36)}`;
}

function activeSectionPreset(
  preset?: PrinterSectionPreset,
): PrinterSectionPreset {
  return preset ?? printerSectionPresetForSystem(resolvePrintSystemId());
}

export function addPrinterSection(
  branchCode: string,
  input: { name: string; icon: string; color: string },
  preset?: PrinterSectionPreset,
): PrinterSection {
  const sectionPreset = activeSectionPreset(preset);
  const sections = loadPrinterSections(branchCode, sectionPreset);
  const next: PrinterSection = {
    id: newSectionId(input.name),
    name: input.name.trim() || "New section",
    icon: input.icon || "🖨️",
    color: input.color || "#94a3b8",
    enabled: true,
    isSystem: false,
    sortOrder: sections.length,
  };
  savePrinterSections(branchCode, [...sections, next], sectionPreset);
  return next;
}

/** Duplicates a section as a new custom (non-system) section, copying icon/color. */
export function duplicatePrinterSection(
  branchCode: string,
  sectionId: string,
  preset?: PrinterSectionPreset,
): PrinterSection | null {
  const sectionPreset = activeSectionPreset(preset);
  const sections = loadPrinterSections(branchCode, sectionPreset);
  const source = sections.find((s) => s.id === sectionId);
  if (!source) return null;
  const copy: PrinterSection = {
    id: newSectionId(source.name),
    name: `${source.name} (copy)`,
    icon: source.icon,
    color: source.color,
    enabled: source.enabled,
    isSystem: false,
    sortOrder: sections.length,
  };
  savePrinterSections(branchCode, [...sections, copy], sectionPreset);
  return copy;
}

export function updatePrinterSection(
  branchCode: string,
  sectionId: string,
  patch: Partial<Pick<PrinterSection, "name" | "icon" | "color" | "enabled">>,
  preset?: PrinterSectionPreset,
): void {
  const sectionPreset = activeSectionPreset(preset);
  const sections = loadPrinterSections(branchCode, sectionPreset);
  savePrinterSections(
    branchCode,
    sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    sectionPreset,
  );
}

export function deletePrinterSection(
  branchCode: string,
  sectionId: string,
  preset?: PrinterSectionPreset,
): void {
  const sectionPreset = activeSectionPreset(preset);
  const sections = loadPrinterSections(branchCode, sectionPreset);
  const target = sections.find((s) => s.id === sectionId);
  if (!target || target.isSystem) return;
  savePrinterSections(
    branchCode,
    sections.filter((s) => s.id !== sectionId),
    sectionPreset,
  );
}
