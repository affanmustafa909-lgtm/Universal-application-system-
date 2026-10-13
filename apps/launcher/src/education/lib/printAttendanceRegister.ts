import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";
import {
  defaultEducationBranding,
  escapeHtml,
  letterheadHtml,
  wrapEducationPrintHtml,
  type EducationPrintBranding,
} from "./printBranding";

export type EducationAttendanceRow = {
  personLabel: string;
  statusCode: string;
  notes?: string;
};

export type EducationAttendanceRegisterPrintInput = {
  date: string;
  className?: string;
  sectionName?: string;
  rows: EducationAttendanceRow[];
  branding?: Partial<EducationPrintBranding>;
};

export function buildEducationAttendanceRegisterHtml(
  input: EducationAttendanceRegisterPrintInput,
): string {
  const branding = { ...defaultEducationBranding(), ...input.branding };
  const bodyRows =
    input.rows.length === 0
      ? `<tr><td colspan="3">No attendance rows</td></tr>`
      : input.rows
          .map(
            (r, i) =>
              `<tr><td>${i + 1}</td><td>${escapeHtml(r.personLabel)}</td><td>${escapeHtml(r.statusCode)}${r.notes ? ` — ${escapeHtml(r.notes)}` : ""}</td></tr>`,
          )
          .join("");
  const present = input.rows.filter((r) => r.statusCode === "present").length;
  const absent = input.rows.filter((r) => r.statusCode === "absent").length;
  const inner = `
    ${letterheadHtml(branding)}
    <div class="doc-title">Attendance Register</div>
    <div class="meta"><span>Date: ${escapeHtml(input.date)}</span><span>${escapeHtml(input.className || "—")} / ${escapeHtml(input.sectionName || "—")}</span></div>
    <div class="row">Present: <strong>${present}</strong> · Absent: <strong>${absent}</strong> · Total: <strong>${input.rows.length}</strong></div>
    <table class="table"><thead><tr><th>#</th><th>Name</th><th>Status</th></tr></thead><tbody>${bodyRows}</tbody></table>
    <div class="signatures"><div class="sig"><div class="line">Marked by</div></div><div class="sig"><div class="line">Principal</div></div></div>
    <div class="footer">${escapeHtml(branding.institutionName)} · ${escapeHtml(new Date().toLocaleString("en-PK"))}</div>
  `;
  return wrapEducationPrintHtml(`Attendance ${input.date}`, inner);
}

export async function printEducationAttendanceRegister(
  input: EducationAttendanceRegisterPrintInput,
): Promise<{ ok: boolean; error?: string }> {
  const opened = await printHtmlDocumentAndWait(
    buildEducationAttendanceRegisterHtml(input),
    `Attendance ${input.date}`,
  );
  return opened
    ? { ok: true }
    : { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
}
