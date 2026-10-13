import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";
import {
  defaultEducationBranding,
  escapeHtml,
  letterheadHtml,
  wrapEducationPrintHtml,
  type EducationPrintBranding,
} from "./printBranding";

export type EducationMarkRow = {
  subjectName: string;
  obtained: number;
  total: number;
  grade?: string;
};

export type EducationMarksheetPrintInput = {
  examName: string;
  sessionName?: string;
  studentName: string;
  studentNumber?: string;
  className?: string;
  sectionName?: string;
  marks: EducationMarkRow[];
  branding?: Partial<EducationPrintBranding>;
};

export function buildEducationMarksheetHtml(input: EducationMarksheetPrintInput): string {
  const branding = { ...defaultEducationBranding(), ...input.branding };
  const totalObtained = input.marks.reduce((s, m) => s + (m.obtained || 0), 0);
  const totalMarks = input.marks.reduce((s, m) => s + (m.total || 0), 0);
  const percentage = totalMarks > 0 ? Math.round((totalObtained / totalMarks) * 1000) / 10 : 0;
  const passFail = percentage >= 40 ? "Pass" : "Fail";
  const rows =
    input.marks.length === 0
      ? `<tr><td colspan="4">No marks entered</td></tr>`
      : input.marks
          .map(
            (m) =>
              `<tr><td>${escapeHtml(m.subjectName)}</td><td>${m.obtained}</td><td>${m.total}</td><td>${escapeHtml(m.grade || "—")}</td></tr>`,
          )
          .join("");
  const inner = `
    ${letterheadHtml(branding)}
    <div class="doc-title">Report Card / Marksheet</div>
    <div class="meta"><span>Exam: ${escapeHtml(input.examName)}</span><span>Session: ${escapeHtml(input.sessionName || "—")}</span></div>
    <div class="row"><span class="label">Student</span> ${escapeHtml(input.studentName)}</div>
    <div class="row"><span class="label">Student No.</span> ${escapeHtml(input.studentNumber || "—")}</div>
    <div class="row"><span class="label">Class / Section</span> ${escapeHtml(input.className || "—")} / ${escapeHtml(input.sectionName || "—")}</div>
    <table class="table"><thead><tr><th>Subject</th><th>Obtained</th><th>Total</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="row"><span class="label">Total</span> ${totalObtained} / ${totalMarks}</div>
    <div class="row"><span class="label">Percentage</span> ${percentage}%</div>
    <div class="row"><span class="label">Result</span> <span class="badge">${passFail}</span></div>
    <div class="signatures"><div class="sig"><div class="line">Class Teacher</div></div><div class="sig"><div class="line">Principal</div></div></div>
    <div class="footer">${escapeHtml(branding.institutionName)} · ${escapeHtml(new Date().toLocaleString("en-PK"))}</div>
  `;
  return wrapEducationPrintHtml(`Marksheet ${input.studentName}`, inner);
}

export async function printEducationMarksheet(
  input: EducationMarksheetPrintInput,
): Promise<{ ok: boolean; error?: string }> {
  const opened = await printHtmlDocumentAndWait(
    buildEducationMarksheetHtml(input),
    `Marksheet ${input.studentName}`,
  );
  return opened
    ? { ok: true }
    : { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
}
