export type MobizoneReceiptDesign = {
  accent: string;
  text: string;
  muted: string;
  border: string;
  background: string;
};

export type MobizoneReceiptFields = {
  shopName: boolean;
  shopPhone: boolean;
  shopAddress: boolean;
  documentTitle: boolean;
  timestamp: boolean;
  device: boolean;
  imei: boolean;
  salePrice: boolean;
  cash: boolean;
  bank: boolean;
  remaining: boolean;
  footer: boolean;
};

export type MobizoneReceiptSettings = {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  whatsappNumber: string;
  documentTitle: string;
  footerText: string;
  paperWidthMm: 58 | 80;
  fontScale: number;
  density: "compact" | "comfortable";
  slipTheme: "classic" | "dark";
  design: MobizoneReceiptDesign;
  fields: MobizoneReceiptFields;
};

export const RECEIPT_DESIGN_PRESETS = {
  teal: {
    accent: "#0f766e",
    text: "#0f172a",
    muted: "#475569",
    border: "#0f766e",
    background: "#ffffff",
  },
  classic: {
    accent: "#0f172a",
    text: "#0f172a",
    muted: "#475569",
    border: "#0f172a",
    background: "#ffffff",
  },
  navy: {
    accent: "#5eead4",
    text: "#f8fafc",
    muted: "#cbd5e1",
    border: "#334155",
    background: "#0b1220",
  },
} as const;

export const DEFAULT_RECEIPT_SETTINGS: MobizoneReceiptSettings = {
  shopName: "MobiZone",
  shopPhone: "",
  shopAddress: "",
  whatsappNumber: "",
  documentTitle: "Sale Receipt",
  footerText: "Thank you for your business",
  paperWidthMm: 80,
  fontScale: 1,
  density: "compact",
  slipTheme: "classic",
  design: { ...RECEIPT_DESIGN_PRESETS.teal },
  fields: {
    shopName: true,
    shopPhone: true,
    shopAddress: true,
    documentTitle: true,
    timestamp: true,
    device: true,
    imei: true,
    salePrice: true,
    cash: true,
    bank: true,
    remaining: true,
    footer: true,
  },
};

function key(branchCode: string): string {
  return `mobizone-receipt-settings-v1:${branchCode || "MAIN"}`;
}

export function loadReceiptSettings(branchCode: string): MobizoneReceiptSettings {
  try {
    const raw = localStorage.getItem(key(branchCode));
    if (!raw) return { ...DEFAULT_RECEIPT_SETTINGS, design: { ...DEFAULT_RECEIPT_SETTINGS.design }, fields: { ...DEFAULT_RECEIPT_SETTINGS.fields } };
    const parsed = JSON.parse(raw) as Partial<MobizoneReceiptSettings>;
    return {
      ...DEFAULT_RECEIPT_SETTINGS,
      ...parsed,
      design: { ...DEFAULT_RECEIPT_SETTINGS.design, ...(parsed.design ?? {}) },
      fields: { ...DEFAULT_RECEIPT_SETTINGS.fields, ...(parsed.fields ?? {}) },
    };
  } catch {
    return { ...DEFAULT_RECEIPT_SETTINGS, design: { ...DEFAULT_RECEIPT_SETTINGS.design }, fields: { ...DEFAULT_RECEIPT_SETTINGS.fields } };
  }
}

export function saveReceiptSettings(branchCode: string, settings: MobizoneReceiptSettings): void {
  localStorage.setItem(key(branchCode), JSON.stringify(settings));
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSampleReceiptHtml(settings: MobizoneReceiptSettings): string {
  const d = settings.design;
  const width = settings.paperWidthMm === 58 ? 280 : 360;
  const scale = settings.fontScale || 1;
  const f = settings.fields;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  body{margin:0;background:${d.background};color:${d.text}}
  .rcpt{max-width:${width}px;margin:0 auto;padding:10px;font-family:ui-monospace,monospace;font-size:${Math.round(12 * scale)}px;background:${d.background};color:${d.text}}
  .shop{text-align:center;font-size:${Math.round(17 * scale)}px;font-weight:800;color:${d.accent};text-transform:uppercase}
  .sub{text-align:center;color:${d.muted};margin:2px 0}
  .title{text-align:center;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin:8px 0}
  .sec{color:${d.accent};font-weight:800;margin:8px 0 4px;text-transform:uppercase;font-size:10px}
  .kv{display:flex;justify-content:space-between;gap:8px;margin:2px 0}
  .kv span:first-child{color:${d.muted}}
  .brand{border-bottom:2px solid ${d.border};padding-bottom:6px;margin-bottom:6px}
  .total{border-top:2px solid ${d.border};border-bottom:2px solid ${d.border};padding:8px 0;margin-top:8px;font-weight:800}
  </style></head><body><div class="rcpt">
  <div class="brand">
    ${f.shopName ? `<div class="shop">${esc(settings.shopName)}</div>` : ""}
    ${f.shopPhone && settings.shopPhone ? `<div class="sub">Tel ${esc(settings.shopPhone)}</div>` : ""}
    ${f.shopAddress && settings.shopAddress ? `<div class="sub">${esc(settings.shopAddress)}</div>` : ""}
  </div>
  ${f.documentTitle ? `<div class="title">${esc(settings.documentTitle)}</div>` : ""}
  ${f.timestamp ? `<div class="sub">${esc(new Date().toLocaleString())}</div>` : ""}
  <div class="sec">Customer</div>
  <div class="kv"><span>Name</span><span>Ali Khan</span></div>
  <div class="kv"><span>Phone</span><span>03001234567</span></div>
  <div class="sec">Phone</div>
  ${f.device ? `<div class="kv"><span>Samsung A15</span><span>Rs 45,000</span></div>` : ""}
  ${f.imei ? `<div class="sub" style="text-align:left">IMEI 1: 359999999999999</div>` : ""}
  <div class="sec">Payment</div>
  ${f.cash ? `<div class="kv"><span>Cash</span><span>Rs 20,000</span></div>` : ""}
  ${f.bank ? `<div class="kv"><span>Bank</span><span>Rs 20,000</span></div>` : ""}
  ${f.remaining ? `<div class="kv"><span>Remaining</span><span>Rs 5,000</span></div>` : ""}
  ${f.salePrice ? `<div class="total kv"><span>TOTAL</span><span>Rs 45,000</span></div>` : ""}
  ${f.footer ? `<div class="sub" style="margin-top:10px">${esc(settings.footerText || "Thank you")}</div>` : ""}
  </div></body></html>`;
}
