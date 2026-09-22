import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";

export type DistPrintLine = {
  label: string;
  qty: number;
  unitPrice: number;
  /** Free / bonus qty (schemes) — shown separately when > 0 */
  freeQty?: number;
  /** Optional batch / SKU note under the item name */
  note?: string;
  /** Pack size e.g. 10 goli × 10 pata */
  pack?: string;
  batch?: string;
  expiry?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRs(n: number): string {
  return `Rs ${Math.round(Number(n) || 0).toLocaleString("en-PK")}`;
}

function formatQty(n: number): string {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`.trim();
}

function threeDigits(n: number): string {
  if (n < 100) return twoDigits(n);
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ""}`;
}

/** Pakistani numbering (thousand / lakh / crore) for invoice amount in words. */
export function amountInWordsPkr(n: number): string {
  const num = Math.round(Math.abs(Number(n) || 0));
  if (num === 0) return "Zero Rupees Only";
  const crore = Math.floor(num / 10_000_000);
  const lakh = Math.floor((num % 10_000_000) / 100_000);
  const thousand = Math.floor((num % 100_000) / 1_000);
  const rest = num % 1_000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `${parts.join(" ")} Rupees Only`;
}

/** Shared Dist wholesale document chrome (A4) — booking, invoice, PO, GRN, collection, reports. */
function buildDistDocumentHtml(opts: {
  title: string;
  documentNumber: string;
  branchName?: string;
  branchCode?: string;
  partyLabel: string;
  partyName: string;
  /** Phone / code / address under party name */
  partyExtra?: string;
  meta?: Array<{ label: string; value: string }>;
  lines?: DistPrintLine[];
  /** When set, renders a report table instead of item lines */
  report?: { columns: string[]; rows: Record<string, unknown>[] };
  totalPkr?: number;
  subtotalPkr?: number;
  discountPkr?: number;
  taxPkr?: number;
  footerNote?: string;
}): string {
  const printedAt = new Date().toLocaleString("en-PK");
  const companyName = (opts.branchName || "Medical Distribution").trim();
  const companySub = [opts.branchCode ? `Branch ${opts.branchCode}` : "", "Wholesale Medical Distribution"]
    .filter(Boolean)
    .join(" · ");

  const meta = (opts.meta ?? []).filter((m) => m.value != null && String(m.value).trim() !== "");
  const renderMetaList = (rows: Array<{ label: string; value: string }>) =>
    rows
      .map(
        (m) =>
          `<tr><td class="k">${escapeHtml(m.label)}</td><td class="v">${escapeHtml(m.value)}</td></tr>`,
      )
      .join("");

  let bodyTable: string;
  if (opts.report) {
    const head = opts.report.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const rows = opts.report.rows
      .map(
        (r) =>
          `<tr>${opts.report!.columns.map((c) => `<td>${escapeHtml(r[c])}</td>`).join("")}</tr>`,
      )
      .join("");
    bodyTable = `<table class="grid">
      <thead><tr>${head}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${Math.max(1, opts.report.columns.length)}">No rows</td></tr>`}</tbody>
    </table>`;
  } else {
    const lines = opts.lines ?? [];
    const lineRows = lines
      .map((l, i) => {
        const amount = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
        const extra = [l.note, l.batch ? `Batch ${l.batch}` : "", l.expiry ? `Exp ${l.expiry}` : ""]
          .filter((x) => x && String(x).trim())
          .join(" · ");
        return `<tr>
          <td class="c">${i + 1}</td>
          <td>${escapeHtml(l.label)}${extra ? `<div class="sub">${escapeHtml(extra)}</div>` : ""}</td>
          <td class="c">${escapeHtml(l.pack || "—")}</td>
          <td class="n">${formatQty(l.qty)}</td>
          <td class="n">${l.freeQty && l.freeQty > 0 ? formatQty(l.freeQty) : "—"}</td>
          <td class="n">${formatRs(l.unitPrice)}</td>
          <td class="n">${formatRs(amount)}</td>
        </tr>`;
      })
      .join("");
    bodyTable = `<table class="grid">
      <thead>
        <tr>
          <th class="c" style="width:28px">Sr</th>
          <th>Product</th>
          <th class="c" style="width:72px">Pack</th>
          <th class="n" style="width:52px">Qty</th>
          <th class="n" style="width:52px">Bonus</th>
          <th class="n" style="width:88px">Rate</th>
          <th class="n" style="width:96px">Amount</th>
        </tr>
      </thead>
      <tbody>${lineRows || `<tr><td colspan="7">No lines</td></tr>`}</tbody>
    </table>`;
  }

  const subtotal = opts.subtotalPkr;
  const discount = opts.discountPkr ?? 0;
  const tax = opts.taxPkr ?? 0;
  const total = opts.totalPkr;
  const totalsBlock =
    total != null
      ? `<div class="bottom">
          <div class="words"><b>Amount in words:</b> ${escapeHtml(amountInWordsPkr(total))}</div>
          <table class="totals">
            ${subtotal != null ? `<tr><td>Gross Amount</td><td class="n">${formatRs(subtotal)}</td></tr>` : ""}
            ${discount > 0 ? `<tr><td>Discount</td><td class="n">− ${formatRs(discount)}</td></tr>` : ""}
            ${tax > 0 ? `<tr><td>Sales Tax</td><td class="n">${formatRs(tax)}</td></tr>` : ""}
            <tr class="net"><td>Net Amount</td><td class="n">${formatRs(total)}</td></tr>
          </table>
        </div>`
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${escapeHtml(opts.title)} ${escapeHtml(opts.documentNumber)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Tahoma, sans-serif;
    color: #000;
    margin: 0;
    padding: 8mm 8mm;
    font-size: 11px;
    line-height: 1.3;
  }
  .sheet { max-width: 190mm; margin: 0 auto; }
  .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 0; }
  .co { font-size: 18px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin: 0; }
  .co-sub { font-size: 10px; margin: 2px 0 0; }
  .doc-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #000;
    border-top: none;
    padding: 5px 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 13px;
  }
  .doc-bar .no { font-size: 12px; letter-spacing: 0; font-weight: 700; }
  table.info { width: 100%; border-collapse: collapse; margin-top: 0; }
  table.info td { vertical-align: top; padding: 6px 8px; border: 1px solid #000; width: 50%; }
  .who .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; }
  .who .name { font-size: 13px; font-weight: 800; margin: 2px 0; }
  .who .extra { white-space: pre-line; font-size: 10px; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv td { border: none !important; padding: 1px 0; font-size: 10px; }
  table.kv td.k { width: 38%; font-weight: 700; }
  table.grid { width: 100%; border-collapse: collapse; margin-top: 0; }
  table.grid th, table.grid td { border: 1px solid #000; padding: 4px 5px; vertical-align: top; }
  table.grid th { background: #000; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
  table.grid td { font-size: 11px; }
  table.grid .c { text-align: center; }
  table.grid .n, table.totals .n { text-align: right; white-space: nowrap; }
  table.grid tbody tr:nth-child(even) td { background: #f3f3f3; }
  .sub { font-size: 9px; color: #333; margin-top: 1px; }
  .bottom { display: flex; align-items: stretch; gap: 0; }
  table.totals { width: 58mm; border-collapse: collapse; flex-shrink: 0; }
  table.totals td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
  table.totals tr:first-child td { border-top: none; }
  table.totals tr.net td { font-weight: 800; font-size: 12px; background: #000; color: #fff; }
  .words { flex: 1; border: 1px solid #000; border-top: none; border-right: none; padding: 6px 8px; font-size: 10px; }
  .signs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-top: 28px; }
  .sign { border-top: 1px solid #000; padding-top: 4px; font-size: 10px; text-align: center; }
  .foot { margin-top: 14px; border-top: 1px solid #000; padding-top: 4px; font-size: 9px; display: flex; justify-content: space-between; gap: 12px; }
  @media print {
    body { padding: 0; }
    .sheet { max-width: none; }
  }
</style></head><body>
  <div class="sheet">
    <div class="head">
      <p class="co">${escapeHtml(companyName)}</p>
      <p class="co-sub">${escapeHtml(companySub)}</p>
    </div>
    <div class="doc-bar">
      <span>${escapeHtml(opts.title)}</span>
      <span class="no">No. ${escapeHtml(opts.documentNumber)}</span>
    </div>

    <table class="info">
      <tr>
        <td class="who">
          <div class="lbl">${escapeHtml(opts.partyLabel)}</div>
          <div class="name">${escapeHtml(opts.partyName || "—")}</div>
          ${opts.partyExtra ? `<div class="extra">${escapeHtml(opts.partyExtra)}</div>` : ""}
        </td>
        <td>
          <table class="kv">
            ${
              meta.length
                ? renderMetaList(meta)
                : `<tr><td class="k">Branch</td><td class="v">${escapeHtml(opts.branchName || opts.branchCode || "—")}</td></tr>`
            }
          </table>
        </td>
      </tr>
    </table>

    ${bodyTable}
    ${totalsBlock}

    <div class="signs">
      <div class="sign">Prepared by</div>
      <div class="sign">Checked / Authorized</div>
      <div class="sign">Received by</div>
    </div>

    <div class="foot">
      <span>${escapeHtml(opts.footerNote || "Computer-generated distribution document")}</span>
      <span>Printed ${escapeHtml(printedAt)}</span>
    </div>
  </div>
</body></html>`;
}

async function openDistPrint(html: string, title: string): Promise<void> {
  const opened = await printHtmlDocumentAndWait(html, title);
  if (!opened) {
    throw new Error("Could not open the print dialog. Allow popups / hard-refresh and try again.");
  }
}

/** Report / register print — Dist A4 table document. */
export async function printDistReportDocument(opts: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  branchName?: string;
  branchCode?: string;
}): Promise<void> {
  const html = buildDistDocumentHtml({
    title: opts.title,
    documentNumber: opts.subtitle || `${opts.rows.length} row(s)`,
    branchName: opts.branchName,
    branchCode: opts.branchCode,
    partyLabel: "Register",
    partyName: opts.title,
    report: { columns: opts.columns, rows: opts.rows },
    footerNote: "Distribution report register",
  });
  await openDistPrint(html, opts.title);
}

