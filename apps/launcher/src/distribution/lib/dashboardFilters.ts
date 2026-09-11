import type { DistributionDashboardParams } from "../../pharmacy/api/pharmacy-erp";

export const DIST_DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7" },
  { id: "last30", label: "Last 30" },
  { id: "this_month", label: "This month" },
  { id: "previous_month", label: "Prev month" },
  { id: "custom", label: "Custom" },
] as const;

export type DistDatePreset = (typeof DIST_DATE_PRESETS)[number]["id"];

export type DistDashboardUrlFilters = {
  preset: DistDatePreset;
  from?: string;
  to?: string;
  warehouseId?: string;
  companyId?: string;
  salesmanId?: string;
  territoryId?: string;
  routeId?: string;
};

const FILTER_KEYS = [
  "preset",
  "from",
  "to",
  "warehouseId",
  "companyId",
  "salesmanId",
  "territoryId",
  "routeId",
] as const;

function isPreset(v: string | null): v is DistDatePreset {
  return DIST_DATE_PRESETS.some((p) => p.id === v);
}

export function parseDashboardFilters(sp: URLSearchParams): DistDashboardUrlFilters {
  const presetRaw = sp.get("preset");
  const preset: DistDatePreset = isPreset(presetRaw) ? presetRaw : "today";
  const pick = (k: (typeof FILTER_KEYS)[number]) => {
    const v = sp.get(k)?.trim();
    return v || undefined;
  };
  return {
    preset,
    from: pick("from"),
    to: pick("to"),
    warehouseId: pick("warehouseId"),
    companyId: pick("companyId"),
    salesmanId: pick("salesmanId"),
    territoryId: pick("territoryId"),
    routeId: pick("routeId"),
  };
}

/** Write dashboard filter keys into search params (preserves unrelated keys). */
export function writeDashboardFilters(
  sp: URLSearchParams,
  filters: DistDashboardUrlFilters,
): URLSearchParams {
  const next = new URLSearchParams(sp);
  for (const key of FILTER_KEYS) next.delete(key);

  // Omit default "today" to keep URLs clean.
  if (filters.preset !== "today") next.set("preset", filters.preset);

  if (filters.preset === "custom") {
    if (filters.from) next.set("from", filters.from);
    if (filters.to) next.set("to", filters.to);
  }
  if (filters.warehouseId) next.set("warehouseId", filters.warehouseId);
  if (filters.companyId) next.set("companyId", filters.companyId);
  if (filters.salesmanId) next.set("salesmanId", filters.salesmanId);
  if (filters.territoryId) next.set("territoryId", filters.territoryId);
  if (filters.routeId) next.set("routeId", filters.routeId);
  return next;
}

export function clearDashboardFilters(sp: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(sp);
  for (const key of FILTER_KEYS) next.delete(key);
  return next;
}

export function toApiParams(
  filters: DistDashboardUrlFilters,
  branchCode?: string,
  extra?: { limit?: number },
): DistributionDashboardParams {
  const params: DistributionDashboardParams = {
    branchCode: branchCode || undefined,
    warehouseId: filters.warehouseId,
    companyId: filters.companyId,
    salesmanId: filters.salesmanId,
    territoryId: filters.territoryId,
    routeId: filters.routeId,
    preset: filters.preset,
    limit: extra?.limit,
  };
  if (filters.preset === "custom") {
    params.from = filters.from;
    params.to = filters.to;
  }
  return params;
}

export function dashboardFilterKey(filters: DistDashboardUrlFilters, branchCode?: string) {
  return [
    branchCode ?? "",
    filters.preset,
    filters.from ?? "",
    filters.to ?? "",
    filters.warehouseId ?? "",
    filters.companyId ?? "",
    filters.salesmanId ?? "",
    filters.territoryId ?? "",
    filters.routeId ?? "",
  ] as const;
}

export function formatPkr(n: number | undefined | null): string {
  return `Rs ${Number(n ?? 0).toLocaleString()}`;
}

export function formatDeltaPct(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "N/A";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

export function formatMetricDelta(m: { current: number; previous: number; pct: number | null } | undefined): string {
  if (!m) return "N/A";
  return `vs prior: ${formatDeltaPct(m.pct)}`;
}

export function agingBucketLabel(bucket: string): string {
  switch (bucket) {
    case "current_0_30":
      return "Current (0–30)";
    case "d31_60":
      return "31–60";
    case "d61_90":
      return "61–90";
    case "d91_120":
      return "91–120";
    case "d120_plus":
      return "120+";
    default:
      return bucket.replace(/_/g, " ");
  }
}
