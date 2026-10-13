export type EducationPrintBranding = {
  institutionName: string;
  branchName: string;
  address?: string;
  phone?: string;
  email?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatEducationPkr(amount: number): string {
  return `PKR ${Number(amount || 0).toLocaleString("en-PK")}`;
}

export const EDUCATION_PRINT_CSS = `
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; font-size: 13px; line-height: 1.45; }
.sheet { border: 2px solid #0f172a; padding: 20px 24px; min-height: 240mm; }
.letterhead { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
.letterhead h1 { margin: 0; font-size: 22px; }
.letterhead .sub { color: #475569; font-size: 12px; margin-top: 4px; }
.doc-title { text-align: center; font-size: 17px; font-weight: 700; text-decoration: underline; margin: 14px 0 18px; text-transform: uppercase; }
.meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; font-size: 12px; color: #334155; }
.row { margin: 5px 0; }
.label { color: #64748b; display: inline-block; min-width: 140px; }
.table { width: 100%; border-collapse: collapse; margin: 12px 0; }
.table th, .table td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; }
.table th { background: #f1f5f9; }
.amount { font-size: 18px; font-weight: 700; }
.signatures { display: flex; justify-content: space-between; margin-top: 42px; gap: 20px; }
.sig { text-align: center; width: 30%; }
.sig .line { border-top: 1px solid #0f172a; margin-top: 42px; padding-top: 6px; font-size: 12px; }
.footer { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 600; }
.id-card { width: 86mm; height: 54mm; border: 1.5px solid #0f172a; border-radius: 8px; padding: 10px 12px; }
.id-card h2 { margin: 0 0 4px; font-size: 13px; }
.id-card .name { font-size: 16px; font-weight: 700; margin: 8px 0 4px; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

export function letterheadHtml(branding: EducationPrintBranding): string {
  return `<div class="letterhead">
    <h1>${escapeHtml(branding.institutionName)}</h1>
    <div class="sub">${escapeHtml(branding.address || "")}</div>
    <div class="sub">${escapeHtml(branding.branchName)}${branding.phone ? ` · ${escapeHtml(branding.phone)}` : ""}${branding.email ? ` · ${escapeHtml(branding.email)}` : ""}</div>
  </div>`;
}

export function wrapEducationPrintHtml(title: string, inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${EDUCATION_PRINT_CSS}</style></head><body><div class="sheet">${inner}</div></body></html>`;
}

export function defaultEducationBranding(branchName?: string, institutionName?: string): EducationPrintBranding {
  return {
    institutionName: institutionName?.trim() || "EducationFlow Institution",
    branchName: branchName?.trim() || "Main Campus",
  };
}