/**
 * Sale Window Book & Print — Dist wholesale A4 order receipt
 * (not restaurant thermal slip).
 */
export async function printDistBookingSlip(opts: {
  branchName: string;
  branchCode: string;
  orderNumber: string;
  customerName: string;
  customerCode?: string;
  customerPhone?: string;
  customerAddress?: string;
  lines: DistPrintLine[];
  totalPkr: number;
  subtotalPkr?: number;
  discountPkr?: number;
  taxPkr?: number;
  modeLabel?: string;
  invoiceNumber?: string;
  salesmanName?: string;
  warehouseName?: string;
  warehouseCode?: string;
  paymentMethod?: string;
  status?: string;
  bookedAt?: string | Date | null;
}): Promise<void> {
  if (!opts.lines.length) {
    throw new Error("Nothing to print.");
  }
  const computedSubtotal = opts.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const subtotal = opts.subtotalPkr ?? computedSubtotal;
  const discount =
    opts.discountPkr != null
      ? Math.max(0, opts.discountPkr)
      : Math.max(0, subtotal - opts.totalPkr);
  const partyExtra = [
    opts.customerCode ? `Code: ${opts.customerCode}` : "",
    opts.customerPhone ? `Phone: ${opts.customerPhone}` : "",
    opts.customerAddress || "",
  ]
    .filter(Boolean)
    .join("\n");
  const warehouse =
    [opts.warehouseName, opts.warehouseCode].filter(Boolean).join(" · ") || undefined;
  const booked =
    opts.bookedAt != null
      ? new Date(opts.bookedAt).toLocaleString()
      : new Date().toLocaleString();

  const html = buildDistDocumentHtml({
    title: opts.modeLabel ?? "Distribution order",
    documentNumber: opts.orderNumber,
    branchName: opts.branchName,
    branchCode: opts.branchCode,
    partyLabel: "Trade customer",
    partyName: opts.customerName,
    partyExtra: partyExtra || undefined,
    meta: [
      ...(opts.invoiceNumber ? [{ label: "Invoice", value: opts.invoiceNumber }] : []),
      { label: "Type", value: opts.modeLabel ?? "Booking" },
      ...(opts.paymentMethod ? [{ label: "Payment", value: opts.paymentMethod }] : []),
      ...(opts.status ? [{ label: "Status", value: opts.status }] : []),
      ...(opts.salesmanName ? [{ label: "Salesman", value: opts.salesmanName }] : []),
      ...(warehouse ? [{ label: "Warehouse", value: warehouse }] : []),
      { label: "Date", value: booked },
    ],
    lines: opts.lines,
    subtotalPkr: subtotal,
    discountPkr: discount,
    taxPkr: opts.taxPkr,
    totalPkr: opts.totalPkr,
    footerNote: "Distribution order receipt — present with delivery / invoice",
  });
  await openDistPrint(html, `${opts.modeLabel ?? "Order"} ${opts.orderNumber}`);
}

