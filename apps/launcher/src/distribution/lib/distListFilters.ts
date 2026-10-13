/**
 * Shared list-filter helpers for Distribution tables — date range, search, status.
 */

import type { DistFilterValues } from "../ui/DistUi";

export type DistDatePreset = "today" | "7d" | "30d" | "month" | "all";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoLocalDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function presetToRange(preset: DistDatePreset): { from?: string; to?: string } {
  if (preset === "all") return {};
  const to = isoLocalDate();
  if (preset === "today") return { from: to, to };
  if (preset === "month") {
    const d = new Date();
    return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to };
  }
  const days = preset === "7d" ? 7 : 30;
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: isoLocalDate(from), to };
}

/** Extract YYYY-MM-DD from common Dist row date fields. */
export function rowDateKey(row: Record<string, unknown>, fields: string[]): string {
  for (const f of fields) {
    const v = row[f];
    if (v == null || v === "") continue;
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const t = new Date(s);
    if (!Number.isNaN(t.getTime())) return isoLocalDate(t);
  }
  return "";
}

export function rowMatchesDateRange(
  row: Record<string, unknown>,
  filters: Pick<DistFilterValues, "from" | "to">,
  dateFields: string[],
): boolean {
  if (!filters.from && !filters.to) return true;
  const key = rowDateKey(row, dateFields);
  if (!key) return true; // keep rows without dates visible
  if (filters.from && key < filters.from) return false;
  if (filters.to && key > filters.to) return false;
  return true;
}

export function rowMatchesSearch(
  row: Record<string, unknown>,
  q: string | undefined,
  fields: string[],
): boolean {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => String(row[f] ?? "").toLowerCase().includes(needle));
}

export function rowMatchesStatus(
  row: Record<string, unknown>,
  status: string | undefined,
  field = "status",
): boolean {
  if (!status) return true;
  return String(row[field] ?? "").toLowerCase() === status.toLowerCase();
}

/** Generic client-side filter for Dist lists. */
export function filterDistRows<T extends object>(
  rows: T[],
  filters: DistFilterValues,
  opts: {
    dateFields?: string[];
    searchFields?: string[];
    statusField?: string;
  } = {},
): T[] {
  const dateFields = opts.dateFields ?? [
    "createdAt",
    "collectedAt",
    "invoiceDate",
    "orderDate",
    "bookedAt",
    "deliveryDate",
    "postedAt",
    "updatedAt",
  ];
  const searchFields = opts.searchFields ?? [
    "name",
    "code",
    "orderNumber",
    "invoiceNumber",
    "collectionNumber",
    "poNumber",
    "grnNumber",
    "deliveryNumber",
    "reference",
    "customerName",
    "tradeCustomerName",
    "status",
    "notes",
  ];
  return rows.filter((r) => {
    const row = r as Record<string, unknown>;
    if (!rowMatchesDateRange(row, filters, dateFields)) return false;
    if (!rowMatchesSearch(row, filters.q, searchFields)) return false;
    if (!rowMatchesStatus(row, filters.status, opts.statusField ?? "status")) return false;
    return true;
  });
}
