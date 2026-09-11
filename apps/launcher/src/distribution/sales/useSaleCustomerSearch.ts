import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  searchSaleCustomers,
  type SaleCustomerHit,
} from "../../pharmacy/api/pharmacy-sales";

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

  const enabled = Boolean(opts.enabled && debounced.length >= 1);

  const search = useQuery({
    queryKey: ["pharmacy", "sales", "customer-search", opts.branchCode ?? "", debounced],
    enabled,
    queryFn: () =>
      searchSaleCustomers({
        branchCode: opts.branchCode,
        q: debounced,
        limit: 25,
      }),
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
    isError: search.isError,
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
