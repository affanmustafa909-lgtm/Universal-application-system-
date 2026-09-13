/** Shehryar Ice Cream — daily sheet (paper form digital twin). */

export const ICE_CREAM_EXPENSE_LINES = [
  { key: "cash_cream", labelUr: "نقد کریم کے پیسے", labelEn: "Cash for cream" },
  { key: "sugar", labelUr: "چینی پاؤڈر", labelEn: "Sugar powder" },
  { key: "ice", labelUr: "برف", labelEn: "Ice" },
  { key: "petrol", labelUr: "پیٹرول", labelEn: "Petrol" },
  { key: "roti", labelUr: "روٹی", labelEn: "Roti" },
  { key: "dmat", labelUr: "ڈیماٹ آئسکریم", labelEn: "D-Mat ice cream" },
  { key: "retail_discount", labelUr: "پرچون رعایت", labelEn: "Retail discount" },
  { key: "soap", labelUr: "صابن + صافی", labelEn: "Soap + cloth" },
  { key: "cups_expense", labelUr: "کپ", labelEn: "Cups (expense)" },
  { key: "checking_waste", labelUr: "چیکنگ + ضائع", labelEn: "Checking + waste" },
  { key: "phenyl", labelUr: "فینیل + پٹی + برش", labelEn: "Phenyl + strip + brush" },
] as const;

export type IceCreamExpenseKey = (typeof ICE_CREAM_EXPENSE_LINES)[number]["key"];

export type IceCreamDailySheet = {
  id: string;
  businessDate: string;
  branchCode: string;
  branchName: string;
  managerName: string;
  expenses: Record<IceCreamExpenseKey, number>;
  cashPkr: number;
  totalSalePkr: number;
  signature: string;
  cups: {
    previous: number;
    dailyIn: number;
    total: number;
    sold: number;
    remaining: number;
    extra: number;
    short: number;
  };
  milkQty: number;
  milkAmountPkr: number;
  creamQty: number;
  creamAmountPkr: number;
  updatedAt: string;
};

export function emptyExpenses(): Record<IceCreamExpenseKey, number> {
  const out = {} as Record<IceCreamExpenseKey, number>;
  for (const line of ICE_CREAM_EXPENSE_LINES) out[line.key] = 0;
  return out;
}

export function sumExpenses(expenses: Record<IceCreamExpenseKey, number>): number {
  return ICE_CREAM_EXPENSE_LINES.reduce((s, line) => s + Math.max(0, Number(expenses[line.key]) || 0), 0);
}

export function recomputeCups(cups: IceCreamDailySheet["cups"]): IceCreamDailySheet["cups"] {
  const previous = Math.max(0, Math.round(Number(cups.previous) || 0));
  const dailyIn = Math.max(0, Math.round(Number(cups.dailyIn) || 0));
  const sold = Math.max(0, Math.round(Number(cups.sold) || 0));
  const total = previous + dailyIn;
  const remaining = Math.max(0, total - sold);
  const extra = Math.max(0, Math.round(Number(cups.extra) || 0));
  const short = Math.max(0, Math.round(Number(cups.short) || 0));
  return { previous, dailyIn, total, sold, remaining, extra, short };
}

export function createBlankSheet(opts: {
  businessDate: string;
  branchCode: string;
  branchName?: string;
  managerName?: string;
}): IceCreamDailySheet {
  return {
    id: `sheet-${opts.businessDate}-${opts.branchCode}`,
    businessDate: opts.businessDate,
    branchCode: opts.branchCode,
    branchName: opts.branchName ?? opts.branchCode,
    managerName: opts.managerName ?? "",
    expenses: emptyExpenses(),
    cashPkr: 0,
    totalSalePkr: 0,
    signature: "",
    cups: { previous: 0, dailyIn: 0, total: 0, sold: 0, remaining: 0, extra: 0, short: 0 },
    milkQty: 0,
    milkAmountPkr: 0,
    creamQty: 0,
    creamAmountPkr: 0,
    updatedAt: new Date().toISOString(),
  };
}

/** Sample filled day so the digital form matches how the paper sheet is used. */
export function createSampleFilledSheet(opts: {
  businessDate: string;
  branchCode: string;
  branchName?: string;
  managerName?: string;
}): IceCreamDailySheet {
  const sheet = createBlankSheet(opts);
  sheet.managerName = opts.managerName ?? "مینجر";
  sheet.expenses = {
    cash_cream: 2500,
    sugar: 1200,
    ice: 800,
    petrol: 1500,
    roti: 400,
    dmat: 3000,
    retail_discount: 500,
    soap: 350,
    cups_expense: 2000,
    checking_waste: 300,
    phenyl: 450,
  };
  sheet.cashPkr = 18500;
  sheet.totalSalePkr = 42000;
  sheet.signature = "Admin";
  sheet.cups = recomputeCups({
    previous: 120,
    dailyIn: 80,
    total: 0,
    sold: 95,
    remaining: 0,
    extra: 5,
    short: 0,
  });
  sheet.milkQty = 40;
  sheet.milkAmountPkr = 8000;
  sheet.creamQty = 15;
  sheet.creamAmountPkr = 6000;
  sheet.updatedAt = new Date().toISOString();
  return sheet;
}

const STORAGE_PREFIX = "ice-cream-daily-sheet-v1:";

export function sheetStorageKey(branchCode: string, businessDate: string): string {
  return `${STORAGE_PREFIX}${branchCode}:${businessDate}`;
}

export function loadDailySheet(branchCode: string, businessDate: string): IceCreamDailySheet | null {
  try {
    const raw = localStorage.getItem(sheetStorageKey(branchCode, businessDate));
    if (!raw) return null;
    return JSON.parse(raw) as IceCreamDailySheet;
  } catch {
    return null;
  }
}

export function saveDailySheet(sheet: IceCreamDailySheet): void {
  const next = {
    ...sheet,
    cups: recomputeCups(sheet.cups),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(sheetStorageKey(sheet.branchCode, sheet.businessDate), JSON.stringify(next));
}

export function listSavedSheetDates(branchCode: string): string[] {
  const prefix = `${STORAGE_PREFIX}${branchCode}:`;
  const dates: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    dates.push(key.slice(prefix.length));
  }
  return dates.sort().reverse();
}
