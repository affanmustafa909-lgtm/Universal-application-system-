import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { purchaseApi } from "../../pharmacy/api/pharmacy-purchase";
import { DistInput } from "../ui/DistUi";

/**
 * Manual supplier invoice # with typeahead from past GRNs / purchase invoices.
 * Always allows free text — suggestions are optional picks.
 */
export function SupplierInvoiceSuggest({
  branchCode,
  value,
  onChange,
  supplierId,
  className,
  placeholder = "Type invoice #…",
}: {
  branchCode?: string;
  value: string;
  onChange: (next: string) => void;
  /** When set, prefer suggestions from this supplier. */
  supplierId?: string | null;
  className?: string;
  placeholder?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const history = useQuery({
    queryKey: ["distribution", "purchase", "supplier-invoice-suggest", branchCode],
    enabled: Boolean(branchCode),
    staleTime: 60_000,
    queryFn: async () => {
      const [grns, invoices] = await Promise.all([
        purchaseApi.listGrns({ branchCode: branchCode!, page: 1, pageSize: 100 }),
        purchaseApi.listInvoices({ branchCode: branchCode!, page: 1, pageSize: 100 }),
      ]);
      return { grns: grns.items, invoices: invoices.items };
    },
  });

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const seen = new Set<string>();
    const rows: { number: string; meta: string; supplierMatch: boolean }[] = [];

    const push = (number: string | null | undefined, meta: string, sid?: string | null) => {
      const n = (number ?? "").trim();
      if (!n) return;
      const key = n.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      if (q && !key.includes(q)) return;
      rows.push({
        number: n,
        meta,
        supplierMatch: Boolean(supplierId && sid && sid === supplierId),
      });
    };

    for (const g of history.data?.grns ?? []) {
      push(g.supplierInvoiceNumber, `GRN ${g.grnNumber}`, g.supplierId);
    }
    for (const inv of history.data?.invoices ?? []) {
      push(
        inv.supplierInvoiceNumber,
        `${inv.invoiceNumber}${inv.supplierName ? ` · ${inv.supplierName}` : ""}`,
        inv.supplierId,
      );
    }

    rows.sort((a, b) => {
      if (a.supplierMatch !== b.supplierMatch) return a.supplierMatch ? -1 : 1;
      return a.number.localeCompare(b.number);
    });
    return rows.slice(0, 12);
  }, [history.data, value, supplierId]);

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <DistInput
        className={className}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {showList ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-950">
          {suggestions.map((s) => (
            <li key={s.number}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s.number);
                  setOpen(false);
                }}
              >
                <span className="font-mono font-medium text-slate-800 dark:text-slate-100">{s.number}</span>
                <span className="truncate text-[10px] text-slate-500">{s.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && !history.isLoading && suggestions.length === 0 && value.trim() ? (
        <p className="mt-1 text-[10px] text-slate-500">Naya number — pehle use nahi hua (manual OK).</p>
      ) : null}
    </div>
  );
}
