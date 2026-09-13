import { isOnline } from "@platform/connectivity";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  searchSaleCustomers,
  type SaleCustomerHit,
} from "../../pharmacy/api/pharmacy-sales";
import {
  cacheDistCustomers,
  searchCachedDistCustomers,
} from "../lib/distOfflineSales";

const DEBOUNCE_MS = 250;

export function useSaleCustomerSearch(opts: {
  branchCode?: string;
  enabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [debounced]);

  const enabled = Boolean(opts.enabled);
  const branchCode = opts.branchCode ?? "";

  const search = useQuery({
    // Always run when branch is set — do not gate on isOnline(); that hid the
    // whole customer list when connectivity falsely reported offline.
    queryKey: ["pharmacy", "sales", "customer-search", branchCode, debounced],
    enabled: enabled && Boolean(branchCode),
    queryFn: async () => {
      if (!isOnline()) {
        return searchCachedDistCustomers(branchCode, debounced);
      }
      try {
        const rows = await searchSaleCustomers({
          branchCode: opts.branchCode,
          q: debounced,
          limit: 40,
        });
        if (branchCode) cacheDistCustomers(branchCode, rows);
        return rows;
      } catch {
        return searchCachedDistCustomers(branchCode, debounced);
      }
    },
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });

  const results: SaleCustomerHit[] = search.data ?? [];
  const highlighted = results[highlightIndex] ?? results[0] ?? null;

  return {
    query,
    setQuery,
    debounced,
    results,
    isLoading: search.isFetching && enabled,
    isError: search.isError && results.length === 0,
    error: search.error instanceof Error ? search.error.message : null,
    highlightIndex,
    setHighlightIndex,
    highlighted,
    moveHighlight: (delta: number) => {
      if (!results.length) return;
      setHighlightIndex((i) => {
        const next = i + delta;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
    },
  };
}

export type UseSaleCustomerSearchReturn = ReturnType<typeof useSaleCustomerSearch>;
