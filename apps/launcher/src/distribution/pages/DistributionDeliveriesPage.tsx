import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  deliveryApi,
  type DeliveryOrder,
  type PodOutcome,
} from "../../pharmacy/api/pharmacy-delivery";
import {
  fetchPharmacyDistInvoices,
  fetchPharmacyDistOrders,
  fetchPharmacyRoutes,
} from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
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

const DIST = "/pops/distribution";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending / open" },
  { value: "assigned", label: "Assigned" },
  { value: "dispatched", label: "Dispatched" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
  { value: "refused", label: "Refused" },
];

function canPod(status: string): boolean {
  const s = status.toLowerCase();
  return !["delivered", "cancelled", "refused"].includes(s);
}

function canDispatch(status: string): boolean {
  const s = status.toLowerCase();
  return ["pending", "assigned", "ready", "packed"].includes(s);
}

export function DistributionDeliveriesPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([["distribution", "delivery"]]);
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get("status") ?? searchParams.get("focus") ?? "";
  const [status, setStatus] = useState(statusParam);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [actionError, setActionError] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [sourceType, setSourceType] = useState<"order" | "invoice">("order");
  const [orderId, setOrderId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [riderName, setRiderName] = useState("");
  const [routeId, setRouteId] = useState("");

  const [assignRow, setAssignRow] = useState<DeliveryOrder | null>(null);
  const [assignDriver, setAssignDriver] = useState("");
  const [assignVehicle, setAssignVehicle] = useState("");
  const [assignRoute, setAssignRoute] = useState("");
  const [assignRider, setAssignRider] = useState("");

  const [podRow, setPodRow] = useState<DeliveryOrder | null>(null);
  const [podStatus, setPodStatus] = useState<PodOutcome>("delivered");
  const [podNotes, setPodNotes] = useState("");
  const [podReason, setPodReason] = useState("");
  const [podCollected, setPodCollected] = useState(0);
  const [receiverName, setReceiverName] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setStatus(statusParam);
    setPage(1);
  }, [statusParam]);

  const list = useQuery({
    queryKey: ["distribution", "delivery", "orders", branchCode, status, debounced, page, pageSize],
    enabled: Boolean(branchCode),
    queryFn: () =>
      deliveryApi.listOrders({
        branchCode: branchCode!,
        status: status || undefined,
        q: debounced || undefined,
        page,
        pageSize,
      }),
  });

  const orders = useQuery({
    queryKey: ["pharmacy", "dist-orders", branchCode],
    enabled: Boolean(branchCode) && composerOpen,
    queryFn: () => fetchPharmacyDistOrders(branchCode!),
  });

  const invoices = useQuery({
    queryKey: ["pharmacy", "dist-invoices", branchCode],
    enabled: Boolean(branchCode) && composerOpen && sourceType === "invoice",
    queryFn: () => fetchPharmacyDistInvoices(branchCode!),
  });

  const routes = useQuery({
    queryKey: ["pharmacy", "routes"],
    enabled: composerOpen || Boolean(assignRow),
    queryFn: fetchPharmacyRoutes,
  });

  const drivers = useQuery({
    queryKey: ["distribution", "delivery", "drivers", branchCode],
    enabled: Boolean(assignRow),
    queryFn: () => deliveryApi.listDrivers({ branchCode }),
  });

  const vehicles = useQuery({
    queryKey: ["distribution", "delivery", "vehicles", branchCode],
    enabled: Boolean(assignRow),
    queryFn: () => deliveryApi.listVehicles({ branchCode }),
  });

  const createMut = useMutation({
    mutationFn: () =>
      deliveryApi.createOrder({
        branchCode: branchCode!,
        orderId: sourceType === "order" ? orderId || undefined : undefined,
        invoiceId: sourceType === "invoice" ? invoiceId || undefined : undefined,
        riderName: riderName || undefined,
        routeId: routeId || undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      setComposerOpen(false);
      setOrderId("");
      setInvoiceId("");
      setRiderName("");
      setRouteId("");
      invalidate();
      void list.refetch();
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const assignMut = useMutation({
    mutationFn: () =>
      deliveryApi.assign(assignRow!.id, {
        driverId: assignDriver || undefined,
        vehicleId: assignVehicle || undefined,
        routeId: assignRoute || undefined,
        riderName: assignRider || undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      setAssignRow(null);
      invalidate();
      void list.refetch();
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const dispatchMut = useMutation({
    mutationFn: (row: DeliveryOrder) =>
      deliveryApi.dispatch(row.id, {
        riderName: row.riderName ?? undefined,
        driverId: row.driverId ?? undefined,
        routeId: row.routeId ?? undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      invalidate();
      void list.refetch();
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const podMut = useMutation({
    mutationFn: () =>
      deliveryApi.pod(podRow!.id, {
        status: podStatus,
        podNotes: podNotes || undefined,
        failedReason: podStatus === "failed" || podStatus === "refused" ? podReason : undefined,
        collectedPkr: podCollected || 0,
        receiverName: receiverName || undefined,
        signatureText: receiverName || undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      setPodRow(null);
      setPodNotes("");
      setPodReason("");
      setPodCollected(0);
      setReceiverName("");
      setPodStatus("delivered");
      invalidate();
      void list.refetch();
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const rows = list.data?.items ?? [];

  const readyOrders = useMemo(() => {
    const all = (orders.data ?? []) as { id: string; orderNumber?: string; status?: string }[];
    return all.filter((o) => {
      const s = String(o.status ?? "").toLowerCase();
      return !["delivered", "cancelled"].includes(s);
    });
  }, [orders.data]);

  return (
    <DistPageShell
      title="Deliveries"
      subtitle="Create from order/invoice, assign driver/route, dispatch, and capture POD."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Deliveries", to: `${DIST}/delivery` },
        { label: "List" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/delivery`}>
            <DistButton variant="ghost">Dashboard</DistButton>
          </Link>
          <Link to={`${DIST}/dispatch`}>
            <DistButton variant="secondary">Dispatch board</DistButton>
          </Link>
          <DistButton onClick={() => setComposerOpen(true)}>New delivery</DistButton>
        </div>
      }
      error={!branch ? "Select a branch to load deliveries." : null}
    >
      {actionError ? <DistErrorBanner message={actionError} onRetry={() => setActionError(null)} /> : null}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1 min-w-[10rem]"
            value={status}
            onChange={(e) => {
              const next = e.target.value;
              setStatus(next);
              setPage(1);
              const sp = new URLSearchParams(searchParams);
              if (next) sp.set("status", next);
              else {
                sp.delete("status");
                sp.delete("focus");
              }
              setSearchParams(sp, { replace: true });
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </DistSelect>
        </label>
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
        empty={debounced || status ? "No deliveries match filters" : "No deliveries yet"}
        columns={[
          { key: "deliveryNumber", header: "Delivery#" },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} />,
          },
          {
            key: "source",
            header: "Order / Invoice",
            render: (r) => r.orderNumber ?? r.invoiceNumber ?? r.orderId ?? r.invoiceId ?? "—",
          },
          {
            key: "customer",
            header: "Customer",
            render: (r) => r.tradeCustomerName ?? "—",
          },
          {
            key: "rider",
            header: "Rider / Driver",
            render: (r) => r.driverName ?? r.riderName ?? "—",
          },
          {
            key: "route",
            header: "Route",
            render: (r) => r.routeName ?? r.routeId ?? "—",
          },
          {
            key: "collected",
            header: "Collected",
            render: (r) => (r.collectedPkr ? formatPkr(Number(r.collectedPkr)) : "—"),
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                {canDispatch(r.status) ? (
                  <>
                    <button
                      type="button"
                      className="text-xs font-semibold text-cyan-700 dark:text-cyan-400"
                      onClick={() => {
                        setAssignRow(r);
                        setAssignDriver(r.driverId ?? "");
                        setAssignVehicle(r.vehicleId ?? "");
                        setAssignRoute(r.routeId ?? "");
                        setAssignRider(r.riderName ?? "");
                      }}
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 disabled:opacity-50"
                      disabled={dispatchMut.isPending}
                      onClick={() => dispatchMut.mutate(r)}
                    >
                      Dispatch
                    </button>
                  </>
                ) : null}
                {canPod(r.status) ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                    onClick={() => {
                      setPodRow(r);
                      setPodStatus("delivered");
                      setPodNotes(r.podNotes ?? "");
                      setPodReason(r.failedReason ?? "");
                      setPodCollected(Number(r.collectedPkr ?? 0));
                      setReceiverName(r.receiverName ?? "");
                    }}
                  >
                    POD
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Done</span>
                )}
              </div>
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
        open={composerOpen}
        title="New delivery"
        onClose={() => !createMut.isPending && setComposerOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <DistButton variant="secondary" disabled={createMut.isPending} onClick={() => setComposerOpen(false)}>
              Cancel
            </DistButton>
            <DistButton
              disabled={
                createMut.isPending ||
                (sourceType === "order" ? !orderId : !invoiceId)
              }
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Creating…" : "Create delivery"}
            </DistButton>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Source">
            <DistSelect
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as "order" | "invoice")}
            >
              <option value="order">From order</option>
              <option value="invoice">From invoice</option>
            </DistSelect>
          </Field>
          {sourceType === "order" ? (
            <Field label="Order">
              <DistSelect value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
                <option value="">Select order</option>
                {readyOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber ?? o.id} ({o.status})
                  </option>
                ))}
              </DistSelect>
            </Field>
          ) : (
            <Field label="Invoice">
              <DistSelect value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} required>
                <option value="">Select invoice</option>
                {((invoices.data ?? []) as { id: string; invoiceNumber?: string }[]).map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber ?? inv.id}
                  </option>
                ))}
              </DistSelect>
            </Field>
          )}
          <Field label="Rider name">
            <DistInput value={riderName} onChange={(e) => setRiderName(e.target.value)} placeholder="Optional" />
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
        </div>
      </DistMasterDrawer>

      <DistMasterDrawer
        open={Boolean(assignRow)}
        title={`Assign — ${assignRow?.deliveryNumber ?? ""}`}
        onClose={() => !assignMut.isPending && setAssignRow(null)}
        footer={
          <div className="flex justify-end gap-2">
            <DistButton variant="secondary" disabled={assignMut.isPending} onClick={() => setAssignRow(null)}>
              Cancel
            </DistButton>
            <DistButton disabled={assignMut.isPending} onClick={() => assignMut.mutate()}>
              {assignMut.isPending ? "Saving…" : "Save assignment"}
            </DistButton>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Rider name">
            <DistInput value={assignRider} onChange={(e) => setAssignRider(e.target.value)} />
          </Field>
          <Field label="Driver">
            <DistSelect value={assignDriver} onChange={(e) => setAssignDriver(e.target.value)}>
              <option value="">None / text rider</option>
              {(drivers.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </DistSelect>
          </Field>
          <Field label="Vehicle">
            <DistSelect value={assignVehicle} onChange={(e) => setAssignVehicle(e.target.value)}>
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
            <DistSelect value={assignRoute} onChange={(e) => setAssignRoute(e.target.value)}>
              <option value="">No route</option>
              {((routes.data ?? []) as { id: string; name?: string; code?: string }[]).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name ?? r.code ?? r.id}
                </option>
              ))}
            </DistSelect>
          </Field>
        </div>
      </DistMasterDrawer>

      <DistMasterDrawer
        open={Boolean(podRow)}
        title={`POD — ${podRow?.deliveryNumber ?? ""}`}
        onClose={() => !podMut.isPending && setPodRow(null)}
        footer={
          <div className="flex justify-end gap-2">
            <DistButton variant="secondary" disabled={podMut.isPending} onClick={() => setPodRow(null)}>
              Cancel
            </DistButton>
            <DistButton
              disabled={
                podMut.isPending ||
                ((podStatus === "failed" || podStatus === "refused") && !podReason.trim())
              }
              onClick={() => podMut.mutate()}
            >
              {podMut.isPending ? "Posting…" : "Post POD"}
            </DistButton>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Outcome">
            <DistSelect
              value={podStatus}
              onChange={(e) => setPodStatus(e.target.value as PodOutcome)}
            >
              <option value="delivered">Delivered</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
              <option value="refused">Refused</option>
            </DistSelect>
          </Field>
          {(podStatus === "failed" || podStatus === "refused") && (
            <Field label="Reason (required)">
              <DistInput
                value={podReason}
                onChange={(e) => setPodReason(e.target.value)}
                placeholder="Required for failed / refused"
              />
            </Field>
          )}
          <Field label="Receiver name (signature proxy)">
            <DistInput
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Printed name / acknowledgment"
            />
          </Field>
          <Field label="Collected on delivery (PKR)">
            <DistInput
              type="number"
              min={0}
              value={podCollected}
              onChange={(e) => setPodCollected(Number(e.target.value))}
            />
          </Field>
          <Field label="POD notes">
            <DistInput value={podNotes} onChange={(e) => setPodNotes(e.target.value)} />
          </Field>
        </div>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
