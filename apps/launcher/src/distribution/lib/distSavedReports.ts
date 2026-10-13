/**
 * Numbered report archive — every Save assigns a report # and lands here.
 */

import { allocateNextReportNumber } from "./distReportSettings";

export type SavedDistReportSource = "catalog" | "custom";

export type SavedDistReport = {
  id: string;
  reportNumber: string;
  name: string;
  source: SavedDistReportSource;
  /** Catalog report id or custom dataset id */
  reportId: string;
  columns: string[];
  columnLabels?: string[];
  filters?: {
    from?: string;
    to?: string;
    cityId?: string;
    areaId?: string;
    companyId?: string;
    salesmanIds?: string[];
    q?: string;
  };
  /** Snapshot of last printed/saved grid (keeps print faithful). */
  rows?: Record<string, unknown>[];
  rowCount: number;
  look?: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "dist-saved-reports-archive-v1";
const MAX = 80;

export const DIST_SAVED_REPORTS_CHANGED_EVENT = "dist-saved-reports-changed";

function readAll(): SavedDistReport[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r === "object" && (r as SavedDistReport).id)
      .map((r) => {
        const row = r as SavedDistReport;
        return {
          ...row,
          reportNumber: String(row.reportNumber ?? ""),
          name: String(row.name ?? "Report"),
          source: row.source === "custom" ? "custom" : "catalog",
          reportId: String(row.reportId ?? ""),
          columns: Array.isArray(row.columns) ? row.columns.map(String) : [],
          columnLabels: Array.isArray(row.columnLabels) ? row.columnLabels.map(String) : undefined,
          rows: Array.isArray(row.rows) ? row.rows : undefined,
          rowCount: Number(row.rowCount) || (Array.isArray(row.rows) ? row.rows.length : 0),
          createdAt: String(row.createdAt ?? new Date().toISOString()),
          updatedAt: String(row.updatedAt ?? row.createdAt ?? new Date().toISOString()),
        } satisfies SavedDistReport;
      });
  } catch {
    return [];
  }
}

function writeAll(list: SavedDistReport[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent(DIST_SAVED_REPORTS_CHANGED_EVENT));
  } catch {
    /* ignore quota */
  }
}

export function loadSavedDistReports(): SavedDistReport[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSavedDistReport(id: string): SavedDistReport | undefined {
  return readAll().find((r) => r.id === id);
}

export function saveDistReportToArchive(input: {
  id?: string;
  /** Reuse an already-assigned number (avoid double-increment). */
  reportNumber?: string;
  branchCode?: string;
  name: string;
  source: SavedDistReportSource;
  reportId: string;
  columns: string[];
  columnLabels?: string[];
  filters?: SavedDistReport["filters"];
  rows?: Record<string, unknown>[];
  look?: string;
}): SavedDistReport {
  const list = readAll();
  const now = new Date().toISOString();
  const existing = input.id
    ? list.find((r) => r.id === input.id)
    : input.reportNumber
      ? list.find((r) => r.reportNumber === input.reportNumber)
      : undefined;
  const rowCount = input.rows?.length ?? existing?.rowCount ?? 0;
  // Cap stored rows so localStorage stays healthy
  const rows = input.rows?.slice(0, 2000);
  const reportNumber =
    existing?.reportNumber ||
    input.reportNumber?.trim() ||
    allocateNextReportNumber(input.branchCode);

  const next: SavedDistReport = existing
    ? {
        ...existing,
        reportNumber,
        name: input.name.trim() || existing.name,
        source: input.source,
        reportId: input.reportId,
        columns: input.columns,
        columnLabels: input.columnLabels ?? existing.columnLabels,
        filters: input.filters ?? existing.filters,
        rows: rows ?? existing.rows,
        rowCount,
        look: input.look ?? existing.look,
        updatedAt: now,
      }
    : {
        id: crypto.randomUUID(),
        reportNumber,
        name: input.name.trim() || "Saved report",
        source: input.source,
        reportId: input.reportId,
        columns: input.columns,
        columnLabels: input.columnLabels,
        filters: input.filters,
        rows,
        rowCount,
        look: input.look,
        createdAt: now,
        updatedAt: now,
      };

  const updated = existing
    ? list.map((r) => (r.id === next.id ? next : r))
    : [next, ...list];
  writeAll(updated);
  return next;
}

export function deleteSavedDistReport(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}
