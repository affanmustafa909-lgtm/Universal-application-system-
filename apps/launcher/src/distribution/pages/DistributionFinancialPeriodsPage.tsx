import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { financeApi } from "../../pharmacy/api/pharmacy-finance";
import { usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistButton, DistDataTable, DistPageShell, DistPanel, distInputClass } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionFinancialPeriodsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const periods = useQuery({
    queryKey: ["distribution", "finance", "periods", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => financeApi.periods(branch!.code),
  });

  const create = useMutation({
    mutationFn: () =>
      financeApi.createPeriod({
        branchCode: branch!.code,
        name,
        startDate,
        endDate,
      }),
    onSuccess: () => {
      setName("");
      void qc.invalidateQueries({ queryKey: ["distribution", "finance", "periods"] });
    },
  });
  const close = useMutation({
    mutationFn: (id: string) => financeApi.closePeriod(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["distribution", "finance", "periods"] }),
  });
  const reopen = useMutation({
    mutationFn: (id: string) => financeApi.reopenPeriod(id, reason || "Authorized reopen"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["distribution", "finance", "periods"] }),
  });

  return (
    <DistPageShell
      title="Financial periods"
      subtitle="Closed periods reject new journal postings. Reopening is audited."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Finance", to: `${DIST}/finance` },
        { label: "Periods" },
      ]}
    >
      <DistPanel title="Open a period">
        <div className="grid gap-2 sm:grid-cols-4">
          <input className={distInputClass} placeholder="FY26-09" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={distInputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className={distInputClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <DistButton
            disabled={!name || !startDate || !endDate || create.isPending}
            onClick={() => create.mutate()}
          >
            Create
          </DistButton>
        </div>
        {create.isError ? <p className="mt-2 text-sm text-red-700">{(create.error as Error).message}</p> : null}
      </DistPanel>
      <DistPanel title="Periods">
        <label className="mb-2 block text-xs text-slate-500">
          Reopen reason
          <input className={`mt-1 ${distInputClass}`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <DistDataTable
          columns={[
            { key: "name", header: "Period" },
            { key: "startDate", header: "Start" },
            { key: "endDate", header: "End" },
            { key: "status", header: "Status" },
            {
              key: "actions",
              header: "",
              render: (r) =>
                r.status === "open" ? (
                  <DistButton variant="secondary" onClick={() => close.mutate(String(r.id))}>
                    Close
                  </DistButton>
                ) : (
                  <DistButton variant="secondary" onClick={() => reopen.mutate(String(r.id))}>
                    Reopen
                  </DistButton>
                ),
            },
          ]}
          rows={(periods.data ?? []) as Array<Record<string, unknown>>}
          rowKey={(r) => String(r.id)}
          loading={periods.isLoading}
          empty="No periods defined. Create an open period before posting if you want period control."
        />
      </DistPanel>
    </DistPageShell>
  );
}
