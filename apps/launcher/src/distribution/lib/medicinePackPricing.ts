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
