import { authFetch } from "../../lib/authFetch";

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

async function getJson<T = unknown>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) await parseError(res, "Request failed");
  return (await res.json()) as T;
}

async function postJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Request failed");
  return (await res.json()) as T;
}

async function patchJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Request failed");
  return (await res.json()) as T;
}

export type MasterPageFilters = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  sort?: string;
  companyId?: string;
  genericId?: string;
  parentId?: string;
  branchCode?: string;
};

export type MasterPageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MasterRef = {
  id: string;
  code: string;
  name: string;
  status: string;
  notes?: string | null;
  description?: string | null;
  companyId?: string | null;
  parentId?: string | null;
  baseUnit?: string | null;
  ratePct?: number;
  taxType?: string;
  createdAt?: string;
};

export type MastersOverview = {
  companies: number;
  generics: number;
  brands: number;
  categories: number;
  dosageForms: number;
  units: number;
  taxProfiles: number;
  medicines: number;
  warehouses: number;
  tradeCustomers: number;
};

export type MasterDataQuality = {
  medicinesWithoutCompany: number;
  medicinesWithoutPrice: number;
  medicinesWithoutUnit: number;
  customersWithoutRoute: number;
  customersWithoutSalesman: number;
  duplicateBarcodeCandidates: { barcode: string | null; count: number }[];
  inactiveCompanyLinkedMedicines: number;
};

export type MedicineMasterRow = {
  id: string;
  sku: string;
  name: string;
  genericName?: string | null;
  brandName?: string | null;
  category?: string;
  manufacturer?: string | null;
  companyId?: string | null;
  genericId?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  dosageFormId?: string | null;
  unitId?: string | null;
  taxProfileId?: string | null;
  barcode?: string | null;
  purchasePricePkr?: number;
  sellingPricePkr?: number;
  wholesalePricePkr?: number;
  dealerPricePkr?: number;
  costPricePkr?: number;
  taxPct?: number;
  reorderLevel?: number;
  currentStock?: number;
  unit?: string;
  tabletsPerStrip?: number;
  stripsPerBox?: number;
  dosageStrength?: string | null;
  presentation?: string | null;
  isControlled?: boolean;
  prescriptionRequired?: boolean;
  batchTrackingEnabled?: boolean;
  expiryTrackingEnabled?: boolean;
  fefoEnabled?: boolean;
  restrictedSale?: boolean;
  minStock?: number;
  maxStock?: number;
  preferredWarehouseId?: string | null;
  aisleLocation?: string | null;
  rackLocation?: string | null;
  shelfLocation?: string | null;
  status: string;
};

export type MedicineMasterDetail = MedicineMasterRow & {
  companyName?: string | null;
  companyCode?: string | null;
  genericNameMaster?: string | null;
  brandNameMaster?: string | null;
  categoryNameMaster?: string | null;
  dosageFormName?: string | null;
  unitNameMaster?: string | null;
  taxProfileName?: string | null;
  taxProfileRatePct?: number | null;
  refs?: {
    company?: { id: string; code: string; name: string } | null;
    generic?: { id: string; code: string; name: string } | null;
    brand?: { id: string; code: string; name: string } | null;
    category?: { id: string; code: string; name: string } | null;
    dosageForm?: { id: string; code: string; name: string } | null;
    unit?: { id: string; code: string; name: string } | null;
    taxProfile?: { id: string; code: string; name: string; ratePct?: number } | null;
  };
};

function masterQs(filters: MasterPageFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.page != null) params.set("page", String(filters.page));
  if (filters.pageSize != null) params.set("pageSize", String(filters.pageSize));
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.status?.trim()) params.set("status", filters.status.trim());
  if (filters.sort?.trim()) params.set("sort", filters.sort.trim());
  if (filters.companyId) params.set("companyId", filters.companyId);
  if (filters.genericId) params.set("genericId", filters.genericId);
  if (filters.parentId) params.set("parentId", filters.parentId);
  if (filters.branchCode) params.set("branchCode", filters.branchCode);
  return params.toString();
}

function withQs(path: string, filters?: MasterPageFilters): string {
  const q = masterQs(filters);
  return q ? `${path}?${q}` : path;
}

type MasterKind = "generics" | "brands" | "categories" | "dosage-forms" | "units" | "tax-profiles";

function masterPath(kind: MasterKind, id?: string): string {
  return id ? `/v1/pharmacy/masters/${kind}/${id}` : `/v1/pharmacy/masters/${kind}`;
}

function makeReferenceMasterApi(kind: MasterKind) {
  return {
    list: (filters?: MasterPageFilters) =>
      getJson<MasterPageResult<MasterRef>>(withQs(masterPath(kind), filters)),
    create: (body: Record<string, unknown>) => postJson<MasterRef>(masterPath(kind), body),
    update: (id: string, body: Record<string, unknown>) =>
      patchJson<MasterRef>(masterPath(kind, id), body),
    setStatus: (id: string, status: string) =>
      postJson<MasterRef>(`${masterPath(kind, id)}/status`, { status }),
  };
}

export const genericsApi = makeReferenceMasterApi("generics");
export const brandsApi = makeReferenceMasterApi("brands");
export const categoriesApi = makeReferenceMasterApi("categories");
export const dosageFormsApi = makeReferenceMasterApi("dosage-forms");
export const unitsApi = makeReferenceMasterApi("units");
export const taxProfilesApi = makeReferenceMasterApi("tax-profiles");

export const listGenerics = genericsApi.list;
export const createGeneric = genericsApi.create;
export const updateGeneric = genericsApi.update;
export const setGenericStatus = genericsApi.setStatus;

