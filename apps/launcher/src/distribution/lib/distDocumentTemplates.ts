/**
 * Distribution print designs — A4 wholesale / report documents (not restaurant thermal slips).
 */

import {
  buildDistDocumentHtml,
  type DistPrintLine,
} from "./printDistOrder";
import type { DistPrintDesignSettings } from "./distPrintDesign";

export type DistDocumentTemplateId =
  | "booking-invoice"
  | "tax-invoice"
  | "delivery-challan"
  | "order-confirmation"
  | "credit-note"
  | "sales-register"
  | "trade-invoice";

export type DistDocumentTemplate = {
  id: DistDocumentTemplateId;
  name: string;
  description: string;
};

export const DIST_DOCUMENT_TEMPLATES: DistDocumentTemplate[] = [
  {
    id: "booking-invoice",
    name: "Booking Invoice",
    description: "A4 wholesale booking — trade customer, products, net amount",
  },
  {
    id: "tax-invoice",
    name: "Tax Invoice",
    description: "A4 GST / NTN style tax invoice for trade sales",
  },
  {
    id: "delivery-challan",
    name: "Delivery Challan",
    description: "A4 dispatch challan — check goods on delivery",
  },
  {
    id: "order-confirmation",
    name: "Order Confirmation",
    description: "A4 booking acknowledgement before dispatch",
  },
  {
    id: "credit-note",
    name: "Credit Note",
    description: "A4 return / credit adjustment document",
  },
  {
    id: "sales-register",
    name: "Sales Register",
    description: "A4 report table — day / salesman register style",
  },
  {
    id: "trade-invoice",
    name: "Trade Invoice",
    description: "A4 named trade-account invoice with salesman",
  },
];

const SAMPLE_LINES: DistPrintLine[] = [
  {
    label: "Panadol Extra 24s",
    qty: 10,
    unitPrice: 420,
    freeQty: 1,
    pack: "24×10",
    batch: "PX2401",
    expiry: "12/2027",
    note: "GSK · SKU PE-24",
  },
  {
    label: "Disprin Tabs",
    qty: 5,
    unitPrice: 980,
    pack: "10×10",
    batch: "DP118",
    expiry: "08/2026",
    note: "Reckitt · carton",
  },
  {
    label: "ORS Sachet (outer)",
    qty: 20,
    unitPrice: 185,
    pack: "20s",
    batch: "OR902",
    expiry: "03/2028",
  },
];

const STORAGE_KEY = "dist-document-template-v1";

export function loadActiveDistDocumentTemplateId(
  branchCode: string | undefined,
): DistDocumentTemplateId {
  if (!branchCode || typeof localStorage === "undefined") return "booking-invoice";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "booking-invoice";
    const map = JSON.parse(raw) as Record<string, string>;
    const id = map[`distribution::${branchCode}`] ?? map[branchCode];
    if (DIST_DOCUMENT_TEMPLATES.some((t) => t.id === id)) {
      return id as DistDocumentTemplateId;
    }
  } catch {
    /* ignore */
  }
  return "booking-invoice";
}

export function saveActiveDistDocumentTemplateId(
  branchCode: string,
  templateId: DistDocumentTemplateId,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[`distribution::${branchCode}`] = templateId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(
      new CustomEvent("dist-document-template-changed", {
        detail: { branchCode, templateId },
      }),
    );
  } catch {
    /* ignore */
  }
}

