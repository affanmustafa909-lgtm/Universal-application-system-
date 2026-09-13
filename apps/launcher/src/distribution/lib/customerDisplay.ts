/**
 * System-wide rule: never show a UUID as a human label.
 * Prefer name → code → document number → short fallback (never the raw UUID).
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** Replace bare UUIDs in API error text with human labels from a map. */
export function replaceUuidsInMessage(
  message: string,
  labelById: Map<string, string> | Record<string, string>,
): string {
  return message.replace(UUID_RE, (id) => {
    const mapped =
      labelById instanceof Map ? labelById.get(id) : (labelById as Record<string, string>)[id];
    if (mapped && String(mapped).trim() && !looksLikeUuid(mapped)) return String(mapped).trim();
    return "this product";
  });
}

export function customerDisplayName(
  row: {
    name?: string | null;
    customerName?: string | null;
    tradeCustomerName?: string | null;
    contactName?: string | null;
    code?: string | null;
    customerCode?: string | null;
    tradeCustomerCode?: string | null;
    tradeCustomerId?: string | null;
    id?: string | null;
  } | null | undefined,
  nameById?: Map<string, string> | Record<string, string>,
): string {
  if (!row) return "—";

  const direct =
    (row.tradeCustomerName && String(row.tradeCustomerName).trim()) ||
    (row.customerName && String(row.customerName).trim()) ||
    (row.contactName && String(row.contactName).trim()) ||
    (row.name && String(row.name).trim()) ||
    "";

  if (direct && !looksLikeUuid(direct)) return direct;

  const id = String(row.tradeCustomerId ?? row.id ?? "").trim();
  if (id && nameById) {
    const mapped =
      nameById instanceof Map ? nameById.get(id) : (nameById as Record<string, string>)[id];
    if (mapped && String(mapped).trim() && !looksLikeUuid(mapped)) return String(mapped).trim();
  }

  const code =
    (row.tradeCustomerCode && String(row.tradeCustomerCode).trim()) ||
    (row.customerCode && String(row.customerCode).trim()) ||
    (row.code && String(row.code).trim()) ||
    "";
  if (code && !looksLikeUuid(code)) return code;

  return "—";
}

/** Build id→name map from trade-customer list rows. */
export function tradeCustomerNameMap(
  customers: Array<{ id?: string; name?: string | null; code?: string | null }> | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of customers ?? []) {
    if (!c?.id) continue;
    const label = (c.name && String(c.name).trim()) || (c.code && String(c.code).trim()) || "";
    if (label && !looksLikeUuid(label)) map.set(c.id, label);
  }
  return map;
}

const REF_TYPE_LABELS: Record<string, string> = {
  wholesale_return: "Wholesale return",
  sales_return: "Sales return",
  purchase_return: "Purchase return",
  purchase_order: "Purchase order",
  purchase: "Purchase",
  grn: "GRN",
  stock_transfer: "Stock transfer",
  stock_adjustment: "Stock adjustment",
  dist_order: "Sale order",
  distribution_order: "Sale order",
  collection: "Collection",
  invoice: "Invoice",
  sale: "Sale",
  opening_stock: "Opening stock",
};

function titleCaseRef(type: string): string {
  return type
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Ledger / document reference for UI: never append a raw UUID.
 * Prefer referenceLabel (from API) → document number → type label only.
 */
export function documentReferenceLabel(row: {
  referenceType?: string | null;
  referenceId?: string | null;
  referenceLabel?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  partyName?: string | null;
}): string {
  const apiLabel = (row.referenceLabel && String(row.referenceLabel).trim()) || "";
  if (apiLabel && !looksLikeUuid(apiLabel)) return apiLabel;

  const typeRaw = (row.referenceType && String(row.referenceType).trim()) || "";
  const typeLabel =
    (typeRaw && (REF_TYPE_LABELS[typeRaw.toLowerCase()] ?? titleCaseRef(typeRaw))) || "";

  const number =
    (row.referenceNumber && String(row.referenceNumber).trim()) ||
    (row.referenceId && !looksLikeUuid(row.referenceId) ? String(row.referenceId).trim() : "") ||
    "";

  const party = (row.partyName && String(row.partyName).trim()) || "";
  const partyOk = party && !looksLikeUuid(party) ? party : "";

  if (typeLabel && number && partyOk) return `${typeLabel} ${number} · ${partyOk}`;
  if (typeLabel && number) return `${typeLabel} ${number}`;
  if (typeLabel && partyOk) return `${typeLabel} · ${partyOk}`;
  if (typeLabel) return typeLabel;
  if (number) return number;

  const notes = (row.notes && String(row.notes).trim()) || "";
  if (notes && !looksLikeUuid(notes)) return notes;

  return "—";
}