export const listBrands = brandsApi.list;
export const createBrand = brandsApi.create;
export const updateBrand = brandsApi.update;
export const setBrandStatus = brandsApi.setStatus;

export const listCategories = categoriesApi.list;
export const createCategory = categoriesApi.create;
export const updateCategory = categoriesApi.update;
export const setCategoryStatus = categoriesApi.setStatus;

export const listDosageForms = dosageFormsApi.list;
export const createDosageForm = dosageFormsApi.create;
export const updateDosageForm = dosageFormsApi.update;
export const setDosageFormStatus = dosageFormsApi.setStatus;

export const listUnits = unitsApi.list;
export const createUnit = unitsApi.create;
export const updateUnit = unitsApi.update;
export const setUnitStatus = unitsApi.setStatus;

export const listTaxProfiles = taxProfilesApi.list;
export const createTaxProfile = taxProfilesApi.create;
export const updateTaxProfile = taxProfilesApi.update;
export const setTaxProfileStatus = taxProfilesApi.setStatus;

export function listMedicinesPaged(filters: MasterPageFilters & { branchCode: string }) {
  return getJson<MasterPageResult<MedicineMasterRow>>(
    withQs("/v1/pharmacy/masters/medicines", filters),
  );
}

export function getMedicineDetail(id: string) {
  return getJson<MedicineMasterDetail>(`/v1/pharmacy/masters/medicines/${id}`);
}

export function updateMedicine(id: string, body: Record<string, unknown>) {
  return patchJson<MedicineMasterDetail>(`/v1/pharmacy/masters/medicines/${id}`, body);
}

export function setMedicineStatus(id: string, status: string) {
  return postJson<MedicineMasterRow>(`/v1/pharmacy/masters/medicines/${id}/status`, { status });
}

export function fetchMastersOverview() {
  return getJson<MastersOverview>("/v1/pharmacy/masters/overview");
}

export function fetchMasterDataQuality(branchCode?: string) {
  const q = branchCode ? `?branchCode=${encodeURIComponent(branchCode)}` : "";
  return getJson<MasterDataQuality>(`/v1/pharmacy/masters/data-quality${q}`);
}

export type CompanyRow = {
  id: string;
  code: string;
  name: string;
  manufacturerName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  status: string;
  notes?: string | null;
};

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  city?: string | null;
  area?: string | null;
  managerName?: string | null;
  isDefault?: boolean;
  status: string;
  branchId?: string;
};

export type TradeCustomerRow = {
  id: string;
  code: string;
  name: string;
  businessName?: string | null;
  customerType?: string;
  phone?: string | null;
  creditLimitPkr?: number;
  outstandingPkr?: number;
  creditDays?: number;
  priceLevel?: string;
  routeId?: string | null;
  salesmanEmployeeId?: string | null;
  areaId?: string | null;
  cityId?: string | null;
  territoryId?: string | null;
  status: string;
};

export function listCompaniesPaged(filters?: MasterPageFilters) {
  return getJson<MasterPageResult<CompanyRow>>(withQs("/v1/pharmacy/companies", { page: 1, pageSize: 25, ...filters }));
}

export function updateCompany(id: string, body: Record<string, unknown>) {
  return patchJson<CompanyRow>(`/v1/pharmacy/companies/${id}`, body);
}

export function setCompanyStatus(id: string, status: string) {
  return postJson<CompanyRow>(`/v1/pharmacy/companies/${id}/status`, { status });
}

export function listWarehousesPaged(filters: MasterPageFilters & { branchCode: string }) {
  return getJson<MasterPageResult<WarehouseRow>>(
    withQs("/v1/pharmacy/warehouses", { page: 1, pageSize: 25, ...filters }),
  );
}

export function updateWarehouse(id: string, body: Record<string, unknown>) {
  return patchJson<WarehouseRow>(`/v1/pharmacy/warehouses/${id}`, body);
}

export function setWarehouseStatus(id: string, status: string) {
  return postJson<WarehouseRow>(`/v1/pharmacy/warehouses/${id}/status`, { status });
}

export function listTradeCustomersPaged(filters?: MasterPageFilters) {
  return getJson<MasterPageResult<TradeCustomerRow>>(
    withQs("/v1/pharmacy/trade-customers", { page: 1, pageSize: 25, ...filters }),
  );
}

export function updateTradeCustomer(id: string, body: Record<string, unknown>) {
  return patchJson<TradeCustomerRow>(`/v1/pharmacy/trade-customers/${id}`, body);
}

export function setTradeCustomerStatus(id: string, status: string) {
  return postJson<TradeCustomerRow>(`/v1/pharmacy/trade-customers/${id}/status`, { status });
}

export function updateSalesForce(id: string, body: Record<string, unknown>) {
  return patchJson(`/v1/pharmacy/sales-force/${id}`, body);
}

export function setSalesForceStatus(id: string, status: string) {
  return postJson(`/v1/pharmacy/sales-force/${id}/status`, { status });
}

export function updatePriceList(id: string, body: Record<string, unknown>) {
  return patchJson(`/v1/pharmacy/pricing/lists/${id}`, body);
}

export function listPriceListItems(listId: string) {
  return getJson<{ id: string; medicineId: string; unitPricePkr: number; minQty: number }[]>(
    `/v1/pharmacy/pricing/lists/${listId}/items`,
  );
}

export function upsertPriceListItems(
  listId: string,
  items: { medicineId: string; unitPricePkr: number; minQty?: number }[],
) {
  return postJson(`/v1/pharmacy/pricing/lists/${listId}/items`, { items });
}

export function updateScheme(id: string, body: Record<string, unknown>) {
  return patchJson(`/v1/pharmacy/pricing/schemes/${id}`, body);
}
