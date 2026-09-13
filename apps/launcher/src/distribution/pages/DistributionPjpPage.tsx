import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { fieldForceApi } from "../../pharmacy/api/pharmacy-field-force";
import { fetchPharmacyEmployeesPicker, fetchPharmacyRoutes, fetchPharmacyTradeCustomers } from "../../pharmacy/api/pharmacy-erp";
import { useInvalidatePharmacy, usePharmacyAccess, distLiveListOptions } from "../../pharmacy/hooks/usePharmacy";
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
  const [day, setDay] = useState(String(new Date().getDay()));
  const [selected, setSelected] = useState<string[]>([]);
  const [genDate, setGenDate] = useState(new Date().toISOString().slice(0, 10));
  const [info, setInfo] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["distribution", "field-force", "pjp", branch?.code ?? "org"],
    enabled: Boolean(branch?.code),
    // List org-wide so legacy rows saved without branchId still appear.
    // Create always stamps the current branch.
    queryFn: () => fieldForceApi.pjp({}),
    ...distLiveListOptions,
  });
  const employees = useQuery({ queryKey: ["pharmacy", "employees-picker"], queryFn: fetchPharmacyEmployeesPicker });
  const routes = useQuery({ queryKey: ["pharmacy", "routes"], queryFn: fetchPharmacyRoutes });
  const customers = useQuery({
    queryKey: ["pharmacy", "trade-customers", branch?.code],
    enabled: open,
    queryFn: () => fetchPharmacyTradeCustomers(branch?.code),
  });

  const createMut = useMutation({
    mutationFn: () => {
      if (!branch?.code) throw new Error("Select a branch before saving a PJP");
      return fieldForceApi.createPjp({
        branchCode: branch.code,
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
      });
    },
    onSuccess: async () => {
      setOpen(false);
      setSelected([]);
      setErr(null);
      await invalidate();
      await list.refetch();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const genMut = useMutation({
    mutationFn: () => {
      if (!branch?.code) throw new Error("Select a branch before generating visits");
      return fieldForceApi.generateVisits({ date: genDate, branchCode: branch.code }) as Promise<{
        created?: number;
        skipped?: number;
        message?: string;
      }>;
    },
    onSuccess: async (res) => {
      const msg =
        res?.message ||
        `Created ${res?.created ?? 0} visit(s)` +
          (res?.skipped ? ` (skipped ${res.skipped} duplicate(s))` : "");
      setInfo(msg);
      setErr(null);
      await invalidate();
    },
    onError: (e: Error) => {
      setInfo(null);
      setErr(e.message);
    },
  });

  return (
    <DistPageShell
      title="PJP / Sale plan"
      subtitle="Permanent journey plan — versioned templates that generate today's visits."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Field Force", to: `${DIST}/field-force` },
        { label: "PJP" },
      ]}
      actions={<DistButton onClick={() => setOpen(true)}>New PJP</DistButton>}
      error={!branch ? "Select a branch." : list.isError ? (list.error as Error).message : null}
    >
      {err ? <DistErrorBanner message={err} onRetry={() => setErr(null)} /> : null}
      {info ? (
        <p className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-100">
          {info}{" "}
          <Link to={`${DIST}/visits?date=${genDate}`} className="font-semibold underline">
            Open visits
          </Link>
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800">
        <label className="text-xs text-slate-500">
          Generate for
          <DistInput type="date" className="mt-1" value={genDate} onChange={(e) => setGenDate(e.target.value)} />
        </label>
        <DistButton onClick={() => genMut.mutate()} disabled={genMut.isPending || !branch?.code}>
          Generate visits
        </DistButton>
        <Link to={`${DIST}/visits?date=${genDate}`} className="text-sm font-semibold text-cyan-700">
          Open visits →
        </Link>
      </div>
      <DistDataTable
        loading={list.isLoading}
        rows={(list.data?.items ?? []) as Record<string, unknown>[]}
        rowKey={(r) => String(r.id)}
        empty={branch?.code ? "No journey plans yet" : "Select a branch to load plans"}
        columns={[
          { key: "pjpNumber", header: "PJP#" },
          { key: "name", header: "Name" },
          { key: "employeeName", header: "Salesman", render: (r) => String(r.employeeName ?? "—") },
          { key: "frequency", header: "Frequency" },
          { key: "version", header: "Ver" },
          { key: "status", header: "Status", render: (r) => <DistStatusBadge status={String(r.status)} /> },
          { key: "lineCount", header: "Stops" },
          { key: "effectiveFrom", header: "From" },
        ]}
      />

      <DistMasterDrawer open={open} title="New PJP" onClose={() => setOpen(false)} widthClass="max-w-lg">
        {!branch?.code ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">Select a branch in the header before creating a PJP.</p>
        ) : null}
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
        <DistButton
          className="mt-3"
          disabled={!branch?.code || !name || !employeeId || selected.length === 0 || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          Save PJP
        </DistButton>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
