export type ReportSummaryItem = {
  key: string;
  label: string;
  value: number;
  money: boolean;
};

const MONEY = /pkr|amount|sales|credit|outstanding|received|collected|paid|due|over|balance|target/i;
const SKIP = /pct|percent|days$/i;

/** Credit figures the user asked to see on a built report, in this order. */
const HIGHLIGHTS: { label: string; keys: string[] }[] = [
  { label: "Credit", keys: ["creditLimitPkr"] },
  { label: "Received", keys: ["receivedPkr", "collectedPkr", "amountPaidPkr"] },
  { label: "Left to receive", keys: ["leftToReceivePkr", "outstandingPkr", "amountDuePkr"] },
  { label: "Available credit", keys: ["availableCreditPkr"] },
  { label: "Over credit", keys: ["overByPkr"] },
];

function sumColumn(rows: Record<string, unknown>[], key: string): number | null {
  let sum = 0;
  let seen = 0;
  for (const row of rows) {
    const raw = row[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    sum += raw;
    seen += 1;
  }
  return seen ? sum : null;
}

/** Totals for the columns in this report — each built report gets its own summary. */
export function summarizeReportRows(
  columns: string[],
  rows: Record<string, unknown>[],
  labelFor: (key: string) => string,
): ReportSummaryItem[] {
  const present = new Set(columns);
  const used = new Set<string>();
  const items: ReportSummaryItem[] = [
    { key: "__rows", label: "Rows", value: rows.length, money: false },
  ];

  for (const highlight of HIGHLIGHTS) {
    const key = highlight.keys.find((candidate) => present.has(candidate));
    if (!key) continue;
    const value = sumColumn(rows, key);
    if (value == null) continue;
    for (const candidate of highlight.keys) used.add(candidate);
    items.push({ key, label: highlight.label, value, money: true });
  }

  for (const key of columns) {
    if (used.has(key) || SKIP.test(key)) continue;
    const value = sumColumn(rows, key);
    if (value == null) continue;
    used.add(key);
    items.push({
      key,
      label: labelFor(key),
      value,
      money: MONEY.test(key),
    });
  }

  return items;
}

export function formatSummaryValue(item: ReportSummaryItem): string {
  if (!item.money) return item.value.toLocaleString();
  return `Rs ${Math.round(item.value).toLocaleString()}`;
}

export function summarySubtitle(items: ReportSummaryItem[]): string {
  return items.map((item) => `${item.label} ${formatSummaryValue(item)}`).join(" · ");
}
