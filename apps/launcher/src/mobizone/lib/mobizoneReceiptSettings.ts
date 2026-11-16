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

export type MobizoneReceiptSettings = {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  /** Shop WhatsApp number — desktop master; mobile uses for send/footer. */
  whatsappNumber: string;
  /** Default ON for “Share on WhatsApp” after sale/purchase on mobile. */
  whatsappDefaultOn: boolean;
  documentTitle: string;
  footerText: string;
  paperWidthMm: 58 | 80;
  /** 0.75–1.35 — shrink/grow slip text for thermal printers. */
  fontScale: number;
  /** Compact shortens vertical padding for shorter slips. */
  density: "compact" | "comfortable";
  /**
   * Classic = thermal white paper (default — printers need this).
   * Dark = on-screen navy preview only; print still forces black-on-white.
   */
  slipTheme: "classic" | "dark";
  /**
   * Optional shop logo for MobiZone bills only (data URL or https URL).
   * Never loaded from restaurant / POPS Content Updation branding.
   */
  shopLogoUrl: string;
  fields: MobizoneReceiptFields;
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
  fields: { ...DEFAULT_MOBIZONE_RECEIPT_FIELDS },
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

export function normalizeMobizoneReceiptSettings(
  raw: Partial<MobizoneReceiptSettings> | null | undefined,
): MobizoneReceiptSettings {
  const fields = { ...DEFAULT_MOBIZONE_RECEIPT_FIELDS, ...(raw?.fields ?? {}) };
  const shopPhone = (raw?.shopPhone ?? "").trim();
  const whatsappNumber = (raw?.whatsappNumber ?? shopPhone).trim();
  const shopLogoUrl = String(raw?.shopLogoUrl ?? "")
    .trim()
    .slice(0, 1_500_000);
  return {
    shopName: (raw?.shopName ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.shopName).trim() || "MobiZone",
    shopPhone,
    shopAddress: raw?.shopAddress ?? "",
    whatsappNumber,
    whatsappDefaultOn: raw?.whatsappDefaultOn !== false,
    documentTitle: (raw?.documentTitle ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.documentTitle).trim() || "Sale Receipt",
    footerText: raw?.footerText ?? DEFAULT_MOBIZONE_RECEIPT_SETTINGS.footerText,
    paperWidthMm: raw?.paperWidthMm === 58 ? 58 : 80,
    fontScale: (() => {
      const n = Number(raw?.fontScale);
      if (!Number.isFinite(n)) return 1;
      return Math.min(1.35, Math.max(0.75, n));
    })(),
    density: raw?.density === "comfortable" ? "comfortable" : "compact",
    slipTheme: raw?.slipTheme === "dark" ? "dark" : "classic",
    shopLogoUrl:
      shopLogoUrl.startsWith("data:image/") ||
      shopLogoUrl.startsWith("https://") ||
      shopLogoUrl.startsWith("http://")
        ? shopLogoUrl
        : "",
    fields,
  };
}

export function loadMobizoneReceiptSettings(branchCode = "MAIN"): MobizoneReceiptSettings {
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
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
  localStorage.setItem(
    storageKey(branchCode),
    JSON.stringify(normalizeMobizoneReceiptSettings(settings)),
  );
}

/** Digits for wa.me — prefers party phone, falls back to desktop-saved shop WhatsApp. */
export function resolveWhatsAppTarget(
  partyPhone: string | null | undefined,
  settings: MobizoneReceiptSettings,
): string {
  const party = (partyPhone ?? "").replace(/\D/g, "");
  if (party.length >= 10) return party;
  return (settings.whatsappNumber || settings.shopPhone || "").replace(/\D/g, "");
}
