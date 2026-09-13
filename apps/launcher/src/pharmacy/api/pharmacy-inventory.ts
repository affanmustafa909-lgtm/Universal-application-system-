import { authFetch } from "../../lib/authFetch";

/**
 * Phase 4 inventory API client. Types mirror the exported return types of
 * `backend-system/api/src/pharmacy/inventory/*`; `Date` fields on the server
 * arrive as ISO strings over JSON and are typed as `string` here.
 */

async function parseError(res: Response, fallback: string): Promise<never> {
  let msg = fallback;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {
    // ignore
  }
  throw new Error(msg);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) await parseError(res, "Request failed");
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Request failed");
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Request failed");
  return (await res.json()) as T;
}

type QueryValue = string | number | boolean | undefined | null;

function qs(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const str = typeof value === "string" ? value.trim() : String(value);
    if (!str) continue;
    search.set(key, str);
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

const BASE = "/v1/pharmacy";

// ─── Shared shapes ──────────────────────────────────────────────────────────

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PageParams = {
  page?: number;
  pageSize?: number;
};

export type StockNumbers = {
  physicalQty: number;
  availableQty: number;
  reservedQty: number;
  damagedQty: number;
  quarantineQty: number;
  blockedQty: number;
  expiredQty: number;
  onHoldQty: number;
  nearExpiryQty: number;
  batchCount: number;
  valuePkr: number;
};

export type StockState = "ok" | "low" | "out" | "negative";

/** Values accepted by the `stockState` filter on `GET inventory/stock`. */
export const STOCK_STATE_FILTERS = [
  "all",
  "ok",
  "low",
  "out",
  "negative",
  "near_expiry",
  "expired",
  "has_hold",
] as const;

export const STOCK_SORTS = ["name_asc", "qty_asc", "qty_desc", "value_desc", "expiry_asc"] as const;

export type MovementDirection = "in" | "out" | "none";

export type LedgerMovementRow = {
  id: string;
  createdAt: string;
  movementType: string;
  rawMovementType: string;
  direction: MovementDirection;
  stockState: string;
  quantityDelta: number;
  quantityAfter: number;
  unitCostPkr: number;
  valuePkr: number;
  referenceType: string | null;
  referenceId: string | null;
  /** Human document # / party — never a bare UUID (when API provides it). */
  referenceLabel?: string | null;
  referenceNumber?: string | null;
  partyName?: string | null;
  notes: string | null;
  reversesMovementId: string | null;
  medicineId: string | null;
  medicineName: string | null;
  medicineSku: string | null;
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  userName: string | null;
};

// ─── Stock ──────────────────────────────────────────────────────────────────

export type StockRow = {
  medicineId: string;
  sku: string;
  name: string;
  unit: string;
  companyId: string | null;
  companyName: string | null;
  rackLocation: string | null;
  physicalQty: number;
  availableQty: number;
  reservedQty: number;
  damagedQty: number;
  quarantineQty: number;
  blockedQty: number;
  expiredQty: number;
  nearExpiryQty: number;
  batchCount: number;
  valuePkr: number;
  reorderLevel: number;
  minStock: number;
  maxStock: number;
  stockState: StockState;
  earliestExpiry: string | null;
};

export type StockTotals = {
  skuCount: number;
  availableQty: number;
  physicalQty: number;
  valuePkr: number;
  lowCount: number;
  outCount: number;
  nearExpiryQty: number;
  expiredQty: number;
};

export type StockListResult = PageResult<StockRow> & { totals: StockTotals };

export type StockListParams = PageParams & {
  branchCode: string;
  warehouseId?: string;
  /** Exact warehouse match for transfer pickers. */
  strictWarehouse?: boolean;
  companyId?: string;
  q?: string;
  stockState?: string;
  sort?: string;
};

export type ProductWarehouseRow = {
  warehouseId: string | null;
  warehouseName: string;
  availableQty: number;
  physicalQty: number;
  batchCount: number;
  valuePkr: number;
};

export type PurchaseHistoryRow = {
  grnId: string;
  grnNumber: string;
  date: string;
  supplierName: string | null;
  batchNumber: string;
  quantity: number;
  unitCostPkr: number;
};

export type SalesHistoryRow = {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  customerName: string | null;
  quantity: number;
  unitPricePkr: number;
};

export type ProductInventoryDetail = {
  medicine: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    companyName: string | null;
    reorderLevel: number;
    minStock: number;
    maxStock: number;
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    rackLocation: string | null;
    shelfLocation: string | null;
    aisleLocation: string | null;
  };
  stock: StockNumbers;
  byWarehouse: ProductWarehouseRow[];
  batches: BatchRow[];
  recentMovements: LedgerMovementRow[];
  purchaseHistory: PurchaseHistoryRow[];
  salesHistory: SalesHistoryRow[];
};

