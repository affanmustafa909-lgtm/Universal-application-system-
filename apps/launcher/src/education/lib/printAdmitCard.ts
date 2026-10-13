import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";
import {
  defaultEducationBranding,
  escapeHtml,
  letterheadHtml,
  wrapEducationPrintHtml,
  type EducationPrintBranding,
} from "./printBranding";

export type EducationAdmitCardPrintInput = {
  examName: string;
  examType?: string;
  studentName: string;
  studentNumber?: string;
  className?: string;
  sectionName?: string;
  startDate?: string;
  endDate?: string;
  branding?: Partial<EducationPrintBranding>;
};

export function buildEducationAdmitCardHtml(input: EducationAdmitCardPrintInput): string {
  const branding = { ...defaultEducationBranding(), ...input.branding };
  const inner = `
    ${letterheadHtml(branding)}
    <div class="doc-title">Admit Card</div>
    <div class="meta"><span>Exam: ${escapeHtml(input.examName)}</span><span>${escapeHtml(input.examType || "")}</span></div>
    <div class="row"><span class="label">Student</span> ${escapeHtml(input.studentName)}</div>
    <div class="row"><span class="label">Student No.</span> ${escapeHtml(input.studentNumber || "—")}</div>
    <div class="row"><span class="label">Class / Section</span> ${escapeHtml(input.className || "—")} / ${escapeHtml(input.sectionName || "—")}</div>
    <div class="row"><span class="label">Exam dates</span> ${escapeHtml(input.startDate || "—")} — ${escapeHtml(input.endDate || "—")}</div>
    <p>Instructions: Bring this admit card and a valid ID. Electronic devices are not allowed in the exam hall.</p>
    <div class="signatures"><div class="sig"><div class="line">Controller of Exams</div></div></div>
    <div class="footer">${escapeHtml(branding.institutionName)} · ${escapeHtml(new Date().toLocaleString("en-PK"))}</div>
  `;
  return wrapEducationPrintHtml(`Admit Card ${input.studentName}`, inner);
}

export async function printEducationAdmitCard(
  input: EducationAdmitCardPrintInput,
): Promise<{ ok: boolean; error?: string }> {
  const opened = await printHtmlDocumentAndWait(
    buildEducationAdmitCardHtml(input),
    `Admit Card ${input.studentName}`,
  );
  return opened
    ? { ok: true }
    : { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
}
