import { mzStorageGet, mzStorageSet } from "./storage";

export type MobizoneReceiptFields = {
  shopName: boolean;
  shopPhone: boolean;
  shopAddress: boolean;
  documentTitle: boolean;
  timestamp: boolean;
  customerName: boolean;
  customerPhone: boolean;
  customerCnic: boolean;
  customerAddress: boolean;
  device: boolean;
  imei: boolean;
  warranty: boolean;
  salePrice: boolean;
  cash: boolean;
  bank: boolean;
  bankDetails: boolean;
  remaining: boolean;
  dueDate: boolean;
  footer: boolean;
};

export type MobizoneReceiptDesign = {
  accent: string;
  text: string;
  muted: string;
  border: string;
  background: string;
};

export type MobizoneReceiptSettings = {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  whatsappNumber: string;
  whatsappDefaultOn: boolean;
  documentTitle: string;
  footerText: string;
  paperWidthMm: 58 | 80;
  fontScale?: number;
  density?: "compact" | "comfortable";
  slipTheme?: "classic" | "dark";
  /** MobiZone-only shop logo (data URL / https). Not restaurant branding. */
  shopLogoUrl: string;
  /** On-screen / preview colors. Print remains black-on-white for thermal. */
  design: MobizoneReceiptDesign;
  fields: MobizoneReceiptFields;
  /** Set when last loaded/published from desktop (live API). */
  controlledByDesktop?: boolean;
  updatedAt?: string | null;
};

export const DEFAULT_MOBIZONE_RECEIPT_FIELDS: MobizoneReceiptFields = {
  shopName: true,
  shopPhone: true,
  shopAddress: true,
  documentTitle: true,
  timestamp: true,
  customerName: true,
  customerPhone: true,
  customerCnic: true,
  customerAddress: true,
  device: true,
  imei: true,
  warranty: true,
  salePrice: true,
  cash: true,
  bank: true,
  bankDetails: true,
  remaining: true,
  dueDate: true,
  footer: true,
};

export const RECEIPT_DESIGN_PRESETS = {
  teal: {
    accent: "#0f766e",
    text: "#0f172a",
    muted: "#475569",
    border: "#0f766e",
    background: "#ffffff",
  },
  classic: {
    accent: "#0f172a",
    text: "#0f172a",
    muted: "#475569",
    border: "#0f172a",
    background: "#ffffff",
  },
  navy: {
    accent: "#5eead4",
    text: "#f8fafc",
    muted: "#cbd5e1",
    border: "#334155",
    background: "#0b1220",
  },
} as const satisfies Record<string, MobizoneReceiptDesign>;

export const DEFAULT_MOBIZONE_RECEIPT_DESIGN: MobizoneReceiptDesign = {
  ...RECEIPT_DESIGN_PRESETS.teal,
};

export const DEFAULT_MOBIZONE_RECEIPT_SETTINGS: MobizoneReceiptSettings = {
  shopName: "MobiZone",
  shopPhone: "",
  shopAddress: "",
  whatsappNumber: "",
  whatsappDefaultOn: true,
  documentTitle: "Sale Receipt",
  footerText: "Thank you for your business",
  paperWidthMm: 80,
  fontScale: 1,
  density: "compact",
  slipTheme: "classic",
  shopLogoUrl: "",
  design: { ...DEFAULT_MOBIZONE_RECEIPT_DESIGN },
  fields: { ...DEFAULT_MOBIZONE_RECEIPT_FIELDS },
  controlledByDesktop: true,
  updatedAt: null,
};

export const MOBIZONE_RECEIPT_FIELD_LABELS: Record<keyof MobizoneReceiptFields, string> = {
  shopName: "Shop name",
  shopPhone: "Shop phone",
  shopAddress: "Shop address",
  documentTitle: "Document title",
  timestamp: "Date & time",
  customerName: "Customer name",
  customerPhone: "Customer phone",
  customerCnic: "Customer CNIC",
  customerAddress: "Customer address",
  device: "Device (brand / model)",
  imei: "IMEI",
  warranty: "Warranty days",
  salePrice: "Sale / purchase price",
  cash: "Cash amount",
  bank: "Bank amount",
  bankDetails: "Bank name / txn",
  remaining: "Remaining (credit)",
  dueDate: "Due date",
  footer: "Footer message",
};