export type ValuationSummary = {
  costingMethod: CostingMethod;
  availableQty: number;
  physicalQty: number;
  availableValuePkr: number;
  physicalValuePkr: number;
  expiredValuePkr: number;
  damagedValuePkr: number;
  quarantineValuePkr: number;
  blockedValuePkr: number;
  nearExpiryValuePkr: number;
  batchesValued: number;
  batchesMissingCost: number;
  fallbackUsedCount: number;
  note: string;
};

export type InventoryDashboard = {
  totals: StockNumbers;
  counts: {
    skuCount: number;
    batchCount: number;
    warehouseCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    negativeStockCount: number;
    expiredBatchCount: number;
    nearExpiryBatchCount: number;
    holdBatchCount: number;
    activeReservationCount: number;
    pendingTransferCount: number;
    pendingAdjustmentCount: number;
  };
  valuation: ValuationSummary;
  expiry: ExpiryBucketsResult;
  topValueProducts: ValuationReportRow[];
  recentMovements: LedgerMovementRow[];
};

export type ReorderRow = {
  medicineId: string;
  sku: string;
  name: string;
  unit: string;
  companyName: string | null;
  availableQty: number;
  reorderLevel: number;
  minStock: number;
  maxStock: number;
  avgDailySales: number;
  /** null when there is no consumption to divide by. */
  daysOfCover: number | null;
  suggestedQty: number;
  urgency: "critical" | "high" | "normal";
  reason: string;
};

export type ReorderResult = PageResult<ReorderRow> & { formula: string };

export type SlowMovingRow = {
  medicineId: string;
  sku: string;
  name: string;
  availableQty: number;
  valuePkr: number;
  lastMovementAt: string | null;
  daysSinceMovement: number | null;
  unitsSoldInPeriod: number;
};

export type StockAgingRow = {
  batchId: string;
  medicineId: string;
  sku: string;
  name: string;
  batchNumber: string;
  expiryDate: string;
  warehouseName: string | null;
  quantity: number;
  physicalQty: number;
  valuePkr: number;
  receivedAt: string;
  ageDays: number;
  bucket: string;
};

export type StockAgingResult = {
  buckets: { label: string; batchCount: number; quantity: number; valuePkr: number }[];
  items: PageResult<StockAgingRow>;
};

export type ReconciliationRow = {
  medicineId: string;
  sku: string;
  name: string;
  cachedCurrentStock: number;
  batchSumQuantity: number;
  cacheDrift: number;
  ledgerNetQuantity: number;
  ledgerDrift: number;
  note: string;
};

export type ReconciliationResult = {
  checkedSkus: number;
  discrepancyCount: number;
  items: PageResult<ReconciliationRow>;
};

export type DataQualityCheck = {
  check: string;
  severity: "critical" | "warning" | "info";
  count: number;
  description: string;
  sampleIds: string[];
};

export type AvailabilityAllocation = {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  warehouseId: string | null;
  quantity: number;
  unitCostPkr: number;
  overridden: boolean;
};

export type AvailabilityResult = {
  branch: { id: string; code: string; name: string };
  warehouse: { id: string; code: string; name: string } | null;
  policy: { negativeStockPolicy: NegativeStockPolicy; blockExpiredSale: boolean };
  fulfillable: boolean;
  lines: {
    medicineId: string;
    sku: string | null;
    name: string | null;
    requestedQty: number;
    availableQty: number;
    reservedQty: number;
    fulfillable: boolean;
    shortfall: number;
    allocations: AvailabilityAllocation[];
    excluded: { batchId: string; batchNumber: string; quantity: number; reason: string }[];
    reason: string | null;
  }[];
};

