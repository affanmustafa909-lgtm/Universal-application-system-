import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";

export type DistPrintLine = {
  label: string;
  qty: number;
  unitPrice: number;
  /** Free / bonus qty (schemes) — shown separately when > 0 */
  freeQty?: number;
  /** Optional batch / SKU note under the item name */
  note?: string;
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
  const printedAt = new Date().toLocaleString();
  const branchLine = [opts.branchName, opts.branchCode].filter(Boolean).join(" · ");

  const metaRows = (opts.meta ?? [])
    .filter((m) => m.value != null && String(m.value).trim() !== "")
    .map(
      (m) =>
        `<div class="meta-cell"><span class="meta-label">${escapeHtml(m.label)}</span><span class="meta-value">${escapeHtml(m.value)}</span></div>`,
    )
    .join("");

  let bodyTable: string;
  if (opts.report) {
    const head = opts.report.columns
      .map((c) => `<th>${escapeHtml(c)}</th>`)
      .join("");
    const rows = opts.report.rows
      .map(
        (r) =>
          `<tr>${opts.report!.columns
            .map((c) => `<td>${escapeHtml(r[c])}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    bodyTable = `<table class="lines">
      <thead><tr>${head}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${Math.max(1, opts.report.columns.length)}">No rows</td></tr>`}</tbody>
    </table>`;
  } else {
    const lines = opts.lines ?? [];
    const lineRows = lines
      .map((l, i) => {
        const amount = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
        const free =
          l.freeQty && l.freeQty > 0
            ? `<div class="line-note">+ ${formatQty(l.freeQty)} free</div>`
            : "";
        const note = l.note ? `<div class="line-note">${escapeHtml(l.note)}</div>` : "";
        return `<tr>
          <td class="num">${i + 1}</td>
          <td>${escapeHtml(l.label)}${free}${note}</td>
          <td class="num">${formatQty(l.qty)}</td>
          <td class="num">${formatRs(l.unitPrice)}</td>
          <td class="num">${formatRs(amount)}</td>
        </tr>`;
      })
      .join("");
    bodyTable = `<table class="lines">
      <thead>
        <tr>
          <th class="num" style="width:2.5rem">#</th>
          <th>Item</th>
          <th class="num" style="width:4.5rem">Qty</th>
          <th class="num" style="width:6.5rem">Rate</th>
          <th class="num" style="width:7rem">Amount</th>
        </tr>
      </thead>
      <tbody>${lineRows || `<tr><td colspan="5">No lines</td></tr>`}</tbody>
    </table>`;
  }

  const subtotal = opts.subtotalPkr;
  const discount = opts.discountPkr ?? 0;
  const tax = opts.taxPkr ?? 0;
  const total = opts.totalPkr;
  const totalsBlock =
    total != null
      ? `<div class="totals">
          ${subtotal != null ? `<div class="tot-row"><span>Subtotal</span><span>${formatRs(subtotal)}</span></div>` : ""}
          ${discount > 0 ? `<div class="tot-row"><span>Discount</span><span>− ${formatRs(discount)}</span></div>` : ""}
          ${tax > 0 ? `<div class="tot-row"><span>Tax</span><span>${formatRs(tax)}</span></div>` : ""}
          <div class="tot-row tot-grand"><span>Total</span><span>${formatRs(total)}</span></div>
        </div>`
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${escapeHtml(opts.title)} ${escapeHtml(opts.documentNumber)}</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --line:#cbd5e1; --head:#0e7490; --band:#ecfeff; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Calibri, Arial, sans-serif;
    color: var(--ink);
    margin: 0;
    padding: 14mm 12mm;
    font-size: 12px;
    line-height: 1.35;
  }
  .sheet { max-width: 210mm; margin: 0 auto; }
  .brand-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    border-bottom: 3px solid var(--head);
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .brand-name {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: var(--head);
    margin: 0;
  }
  .brand-sub { color: var(--muted); font-size: 11px; margin: 2px 0 0; }
  .doc-badge {
    text-align: right;
    background: var(--band);
    border: 1px solid #a5f3fc;
    border-radius: 6px;
    padding: 8px 12px;
    min-width: 11rem;
  }
  .doc-badge .doc-title {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--head);
    margin: 0;
  }
  .doc-badge .doc-no { font-size: 14px; font-weight: 700; margin: 4px 0 0; }
  .party {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  .party-box {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 10px 12px;
    background: #f8fafc;
  }
  .party-box .lbl {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin: 0 0 4px;
  }
  .party-box .val { font-size: 14px; font-weight: 700; margin: 0; }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: 8px;
    margin-bottom: 14px;
  }
  .meta-cell {
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 6px 8px;
  }
  .meta-label {
    display: block;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .meta-value { font-weight: 600; font-size: 12px; }
  table.lines {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
    font-size: 11.5px;
  }
  table.lines th {
    background: var(--head);
    color: #fff;
    text-align: left;
    padding: 7px 8px;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  table.lines th.num, table.lines td.num { text-align: right; }
  table.lines td {
    padding: 7px 8px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  table.lines tbody tr:nth-child(even) td { background: #f8fafc; }
  .line-note { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .totals {
    margin-top: 12px;
    margin-left: auto;
    width: 14rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
  }
  .tot-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 10px;
    font-size: 12px;
  }
  .tot-grand {
    background: var(--head);
    color: #fff;
    font-weight: 800;
    font-size: 14px;
    padding: 8px 10px;
  }
  .signs {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 36px;
  }
  .sign {
    border-top: 1px solid var(--ink);
    padding-top: 6px;
    font-size: 11px;
    color: var(--muted);
    text-align: center;
  }
  .footer {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px dashed var(--line);
    font-size: 10px;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  @media print {
    body { padding: 8mm 10mm; }
    .sheet { max-width: none; }
  }
</style></head><body>
  <div class="sheet">
    <div class="brand-bar">
      <div>
        <p class="brand-name">Medical Distribution</p>
        <p class="brand-sub">${escapeHtml(branchLine || "Wholesale ERP")}</p>
      </div>
      <div class="doc-badge">
        <p class="doc-title">${escapeHtml(opts.title)}</p>
        <p class="doc-no">${escapeHtml(opts.documentNumber)}</p>
      </div>
    </div>

    <div class="party">
      <div class="party-box">
        <p class="lbl">${escapeHtml(opts.partyLabel)}</p>
        <p class="val">${escapeHtml(opts.partyName || "—")}</p>
        ${
          opts.partyExtra
            ? `<p class="brand-sub" style="margin-top:4px;white-space:pre-line">${escapeHtml(opts.partyExtra)}</p>`
            : ""
        }
      </div>
      <div class="party-box">
        <p class="lbl">Branch</p>
        <p class="val">${escapeHtml(opts.branchName || opts.branchCode || "—")}</p>
        ${opts.branchCode && opts.branchName ? `<p class="brand-sub" style="margin-top:2px">${escapeHtml(opts.branchCode)}</p>` : ""}
      </div>
    </div>

    ${metaRows ? `<div class="meta-grid">${metaRows}</div>` : ""}

    ${bodyTable}
    ${totalsBlock}

    <div class="signs">
      <div class="sign">Prepared by</div>
      <div class="sign">Checked / Authorized</div>
      <div class="sign">Received by</div>
    </div>

    <div class="footer">
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
      { label: "Order #", value: opts.orderNumber },
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
      tps > 1 || spb > 1 ? `${Math.max(1, tps)} goli × ${Math.max(1, spb)} pata` : "";
    const unit = clean(l.unit);
    const note = [sku, company, pack, unit].filter(Boolean).join(" · ") || undefined;
    return {
      label: name,
      qty: Number(l.quantity ?? 0),
      unitPrice: Number(l.unitPricePkr ?? 0),
      freeQty: Number(l.freeQuantity ?? 0) > 0 ? Number(l.freeQuantity) : undefined,
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
