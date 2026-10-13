/** Saved Customer report presets — numbered CUST-0001… and kept in localStorage. */

export type SavedCustomerReport = {
  id: string;
  /** Stable human number, e.g. CUST-0001 */
  reportNumber: string;
  name: string;
  /** Tab / report kind on the Customer Reports page */
  tab: string;
  from?: string;
  to?: string;
  q?: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "dist-customer-reports-v1";
const SEQ_KEY = "dist-customer-reports-seq-v1";

function nextReportNumber(existing: SavedCustomerReport[]): string {
  let seq = 0;
  try {
    seq = Number(localStorage.getItem(SEQ_KEY) || "0") || 0;
  } catch {
    seq = 0;
  }
  for (const r of existing) {
    const m = /^CUST-(\d+)$/i.exec(r.reportNumber ?? "");
    if (m) seq = Math.max(seq, Number(m[1]) || 0);
  }
  seq += 1;
  try {
    localStorage.setItem(SEQ_KEY, String(seq));
  } catch {
    /* ignore */
  }
  return `CUST-${String(seq).padStart(4, "0")}`;
}

function normalize(raw: unknown[]): SavedCustomerReport[] {
  const list: SavedCustomerReport[] = [];
  let dirty = false;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<SavedCustomerReport>;
    if (!r.id || !r.tab) continue;
    let reportNumber = typeof r.reportNumber === "string" ? r.reportNumber.trim() : "";
    if (!reportNumber) {
      reportNumber = nextReportNumber(list);
      dirty = true;
    }
    list.push({
      id: String(r.id),
      reportNumber,
      name: String(r.name ?? "Customer report"),
      tab: String(r.tab),
      from: r.from ? String(r.from) : undefined,
      to: r.to ? String(r.to) : undefined,
      q: r.q ? String(r.q) : undefined,
      createdAt: String(r.createdAt ?? new Date().toISOString()),
      updatedAt: String(r.updatedAt ?? r.createdAt ?? new Date().toISOString()),
    });
  }
  if (dirty) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 40)));
    } catch {
      /* ignore */
    }
  }
  return list;
}

export function loadSavedCustomerReports(): SavedCustomerReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? normalize(parsed) : [];
  } catch {
    return [];
  }
}

export function saveCustomerReportPreset(input: {
  id?: string;
  name: string;
  tab: string;
  from?: string;
  to?: string;
  q?: string;
}): SavedCustomerReport {
  const list = loadSavedCustomerReports();
  const now = new Date().toISOString();
  const existing = input.id ? list.find((r) => r.id === input.id) : undefined;
  const next: SavedCustomerReport = existing
    ? {
        ...existing,
        reportNumber: existing.reportNumber || nextReportNumber(list),
        name: input.name.trim() || existing.name,
        tab: input.tab,
        from: input.from,
        to: input.to,
        q: input.q,
        updatedAt: now,
      }
    : {
        id: crypto.randomUUID(),
        reportNumber: nextReportNumber(list),
        name: input.name.trim() || "Customer report",
        tab: input.tab,
        from: input.from,
        to: input.to,
        q: input.q,
        createdAt: now,
        updatedAt: now,
      };
  const updated = existing
    ? list.map((r) => (r.id === next.id ? next : r))
    : [next, ...list];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 40)));
  return next;
}

export function deleteCustomerReportPreset(id: string): void {
  const next = loadSavedCustomerReports().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
