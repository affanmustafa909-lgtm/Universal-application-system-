import { authFetch } from "../../lib/authFetch";

const BASE = "/v1/pharmacy/io";

export type IoFieldDef = {
  key: string;
  label: string;
  required: boolean;
  example: string;
  notes?: string;
};

export type IoModuleDef = {
  id: string;
  fields: IoFieldDef[];
  transactional?: boolean;
};

/** Fallback when GET /modules fails so mapping + local template still work. */
export const LOCAL_IO_MODULES: IoModuleDef[] = [
  {
    id: "medicines",
    fields: [
      { key: "sku", label: "Product Code", required: true, example: "MED-001" },
      { key: "name", label: "Product Name", required: true, example: "Paracetamol 500mg" },
      { key: "genericName", label: "Generic", required: false, example: "Paracetamol" },
      { key: "companyCode", label: "Company Code", required: false, example: "ABC" },
      { key: "barcode", label: "Barcode", required: false, example: "1234567890123" },
      { key: "unit", label: "Unit", required: false, example: "Piece" },
      { key: "taxPct", label: "Tax %", required: false, example: "0" },
      { key: "purchasePrice", label: "Purchase Price", required: false, example: "80" },
      { key: "sellingPrice", label: "Sale Price", required: false, example: "100" },
      { key: "wholesalePrice", label: "Wholesale Price", required: false, example: "90" },
      { key: "status", label: "Status", required: false, example: "active" },
    ],
  },
  {
    id: "customers",
    fields: [
      { key: "code", label: "Customer Code", required: true, example: "TC-001" },
      { key: "name", label: "Customer Name", required: true, example: "City Pharmacy" },
      { key: "businessName", label: "Business Name", required: false, example: "City Pharmacy" },
      { key: "customerType", label: "Type", required: false, example: "Retailer" },
      { key: "phone", label: "Phone", required: false, example: "03001234567" },
      { key: "creditLimitPkr", label: "Credit Limit", required: false, example: "100000" },
      { key: "creditDays", label: "Credit Days", required: false, example: "30" },
      { key: "priceLevel", label: "Price Level", required: false, example: "retail" },
    ],
  },
  {
    id: "suppliers",
    fields: [
      { key: "name", label: "Supplier Name", required: true, example: "ABC Distributors" },
      { key: "phone", label: "Phone", required: false, example: "0211234567" },
      { key: "email", label: "Email", required: false, example: "ap@abc.com" },
      { key: "address", label: "Address", required: false, example: "Karachi" },
      { key: "paymentTerms", label: "Payment Terms", required: false, example: "Net 30" },
    ],
  },
  {
    id: "companies",
    fields: [
      { key: "code", label: "Company Code", required: true, example: "ABC" },
      { key: "name", label: "Company Name", required: true, example: "ABC Pharma" },
    ],
  },
  {
    id: "opening_stock",
    transactional: true,
    fields: [
      { key: "sku", label: "Product Code", required: true, example: "MED-001" },
      { key: "warehouseCode", label: "Warehouse Code", required: true, example: "MAIN" },
      { key: "batchNumber", label: "Batch", required: true, example: "B1" },
      { key: "expiryDate", label: "Expiry", required: true, example: "2027-12-31" },
      { key: "quantity", label: "Quantity", required: true, example: "100" },
      { key: "purchaseCost", label: "Purchase Cost", required: false, example: "80" },
    ],
  },
];

export type IoValidateResult = {
  module: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  errors: Array<{ row: number; field?: string; message: string; duplicate?: boolean }>;
  preview: Array<{
    row: number;
    status: string;
    values: Record<string, string>;
    issues: string[];
  }>;
};

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = Array.isArray(err?.message) ? err.message.join("; ") : err?.message;
  throw new Error(message ?? `${fallback}: ${res.status}`);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) await parseError(res, "IO request failed");
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, "IO request failed");
  return res.json() as Promise<T>;
}

export function buildLocalTemplateCsv(moduleId: string, fields: IoFieldDef[]): { filename: string; csv: string } {
  // Clean CSV only (no # comment rows) so Excel / Google Sheets open with a real header row.
  const header = fields.map((f) => f.label).join(",");
  const example = fields.map((f) => csvEscape(f.example)).join(",");
  return {
    filename: `${moduleId}-import-template.csv`,
    csv: `${header}\r\n${example}\r\n`,
  };
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export const ioApi = {
  modules: () => getJson<IoModuleDef[]>(`${BASE}/modules`),
  template: (module: string) =>
    getJson<{ filename: string; csv: string; fields: IoFieldDef[] }>(`${BASE}/templates/${module}`),
  validate: (body: Record<string, unknown>) => postJson<IoValidateResult>(`${BASE}/validate`, body),
  commit: (body: Record<string, unknown>) => postJson<Record<string, unknown>>(`${BASE}/commit`, body),
  jobs: (page = 1) =>
    getJson<{ items: Array<Record<string, unknown>>; total: number }>(`${BASE}/jobs?page=${page}`),
  job: (id: string) => getJson<Record<string, unknown>>(`${BASE}/jobs/${id}`),
  exportCsv: (body: Record<string, unknown>) =>
    postJson<{ filename: string; csv: string; rows: number }>(`${BASE}/export`, body),
  audit: (page = 1) =>
    getJson<{ items: Array<Record<string, unknown>>; total: number; page: number; pageSize: number }>(
      `${BASE}/audit?page=${page}`,
    ),
};

/** Reliable browser download (append + delayed revoke). BOM helps Excel open UTF-8. */
export function downloadTextFile(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\uFEFF", text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 2000);
}
