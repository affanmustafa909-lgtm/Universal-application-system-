import { useCallback, useMemo, useState } from "react";
import type { AvailabilityAllocation } from "../../pharmacy/api/pharmacy-inventory";

export type SaleCartLine = {
  /** Stable row key for React lists (allows same medicine twice if allocations differ). */
  key: string;
  medicineId: string;
  name: string;
  sku?: string | null;
  qty: number;
  freeQty: number;
  unitPricePkr: number;
  priceSource?: string | null;
  discountPkr: number;
  taxPkr: number;
  schemeName?: string | null;
  allocations?: AvailabilityAllocation[];
  availableQty?: number | null;
  shortfall?: number | null;
  fulfillable?: boolean | null;
  companyName?: string | null;
  pack?: string | null;
  genericName?: string | null;
  tabletsPerStrip?: number | null;
  stripsPerBox?: number | null;
};

export type SaleCartAddInput = {
  medicineId: string;
  name: string;
  sku?: string | null;
  qty?: number;
  freeQty?: number;
  unitPricePkr: number;
  priceSource?: string | null;
  discountPkr?: number;
  taxPkr?: number;
  schemeName?: string | null;
  allocations?: AvailabilityAllocation[];
  companyName?: string | null;
  pack?: string | null;
  genericName?: string | null;
  tabletsPerStrip?: number | null;
  stripsPerBox?: number | null;
  availableQty?: number | null;
};

function lineKey(medicineId: string): string {
  return `${medicineId}-${crypto.randomUUID().slice(0, 8)}`;
}

function allocationsEqual(
  a?: AvailabilityAllocation[],
  b?: AvailabilityAllocation[],
): boolean {
  if (!a?.length && !b?.length) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every(
    (x, i) =>
      x.batchId === b[i].batchId &&
      x.quantity === b[i].quantity &&
      x.warehouseId === b[i].warehouseId,
  );
}

function canMerge(existing: SaleCartLine, incoming: SaleCartAddInput): boolean {
  if (existing.medicineId !== incoming.medicineId) return false;
  if (Math.round(existing.unitPricePkr) !== Math.round(incoming.unitPricePkr)) return false;
  if (incoming.allocations && !allocationsEqual(existing.allocations, incoming.allocations)) {
    return false;
  }
  return true;
}

function lineNet(line: SaleCartLine): number {
  return Math.max(0, line.qty * line.unitPricePkr - line.discountPkr + line.taxPkr);
}

export function useSaleCart() {
  const [lines, setLines] = useState<SaleCartLine[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const add = useCallback((input: SaleCartAddInput) => {
    const qty = Math.max(1, Math.round(input.qty ?? 1));
    let selectKey: string | null = null;
    setLines((prev) => {
      const mergeIdx = prev.findIndex((l) => canMerge(l, input));
      if (mergeIdx >= 0) {
        const next = [...prev];
        const cur = next[mergeIdx]!;
        selectKey = cur.key;
        next[mergeIdx] = {
          ...cur,
          qty: cur.qty + qty,
          freeQty: cur.freeQty + Math.max(0, Math.round(input.freeQty ?? 0)),
          unitPricePkr: input.unitPricePkr,
          priceSource: input.priceSource ?? cur.priceSource,
          discountPkr: cur.discountPkr + Math.max(0, Number(input.discountPkr ?? 0)),
          taxPkr: cur.taxPkr + Math.max(0, Number(input.taxPkr ?? 0)),
          schemeName: input.schemeName ?? cur.schemeName,
          allocations: input.allocations ?? cur.allocations,
          availableQty: input.availableQty ?? cur.availableQty,
          companyName: input.companyName ?? cur.companyName,
          pack: input.pack ?? cur.pack,
          genericName: input.genericName ?? cur.genericName,
          tabletsPerStrip: input.tabletsPerStrip ?? cur.tabletsPerStrip,
          stripsPerBox: input.stripsPerBox ?? cur.stripsPerBox,
        };
        return next;
      }
      const key = lineKey(input.medicineId);
      selectKey = key;
      return [
        ...prev,
        {
          key,
          medicineId: input.medicineId,
          name: input.name,
          sku: input.sku,
          qty,
          freeQty: Math.max(0, Math.round(input.freeQty ?? 0)),
          unitPricePkr: input.unitPricePkr,
          priceSource: input.priceSource ?? null,
          discountPkr: Math.max(0, Number(input.discountPkr ?? 0)),
          taxPkr: Math.max(0, Number(input.taxPkr ?? 0)),
          schemeName: input.schemeName ?? null,
          allocations: input.allocations,
          availableQty: input.availableQty ?? null,
          companyName: input.companyName ?? null,
          pack: input.pack ?? null,
          genericName: input.genericName ?? null,
          tabletsPerStrip: input.tabletsPerStrip ?? null,
          stripsPerBox: input.stripsPerBox ?? null,
          fulfillable: null,
          shortfall: null,
        },
      ];
    });
    if (selectKey) setSelectedKey(selectKey);
  }, []);

  const updateQty = useCallback((key: string, qty: number) => {
    const nextQty = Math.round(qty);
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: nextQty } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<SaleCartLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const applyQuotePatches = useCallback(
    (
      patches: {
        medicineId: string;
        unitPricePkr?: number;
        priceSource?: string | null;
        freeQty?: number;
        discountPkr?: number;
        taxPkr?: number;
        schemeName?: string | null;
      }[],
    ) => {
      setLines((prev) =>
        prev.map((line) => {
          const p = patches.find((x) => x.medicineId === line.medicineId);
          if (!p) return line;
          return {
            ...line,
            unitPricePkr: p.unitPricePkr ?? line.unitPricePkr,
            priceSource: p.priceSource ?? line.priceSource,
            freeQty: p.freeQty ?? line.freeQty,
            discountPkr: p.discountPkr ?? line.discountPkr,
            taxPkr: p.taxPkr ?? line.taxPkr,
            schemeName: p.schemeName ?? line.schemeName,
          };
        }),
      );
    },
    [],
  );

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setSelectedKey((cur) => (cur === key ? null : cur));
  }, []);

  const removeSelected = useCallback(() => {
    setSelectedKey((cur) => {
      if (!cur) return cur;
      setLines((prev) => prev.filter((l) => l.key !== cur));
      return null;
    });
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setSelectedKey(null);
  }, []);

  const replaceAll = useCallback((next: SaleCartLine[]) => {
    setLines(next);
    setSelectedKey(next[0]?.key ?? null);
  }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPricePkr, 0);
    const discount = lines.reduce((s, l) => s + l.discountPkr, 0);
    const freeUnits = lines.reduce((s, l) => s + l.freeQty, 0);
    const tax = lines.reduce((s, l) => s + l.taxPkr, 0);
    const net = lines.reduce((s, l) => s + lineNet(l), 0);
    return { subtotal, discount, freeUnits, tax, net, lineCount: lines.length };
  }, [lines]);

  return {
    lines,
    selectedKey,
    setSelectedKey,
    add,
    updateQty,
    updateLine,
    applyQuotePatches,
    remove,
    removeSelected,
    clear,
    replaceAll,
    totals,
    lineNet,
  };
}

export type UseSaleCartReturn = ReturnType<typeof useSaleCart>;
