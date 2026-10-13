/**
 * Bonus Attach — bind Buy-X-Get-Y / threshold free bonus to a company and/or
 * trade customer (optional medicine + date window). Applies in Sale Window quote.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createPharmacyScheme,
  fetchPharmacyCompanies,
  fetchPharmacySchemes,
  fetchPharmacyTradeCustomers,
} from "../../pharmacy/api/pharmacy-erp";
import { listMedicinesPaged, updateScheme } from "../../pharmacy/api/pharmacy-masters";
import { useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { customerDisplayName, tradeCustomerNameMap } from "../lib/customerDisplay";
import {
  DistButton,
  DistDataTable,
  DistDateField,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

type SchemeRow = {
  id: string;
  code?: string | null;
  name: string;
  schemeType?: string | null;
  medicineId?: string | null;
  companyId?: string | null;
  tradeCustomerId?: string | null;
  buyQty?: number | null;
  freeQty?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  priority?: number | null;
  status: string;
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm = {
  name: "",
  target: "company" as "company" | "customer" | "both",
  companyId: "",
  tradeCustomerId: "",
  medicineId: "",
  schemeType: "buy_x_get_y" as "buy_x_get_y" | "threshold_free",
  buyQty: "10",
  freeQty: "1",
  startDate: todayIso(),
  endDate: "",
};

export function DistributionBonusAttachPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([["pharmacy", "schemes"]]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filterTarget, setFilterTarget] = useState<"all" | "company" | "customer">("all");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const schemesQ = useQuery({
    queryKey: ["pharmacy", "schemes"],
    queryFn: () => fetchPharmacySchemes() as Promise<SchemeRow[]>,
  });
  const companiesQ = useQuery({
    queryKey: ["pharmacy", "companies"],
    queryFn: () => fetchPharmacyCompanies(),
    staleTime: 120_000,
  });
  const customersQ = useQuery({
    queryKey: ["pharmacy", "trade-customers", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchPharmacyTradeCustomers(branchCode),
  });
  const medicinesQ = useQuery({
    queryKey: ["pharmacy", "meds-for-bonus-attach", branchCode, form.companyId],
    enabled: Boolean(branchCode),
    queryFn: () =>
      listMedicinesPaged({
        branchCode: branchCode!,
        page: 1,
        pageSize: 200,
        status: "active",
        companyId: form.companyId || undefined,
      }),
    staleTime: 60_000,
  });

  const custNames = useMemo(
    () =>
      tradeCustomerNameMap(
        (customersQ.data ?? []) as { id?: string; name?: string | null; code?: string | null }[],
      ),
    [customersQ.data],
  );
  const companyName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companiesQ.data ?? []) {
      if (c.id) m.set(c.id, c.name || c.code || c.id);
    }
    return m;
  }, [companiesQ.data]);
  const medicineName = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of medicinesQ.data?.items ?? []) {
      m.set(x.id, `${x.sku} — ${x.name}`);
    }
    return m;
  }, [medicinesQ.data]);

  const attached = useMemo(() => {
    let list = (schemesQ.data ?? []).filter(
      (s) => Boolean(s.companyId || s.tradeCustomerId),
    );
    if (filterTarget === "company") list = list.filter((s) => s.companyId && !s.tradeCustomerId);
    if (filterTarget === "customer") list = list.filter((s) => s.tradeCustomerId);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((s) => {
        const co = s.companyId ? companyName.get(s.companyId) ?? "" : "";
        const cu = s.tradeCustomerId
          ? customerDisplayName({ tradeCustomerId: s.tradeCustomerId }, custNames)
          : "";
        return (
          s.name.toLowerCase().includes(needle) ||
          String(s.code ?? "").toLowerCase().includes(needle) ||
          co.toLowerCase().includes(needle) ||
          cu.toLowerCase().includes(needle)
        );
      });
    }
    return list;
  }, [schemesQ.data, filterTarget, q, companyName, custNames]);

  function patchForm(partial: Partial<typeof emptyForm>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function resetForm() {
    setForm({ ...emptyForm, startDate: todayIso() });
    setEditingId(null);
  }

  function startEdit(s: SchemeRow) {
    setEditingId(s.id);
    const hasCo = Boolean(s.companyId);
    const hasCu = Boolean(s.tradeCustomerId);
    setForm({
      name: s.name,
      target: hasCo && hasCu ? "both" : hasCu ? "customer" : "company",
      companyId: s.companyId ?? "",
      tradeCustomerId: s.tradeCustomerId ?? "",
      medicineId: s.medicineId ?? "",
      schemeType:
        s.schemeType === "threshold_free" || s.schemeType === "flat_free"
          ? "threshold_free"
          : "buy_x_get_y",
      buyQty: String(s.buyQty ?? 10),
      freeQty: String(s.freeQty ?? 1),
      startDate: s.startDate ? String(s.startDate).slice(0, 10) : todayIso(),
      endDate: s.endDate ? String(s.endDate).slice(0, 10) : "",
    });
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const companyId =
        form.target === "company" || form.target === "both" ? form.companyId || undefined : undefined;
      const tradeCustomerId =
        form.target === "customer" || form.target === "both"
          ? form.tradeCustomerId || undefined
          : undefined;
      if (!companyId && !tradeCustomerId) {
        throw new Error("Company ya customer select karo");
      }
      const buyQty = Number(form.buyQty) || 0;
      const freeQty = Number(form.freeQty) || 0;
      if (buyQty <= 0 || freeQty <= 0) throw new Error("Buy qty aur bonus qty > 0 hona chahiye");

      const coLabel = companyId ? companyName.get(companyId) ?? "Company" : "";
      const cuLabel = tradeCustomerId
        ? customerDisplayName({ tradeCustomerId }, custNames)
        : "";
      const autoName =
        form.name.trim() ||
        [
          "Bonus",
          coLabel,
          cuLabel,
          form.schemeType === "threshold_free"
            ? `≥${buyQty}→${freeQty} free`
            : `${buyQty}+${freeQty}`,
        ]
          .filter(Boolean)
          .join(" · ");

      const body = {
        name: autoName,
        schemeType: form.schemeType,
        companyId: companyId || null,
        tradeCustomerId: tradeCustomerId || null,
        medicineId: form.medicineId || null,
        buyQty,
        freeQty,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        status: "active",
      };
      if (editingId) return updateScheme(editingId, body);
      return createPharmacyScheme(body);
    },
    onSuccess: () => {
      setError(null);
      setNotice(editingId ? "Bonus attach updated" : "Bonus attached — Sale Window pe apply hoga");
      resetForm();
      invalidate();
      void schemesQ.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => updateScheme(id, { status: "inactive" }),
    onSuccess: () => {
      setNotice("Bonus deactivated");
      invalidate();
      void schemesQ.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <DistPageShell
      title="Bonus Attach"
      subtitle="Company ya customer pe bonus lagao — Buy X Get Y / threshold free. Sale Window auto apply karega."
      breadcrumb={[
        { label: "Bonus Reports", to: "/pops/distribution/bonus-reports" },
        { label: "Bonus Attach" },
      ]}
      actions={
        <>
          <Link
            to="/pops/distribution/bonus-reports"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
          >
            Bonus Reports
          </Link>
          <Link
            to="/pops/distribution/pricing"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
          >
            Pricing / Schemes
          </Link>
        </>
      }
    >
      {error ? (
        <DistErrorBanner message={error} onRetry={() => setError(null)} />
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {editingId ? "Edit bonus attach" : "Naya bonus attach"}
          </h3>
          {editingId ? (
            <DistButton variant="ghost" className="text-xs" onClick={resetForm}>
              Cancel edit
            </DistButton>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["company", "Company"],
              ["customer", "Customer"],
              ["both", "Company + Customer"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => patchForm({ target: value })}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                form.target === value
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(form.target === "company" || form.target === "both") && (
            <label className="text-xs text-slate-500">
              Company
              <div className="mt-1">
                <DistSelect
                  value={form.companyId}
                  onChange={(e) => patchForm({ companyId: e.target.value, medicineId: "" })}
                  required
                >
                  <option value="">Select company…</option>
                  {(companiesQ.data ?? []).map((c: { id?: string; name?: string }) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </DistSelect>
              </div>
            </label>
          )}
          {(form.target === "customer" || form.target === "both") && (
            <label className="text-xs text-slate-500">
              Customer
              <div className="mt-1">
                <DistSelect
                  value={form.tradeCustomerId}
                  onChange={(e) => patchForm({ tradeCustomerId: e.target.value })}
                  required
                >
                  <option value="">Select customer…</option>
                  {(customersQ.data ?? []).map(
                    (c: { id?: string; name?: string | null; code?: string | null }) => (
                      <option key={c.id} value={c.id}>
                        {customerDisplayName(c, custNames)}
                      </option>
                    ),
                  )}
                </DistSelect>
              </div>
            </label>
          )}
          <label className="text-xs text-slate-500">
            Medicine (optional)
            <div className="mt-1">
              <DistSelect
                value={form.medicineId}
                onChange={(e) => patchForm({ medicineId: e.target.value })}
              >
                <option value="">All products (in scope)</option>
                {(medicinesQ.data?.items ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sku} — {m.name}
                  </option>
                ))}
              </DistSelect>
            </div>
          </label>
          <label className="text-xs text-slate-500">
            Bonus type
            <div className="mt-1">
              <DistSelect
                value={form.schemeType}
                onChange={(e) =>
                  patchForm({
                    schemeType: e.target.value as "buy_x_get_y" | "threshold_free",
                  })
                }
              >
                <option value="buy_x_get_y">Buy X Get Y (har multiple pe)</option>
                <option value="threshold_free">Threshold — kam az kam X pe Y free ek dafa</option>
              </DistSelect>
            </div>
          </label>
          <label className="text-xs text-slate-500">
            {form.schemeType === "threshold_free" ? "Min buy qty" : "Buy qty (X)"}
            <div className="mt-1">
              <DistInput
                type="number"
                min={1}
                value={form.buyQty}
                onChange={(e) => patchForm({ buyQty: e.target.value })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-500">
            Bonus / free qty (Y)
            <div className="mt-1">
              <DistInput
                type="number"
                min={1}
                value={form.freeQty}
                onChange={(e) => patchForm({ freeQty: e.target.value })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-500">
            From (aj default)
            <div className="mt-1">
              <DistDateField
                value={form.startDate}
                onChange={(e) => patchForm({ startDate: e.target.value })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-500">
            To (optional)
            <div className="mt-1">
              <DistDateField
                value={form.endDate}
                onChange={(e) => patchForm({ endDate: e.target.value })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            Name (optional)
            <div className="mt-1">
              <DistInput
                placeholder="Auto: Bonus · Company · Customer · 10+1"
                value={form.name}
                onChange={(e) => patchForm({ name: e.target.value })}
              />
            </div>
          </label>
        </div>

        <p className="text-[11px] text-slate-500">
          Example: Company GSK + Customer City Medical · Buy 10 Get 1 — Sale Window mein us customer
          pe GSK product book karte hi free qty auto lagegi.
        </p>

        <div className="flex flex-wrap gap-2">
          <DistButton
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Saving…" : editingId ? "Update attach" : "Attach bonus"}
          </DistButton>
          <DistButton variant="secondary" onClick={resetForm}>
            Clear
          </DistButton>
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Search
          <div className="mt-1">
            <DistInput
              placeholder="Name, company, customer…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </label>
        <label className="text-xs text-slate-500">
          Show
          <div className="mt-1 min-w-[9rem]">
            <DistSelect
              value={filterTarget}
              onChange={(e) => setFilterTarget(e.target.value as typeof filterTarget)}
            >
              <option value="all">All attached</option>
              <option value="company">Company only</option>
              <option value="customer">With customer</option>
            </DistSelect>
          </div>
        </label>
      </div>

      <DistDataTable
        loading={schemesQ.isLoading}
        empty="Abhi koi company/customer bonus attach nahi"
        rows={attached}
        rowKey={(r) => r.id}
        columns={[
          { key: "code", header: "Code", render: (r) => r.code ?? "—" },
          { key: "name", header: "Name", render: (r) => r.name },
          {
            key: "company",
            header: "Company",
            render: (r) => (r.companyId ? companyName.get(r.companyId) ?? "—" : "—"),
          },
          {
            key: "customer",
            header: "Customer",
            render: (r) =>
              r.tradeCustomerId
                ? customerDisplayName({ tradeCustomerId: r.tradeCustomerId }, custNames)
                : "—",
          },
          {
            key: "medicine",
            header: "Medicine",
            render: (r) =>
              r.medicineId ? medicineName.get(r.medicineId) ?? r.medicineId.slice(0, 8) : "All",
          },
          {
            key: "rule",
            header: "Bonus rule",
            render: (r) =>
              r.schemeType === "threshold_free" || r.schemeType === "flat_free"
                ? `≥${r.buyQty} → ${r.freeQty} free`
                : `${r.buyQty}+${r.freeQty}`,
          },
          {
            key: "dates",
            header: "Dates",
            render: (r) =>
              `${r.startDate ? String(r.startDate).slice(0, 10) : "—"} → ${
                r.endDate ? String(r.endDate).slice(0, 10) : "open"
              }`,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} />,
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className="text-xs font-semibold text-cyan-700 dark:text-cyan-400"
                  onClick={() => startEdit(r)}
                >
                  Edit
                </button>
                {r.status === "active" ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-amber-700 dark:text-amber-400"
                    onClick={() => deactivateMut.mutate(r.id)}
                  >
                    Off
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </DistPageShell>
  );
}