export const inventoryApi = {
  dashboard: (params: { branchCode: string; warehouseId?: string }) =>
    getJson<InventoryDashboard>(`${BASE}/inventory/dashboard${qs({ ...params })}`),

  listStock: (params: StockListParams) =>
    getJson<StockListResult>(`${BASE}/inventory/stock${qs({ ...params })}`),

  productInventory: (medicineId: string, params: { branchCode: string; warehouseId?: string }) =>
    getJson<ProductInventoryDetail>(
      `${BASE}/inventory/stock/${encodeURIComponent(medicineId)}${qs({ ...params })}`,
    ),

  availability: (params: {
    branchCode: string;
    warehouseId?: string;
    medicineId: string;
    quantity?: number;
    batchId?: string;
  }) => getJson<AvailabilityResult>(`${BASE}/inventory/availability${qs({ ...params })}`),

  checkAvailability: (body: {
    branchCode: string;
    warehouseId?: string;
    lines: { medicineId: string; quantity: number; batchId?: string | null }[];
  }) => postJson<AvailabilityResult>(`${BASE}/inventory/availability`, body),

  reorder: (params: PageParams & { branchCode: string; warehouseId?: string; companyId?: string }) =>
    getJson<ReorderResult>(`${BASE}/inventory/reorder${qs({ ...params })}`),

  slowMoving: (params: PageParams & { branchCode: string; warehouseId?: string; days?: number }) =>
    getJson<PageResult<SlowMovingRow>>(`${BASE}/inventory/slow-moving${qs({ ...params })}`),

  aging: (params: PageParams & { branchCode: string; warehouseId?: string }) =>
    getJson<StockAgingResult>(`${BASE}/inventory/aging${qs({ ...params })}`),

  reconcile: (params: PageParams & { branchCode: string }) =>
    getJson<ReconciliationResult>(`${BASE}/inventory/reconcile${qs({ ...params })}`),

  dataQuality: (params: { branchCode: string }) =>
    getJson<DataQualityCheck[]>(`${BASE}/inventory/data-quality${qs({ ...params })}`),
};

// ─── Batches & expiry ───────────────────────────────────────────────────────

export type BatchDerivedStatus = "expired" | "hold" | "depleted" | "near_expiry" | "active";

export const BATCH_STATUS_FILTERS = ["all", "active", "hold", "expired", "near_expiry", "zero"] as const;

/** Manual hold flags the backend accepts on `POST inventory/batches/:id/hold`. */
export const BATCH_HOLD_STATUSES = ["active", "blocked", "quarantine", "recalled"] as const;

export type BatchRow = {
  id: string;
  medicineId: string;
  medicineName: string;
  medicineSku: string;
  companyName: string | null;
  batchNumber: string;
  manufacturingDate: string | null;
  expiryDate: string;
  warehouseId: string | null;
  warehouseName: string | null;
  quantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  quarantineQuantity: number;
  blockedQuantity: number;
  physicalQty: number;
  purchaseRatePkr: number;
  saleRatePkr: number;
  valuePkr: number;
  status: string;
  holdReason: string | null;
  derivedStatus: BatchDerivedStatus;
  daysToExpiry: number;
  createdAt: string;
};

export type BatchReservationRow = {
  id: string;
  referenceType: string;
  referenceId: string;
  quantity: number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
};

export type BatchSoldToCustomer = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerId: string | null;
  customerName: string | null;
  quantity: number;
};

export type BatchTraceability = {
  supplierId: string | null;
  supplierName: string | null;
  grnId: string | null;
  grnNumber: string | null;
  receivedAt: string;
  soldToCustomers: BatchSoldToCustomer[];
};

export type BatchDetail = BatchRow & {
  movements: LedgerMovementRow[];
  reservations: BatchReservationRow[];
  traceability: BatchTraceability;
};

