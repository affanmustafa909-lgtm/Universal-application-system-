import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";
import {
  defaultEducationBranding,
  EDUCATION_PRINT_CSS,
  escapeHtml,
  type EducationPrintBranding,
} from "./printBranding";

export type EducationIdCardPrintInput = {
  studentName: string;
  studentNumber: string;
  className?: string;
  sectionName?: string;
  sessionName?: string;
  branding?: Partial<EducationPrintBranding>;
};

export function buildEducationIdCardHtml(input: EducationIdCardPrintInput): string {
  const branding = { ...defaultEducationBranding(), ...input.branding };
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Student ID</title><style>${EDUCATION_PRINT_CSS}</style></head><body>
    <div class="id-card">
      <h2>${escapeHtml(branding.institutionName)}</h2>
      <div style="font-size:11px;color:#64748b">${escapeHtml(branding.branchName)} · Student ID</div>
      <div class="name">${escapeHtml(input.studentName)}</div>
      <div style="font-size:12px">No: ${escapeHtml(input.studentNumber)}</div>
      <div style="font-size:12px">${escapeHtml(input.className || "—")} · ${escapeHtml(input.sectionName || "—")}</div>
      <div style="font-size:11px;margin-top:8px;color:#64748b">Session ${escapeHtml(input.sessionName || "—")}</div>
    </div>
  </body></html>`;
}

export async function printEducationIdCard(
  input: EducationIdCardPrintInput,
): Promise<{ ok: boolean; error?: string }> {
  const opened = await printHtmlDocumentAndWait(
    buildEducationIdCardHtml(input),
    `ID Card ${input.studentNumber}`,
  );
  return opened
    ? { ok: true }
    : { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
}
