import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fieldForceApi } from "../../pharmacy/api/pharmacy-field-force";
import { fetchPharmacyRoutes, fetchPharmacyTradeCustomers } from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistButton, DistDataTable, DistErrorBanner, DistPageShell, DistSelect } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionRoutePlanPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([["distribution", "field-force"]]);
  const [routeId, setRouteId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const routes = useQuery({ queryKey: ["pharmacy", "routes"], queryFn: fetchPharmacyRoutes });
  const detail = useQuery({
    queryKey: ["distribution", "field-force", "route", routeId],
    enabled: Boolean(routeId),
    queryFn: () => fieldForceApi.route(routeId),
  });
  const customers = useQuery({
    queryKey: ["pharmacy", "trade-customers", branch?.code],
    enabled: Boolean(routeId),
    queryFn: () => fetchPharmacyTradeCustomers(branch?.code),
  });

  const addMut = useMutation({
    mutationFn: () => fieldForceApi.addRouteCustomer(routeId, { tradeCustomerId: customerId }),
    onSuccess: () => {
      setCustomerId("");
      invalidate();
      void detail.refetch();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const stops = ((detail.data?.customers ?? []) as Record<string, unknown>[]);

  const move = async (index: number, dir: -1 | 1) => {
    const ids = stops.map((s) => String(s.tradeCustomerId));
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    const tmp = ids[index]!;
    ids[index] = ids[j]!;
    ids[j] = tmp;
    try {
      await fieldForceApi.reorderRoute(routeId, ids);
      void detail.refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reorder failed");
    }
  };

  return (
    <DistPageShell
      title="Route plan"
      subtitle="Customer visit sequence on an existing Geography route. Sequence is persisted — not GPS-optimized."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Field Force", to: `${DIST}/field-force` },
        { label: "Routes" },
      ]}
    >
      {err ? <DistErrorBanner message={err} onRetry={() => setErr(null)} /> : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Route
          <DistSelect className="mt-1 min-w-[16rem]" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">Select a route from Geography</option>
            {(routes.data ?? []).map((r: { id: string; name: string; code?: string }) => (
              <option key={r.id} value={r.id}>
                {r.code} {r.name}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          Add customer
          <DistSelect className="mt-1 min-w-[16rem]" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Customer</option>
            {(customers.data ?? []).map((c: { id: string; name: string; code?: string }) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </DistSelect>
        </label>
        <DistButton disabled={!routeId || !customerId || addMut.isPending} onClick={() => addMut.mutate()}>
          Add stop
        </DistButton>
      </div>
      <DistDataTable
        loading={detail.isLoading}
        rows={stops}
        rowKey={(r) => String(r.id)}
        empty={routeId ? "No customers on this route" : "Select a route"}
        columns={[
          { key: "sequenceNo", header: "#" },
          { key: "customerCode", header: "Code" },
          { key: "customerName", header: "Customer" },
          { key: "priority", header: "Priority" },
          { key: "outstandingPkr", header: "Outstanding", render: (r) => formatPkr(Number(r.outstandingPkr ?? 0)) },
          {
            key: "move",
            header: "Order",
            render: (r) => {
              const i = stops.findIndex((s) => s.id === r.id);
              return (
                <div className="flex gap-1">
                  <DistButton variant="ghost" onClick={() => void move(i, -1)}>
                    Up
                  </DistButton>
                  <DistButton variant="ghost" onClick={() => void move(i, 1)}>
                    Down
                  </DistButton>
                </div>
              );
            },
          },
        ]}
      />
    </DistPageShell>
  );
}
