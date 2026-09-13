import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { deliveryApi, type DeliveryOrder } from "../../pharmacy/api/pharmacy-delivery";
import { fetchPharmacyRoutes } from "../../pharmacy/api/pharmacy-erp";
import { useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import { errorMessage } from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";
import { customerDisplayName, looksLikeUuid } from "../lib/customerDisplay";

const DIST = "/pops/distribution";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function DistributionDispatchPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([["distribution", "delivery"]]);

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [riderName, setRiderName] = useState("");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const list = useQuery({
    queryKey: ["distribution", "delivery", "dispatch", branchCode, debounced, page, pageSize],
    enabled: Boolean(branchCode),
    queryFn: () =>
      deliveryApi.listOrders({
        branchCode: branchCode!,
        status: "ready",
        q: debounced || undefined,
        page,
        pageSize,
      }),
  });

  const drivers = useQuery({
    queryKey: ["distribution", "delivery", "drivers", branchCode],
    enabled: bulkOpen,
    queryFn: () => deliveryApi.listDrivers({ branchCode }),
  });

  const vehicles = useQuery({
    queryKey: ["distribution", "delivery", "vehicles", branchCode],
    enabled: bulkOpen,
    queryFn: () => deliveryApi.listVehicles({ branchCode }),
  });

  const routes = useQuery({
    queryKey: ["pharmacy", "routes"],
    enabled: bulkOpen,
    queryFn: fetchPharmacyRoutes,
  });

  const rows = list.data?.items ?? [];

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk() {
    if (!selected.size) return;
    setPosting(true);
    setActionError(null);
    try {
      const ids = [...selected];
      for (const id of ids) {
        await deliveryApi.assign(id, {
          driverId: driverId || undefined,
          vehicleId: vehicleId || undefined,
          routeId: routeId || undefined,
          riderName: riderName || undefined,
        });
        await deliveryApi.dispatch(id, {
          driverId: driverId || undefined,
          vehicleId: vehicleId || undefined,
          routeId: routeId || undefined,
          riderName: riderName || undefined,
        });
      }
      setBulkOpen(false);
      setSelected(new Set());
      setRiderName("");
      setDriverId("");
      setVehicleId("");
      setRouteId("");
      invalidate();
      void list.refetch();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  const dispatchOne = useMutation({
    mutationFn: async (row: DeliveryOrder) => {
      await deliveryApi.dispatch(row.id, {
        riderName: row.riderName ?? undefined,
        driverId: row.driverId ?? undefined,
        routeId: row.routeId ?? undefined,
      });
    },
    onSuccess: () => {
      setActionError(null);
      invalidate();
      void list.refetch();
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  return (
    <DistPageShell
      title="Dispatch board"
      subtitle="Ready deliveries — assign driver/route and dispatch in bulk."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Deliveries", to: `${DIST}/delivery` },
        { label: "Dispatch" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/deliveries`}>
            <DistButton variant="ghost">All deliveries</DistButton>
          </Link>
          <DistButton
            disabled={!selected.size}
            onClick={() => setBulkOpen(true)}
          >
            Assign + dispatch ({selected.size})
          </DistButton>
        </div>
      }
      error={!branch ? "Select a branch to load dispatch queue." : null}
    >
      {actionError ? <DistErrorBanner message={actionError} onRetry={() => setActionError(null)} /> : null}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 min-w-[14rem]"
            placeholder="Delivery #, rider, customer…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rows={rows}
        rowKey={(r) => r.id}
        empty={debounced ? "No ready deliveries match search" : "Nothing ready to dispatch"}
        columns={[
          {
            key: "pick",
            header: (
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all"
              />
            ),
            render: (r) => (
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleOne(r.id)}
                aria-label={`Select ${r.deliveryNumber}`}
                onClick={(e) => e.stopPropagation()}
              />
            ),
          },
          { key: "deliveryNumber", header: "Delivery#" },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} />,
          },
          {
            key: "customer",
            header: "Customer",
            render: (r) => customerDisplayName(r),
          },
          {
            key: "source",
            header: "Order / Invoice",
            render: (r) => {
              const order = r.orderNumber && !looksLikeUuid(r.orderNumber) ? r.orderNumber : null;
              const inv = r.invoiceNumber && !looksLikeUuid(r.invoiceNumber) ? r.invoiceNumber : null;
              if (order && inv) return `${order} · ${inv}`;
              return order ?? inv ?? "—";
            },
          },
          {
            key: "rider",
            header: "Rider",
            render: (r) => {
              const name = r.driverName ?? r.riderName;
              return name && !looksLikeUuid(name) ? name : "—";
            },
          },
          {
            key: "route",
            header: "Route",
            render: (r) => {
              const name = r.routeName;
              return name && !looksLikeUuid(name) ? name : "—";
            },
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <button
                type="button"
                className="text-xs font-semibold text-cyan-700 disabled:opacity-50 dark:text-cyan-400"
                disabled={dispatchOne.isPending || posting}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatchOne.mutate(r);
                }}
              >
                Dispatch
              </button>
            ),
          },
        ]}
      />

      {list.data ? (
        <DistPagination
          page={list.data.page}
          pageSize={list.data.pageSize}
          total={list.data.total}
          totalPages={list.data.totalPages}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      ) : null}

      <DistMasterDrawer
        open={bulkOpen}
        title={`Bulk assign + dispatch (${selected.size})`}
        onClose={() => !posting && setBulkOpen(false)}
        footer={
          <DistButton disabled={posting || !selected.size} onClick={() => void runBulk()}>
            {posting ? "Posting…" : "Assign & dispatch"}
          </DistButton>
        }
      >
        <div className="space-y-3">
          <Field label="Rider name">
            <DistInput value={riderName} onChange={(e) => setRiderName(e.target.value)} />
          </Field>
          <Field label="Driver">
            <DistSelect value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">None</option>
              {(drivers.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </DistSelect>
          </Field>
          <Field label="Vehicle">
            <DistSelect value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">None</option>
              {(vehicles.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.plateNumber ? ` (${v.plateNumber})` : ""}
                </option>
              ))}
            </DistSelect>
          </Field>
          <Field label="Route">
            <DistSelect value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              <option value="">No route</option>
              {((routes.data ?? []) as { id: string; name?: string; code?: string }[]).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name ?? r.code ?? r.id}
                </option>
              ))}
            </DistSelect>
          </Field>
          <p className="text-xs text-slate-500">
            Each selected ticket is assigned then dispatched. On failure the form stays open so you can retry.
          </p>
        </div>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
