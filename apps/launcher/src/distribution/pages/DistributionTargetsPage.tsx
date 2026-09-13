import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { achievementLabel, fieldForceApi } from "../../pharmacy/api/pharmacy-field-force";
import { fetchPharmacyEmployeesPicker } from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, distLiveListOptions, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistMasterDrawer } from "../components/DistMasterDrawer";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
} from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionTargetsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([["distribution", "field-force"]]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState("0");
  const [collection, setCollection] = useState("0");
  const [visits, setVisits] = useState("0");

  const list = useQuery({
    queryKey: ["distribution", "field-force", "targets", branch?.code ?? "org"],
    queryFn: () => fieldForceApi.targets({}),
    ...distLiveListOptions,
  });
  const employees = useQuery({ queryKey: ["pharmacy", "employees-picker"], queryFn: fetchPharmacyEmployeesPicker });

  const empLabel = (id: unknown) => {
    const row = (employees.data ?? []).find((e) => e.id === id);
    return row ? `${row.employeeCode} — ${row.name}` : id ? String(id).slice(0, 8) : "—";
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const body = {
        branchCode: branch?.code,
        employeeId: employeeId || undefined,
        periodType: "monthly" as const,
        periodStart,
        periodEnd,
        targetSalesPkr: Number(sales) || 0,
        targetCollectionPkr: Number(collection) || 0,
        targetVisits: Number(visits) || 0,
        // Overlapping active target for same salesman/period → revise instead of 400.
        changeReason: "Saved from Targets screen",
      };
      try {
        return await fieldForceApi.createTarget(body);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Older servers still require an explicit revise — retry once with reason.
        if (/overlapping active target/i.test(msg)) {
          return fieldForceApi.createTarget({ ...body, changeReason: "Revised from Targets screen" });
        }
        throw e;
      }
    },
    onSuccess: async (row) => {
      setOpen(false);
      setErr(null);
      const num = (row as { targetNumber?: string })?.targetNumber;
      setInfo(num ? `Saved ${num}` : "Target saved");
      await invalidate();
      await list.refetch();
    },
    onError: (e: Error) => {
      setInfo(null);
      setErr(e.message);
    },
  });

  return (
    <DistPageShell
      title="Targets"
      subtitle="Salesman / territory / route targets. Achievement is Actual ÷ Target; zero target shows N/A."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Field Force", to: `${DIST}/field-force` },
        { label: "Targets" },
      ]}
      actions={<DistButton onClick={() => setOpen(true)}>New target</DistButton>}
      error={list.isError ? (list.error as Error).message : null}
    >
      {err ? <DistErrorBanner message={err} onRetry={() => setErr(null)} /> : null}
      {info ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {info}
        </p>
      ) : null}
      <DistDataTable
        loading={list.isLoading}
        rows={(list.data?.items ?? []) as Record<string, unknown>[]}
        rowKey={(r) => String(r.id)}
        empty="No targets"
        columns={[
          {
            key: "targetNumber",
            header: "TGT#",
            render: (r) => String(r.targetNumber ?? (r.id ? String(r.id).slice(0, 8) : "—")),
          },
          { key: "scopeType", header: "Scope" },
          {
            key: "employeeId",
            header: "Salesman",
            render: (r) => empLabel(r.employeeId),
          },
          { key: "periodStart", header: "From" },
          { key: "periodEnd", header: "To" },
          { key: "targetSalesPkr", header: "Sales tgt", render: (r) => formatPkr(Number(r.targetSalesPkr ?? 0)) },
          { key: "actualSalesPkr", header: "Sales act", render: (r) => formatPkr(Number(r.actualSalesPkr ?? 0)) },
          {
            key: "salesAchievementPct",
            header: "Sales %",
            render: (r) => achievementLabel(r.salesAchievementPct as number | null),
          },
          { key: "targetCollectionPkr", header: "Col tgt", render: (r) => formatPkr(Number(r.targetCollectionPkr ?? 0)) },
          {
            key: "collectionAchievementPct",
            header: "Col %",
            render: (r) => achievementLabel(r.collectionAchievementPct as number | null),
          },
          {
            key: "visitAchievementPct",
            header: "Visit %",
            render: (r) => achievementLabel(r.visitAchievementPct as number | null),
          },
        ]}
      />
      <DistMasterDrawer open={open} title="Create target" onClose={() => setOpen(false)}>
        {err ? <p className="mb-2 text-xs text-red-600 dark:text-red-400">{err}</p> : null}
        <label className="text-xs text-slate-500">
          Salesman
          <DistSelect className="mt-1" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Branch / unscoped</option>
            {(employees.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeCode} — {e.name}
              </option>
            ))}
          </DistSelect>
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">
            From
            <DistInput type="date" className="mt-1" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </label>
          <label className="text-xs text-slate-500">
            To
            <DistInput type="date" className="mt-1" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </label>
        </div>
        <label className="mt-2 block text-xs text-slate-500">
          Sales target (PKR)
          <DistInput className="mt-1" value={sales} onChange={(e) => setSales(e.target.value)} />
        </label>
        <label className="mt-2 block text-xs text-slate-500">
          Collection target (PKR)
          <DistInput className="mt-1" value={collection} onChange={(e) => setCollection(e.target.value)} />
        </label>
        <label className="mt-2 block text-xs text-slate-500">
          Visit target
          <DistInput className="mt-1" value={visits} onChange={(e) => setVisits(e.target.value)} />
        </label>
        <p className="mt-2 text-[11px] text-slate-500">
          Same salesman + overlapping dates updates the existing active target (revise).
        </p>
        <DistButton className="mt-3" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          {createMut.isPending ? "Saving…" : "Save"}
        </DistButton>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
