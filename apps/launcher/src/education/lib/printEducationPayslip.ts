import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";
import {
  defaultEducationBranding,
  escapeHtml,
  formatEducationPkr,
  letterheadHtml,
  wrapEducationPrintHtml,
  type EducationPrintBranding,
} from "./printBranding";

export type EducationPayslipPrintInput = {
  periodLabel: string;
  personName: string;
  personType: string;
  basicPkr: number;
  allowancesPkr: number;
  deductionsPkr: number;
  netPkr: number;
  status?: string;
  branding?: Partial<EducationPrintBranding>;
};

export function buildEducationPayslipHtml(input: EducationPayslipPrintInput): string {
  const branding = { ...defaultEducationBranding(), ...input.branding };
  const inner = `
    ${letterheadHtml(branding)}
    <div class="doc-title">Payslip</div>
    <div class="meta"><span>Period: ${escapeHtml(input.periodLabel)}</span><span>Status: ${escapeHtml(input.status || "draft")}</span></div>
    <div class="row"><span class="label">Employee</span> ${escapeHtml(input.personName)}</div>
    <div class="row"><span class="label">Type</span> ${escapeHtml(input.personType)}</div>
    <div class="row"><span class="label">Basic</span> ${escapeHtml(formatEducationPkr(input.basicPkr))}</div>
    <div class="row"><span class="label">Allowances</span> ${escapeHtml(formatEducationPkr(input.allowancesPkr))}</div>
    <div class="row"><span class="label">Deductions</span> ${escapeHtml(formatEducationPkr(input.deductionsPkr))}</div>
    <div class="row"><span class="label">Net pay</span> <span class="amount">${escapeHtml(formatEducationPkr(input.netPkr))}</span></div>
    <div class="signatures"><div class="sig"><div class="line">Accounts</div></div><div class="sig"><div class="line">Employee</div></div></div>
    <div class="footer">${escapeHtml(branding.institutionName)} · ${escapeHtml(new Date().toLocaleString("en-PK"))}</div>
  `;
  return wrapEducationPrintHtml(`Payslip ${input.personName}`, inner);
}

export async function printEducationPayslip(
  input: EducationPayslipPrintInput,
): Promise<{ ok: boolean; error?: string }> {
  const opened = await printHtmlDocumentAndWait(
    buildEducationPayslipHtml(input),
    `Payslip ${input.personName}`,
  );
  return opened
    ? { ok: true }
    : { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
}
