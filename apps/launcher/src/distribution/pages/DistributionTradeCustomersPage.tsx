import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createPharmacyScheme,
  createPharmacyTradeCustomer,
  fetchPharmacyAreas,
  fetchPharmacyCities,
  fetchPharmacyEmployeesPicker,
  fetchPharmacyRoutes,
  fetchPharmacySchemes,
  fetchPharmacyTradeCustomerLedger,
} from "../../pharmacy/api/pharmacy-erp";
import {
  listTradeCustomersPaged,
  setTradeCustomerStatus,
  updateScheme,
  updateTradeCustomer,
  type TradeCustomerRow,
} from "../../pharmacy/api/pharmacy-masters";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistBulkCustomerCreate } from "../components/DistBulkCreate";
import { DistPagination } from "../components/DistPagination";
import {
  emptyTradeCustomerForm,
  parseCustomerBonusPolicy,
  rowToTradeCustomerForm,
  TradeCustomerFormFields,
  tradeCustomerFormPayload,
  type TradeCustomerForm,
  type TradeCustomerFormTab,
} from "../components/TradeCustomerFormFields";

const CUSTOMER_BONUS_SCHEME_PREFIX = "Customer bonus:";

async function syncCustomerDefaultBonusScheme(customer: TradeCustomerRow): Promise<void> {
  const policy = parseCustomerBonusPolicy(customer.bonusPolicyJson);
  const buyQty = policy.buyQty;
  const freeQty = policy.freeQty;
  const name = `${CUSTOMER_BONUS_SCHEME_PREFIX} ${customer.code}`.trim();
  const schemes = (await fetchPharmacySchemes()) as Array<{
    id: string;
    name?: string | null;
    tradeCustomerId?: string | null;
    medicineId?: string | null;
    companyId?: string | null;
  }>;
  const existing = schemes.find(
    (s) =>
      s.tradeCustomerId === customer.id &&
      !s.medicineId &&
      !s.companyId &&
      String(s.name ?? "").startsWith(CUSTOMER_BONUS_SCHEME_PREFIX),
  );
  if (!policy.enabled || buyQty <= 0 || freeQty <= 0) {
    if (existing) {
      await updateScheme(existing.id, { status: "inactive" });
    }
    return;
  }
  const body = {
    name,
    schemeType: policy.schemeType,
    tradeCustomerId: customer.id,
    companyId: null,
    medicineId: null,
    buyQty,
    freeQty,
    priority: 0,
    status: "active",
  };
  if (existing) {
    await updateScheme(existing.id, body);
  } else {
    await createPharmacyScheme(body);
  }
}
import {
  DistButton,
  DistDataTable,
  DistFilterBar,
  DistFilterValues,
  DistPageShell,
  DistPanel,
  DistStatusBadge,
} from "../ui/DistUi";
import { filterDistRows } from "../lib/distListFilters";

