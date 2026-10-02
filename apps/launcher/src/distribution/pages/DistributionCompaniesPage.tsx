import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createPharmacyCompany,
  createPharmacyWarehouse,
} from "../../pharmacy/api/pharmacy-erp";
import {
  listCompaniesPaged,
  listMedicinesPaged,
  listWarehousesPaged,
  setCompanyStatus,
  setWarehouseStatus,
  updateCompany,
  updateMedicine,
  updateWarehouse,
  type CompanyRow,
  type MedicineMasterRow,
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

type DiscountPolicy = {
  defaultTradeDiscountPct: number;
  maxDiscountPct: number;
  cashDiscountPct: number;
  slabNotes: string;
  notes: string;
};

const emptyDiscountPolicy = (): DiscountPolicy => ({
  defaultTradeDiscountPct: 0,
  maxDiscountPct: 0,
  cashDiscountPct: 0,
  slabNotes: "",
  notes: "",
});

function parseDiscountPolicy(raw: string): DiscountPolicy {
  const blank = emptyDiscountPolicy();
  const text = raw.trim();
  if (!text) return blank;
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    if (!j || typeof j !== "object" || Array.isArray(j)) {
      return { ...blank, notes: text };
    }
    return {
      defaultTradeDiscountPct: Number(j.defaultTradeDiscountPct) || 0,
      maxDiscountPct: Number(j.maxDiscountPct) || 0,
      cashDiscountPct: Number(j.cashDiscountPct) || 0,
      slabNotes: String(j.slabNotes ?? ""),
      notes: String(j.notes ?? ""),
    };
  } catch {
    return { ...blank, notes: text };
  }
}

