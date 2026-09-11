import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

export function DistributionCompaniesPage(): JSX.Element {
  const invalidate = useInvalidatePharmacy([["pharmacy", "companies-paged"], ["pharmacy", "companies-picker"]]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "", manufacturerName: "", phone: "", contactPerson: "" });

  const list = useQuery({
    queryKey: ["pharmacy", "companies-paged", page, pageSize, q, status],
    queryFn: () => listCompaniesPaged({ page, pageSize, q: q || undefined, status: status || undefined }),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateCompany(editing.id, form);
      return createPharmacyCompany(form);
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setForm({ code: "", name: "", manufacturerName: "", phone: "", contactPerson: "" });
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

  return (
    <DistPageShell
      title="Companies"
      subtitle="Manufacturer / marketing company master."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Companies" },
      ]}
      error={error}
    >
      <DistPanel title={editing ? "Edit company" : "Add company"}>
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DistInput placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <DistInput placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <DistInput
            placeholder="Manufacturer"
            value={form.manufacturerName}
            onChange={(e) => setForm({ ...form, manufacturerName: e.target.value })}
          />
          <DistInput placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex gap-2">
            <DistButton type="submit" disabled={save.isPending}>
              Save
            </DistButton>
            {editing ? (
              <DistButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm({ code: "", name: "", manufacturerName: "", phone: "", contactPerson: "" });
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
        empty="No companies"
        rows={list.data?.items ?? []}
        columns={[
          { key: "code", header: "Code", className: "font-mono text-xs" },
          { key: "name", header: "Name" },
          { key: "manufacturerName", header: "Manufacturer", render: (r) => r.manufacturerName ?? "—" },
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
                    setForm({
                      code: r.code,
                      name: r.name,
                      manufacturerName: r.manufacturerName ?? "",
                      phone: r.phone ?? "",
                      contactPerson: r.contactPerson ?? "",
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
