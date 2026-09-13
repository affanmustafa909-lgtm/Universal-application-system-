import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPharmacyLookup, type PharmacyLookupHit } from "../../pharmacy/api/pharmacy-erp";
import { usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { distLookupModuleLabel, distPathForLookup } from "../lib/distLookupPaths";
import { distInputClass } from "../ui/DistUi";

const RECENT_KEY = "dist-global-search-recent-v1";
const DEBOUNCE_MS = 280;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function pushRecent(q: string): void {
  const next = [q, ...loadRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function DistGlobalSearch(): JSX.Element {
  const navigate = useNavigate();
  const { branch } = usePharmacyAccess();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recent, setRecent] = useState(loadRecent);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [q]);

  const search = useQuery({
    queryKey: ["distribution", "global-lookup", debounced, branch?.code],
    queryFn: () => fetchPharmacyLookup(debounced, branch?.code),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const hits: PharmacyLookupHit[] = search.data?.results ?? [];

  useEffect(() => {
    setActiveIdx(0);
  }, [debounced, hits.length]);

  const go = useCallback(
    (hit: PharmacyLookupHit) => {
      pushRecent(hit.name || hit.code);
      setRecent(loadRecent());
      setOpen(false);
      setQ("");
      navigate(distPathForLookup(hit.module, hit.path));
    },
    [navigate],
  );

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && hits[activeIdx]) {
      e.preventDefault();
      go(hits[activeIdx]!);
    }
  }

  return (
    <div className="relative min-w-[12rem] flex-1 max-w-md">
      <label className="sr-only" htmlFor={listId}>
        Global search
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={listId}
          type="search"
          role="combobox"
          aria-expanded={open && (hits.length > 0 || debounced.length >= 2)}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          className={`${distInputClass} pr-16`}
          placeholder="Search medicine, customer, DO, invoice…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 180);
          }}
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          Ctrl+K
        </kbd>
      </div>

      {open ? (
        <div
          id={`${listId}-list`}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950"
        >
          {debounced.length < 2 ? (
            <div className="p-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Recent
              </p>
              {recent.length === 0 ? (
                <p className="px-2 py-2 text-xs text-slate-500">Type at least 2 characters</p>
              ) : (
                recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQ(r);
                      setDebounced(r);
                      setOpen(true);
                    }}
                  >
                    {r}
                  </button>
                ))
              )}
            </div>
          ) : search.isFetching ? (
            <p className="px-3 py-3 text-xs text-slate-500">Searching…</p>
          ) : search.isError ? (
            <p className="px-3 py-3 text-xs text-red-600">{(search.error as Error).message}</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-500">No matches for “{debounced}”</p>
          ) : (
            <ul className="py-1">
              {hits.map((hit, idx) => (
                <li key={`${hit.module}-${hit.id}-${hit.code}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === activeIdx}
                    className={[
                      "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm",
                      idx === activeIdx
                        ? "bg-cyan-50 text-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-100"
                        : "hover:bg-slate-50 dark:hover:bg-slate-900",
                    ].join(" ")}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => go(hit)}
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {hit.name}
                      <span className="ml-2 font-mono text-xs text-slate-500">{hit.code}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {distLookupModuleLabel(hit.module)}
                      {hit.meta ? ` · ${hit.meta}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
