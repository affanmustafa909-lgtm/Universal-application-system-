import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createPharmacyCompany,
  createPharmacyWarehouse,
} from "../../pharmacy/api/pharmacy-erp";
import {
  listCompaniesPaged,
  listWarehousesPaged,
  setCompanyStatus,
  setWarehouseStatus,
  updateCompany,
  updateWarehouse,
  type CompanyRow,
  type WarehouseRow,
} from "../../pharmacy/api/pharmacy-masters";
import { useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
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

type CompanyForm = {
  code: string;
  name: string;
  companyTitle: string;
  manufacturerName: string;
  phone: string;
  contactPerson: string;
  address: string;
  address2: string;
  bankName: string;
  bankBranch: string;
  transport: string;
  salesmanCommissionPct: string;
  showForAdvTax: string;
  productPolicyJson: string;
  discountPolicyJson: string;
  companyShiftingJson: string;
  status: string;
};

type CompanyTab = "company" | "product" | "discount" | "shifting";

const emptyCompanyForm = (): CompanyForm => ({
  code: "",
  name: "",
  companyTitle: "",
  manufacturerName: "",
  phone: "",
  contactPerson: "",
  address: "",
  address2: "",
  bankName: "",
  bankBranch: "",
  transport: "",
  salesmanCommissionPct: "0",
  showForAdvTax: "Yes",
  productPolicyJson: "",
  discountPolicyJson: "",
  companyShiftingJson: "",
  status: "active",
});

function rowToCompanyForm(r: CompanyRow): CompanyForm {
  return {
    code: r.code ?? "",
    name: r.name ?? "",
    companyTitle: r.companyTitle ?? "",
    manufacturerName: r.manufacturerName ?? "",
    phone: r.phone ?? "",
    contactPerson: r.contactPerson ?? "",
    address: r.address ?? "",
    address2: r.address2 ?? "",
    bankName: r.bankName ?? "",
    bankBranch: r.bankBranch ?? "",
    transport: r.transport ?? "",
    salesmanCommissionPct: String(r.salesmanCommissionPct ?? 0),
    showForAdvTax: r.showForAdvTax ?? "Yes",
    productPolicyJson: r.productPolicyJson ?? "",
    discountPolicyJson: r.discountPolicyJson ?? "",
    companyShiftingJson: r.companyShiftingJson ?? "",
    status: r.status ?? "active",
  };
}

function companyPayload(form: CompanyForm) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    companyTitle: form.companyTitle.trim() || undefined,
    manufacturerName: form.manufacturerName.trim() || form.companyTitle.trim() || undefined,
    phone: form.phone.trim() || undefined,
    contactPerson: form.contactPerson.trim() || undefined,
    address: form.address.trim() || undefined,
    address2: form.address2.trim() || undefined,
    bankName: form.bankName.trim() || undefined,
    bankBranch: form.bankBranch.trim() || undefined,
    transport: form.transport.trim() || undefined,
    salesmanCommissionPct: Number(form.salesmanCommissionPct) || 0,
    showForAdvTax: form.showForAdvTax.trim() || undefined,
    productPolicyJson: form.productPolicyJson.trim() || undefined,
    discountPolicyJson: form.discountPolicyJson.trim() || undefined,
    companyShiftingJson: form.companyShiftingJson.trim() || undefined,
    status: form.status,
  };
}

