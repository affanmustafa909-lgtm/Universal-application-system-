import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  brandsApi,
  categoriesApi,
  dosageFormsApi,
  genericsApi,
  listCompaniesPaged,
  taxProfilesApi,
  unitsApi,
  type MasterRef,
} from "../../pharmacy/api/pharmacy-masters";
import { useInvalidatePharmacy } from "../../pharmacy/hooks/usePharmacy";
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

type TabId = "generics" | "brands" | "categories" | "dosage-forms" | "units" | "tax-profiles";

const TABS: { id: TabId; label: string }[] = [
  { id: "generics", label: "Generics" },
  { id: "brands", label: "Brands" },
  { id: "categories", label: "Categories" },
  { id: "dosage-forms", label: "Dosage Forms" },
  { id: "units", label: "Units" },
  { id: "tax-profiles", label: "Tax Profiles" },
];

const APIS = {
  generics: genericsApi,
  brands: brandsApi,
  categories: categoriesApi,
  "dosage-forms": dosageFormsApi,
  units: unitsApi,
  "tax-profiles": taxProfilesApi,
} as const;

type FormState = {
  code: string;
  name: string;
  notes: string;
  description: string;
  companyId: string;
  parentId: string;
  baseUnit: string;
  ratePct: string;
  taxType: string;
};

const emptyForm = (): FormState => ({
  code: "",
  name: "",
  notes: "",
  description: "",
  companyId: "",
  parentId: "",
  baseUnit: "",
  ratePct: "0",
  taxType: "percentage",
});

function rowToForm(row: MasterRef): FormState {
  return {
    code: row.code ?? "",
    name: row.name ?? "",
    notes: row.notes ?? "",
    description: row.description ?? "",
    companyId: row.companyId ?? "",
    parentId: row.parentId ?? "",
    baseUnit: row.baseUnit ?? "",
    ratePct: String(row.ratePct ?? 0),
    taxType: row.taxType ?? "percentage",
  };
}

export function DistributionProductMastersPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "generics") as TabId;
  const invalidate = useInvalidatePharmacy([["pharmacy", "ref-masters"], ["pharmacy", "masters-overview"]]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<MasterRef | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setEditing(null);
    setForm(emptyForm());
    setError(null);
  }, [tab]);

  const api = APIS[tab];
  const list = useQuery({
    queryKey: ["pharmacy", "ref-masters", tab, page, pageSize, q, status],
    queryFn: () => api.list({ page, pageSize, q: q || undefined, status: status || undefined }),
  });

  const companies = useQuery({
    queryKey: ["pharmacy", "companies-picker"],
    queryFn: () => listCompaniesPaged({ page: 1, pageSize: 100, status: "active" }),
    enabled: tab === "brands",
    staleTime: 60_000,
  });

  const parents = useQuery({
    queryKey: ["pharmacy", "category-parents"],
    queryFn: () => categoriesApi.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: tab === "categories",
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (mode: "save" | "saveAndNew") => {
      const body: Record<string, unknown> = {
        code: form.code.trim(),
        name: form.name.trim(),
        notes: form.notes.trim() || undefined,
      };
      if (tab === "generics") body.description = form.description.trim() || undefined;
      if (tab === "brands") body.companyId = form.companyId || null;
      if (tab === "categories") body.parentId = form.parentId || null;
      if (tab === "units") body.baseUnit = form.baseUnit.trim() || undefined;
      if (tab === "tax-profiles") {
        body.ratePct = Number(form.ratePct) || 0;
        body.taxType = form.taxType;
      }
      const row = editing ? await api.update(editing.id, body) : await api.create(body);
      return { row, mode };
    },
    onSuccess: ({ mode }) => {
      invalidate();
      setError(null);
      if (mode === "saveAndNew" || !editing) {
        setEditing(null);
        setForm(emptyForm());
      }
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: (row: MasterRef) =>
      api.setStatus(row.id, row.status === "active" ? "inactive" : "active"),
    onSuccess: () => {
      invalidate();
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const companyName = useMemo(() => {
    const map = new Map((companies.data?.items ?? []).map((c) => [c.id, c.name]));
    return (id?: string | null) => (id ? map.get(id) ?? id : "—");
  }, [companies.data]);

  const setTab = (id: TabId) => {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  };

  return (
    <DistPageShell
      title="Product masters"
      subtitle="Generics, brands, categories, dosage forms, units, and tax profiles."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Product" },
      ]}
      error={error}
    >
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-cyan-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DistPanel title={editing ? `Edit ${TABS.find((t) => t.id === tab)?.label}` : `Add ${TABS.find((t) => t.id === tab)?.label}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate("save");
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-500">
              Code
              <DistInput
                className="mt-1"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </label>
            <label className="text-xs text-slate-500">
              Name
              <DistInput
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            {tab === "generics" ? (
              <label className="text-xs text-slate-500 sm:col-span-2">
                Description
                <DistInput
                  className="mt-1"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
            ) : null}
            {tab === "brands" ? (
              <label className="text-xs text-slate-500">
                Company
                <DistSelect
                  className="mt-1"
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                >
                  <option value="">— None —</option>
                  {(companies.data?.items ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </DistSelect>
              </label>
            ) : null}
            {tab === "categories" ? (
              <label className="text-xs text-slate-500">
                Parent
                <DistSelect
                  className="mt-1"
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                >
                  <option value="">— None —</option>
                  {(parents.data?.items ?? [])
                    .filter((p) => p.id !== editing?.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                </DistSelect>
              </label>
            ) : null}
            {tab === "units" ? (
              <label className="text-xs text-slate-500">
                Base unit
                <DistInput
                  className="mt-1"
                  value={form.baseUnit}
                  onChange={(e) => setForm({ ...form, baseUnit: e.target.value })}
                />
              </label>
            ) : null}
            {tab === "tax-profiles" ? (
              <>
                <label className="text-xs text-slate-500">
                  Rate %
                  <DistInput
                    className="mt-1"
                    type="number"
                    value={form.ratePct}
                    onChange={(e) => setForm({ ...form, ratePct: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Tax type
                  <DistSelect
                    className="mt-1"
                    value={form.taxType}
                    onChange={(e) => setForm({ ...form, taxType: e.target.value })}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed</option>
                  </DistSelect>
                </label>
              </>
            ) : null}
            <label className="text-xs text-slate-500 sm:col-span-2">
              Notes
              <DistInput
                className="mt-1"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <DistButton type="submit" disabled={save.isPending}>
              Save
            </DistButton>
            {!editing ? (
              <DistButton
                type="button"
                variant="secondary"
                disabled={save.isPending}
                onClick={() => save.mutate("saveAndNew")}
              >
                Save & New
              </DistButton>
            ) : (
              <DistButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm());
                }}
              >
                Cancel edit
              </DistButton>
            )}
          </div>
        </form>
      </DistPanel>

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
            placeholder="Code or name…"
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
        empty="No master records"
        rows={list.data?.items ?? []}
        columns={[
          { key: "code", header: "Code", className: "font-mono text-xs" },
          { key: "name", header: "Name" },
          ...(tab === "brands"
            ? [
                {
                  key: "companyId",
                  header: "Company",
                  render: (r: MasterRef) => companyName(r.companyId),
                },
              ]
            : []),
          ...(tab === "tax-profiles"
            ? [
                {
                  key: "ratePct",
                  header: "Rate %",
                  render: (r: MasterRef) => String(r.ratePct ?? 0),
                },
              ]
            : []),
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} />,
          },
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
                  }}
                >
                  Edit
                </DistButton>
                <DistButton
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => toggleStatus.mutate(r)}
                >
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
