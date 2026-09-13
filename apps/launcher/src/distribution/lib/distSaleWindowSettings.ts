/** Dist Sale Window UI preferences (Held / Orders panels). */

export type DistSaleWindowSettings = {
  /** Held tab: show payment / draft total & customer payment hint */
  showHeldPayment: boolean;
  /** Orders tab: show Cash/Credit paid badge */
  showOrdersPayment: boolean;
  /** Orders tab: show status / activity history line */
  showOrdersHistory: boolean;
  /** Sell tab: block add when availableQty is 0; click opens purchasing */
  blockZeroStockAdd: boolean;
};

export const DEFAULT_DIST_SALE_WINDOW_SETTINGS: DistSaleWindowSettings = {
  showHeldPayment: true,
  showOrdersPayment: true,
  showOrdersHistory: true,
  blockZeroStockAdd: true,
};

export const DIST_SALE_WINDOW_SETTINGS_CHANGED = "dist-sale-window-settings-changed";

const STORAGE_KEY = "dist-sale-window-settings-v1";

export function normalizeDistSaleWindowSettings(
  input: Partial<DistSaleWindowSettings> | null | undefined,
): DistSaleWindowSettings {
  return {
    showHeldPayment: input?.showHeldPayment ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.showHeldPayment,
    showOrdersPayment: input?.showOrdersPayment ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.showOrdersPayment,
    showOrdersHistory: input?.showOrdersHistory ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.showOrdersHistory,
    blockZeroStockAdd: input?.blockZeroStockAdd ?? DEFAULT_DIST_SALE_WINDOW_SETTINGS.blockZeroStockAdd,
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