export type ExpiryBucket = {
  label: string;
  fromDays: number;
  /** null on the final open-ended bucket. */
  toDays: number | null;
  batchCount: number;
  quantity: number;
  valuePkr: number;
};

export type ExpiryBucketsResult = {
  buckets: ExpiryBucket[];
  expired: { batchCount: number; quantity: number; valuePkr: number };
  totalNearExpiryValuePkr: number;
};

export type BatchListParams = PageParams & {
  branchCode: string;
  warehouseId?: string;
  strictWarehouse?: boolean;
  medicineId?: string;
  companyId?: string;
  q?: string;
  status?: string;
  expiringInDays?: number;
  sort?: string;
};

export const batchesApi = {
  list: (params: BatchListParams) =>
    getJson<PageResult<BatchRow>>(`${BASE}/inventory/batches${qs({ ...params })}`),

  detail: (batchId: string, params: { branchCode: string }) =>
    getJson<BatchDetail>(`${BASE}/inventory/batches/${encodeURIComponent(batchId)}${qs({ ...params })}`),

  setHold: (batchId: string, body: { branchCode: string; status: string; reason?: string }) =>
    postJson<BatchRow>(`${BASE}/inventory/batches/${encodeURIComponent(batchId)}/hold`, body),

  expiryBuckets: (params: { branchCode: string; warehouseId?: string; companyId?: string }) =>
    getJson<ExpiryBucketsResult>(`${BASE}/inventory/expiry/buckets${qs({ ...params })}`),

  expiringBatches: (
    params: PageParams & {
      branchCode: string;
      warehouseId?: string;
      bucket?: string;
      includeExpired?: boolean;
    },
  ) => getJson<PageResult<BatchRow>>(`${BASE}/inventory/expiry/batches${qs({ ...params })}`),
};

// ─── Stock ledger ───────────────────────────────────────────────────────────

export type LedgerParams = PageParams & {
  branchCode: string;
  warehouseId?: string;
  medicineId?: string;
  batchId?: string;
  movementType?: string;
  referenceType?: string;
  referenceId?: string;
  from?: string;
  to?: string;
  q?: string;
};

export type LedgerTotals = {
  quantityIn: number;
  quantityOut: number;
  netQuantity: number;
  valueInPkr: number;
  valueOutPkr: number;
  rows: number;
};

export const ledgerApi = {
  movementTypes: () => getJson<{ types: string[] }>(`${BASE}/inventory/movement-types`),

  list: (params: LedgerParams) =>
    getJson<PageResult<LedgerMovementRow>>(`${BASE}/inventory/ledger${qs({ ...params })}`),

  totals: (params: Omit<LedgerParams, "page" | "pageSize">) =>
    getJson<LedgerTotals>(`${BASE}/inventory/ledger/totals${qs({ ...params })}`),
};

// ─── Valuation ──────────────────────────────────────────────────────────────

export type CostSource = "batch" | "product_cost" | "product_purchase" | "none";

export type WarehouseValuationRow = {
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string;
  availableQty: number;
  availableValuePkr: number;
  physicalValuePkr: number;
  batchCount: number;
};

export type CompanyValuationRow = {
  companyId: string | null;
  companyName: string;
  availableQty: number;
  availableValuePkr: number;
  batchCount: number;
  skuCount: number;
};

export type ValuationReportRow = {
  medicineId: string;
  sku: string;
  name: string;
  companyName: string | null;
  unit: string;
  availableQty: number;
  physicalQty: number;
  unitCostPkr: number;
  availableValuePkr: number;
  costSource: CostSource;
};

export type ValuationParams = {
  branchCode: string;
  warehouseId?: string;
  companyId?: string;
};

export const valuationApi = {
  summary: (params: ValuationParams) =>
    getJson<ValuationSummary>(`${BASE}/inventory/valuation/summary${qs({ ...params })}`),

  byWarehouse: (params: ValuationParams) =>
    getJson<WarehouseValuationRow[]>(`${BASE}/inventory/valuation/by-warehouse${qs({ ...params })}`),

  byCompany: (params: ValuationParams) =>
    getJson<CompanyValuationRow[]>(`${BASE}/inventory/valuation/by-company${qs({ ...params })}`),

  report: (params: ValuationParams & PageParams & { q?: string }) =>
    getJson<PageResult<ValuationReportRow>>(`${BASE}/inventory/valuation/report${qs({ ...params })}`),
};

