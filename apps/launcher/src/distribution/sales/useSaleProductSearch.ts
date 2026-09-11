import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  lookupSaleProductBarcode,
  searchSaleProducts,
  type SaleProductHit,
} from "../../pharmacy/api/pharmacy-sales";

const DEBOUNCE_MS = 250;

export function useSaleProductSearch(opts: {
  branchCode?: string;
  warehouseId?: string;
  enabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [barcodeNotice, setBarcodeNotice] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const searchingBarcode = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [debounced]);

  const enabled = Boolean(opts.enabled && opts.branchCode && debounced.length >= 1);

  const search = useQuery({
    queryKey: [
      "pharmacy",
      "sales",
      "product-search",
      opts.branchCode,
      opts.warehouseId ?? "",
      debounced,
    ],
    enabled,
    queryFn: ({ signal }) => {
      // TanStack Query aborts via signal when queryKey changes / unmounts.
      void signal;
      return searchSaleProducts({
        branchCode: opts.branchCode!,
        q: debounced,
        warehouseId: opts.warehouseId,
        limit: 40,
      });
    },
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const results: SaleProductHit[] = search.data ?? [];

  const handleBarcode = useCallback(
    async (code: string): Promise<SaleProductHit | null> => {
      if (!opts.branchCode || searchingBarcode.current) return null;
      searchingBarcode.current = true;
      setBarcodeError(null);
      setBarcodeNotice(null);
      try {
        const hit = await lookupSaleProductBarcode({
          branchCode: opts.branchCode,
          code,
          warehouseId: opts.warehouseId,
        });
        if (!hit) {
          setBarcodeError(`No product for barcode ${code}`);
          return null;
        }
        setBarcodeNotice(`Scanned ${hit.name}`);
        setQuery("");
        setDebounced("");
        return hit;
      } catch (err) {
        setBarcodeError(err instanceof Error ? err.message : "Barcode lookup failed");
        return null;
      } finally {
        searchingBarcode.current = false;
      }
    },
    [opts.branchCode, opts.warehouseId],
  );

  const highlighted = results[highlightIndex] ?? results[0] ?? null;

  const moveHighlight = useCallback(
    (delta: number) => {
      if (!results.length) return;
      setHighlightIndex((i) => {
        const next = i + delta;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
    },
    [results.length],
  );

  return {
    query,
    setQuery,
    debounced,
    results,
    isLoading: search.isFetching && enabled,
    isError: search.isError,
    error: search.error instanceof Error ? search.error.message : null,
    highlightIndex,
    setHighlightIndex,
    highlighted,
    moveHighlight,
    handleBarcode,
    barcodeNotice,
    barcodeError,
    clearBarcodeMessages: () => {
      setBarcodeNotice(null);
      setBarcodeError(null);
    },
  };
}

export type UseSaleProductSearchReturn = ReturnType<typeof useSaleProductSearch>;
