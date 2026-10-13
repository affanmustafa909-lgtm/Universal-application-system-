import { printHtmlDocumentAndWait } from "../../pops/lib/printTicket";
import {
  defaultEducationBranding,
  escapeHtml,
  letterheadHtml,
  wrapEducationPrintHtml,
  type EducationPrintBranding,
} from "./printBranding";

export type EducationCertificateKind =
  | "transfer_certificate"
  | "character_certificate"
  | "bonafide_certificate"
  | "experience_certificate"
  | "admission_letter"
  | "generic";

export type EducationCertificatePrintInput = {
  kind: EducationCertificateKind;
  title?: string;
  documentNumber?: string;
  studentName: string;
  studentNumber?: string;
  fatherName?: string;
  className?: string;
  sectionName?: string;
  sessionName?: string;
  effectiveDate?: string;
  reason?: string;
  purpose?: string;
  applicantName?: string;
  applicationNumber?: string;
  phone?: string;
  status?: string;
  notes?: string;
  personName?: string;
  employeeNumber?: string;
  designation?: string;
  joiningDate?: string;
  leavingDate?: string;
  /** Pre-merged HTML from API — printed as-is when provided */
  bodyHtml?: string;
  branding?: Partial<EducationPrintBranding>;
};

function titleFor(kind: EducationCertificateKind, override?: string): string {
  if (override) return override;
  switch (kind) {
    case "transfer_certificate":
      return "Transfer Certificate";
    case "character_certificate":
      return "Character Certificate";
    case "bonafide_certificate":
      return "Bonafide Certificate";
    case "experience_certificate":
      return "Experience Certificate";
    case "admission_letter":
      return "Admission Offer / Acknowledgment";
    default:
      return "Certificate";
  }
}

export function buildEducationCertificateHtml(input: EducationCertificatePrintInput): string {
  if (input.bodyHtml?.trim()) return input.bodyHtml;
  const branding = { ...defaultEducationBranding(), ...input.branding };
  const title = titleFor(input.kind, input.title);
  const docNo = input.documentNumber || `DOC-${Date.now().toString(36).toUpperCase()}`;
  const issueDate = new Date().toISOString().slice(0, 10);
  let body = "";
  if (input.kind === "transfer_certificate") {
    body = `<p>This is to certify that <strong>${escapeHtml(input.studentName)}</strong> (Student No. ${escapeHtml(input.studentNumber || "—")}),
      son/daughter of <strong>${escapeHtml(input.fatherName || "—")}</strong>, was a bona fide student of this institution
      in <strong>${escapeHtml(input.className || "—")}</strong> (Section ${escapeHtml(input.sectionName || "—")})
      during session <strong>${escapeHtml(input.sessionName || "—")}</strong>.</p>
      <p>He/She is leaving with effect from <strong>${escapeHtml(input.effectiveDate || issueDate)}</strong>.
      Reason: ${escapeHtml(input.reason || "as requested")}. Conduct during stay was satisfactory.</p>`;
  } else if (input.kind === "character_certificate") {
    body = `<p>This is to certify that <strong>${escapeHtml(input.studentName)}</strong> (Student No. ${escapeHtml(input.studentNumber || "—")}),
      son/daughter of <strong>${escapeHtml(input.fatherName || "—")}</strong>, is/was a student of
      <strong>${escapeHtml(input.className || "—")}</strong> at ${escapeHtml(branding.institutionName)}.</p>
      <p>To the best of our knowledge his/her character and conduct have been <strong>good</strong>.</p>`;
  } else if (input.kind === "bonafide_certificate") {
    body = `<p>This is to certify that <strong>${escapeHtml(input.studentName)}</strong> (Student No. ${escapeHtml(input.studentNumber || "—")}),
      son/daughter of <strong>${escapeHtml(input.fatherName || "—")}</strong>, is a bona fide student of
      <strong>${escapeHtml(branding.institutionName)}</strong> studying in <strong>${escapeHtml(input.className || "—")}</strong>
      (Section ${escapeHtml(input.sectionName || "—")}) for session <strong>${escapeHtml(input.sessionName || "—")}</strong>.</p>
      <p>This certificate is issued on request for ${escapeHtml(input.purpose || "official use")}.</p>`;
  } else if (input.kind === "experience_certificate") {
    body = `<p>This is to certify that <strong>${escapeHtml(input.personName || input.studentName)}</strong>
      (Employee No. ${escapeHtml(input.employeeNumber || "—")}) worked at ${escapeHtml(branding.institutionName)}
      as <strong>${escapeHtml(input.designation || "—")}</strong>
      from <strong>${escapeHtml(input.joiningDate || "—")}</strong> to <strong>${escapeHtml(input.leavingDate || "—")}</strong>.</p>
      <p>During this period his/her performance and conduct were satisfactory.</p>`;
  } else if (input.kind === "admission_letter") {
    body = `<p>Dear <strong>${escapeHtml(input.applicantName || input.studentName)}</strong>,</p>
      <p>We acknowledge your admission application
      (Father/Guardian: ${escapeHtml(input.fatherName || "—")}, Phone: ${escapeHtml(input.phone || "—")})
      for <strong>${escapeHtml(input.className || "—")}</strong> session <strong>${escapeHtml(input.sessionName || "—")}</strong>.</p>
      <p>Application #: ${escapeHtml(input.applicationNumber || "—")} · Status: <span class="badge">${escapeHtml(input.status || "application")}</span></p>
      <p>${escapeHtml(input.notes || "Please complete fee payment and document submission as advised.")}</p>`;
  } else {
    body = `<p>${escapeHtml(input.notes || "Certificate issued by EducationFlow.")}</p>`;
  }

  const inner = `
    ${letterheadHtml(branding)}
    <div class="doc-title">${escapeHtml(title)}</div>
    <div class="meta"><span>Ref: ${escapeHtml(docNo)}</span><span>Date: ${escapeHtml(issueDate)}</span></div>
    <div class="body">${body}</div>
    <div class="signatures"><div class="sig"><div class="line">Class Teacher</div></div><div class="sig"><div class="line">Principal</div></div></div>
    <div class="footer">${escapeHtml(branding.institutionName)} · ${escapeHtml(new Date().toLocaleString("en-PK"))}</div>
  `;
  return wrapEducationPrintHtml(title, inner);
}

export async function printEducationCertificate(
  input: EducationCertificatePrintInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = titleFor(input.kind, input.title);
  const opened = await printHtmlDocumentAndWait(buildEducationCertificateHtml(input), title);
  return opened
    ? { ok: true }
    : { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
}

/** Print any pre-merged HTML document (from generate API). */
export async function printEducationHtmlDocument(
  html: string,
  title = "Education document",
): Promise<{ ok: boolean; error?: string }> {
  const opened = await printHtmlDocumentAndWait(html, title);
  return opened
    ? { ok: true }
    : { ok: false, error: "Could not open the print dialog. Try again or use Print to PDF." };
}
