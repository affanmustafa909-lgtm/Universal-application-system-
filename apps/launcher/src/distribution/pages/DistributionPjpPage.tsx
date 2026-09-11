import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { fieldForceApi } from "../../pharmacy/api/pharmacy-field-force";
import { fetchPharmacyEmployeesPicker, fetchPharmacyRoutes, fetchPharmacyTradeCustomers } from "../../pharmacy/api/pharmacy-erp";
import { useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistMasterDrawer } from "../components/DistMasterDrawer";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionPjpPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([["distribution", "field-force"]]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState("weekly");
  const [day, setDay] = useState("1");
  const [selected, setSelected] = useState<string[]>([]);
  const [genDate, setGenDate] = useState(new Date().toISOString().slice(0, 10));

  const list = useQuery({
    queryKey: ["distribution", "field-force", "pjp", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fieldForceApi.pjp({ branchCode: branch!.code }),
  });
  const employees = useQuery({ queryKey: ["pharmacy", "employees-picker"], queryFn: fetchPharmacyEmployeesPicker });
  const routes = useQuery({ queryKey: ["pharmacy", "routes"], queryFn: fetchPharmacyRoutes });
  const customers = useQuery({
    queryKey: ["pharmacy", "trade-customers", branch?.code],
    enabled: open,
    queryFn: () => fetchPharmacyTradeCustomers(branch?.code),
  });

  const createMut = useMutation({
    mutationFn: () =>
      fieldForceApi.createPjp({
        branchCode: branch?.code,
        name,
        employeeId,
        routeId: routeId || undefined,
        effectiveFrom: from,
        frequency,
        lines: selected.map((tradeCustomerId, i) => ({
          tradeCustomerId,
          routeId: routeId || undefined,
          dayOfWeek: Number(day),
          sequenceNo: i + 1,
        })),
      }),
    onSuccess: () => {
      setOpen(false);
      setSelected([]);
      invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const genMut = useMutation({
    mutationFn: () => fieldForceApi.generateVisits({ date: genDate, branchCode: branch?.code }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <DistPageShell
      title="PJP"
      subtitle="Permanent journey plan — versioned templates that generate today's visits."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Field Force", to: `${DIST}/field-force` },
        { label: "PJP" },
      ]}
      actions={<DistButton onClick={() => setOpen(true)}>New PJP</DistButton>}
    >
      {err ? <DistErrorBanner message={err} onRetry={() => setErr(null)} /> : null}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800">
        <label className="text-xs text-slate-500">
          Generate for
          <DistInput type="date" className="mt-1" value={genDate} onChange={(e) => setGenDate(e.target.value)} />
        </label>
        <DistButton onClick={() => genMut.mutate()} disabled={genMut.isPending}>
          Generate today's visits
        </DistButton>
        <Link to={`${DIST}/visits?date=${genDate}`} className="text-sm font-semibold text-cyan-700">
          Open visits →
        </Link>
      </div>
      <DistDataTable
        loading={list.isLoading}
        rows={(list.data?.items ?? []) as Record<string, unknown>[]}
        rowKey={(r) => String(r.id)}
        empty="No journey plans yet"
        columns={[
          { key: "pjpNumber", header: "PJP#" },
          { key: "name", header: "Name" },
          { key: "employeeName", header: "Salesman", render: (r) => String(r.employeeName ?? "") },
          { key: "frequency", header: "Frequency" },
          { key: "version", header: "Ver" },
          { key: "status", header: "Status", render: (r) => <DistStatusBadge status={String(r.status)} /> },
          { key: "lineCount", header: "Stops" },
          { key: "effectiveFrom", header: "From" },
        ]}
      />

      <DistMasterDrawer open={open} title="New PJP" onClose={() => setOpen(false)} widthClass="max-w-lg">
        <label className="text-xs text-slate-500">
          Name
          <DistInput className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mt-2 block text-xs text-slate-500">
          Salesman
          <DistSelect className="mt-1" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select</option>
            {(employees.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeCode} — {e.name}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="mt-2 block text-xs text-slate-500">
          Route (optional)
          <DistSelect className="mt-1" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">None</option>
            {(routes.data ?? []).map((r: { id: string; name: string; code?: string }) => (
              <option key={r.id} value={r.id}>
                {r.code} {r.name}
              </option>
            ))}
          </DistSelect>
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            Effective from
            <DistInput type="date" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs text-slate-500">
            Frequency
            <DistSelect className="mt-1" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </DistSelect>
          </label>
        </div>
        <label className="mt-2 block text-xs text-slate-500">
          Visit weekday (0=Sun)
          <DistSelect className="mt-1" value={day} onChange={(e) => setDay(e.target.value)}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <option key={d} value={String(i)}>
                {d}
              </option>
            ))}
          </DistSelect>
        </label>
        <div className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 p-2 text-xs">
          {(customers.data ?? []).map((c: { id: string; name: string; code?: string }) => (
            <label key={c.id} className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id)))
                }
              />
              {c.code} {c.name}
            </label>
          ))}
        </div>
        <DistButton className="mt-3" disabled={!name || !employeeId || selected.length === 0 || createMut.isPending} onClick={() => createMut.mutate()}>
          Save PJP
        </DistButton>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