// ─── Settings ───────────────────────────────────────────────────────────────

export type NegativeStockPolicy = "block" | "warn" | "allow";
export type CostingMethod = "batch_purchase_rate" | "product_cost_price";
export type ReorderFormula = "reorder_level" | "min_max" | "avg_consumption";

export type InventorySettings = {
  negativeStockPolicy: NegativeStockPolicy;
  blockExpiredSale: boolean;
  allowFefoOverride: boolean;
  adjustmentApprovalThreshold: number;
  requireAdjustmentApproval: boolean;
  expiryBuckets: number[];
  nearExpiryDays: number;
  slowMovingDays: number;
  costingMethod: CostingMethod;
  reorderFormula: ReorderFormula;
  reorderLeadTimeDays: number;
  reorderSafetyDays: number;
  source: "branch" | "organization" | "default";
};

export type InventorySettingsPatch = Partial<{
  negativeStockPolicy: NegativeStockPolicy;
  blockExpiredSale: boolean;
  allowFefoOverride: boolean;
  adjustmentApprovalThreshold: number;
  requireAdjustmentApproval: boolean;
  expiryBuckets: number[];
  nearExpiryDays: number;
  slowMovingDays: number;
  costingMethod: CostingMethod;
  reorderFormula: ReorderFormula;
  reorderLeadTimeDays: number;
  reorderSafetyDays: number;
}>;

export const inventorySettingsApi = {
  get: (params: { branchCode?: string }) =>
    getJson<InventorySettings>(`${BASE}/inventory/settings${qs({ ...params })}`),

  update: (body: InventorySettingsPatch & { branchCode?: string }) =>
    patchJson<InventorySettings>(`${BASE}/inventory/settings`, body),
};

// ─── Stock transfers ────────────────────────────────────────────────────────

export type TransferStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "dispatched"
  | "received"
  | "completed"
  | "cancelled";

export const TRANSFER_STATUSES: TransferStatus[] = [
  "draft",
  "submitted",
  "approved",
  "dispatched",
  "received",
  "completed",
  "cancelled",
];

