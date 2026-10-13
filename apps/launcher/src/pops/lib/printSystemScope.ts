/**
 * Per-business-system print settings scope.
 * Prevents restaurant / kitchen receipt layouts from leaking into pharmacy, store, etc.
 */

import {
  isBusinessSystemId,
  type BusinessSystemId,
} from "../../lib/businessSystems";
import { useSystemStore } from "../../stores/systemStore";

/** Systems that share the restaurant POS / KOT print family. */
export function isRestaurantPrintFamily(systemId: BusinessSystemId): boolean {
  return systemId === "restaurant" || systemId === "ice-cream-bar";
}

/** Resolve which ERP owns print settings for this call. */
export function resolvePrintSystemId(
  explicit?: string | null | undefined,
): BusinessSystemId {
  if (explicit && isBusinessSystemId(explicit)) return explicit;
  try {
    const fromStore = useSystemStore.getState().systemId;
    if (fromStore && isBusinessSystemId(fromStore)) return fromStore;
  } catch {
    // store may be unavailable outside React
  }
  return "restaurant";
}

/**
 * Storage map key: `systemId::BRANCH`.
 * Legacy branch-only keys are only migrated for restaurant-family systems.
 */
export function printScopedKey(
  branchCode: string,
  systemId?: string | null | undefined,
): string {
  const sys = resolvePrintSystemId(systemId);
  return `${sys}::${branchCode.trim()}`;
}

/** Legacy unscoped branch key (pre-segregation). */
export function printLegacyBranchKey(branchCode: string): string {
  return branchCode.trim();
}

/**
 * Read a value from a Record keyed by scoped (and optionally legacy) branch keys.
 * Restaurant family may fall back to legacy branch-only entries once.
 * Other systems never inherit restaurant legacy data.
 */
export function readScopedMapEntry<T>(
  map: Record<string, T> | null | undefined,
  branchCode: string | undefined,
  systemId?: string | null | undefined,
): { value: T | undefined; scopedKey: string; systemId: BusinessSystemId } {
  const sys = resolvePrintSystemId(systemId);
  const scopedKey = branchCode ? printScopedKey(branchCode, sys) : "";
  if (!branchCode || !map) {
    return { value: undefined, scopedKey, systemId: sys };
  }
  const direct = map[scopedKey];
  if (direct !== undefined) {
    return { value: direct, scopedKey, systemId: sys };
  }
  // Only restaurant family migrates from pre-segregation branch keys.
  if (isRestaurantPrintFamily(sys)) {
    const legacy =
      map[printLegacyBranchKey(branchCode)] ??
      map[branchCode] ??
      map[branchCode.trim().toUpperCase()];
    if (legacy !== undefined) {
      return { value: legacy, scopedKey, systemId: sys };
    }
  }
  return { value: undefined, scopedKey, systemId: sys };
}

/** Receipt dialect for labels on shared thermal HTML (Table vs Station vs Till). */
export type ReceiptDialect =
  | "restaurant"
  | "ice-cream-bar"
  | "pharmacy"
  | "general-store"
  | "distribution"
  | "education";

export function receiptDialectForSystem(
  systemId?: string | null | undefined,
): ReceiptDialect {
  const sys = resolvePrintSystemId(systemId);
  return sys;
}

export type ReceiptMetaLabels = {
  order: string;
  type: string;
  station: string;
  bill: string;
  staff: string;
  dialogTitle: string;
};

export function receiptMetaLabelsFor(
  systemId?: string | null | undefined,
): ReceiptMetaLabels {
  const dialect = receiptDialectForSystem(systemId);
  switch (dialect) {
    case "pharmacy":
      return {
        order: "Invoice",
        type: "Channel",
        station: "Station",
        bill: "Rx / Invoice",
        staff: "Pharmacist",
        dialogTitle: "Pharmacy Print",
      };
    case "general-store":
      return {
        order: "Sale",
        type: "Sale type",
        station: "Till",
        bill: "Invoice",
        staff: "Cashier",
        dialogTitle: "Store Print",
      };
    case "distribution":
      return {
        order: "Booking",
        type: "Doc type",
        station: "Desk",
        bill: "Invoice",
        staff: "Staff",
        dialogTitle: "Distribution Print",
      };
    case "education":
      return {
        order: "Receipt",
        type: "Type",
        station: "Counter",
        bill: "Fee receipt",
        staff: "Staff",
        dialogTitle: "Education Print",
      };
    case "ice-cream-bar":
      return {
        order: "Order",
        type: "Type",
        station: "Station",
        bill: "Bill",
        staff: "Cashier",
        dialogTitle: "Ice Cream Bar Print",
      };
    default:
      return {
        order: "Order",
        type: "Type",
        station: "Table",
        bill: "Bill",
        staff: "Cashier",
        dialogTitle: "Restaurant Print",
      };
  }
}
