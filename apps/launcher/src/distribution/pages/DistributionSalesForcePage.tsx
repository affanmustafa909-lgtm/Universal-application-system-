import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  createPharmacySalesForce,
  fetchPharmacyAreas,
  fetchPharmacyCities,
  fetchPharmacyEmployeesPicker,
  fetchPharmacySalesForce,
  fetchPharmacyTerritories,
} from "../../pharmacy/api/pharmacy-erp";
import { setSalesForceStatus, updateSalesForce } from "../../pharmacy/api/pharmacy-masters";
import { useInvalidatePharmacy } from "../../pharmacy/hooks/usePharmacy";
import {
  DistButton,
  DistDataTable,
  DistPageShell,
  DistPanel,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

type SfRow = {
  id: string;
  employeeId: string;
  fieldRole?: string;
  territoryId?: string | null;
  cityId?: string | null;
  areaId?: string | null;
  status: string;
  employeeName?: string;
  employeeCode?: string;
};

export function DistributionSalesForcePage(): JSX.Element {
  const invalidate = useInvalidatePharmacy([["pharmacy", "sales-force"]]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    fieldRole: "Salesman",
    territoryId: "",
    cityId: "",
    areaId: "",
  });
  const [editing, setEditing] = useState<SfRow | null>(null);

  const list = useQuery({ queryKey: ["pharmacy", "sales-force"], queryFn: fetchPharmacySalesForce });
  const employees = useQuery({
    queryKey: ["pharmacy", "employees-picker"],
    queryFn: fetchPharmacyEmployeesPicker,
    staleTime: 60_000,
  });
  const territories = useQuery({
    queryKey: ["pharmacy", "territories"],
    queryFn: fetchPharmacyTerritories,
    staleTime: 60_000,
  });
  const cities = useQuery({ queryKey: ["pharmacy", "cities"], queryFn: fetchPharmacyCities, staleTime: 60_000 });
  const areas = useQuery({ queryKey: ["pharmacy", "areas"], queryFn: fetchPharmacyAreas, staleTime: 60_000 });

  const empName = (id: string) => {
    const e = (employees.data ?? []).find((x) => x.id === id);
    return e ? `${e.employeeCode} — ${e.name}` : id;
  };
  const labelOf = (rows: { id: string; name: string }[] | undefined, id?: string | null) =>
    id ? rows?.find((r) => r.id === id)?.name ?? id : "—";

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        fieldRole: form.fieldRole,
        territoryId: form.territoryId || null,
        cityId: form.cityId || null,
        areaId: form.areaId || null,
      };
      if (editing) return updateSalesForce(editing.id, body);
      return createPharmacySalesForce({ employeeId: form.employeeId, ...body });
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setForm({ employeeId: "", fieldRole: "Salesman", territoryId: "", cityId: "", areaId: "" });
      setError(null);
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: (r: SfRow) => setSalesForceStatus(r.id, r.status === "active" ? "inactive" : "active"),
    onSuccess: () => {
      invalidate();
      void list.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const rows = (list.data ?? []) as SfRow[];

  return (
    <DistPageShell
      title="Sales force"
      subtitle="Assign territory / city / area / role to field employees."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Sales force" },
      ]}
      error={error}
    >
      <DistPanel title={editing ? "Edit assignment" : "Assign employee"}>
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {!editing ? (
            <label className="text-xs text-slate-500">
              Employee
              <DistSelect
                className="mt-1"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {(employees.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeCode} — {e.name}
                  </option>
                ))}
              </DistSelect>
            </label>
          ) : null}
          <label className="text-xs text-slate-500">
            Role
            <DistSelect
              className="mt-1"
              value={form.fieldRole}
              onChange={(e) => setForm({ ...form, fieldRole: e.target.value })}
            >
              <option>Salesman</option>
              <option>Supervisor</option>
              <option>ASM</option>
              <option>RSM</option>
            </DistSelect>
          </label>
          <label className="text-xs text-slate-500">
            Territory
            <DistSelect
              className="mt-1"
              value={form.territoryId}
              onChange={(e) => setForm({ ...form, territoryId: e.target.value })}
            >
              <option value="">—</option>
              {(territories.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </DistSelect>
          </label>
          <label className="text-xs text-slate-500">
            City
            <DistSelect
              className="mt-1"
              value={form.cityId}
              onChange={(e) => setForm({ ...form, cityId: e.target.value, areaId: "" })}
            >
              <option value="">—</option>
              {(cities.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </DistSelect>
          </label>
          <label className="text-xs text-slate-500">
            Area
            <DistSelect
              className="mt-1"
              value={form.areaId}
              onChange={(e) => setForm({ ...form, areaId: e.target.value })}
            >
              <option value="">—</option>
              {(areas.data ?? [])
                .filter((a) => !form.cityId || (a as { cityId?: string }).cityId === form.cityId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </DistSelect>
          </label>
          <div className="flex items-end gap-2">
            <DistButton type="submit" disabled={save.isPending || (!editing && !form.employeeId)}>
              Save
            </DistButton>
            {editing ? (
              <DistButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setForm({ employeeId: "", fieldRole: "Salesman", territoryId: "", cityId: "", areaId: "" });
                }}
              >
                Cancel
              </DistButton>
            ) : null}
          </div>
        </form>
      </DistPanel>

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        empty="No sales-force profiles"
        rows={rows}
        columns={[
          {
            key: "employee",
            header: "Employee",
            render: (r) => (
              <Link className="font-semibold text-cyan-700" to={`/pops/distribution/sales-force/${r.employeeId}`}>
                {r.employeeName ?? empName(r.employeeId)}
              </Link>
            ),
          },
          { key: "fieldRole", header: "Role", render: (r) => r.fieldRole ?? "—" },
          {
            key: "territory",
            header: "Territory",
            render: (r) => labelOf(territories.data, r.territoryId),
          },
          { key: "city", header: "City", render: (r) => labelOf(cities.data, r.cityId) },
          { key: "area", header: "Area", render: (r) => labelOf(areas.data, r.areaId) },
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
                      employeeId: r.employeeId,
                      fieldRole: r.fieldRole ?? "Salesman",
                      territoryId: r.territoryId ?? "",
                      cityId: r.cityId ?? "",
                      areaId: r.areaId ?? "",
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
    </DistPageShell>
  );
}