export type TransferRow = {
  id: string;
  transferNumber: string;
  status: string;
  transferDate: string | null;
  branchId: string;
  fromWarehouseId: string;
  fromWarehouseCode: string | null;
  fromWarehouseName: string | null;
  toWarehouseId: string;
  toWarehouseCode: string | null;
  toWarehouseName: string | null;
  toBranchId: string | null;
  reason: string | null;
  notes: string | null;
  cancelReason: string | null;
  lineCount: number;
  totalQuantity: number;
  totalReceivedQuantity: number;
  totalShortage: number;
  totalValuePkr: number;
  submittedAt: string | null;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type TransferLineDetail = {
  id: string;
  medicineId: string;
  medicineName: string;
  medicineSku: string;
  unit: string;
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  receivedQuantity: number;
  shortage: number;
  unitCostPkr: number;
  valuePkr: number;
  destinationBatchId: string | null;
  destinationBatchNumber: string | null;
  notes: string | null;
};

export type TransferDetail = TransferRow & {
  fromBranch: { id: string; code: string; name: string };
  toBranch: { id: string; code: string; name: string };
  lines: TransferLineDetail[];
};

export type TransferLineInput = {
  medicineId: string;
  batchId?: string;
  quantity: number;
  notes?: string;
};

export type TransferListParams = PageParams & {
  branchCode: string;
  status?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  q?: string;
  from?: string;
  to?: string;
};

export const transfersApi = {
  list: (params: TransferListParams) =>
    getJson<PageResult<TransferRow>>(`${BASE}/inventory/transfers${qs({ ...params })}`),

  detail: (id: string, params: { branchCode: string }) =>
    getJson<TransferDetail>(`${BASE}/inventory/transfers/${encodeURIComponent(id)}${qs({ ...params })}`),

  create: (body: {
    branchCode: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    toBranchId?: string;
    transferDate?: string;
    reason?: string;
    notes?: string;
    lines: TransferLineInput[];
  }) => postJson<TransferDetail>(`${BASE}/inventory/transfers`, body),

  update: (
    id: string,
    body: {
      branchCode: string;
      fromWarehouseId?: string;
      toWarehouseId?: string;
      toBranchId?: string;
      transferDate?: string;
      reason?: string;
      notes?: string;
      lines?: TransferLineInput[];
    },
  ) => patchJson<TransferDetail>(`${BASE}/inventory/transfers/${encodeURIComponent(id)}`, body),

  submit: (id: string, body: { branchCode: string }) =>
    postJson<TransferDetail>(`${BASE}/inventory/transfers/${encodeURIComponent(id)}/submit`, body),

  approve: (id: string, body: { branchCode: string }) =>
    postJson<TransferDetail>(`${BASE}/inventory/transfers/${encodeURIComponent(id)}/approve`, body),

  dispatch: (id: string, body: { branchCode: string }) =>
    postJson<TransferDetail>(`${BASE}/inventory/transfers/${encodeURIComponent(id)}/dispatch`, body),

  receive: (
    id: string,
    body: { branchCode: string; lines?: { lineId: string; receivedQuantity: number }[] },
  ) => postJson<TransferDetail>(`${BASE}/inventory/transfers/${encodeURIComponent(id)}/receive`, body),

  cancel: (id: string, body: { branchCode: string; reason: string }) =>
    postJson<TransferDetail>(`${BASE}/inventory/transfers/${encodeURIComponent(id)}/cancel`, body),
};

// ─── Stock adjustments ──────────────────────────────────────────────────────

export const ADJUSTMENT_TYPES = [
  "increase",
  "decrease",
  "damage",
  "expiry",
  "write_off",
  "quarantine",
  "release",
] as const;

export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export type AdjustmentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "posted"
  | "cancelled";

export const ADJUSTMENT_STATUSES: AdjustmentStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "posted",
  "cancelled",
];

/** Types the backend refuses without a batch on every line. */
export const ADJUSTMENT_TYPES_REQUIRING_BATCH: AdjustmentType[] = [
  "damage",
  "expiry",
  "quarantine",
  "release",
];

export type AdjustmentRow = {
  id: string;
  adjustmentNumber: string;
  status: string;
  adjustmentType: string;
  branchId: string;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  reason: string;
  notes: string | null;
  rejectReason: string | null;
  totalQuantity: number;
  totalValuePkr: number;
  lineCount: number;
  approvedAt: string | null;
  rejectedAt: string | null;
  postedAt: string | null;
  createdAt: string;
};

export type AdjustmentLineDetail = {
  id: string;
  medicineId: string;
  medicineName: string;
  medicineSku: string;
  unit: string;
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  /** Signed: negative reduces available stock. */
  quantity: number;
  stockState: string;
  unitCostPkr: number;
  valuePkr: number;
  notes: string | null;
};

export type AdjustmentDetail = AdjustmentRow & {
  requiresApproval: boolean;
  lines: AdjustmentLineDetail[];
};

export type AdjustmentLineInput = {
  medicineId: string;
  batchId?: string | null;
  /** Positive magnitude; the document type decides the direction. */
  quantity: number;
  notes?: string | null;
};

export type AdjustmentListParams = PageParams & {
  branchCode: string;
  status?: string;
  adjustmentType?: string;
  warehouseId?: string;
  q?: string;
  from?: string;
  to?: string;
};

