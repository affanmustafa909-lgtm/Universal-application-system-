import { useCallback, useMemo, useState } from "react";

export type PurchaseCartLine = {
  key: string;
  medicineId: string;
  name: string;
  sku?: string | null;
  qty: number;
  freeQty: number;
  unitCostPkr: number;
  discountPkr: number;
  taxPkr: number;
  notes?: string;
};

export type PurchaseCartAddInput = {
  medicineId: string;
  name: string;
  sku?: string | null;
  qty?: number;
  freeQty?: number;
  unitCostPkr?: number;
  discountPkr?: number;
  taxPkr?: number;
  notes?: string;
};

function lineKey(medicineId: string): string {
  return `${medicineId}-${crypto.randomUUID().slice(0, 8)}`;
}

function lineNet(line: PurchaseCartLine): number {
  return Math.max(0, line.qty * line.unitCostPkr - line.discountPkr + line.taxPkr);
}

export function usePurchaseCart() {
  const [lines, setLines] = useState<PurchaseCartLine[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const add = useCallback((input: PurchaseCartAddInput) => {
    const qty = Math.max(1, Math.round(input.qty ?? 1));
    let selectKey: string | null = null;
    setLines((prev) => {
      const mergeIdx = prev.findIndex(
        (l) =>
          l.medicineId === input.medicineId &&
          Math.round(l.unitCostPkr) === Math.round(input.unitCostPkr ?? 0),
      );
      if (mergeIdx >= 0) {
        const next = [...prev];
        const cur = next[mergeIdx]!;
        selectKey = cur.key;
        next[mergeIdx] = {
          ...cur,
          qty: cur.qty + qty,
          freeQty: cur.freeQty + Math.max(0, Math.round(input.freeQty ?? 0)),
          unitCostPkr: input.unitCostPkr ?? cur.unitCostPkr,
          discountPkr: cur.discountPkr + Math.max(0, Number(input.discountPkr ?? 0)),
          taxPkr: cur.taxPkr + Math.max(0, Number(input.taxPkr ?? 0)),
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
          unitCostPkr: Math.max(0, Number(input.unitCostPkr ?? 0)),
          discountPkr: Math.max(0, Number(input.discountPkr ?? 0)),
          taxPkr: Math.max(0, Number(input.taxPkr ?? 0)),
          notes: input.notes,
        },
      ];
    });
    if (selectKey) setSelectedKey(selectKey);
  }, []);

  const update = useCallback((key: string, patch: Partial<PurchaseCartLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        return {
          ...l,
          ...patch,
          qty: patch.qty !== undefined ? Math.max(1, Math.round(patch.qty)) : l.qty,
          freeQty: patch.freeQty !== undefined ? Math.max(0, Math.round(patch.freeQty)) : l.freeQty,
          unitCostPkr:
            patch.unitCostPkr !== undefined ? Math.max(0, Number(patch.unitCostPkr)) : l.unitCostPkr,
          discountPkr:
            patch.discountPkr !== undefined ? Math.max(0, Number(patch.discountPkr)) : l.discountPkr,
          taxPkr: patch.taxPkr !== undefined ? Math.max(0, Number(patch.taxPkr)) : l.taxPkr,
        };
      }),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setSelectedKey((k) => (k === key ? null : k));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setSelectedKey(null);
  }, []);

  const replaceAll = useCallback((next: PurchaseCartLine[]) => {
    setLines(next);
    setSelectedKey(next[0]?.key ?? null);
  }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + lineNet(l), 0);
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    const freeQty = lines.reduce((s, l) => s + l.freeQty, 0);
    return { subtotal, qty, freeQty, lineCount: lines.length };
  }, [lines]);

  const toApiLines = useCallback(
    () =>
      lines.map((l) => ({
        medicineId: l.medicineId,
        quantity: l.qty,
        freeQuantity: l.freeQty,
        unitCostPkr: l.unitCostPkr,
        discountPkr: l.discountPkr,
        taxPkr: l.taxPkr,
        notes: l.notes,
      })),
    [lines],
  );

  return {
    lines,
    selectedKey,
    setSelectedKey,
    add,
    update,
    remove,
    clear,
    replaceAll,
    totals,
    toApiLines,
    lineNet,
  };
}

export type UsePurchaseCartReturn = ReturnType<typeof usePurchaseCart>;