export function DistributionTradeCustomersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([
    ["pharmacy", "trade-customers-paged"],
    ["pharmacy", "schemes"],
  ]);
  const [filters, setFilters] = useState<DistFilterValues>({});
  const q = filters.q ?? "";
  const status = filters.status ?? "";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState<TradeCustomerForm>(emptyTradeCustomerForm());
  const [formTab, setFormTab] = useState<TradeCustomerFormTab>("coaClient");
  const [editing, setEditing] = useState<TradeCustomerRow | null>(null);
  const [drawer, setDrawer] = useState<TradeCustomerRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const list = useQuery({
    queryKey: ["pharmacy", "trade-customers-paged", page, pageSize, q, status],
    queryFn: () =>
      listTradeCustomersPaged({ page, pageSize, q: q || undefined, status: status || undefined }),
  });
  const routes = useQuery({ queryKey: ["pharmacy", "routes"], queryFn: fetchPharmacyRoutes, staleTime: 60_000 });
  const employees = useQuery({
    queryKey: ["pharmacy", "employees-picker"],
    queryFn: fetchPharmacyEmployeesPicker,
    staleTime: 60_000,
  });
  const cities = useQuery({
    queryKey: ["pharmacy", "cities"],
    queryFn: fetchPharmacyCities,
    staleTime: 60_000,
  });
  const areas = useQuery({
    queryKey: ["pharmacy", "areas"],
    queryFn: fetchPharmacyAreas,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = tradeCustomerFormPayload(form, branch?.code);
      const saved = editing
        ? ((await updateTradeCustomer(editing.id, body)) as TradeCustomerRow)
        : ((await createPharmacyTradeCustomer(body)) as TradeCustomerRow);
      try {
        await syncCustomerDefaultBonusScheme(saved);
      } catch {
        /* bonus scheme sync is best-effort — customer row already saved */
      }
      return saved;
    },
    onSuccess: (row) => {
      void invalidate();
      setError(null);
      const saved = row as TradeCustomerRow;
      // Keep form open with server-returned values so every field is visible after save.
      setEditing(saved);
      setForm(rowToTradeCustomerForm(saved));
      setShowForm(true);
      const bonus = parseCustomerBonusPolicy(saved.bonusPolicyJson);
      setNotice(
        bonus.enabled && bonus.buyQty > 0 && bonus.freeQty > 0
          ? `Saved ${saved.code} — ${saved.name}. Customer bonus Buy ${bonus.buyQty} Get ${bonus.freeQty} synced.`
          : `Saved ${saved.code} — ${saved.name}. Saari fields form + Detail pe hain.`,
      );
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: (r: TradeCustomerRow) =>
      setTradeCustomerStatus(r.id, r.status === "active" ? "inactive" : "active"),
    onSuccess: () => {
      invalidate();
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const bulkSave = useMutation({
    mutationFn: async (
      rows: Array<{ code: string; name: string; phone: string; creditLimitPkr: string }>,
    ) => {
      const errors: string[] = [];
      for (const r of rows) {
        try {
          await createPharmacyTradeCustomer({
            code: r.code.trim(),
            name: r.name.trim(),
            phone: r.phone.trim() || undefined,
            creditLimitPkr: Number(r.creditLimitPkr) || 0,
            priceLevel: "wholesale",
            customerType: "Retailer",
            status: "active",
            branchCode: branch?.code,
          });
        } catch (e) {
          errors.push(`${r.code}: ${e instanceof Error ? e.message : "failed"}`);
        }
      }
      if (errors.length) throw new Error(errors.slice(0, 5).join("; "));
    },
    onSuccess: () => {
      setBulkOpen(false);
      setError(null);
      invalidate();
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const lookups = {
    routes: (routes.data ?? []).map((r) => ({ id: r.id, code: r.code, name: r.name })),
    employees: (employees.data ?? []).map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
    })),
    cities: (cities.data ?? []).map((c: { id: string; name: string }) => ({
      id: c.id,
      name: c.name,
    })),
    areas: (areas.data ?? []).map((a: { id: string; name: string }) => ({
      id: a.id,
      name: a.name,
    })),
  };

  return (
    <DistPageShell
      title="Trade customers"
      subtitle="Full customer master — Information, policies, licenses, location (legacy Company form parity)."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Customers" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/pops/distribution/import">
            <DistButton variant="secondary">Import / template</DistButton>
          </Link>
          <DistButton
            variant="secondary"
            onClick={() => {
              setBulkOpen(true);
              setShowForm(false);
            }}
          >
            + Add multiple
          </DistButton>
          <DistButton
            onClick={() => {
              setEditing(null);
              setForm(emptyTradeCustomerForm());
              setFormTab("coaClient");
              setShowForm(true);
            }}
          >
            + Add customer
          </DistButton>
        </div>
      }
      error={error}
    >
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {notice}{" "}
          {editing?.id ? (
            <Link
              className="font-semibold underline"
              to={`/pops/distribution/trade-customers/${editing.id}`}
            >
              Open full detail
            </Link>
          ) : null}
        </p>
      ) : null}
      {bulkOpen ? (
        <DistBulkCustomerCreate
          busy={bulkSave.isPending}
          onClose={() => setBulkOpen(false)}
          onSave={async (rows) => {
            await bulkSave.mutateAsync(rows);
          }}
        />
      ) : null}
      {showForm ? (
        <DistPanel title={editing ? "Edit customer" : "Customer Information"}>
          <TradeCustomerFormFields
            form={form}
            setForm={setForm}
            tab={formTab}
            setTab={setFormTab}
            lookups={lookups}
            busy={save.isPending}
            editingId={editing?.id}
            onSave={() => save.mutate()}
            onClear={() => {
              setForm(emptyTradeCustomerForm());
              setFormTab("coaClient");
            }}
            onClose={() => setShowForm(false)}
          />
        </DistPanel>
      ) : null}

      <DistFilterBar
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        showTime
        searchPlaceholder="Code, name, phone, NTN…"
        statusOptions={[
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
        qualityOptions={[
          { value: "complete", label: "Has phone + address" },
          { value: "credit", label: "Has credit limit" },
          { value: "thin", label: "Missing phone/address" },
        ]}
      />

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        empty="No customers"
        onRowClick={(r) => setDrawer(r)}
        rows={filterDistRows(list.data?.items ?? [], filters, {
          dateFields: ["createdAt", "regDate"],
          searchFields: [],
        }).filter((r) => {
          if (!filters.quality) return true;
          const hasContact = Boolean(r.phone || r.landLine) && Boolean(r.address || r.detailedAddress);
          if (filters.quality === "complete") return hasContact;
          if (filters.quality === "credit") return (r.creditLimitPkr ?? 0) > 0;
          if (filters.quality === "thin") return !hasContact;
          return true;
        })}
        columns={[
          { key: "accountType", header: "Acct Type", render: (r) => r.accountType ?? "—" },
          { key: "code", header: "Code", className: "font-mono text-xs whitespace-nowrap" },
          { key: "companyCode", header: "Cmp_Code", render: (r) => r.companyCode ?? "—", className: "font-mono text-xs" },
          { key: "name", header: "Name", className: "min-w-[10rem]" },
          { key: "uniqueName", header: "Unique Name", render: (r) => r.uniqueName ?? "—", className: "min-w-[8rem]" },
          {
            key: "address",
            header: "Address",
            render: (r) => r.address ?? r.detailedAddress ?? "—",
            className: "min-w-[10rem] max-w-[14rem] truncate",
          },
          {
            key: "postalAddress",
            header: "Postal Address",
            render: (r) => r.postalAddress ?? "—",
            className: "min-w-[10rem] max-w-[14rem] truncate",
          },
          { key: "province", header: "Province", render: (r) => r.province ?? "—" },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          { key: "landLine", header: "Phone", render: (r) => r.landLine ?? "—" },
          { key: "phone", header: "Mobile", render: (r) => r.phone ?? "—" },
          { key: "fax", header: "Fax", render: (r) => r.fax ?? "—" },
          {
            key: "creditLimitPkr",
            header: "Credit Limit",
            render: (r) => formatPkr(r.creditLimitPkr ?? 0),
            className: "whitespace-nowrap",
          },
          { key: "partyMode", header: "Party Mod", render: (r) => r.partyMode ?? "—" },
          { key: "stxNo", header: "Stx No", render: (r) => r.stxNo ?? "—" },
          { key: "ntnNumber", header: "NTN #", render: (r) => r.ntnNumber ?? "—" },
          { key: "nicNumber", header: "CNIC #", render: (r) => r.nicNumber ?? "—" },
          { key: "sector", header: "Sector", render: (r) => r.sector ?? "—" },
          {
            key: "areaId",
            header: "Area",
            render: (r) => {
              const hit = lookups.areas.find((a) => a.id === r.areaId);
              return hit?.name ?? r.cityName ?? "—";
            },
          },
          { key: "licenceNo", header: "Licence #", render: (r) => r.licenceNo ?? "—" },
          {
            key: "licenceExpiry",
            header: "Licence Exp",
            render: (r) => (r.licenceExpiry ? String(r.licenceExpiry).slice(0, 10) : "—"),
            className: "whitespace-nowrap",
          },
          { key: "partyType", header: "Party Type", render: (r) => r.partyType ?? r.customerType ?? "—" },
          { key: "customerType", header: "Billing type", render: (r) => r.customerType ?? "—" },
          { key: "speciality", header: "Speciality", render: (r) => r.speciality ?? "—" },
          { key: "storeType", header: "Store type", render: (r) => r.storeType ?? "—" },
          { key: "contactPerson", header: "Contact", render: (r) => r.contactPerson ?? "—" },
          { key: "whatsapp", header: "WhatsApp", render: (r) => r.whatsapp ?? "—" },
          { key: "cityName", header: "City", render: (r) => r.cityName ?? "—" },
          {
            key: "creditDays",
            header: "Credit days",
            render: (r) => (r.creditDays != null ? String(r.creditDays) : "—"),
          },
          {
            key: "activeTaxPayer",
            header: "Active Tax",
            render: (r) => (r.activeTaxPayer ? "Yes" : "—"),
          },
          {
            key: "incomeTaxExempt",
            header: "Tax Exempt",
            render: (r) => (r.incomeTaxExempt ? "Yes" : "—"),
          },
          {
            key: "advanceTaxSummary",
            header: "Adv Tax",
            render: (r) => (r.advanceTaxSummary ? "Yes" : "—"),
          },
          {
            key: "invoiceWarranty",
            header: "Inv Warranty",
            render: (r) => (r.invoiceWarranty ? "Yes" : "—"),
          },
          {
            key: "dead",
            header: "Dead",
            render: (r) => (r.status !== "active" ? "Yes" : "—"),
          },
          {
            key: "outstanding",
            header: "Outstanding",
            render: (r) => formatPkr(r.outstandingPkr ?? 0),
            className: "whitespace-nowrap",
          },
          { key: "status", header: "Status", render: (r) => <DistStatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <DistButton
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => {
                    setEditing(r);
                    setForm(rowToTradeCustomerForm(r));
                    setFormTab("coaClient");
                    setShowForm(true);
                  }}
                >
                  Edit
                </DistButton>
                <Link to={`/pops/distribution/trade-customers/${r.id}`}>
                  <DistButton variant="ghost" className="px-2 py-1 text-xs">
                    Detail
                  </DistButton>
                </Link>
                <DistButton variant="ghost" className="px-2 py-1 text-xs" onClick={() => toggle.mutate(r)}>
                  {r.status === "active" ? "Deactivate" : "Activate"}
                </DistButton>
              </div>
            ),
          },
        ]}
      />
      <DistPagination
        page={list.data?.page ?? page}
        pageSize={list.data?.pageSize ?? pageSize}
        total={list.data?.total ?? 0}
        totalPages={list.data?.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      <DistMasterDrawer
        open={Boolean(drawer)}
        title={drawer?.name ?? "Customer"}
        subtitle={drawer?.code}
        onClose={() => setDrawer(null)}
        footer={
          drawer ? (
            <Link to={`/pops/distribution/trade-customers/${drawer.id}`}>
              <DistButton>Open detail</DistButton>
            </Link>
          ) : null
        }
      >
        {drawer ? (
          <dl>
            <DistDrawerField label="Account Type" value={drawer.accountType} />
            <DistDrawerField label="Code" value={drawer.code} />
            <DistDrawerField label="Cmp_Code" value={drawer.companyCode} />
            <DistDrawerField label="Unique Name" value={drawer.uniqueName} />
            <DistDrawerField label="Address" value={drawer.address} />
            <DistDrawerField label="Postal Address" value={drawer.postalAddress} />
            <DistDrawerField label="Province" value={drawer.province} />
            <DistDrawerField label="Email" value={drawer.email} />
            <DistDrawerField label="Phone" value={drawer.landLine} />
            <DistDrawerField label="Mobile" value={drawer.phone} />
            <DistDrawerField label="Fax" value={drawer.fax} />
            <DistDrawerField label="Credit limit" value={formatPkr(drawer.creditLimitPkr ?? 0)} />
            <DistDrawerField label="Outstanding" value={formatPkr(drawer.outstandingPkr ?? 0)} />
            <DistDrawerField label="Party Mod" value={drawer.partyMode} />
            <DistDrawerField label="Party Type" value={drawer.partyType ?? drawer.customerType} />
            <DistDrawerField label="Stx No" value={drawer.stxNo} />
            <DistDrawerField label="NTN #" value={drawer.ntnNumber} />
            <DistDrawerField label="CNIC #" value={drawer.nicNumber} />
            <DistDrawerField label="Sector" value={drawer.sector} />
            <DistDrawerField label="Licence #" value={drawer.licenceNo} />
            <DistDrawerField
              label="Licence Exp"
              value={drawer.licenceExpiry ? String(drawer.licenceExpiry).slice(0, 10) : null}
            />
            <DistDrawerField label="Billing type" value={drawer.customerType} />
            <DistDrawerField label="Speciality" value={drawer.speciality} />
            <DistDrawerField label="Store type" value={drawer.storeType} />
            <DistDrawerField label="Contact person" value={drawer.contactPerson} />
            <DistDrawerField label="WhatsApp" value={drawer.whatsapp} />
            <DistDrawerField label="City" value={drawer.cityName} />
            <DistDrawerField label="Detailed address" value={drawer.detailedAddress} />
            <DistDrawerField label="Credit days" value={drawer.creditDays} />
            <DistDrawerField label="Credit category" value={drawer.creditCategory} />
            <DistDrawerField label="Mode of payment" value={drawer.modeOfPayment} />
            <DistDrawerField label="Price level" value={drawer.priceLevel} />
            <DistDrawerField label="Business name" value={drawer.businessName} />
            <DistDrawerField label="Active Tax Payer" value={drawer.activeTaxPayer ? "Yes" : "No"} />
            <DistDrawerField label="Income Tax Exempt" value={drawer.incomeTaxExempt ? "Yes" : "No"} />
            <DistDrawerField label="Advance Tax Summary" value={drawer.advanceTaxSummary ? "Yes" : "No"} />
            <DistDrawerField label="Invoice Warranty" value={drawer.invoiceWarranty ? "Yes" : "No"} />
            <DistDrawerField label="Dead" value={drawer.status !== "active" ? "Yes" : "No"} />
            <DistDrawerField label="Status" value={<DistStatusBadge status={drawer.status} />} />
          </dl>
        ) : null}
      </DistMasterDrawer>
    </DistPageShell>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  const empty =
    value == null ||
    value === "" ||
    (typeof value === "string" && !value.trim());
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-sm dark:border-slate-800">
      <dt className="shrink-0 text-xs uppercase text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-slate-900 dark:text-slate-100">
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

export function DistributionTradeCustomerDetailPage(): JSX.Element {
  const { id = "" } = useParams();
  const ledger = useQuery({
    queryKey: ["pharmacy", "trade-ledger", id],
    enabled: Boolean(id),
    queryFn: () => fetchPharmacyTradeCustomerLedger(id),
  });
  const schemesQ = useQuery({
    queryKey: ["pharmacy", "schemes"],
    queryFn: () => fetchPharmacySchemes(),
    staleTime: 60_000,
  });
  const c = (ledger.data as { customer?: TradeCustomerRow } | null)?.customer ?? null;
  const row = c as TradeCustomerRow | null;
  const bonus = parseCustomerBonusPolicy(row?.bonusPolicyJson);
  const customerSchemes = ((schemesQ.data ?? []) as Array<{
    id: string;
    name?: string | null;
    tradeCustomerId?: string | null;
    buyQty?: number | null;
    freeQty?: number | null;
    schemeType?: string | null;
    status?: string | null;
  }>).filter((s) => s.tradeCustomerId === id && s.status !== "inactive");

  return (
    <DistPageShell
      title={row?.name ?? "Customer"}
      subtitle={row?.code}
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Customers", to: "/pops/distribution/trade-customers" },
        { label: row?.code ?? id },
      ]}
      loading={ledger.isLoading}
      error={
        ledger.error instanceof Error
          ? ledger.error.message
          : !ledger.isLoading && !row
            ? "Customer not found"
            : null
      }
      actions={
        row ? (
          <div className="flex flex-wrap gap-2">
            <Link to={`/pops/distribution/customer-reports?tab=bonus&q=${encodeURIComponent(row.code ?? "")}`}>
              <DistButton variant="secondary">Bonus Report</DistButton>
            </Link>
            <Link to="/pops/distribution/bonus-attach">
              <DistButton variant="secondary">Bonus Attach</DistButton>
            </Link>
            <Link to="/pops/distribution/trade-customers">
              <DistButton variant="secondary">Back to list / edit</DistButton>
            </Link>
          </div>
        ) : null
      }
    >
      {row ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <DistPanel title="CoA / Client">
            <dl>
              <DetailRow label="Account type" value={row.accountType} />
              <DetailRow label="Code" value={row.code} />
              <DetailRow label="Old code" value={row.oldCode} />
              <DetailRow label="Cmp code" value={row.companyCode} />
              <DetailRow label="Name" value={row.name} />
              <DetailRow label="Unique name" value={row.uniqueName} />
              <DetailRow label="Business" value={row.businessName} />
              <DetailRow label="Address" value={row.address} />
              <DetailRow label="Postal address" value={row.postalAddress} />
              <DetailRow label="Province" value={row.province} />
              <DetailRow label="Sector" value={row.sector} />
              <DetailRow label="Email" value={row.email} />
              <DetailRow label="Phone" value={row.landLine} />
              <DetailRow label="Mobile" value={row.phone} />
              <DetailRow label="Fax" value={row.fax} />
              <DetailRow label="Party type" value={row.partyType} />
              <DetailRow label="Party mode" value={row.partyMode} />
              <DetailRow label="Stx No" value={row.stxNo} />
              <DetailRow label="NTN" value={row.ntnNumber} />
              <DetailRow label="CNIC" value={row.nicNumber} />
              <DetailRow label="Licence #" value={row.licenceNo} />
              <DetailRow
                label="Licence exp"
                value={row.licenceExpiry ? String(row.licenceExpiry).slice(0, 10) : null}
              />
              <DetailRow label="Active tax payer" value={row.activeTaxPayer ? "Yes" : "No"} />
              <DetailRow label="Tax exempt" value={row.incomeTaxExempt ? "Yes" : "No"} />
              <DetailRow label="Adv tax summary" value={row.advanceTaxSummary ? "Yes" : "No"} />
              <DetailRow label="Invoice warranty" value={row.invoiceWarranty ? "Yes" : "No"} />
              <DetailRow label="Status" value={<DistStatusBadge status={row.status} />} />
            </dl>
          </DistPanel>

          <DistPanel title="Information">
            <dl>
              <DetailRow label="Billing type" value={row.customerType} />
              <DetailRow label="Speciality" value={row.speciality} />
              <DetailRow label="Store type" value={row.storeType} />
              <DetailRow label="City" value={row.cityName} />
              <DetailRow label="Contact person" value={row.contactPerson} />
              <DetailRow label="WhatsApp" value={row.whatsapp} />
              <DetailRow label="Passport" value={row.passportNo} />
              <DetailRow label="Class" value={row.customerClass} />
              <DetailRow label="Detailed address" value={row.detailedAddress} />
              <DetailRow
                label="Reg date"
                value={row.regDate ? String(row.regDate).slice(0, 10) : null}
              />
              <DetailRow label="Mode of payment" value={row.modeOfPayment} />
              <DetailRow label="Timing" value={row.timing} />
              <DetailRow label="Visit frequency" value={row.visitFrequency} />
              <DetailRow label="Visiting days" value={row.visitingDaysJson} />
              <DetailRow label="Terms of payment" value={row.termsOfPayment} />
              <DetailRow label="Price level" value={row.priceLevel} />
              <DetailRow label="Discount %" value={row.discountPct} />
              <DetailRow label="Adv tax type" value={row.advTaxType} />
              <DetailRow label="FOC customer" value={row.isFocCustomer ? "Yes" : "No"} />
              <DetailRow label="Can deduct tax" value={row.canDeductTax ? "Yes" : "No"} />
              <DetailRow label="Tax %" value={row.taxPct} />
              <DetailRow label="Tax info" value={row.taxInfo} />
              <DetailRow label="License 9" value={row.license9No} />
              <DetailRow label="License 10" value={row.license10No} />
              <DetailRow label="License 11" value={row.license11No} />
            </dl>
          </DistPanel>

          <DistPanel title="Credit">
            <dl>
              <DetailRow label="Credit limit" value={formatPkr(row.creditLimitPkr ?? 0)} />
              <DetailRow label="Outstanding" value={formatPkr(row.outstandingPkr ?? 0)} />
              <DetailRow
                label="Available"
                value={formatPkr(
                  Math.max(0, (row.creditLimitPkr ?? 0) - (row.outstandingPkr ?? 0)),
                )}
              />
              <DetailRow label="Credit days" value={row.creditDays} />
              <DetailRow label="Credit category" value={row.creditCategory} />
              <DetailRow
                label="Monthly sales target"
                value={formatPkr(row.monthlySalesTargetPkr ?? 0)}
              />
            </dl>
          </DistPanel>

          <DistPanel title="Bonus">
            <dl>
              <DetailRow label="Bonus enabled" value={bonus.enabled ? "Yes" : "No"} />
              <DetailRow label="FOC customer" value={row.isFocCustomer ? "Yes" : "No"} />
              <DetailRow label="Scheme type" value={bonus.schemeType} />
              <DetailRow label="Buy qty" value={bonus.buyQty} />
              <DetailRow label="Free qty" value={bonus.freeQty} />
              <DetailRow label="Bonus %" value={bonus.bonusPct} />
              <DetailRow label="Notes" value={bonus.notes} />
            </dl>
            {customerSchemes.length > 0 ? (
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Attached schemes
                </p>
                {customerSchemes.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between gap-2 text-sm text-slate-800 dark:text-slate-100"
                  >
                    <span className="truncate">{s.name ?? s.id}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      Buy {s.buyQty ?? 0} / Free {s.freeQty ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                No active schemes on this customer yet — set Bonus Policy on edit, or use Bonus Attach.
              </p>
            )}
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Link
                className="text-xs font-semibold text-[color:var(--brand)] underline"
                to={`/pops/distribution/customer-reports?tab=bonus&q=${encodeURIComponent(row.code ?? "")}`}
              >
                Open bonus utilization report →
              </Link>
            </div>
          </DistPanel>

          <DistPanel title="Policies & location">
            <dl>
              <DetailRow label="Discount policy" value={row.discountPolicyJson} />
              <DetailRow label="Company credit limits" value={row.companyCreditLimitsJson} />
              <DetailRow label="Company IDs" value={row.companyIdsJson} />
              <DetailRow label="Block sales" value={row.blockSalesJson} />
              <DetailRow label="Others" value={row.othersJson} />
              <DetailRow label="Lat" value={row.locationLat} />
              <DetailRow label="Lng" value={row.locationLng} />
              <DetailRow label="Location notes" value={row.locationNotes} />
              <DetailRow label="Image URL" value={row.imageUrl} />
            </dl>
          </DistPanel>
        </div>
      ) : null}
    </DistPageShell>
  );
}
