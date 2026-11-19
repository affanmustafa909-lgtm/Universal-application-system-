import { apiFetch } from "./api";

export type SaleRow = {
  id: string;
  brand: string;
  model: string;
  imei: string;
  customerName: string;
  customerPhone: string;
  pricePkr: number;
  cashPkr: number;
  bankPkr: number;
  remainingPkr: number;
  createdAt: string;
};

export type PurchaseRow = {
  id: string;
  brand: string;
  model: string;
  imei: string;
  sellerName: string;
  sellerPhone: string;
  purchasePricePkr: number;
  paidPkr: number;
  remainingPkr: number;
  createdAt: string;
};

export type WebDb = {
  sales: SaleRow[];
  purchases: PurchaseRow[];
  cashOpeningBalancePkr: number;
};

function storageKey(branchCode: string): string {
  return `mobizone-web-db-v1:${branchCode || "MAIN"}`;
}

function emptyDb(): WebDb {
  return { sales: [], purchases: [], cashOpeningBalancePkr: 0 };
}

export function loadDb(branchCode: string): WebDb {
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as Partial<WebDb>;
    return {
      sales: parsed.sales ?? [],
      purchases: parsed.purchases ?? [],
      cashOpeningBalancePkr: Number(parsed.cashOpeningBalancePkr ?? 0) || 0,
    };
  } catch {
    return emptyDb();
  }
}

export function saveDb(branchCode: string, db: WebDb): void {
  localStorage.setItem(storageKey(branchCode), JSON.stringify(db));
}

export function formatPkr(n: number): string {
  return `Rs ${Math.round(n || 0).toLocaleString("en-PK")}`;
}

export function todayTotals(db: WebDb): { sales: number; purchases: number; profit: number } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const iso = start.toISOString();
  const sales = db.sales.filter((s) => s.createdAt >= iso).reduce((a, s) => a + s.pricePkr, 0);
  const purchases = db.purchases
    .filter((p) => p.createdAt >= iso)
    .reduce((a, p) => a + p.purchasePricePkr, 0);
  return { sales, purchases, profit: sales - purchases };
}

export async function syncLedgerFromCloud(branchCode: string, token: string): Promise<WebDb | null> {
  const code = encodeURIComponent(branchCode || "MAIN");
  const res = await apiFetch(`/v1/operations/mobizone-ledger?branchCode=${code}`, {}, token);
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    db?: {
      sales?: Array<Record<string, unknown>>;
      purchases?: Array<Record<string, unknown>>;
      cashOpeningBalancePkr?: number;
    } | null;
  };
  if (!payload.db) return null;
  const mapped: WebDb = {
    cashOpeningBalancePkr: Number(payload.db.cashOpeningBalancePkr ?? 0) || 0,
    sales: (payload.db.sales ?? []).map((s) => ({
      id: String(s.id ?? crypto.randomUUID()),
      brand: String(s.brand ?? ""),
      model: String(s.model ?? ""),
      imei: String(s.imei ?? ""),
      customerName: String(s.customerName ?? ""),
      customerPhone: String(s.customerPhone ?? ""),
      pricePkr: Number(s.pricePkr ?? 0) || 0,
      cashPkr: Number((s.payment as { cashPkr?: number } | undefined)?.cashPkr ?? s.receivedPkr ?? 0) || 0,
      bankPkr: Number((s.payment as { bankPkr?: number } | undefined)?.bankPkr ?? 0) || 0,
      remainingPkr: Number(s.remainingPkr ?? 0) || 0,
      createdAt: String(s.createdAt ?? new Date().toISOString()),
    })),
    purchases: (payload.db.purchases ?? []).map((p) => ({
      id: String(p.id ?? crypto.randomUUID()),
      brand: String(p.brand ?? ""),
      model: String(p.model ?? ""),
      imei: String(p.imei ?? ""),
      sellerName: String(p.sellerName ?? ""),
      sellerPhone: String(p.sellerPhone ?? ""),
      purchasePricePkr: Number(p.purchasePricePkr ?? 0) || 0,
      paidPkr: Number(p.paidPkr ?? 0) || 0,
      remainingPkr: Number(p.remainingPkr ?? 0) || 0,
      createdAt: String(p.createdAt ?? new Date().toISOString()),
    })),
  };
  saveDb(branchCode, mapped);
  return mapped;
}

export async function pushLedgerToCloud(branchCode: string, token: string, db: WebDb): Promise<void> {
  const cloudDb = {
    devices: [],
    customers: [],
    ledger: [],
    expenses: [],
    vouchers: [],
    expenseAccounts: [],
    bankAccounts: [],
    shopkeepers: [],
    cashOpeningBalancePkr: db.cashOpeningBalancePkr,
    sales: db.sales.map((s) => ({
      id: s.id,
      brand: s.brand,
      model: s.model,
      imei: s.imei,
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      pricePkr: s.pricePkr,
      remainingPkr: s.remainingPkr,
      createdAt: s.createdAt,
      payment: { cashPkr: s.cashPkr, bankPkr: s.bankPkr },
    })),
    purchases: db.purchases.map((p) => ({
      id: p.id,
      brand: p.brand,
      model: p.model,
      imei: p.imei,
      sellerName: p.sellerName,
      sellerPhone: p.sellerPhone,
      purchasePricePkr: p.purchasePricePkr,
      paidPkr: p.paidPkr,
      remainingPkr: p.remainingPkr,
      createdAt: p.createdAt,
      payment: { cashPkr: p.paidPkr, bankPkr: 0 },
    })),
  };
  await apiFetch(
    "/v1/operations/mobizone-ledger",
    {
      method: "PUT",
      body: JSON.stringify({
        branchCode,
        revisedAt: new Date().toISOString(),
        db: cloudDb,
      }),
    },
    token,
  );
}