function serializeDiscountPolicy(p: DiscountPolicy): string {
  return JSON.stringify({
    defaultTradeDiscountPct: Number(p.defaultTradeDiscountPct) || 0,
    maxDiscountPct: Number(p.maxDiscountPct) || 0,
    cashDiscountPct: Number(p.cashDiscountPct) || 0,
    slabNotes: p.slabNotes.trim(),
    notes: p.notes.trim(),
  });
}

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
  discountPolicyJson: serializeDiscountPolicy(emptyDiscountPolicy()),
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
    discountPolicyJson: r.discountPolicyJson?.trim()
      ? r.discountPolicyJson
      : serializeDiscountPolicy(emptyDiscountPolicy()),
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
  const navigate = useNavigate();
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([
    ["pharmacy", "companies-paged"],
    ["pharmacy", "companies-picker"],
    ["pharmacy", "masters-medicines"],
    ["pharmacy", "company-products"],
  ]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyCompanyForm());
  const [tab, setTab] = useState<CompanyTab>("company");

  const [productQ, setProductQ] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(25);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [shiftTargetId, setShiftTargetId] = useState("");
  const [shiftMsg, setShiftMsg] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["pharmacy", "companies-paged", page, pageSize, q, status],
    queryFn: () => listCompaniesPaged({ page, pageSize, q: q || undefined, status: status || undefined }),
  });

  const companyProducts = useQuery({
    queryKey: [
      "pharmacy",
      "company-products",
      editing?.id,
      branch?.code,
      productPage,
      productPageSize,
      productQ,
    ],
    enabled: Boolean(editing?.id && branch?.code && (tab === "product" || tab === "shifting")),
    queryFn: () =>
      listMedicinesPaged({
        branchCode: branch!.code,
        companyId: editing!.id,
        page: productPage,
        pageSize: productPageSize,
        q: productQ || undefined,
        status: "active",
      }),
  });

  const companyPicker = useQuery({
    queryKey: ["pharmacy", "companies-picker"],
    queryFn: () => listCompaniesPaged({ page: 1, pageSize: 200, status: "active" }),
    enabled: tab === "shifting",
  });

  const lastCode = useMemo(() => {
    const codes = (list.data?.items ?? [])
      .map((r) => Number(String(r.code).replace(/\D/g, "")))
      .filter((n) => Number.isFinite(n) && n > 0);
    return codes.length ? Math.max(...codes) : 0;
  }, [list.data?.items]);

  const discount = useMemo(
    () => parseDiscountPolicy(form.discountPolicyJson),
    [form.discountPolicyJson],
  );

  const setDiscount = (patch: Partial<DiscountPolicy>) => {
    setForm((prev) => ({
      ...prev,
      discountPolicyJson: serializeDiscountPolicy({
        ...parseDiscountPolicy(prev.discountPolicyJson),
        ...patch,
      }),
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = companyPayload(form);
      if (editing) return updateCompany(editing.id, body);
      return createPharmacyCompany(body);
    },
    onSuccess: (row) => {
      void invalidate();
      const saved = row as CompanyRow | undefined;
      if (saved?.id) {
        setEditing(saved);
        setForm(rowToCompanyForm(saved));
      } else {
        setEditing(null);
        setForm(emptyCompanyForm());
        setTab("company");
      }
      setSelectedProductIds(new Set());
      setShiftMsg(null);
      setError(null);
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: (r: CompanyRow) => setCompanyStatus(r.id, r.status === "active" ? "inactive" : "active"),
    onSuccess: () => {
      void invalidate();
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const shiftProducts = useMutation({
    mutationFn: async () => {
      if (!editing?.id) throw new Error("Save the company first.");
      if (!shiftTargetId) throw new Error("Select a target company.");
      if (shiftTargetId === editing.id) throw new Error("Target must be a different company.");
      const ids = [...selectedProductIds];
      if (ids.length === 0) throw new Error("Select at least one product to shift.");
      for (const id of ids) {
        await updateMedicine(id, { companyId: shiftTargetId });
      }
      return ids.length;
    },
    onSuccess: (count) => {
      setSelectedProductIds(new Set());
      setError(null);
      void invalidate();
      void companyProducts.refetch();
      setShiftMsg(`Shifted ${count} product(s) to the target company.`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = (patch: Partial<CompanyForm>) => setForm({ ...form, ...patch });

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisibleProducts = () => {
    const items = companyProducts.data?.items ?? [];
    setSelectedProductIds((prev) => {
      const allSelected = items.length > 0 && items.every((r) => prev.has(r.id));
      if (allSelected) return new Set();
      return new Set(items.map((r) => r.id));
    });
  };

  const tabs: Array<{ id: CompanyTab; label: string }> = [
    { id: "company", label: "Company" },
    { id: "product", label: "Product" },
    { id: "discount", label: "Discount-Policy" },
    { id: "shifting", label: "Company Shifting" },
  ];

  const medicinesHref = editing?.id
    ? `/pops/distribution/medicines?companyId=${encodeURIComponent(editing.id)}`
    : "/pops/distribution/medicines";

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
            <div className="space-y-3">
              {!editing?.id ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Save the company first to manage its products.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <DistInput
                      className="min-w-[12rem] flex-1"
                      placeholder="Search products…"
                      value={productQ}
                      onChange={(e) => {
                        setProductQ(e.target.value);
                        setProductPage(1);
                      }}
                    />
                    <DistButton
                      type="button"
                      variant="secondary"
                      onClick={() => navigate(medicinesHref)}
                    >
                      + Add product
                    </DistButton>
                    <Link
                      to={medicinesHref}
                      className="text-xs font-semibold text-sky-600 underline dark:text-sky-400"
                    >
                      Open medicines list
                    </Link>
                  </div>
                  <DistDataTable
                    loading={companyProducts.isLoading}
                    rowKey={(r: MedicineMasterRow) => r.id}
                    empty="No products linked to this company"
                    rows={companyProducts.data?.items ?? []}
                    columns={[
                      { key: "sku", header: "SKU", className: "font-mono text-xs" },
                      { key: "name", header: "Name" },
                      {
                        key: "wholesalePricePkr",
                        header: "TP",
                        render: (r) =>
                          r.wholesalePricePkr != null ? String(r.wholesalePricePkr) : "—",
                      },
                      {
                        key: "sellingPricePkr",
                        header: "RP",
                        render: (r) =>
                          r.sellingPricePkr != null ? String(r.sellingPricePkr) : "—",
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (r) => <DistStatusBadge status={r.status} />,
                      },
                      {
                        key: "open",
                        header: "",
                        render: (r) => (
                          <DistButton
                            type="button"
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            onClick={() => navigate(`/pops/distribution/medicines/${r.id}`)}
                          >
                            Open
                          </DistButton>
                        ),
                      },
                    ]}
                  />
                  <DistPagination
                    page={companyProducts.data?.page ?? productPage}
                    pageSize={companyProducts.data?.pageSize ?? productPageSize}
                    total={companyProducts.data?.total ?? 0}
                    totalPages={companyProducts.data?.totalPages}
                    onPageChange={setProductPage}
                    onPageSizeChange={(n) => {
                      setProductPageSize(n);
                      setProductPage(1);
                    }}
                  />
                </>
              )}
              <label className="block text-xs text-slate-500">
                Product policy / notes
                <textarea
                  className="mt-1 min-h-[6rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={form.productPolicyJson}
                  onChange={(e) => set({ productPolicyJson: e.target.value })}
                  placeholder="Optional notes for this company’s product policy…"
                />
              </label>
            </div>
          ) : null}

          {tab === "discount" ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs text-slate-500">
                  Default trade discount %
                  <DistInput
                    className="mt-1"
                    type="number"
                    value={String(discount.defaultTradeDiscountPct)}
                    onChange={(e) =>
                      setDiscount({ defaultTradeDiscountPct: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Max discount %
                  <DistInput
                    className="mt-1"
                    type="number"
                    value={String(discount.maxDiscountPct)}
                    onChange={(e) => setDiscount({ maxDiscountPct: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Cash discount %
                  <DistInput
                    className="mt-1"
                    type="number"
                    value={String(discount.cashDiscountPct)}
                    onChange={(e) => setDiscount({ cashDiscountPct: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
              <label className="block text-xs text-slate-500">
                Slab / scheme notes
                <textarea
                  className="mt-1 min-h-[5rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={discount.slabNotes}
                  onChange={(e) => setDiscount({ slabNotes: e.target.value })}
                  placeholder="e.g. 5% on 10+ boxes, 8% on 50+…"
                />
              </label>
              <label className="block text-xs text-slate-500">
                Other discount notes
                <textarea
                  className="mt-1 min-h-[5rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={discount.notes}
                  onChange={(e) => setDiscount({ notes: e.target.value })}
                />
              </label>
            </div>
          ) : null}

          {tab === "shifting" ? (
            <div className="space-y-3">
              {!editing?.id ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Save the company first to shift products.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[14rem] flex-1 text-xs text-slate-500">
                      Target company
                      <DistSelect
                        className="mt-1"
                        value={shiftTargetId}
                        onChange={(e) => {
                          setShiftTargetId(e.target.value);
                          setShiftMsg(null);
                        }}
                      >
                        <option value="">Select company…</option>
                        {(companyPicker.data?.items ?? [])
                          .filter((c) => c.id !== editing.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} — {c.name}
                            </option>
                          ))}
                      </DistSelect>
                    </label>
                    <DistButton
                      type="button"
                      disabled={shiftProducts.isPending}
                      onClick={() => {
                        setShiftMsg(null);
                        shiftProducts.mutate();
                      }}
                    >
                      {shiftProducts.isPending ? "Shifting…" : `Shift selected (${selectedProductIds.size})`}
                    </DistButton>
                  </div>
                  {shiftMsg ? (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      {shiftMsg}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <DistInput
                      className="min-w-[12rem] flex-1"
                      placeholder="Search products to shift…"
                      value={productQ}
                      onChange={(e) => {
                        setProductQ(e.target.value);
                        setProductPage(1);
                      }}
                    />
                    <DistButton type="button" variant="secondary" onClick={toggleAllVisibleProducts}>
                      Toggle page selection
                    </DistButton>
                  </div>
                  <DistDataTable
                    loading={companyProducts.isLoading}
                    rowKey={(r: MedicineMasterRow) => r.id}
                    empty="No products to shift"
                    rows={companyProducts.data?.items ?? []}
                    columns={[
                      {
                        key: "sel",
                        header: "",
                        render: (r) => (
                          <input
                            type="checkbox"
                            checked={selectedProductIds.has(r.id)}
                            onChange={() => toggleProduct(r.id)}
                            aria-label={`Select ${r.sku}`}
                          />
                        ),
                      },
                      { key: "sku", header: "SKU", className: "font-mono text-xs" },
                      { key: "name", header: "Name" },
                      {
                        key: "status",
                        header: "Status",
                        render: (r) => <DistStatusBadge status={r.status} />,
                      },
                    ]}
                  />
                  <DistPagination
                    page={companyProducts.data?.page ?? productPage}
                    pageSize={companyProducts.data?.pageSize ?? productPageSize}
                    total={companyProducts.data?.total ?? 0}
                    totalPages={companyProducts.data?.totalPages}
                    onPageChange={setProductPage}
                    onPageSizeChange={(n) => {
                      setProductPageSize(n);
                      setProductPage(1);
                    }}
                  />
                </>
              )}
              <label className="block text-xs text-slate-500">
                Company shifting notes
                <textarea
                  className="mt-1 min-h-[5rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={form.companyShiftingJson}
                  onChange={(e) => set({ companyShiftingJson: e.target.value })}
                  placeholder="Optional notes about company / product shifts…"
                />
              </label>
            </div>
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
                  setSelectedProductIds(new Set());
                  setShiftTargetId("");
                  setShiftMsg(null);
                }}
              >
                Cancel
              </DistButton>
            ) : (
              <DistButton type="button" variant="secondary" onClick={() => {
                setForm(emptyCompanyForm());
                setSelectedProductIds(new Set());
                setShiftTargetId("");
                setShiftMsg(null);
              }}>
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
                    setProductQ("");
                    setProductPage(1);
                    setSelectedProductIds(new Set());
                    setShiftTargetId("");
                    setShiftMsg(null);
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
