import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { achievementLabel, fieldForceApi } from "../../pharmacy/api/pharmacy-field-force";
import { fetchPharmacyEmployeesPicker } from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
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
  const [employeeId, setEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState("0");
  const [collection, setCollection] = useState("0");
  const [visits, setVisits] = useState("0");

  const list = useQuery({
    queryKey: ["distribution", "field-force", "targets", branch?.code],
    queryFn: () => fieldForceApi.targets({ branchCode: branch?.code }),
  });
  const employees = useQuery({ queryKey: ["pharmacy", "employees-picker"], queryFn: fetchPharmacyEmployeesPicker });

  const createMut = useMutation({
    mutationFn: () =>
      fieldForceApi.createTarget({
        branchCode: branch?.code,
        employeeId: employeeId || undefined,
        periodType: "monthly",
        periodStart,
        periodEnd,
        targetSalesPkr: Number(sales) || 0,
        targetCollectionPkr: Number(collection) || 0,
        targetVisits: Number(visits) || 0,
      }),
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => setErr(e.message),
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
    >
      {err ? <DistErrorBanner message={err} onRetry={() => setErr(null)} /> : null}
      <DistDataTable
        loading={list.isLoading}
        rows={(list.data?.items ?? []) as Record<string, unknown>[]}
        rowKey={(r) => String(r.id)}
        empty="No targets"
        columns={[
          { key: "targetNumber", header: "TGT#" },
          { key: "scopeType", header: "Scope" },
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
        <DistButton className="mt-3" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          Save
        </DistButton>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