export function DistributionCompaniesPage(): JSX.Element {
  const invalidate = useInvalidatePharmacy([["pharmacy", "companies-paged"], ["pharmacy", "companies-picker"]]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyCompanyForm());
  const [tab, setTab] = useState<CompanyTab>("company");

  const list = useQuery({
    queryKey: ["pharmacy", "companies-paged", page, pageSize, q, status],
    queryFn: () => listCompaniesPaged({ page, pageSize, q: q || undefined, status: status || undefined }),
  });

  const lastCode = useMemo(() => {
    const codes = (list.data?.items ?? [])
      .map((r) => Number(String(r.code).replace(/\D/g, "")))
      .filter((n) => Number.isFinite(n) && n > 0);
    return codes.length ? Math.max(...codes) : 0;
  }, [list.data?.items]);

  const save = useMutation({
    mutationFn: async () => {
      const body = companyPayload(form);
      if (editing) return updateCompany(editing.id, body);
      return createPharmacyCompany(body);
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setForm(emptyCompanyForm());
      setTab("company");
      setError(null);
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: (r: CompanyRow) => setCompanyStatus(r.id, r.status === "active" ? "inactive" : "active"),
    onSuccess: () => {
      invalidate();
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = (patch: Partial<CompanyForm>) => setForm({ ...form, ...patch });

  const tabs: Array<{ id: CompanyTab; label: string }> = [
    { id: "company", label: "Company" },
    { id: "product", label: "Product" },
    { id: "discount", label: "Discount-Policy" },
    { id: "shifting", label: "Company Shifting" },
  ];

  return (
    <DistPageShell
      title="Companies"
      subtitle="Company Target master — title, bank, transport, commission, adv. tax (legacy parity)."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Companies" },
      ]}
      error={error}
    >
      <DistPanel title={editing ? "Edit company" : "Company Target"}>
        <div className="mb-3 flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                tab === t.id
                  ? "bg-sky-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {tab === "company" ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-slate-500">
                Code
                <DistInput
                  className="mt-1"
                  value={form.code}
                  onChange={(e) => set({ code: e.target.value })}
                  required
                />
                <span className="mt-0.5 block text-[10px] text-slate-400">Last Code: {lastCode || "—"}</span>
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2">
                Company Title
                <DistInput
                  className="mt-1"
                  value={form.companyTitle}
                  onChange={(e) => set({ companyTitle: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
                Company Name
                <DistInput className="mt-1" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
                Company Address 1
                <DistInput className="mt-1" value={form.address} onChange={(e) => set({ address: e.target.value })} />
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
                Company Address 2
                <DistInput className="mt-1" value={form.address2} onChange={(e) => set({ address2: e.target.value })} />
              </label>
              <label className="text-xs text-slate-500">
                Bank
                <DistInput className="mt-1" value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} />
              </label>
              <label className="text-xs text-slate-500">
                Branch
                <DistInput
                  className="mt-1"
                  value={form.bankBranch}
                  onChange={(e) => set({ bankBranch: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500">
                Transport
                <DistInput
                  className="mt-1"
                  value={form.transport}
                  onChange={(e) => set({ transport: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500">
                Salesman Commission %Age
                <DistInput
                  className="mt-1"
                  type="number"
                  value={form.salesmanCommissionPct}
                  onChange={(e) => set({ salesmanCommissionPct: e.target.value })}
                />
              </label>
              <label className="text-xs text-slate-500">
                Show Company For Adv. Tax
                <DistSelect
                  className="mt-1"
                  value={form.showForAdvTax}
                  onChange={(e) => set({ showForAdvTax: e.target.value })}
                >
                  <option>Yes</option>
                  <option>No</option>
                </DistSelect>
              </label>
              <label className="text-xs text-slate-500">
                Phone
                <DistInput className="mt-1" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </label>
              <label className="text-xs text-slate-500">
                Contact person
                <DistInput
                  className="mt-1"
                  value={form.contactPerson}
                  onChange={(e) => set({ contactPerson: e.target.value })}
                />
              </label>
            </div>
          ) : null}

          {tab === "product" ? (
            <label className="block text-xs text-slate-500">
              Product policy / linked SKU notes
              <textarea
                className="mt-1 min-h-[10rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={form.productPolicyJson}
                onChange={(e) => set({ productPolicyJson: e.target.value })}
              />
            </label>
          ) : null}

          {tab === "discount" ? (
            <label className="block text-xs text-slate-500">
              Discount policy
              <textarea
                className="mt-1 min-h-[10rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={form.discountPolicyJson}
                onChange={(e) => set({ discountPolicyJson: e.target.value })}
              />
            </label>
          ) : null}

          {tab === "shifting" ? (
            <label className="block text-xs text-slate-500">
              Company shifting notes
              <textarea
                className="mt-1 min-h-[10rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={form.companyShiftingJson}
                onChange={(e) => set({ companyShiftingJson: e.target.value })}
              />
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <DistButton type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </DistButton>
            {editing ? (
              <DistButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyCompanyForm());
                  setTab("company");
                }}
              >
                Cancel
              </DistButton>
            ) : (
              <DistButton type="button" variant="secondary" onClick={() => setForm(emptyCompanyForm())}>
                Clear
              </DistButton>
            )}
          </div>
        </form>
      </DistPanel>

      <div className="flex flex-wrap gap-2">
        <DistInput
          className="min-w-[14rem]"
          placeholder="Search…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <DistSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </DistSelect>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        empty="No companies"
        rows={list.data?.items ?? []}
        columns={[
          { key: "code", header: "Code", className: "font-mono text-xs" },
          { key: "companyTitle", header: "Title", render: (r) => r.companyTitle ?? "—" },
          { key: "name", header: "Company Name" },
          {
            key: "address",
            header: "Address 1",
            render: (r) => r.address ?? "—",
            className: "max-w-[12rem] truncate",
          },
          {
            key: "address2",
            header: "Address 2",
            render: (r) => r.address2 ?? "—",
            className: "max-w-[12rem] truncate",
          },
          { key: "bankName", header: "Bank", render: (r) => r.bankName ?? "—" },
          { key: "bankBranch", header: "Branch", render: (r) => r.bankBranch ?? "—" },
          { key: "transport", header: "Transport", render: (r) => r.transport ?? "—" },
          {
            key: "salesmanCommissionPct",
            header: "Comm %",
            render: (r) => String(r.salesmanCommissionPct ?? 0),
          },
          { key: "showForAdvTax", header: "Adv Tax", render: (r) => r.showForAdvTax ?? "—" },
          { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
          { key: "status", header: "Status", render: (r) => <DistStatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-1">
                <DistButton
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => {
                    setEditing(r);
                    setForm(rowToCompanyForm(r));
                    setTab("company");
                  }}
                >
                  Edit
                </DistButton>
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
    </DistPageShell>
  );
}

export function DistributionWarehousesPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([["pharmacy", "warehouses-paged"]]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "", isDefault: false, address: "", managerName: "" });

  const list = useQuery({
    queryKey: ["pharmacy", "warehouses-paged", branch?.code, page, pageSize, q, status],
    enabled: Boolean(branch?.code),
    queryFn: () =>
      listWarehousesPaged({
        branchCode: branch!.code,
        page,
        pageSize,
        q: q || undefined,
        status: status || undefined,
      }),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateWarehouse(editing.id, form);
      return createPharmacyWarehouse({ branchCode: branch!.code, ...form });
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setForm({ code: "", name: "", isDefault: false, address: "", managerName: "" });
      setError(null);
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: (r: WarehouseRow) => setWarehouseStatus(r.id, r.status === "active" ? "inactive" : "active"),
    onSuccess: () => {
      invalidate();
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <DistPageShell
      title="Warehouses"
      subtitle="Branch warehouses for batch-scoped stock."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Warehouses" },
      ]}
      error={error ?? (!branch ? "Select a branch." : null)}
    >
      <DistPanel title={editing ? "Edit warehouse" : "Add warehouse"}>
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DistInput placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <DistInput placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <DistInput
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            Default
          </label>
          <div className="flex gap-2">
            <DistButton type="submit" disabled={!branch || save.isPending}>
              Save
            </DistButton>
            {editing ? (
              <DistButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm({ code: "", name: "", isDefault: false, address: "", managerName: "" });
                }}
              >
                Cancel
              </DistButton>
            ) : null}
          </div>
        </form>
      </DistPanel>

      <div className="flex flex-wrap gap-2">
        <DistInput
          className="min-w-[14rem]"
          placeholder="Search…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <DistSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </DistSelect>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        empty="No warehouses"
        rows={list.data?.items ?? []}
        columns={[
          { key: "code", header: "Code", className: "font-mono text-xs" },
          { key: "name", header: "Name" },
          { key: "isDefault", header: "Default", render: (r) => (r.isDefault ? "Yes" : "No") },
          { key: "status", header: "Status", render: (r) => <DistStatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-1">
                <DistButton
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => {
                    setEditing(r);
                    setForm({
                      code: r.code,
                      name: r.name,
                      isDefault: Boolean(r.isDefault),
                      address: r.address ?? "",
                      managerName: r.managerName ?? "",
                    });
                  }}
                >
                  Edit
                </DistButton>
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
    </DistPageShell>
  );
}
