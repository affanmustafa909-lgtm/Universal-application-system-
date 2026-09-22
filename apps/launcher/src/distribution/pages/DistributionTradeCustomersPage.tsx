import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createPharmacyTradeCustomer,
  fetchPharmacyAreas,
  fetchPharmacyCities,
  fetchPharmacyEmployeesPicker,
  fetchPharmacyRoutes,
  fetchPharmacyTradeCustomerLedger,
} from "../../pharmacy/api/pharmacy-erp";
import {
  listTradeCustomersPaged,
  setTradeCustomerStatus,
  updateTradeCustomer,
  type TradeCustomerRow,
} from "../../pharmacy/api/pharmacy-masters";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistBulkCustomerCreate } from "../components/DistBulkCreate";
import { DistPagination } from "../components/DistPagination";
import {
  emptyTradeCustomerForm,
  rowToTradeCustomerForm,
  TradeCustomerFormFields,
  tradeCustomerFormPayload,
  type TradeCustomerForm,
  type TradeCustomerFormTab,
} from "../components/TradeCustomerFormFields";
import {
  DistButton,
  DistDataTable,
  DistInput,
  DistPageShell,
  DistPanel,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

export function DistributionTradeCustomersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([["pharmacy", "trade-customers-paged"]]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState<TradeCustomerForm>(emptyTradeCustomerForm());
  const [formTab, setFormTab] = useState<TradeCustomerFormTab>("coaClient");
  const [editing, setEditing] = useState<TradeCustomerRow | null>(null);
  const [drawer, setDrawer] = useState<TradeCustomerRow | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      if (editing) return updateTradeCustomer(editing.id, body);
      return createPharmacyTradeCustomer(body);
    },
    onSuccess: () => {
      invalidate();
      setError(null);
      setEditing(null);
      setForm(emptyTradeCustomerForm());
      setFormTab("coaClient");
      setShowForm(false);
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

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 min-w-[14rem]"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </DistSelect>
        </label>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        empty="No customers"
        onRowClick={(r) => setDrawer(r)}
        rows={list.data?.items ?? []}
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

export function DistributionTradeCustomerDetailPage(): JSX.Element {
  const { id = "" } = useParams();
  const ledger = useQuery({
    queryKey: ["pharmacy", "trade-ledger", id],
    enabled: Boolean(id),
    queryFn: () => fetchPharmacyTradeCustomerLedger(id),
  });
  const c = (ledger.data as { customer?: TradeCustomerRow } | null)?.customer ?? (ledger.data as TradeCustomerRow | null);
  return (
    <DistPageShell
      title={(c as TradeCustomerRow | undefined)?.name ?? "Customer"}
      subtitle={(c as TradeCustomerRow | undefined)?.code}
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Customers", to: "/pops/distribution/trade-customers" },
        { label: (c as TradeCustomerRow | undefined)?.code ?? id },
      ]}
      loading={ledger.isLoading}
      error={
        ledger.error instanceof Error
          ? ledger.error.message
          : !ledger.isLoading && !c
            ? "Customer not found"
            : null
      }
    >
      {c ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <DistPanel title="Overview">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between border-b border-slate-100 py-1.5 dark:border-slate-800">
                <dt className="text-xs uppercase text-slate-500">Type</dt>
                <dd>{(c as TradeCustomerRow).customerType}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1.5 dark:border-slate-800">
                <dt className="text-xs uppercase text-slate-500">Phone</dt>
                <dd>{(c as TradeCustomerRow).phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1.5 dark:border-slate-800">
                <dt className="text-xs uppercase text-slate-500">Business</dt>
                <dd>{(c as TradeCustomerRow).businessName ?? "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1.5 dark:border-slate-800">
                <dt className="text-xs uppercase text-slate-500">Status</dt>
                <dd>
                  <DistStatusBadge status={(c as TradeCustomerRow).status} />
                </dd>
              </div>
            </dl>
          </DistPanel>
          <DistPanel title="Credit summary">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between border-b border-slate-100 py-1.5 dark:border-slate-800">
                <dt className="text-xs uppercase text-slate-500">Credit limit</dt>
                <dd>{formatPkr((c as TradeCustomerRow).creditLimitPkr ?? 0)}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1.5 dark:border-slate-800">
                <dt className="text-xs uppercase text-slate-500">Outstanding</dt>
                <dd>{formatPkr((c as TradeCustomerRow).outstandingPkr ?? 0)}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1.5 dark:border-slate-800">
                <dt className="text-xs uppercase text-slate-500">Available</dt>
                <dd>
                  {formatPkr(
                    Math.max(
                      0,
                      ((c as TradeCustomerRow).creditLimitPkr ?? 0) -
                        ((c as TradeCustomerRow).outstandingPkr ?? 0),
                    ),
                  )}
                </dd>
              </div>
            </dl>
          </DistPanel>
        </div>
      ) : null}
    </DistPageShell>
  );
}
