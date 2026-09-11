import {
  printHtmlDocumentAndWait,
  printReceiptDetailed,
  withPrinterProfile,
  type PrintTicketInput,
} from "../../pops/lib/printTicket";
import { resolveReceiptPrinter } from "../../pops/lib/printerRouting";
import { loadBillPrintSettings } from "../../pops/lib/billPrintSettings";
import { useSessionStore } from "../../stores/sessionStore";

export type DistPrintLine = { label: string; qty: number; unitPrice: number };

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Report / table print via hidden iframe (no popup blocker / noopener issues). */
export async function printDistReportDocument(opts: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Record<string, unknown>[];
}): Promise<void> {
  const head = opts.columns
    .map((c) => `<th style="text-align:left;padding:6px;border:1px solid #ccc;background:#f3f4f6">${escapeHtml(c)}</th>`)
    .join("");
  const body = opts.rows
    .map(
      (r) =>
        `<tr>${opts.columns
          .map(
            (c) =>
              `<td style="padding:6px;border:1px solid #eee">${escapeHtml(r[c])}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(opts.title)}</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;padding:16px;color:#111}
  h1{font-size:18px;margin:0 0 6px}
  p{font-size:12px;color:#555;margin:0 0 12px}
  table{border-collapse:collapse;width:100%;font-size:11px}
  @media print{body{padding:0}}
</style></head><body>
  <h1>${escapeHtml(opts.title)}</h1>
  ${opts.subtitle ? `<p>${escapeHtml(opts.subtitle)}</p>` : ""}
  <table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${Math.max(1, opts.columns.length)}">No rows</td></tr>`}</tbody></table>
</body></html>`;

  const opened = await printHtmlDocumentAndWait(html, opts.title);
  if (!opened) {
    throw new Error("Could not open the print dialog. Allow popups / hard-refresh and try again.");
  }
}

export async function printDistBookingSlip(opts: {
  branchName: string;
  branchCode: string;
  orderNumber: string;
  customerName: string;
  lines: DistPrintLine[];
  totalPkr: number;
  modeLabel?: string;
}): Promise<void> {
  if (!opts.lines.length) {
    throw new Error("Nothing to print.");
  }
  const subtotal = opts.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const base: Omit<PrintTicketInput, "kind"> = {
    branchName: opts.branchName,
    branchCode: opts.branchCode,
    orderRef: opts.orderNumber,
    billRef: opts.orderNumber,
    modeLabel: opts.modeLabel ?? "Booking",
    tableLabel: opts.customerName,
    waiterName: "Distribution",
    notes: `Trade: ${opts.customerName}`,
    lines: opts.lines.map((l) => ({ label: l.label, qty: l.qty, unitPrice: l.unitPrice })),
    subtotal,
    discount: Math.max(0, subtotal - opts.totalPkr),
    service: 0,
    tax: 0,
    total: opts.totalPkr,
    servicePct: 0,
    discountPct: 0,
    billPrintSettings: loadBillPrintSettings(opts.branchCode),
  };
  const userId = useSessionStore.getState().claims?.sub ?? null;
  const profile = resolveReceiptPrinter(opts.branchCode, userId);
  const result = await printReceiptDetailed(withPrinterProfile(base, profile));
  if (result.ok) return;

  // Fallback: force OS print dialog (works in browser even when thermal station is off).
  const dialog = await printReceiptDetailed({
    ...base,
    systemPrinterName: undefined,
    printerName: undefined,
  });
  if (!dialog.ok) {
    throw new Error(result.error || dialog.error || "Print failed.");
  }
}

/** A4 / A5 document print — invoices, GRN, collections. Not restaurant/kitchen tickets. */
export async function printDistDocument(opts: {
  title: string;
  documentNumber: string;
  partyLabel: string;
  partyName: string;
  meta?: Array<{ label: string; value: string }>;
  lines: DistPrintLine[];
  totalPkr: number;
}): Promise<void> {
  const lineRows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px;border:1px solid #eee">${escapeHtml(l.label)}</td><td style="padding:6px;border:1px solid #eee;text-align:right">${l.qty}</td><td style="padding:6px;border:1px solid #eee;text-align:right">${l.unitPrice.toLocaleString()}</td><td style="padding:6px;border:1px solid #eee;text-align:right">${(l.qty * l.unitPrice).toLocaleString()}</td></tr>`,
    )
    .join("");
  const meta = (opts.meta ?? [])
    .map((m) => `<div><span style="color:#555">${escapeHtml(m.label)}:</span> ${escapeHtml(m.value)}</div>`)
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(opts.title)} ${escapeHtml(opts.documentNumber)}</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;padding:20px;color:#111;max-width:800px;margin:0 auto}
  h1{font-size:18px;margin:0 0 4px}
  .muted{font-size:12px;color:#555;margin:0 0 12px}
  table{border-collapse:collapse;width:100%;font-size:12px;margin-top:12px}
  .total{font-size:14px;font-weight:700;text-align:right;margin-top:12px}
  @media print{body{padding:8mm}}
</style></head><body>
  <h1>${escapeHtml(opts.title)}</h1>
  <p class="muted">${escapeHtml(opts.documentNumber)}</p>
  <p><strong>${escapeHtml(opts.partyLabel)}:</strong> ${escapeHtml(opts.partyName)}</p>
  ${meta}
  <table><thead><tr>
    <th style="text-align:left;padding:6px;border:1px solid #ccc;background:#f3f4f6">Item</th>
    <th style="text-align:right;padding:6px;border:1px solid #ccc;background:#f3f4f6">Qty</th>
    <th style="text-align:right;padding:6px;border:1px solid #ccc;background:#f3f4f6">Rate</th>
    <th style="text-align:right;padding:6px;border:1px solid #ccc;background:#f3f4f6">Amount</th>
  </tr></thead><tbody>${lineRows || `<tr><td colspan="4" style="padding:6px">No lines</td></tr>`}</tbody></table>
  <p class="total">Total: ${opts.totalPkr.toLocaleString()}</p>
</body></html>`;
  const opened = await printHtmlDocumentAndWait(html, `${opts.title} ${opts.documentNumber}`);
  if (!opened) {
    throw new Error("Could not open the print dialog. Allow popups / hard-refresh and try again.");
  }
}
