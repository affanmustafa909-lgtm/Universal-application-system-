import { useSaleProductSearch } from "../sales/useSaleProductSearch";

/** Product search for PO / requisition lines — wraps Sale Window search. */
export function usePurchaseProductSearch(opts: {
  branchCode?: string;
  warehouseId?: string;
  enabled?: boolean;
}) {
  return useSaleProductSearch(opts);
}

export type UsePurchaseProductSearchReturn = ReturnType<typeof usePurchaseProductSearch>;