/** Map enriched GET /distribution/orders/:id payload → Dist A4 receipt. */
export async function printDistOrderReceipt(
  detail: Record<string, unknown>,
  fallback?: { branchName?: string; branchCode?: string },
): Promise<void> {
  const looksUuid = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
  const clean = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s && !looksUuid(s) ? s : "";
  };

  const linesRaw = Array.isArray(detail.lines) ? detail.lines : [];
  const lines: DistPrintLine[] = linesRaw.map((raw) => {
    const l = raw as Record<string, unknown>;
    const name = clean(l.medicineName) || clean(l.name) || "Item";
    const sku = clean(l.medicineSku) || clean(l.sku);
    const company = clean(l.companyName);
    const tps = Number(l.tabletsPerStrip ?? 0) || 0;
    const spb = Number(l.stripsPerBox ?? 0) || 0;
    const pack =
      tps > 1 || spb > 1 ? `${Math.max(1, tps)}×${Math.max(1, spb)}` : clean(l.unit) || undefined;
    const batch = clean(l.batchNumber) || clean(l.batch);
    const expiry = clean(l.expiryDate) || clean(l.expiry);
    const note = [sku, company].filter(Boolean).join(" · ") || undefined;
    return {
      label: name,
      qty: Number(l.quantity ?? 0),
      unitPrice: Number(l.unitPricePkr ?? 0),
      freeQty: Number(l.freeQuantity ?? 0) > 0 ? Number(l.freeQuantity) : undefined,
      pack,
      batch: batch || undefined,
      expiry: expiry || undefined,
      note,
    };
  });
  if (!lines.length) {
    throw new Error("Order has no lines to print.");
  }

  const customerName =
    clean(detail.customerName) || clean(detail.tradeCustomerName) || "Customer";
  const warehouseName = clean(detail.warehouseName) || undefined;
  const warehouseCode = clean(detail.warehouseCode) || undefined;
  const salesmanName = clean(detail.salesmanName) || undefined;
  const paymentMethod = clean(detail.paymentMethod) || undefined;
  const status = clean(detail.status) || undefined;
  const branchName = clean(detail.branchName) || fallback?.branchName || undefined;
  const branchCode = clean(detail.branchCode) || fallback?.branchCode || undefined;
  const orderNumber = clean(detail.orderNumber) || "ORDER";
  const subtotal = Number(detail.subtotalPkr ?? 0);
  const discount = Number(detail.discountPkr ?? 0);
  const tax = Number(detail.taxPkr ?? 0);
  const total = Number(detail.totalPkr ?? 0) || lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  await printDistBookingSlip({
    branchName: branchName || branchCode || "Branch",
    branchCode: branchCode || "",
    orderNumber,
    customerName,
    customerCode: clean(detail.customerCode) || undefined,
    customerPhone: clean(detail.customerPhone) || undefined,
    customerAddress: clean(detail.customerAddress) || undefined,
    lines,
    subtotalPkr: subtotal || undefined,
    discountPkr: discount || undefined,
    taxPkr: tax || undefined,
    totalPkr: total,
    modeLabel: paymentMethod === "Cash" ? "Cash sale" : "Distribution order",
    invoiceNumber: clean(detail.invoiceNumber) || undefined,
    salesmanName,
    warehouseName,
    warehouseCode,
    paymentMethod,
    status,
    bookedAt: (detail.bookedAt ?? detail.createdAt) as string | Date | null | undefined,
  });
}

/** A4 Dist document — invoices, GRN, PO, collections, deliveries. */
export async function printDistDocument(opts: {
  title: string;
  documentNumber: string;
  partyLabel: string;
  partyName: string;
  partyExtra?: string;
  branchName?: string;
  branchCode?: string;
  meta?: Array<{ label: string; value: string }>;
  lines: DistPrintLine[];
  totalPkr: number;
  subtotalPkr?: number;
  discountPkr?: number;
  taxPkr?: number;
  footerNote?: string;
}): Promise<void> {
  const subtotal =
    opts.subtotalPkr ?? opts.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const html = buildDistDocumentHtml({
    title: opts.title,
    documentNumber: opts.documentNumber,
    branchName: opts.branchName,
    branchCode: opts.branchCode,
    partyLabel: opts.partyLabel,
    partyName: opts.partyName,
    partyExtra: opts.partyExtra,
    meta: opts.meta,
    lines: opts.lines,
    subtotalPkr: subtotal,
    discountPkr: opts.discountPkr,
    taxPkr: opts.taxPkr,
    totalPkr: opts.totalPkr,
    footerNote: opts.footerNote ?? "Medical distribution document",
  });
  await openDistPrint(html, `${opts.title} ${opts.documentNumber}`);
}
