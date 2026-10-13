import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";
import {
  defaultEducationBranding,
  escapeHtml,
  formatEducationPkr,
  letterheadHtml,
  wrapEducationPrintHtml,
  type EducationPrintBranding,
} from "./printBranding";

export type EducationFeeChallanPrintInput = {
  voucherNumber: string;
  dueDate?: string;
  studentName: string;
  studentNumber?: string;
  className?: string;
  sectionName?: string;
  invoiceTitle: string;
  feeType?: string;
  amountPkr: number;
  paidPkr: number;
  status?: string;
  branding?: Partial<EducationPrintBranding>;
};

export function buildEducationFeeChallanHtml(input: EducationFeeChallanPrintInput): string {
  const branding = { ...defaultEducationBranding(), ...input.branding };
  const balance = Math.max(0, (input.amountPkr || 0) - (input.paidPkr || 0));
  const inner = `
    ${letterheadHtml(branding)}
    <div class="doc-title">Fee Challan / Invoice</div>
    <div class="meta"><span>Voucher #: <strong>${escapeHtml(input.voucherNumber)}</strong></span><span>Due: ${escapeHtml(input.dueDate || "—")}</span></div>
    <div class="row"><span class="label">Student</span> ${escapeHtml(input.studentName)}</div>
    <div class="row"><span class="label">Student No.</span> ${escapeHtml(input.studentNumber || "—")}</div>
    <div class="row"><span class="label">Class / Section</span> ${escapeHtml(input.className || "—")} / ${escapeHtml(input.sectionName || "—")}</div>
    <div class="row"><span class="label">Title</span> ${escapeHtml(input.invoiceTitle)}</div>
    <div class="row"><span class="label">Fee type</span> ${escapeHtml(input.feeType || "—")}</div>
    <div class="row"><span class="label">Amount</span> <span class="amount">${escapeHtml(formatEducationPkr(input.amountPkr))}</span></div>
    <div class="row"><span class="label">Paid</span> ${escapeHtml(formatEducationPkr(input.paidPkr))}</div>
    <div class="row"><span class="label">Balance</span> ${escapeHtml(formatEducationPkr(balance))}</div>
    <div class="row"><span class="label">Status</span> <span class="badge">${escapeHtml(input.status || "pending")}</span></div>
    <div class="signatures"><div class="sig"><div class="line">Accounts</div></div><div class="sig"><div class="line">Parent / Guardian</div></div></div>
    <div class="footer">Pay before due date · ${escapeHtml(new Date().toLocaleString("en-PK"))}</div>
  `;
  return wrapEducationPrintHtml(`Fee Challan ${input.voucherNumber}`, inner);
}

export async function printEducationFeeChallan(
  input: EducationFeeChallanPrintInput,
): Promise<{ ok: boolean; error?: string }> {
  const opened = await printHtmlDocumentAndWait(
    buildEducationFeeChallanHtml(input),
    `Fee Challan ${input.voucherNumber}`,
  );
  return opened
    ? { ok: true }
    : { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
}
