import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createPharmacyTradeCustomer,
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
  DistButton,
  DistDataTable,
  DistInput,
  DistPageShell,
  DistPanel,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

type FormState = {
  code: string;
  name: string;
  businessName: string;
  customerType: string;
  phone: string;
  creditLimitPkr: string;
  routeId: string;
  salesmanEmployeeId: string;
  priceLevel: string;
  status: string;
};

const emptyForm = (): FormState => ({
  code: "",
  name: "",
  businessName: "",
  customerType: "Retailer",
  phone: "",
  creditLimitPkr: "0",
  routeId: "",
  salesmanEmployeeId: "",
  priceLevel: "wholesale",
  status: "active",
});

function rowToForm(r: TradeCustomerRow): FormState {
  return {
    code: r.code ?? "",
    name: r.name ?? "",
    businessName: r.businessName ?? "",
    customerType: r.customerType ?? "Retailer",
    phone: r.phone ?? "",
    creditLimitPkr: String(r.creditLimitPkr ?? 0),
    routeId: r.routeId ?? "",
    salesmanEmployeeId: r.salesmanEmployeeId ?? "",
    priceLevel: r.priceLevel ?? "wholesale",
    status: r.status ?? "active",
  };
}

export function DistributionTradeCustomersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([["pharmacy", "trade-customers-paged"]]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState<FormState>(emptyForm());
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

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        businessName: form.businessName.trim() || undefined,
        customerType: form.customerType,
        phone: form.phone.trim() || undefined,
        creditLimitPkr: Number(form.creditLimitPkr) || 0,
        routeId: form.routeId || undefined,
        salesmanEmployeeId: form.salesmanEmployeeId || undefined,
        priceLevel: form.priceLevel,
        status: form.status,
        branchCode: branch?.code,
      };
      if (editing) return updateTradeCustomer(editing.id, body);
      return createPharmacyTradeCustomer(body);
    },
    onSuccess: () => {
      invalidate();
      setError(null);
      setEditing(null);
      setForm(emptyForm());
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

  return (
    <DistPageShell
      title="Trade customers"
      subtitle="Paged customer master with credit summary."
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
              setForm(emptyForm());
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
        <DistPanel
          title={editing ? "Edit customer" : "Add customer"}
          action={
            <DistButton variant="ghost" onClick={() => setShowForm(false)}>
              Close
            </DistButton>
          }
        >
          <form
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <label className="text-xs text-slate-500">
              Code
              <DistInput className="mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </label>
            <label className="text-xs text-slate-500">
              Name
              <DistInput className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="text-xs text-slate-500">
              Business name
              <DistInput
                className="mt-1"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-500">
              Type
              <DistSelect
                className="mt-1"
                value={form.customerType}
                onChange={(e) => setForm({ ...form, customerType: e.target.value })}
              >
                <option>Retailer</option>
                <option>Wholesaler</option>
                <option>Hospital</option>
                <option>Pharmacy</option>
              </DistSelect>
            </label>
            <label className="text-xs text-slate-500">
              Phone
              <DistInput className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="text-xs text-slate-500">
              Credit limit
              <DistInput
                className="mt-1"
                type="number"
                value={form.creditLimitPkr}
                onChange={(e) => setForm({ ...form, creditLimitPkr: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-500">
              Route
              <DistSelect
                className="mt-1"
                value={form.routeId}
                onChange={(e) => setForm({ ...form, routeId: e.target.value })}
              >
                <option value="">—</option>
                {(routes.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </DistSelect>
            </label>
            <label className="text-xs text-slate-500">
              Salesman
              <DistSelect
                className="mt-1"
                value={form.salesmanEmployeeId}
                onChange={(e) => setForm({ ...form, salesmanEmployeeId: e.target.value })}
              >
                <option value="">—</option>
                {(employees.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeCode} — {e.name}
                  </option>
                ))}
              </DistSelect>
            </label>
            <label className="text-xs text-slate-500">
              Price level
              <DistSelect
                className="mt-1"
                value={form.priceLevel}
                onChange={(e) => setForm({ ...form, priceLevel: e.target.value })}
              >
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="dealer">Dealer</option>
              </DistSelect>
            </label>
            <div className="flex items-end gap-2 sm:col-span-2">
              <DistButton type="submit" disabled={save.isPending}>
                Save
              </DistButton>
            </div>
          </form>
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
          { key: "code", header: "Code", className: "font-mono text-xs" },
          { key: "name", header: "Name" },
          { key: "customerType", header: "Type", render: (r) => r.customerType ?? "—" },
          { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
          {
            key: "credit",
            header: "Credit / Out",
            render: (r) => `${formatPkr(r.creditLimitPkr ?? 0)} / ${formatPkr(r.outstandingPkr ?? 0)}`,
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
                    setForm(rowToForm(r));
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
            <DistDrawerField label="Type" value={drawer.customerType} />
            <DistDrawerField label="Phone" value={drawer.phone} />
            <DistDrawerField label="Business" value={drawer.businessName} />
            <DistDrawerField label="Credit limit" value={formatPkr(drawer.creditLimitPkr ?? 0)} />
            <DistDrawerField label="Outstanding" value={formatPkr(drawer.outstandingPkr ?? 0)} />
            <DistDrawerField
              label="Available"
              value={formatPkr(Math.max(0, (drawer.creditLimitPkr ?? 0) - (drawer.outstandingPkr ?? 0)))}
            />
            <DistDrawerField label="Price level" value={drawer.priceLevel} />
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
