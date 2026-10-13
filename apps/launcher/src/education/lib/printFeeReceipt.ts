import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";
import {
  defaultEducationBranding,
  escapeHtml,
  formatEducationPkr,
  letterheadHtml,
  wrapEducationPrintHtml,
  type EducationPrintBranding,
} from "./printBranding";

export type EducationFeeReceiptPrintInput = {
  receiptNumber: string;
  paidAt: string;
  studentName: string;
  studentNumber?: string;
  className?: string;
  sectionName?: string;
  voucherNumber?: string;
  feeType?: string;
  paymentMethod?: string;
  amountPkr: number;
  notes?: string;
  branding?: Partial<EducationPrintBranding>;
};

export function buildEducationFeeReceiptHtml(input: EducationFeeReceiptPrintInput): string {
  const branding = { ...defaultEducationBranding(), ...input.branding };
  const inner = `
    ${letterheadHtml(branding)}
    <div class="doc-title">Fee Receipt</div>
    <div class="meta"><span>Receipt #: <strong>${escapeHtml(input.receiptNumber)}</strong></span><span>Date: ${escapeHtml(input.paidAt)}</span></div>
    <div class="row"><span class="label">Student</span> ${escapeHtml(input.studentName)}</div>
    <div class="row"><span class="label">Student No.</span> ${escapeHtml(input.studentNumber || "—")}</div>
    <div class="row"><span class="label">Class / Section</span> ${escapeHtml(input.className || "—")} / ${escapeHtml(input.sectionName || "—")}</div>
    <div class="row"><span class="label">Invoice / Voucher</span> ${escapeHtml(input.voucherNumber || "—")}</div>
    <div class="row"><span class="label">Fee type</span> ${escapeHtml(input.feeType || "—")}</div>
    <div class="row"><span class="label">Payment method</span> ${escapeHtml(input.paymentMethod || "—")}</div>
    <div class="row"><span class="label">Amount paid</span> <span class="amount">${escapeHtml(formatEducationPkr(input.amountPkr))}</span></div>
    <div class="row"><span class="label">Notes</span> ${escapeHtml(input.notes || "—")}</div>
    <div class="signatures"><div class="sig"><div class="line">Cashier</div></div><div class="sig"><div class="line">Authorized</div></div></div>
    <div class="footer">Computer-generated receipt · ${escapeHtml(new Date().toLocaleString("en-PK"))}</div>
  `;
  return wrapEducationPrintHtml(`Fee Receipt ${input.receiptNumber}`, inner);
}

export async function printEducationFeeReceipt(
  input: EducationFeeReceiptPrintInput,
): Promise<{ ok: boolean; error?: string }> {
  const opened = await printHtmlDocumentAndWait(
    buildEducationFeeReceiptHtml(input),
    `Fee Receipt ${input.receiptNumber}`,
  );
  return opened
    ? { ok: true }
    : { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
}
