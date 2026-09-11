import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { PharmacyDoctor } from "@platform/contracts";
import {
  addDoctorCommissionRule,
  addDoctorRecommendation,
  createPharmacyDoctor,
  fetchDoctorCommissionEntries,
  fetchDoctorCommissionRules,
  fetchDoctorRecommendations,
  fetchPharmacyDoctors,
  fetchPharmacyMedicines,
  markDoctorCommissionPaid,
  removeDoctorRecommendation,
} from "../api/pharmacy";
import { formatPkr, pharmacyInputClass, useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";

export function PharmacyDoctorsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [form, setForm] = useState({
    code: "",
    name: "",
    specialization: "",
    registrationNumber: "",
    clinic: "",
    phone: "",
    email: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prefMedicineId, setPrefMedicineId] = useState("");
  const [ruleRate, setRuleRate] = useState("5");
  const [ruleType, setRuleType] = useState<"percent" | "fixed">("percent");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["pharmacy", "doctors", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDoctors(branch!.code),
  });
  const medicines = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });
  const prefs = useQuery({
    queryKey: ["pharmacy", "doctor-prefs", selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => fetchDoctorRecommendations(selectedId!),
  });
  const rules = useQuery({
    queryKey: ["pharmacy", "doctor-rules", selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => fetchDoctorCommissionRules(selectedId!),
  });
  const ledger = useQuery({
    queryKey: ["pharmacy", "doctor-ledger", selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => fetchDoctorCommissionEntries(selectedId!),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPharmacyDoctor({
        branchCode: branch!.code,
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        specialization: form.specialization.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        clinic: form.clinic.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm({ code: "", name: "", specialization: "", registrationNumber: "", clinic: "", phone: "", email: "" });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const selected = (query.data ?? []).find((d) => d.id === selectedId) ?? null;

  if (query.isLoading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading doctors…</p>;
  if (query.isError) return <p className="text-sm text-red-400">{(query.error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Doctor CRM"
        subtitle="Codes, preferred medicines, commission rules, and referral ledger with line-level detail."
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add doctor</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input className={pharmacyInputClass} placeholder="Code (DOC-… optional)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Doctor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Specialization" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Registration #" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Clinic" value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <button type="submit" disabled={!form.name.trim() || createMutation.isPending} className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          Save doctor
        </button>
      </form>

      <SimpleTable<PharmacyDoctor>
        rowKey={(r) => r.id}
        columns={[
          { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs">{r.code ?? "—"}</span> },
          { key: "name", header: "Doctor" },
          { key: "specialization", header: "Specialization", render: (r) => r.specialization ?? "—" },
          { key: "clinic", header: "Clinic", render: (r) => r.clinic ?? "—" },
          { key: "prescriptionCount", header: "Rx" },
          {
            key: "referredSalesPkr",
            header: "Referred sales",
            render: (r) => formatPkr(Number(r.referredSalesPkr ?? 0)),
          },
          {
            key: "accruedCommissionPkr",
            header: "Commission due",
            render: (r) => formatPkr(Number(r.accruedCommissionPkr ?? 0)),
          },
          {
            key: "preferredCount",
            header: "Prefs",
            render: (r) => Number(r.preferredCount ?? 0),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <button type="button" className="text-xs text-emerald-600 dark:text-emerald-400" onClick={() => setSelectedId(r.id)}>
                Open CRM
              </button>
            ),
          },
        ]}
        rows={query.data ?? []}
      />

      {selected ? (
        <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-50/20 p-4 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {selected.name} <span className="font-mono text-xs text-slate-500">({selected.code ?? "—"})</span>
            </h2>
            <button type="button" className="text-xs text-slate-500" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </div>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Recommended medicines</h3>
            <form
              className="mb-2 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!prefMedicineId) return;
                addDoctorRecommendation(selected.id, { medicineId: prefMedicineId, priority: 1 })
                  .then(() => {
                    invalidate();
                    void prefs.refetch();
                    setPrefMedicineId("");
                  })
                  .catch((err: Error) => setError(err.message));
              }}
            >
              <select className={pharmacyInputClass} value={prefMedicineId} onChange={(e) => setPrefMedicineId(e.target.value)} required>
                <option value="">Select medicine</option>
                {(medicines.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sku} — {m.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white">
                Add preferred
              </button>
            </form>
            <SimpleTable
              rowKey={(r) => r.id}
              columns={[
                { key: "medicineSku", header: "SKU", render: (r) => <span className="font-mono text-xs">{r.medicineSku ?? "—"}</span> },
                { key: "medicineName", header: "Medicine", render: (r) => r.medicineName ?? "—" },
                { key: "priority", header: "Priority" },
                {
                  key: "actions",
                  header: "",
                  render: (r) => (
                    <button
                      type="button"
                      className="text-xs text-red-500"
                      onClick={() =>
                        removeDoctorRecommendation(r.id)
                          .then(() => {
                            invalidate();
                            void prefs.refetch();
                          })
                          .catch((err: Error) => setError(err.message))
                      }
                    >
                      Remove
                    </button>
                  ),
                },
              ]}
              rows={prefs.data ?? []}
            />
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Commission rules</h3>
            <form
              className="mb-2 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addDoctorCommissionRule(selected.id, {
                  ruleType,
                  rateValue: Number(ruleRate) || 0,
                  notes: "Default referral rule",
                })
                  .then(() => {
                    invalidate();
                    void rules.refetch();
                  })
                  .catch((err: Error) => setError(err.message));
              }}
            >
              <select className={pharmacyInputClass} value={ruleType} onChange={(e) => setRuleType(e.target.value as "percent" | "fixed")}>
                <option value="percent">Percent of line</option>
                <option value="fixed">Fixed PKR / line</option>
              </select>
              <input className={pharmacyInputClass} type="number" min={0} value={ruleRate} onChange={(e) => setRuleRate(e.target.value)} placeholder="Rate" />
              <button type="submit" className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white">
                Save rule
              </button>
            </form>
            <SimpleTable
              rowKey={(r) => r.id}
              columns={[
                { key: "ruleType", header: "Type" },
                { key: "rateValue", header: "Rate" },
                { key: "active", header: "Active", render: (r) => (r.active ? "Yes" : "No") },
                { key: "notes", header: "Notes", render: (r) => r.notes ?? "—" },
              ]}
              rows={rules.data ?? []}
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Commission ledger</h3>
              <button
                type="button"
                className="text-xs text-emerald-600 dark:text-emerald-400"
                onClick={() => {
                  const ids = (ledger.data ?? []).filter((e) => e.status === "accrued").map((e) => e.id);
                  if (!ids.length) return;
                  markDoctorCommissionPaid(ids)
                    .then(() => {
                      invalidate();
                      void ledger.refetch();
                    })
                    .catch((err: Error) => setError(err.message));
                }}
              >
                Mark accrued as paid
              </button>
            </div>
            <SimpleTable
              rowKey={(r) => r.id}
              columns={[
                { key: "invoiceNumber", header: "Invoice", render: (r) => r.invoiceNumber ?? "—" },
                { key: "medicineName", header: "Medicine", render: (r) => r.medicineName ?? "—" },
                { key: "basePkr", header: "Base", render: (r) => formatPkr(r.basePkr) },
                {
                  key: "rateValue",
                  header: "Rate",
                  render: (r) => (r.ruleType === "fixed" ? formatPkr(r.rateValue) : `${r.rateValue}%`),
                },
                { key: "amountPkr", header: "Commission", render: (r) => formatPkr(r.amountPkr) },
                { key: "status", header: "Status" },
                { key: "notes", header: "Detail", render: (r) => r.notes ?? "—" },
                {
                  key: "createdAt",
                  header: "When",
                  render: (r) => new Date(r.createdAt).toLocaleString(),
                },
              ]}
              rows={ledger.data ?? []}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
