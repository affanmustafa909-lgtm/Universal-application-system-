/** Pack / pata / goli price helpers for Dist medicines. */

export type MedicinePackCounts = {
  tabletsPerStrip: number;
  stripsPerBox: number;
};

export type MedicinePackPriceBreakdown = MedicinePackCounts & {
  /** 1 strip / pata price (base stored price). */
  pataPkr: number;
  /** 1 tablet / goli price (derived). */
  goliPkr: number;
  /** 1 box / pack price (derived). */
  packPkr: number;
};

/** Sale unit on Dist sale window — 1 goli, 1 pata (strip), or 1 full pack/box. */
export type DistSaleUnit = "goli" | "pata" | "pack";

export const DIST_SALE_UNITS: DistSaleUnit[] = ["goli", "pata", "pack"];

export function normalizePackCounts(
  tabletsPerStrip?: number | string | null,
  stripsPerBox?: number | string | null,
): MedicinePackCounts {
  const tps = Math.max(1, Math.round(Number(tabletsPerStrip) || 1));
  const spb = Math.max(1, Math.round(Number(stripsPerBox) || 1));
  return { tabletsPerStrip: tps, stripsPerBox: spb };
}

/** `stripPricePkr` is the price of one pata/strip (selling or wholesale). */
export function medicinePackPrices(
  stripPricePkr: number | string | null | undefined,
  tabletsPerStrip?: number | string | null,
  stripsPerBox?: number | string | null,
): MedicinePackPriceBreakdown {
  const { tabletsPerStrip: tps, stripsPerBox: spb } = normalizePackCounts(tabletsPerStrip, stripsPerBox);
  const pataPkr = Math.max(0, Math.round(Number(stripPricePkr) || 0));
  return {
    tabletsPerStrip: tps,
    stripsPerBox: spb,
    pataPkr,
    goliPkr: Math.round(pataPkr / tps),
    packPkr: Math.round(pataPkr * spb),
  };
}

export function formatPackLabel(tabletsPerStrip?: number | string | null, stripsPerBox?: number | string | null): string {
  const { tabletsPerStrip: tps, stripsPerBox: spb } = normalizePackCounts(tabletsPerStrip, stripsPerBox);
  return `${tps} goli × ${spb} pata`;
}

export function distSaleUnitLabel(unit: DistSaleUnit): string {
  if (unit === "goli") return "Goli";
  if (unit === "pack") return "Pack";
  return "Pata";
}

export function distSaleUnitHint(
  unit: DistSaleUnit,
  tabletsPerStrip?: number | string | null,
  stripsPerBox?: number | string | null,
): string {
  const { tabletsPerStrip: tps, stripsPerBox: spb } = normalizePackCounts(tabletsPerStrip, stripsPerBox);
  if (unit === "goli") return `1 tablet${tps > 1 ? ` (${tps}/pata)` : ""}`;
  if (unit === "pack") return `1 box (${spb} pata)`;
  return `1 strip${tps > 1 ? ` (${tps} goli)` : ""}`;
}

/** Price for one selected sale unit, from base strip/pata price. */
export function distUnitPrice(
  stripPricePkr: number | string | null | undefined,
  unit: DistSaleUnit,
  tabletsPerStrip?: number | string | null,
  stripsPerBox?: number | string | null,
): number {
  const br = medicinePackPrices(stripPricePkr, tabletsPerStrip, stripsPerBox);
  if (unit === "goli") return br.goliPkr;
  if (unit === "pack") return br.packPkr;
  return br.pataPkr;
}

/**
 * Convert sale-unit qty → strip (pata) qty for stock / FEFO checks.
 * Goli uses ceil so we never under-reserve a opened strip.
 */
export function distToStripQty(
  qty: number,
  unit: DistSaleUnit,
  tabletsPerStrip?: number | string | null,
  stripsPerBox?: number | string | null,
): number {
  const { tabletsPerStrip: tps, stripsPerBox: spb } = normalizePackCounts(tabletsPerStrip, stripsPerBox);
  const q = Math.max(0, Math.round(Number(qty) || 0));
  if (unit === "pata") return q;
  if (unit === "pack") return q * spb;
  return Math.max(q > 0 ? 1 : 0, Math.ceil(q / tps));
}

/** Preserve physical strip amount when switching sale unit (best-effort round). */
export function distConvertSaleQty(
  qty: number,
  from: DistSaleUnit,
  to: DistSaleUnit,
  tabletsPerStrip?: number | string | null,
  stripsPerBox?: number | string | null,
): number {
  if (from === to) return Math.max(1, Math.round(qty));
  const { tabletsPerStrip: tps, stripsPerBox: spb } = normalizePackCounts(tabletsPerStrip, stripsPerBox);
  const q = Math.max(0, Math.round(Number(qty) || 0));
  let strips: number;
  if (from === "pata") strips = q;
  else if (from === "pack") strips = q * spb;
  else strips = q / tps;

  if (to === "pata") return Math.max(1, Math.round(strips));
  if (to === "pack") return Math.max(1, Math.round(strips / spb) || 1);
  return Math.max(1, Math.round(strips * tps) || 1);
}

export function parseDistSaleUnit(raw: string | null | undefined): DistSaleUnit {
  if (raw === "goli" || raw === "pack" || raw === "pata") return raw;
  return "pata";
}
