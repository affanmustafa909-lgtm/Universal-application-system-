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
  fetchPharmacyTradeCustomers,
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
import { printDistDocument } from "../lib/printDistOrder";
import { customerDisplayName, looksLikeUuid, tradeCustomerNameMap } from "../lib/customerDisplay";

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
  const [driverId, setDriverId] = useState("");
  const [routeId, setRouteId] = useState("");

  const [assignRow, setAssignRow] = useState<DeliveryOrder | null>(null);
  const [assignDriver, setAssignDriver] = useState("");
  const [assignVehicle, setAssignVehicle] = useState("");
  const [assignRoute, setAssignRoute] = useState("");
  const [assignRider, setAssignRider] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newVehicleLabel, setNewVehicleLabel] = useState("");
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [registerBusy, setRegisterBusy] = useState(false);

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
    enabled: Boolean(branchCode),
    queryFn: () => fetchPharmacyDistOrders(branchCode!),
    staleTime: 60_000,
  });

  const invoices = useQuery({
    queryKey: ["pharmacy", "dist-invoices", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchPharmacyDistInvoices(branchCode!),
    staleTime: 60_000,
  });

  const routes = useQuery({
    queryKey: ["pharmacy", "routes"],
    enabled: Boolean(branchCode),
    queryFn: fetchPharmacyRoutes,
    staleTime: 120_000,
  });

  const customers = useQuery({
    queryKey: ["pharmacy", "trade-customers", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchPharmacyTradeCustomers(branchCode),
    staleTime: 120_000,
  });

  const drivers = useQuery({
    queryKey: ["distribution", "delivery", "drivers", branchCode],
    enabled: Boolean(branchCode) && (composerOpen || Boolean(assignRow)),
    queryFn: () => deliveryApi.listDrivers({ branchCode }),
  });

  const vehicles = useQuery({
    queryKey: ["distribution", "delivery", "vehicles", branchCode],
    enabled: Boolean(branchCode) && (composerOpen || Boolean(assignRow)),
    queryFn: () => deliveryApi.listVehicles({ branchCode }),
  });

  const createMut = useMutation({
    mutationFn: () => {
      const selectedDriver = (drivers.data ?? []).find((d) => d.id === driverId);
      return deliveryApi.createOrder({
        branchCode: branchCode!,
        orderId: sourceType === "order" ? orderId || undefined : undefined,
        invoiceId: sourceType === "invoice" ? invoiceId || undefined : undefined,
        driverId: driverId || undefined,
        riderName: selectedDriver?.name || riderName || undefined,
        routeId: routeId || undefined,
      });
    },
    onSuccess: () => {
      setActionError(null);
      setComposerOpen(false);
      setOrderId("");
      setInvoiceId("");
      setRiderName("");
      setDriverId("");
      setRouteId("");
      invalidate();
      void list.refetch();
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const assignMut = useMutation({
    mutationFn: () => {
      const selectedDriver = (drivers.data ?? []).find((d) => d.id === assignDriver);
      return deliveryApi.assign(assignRow!.id, {
        driverId: assignDriver || undefined,
        vehicleId: assignVehicle || undefined,
        routeId: assignRoute || undefined,
        riderName: selectedDriver?.name || assignRider || undefined,
      });
    },
    onSuccess: () => {
      setActionError(null);
      setAssignRow(null);
      setNewDriverName("");
      setNewDriverPhone("");
      setNewVehicleLabel("");
      setNewVehiclePlate("");
      invalidate();
      void list.refetch();
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const registerDriver = async () => {
    if (!branchCode || !newDriverName.trim()) return;
    setRegisterBusy(true);
    setActionError(null);
    try {
      const created = await deliveryApi.createDriver({
        branchCode,
        name: newDriverName.trim(),
        phone: newDriverPhone.trim() || undefined,
      });
      await drivers.refetch();
      setAssignDriver(created.id);
      setAssignRider(created.name);
      setNewDriverName("");
      setNewDriverPhone("");
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setRegisterBusy(false);
    }
  };

  const registerVehicle = async () => {
    if (!branchCode || !newVehicleLabel.trim()) return;
    setRegisterBusy(true);
    setActionError(null);
    try {
      const created = await deliveryApi.createVehicle({
        branchCode,
        label: newVehicleLabel.trim(),
        plateNumber: newVehiclePlate.trim() || undefined,
      });
      await vehicles.refetch();
      setAssignVehicle(created.id);
      setNewVehicleLabel("");
      setNewVehiclePlate("");
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setRegisterBusy(false);
    }
  };

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

  const rows = useMemo(() => {
    const items = list.data?.items ?? [];
    const orderById = new Map(
      ((orders.data ?? []) as { id: string; orderNumber?: string; tradeCustomerId?: string; totalPkr?: number }[]).map(
        (o) => [o.id, o],
      ),
    );
    const invById = new Map(
      ((invoices.data ?? []) as {
        id: string;
        invoiceNumber?: string;
        orderId?: string;
        tradeCustomerId?: string;
        totalPkr?: number;
      }[]).map((i) => [i.id, i]),
    );
    const routeById = new Map(
      ((routes.data ?? []) as { id: string; name?: string; code?: string }[]).map((r) => [r.id, r]),
    );
    const custNames = tradeCustomerNameMap(
      (customers.data ?? []) as { id?: string; name?: string | null; code?: string | null }[],
    );
    const custById = new Map(
      ((customers.data ?? []) as { id: string; name?: string; code?: string; phone?: string }[]).map((c) => [
        c.id,
        c,
      ]),
    );

    const clean = (v?: string | null) => {
      const s = String(v ?? "").trim();
      return s && !looksLikeUuid(s) ? s : "";
    };

    return items.map((r) => {
      const order = r.orderId ? orderById.get(r.orderId) : undefined;
      const inv = r.invoiceId ? invById.get(r.invoiceId) : undefined;
      const route = r.routeId ? routeById.get(r.routeId) : undefined;
      const customerId =
        r.tradeCustomerId || order?.tradeCustomerId || inv?.tradeCustomerId || undefined;
      const cust = customerId ? custById.get(customerId) : undefined;

      const orderNumber = clean(r.orderNumber) || clean(order?.orderNumber) || null;
      const invoiceNumber = clean(r.invoiceNumber) || clean(inv?.invoiceNumber) || null;
      const routeName =
        clean(r.routeName) || clean(route?.name) || clean(route?.code) || clean(r.routeCode) || null;
      const tradeCustomerName =
        clean(r.tradeCustomerName) ||
        clean(r.contactName) ||
        (customerId ? custNames.get(customerId) : undefined) ||
        clean(cust?.name) ||
        null;
      const tradeCustomerCode = clean(r.tradeCustomerCode) || clean(cust?.code) || null;

      return {
        ...r,
        orderNumber,
        invoiceNumber,
        routeName,
        tradeCustomerId: customerId ?? r.tradeCustomerId,
        tradeCustomerName,
        tradeCustomerCode,
        orderTotalPkr: r.orderTotalPkr ?? order?.totalPkr ?? null,
        invoiceTotalPkr: r.invoiceTotalPkr ?? inv?.totalPkr ?? null,
      };
    });
  }, [list.data?.items, orders.data, invoices.data, routes.data, customers.data]);

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
            render: (r) => {
              const order = r.orderNumber && !looksLikeUuid(r.orderNumber) ? r.orderNumber : null;
              const inv = r.invoiceNumber && !looksLikeUuid(r.invoiceNumber) ? r.invoiceNumber : null;
              if (order && inv) return `${order} · ${inv}`;
              return order ?? inv ?? "—";
            },
          },
          {
            key: "customer",
            header: "Customer",
            render: (r) => {
              const name = customerDisplayName(r);
              const code =
                r.tradeCustomerCode && !looksLikeUuid(r.tradeCustomerCode)
                  ? String(r.tradeCustomerCode)
                  : "";
              if (name === "—" && !code) return "—";
              return code && name !== "—" ? `${name} (${code})` : name !== "—" ? name : code;
            },
          },
          {
            key: "rider",
            header: "Rider / Driver",
            render: (r) => {
              const name = r.driverName ?? r.riderName;
              return name && !looksLikeUuid(name) ? name : "—";
            },
          },
          {
            key: "route",
            header: "Route",
            render: (r) => {
              const name = r.routeName ?? r.routeCode;
              return name && !looksLikeUuid(name) ? name : "—";
            },
          },
          {
            key: "collected",
            header: "Collected",
            render: (r) => {
              const collected = Number(r.collectedPkr ?? 0);
              if (collected > 0) return formatPkr(collected);
              const due = Number(r.invoiceTotalPkr ?? r.orderTotalPkr ?? 0);
              return due > 0 ? (
                <span className="text-slate-400" title="Invoice / order total">
                  Due {formatPkr(due)}
                </span>
              ) : (
                "—"
              );
            },
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
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  onClick={() => {
                    void (async () => {
                      try {
                        const detail = await deliveryApi.getOrder(r.id);
                        const label = (v?: string | null) =>
                          v && String(v).trim() && !looksLikeUuid(v) ? String(v).trim() : "—";
                        const customer = customerDisplayName(detail);
                        const rider = label(detail.driverName ?? detail.riderName);
                        const route = label(detail.routeName);
                        const orderNo = label(detail.orderNumber);
                        const invNo = label(detail.invoiceNumber);
                        const printLines = (detail.lines ?? []).map((l) => {
                          const name =
                            (l.medicineName && !looksLikeUuid(l.medicineName) ? l.medicineName : null) ||
                            (l.productLabel && !looksLikeUuid(l.productLabel) ? l.productLabel : null) ||
                            "Item";
                          const sku = l.medicineSku && !looksLikeUuid(l.medicineSku) ? l.medicineSku : "";
                          const batch = l.batchNumber && !looksLikeUuid(l.batchNumber) ? l.batchNumber : "";
                          return {
                            label: name,
                            qty: Number(l.quantity ?? 0),
                            unitPrice: Number(l.unitPricePkr ?? 0),
                            batch: batch || undefined,
                            note: sku || undefined,
                          };
                        });
                        const lineTotal = printLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
                        const total =
                          Number(detail.invoiceTotalPkr ?? 0) ||
                          Number(detail.orderTotalPkr ?? 0) ||
                          lineTotal ||
                          0;
                        await printDistDocument({
                          title: "Delivery note",
                          documentNumber: String(detail.deliveryNumber ?? r.deliveryNumber ?? r.id),
                          partyLabel: "Customer",
                          partyName: customer,
                          branchName: label(detail.branchName) !== "—" ? detail.branchName ?? undefined : undefined,
                          branchCode: label(detail.branchCode) !== "—" ? detail.branchCode ?? undefined : undefined,
                          meta: [
                            { label: "Status", value: String(detail.status ?? r.status ?? "") },
                            { label: "Rider", value: rider },
                            { label: "Route", value: route },
                            ...(orderNo !== "—" ? [{ label: "Order", value: orderNo }] : []),
                            ...(invNo !== "—" ? [{ label: "Invoice", value: invNo }] : []),
                            ...(detail.vehicleLabel && !looksLikeUuid(detail.vehicleLabel)
                              ? [{ label: "Vehicle", value: String(detail.vehicleLabel) }]
                              : []),
                          ],
                          lines: printLines,
                          subtotalPkr: lineTotal || total,
                          totalPkr: total,
                          footerNote: "Delivery note — quantities as dispatched",
                        });
                      } catch (e) {
                        setActionError(errorMessage(e, "Print failed"));
                      }
                    })();
                  }}
                >
                  Print
                </button>
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
          <DistButton
            disabled={
              createMut.isPending ||
              (sourceType === "order" ? !orderId : !invoiceId)
            }
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Creating…" : "Create delivery"}
          </DistButton>
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
          <Field label="Rider / Driver">
            <DistSelect
              value={driverId}
              onChange={(e) => {
                const next = e.target.value;
                setDriverId(next);
                const hit = (drivers.data ?? []).find((d) => d.id === next);
                setRiderName(hit?.name ?? "");
              }}
            >
              <option value="">Select rider</option>
              {(drivers.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.code ? ` (${d.code})` : ""}
                  {d.phone ? ` · ${d.phone}` : ""}
                </option>
              ))}
            </DistSelect>
            {drivers.isLoading ? (
              <span className="mt-1 block text-[11px] text-slate-500">Loading riders…</span>
            ) : null}
            {!drivers.isLoading && (drivers.data?.length ?? 0) === 0 ? (
              <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-300">
                No riders yet — add under Sales force / Delivery drivers, or type a name below.
              </span>
            ) : null}
          </Field>
          {!driverId ? (
            <Field label="Rider name (optional free text)">
              <DistInput
                value={riderName}
                onChange={(e) => setRiderName(e.target.value)}
                placeholder="If rider not in list"
              />
            </Field>
          ) : null}
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
          <DistButton disabled={assignMut.isPending} onClick={() => assignMut.mutate()}>
            {assignMut.isPending ? "Saving…" : "Save assignment"}
          </DistButton>
        }
      >
        <div className="space-y-3">
          <Field label="Driver / Rider">
            <DistSelect
              value={assignDriver}
              onChange={(e) => {
                const next = e.target.value;
                setAssignDriver(next);
                const hit = (drivers.data ?? []).find((d) => d.id === next);
                if (hit) setAssignRider(hit.name);
              }}
            >
              <option value="">Select registered rider</option>
              {(drivers.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.code ? ` (${d.code})` : ""}
                  {d.phone ? ` · ${d.phone}` : ""}
                </option>
              ))}
            </DistSelect>
            {drivers.isLoading ? (
              <span className="mt-1 block text-[11px] text-slate-500">Loading riders…</span>
            ) : null}
          </Field>

          <div className="rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Register new rider
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <DistInput
                value={newDriverName}
                onChange={(e) => setNewDriverName(e.target.value)}
                placeholder="Name *"
              />
              <DistInput
                value={newDriverPhone}
                onChange={(e) => setNewDriverPhone(e.target.value)}
                placeholder="Phone (optional)"
              />
            </div>
            <DistButton
              type="button"
              variant="secondary"
              className="mt-2 !py-1 text-xs"
              disabled={registerBusy || !newDriverName.trim()}
              onClick={() => void registerDriver()}
            >
              {registerBusy ? "Saving…" : "Register & select"}
            </DistButton>
          </div>

          {!assignDriver ? (
            <Field label="Rider name (one-time text only)">
              <DistInput
                value={assignRider}
                onChange={(e) => setAssignRider(e.target.value)}
                placeholder="Only if not registering a driver"
              />
            </Field>
          ) : null}

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

          <div className="rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Register new vehicle
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <DistInput
                value={newVehicleLabel}
                onChange={(e) => setNewVehicleLabel(e.target.value)}
                placeholder="Code / label *"
              />
              <DistInput
                value={newVehiclePlate}
                onChange={(e) => setNewVehiclePlate(e.target.value)}
                placeholder="Plate no."
              />
            </div>
            <DistButton
              type="button"
              variant="secondary"
              className="mt-2 !py-1 text-xs"
              disabled={registerBusy || !newVehicleLabel.trim()}
              onClick={() => void registerVehicle()}
            >
              {registerBusy ? "Saving…" : "Register & select"}
            </DistButton>
          </div>

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
          <DistButton
            disabled={
              podMut.isPending ||
              ((podStatus === "failed" || podStatus === "refused") && !podReason.trim())
            }
            onClick={() => podMut.mutate()}
          >
            {podMut.isPending ? "Posting…" : "Post POD"}
          </DistButton>
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
