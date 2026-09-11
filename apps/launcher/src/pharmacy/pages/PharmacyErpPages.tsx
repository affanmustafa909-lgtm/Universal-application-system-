import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import { pharmacyInputClass, useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import {
  approvePharmacyDistOrder,
  approvePharmacyPurchaseOrder,
  createPharmacyArea,
  createPharmacyAssignment,
  createPharmacyCity,
  createPharmacyCollection,
  createPharmacyCompany,
  createPharmacyDelivery,
  createPharmacyDistOrder,
  createPharmacyGrn,
  createPharmacyPriceList,
  createPharmacyPurchaseOrder,
  createPharmacyRoute,
  createPharmacySaleReturn,
  createPharmacyScheme,
  createPharmacyTerritory,
  createPharmacyTradeCustomer,
  createPharmacyVisit,
  createPharmacyWarehouse,
  createPharmacyWholesaleReturn,
  fetchPharmacyAreas,
  fetchPharmacyAssignments,
  fetchPharmacyCities,
  fetchPharmacyCollections,
  fetchPharmacyCompanies,
  fetchPharmacyDeliveries,
  fetchPharmacyDistOrders,
  fetchPharmacyEmployeesPicker,
  fetchPharmacyGrns,
  fetchPharmacyPriceLists,
  fetchPharmacyPurchaseOrders,
  fetchPharmacyRoutes,
  fetchPharmacySaleReturns,
  fetchPharmacySchemes,
  fetchPharmacyTargets,
  fetchPharmacyTerritories,
  fetchPharmacyTradeCustomerLedger,
  fetchPharmacyTradeCustomers,
  fetchPharmacyVisits,
  fetchPharmacyWarehouses,
  fetchPharmacyWholesaleReturns,
  invoicePharmacyDistOrder,
  updatePharmacyDelivery,
} from "../api/pharmacy-erp";
import { fetchPharmacyDoctors, fetchPharmacyMedicines, fetchPharmacySales } from "../api/pharmacy";

function Err({ error }: { error: string | null }) {
  return error ? <p className="text-sm text-red-400">{error}</p> : null;
}

export function PharmacyCompaniesPage(): JSX.Element {
  const invalidate = useInvalidatePharmacy();
  const [form, setForm] = useState({ code: "", name: "", manufacturerName: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["pharmacy", "companies"], queryFn: fetchPharmacyCompanies });
  const create = useMutation({
    mutationFn: () => createPharmacyCompany(form),
    onSuccess: () => {
      invalidate();
      setForm({ code: "", name: "", manufacturerName: "", phone: "" });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Companies / manufacturers" subtitle="Product company master for distribution and retail." />
      <Err error={error} />
      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input className={pharmacyInputClass} placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Manufacturer" value={form.manufacturerName} onChange={(e) => setForm({ ...form, manufacturerName: e.target.value })} />
          <input className={pharmacyInputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <button type="submit" className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white" disabled={create.isPending}>
          Save company
        </button>
      </form>
      <SimpleTable rowKey={(r) => r.id} columns={[{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "manufacturerName", header: "Manufacturer", render: (r) => r.manufacturerName ?? "—" }, { key: "status", header: "Status" }]} rows={query.data ?? []} />
    </div>
  );
}

export function PharmacyWarehousesPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [form, setForm] = useState({ code: "", name: "", isDefault: false });
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["pharmacy", "warehouses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyWarehouses(branch!.code),
  });
  const create = useMutation({
    mutationFn: () => createPharmacyWarehouse({ branchCode: branch!.code, ...form }),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Warehouses" subtitle="Branch warehouses for batch-scoped stock." />
      <Err error={error} />
      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={pharmacyInputClass} placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Default warehouse
          </label>
        </div>
        <button type="submit" className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white" disabled={!branch || create.isPending}>
          Save warehouse
        </button>
      </form>
      <SimpleTable rowKey={(r) => r.id} columns={[{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "isDefault", header: "Default", render: (r) => (r.isDefault ? "Yes" : "No") }, { key: "status", header: "Status" }]} rows={query.data ?? []} />
    </div>
  );
}

export function PharmacyGeoPage(): JSX.Element {
  const invalidate = useInvalidatePharmacy();
  const [error, setError] = useState<string | null>(null);
  const [tForm, setTForm] = useState({ code: "", name: "", region: "" });
  const [cForm, setCForm] = useState({ code: "", name: "", territoryId: "" });
  const [aForm, setAForm] = useState({ code: "", name: "", cityId: "", isOutstation: false });
  const [rForm, setRForm] = useState({ code: "", name: "", areaId: "", sequenceNo: "0", pjpDayOfWeek: "", station: "" });
  const territories = useQuery({ queryKey: ["pharmacy", "territories"], queryFn: fetchPharmacyTerritories });
  const cities = useQuery({ queryKey: ["pharmacy", "cities"], queryFn: fetchPharmacyCities });
  const areas = useQuery({ queryKey: ["pharmacy", "areas"], queryFn: fetchPharmacyAreas });
  const routes = useQuery({ queryKey: ["pharmacy", "routes"], queryFn: fetchPharmacyRoutes });
  return (
    <div className="space-y-6">
      <PageHeader title="Geography" subtitle="Territory → City → Area → Route for distribution coverage." />
      <Err error={error} />
      <section className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Territories</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createPharmacyTerritory(tForm)
              .then(() => {
                invalidate();
                setTForm({ code: "", name: "", region: "" });
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          <input className={pharmacyInputClass} placeholder="Code" value={tForm.code} onChange={(e) => setTForm({ ...tForm, code: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Name" value={tForm.name} onChange={(e) => setTForm({ ...tForm, name: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Region" value={tForm.region} onChange={(e) => setTForm({ ...tForm, region: e.target.value })} />
          <button type="submit" className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white">
            Add
          </button>
        </form>
        <SimpleTable rowKey={(r) => r.id} columns={[{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "region", header: "Region", render: (r) => r.region ?? "—" }]} rows={territories.data ?? []} />
      </section>
      <section className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cities</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createPharmacyCity({ ...cForm, territoryId: cForm.territoryId || undefined })
              .then(() => {
                invalidate();
                setCForm({ code: "", name: "", territoryId: "" });
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          <input className={pharmacyInputClass} placeholder="Code" value={cForm.code} onChange={(e) => setCForm({ ...cForm, code: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Name" value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} required />
          <select className={pharmacyInputClass} value={cForm.territoryId} onChange={(e) => setCForm({ ...cForm, territoryId: e.target.value })}>
            <option value="">Territory (optional)</option>
            {(territories.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white">
            Add
          </button>
        </form>
        <SimpleTable rowKey={(r) => r.id} columns={[{ key: "code", header: "Code" }, { key: "name", header: "Name" }]} rows={cities.data ?? []} />
      </section>
      <section className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Areas</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createPharmacyArea(aForm)
              .then(() => {
                invalidate();
                setAForm({ code: "", name: "", cityId: "", isOutstation: false });
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          <input className={pharmacyInputClass} placeholder="Code" value={aForm.code} onChange={(e) => setAForm({ ...aForm, code: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Name" value={aForm.name} onChange={(e) => setAForm({ ...aForm, name: e.target.value })} required />
          <select className={pharmacyInputClass} value={aForm.cityId} onChange={(e) => setAForm({ ...aForm, cityId: e.target.value })} required>
            <option value="">City</option>
            {(cities.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={aForm.isOutstation} onChange={(e) => setAForm({ ...aForm, isOutstation: e.target.checked })} />
            Outstation
          </label>
          <button type="submit" className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white">
            Add
          </button>
        </form>
        <SimpleTable rowKey={(r) => r.id} columns={[{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "isOutstation", header: "Station", render: (r) => (r.isOutstation ? "Outstation" : "Instation") }]} rows={areas.data ?? []} />
      </section>
      <section className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Routes / beats (PJP)</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createPharmacyRoute({
              ...rForm,
              sequenceNo: Number(rForm.sequenceNo) || 0,
              pjpDayOfWeek: rForm.pjpDayOfWeek === "" ? null : Number(rForm.pjpDayOfWeek),
            })
              .then(() => {
                invalidate();
                setRForm({ code: "", name: "", areaId: "", sequenceNo: "0", pjpDayOfWeek: "", station: "" });
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          <input className={pharmacyInputClass} placeholder="Code" value={rForm.code} onChange={(e) => setRForm({ ...rForm, code: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Beat name" value={rForm.name} onChange={(e) => setRForm({ ...rForm, name: e.target.value })} required />
          <select className={pharmacyInputClass} value={rForm.areaId} onChange={(e) => setRForm({ ...rForm, areaId: e.target.value })} required>
            <option value="">Area</option>
            {(areas.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.isOutstation ? "(Out)" : "(In)"}
              </option>
            ))}
          </select>
          <input className={pharmacyInputClass} type="number" min={0} placeholder="Seq" value={rForm.sequenceNo} onChange={(e) => setRForm({ ...rForm, sequenceNo: e.target.value })} />
          <select className={pharmacyInputClass} value={rForm.pjpDayOfWeek} onChange={(e) => setRForm({ ...rForm, pjpDayOfWeek: e.target.value })}>
            <option value="">PJP day (any)</option>
            <option value="0">Sun</option>
            <option value="1">Mon</option>
            <option value="2">Tue</option>
            <option value="3">Wed</option>
            <option value="4">Thu</option>
            <option value="5">Fri</option>
            <option value="6">Sat</option>
          </select>
          <input className={pharmacyInputClass} placeholder="Station label" value={rForm.station} onChange={(e) => setRForm({ ...rForm, station: e.target.value })} />
          <button type="submit" className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white">
            Add
          </button>
        </form>
        <SimpleTable
          rowKey={(r) => r.id}
          columns={[
            { key: "code", header: "Code" },
            { key: "name", header: "Beat" },
            { key: "sequenceNo", header: "Seq", render: (r) => r.sequenceNo ?? 0 },
            {
              key: "pjpDayOfWeek",
              header: "PJP",
              render: (r) => {
                const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                return r.pjpDayOfWeek == null ? "Any" : days[r.pjpDayOfWeek] ?? "—";
              },
            },
            { key: "station", header: "Station", render: (r) => r.station ?? "—" },
          ]}
          rows={routes.data ?? []}
        />
      </section>
    </div>
  );
}

export function PharmacyTradeCustomersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [form, setForm] = useState({
    code: "",
    name: "",
    customerType: "Retailer",
    phone: "",
    creditLimitPkr: 0,
    priceLevel: "wholesale",
    areaId: "",
    routeId: "",
  });
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const areas = useQuery({ queryKey: ["pharmacy", "areas"], queryFn: fetchPharmacyAreas });
  const routes = useQuery({ queryKey: ["pharmacy", "routes"], queryFn: fetchPharmacyRoutes });
  const query = useQuery({
    queryKey: ["pharmacy", "trade-customers", branch?.code],
    queryFn: () => fetchPharmacyTradeCustomers(branch?.code),
  });
  const ledger = useQuery({
    queryKey: ["pharmacy", "trade-ledger", ledgerId],
    enabled: Boolean(ledgerId),
    queryFn: () => fetchPharmacyTradeCustomerLedger(ledgerId!),
  });
  const create = useMutation({
    mutationFn: () =>
      createPharmacyTradeCustomer({
        ...form,
        branchCode: branch?.code,
        creditLimitPkr: Number(form.creditLimitPkr) || 0,
        areaId: form.areaId || undefined,
        routeId: form.routeId || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Trade customers" subtitle="B2B parties with area/route station and recovery aging." />
      <Err error={error} />
      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input className={pharmacyInputClass} placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className={pharmacyInputClass} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select className={pharmacyInputClass} value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
            {["Distributor", "Dealer", "Retailer", "Pharmacy", "Hospital", "Clinic", "Institution"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input className={pharmacyInputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={pharmacyInputClass} type="number" placeholder="Credit limit" value={form.creditLimitPkr} onChange={(e) => setForm({ ...form, creditLimitPkr: Number(e.target.value) })} />
          <select className={pharmacyInputClass} value={form.priceLevel} onChange={(e) => setForm({ ...form, priceLevel: e.target.value })}>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
            <option value="dealer">Dealer</option>
          </select>
          <select className={pharmacyInputClass} value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
            <option value="">Area / station</option>
            {(areas.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.isOutstation ? "Outstation" : "Instation"})
              </option>
            ))}
          </select>
          <select className={pharmacyInputClass} value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
            <option value="">Beat / route</option>
            {(routes.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white" disabled={create.isPending}>
          Save customer
        </button>
      </form>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "code", header: "Code" },
          { key: "name", header: "Name" },
          { key: "customerType", header: "Type" },
          { key: "outstandingPkr", header: "Outstanding", render: (r) => `Rs ${Number(r.outstandingPkr ?? 0).toLocaleString()}` },
          { key: "creditLimitPkr", header: "Credit limit", render: (r) => `Rs ${Number(r.creditLimitPkr ?? 0).toLocaleString()}` },
          {
            key: "actions",
            header: "Recovery",
            render: (r) => (
              <button type="button" className="text-xs text-emerald-600 dark:text-emerald-400" onClick={() => setLedgerId(r.id)}>
                Ledger / aging
              </button>
            ),
          },
        ]}
        rows={query.data ?? []}
      />
      {ledgerId && ledger.data ? (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recovery — {ledger.data.customer?.name}
              {ledger.data.overdueBlocked ? <span className="ml-2 text-xs text-red-500">Credit blocked</span> : null}
            </h2>
            <button type="button" className="text-xs text-slate-500" onClick={() => setLedgerId(null)}>
              Close
            </button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm text-slate-700 dark:text-slate-200">
            <div>0–30d: Rs {Number(ledger.data.aging?.d0_30 ?? 0).toLocaleString()}</div>
            <div>31–60d: Rs {Number(ledger.data.aging?.d31_60 ?? 0).toLocaleString()}</div>
            <div>61+: Rs {Number(ledger.data.aging?.d61_plus ?? 0).toLocaleString()}</div>
          </div>
          <SimpleTable
            rowKey={(r) => r.id}
            columns={[
              { key: "invoiceNumber", header: "Invoice" },
              { key: "totalPkr", header: "Total", render: (r) => `Rs ${Number(r.totalPkr).toLocaleString()}` },
              { key: "amountDuePkr", header: "Due", render: (r) => `Rs ${Number(r.amountDuePkr).toLocaleString()}` },
            ]}
            rows={ledger.data.invoices ?? []}
          />
        </div>
      ) : null}
    </div>
  );
}

export function PharmacyPurchaseOrdersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [error, setError] = useState<string | null>(null);
  const [medicineId, setMedicineId] = useState("");
  const [qty, setQty] = useState(10);
  const [unitCost, setUnitCost] = useState(0);
  const meds = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });
  const query = useQuery({
    queryKey: ["pharmacy", "pos", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyPurchaseOrders(branch!.code),
  });
  const warehouses = useQuery({
    queryKey: ["pharmacy", "warehouses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyWarehouses(branch!.code),
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Purchase orders" subtitle="Medicine POs — approve then receive via GRN into warehouse batches." />
      <Err error={error} />
      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (!branch || !medicineId) return;
          createPharmacyPurchaseOrder({
            branchCode: branch.code,
            orderDate: new Date().toISOString().slice(0, 10),
            lines: [{ medicineId, quantity: qty, unitCostPkr: unitCost, freeQuantity: 0 }],
          })
            .then(() => {
              invalidate();
              setError(null);
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <select className={pharmacyInputClass} value={medicineId} onChange={(e) => setMedicineId(e.target.value)} required>
            <option value="">Medicine</option>
            {(meds.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input className={pharmacyInputClass} type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <input className={pharmacyInputClass} type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} placeholder="Unit cost" />
        </div>
        <button type="submit" className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
          Create PO
        </button>
      </form>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "poNumber", header: "PO#" },
          { key: "status", header: "Status" },
          { key: "totalPkr", header: "Total", render: (r) => `Rs ${Number(r.totalPkr ?? 0).toLocaleString()}` },
          {
            key: "actions",
            header: "Actions",
            render: (r) =>
              r.status === "draft" || r.status === "submitted" ? (
                <button
                  type="button"
                  className="text-sm text-emerald-600"
                  onClick={() =>
                    approvePharmacyPurchaseOrder(r.id)
                      .then(() => invalidate())
                      .catch((err: Error) => setError(err.message))
                  }
                >
                  Approve
                </button>
              ) : (
                "—"
              ),
          },
        ]}
        rows={query.data ?? []}
      />
      <PharmacyGrnInline branchCode={branch?.code} warehouses={warehouses.data ?? []} medicines={meds.data ?? []} onDone={() => invalidate()} onError={setError} />
    </div>
  );
}

function PharmacyGrnInline({
  branchCode,
  warehouses,
  medicines,
  onDone,
  onError,
}: {
  branchCode?: string;
  warehouses: any[];
  medicines: any[];
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [warehouseId, setWarehouseId] = useState("");
  const [medicineId, setMedicineId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [unitCostPkr, setUnitCostPkr] = useState(0);
  return (
    <form
      className="rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700"
      onSubmit={(e) => {
        e.preventDefault();
        if (!branchCode) return;
        createPharmacyGrn({
          branchCode,
          warehouseId,
          receivedDate: new Date().toISOString().slice(0, 10),
          lines: [{ medicineId, batchNumber, expiryDate, quantity, unitCostPkr, freeQuantity: 0 }],
        })
          .then(onDone)
          .catch((err: Error) => onError(err.message));
      }}
    >
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Goods receipt (GRN)</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <select className={pharmacyInputClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
          <option value="">Warehouse</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select className={pharmacyInputClass} value={medicineId} onChange={(e) => setMedicineId(e.target.value)} required>
          <option value="">Medicine</option>
          {medicines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input className={pharmacyInputClass} placeholder="Batch #" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} required />
        <input className={pharmacyInputClass} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />
        <input className={pharmacyInputClass} type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        <input className={pharmacyInputClass} type="number" min={0} value={unitCostPkr} onChange={(e) => setUnitCostPkr(Number(e.target.value))} />
      </div>
      <button type="submit" className="mt-3 rounded-md bg-slate-800 px-4 py-2 text-sm text-white dark:bg-slate-200 dark:text-slate-900">
        Post GRN → stock
      </button>
    </form>
  );
}

export function PharmacySaleReturnsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [error, setError] = useState<string | null>(null);
  const [saleId, setSaleId] = useState("");
  const sales = useQuery({
    queryKey: ["pharmacy", "sales", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacySales(branch!.code),
  });
  const returns = useQuery({
    queryKey: ["pharmacy", "sale-returns", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacySaleReturns(branch!.code),
  });
  const selected = useMemo(() => (sales.data ?? []).find((s) => s.id === saleId), [sales.data, saleId]);
  return (
    <div className="space-y-4">
      <PageHeader title="Pharmacy sale returns" subtitle="Batch-aware returns restore stock to the original batch." />
      <Err error={error} />
      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (!branch || !selected?.lines?.length) return;
          const line = selected.lines[0];
          createPharmacySaleReturn({
            branchCode: branch.code,
            originalSaleId: selected.id,
            reason: "Customer return",
            refundMethod: "Cash",
            lines: [
              {
                medicineId: line.medicineId,
                batchId: line.batchId ?? undefined,
                qty: 1,
                tabletsQty: line.tabletsQty && line.qty ? Math.max(1, Math.round(line.tabletsQty / line.qty)) : 1,
                unitPricePkr: line.unitPrice,
              },
            ],
          })
            .then(() => {
              invalidate();
              setError(null);
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <select className={pharmacyInputClass} value={saleId} onChange={(e) => setSaleId(e.target.value)} required>
          <option value="">Original invoice</option>
          {(sales.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.invoiceNumber} — Rs {s.total}
            </option>
          ))}
        </select>
        <button type="submit" className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
          Return 1 unit of first line
        </button>
      </form>
      <SimpleTable rowKey={(r) => r.id} columns={[{ key: "returnNumber", header: "Return#" }, { key: "totalPkr", header: "Total", render: (r) => `Rs ${Number(r.totalPkr ?? 0).toLocaleString()}` }, { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" }]} rows={returns.data ?? []} />
    </div>
  );
}

export function PharmacyDistOrdersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [error, setError] = useState<string | null>(null);
  const [tradeCustomerId, setTradeCustomerId] = useState("");
  const [medicineId, setMedicineId] = useState("");
  const [qty, setQty] = useState(10);
  const customers = useQuery({ queryKey: ["pharmacy", "trade-customers"], queryFn: () => fetchPharmacyTradeCustomers(branch?.code) });
  const meds = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });
  const query = useQuery({
    queryKey: ["pharmacy", "dist-orders", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDistOrders(branch!.code),
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Order booking / wholesale" subtitle="Book → approve → invoice. Buy X Get Y free qty applies automatically from active schemes." />
      <Err error={error} />
      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (!branch) return;
          createPharmacyDistOrder({
            branchCode: branch.code,
            tradeCustomerId,
            submit: true,
            lines: [{ medicineId, quantity: qty }],
          })
            .then(() => {
              invalidate();
              setError(null);
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <select className={pharmacyInputClass} value={tradeCustomerId} onChange={(e) => setTradeCustomerId(e.target.value)} required>
            <option value="">Trade customer</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className={pharmacyInputClass} value={medicineId} onChange={(e) => setMedicineId(e.target.value)} required>
            <option value="">Medicine</option>
            {(meds.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input className={pharmacyInputClass} type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </div>
        <button type="submit" className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
          Book order
        </button>
      </form>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "orderNumber", header: "Order#" },
          { key: "status", header: "Status" },
          { key: "totalPkr", header: "Total", render: (r) => `Rs ${Number(r.totalPkr ?? 0).toLocaleString()}` },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <div className="flex gap-2 text-sm">
                {(r.status === "draft" || r.status === "submitted" || r.status === "booked") && (
                  <button type="button" className="text-emerald-600 dark:text-emerald-400" onClick={() => approvePharmacyDistOrder(r.id).then(() => invalidate()).catch((e: Error) => setError(e.message))}>
                    Approve
                  </button>
                )}
                {(r.status === "approved" || r.status === "picking" || r.status === "packed") && (
                  <button type="button" className="text-sky-600" onClick={() => invoicePharmacyDistOrder(r.id).then(() => invalidate()).catch((e: Error) => setError(e.message))}>
                    Invoice
                  </button>
                )}
              </div>
            ),
          },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}

export function PharmacyDeliveriesPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [searchParams] = useSearchParams();
  const focus = (searchParams.get("focus") ?? "").trim().toLowerCase();
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [riderName, setRiderName] = useState("");
  const orders = useQuery({
    queryKey: ["pharmacy", "dist-orders", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDistOrders(branch!.code),
  });
  const query = useQuery({
    queryKey: ["pharmacy", "deliveries", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDeliveries(branch!.code),
  });

  const rows = useMemo(() => {
    const all = query.data ?? [];
    if (!focus) return all;
    if (focus === "pending") {
      return all.filter((r) => r.status !== "delivered" && r.status !== "cancelled");
    }
    return all.filter((r) => String(r.status ?? "").toLowerCase() === focus);
  }, [query.data, focus]);

  return (
    <div className="space-y-4">
      <PageHeader title="Deliveries" subtitle="Dispatch, POD, partial/failed delivery." />
      <Err error={error} />
      {focus ? (
        <p className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-100">
          Filtered by status focus: {focus} · {rows.length} row(s)
        </p>
      ) : null}
      <form
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (!branch) return;
          createPharmacyDelivery({ branchCode: branch.code, orderId, riderName })
            .then(() => invalidate())
            .catch((err: Error) => setError(err.message));
        }}
      >
        <select className={pharmacyInputClass} value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
          <option value="">Order</option>
          {(orders.data ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.orderNumber}
            </option>
          ))}
        </select>
        <input className={pharmacyInputClass} placeholder="Rider" value={riderName} onChange={(e) => setRiderName(e.target.value)} />
        <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
          Create delivery
        </button>
      </form>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "deliveryNumber", header: "Delivery#" },
          { key: "status", header: "Status" },
          { key: "riderName", header: "Rider", render: (r) => r.riderName ?? "—" },
          {
            key: "actions",
            header: "POD",
            render: (r) =>
              r.status !== "delivered" ? (
                <button
                  type="button"
                  className="text-sm text-emerald-600"
                  onClick={() =>
                    updatePharmacyDelivery(r.id, { status: "delivered", podNotes: "Delivered", collectedPkr: 0 })
                      .then(() => invalidate())
                      .catch((e: Error) => setError(e.message))
                  }
                >
                  Mark delivered
                </button>
              ) : (
                "Done"
              ),
          },
        ]}
        rows={rows}
      />
    </div>
  );
}

export function PharmacyCollectionsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [error, setError] = useState<string | null>(null);
  const [tradeCustomerId, setTradeCustomerId] = useState("");
  const [amountPkr, setAmountPkr] = useState(0);
  const customers = useQuery({ queryKey: ["pharmacy", "trade-customers"], queryFn: () => fetchPharmacyTradeCustomers(branch?.code) });
  const query = useQuery({
    queryKey: ["pharmacy", "collections", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyCollections(branch!.code),
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Collections" subtitle="Reduce trade customer outstanding / recovery." />
      <Err error={error} />
      <form
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (!branch) return;
          createPharmacyCollection({ branchCode: branch.code, tradeCustomerId, amountPkr, paymentMethod: "Cash" })
            .then(() => invalidate())
            .catch((err: Error) => setError(err.message));
        }}
      >
        <select className={pharmacyInputClass} value={tradeCustomerId} onChange={(e) => setTradeCustomerId(e.target.value)} required>
          <option value="">Customer</option>
          {(customers.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (Rs {Number(c.outstandingPkr ?? 0).toLocaleString()})
            </option>
          ))}
        </select>
        <input className={pharmacyInputClass} type="number" min={1} value={amountPkr} onChange={(e) => setAmountPkr(Number(e.target.value))} />
        <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
          Record collection
        </button>
      </form>
      <SimpleTable rowKey={(r) => r.id} columns={[{ key: "collectionNumber", header: "Collection#" }, { key: "amountPkr", header: "Amount", render: (r) => `Rs ${Number(r.amountPkr).toLocaleString()}` }, { key: "paymentMethod", header: "Method" }]} rows={query.data ?? []} />
    </div>
  );
}

export function PharmacyAssignmentsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [tradeCustomerId, setTradeCustomerId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [isOutstation, setIsOutstation] = useState(false);
  const employees = useQuery({ queryKey: ["pharmacy", "employees-picker"], queryFn: fetchPharmacyEmployeesPicker });
  const doctors = useQuery({
    queryKey: ["pharmacy", "doctors", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDoctors(branch!.code),
  });
  const customers = useQuery({ queryKey: ["pharmacy", "trade-customers"], queryFn: () => fetchPharmacyTradeCustomers(branch?.code) });
  const query = useQuery({
    queryKey: ["pharmacy", "assignments", branch?.code],
    queryFn: () => fetchPharmacyAssignments(branch?.code),
  });
  const visits = useQuery({ queryKey: ["pharmacy", "visits"], queryFn: fetchPharmacyVisits });
  const targets = useQuery({ queryKey: ["pharmacy", "targets"], queryFn: fetchPharmacyTargets });
  return (
    <div className="space-y-4">
      <PageHeader title="Field force" subtitle="Assignments, visits (instation/outstation), targets vs achievement." />
      <Err error={error} />
      <form
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          createPharmacyAssignment({
            branchCode: branch?.code,
            assignmentDate: new Date().toISOString().slice(0, 10),
            employeeId,
            tradeCustomerId: tradeCustomerId || undefined,
            doctorId: doctorId || undefined,
            taskType: "visit",
          })
            .then(() => invalidate())
            .catch((err: Error) => setError(err.message));
        }}
      >
        <select className={pharmacyInputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
          <option value="">Employee</option>
          {(employees.data ?? []).map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.employeeCode} — {emp.name}
            </option>
          ))}
        </select>
        <select className={pharmacyInputClass} value={tradeCustomerId} onChange={(e) => setTradeCustomerId(e.target.value)}>
          <option value="">Customer (optional)</option>
          {(customers.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={pharmacyInputClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">Doctor (optional)</option>
          {(doctors.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.code ?? ""} {d.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
          Assign
        </button>
      </form>
      <SimpleTable rowKey={(r) => r.id} columns={[{ key: "assignmentDate", header: "Date" }, { key: "status", header: "Status" }, { key: "taskType", header: "Task" }]} rows={query.data ?? []} />
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          createPharmacyVisit({
            employeeId,
            tradeCustomerId: tradeCustomerId || undefined,
            doctorId: doctorId || undefined,
            status: "completed",
            productive: true,
            isOutstation,
          })
            .then(() => invalidate())
            .catch((err: Error) => setError(err.message));
        }}
      >
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={isOutstation} onChange={(e) => setIsOutstation(e.target.checked)} />
          Outstation visit
        </label>
        <button type="submit" className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white dark:bg-slate-200 dark:text-slate-900">
          Log visit
        </button>
      </form>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "status", header: "Visit" },
          { key: "productive", header: "Productive", render: (r) => (r.productive ? "Yes" : "No") },
          { key: "isOutstation", header: "Station", render: (r) => (r.isOutstation ? "Outstation" : "Instation") },
        ]}
        rows={visits.data ?? []}
      />
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Targets vs achievement</h2>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "periodStart", header: "From" },
          { key: "periodEnd", header: "To" },
          { key: "targetSalesPkr", header: "Sales target", render: (r) => `Rs ${Number(r.targetSalesPkr).toLocaleString()}` },
          { key: "actualSalesPkr", header: "Sales actual", render: (r) => `Rs ${Number(r.actualSalesPkr ?? 0).toLocaleString()}` },
          { key: "targetCollectionPkr", header: "Collection target", render: (r) => `Rs ${Number(r.targetCollectionPkr).toLocaleString()}` },
          { key: "actualCollectionPkr", header: "Collection actual", render: (r) => `Rs ${Number(r.actualCollectionPkr ?? 0).toLocaleString()}` },
        ]}
        rows={targets.data ?? []}
      />
    </div>
  );
}

export function PharmacyWholesaleReturnsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [error, setError] = useState<string | null>(null);
  const [tradeCustomerId, setTradeCustomerId] = useState("");
  const [medicineId, setMedicineId] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const customers = useQuery({ queryKey: ["pharmacy", "trade-customers"], queryFn: () => fetchPharmacyTradeCustomers(branch?.code) });
  const meds = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });
  const query = useQuery({
    queryKey: ["pharmacy", "wholesale-returns", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyWholesaleReturns(branch!.code),
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Wholesale returns" subtitle="Return from retailer/pharmacy — restores stock and reduces outstanding (WRN-…)." />
      <Err error={error} />
      <form
        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          if (!branch) return;
          createPharmacyWholesaleReturn({
            branchCode: branch.code,
            tradeCustomerId,
            reason: "Wholesale return",
            lines: [{ medicineId, quantity: qty, unitPricePkr: unitPrice }],
          })
            .then(() => {
              invalidate();
              setError(null);
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select className={pharmacyInputClass} value={tradeCustomerId} onChange={(e) => setTradeCustomerId(e.target.value)} required>
            <option value="">Trade customer</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className={pharmacyInputClass} value={medicineId} onChange={(e) => setMedicineId(e.target.value)} required>
            <option value="">Medicine</option>
            {(meds.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input className={pharmacyInputClass} type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <input className={pharmacyInputClass} type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} placeholder="Unit PKR" />
        </div>
        <button type="submit" className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
          Post wholesale return
        </button>
      </form>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "returnNumber", header: "WRN#" },
          { key: "totalPkr", header: "Total", render: (r) => `Rs ${Number(r.totalPkr ?? 0).toLocaleString()}` },
          { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
          { key: "status", header: "Status" },
        ]}
        rows={query.data ?? []}
      />
    </div>
  );
}

export function PharmacyPricingPage(): JSX.Element {
  const invalidate = useInvalidatePharmacy();
  const [error, setError] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [schemeName, setSchemeName] = useState("");
  const [buyQty, setBuyQty] = useState(10);
  const [freeQty, setFreeQty] = useState(1);
  const lists = useQuery({ queryKey: ["pharmacy", "price-lists"], queryFn: fetchPharmacyPriceLists });
  const schemes = useQuery({ queryKey: ["pharmacy", "schemes"], queryFn: fetchPharmacySchemes });
  return (
    <div className="space-y-4">
      <PageHeader title="Pricing & schemes" subtitle="Price lists and Buy X Get Y schemes shared by POS and distribution." />
      <Err error={error} />
      <form
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          createPharmacyPriceList({ name: listName, priceLevel: "wholesale", items: [] })
            .then(() => {
              invalidate();
              setListName("");
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <input className={pharmacyInputClass} placeholder="Price list name" value={listName} onChange={(e) => setListName(e.target.value)} required />
        <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
          Add price list
        </button>
      </form>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs">{(r as { code?: string }).code ?? "—"}</span> },
          { key: "name", header: "List" },
          { key: "priceLevel", header: "Level" },
          { key: "status", header: "Status" },
        ]}
        rows={lists.data ?? []}
      />
      <form
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          createPharmacyScheme({ name: schemeName, schemeType: "buy_x_get_y", buyQty, freeQty })
            .then(() => {
              invalidate();
              setSchemeName("");
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <input className={pharmacyInputClass} placeholder="Scheme name" value={schemeName} onChange={(e) => setSchemeName(e.target.value)} required />
        <input className={pharmacyInputClass} type="number" value={buyQty} onChange={(e) => setBuyQty(Number(e.target.value))} />
        <input className={pharmacyInputClass} type="number" value={freeQty} onChange={(e) => setFreeQty(Number(e.target.value))} />
        <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white">
          Add Buy X Get Y
        </button>
      </form>
      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs">{(r as { code?: string }).code ?? "—"}</span> },
          { key: "name", header: "Scheme" },
          { key: "buyQty", header: "Buy" },
          { key: "freeQty", header: "Free" },
        ]}
        rows={schemes.data ?? []}
      />
    </div>
  );
}