export const adjustmentsApi = {
  list: (params: AdjustmentListParams) =>
    getJson<PageResult<AdjustmentRow>>(`${BASE}/inventory/adjustments${qs({ ...params })}`),

  detail: (id: string, params: { branchCode: string }) =>
    getJson<AdjustmentDetail>(`${BASE}/inventory/adjustments/${encodeURIComponent(id)}${qs({ ...params })}`),

  create: (body: {
    branchCode: string;
    warehouseId: string;
    adjustmentType: AdjustmentType;
    reason: string;
    notes?: string;
    lines: AdjustmentLineInput[];
  }) => postJson<AdjustmentDetail>(`${BASE}/inventory/adjustments`, body),

  update: (
    id: string,
    body: {
      branchCode: string;
      warehouseId?: string;
      adjustmentType?: AdjustmentType;
      reason?: string;
      notes?: string;
      lines?: AdjustmentLineInput[];
    },
  ) => patchJson<AdjustmentDetail>(`${BASE}/inventory/adjustments/${encodeURIComponent(id)}`, body),

  submit: (id: string, body: { branchCode: string }) =>
    postJson<AdjustmentDetail>(`${BASE}/inventory/adjustments/${encodeURIComponent(id)}/submit`, body),

  approve: (id: string, body: { branchCode: string }) =>
    postJson<AdjustmentDetail>(`${BASE}/inventory/adjustments/${encodeURIComponent(id)}/approve`, body),

  reject: (id: string, body: { branchCode: string; reason: string }) =>
    postJson<AdjustmentDetail>(`${BASE}/inventory/adjustments/${encodeURIComponent(id)}/reject`, body),
};

// ─── Stock counts ───────────────────────────────────────────────────────────

export type CountStatus = "draft" | "counting" | "review" | "posted" | "cancelled";

export const COUNT_STATUSES: CountStatus[] = ["draft", "counting", "review", "posted", "cancelled"];

export const COUNT_TYPES = ["full", "cycle"] as const;

export type CountType = (typeof COUNT_TYPES)[number];

export type CountScope = {
  companyId?: string;
  categoryId?: string;
  /** Free-text medicine.category when no master category row exists. */
  category?: string;
  medicineIds?: string[];
  rackLocation?: string;
};

export type CountRow = {
  id: string;
  countNumber: string;
  status: string;
  countType: string;
  branchId: string;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  notes: string | null;
  scope: CountScope | null;
  lineCount: number;
  varianceQuantity: number;
  varianceValuePkr: number;
  adjustmentId: string | null;
  postedAt: string | null;
  createdAt: string;
};

export type CountLineDetail = {
  id: string;
  medicineId: string;
  medicineName: string;
  medicineSku: string;
  unit: string;
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  systemQuantity: number;
  countedQuantity: number | null;
  varianceQuantity: number;
  varianceValuePkr: number;
  unitCostPkr: number;
  counted: boolean;
  notes: string | null;
};

export type CountDetail = CountRow & {
  countedLines: number;
  /** Never counted, therefore never posted — a skipped line is not a zero. */
  uncountedLines: number;
  varianceLines: number;
  lines: PageResult<CountLineDetail>;
};

export type CountListParams = PageParams & {
  branchCode: string;
  status?: string;
  countType?: string;
  warehouseId?: string;
  q?: string;
};

export const countsApi = {
  list: (params: CountListParams) =>
    getJson<PageResult<CountRow>>(`${BASE}/inventory/counts${qs({ ...params })}`),

  detail: (
    id: string,
    params: PageParams & { branchCode: string; onlyVariance?: boolean },
  ) => getJson<CountDetail>(`${BASE}/inventory/counts/${encodeURIComponent(id)}${qs({ ...params })}`),

  create: (body: {
    branchCode: string;
    warehouseId: string;
    countType?: CountType;
    notes?: string;
    scope?: CountScope;
  }) => postJson<CountDetail>(`${BASE}/inventory/counts`, body),

  record: (
    id: string,
    body: {
      branchCode: string;
      lines: { lineId: string; countedQuantity: number; notes?: string }[];
    },
  ) => postJson<CountDetail>(`${BASE}/inventory/counts/${encodeURIComponent(id)}/record`, body),

  post: (id: string, body: { branchCode: string; reason?: string }) =>
    postJson<{ count: CountDetail; adjustmentId: string | null }>(
      `${BASE}/inventory/counts/${encodeURIComponent(id)}/post`,
      body,
    ),

  cancel: (id: string, body: { branchCode: string; reason: string }) =>
    postJson<CountDetail>(`${BASE}/inventory/counts/${encodeURIComponent(id)}/cancel`, body),
};
