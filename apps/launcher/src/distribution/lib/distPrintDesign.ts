/**
 * Editable A4 design settings for Distribution documents — stored per branch + template.
 */

/** Same ids as DistDocumentTemplateId (kept as string to avoid circular imports). */
export type DistPrintDesignTemplateId = string;

export type DistPrintDesignSettings = {
  /** Overrides branch name on the document when set. */
  companyName: string;
  /** Tagline under company name (e.g. Wholesale Medical Distribution). */
  companySubtitle: string;
  /** Show “Branch CODE” in the subtitle line. */
  showBranchCode: boolean;
  /** Default footer line when a document does not pass its own note. */
  footerNote: string;
  showAmountInWords: boolean;
  showPackColumn: boolean;
  showBonusColumn: boolean;
  showSignatures: boolean;
  signPrepared: string;
  signChecked: string;
  signReceived: string;
  /** Alternating row shading on product / report grids. */
  stripedRows: boolean;
  /** Base body font size in px (10–13). */
  baseFontSize: number;
};

export const DEFAULT_DIST_PRINT_DESIGN: DistPrintDesignSettings = {
  companyName: "",
  companySubtitle: "Wholesale Medical Distribution",
  showBranchCode: true,
  footerNote: "Computer-generated distribution document",
  showAmountInWords: true,
  showPackColumn: true,
  showBonusColumn: true,
  showSignatures: true,
  signPrepared: "Prepared by",
  signChecked: "Checked / Authorized",
  signReceived: "Received by",
  stripedRows: true,
  baseFontSize: 11,
};

export const DIST_PRINT_DESIGN_CHANGED_EVENT = "dist-print-design-changed";

const STORAGE_KEY = "dist-print-design-v2";
/** Legacy branch-only key (v1) — used as fallback when a template has no saved design yet. */
const LEGACY_STORAGE_KEY = "dist-print-design-v1";

function clampFont(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DIST_PRINT_DESIGN.baseFontSize;
  return Math.max(10, Math.min(13, Math.round(n)));
}

export function normalizeDistPrintDesign(
  input: Partial<DistPrintDesignSettings> | null | undefined,
): DistPrintDesignSettings {
  const d = DEFAULT_DIST_PRINT_DESIGN;
  return {
    companyName: String(input?.companyName ?? d.companyName).trim().slice(0, 80),
    companySubtitle: String(input?.companySubtitle ?? d.companySubtitle).trim().slice(0, 100),
    showBranchCode: input?.showBranchCode ?? d.showBranchCode,
    footerNote: String(input?.footerNote ?? d.footerNote).trim().slice(0, 160),
    showAmountInWords: input?.showAmountInWords ?? d.showAmountInWords,
    showPackColumn: input?.showPackColumn ?? d.showPackColumn,
    showBonusColumn: input?.showBonusColumn ?? d.showBonusColumn,
    showSignatures: input?.showSignatures ?? d.showSignatures,
    signPrepared: String(input?.signPrepared ?? d.signPrepared).trim().slice(0, 40) || d.signPrepared,
    signChecked: String(input?.signChecked ?? d.signChecked).trim().slice(0, 40) || d.signChecked,
    signReceived: String(input?.signReceived ?? d.signReceived).trim().slice(0, 40) || d.signReceived,
    stripedRows: input?.stripedRows ?? d.stripedRows,
    baseFontSize: clampFont(Number(input?.baseFontSize ?? d.baseFontSize)),
  };
}

function storageKey(branchCode: string, templateId: DistPrintDesignTemplateId): string {
  return `distribution::${branchCode}::${templateId}`;
}

function readMap(key: string): Record<string, Partial<DistPrintDesignSettings>> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Partial<DistPrintDesignSettings>>;
  } catch {
    return {};
  }
}

export function loadDistPrintDesign(
  branchCode: string | undefined,
  templateId: DistPrintDesignTemplateId = "booking-invoice",
): DistPrintDesignSettings {
  if (!branchCode || typeof localStorage === "undefined") {
    return { ...DEFAULT_DIST_PRINT_DESIGN };
  }
  try {
    const map = readMap(STORAGE_KEY);
    const scoped = map[storageKey(branchCode, templateId)];
    if (scoped) return normalizeDistPrintDesign(scoped);

    // Fallback: older branch-wide design (same for all templates)
    const legacy = readMap(LEGACY_STORAGE_KEY);
    const legacyScoped = legacy[`distribution::${branchCode}`] ?? legacy[branchCode];
    if (legacyScoped) return normalizeDistPrintDesign(legacyScoped);

    return { ...DEFAULT_DIST_PRINT_DESIGN };
  } catch {
    return { ...DEFAULT_DIST_PRINT_DESIGN };
  }
}

export function saveDistPrintDesign(
  branchCode: string,
  templateId: DistPrintDesignTemplateId,
  settings: DistPrintDesignSettings,
): DistPrintDesignSettings {
  const next = normalizeDistPrintDesign(settings);
  if (typeof localStorage === "undefined") return next;
  try {
    const map = readMap(STORAGE_KEY);
    map[storageKey(branchCode, templateId)] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(
      new CustomEvent(DIST_PRINT_DESIGN_CHANGED_EVENT, {
        detail: { branchCode, templateId, settings: next },
      }),
    );
  } catch {
    /* ignore */
  }
  return next;
}

/** Guess which saved template design to apply from a document title. */
export function resolveDistTemplateIdFromTitle(
  title: string | undefined,
): DistPrintDesignTemplateId | null {
  const t = String(title ?? "")
    .toLowerCase()
    .trim();
  if (!t) return null;
  if (t.includes("tax invoice") || t.includes("gst")) return "tax-invoice";
  if (t.includes("trade invoice")) return "trade-invoice";
  if (t.includes("delivery") || t.includes("challan")) return "delivery-challan";
  if (t.includes("credit")) return "credit-note";
  if (t.includes("confirmation") || t.includes("acknowledg")) return "order-confirmation";
  if (t.includes("register") || t.includes("report")) return "sales-register";
  if (t.includes("booking") || t.includes("order")) return "booking-invoice";
  if (t.includes("invoice")) return "tax-invoice";
  return null;
}
