import { authFetch } from "../../lib/authFetch";

const BASE = "/v1/pharmacy/finance";
const ACC = "/v1/accounting";

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = Array.isArray(err?.message) ? err.message.join("; ") : err?.message;
  throw new Error(message ?? `${fallback}: ${res.status}`);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) await parseError(res, "Finance request failed");
  return res.json() as Promise<T>;
}

function q(params: Record<string, string | number | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") s.set(k, String(v));
  }
  const out = s.toString();
  return out ? `?${out}` : "";
}

export const financeApi = {
  dashboard: (branchCode: string) =>
    getJson<Record<string, unknown>>(`${BASE}/dashboard${q({ branchCode })}`),
  reconciliation: (branchCode: string) =>
    getJson<Record<string, unknown>>(`${BASE}/reconciliation${q({ branchCode })}`),
  customerLedger: (id: string) =>
    getJson<Record<string, unknown>>(`${BASE}/customer-ledger/${id}`),
  supplierLedger: (id: string, branchCode?: string) =>
    getJson<Record<string, unknown>>(`${BASE}/supplier-ledger/${id}${q({ branchCode })}`),
  ledger: (branchCode: string, opts?: Record<string, string | number | undefined>) =>
    getJson<Record<string, unknown>>(`${ACC}/ledger${q({ branchCode, ...opts })}`),
  reverseJournal: async (entryId: string, reason: string) => {
    const res = await authFetch(`${ACC}/journal/${entryId}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) await parseError(res, "Reverse journal failed");
    return res.json() as Promise<Record<string, unknown>>;
  },
  periods: (branchCode: string) =>
    getJson<Record<string, unknown>[]>(`${ACC}/periods${q({ branchCode })}`),
  createPeriod: async (body: { branchCode: string; name: string; startDate: string; endDate: string }) => {
    const res = await authFetch(`${ACC}/periods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) await parseError(res, "Create period failed");
    return res.json() as Promise<Record<string, unknown>>;
  },
  closePeriod: async (periodId: string) => {
    const res = await authFetch(`${ACC}/periods/${periodId}/close`, { method: "PATCH" });
    if (!res.ok) await parseError(res, "Close period failed");
    return res.json() as Promise<Record<string, unknown>>;
  },
  reopenPeriod: async (periodId: string, reason: string) => {
    const res = await authFetch(`${ACC}/periods/${periodId}/reopen`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) await parseError(res, "Reopen period failed");
    return res.json() as Promise<Record<string, unknown>>;
  },
  bankReconciliation: (branchCode: string, bankAccountId: string, statementBalance?: number) =>
    getJson<Record<string, unknown>>(
      `${ACC}/bank-reconciliation${q({ branchCode, bankAccountId, statementBalance })}`,
    ),
  matchBankTxn: async (txnId: string, matched: boolean, statementRef?: string) => {
    const res = await authFetch(`${ACC}/bank-transactions/${txnId}/match`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matched, statementRef }),
    });
    if (!res.ok) await parseError(res, "Match bank transaction failed");
    return res.json() as Promise<Record<string, unknown>>;
  },
};