function storageKey(branchCode: string): string {
  return `mobizone-receipt-settings-v1:${branchCode || "MAIN"}`;
}

function normalizeHex(raw: unknown, fallback: string): string {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

export function normalizeMobizoneReceiptDesign(
  raw: Partial<MobizoneReceiptDesign> | null | undefined,
  slipTheme?: "classic" | "dark",
): MobizoneReceiptDesign {
  const base =
    slipTheme === "dark" ? RECEIPT_DESIGN_PRESETS.navy : DEFAULT_MOBIZONE_RECEIPT_DESIGN;
  return {
    accent: normalizeHex(raw?.accent, base.accent),
    text: normalizeHex(raw?.text, base.text),
    muted: normalizeHex(raw?.muted, base.muted),
    border: normalizeHex(raw?.border, base.border),
    background: normalizeHex(raw?.background, base.background),
  };
}

export function normalizeMobizoneReceiptSettings(
  raw: Partial<MobizoneReceiptSettings> | null | undefined,
): MobizoneReceiptSettings {
  const shopPhone = (raw?.shopPhone ?? "").trim();
  const whatsappNumber = (raw?.whatsappNumber ?? shopPhone).trim();
  const shopLogoUrl = String(raw?.shopLogoUrl ?? "")
    .trim()
    .slice(0, 1_500_000);
  const slipTheme = raw?.slipTheme === "dark" ? "dark" : "classic";
  const hasCustomDesign = Boolean(raw?.design && typeof raw.design === "object");
  return {
    shopName: (raw?.shopName ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.shopName).trim() || "MobiZone",
    shopPhone,
    shopAddress: raw?.shopAddress ?? "",
    whatsappNumber,
    whatsappDefaultOn: raw?.whatsappDefaultOn !== false,
    documentTitle:
      (raw?.documentTitle ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.documentTitle).trim() || "Sale Receipt",
    footerText: raw?.footerText ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.footerText,
    paperWidthMm: raw?.paperWidthMm === 58 ? 58 : 80,
    fontScale: (() => {
      const n = Number(raw?.fontScale);
      if (!Number.isFinite(n)) return 1;
      return Math.min(1.35, Math.max(0.75, n));
    })(),
    density: raw?.density === "comfortable" ? "comfortable" : "compact",
    slipTheme,
    shopLogoUrl:
      shopLogoUrl.startsWith("data:image/") ||
      shopLogoUrl.startsWith("https://") ||
      shopLogoUrl.startsWith("http://")
        ? shopLogoUrl
        : "",
    design: hasCustomDesign
      ? normalizeMobizoneReceiptDesign(raw?.design, slipTheme)
      : slipTheme === "dark"
        ? { ...RECEIPT_DESIGN_PRESETS.navy }
        : { ...DEFAULT_MOBIZONE_RECEIPT_DESIGN },
    fields: { ...DEFAULT_MOBIZONE_RECEIPT_FIELDS, ...(raw?.fields ?? {}) },
    controlledByDesktop: raw?.controlledByDesktop !== false,
    updatedAt: raw?.updatedAt ?? null,
  };
}

export function loadMobizoneReceiptSettings(branchCode: string): MobizoneReceiptSettings {
  try {
    const raw = mzStorageGet(storageKey(branchCode));
    if (!raw) return normalizeMobizoneReceiptSettings(null);
    return normalizeMobizoneReceiptSettings(JSON.parse(raw) as Partial<MobizoneReceiptSettings>);
  } catch {
    return normalizeMobizoneReceiptSettings(null);
  }
}

export function saveMobizoneReceiptSettings(
  branchCode: string,
  settings: MobizoneReceiptSettings,
): void {
  mzStorageSet(storageKey(branchCode), JSON.stringify(normalizeMobizoneReceiptSettings(settings)));
}

/** Digits for wa.me — prefers customer phone, falls back to shop WhatsApp. */
export function resolveWhatsAppTarget(
  partyPhone: string | null | undefined,
  settings: MobizoneReceiptSettings,
): string {
  const party = (partyPhone ?? "").replace(/\D/g, "");
  if (party.length >= 10) return party;
  return (settings.whatsappNumber || settings.shopPhone || "").replace(/\D/g, "");
}