/** Build A4 HTML preview for the selected Dist document design. */
export function buildDistDocumentPreviewHtml(opts: {
  templateId: DistDocumentTemplateId;
  branchName: string;
  branchCode: string;
  /** Live design draft from Customize editor (overrides stored settings). */
  design?: Partial<DistPrintDesignSettings> | null;
}): string {
  const company = opts.branchName || "Distribution HQ";
  const code = opts.branchCode || "LAH";
  const design = opts.design;
  const templateId = opts.templateId;
  const subtotal = SAMPLE_LINES.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const discount = 250;
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal - discount + tax;

  const party = {
    partyLabel: "Trade customer",
    partyName: "City Medical Store",
    partyExtra: "Code: CMS-014\nPhone: 042-1234567\nAllama Iqbal Town, Lahore",
  };

  const commonMeta = [
    { label: "Salesman", value: "Imran Khan" },
    { label: "Warehouse", value: "Main Godown · WH-01" },
    { label: "Date", value: new Date().toLocaleString("en-PK") },
  ];

  switch (opts.templateId) {
    case "tax-invoice":
      return buildDistDocumentHtml({
        title: "Tax Invoice",
        documentNumber: "DI-TI-4401",
        branchName: company,
        branchCode: code,
        templateId,
        design,
        ...party,
        meta: [
          { label: "Invoice", value: "DI-TI-4401" },
          { label: "NTN / STRN", value: "1234567-8" },
          { label: "Payment", value: "Credit 30 days" },
          ...commonMeta,
        ],
        lines: SAMPLE_LINES,
        subtotalPkr: subtotal,
        discountPkr: discount,
        taxPkr: tax,
        totalPkr: total,
        footerNote: "Distribution tax invoice — prices as per trade terms",
      });
    case "delivery-challan":
      return buildDistDocumentHtml({
        title: "Delivery Challan",
        documentNumber: "DC-2201",
        branchName: company,
        branchCode: code,
        templateId,
        design,
        ...party,
        meta: [
          { label: "Against booking", value: "BK-1042" },
          { label: "Vehicle", value: "LES-1234" },
          { label: "Driver", value: "Asif" },
          ...commonMeta,
        ],
        lines: SAMPLE_LINES,
        footerNote: "Please check goods on delivery — Distribution challan",
      });
    case "order-confirmation":
      return buildDistDocumentHtml({
        title: "Order Confirmation",
        documentNumber: "OC-881",
        branchName: company,
        branchCode: code,
        templateId,
        design,
        ...party,
        meta: [
          { label: "Type", value: "Booking" },
          { label: "Status", value: "Confirmed" },
          ...commonMeta,
        ],
        lines: SAMPLE_LINES,
        subtotalPkr: subtotal,
        discountPkr: discount,
        totalPkr: subtotal - discount,
        footerNote: "Subject to stock availability — Distribution booking",
      });
    case "credit-note":
      return buildDistDocumentHtml({
        title: "Credit Note",
        documentNumber: "CN-115",
        branchName: company,
        branchCode: code,
        templateId,
        design,
        ...party,
        meta: [
          { label: "Against invoice", value: "DI-TI-4390" },
          { label: "Reason", value: "Near expiry return" },
          ...commonMeta,
        ],
        lines: SAMPLE_LINES.slice(0, 2),
        subtotalPkr: 5180,
        totalPkr: 5180,
        footerNote: "Adjusted against outstanding — Distribution credit note",
      });
    case "sales-register":
      return buildDistDocumentHtml({
        title: "Sales Register",
        documentNumber: "Daily · sample",
        branchName: company,
        branchCode: code,
        templateId,
        design,
        partyLabel: "Register",
        partyName: "Sales register (report)",
        partyExtra: "Sample rows for print layout preview",
        meta: [
          { label: "Period", value: "Today" },
          { label: "Branch", value: company },
        ],
        report: {
          columns: ["Invoice", "Customer", "Salesman", "Amount"],
          rows: [
            {
              Invoice: "DI-4401",
              Customer: "City Medical Store",
              Salesman: "Imran",
              Amount: "Rs 12,450",
            },
            {
              Invoice: "DI-4402",
              Customer: "Al-Shifa Pharmacy",
              Salesman: "Imran",
              Amount: "Rs 8,200",
            },
            {
              Invoice: "DI-4403",
              Customer: "Health Plus",
              Salesman: "Sana",
              Amount: "Rs 15,900",
            },
          ],
        },
        footerNote: "Distribution report register — A4",
      });
    case "trade-invoice":
      return buildDistDocumentHtml({
        title: "Trade Invoice",
        documentNumber: "TI-5502",
        branchName: company,
        branchCode: code,
        templateId,
        design,
        ...party,
        meta: [
          { label: "Invoice", value: "TI-5502" },
          { label: "Account", value: "CMS-014" },
          { label: "Payment", value: "Bill to bill" },
          ...commonMeta,
        ],
        lines: SAMPLE_LINES,
        subtotalPkr: subtotal,
        discountPkr: discount,
        taxPkr: tax,
        totalPkr: total,
        footerNote: "Trade customer invoice — Medical Distribution",
      });
    case "booking-invoice":
    default:
      return buildDistDocumentHtml({
        title: "Booking Invoice",
        documentNumber: "BK-SAMPLE",
        branchName: company,
        branchCode: code,
        templateId,
        design,
        ...party,
        meta: [
          { label: "Type", value: "Booking" },
          { label: "Payment", value: "Credit" },
          { label: "Status", value: "Booked" },
          ...commonMeta,
        ],
        lines: SAMPLE_LINES,
        subtotalPkr: subtotal,
        discountPkr: discount,
        taxPkr: tax,
        totalPkr: total,
        footerNote: "Distribution order receipt — present with delivery / invoice",
      });
  }
}
