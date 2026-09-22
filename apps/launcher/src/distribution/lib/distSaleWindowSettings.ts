/** Dist Sale Window UI preferences (Held / Orders / Pay popup). */

export type DistSaleWindowSettings = {
  /** Held tab: show payment / draft total & customer payment hint */
  showHeldPayment: boolean;
  /** Orders tab: show Cash/Credit paid badge */
  showOrdersPayment: boolean;
  /** Orders tab: show status / activity history line */
  showOrdersHistory: boolean;
  /** Sell tab: block add when availableQty is 0; click opens purchasing */
  blockZeroStockAdd: boolean;
  /** Pay popup: allow Cash method */
  allowPayCash: boolean;
  /** Pay popup: allow Bank / transfer method */
  allowPayBank: boolean;
  /** Pay popup: allow Card method */
  allowPayCard: boolean;
  /** Pay popup (+ cart): allow bill discount field */
  allowPayDiscount: boolean;
  /** Max bill discount as % of subtotal (0–100). */
  maxDiscountPct: number;
};

export const DEFAULT_DIST_SALE_WINDOW_SETTINGS: DistSaleWindowSettings = {
  showHeldPayment: true,
  showOrdersPayment: true,
  showOrdersHistory: true,
  blockZeroStockAdd: true,
  allowPayCash: true,
  allowPayBank: true,
  allowPayCard: true,
  allowPayDiscount: true,
  maxDiscountPct: 50,
};

export const DIST_SALE_WINDOW_SETTINGS_CHANGED = "dist-sale-window-settings-changed";

const STORAGE_KEY = "dist-sale-window-settings-v1";

export function normalizeDistSaleWindowSettings(
  input: Partial<DistSaleWindowSettings> | null | undefined,
): DistSaleWindowSettings {
  const maxDiscountPct = Math.min(
    100,
    Math.max(0, Math.round(Number(input?.maxDiscountPct ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.maxDiscountPct) || 0)),
  );
  return {
    showHeldPayment: input?.showHeldPayment ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.showHeldPayment,
    showOrdersPayment: input?.showOrdersPayment ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.showOrdersPayment,
    showOrdersHistory: input?.showOrdersHistory ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.showOrdersHistory,
    blockZeroStockAdd: input?.blockZeroStockAdd ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.blockZeroStockAdd,
    allowPayCash: input?.allowPayCash ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.allowPayCash,
    allowPayBank: input?.allowPayBank ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.allowPayBank,
    allowPayCard: input?.allowPayCard ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.allowPayCard,
    allowPayDiscount: input?.allowPayDiscount ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.allowPayDiscount,
    maxDiscountPct,
  };
}

export function loadDistSaleWindowSettings(): DistSaleWindowSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DIST_SALE_WINDOW_SETTINGS };
    return normalizeDistSaleWindowSettings(JSON.parse(raw) as Partial<DistSaleWindowSettings>);
  } catch {
    return { ...DEFAULT_DIST_SALE_WINDOW_SETTINGS };
  }
}

export function saveDistSaleWindowSettings(next: DistSaleWindowSettings): void {
  const normalized = normalizeDistSaleWindowSettings(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(
    new CustomEvent(DIST_SALE_WINDOW_SETTINGS_CHANGED, { detail: normalized }),
  );
}

export type DistPayMethod = "Cash" | "Bank" | "Card";

/** Enabled pay methods from settings (always at least Cash fallback). */
export function distEnabledPayMethods(settings: DistSaleWindowSettings): DistPayMethod[] {
  const methods: DistPayMethod[] = [];
  if (settings.allowPayCash) methods.push("Cash");
  if (settings.allowPayBank) methods.push("Bank");
  if (settings.allowPayCard) methods.push("Card");
  return methods.length > 0 ? methods : ["Cash"];
}
