import { SOFTWARE_VENDOR_NAME } from "../lib/productBrand";

type Props = {
  className?: string;
  /** Tighter type for headers / POS chrome. */
  compact?: boolean;
};

/**
 * Vendor mark — Zivra product branding for shells / POS chrome.
 */
export function VendorBrandMark({ className = "", compact = false }: Props): JSX.Element {
  return (
    <div
      className={`select-none leading-tight ${className}`}
      title={SOFTWARE_VENDOR_NAME}
    >
      <p
        className={
          compact
            ? "text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-300 [.pops-force-dark_&]:text-amber-300"
            : "text-[13px] font-extrabold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300 [.pops-force-dark_&]:text-amber-300"
        }
      >
        {SOFTWARE_VENDOR_NAME}
      </p>
    </div>
  );
}
