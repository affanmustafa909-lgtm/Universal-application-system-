/**
 * Canonical vendor branding shown in window titles, shells, and receipt footers.
 */
export const SOFTWARE_VENDOR_NAME = "Zivra";
/** Display form used under dashboards / POS chrome. */
export const SOFTWARE_VENDOR_PHONE_DISPLAY = "";
/** International form used on receipts (same number as bill footer). */
export const SOFTWARE_VENDOR_PHONE_E164 = "";
/** Default receipt powered-by line (super-admin can override via receipt branding). */
export const SOFTWARE_VENDOR_POWERED_BY = `powered by ${SOFTWARE_VENDOR_NAME}`;

export function softwareWindowTitle(systemLabel?: string | null): string {
  const label = (systemLabel ?? "").trim();
  return label ? `${SOFTWARE_VENDOR_NAME} — ${label}` : SOFTWARE_VENDOR_NAME;
}

export function softwareBrandLine(): string {
  return SOFTWARE_VENDOR_NAME;
}
