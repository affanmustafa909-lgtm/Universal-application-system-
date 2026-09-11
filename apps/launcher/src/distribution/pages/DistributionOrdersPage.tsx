import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import {
  advancePharmacyDistOrder,
  approvePharmacyDistOrder,
  fetchPharmacyDistOrders,
  fetchPharmacyEmployeesPicker,
  fetchPharmacyWarehouses,
  invoicePharmacyDistOrder,
} from "../../pharmacy/api/pharmacy-erp";
import {
  bookSale,
  checkSaleAvailability,
  deleteHeldSale,
  fetchHeldSales,
  formatSaleValidateErrors,
  quoteSalePricing,
  validateSale,
  type SaleCustomerHit,
  type SaleProductHit,
} from "../../pharmacy/api/pharmacy-sales";
import { useBarcodeScanner } from "../../store/hooks/useBarcodeScanner";
import {
  DistButton,
  DistEmptyState,
  DistErrorBanner,
  DistInput,
  DistLoadingBlock,
  DistSelect,
  DistStatusBadge,
  distInputClass,
} from "../ui/DistUi";
import { printDistBookingSlip } from "../lib/printDistOrder";
import {
  useSaleCart,
  useSaleCustomerSearch,
  useSaleProductSearch,
  useSaleShortcuts,
  type SaleCartLine,
} from "../sales";

const HOLD_KEY = "dist-sales-hold-v1";

const NEXT_ACTIONS: Record<
  string,
  { label: string; status?: string; kind?: "approve" | "invoice" | "print" }[]
> = {
  draft: [
    { label: "Book", status: "booked" },
    { label: "Cancel", status: "cancelled" },
  ],
  submitted: [{ label: "Approve", kind: "approve" }],
  booked: [
    { label: "Approve", kind: "approve" },
    { label: "Print", kind: "print" },
    { label: "Cancel", status: "cancelled" },
  ],
  approved: [
    { label: "Reserve", status: "stock_reserved" },
    { label: "Pick", status: "picking" },
    { label: "Invoice", kind: "invoice" },
    { label: "Print", kind: "print" },
  ],
  stock_reserved: [
    { label: "Pick", status: "picking" },
    { label: "Invoice", kind: "invoice" },
  ],
  picking: [{ label: "Pack", status: "packed" }],
  packed: [
    { label: "Ready", status: "ready_for_dispatch" },
    { label: "Invoice", kind: "invoice" },
  ],
  ready_for_dispatch: [
    { label: "Dispatch", status: "dispatched" },
    { label: "Invoice", kind: "invoice" },
  ],
  invoiced: [
    { label: "Dispatch", status: "dispatched" },
    { label: "Print", kind: "print" },
    { label: "Delivered", status: "delivered" },
  ],
  dispatched: [{ label: "Delivered", status: "delivered" }],
};

type LocalHoldPayload = {
  customer: SaleCustomerHit | null;
  warehouseId?: string;
  salesmanEmployeeId?: string;
  cart: SaleCartLine[];
  at: number;
};

function catalogPrice(p: SaleProductHit): number {
  return Math.round(Number(p.unitPricePkr ?? p.wholesalePricePkr ?? p.sellingPricePkr ?? 0));
}

function formatBatchSummary(line: SaleCartLine): string | null {
  if (!line.allocations?.length) return null;
  return line.allocations
    .map((a) => {
      const exp = a.expiryDate ? String(a.expiryDate).slice(0, 10) : "—";
      return `${a.batchNumber}×${a.quantity} exp ${exp}`;
    })
    .join(" · ");
}

function focusAndSelect(el: HTMLInputElement | null | undefined) {
  if (!el) return;
  el.focus();
  el.select();
}

export function DistributionOrdersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [searchParams] = useSearchParams();
  const focus = searchParams.get("focus");
  const invalidate = useInvalidatePharmacy([
    ["pharmacy", "dist-orders"],
    ["pharmacy", "sales", "held"],
    ["distribution", "ps-window"],
    ["distribution", "ps-window-widgets"],
  ]);

  const productSearchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customerPanel, setCustomerPanel] = useState(true);
  const [heldPanel, setHeldPanel] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(() => Boolean(focus));
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState<string>(() => {
    if (focus === "held") return "draft";
    if (focus === "pendingApproval") return "booked";
    if (focus === "pipeline") return "approved";
    return "All";
  });
  const [creditOverrideOnly, setCreditOverrideOnly] = useState(() => focus === "creditOverride");
  const [creditOverride, setCreditOverride] = useState(false);
  const [creditOverrideReason, setCreditOverrideReason] = useState("");
  const [booking, setBooking] = useState(false);
  const [customer, setCustomer] = useState<SaleCustomerHit | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [salesmanEmployeeId, setSalesmanEmployeeId] = useState("");

  const cart = useSaleCart();
  const customerSearch = useSaleCustomerSearch({
    branchCode: branch?.code,
    enabled: customerPanel,
  });
  const productSearch = useSaleProductSearch({
    branchCode: branch?.code,
    warehouseId: warehouseId || undefined,
    enabled: Boolean(customer),
  });

  const warehouses = useQuery({
    queryKey: ["pharmacy", "warehouses", branch?.code],
    queryFn: () => fetchPharmacyWarehouses(branch!.code),
    enabled: Boolean(branch?.code),
    staleTime: 300_000,
  });

  const employees = useQuery({
    queryKey: ["pharmacy", "employees-picker"],
    queryFn: fetchPharmacyEmployeesPicker,
    staleTime: 300_000,
  });

  const held = useQuery({
    queryKey: ["pharmacy", "sales", "held", branch?.code],
    queryFn: () => fetchHeldSales({ branchCode: branch!.code }),
    enabled: Boolean(branch?.code && heldPanel),
    staleTime: 10_000,
  });

  const orders = useQuery({
    queryKey: ["pharmacy", "dist-orders", branch?.code],
    enabled: Boolean(branch?.code && ordersOpen),
    queryFn: () => fetchPharmacyDistOrders(branch!.code),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!customer) setCustomerPanel(true);
  }, [customer]);

  useEffect(() => {
    const list = (warehouses.data ?? []) as { id: string; isDefault?: boolean }[];
    if (!warehouseId && list.length) {
      const def = list.find((w) => w.isDefault) ?? list[0];
      if (def) setWarehouseId(def.id);
    }
  }, [warehouses.data, warehouseId]);

  const creditLimit = Number(customer?.creditLimitPkr ?? 0);
  const outstanding = Number(customer?.outstandingPkr ?? 0);
  const availableCredit = creditLimit > 0 ? creditLimit - outstanding : null;
  const projectedOutstanding = outstanding + cart.totals.net;
  const creditRisk = creditLimit > 0 && projectedOutstanding > creditLimit;
  const creditBlocked =
    creditRisk && (!creditOverride || !creditOverrideReason.trim());

  const enrichLine = useCallback(
    async (lineKey: string, medicineId: string, qty: number, name: string, sku?: string | null, freeQty = 0) => {
      if (!branch?.code || !customer) return;
      const physicalQty = Math.max(1, Math.round(qty) + Math.max(0, Math.round(freeQty)));
      try {
        const [avail, quote] = await Promise.all([
          checkSaleAvailability({
            branchCode: branch.code,
            warehouseId: warehouseId || undefined,
            lines: [{ medicineId, quantity: physicalQty }],
          }).catch(() => null),
          quoteSalePricing({
            branchCode: branch.code,
            tradeCustomerId: customer.id,
            priceLevel: customer.priceLevel ?? "wholesale",
            warehouseId: warehouseId || undefined,
            lines: [{ medicineId, quantity: qty }],
          }).catch(() => null),
        ]);

        const availLine = avail?.lines?.[0];
        const quoteLine = quote?.lines?.[0];
        cart.updateLine(lineKey, {
          allocations: availLine?.allocations,
          availableQty: availLine?.availableQty ?? null,
          fulfillable: availLine?.fulfillable ?? null,
          shortfall: availLine?.shortfall ?? null,
          ...(quoteLine?.unitPricePkr != null ? { unitPricePkr: quoteLine.unitPricePkr } : {}),
          ...(quoteLine?.priceSource != null ? { priceSource: quoteLine.priceSource } : {}),
          ...(quoteLine?.freeQty != null ? { freeQty: quoteLine.freeQty } : {}),
          ...(quoteLine?.discountPkr != null ? { discountPkr: quoteLine.discountPkr } : {}),
          ...(quoteLine?.taxPkr != null ? { taxPkr: quoteLine.taxPkr } : {}),
          ...(quoteLine?.schemeName != null || quoteLine?.schemeLabel != null
            ? { schemeName: quoteLine.schemeName ?? quoteLine.schemeLabel ?? null }
            : {}),
          name: availLine?.name || name,
          sku: availLine?.sku ?? sku,
        });
      } catch {
        // keep catalog values
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cart.updateLine is stable
    [branch?.code, customer, warehouseId, cart.updateLine],
  );

  const qtyTimers = useRef<Map<string, number>>(new Map());

  const scheduleEnrich = useCallback(
    (line: SaleCartLine) => {
      const existing = qtyTimers.current.get(line.key);
      if (existing) window.clearTimeout(existing);
      const t = window.setTimeout(() => {
        void enrichLine(line.key, line.medicineId, line.qty, line.name, line.sku, line.freeQty);
      }, 280);
      qtyTimers.current.set(line.key, t);
    },
    [enrichLine],
  );

  const pendingEnrichRef = useRef<{ medicineId: string; qty: number } | null>(null);

  const addProductStable = useCallback(
    (product: SaleProductHit, qty = 1) => {
      if (!customer) {
        setNotice("Select a customer first");
        setCustomerPanel(true);
        return;
      }
      const price = catalogPrice(product);
      pendingEnrichRef.current = { medicineId: product.id, qty };
      cart.add({
        medicineId: product.id,
        name: product.name,
        sku: product.sku,
        qty,
        unitPricePkr: price,
        priceSource: "catalog",
        companyName: product.companyName,
        pack: product.pack,
        availableQty: product.availableQty ?? null,
      });
      productSearch.setQuery("");
      focusAndSelect(productSearchRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cart.add / productSearch.setQuery stable enough
    [customer, cart.add, productSearch.setQuery],
  );

  useEffect(() => {
    const pending = pendingEnrichRef.current;
    if (!pending) return;
    const line = [...cart.lines].reverse().find((l) => l.medicineId === pending.medicineId);
    if (!line) return;
    pendingEnrichRef.current = null;
    void enrichLine(line.key, line.medicineId, line.qty, line.name, line.sku, line.freeQty);
  }, [cart.lines, enrichLine]);

  const onBarcode = useCallback(
    (code: string) => {
      if (!customer) {
        setNotice("Select customer first, then scan");
        setCustomerPanel(true);
        return;
      }
      void productSearch.handleBarcode(code).then((hit) => {
        if (hit) addProductStable(hit, 1);
      });
    },
    [customer, productSearch, addProductStable],
  );

  useBarcodeScanner(onBarcode, Boolean(customer) && !customerPanel && !heldPanel && !ordersOpen);

  useEffect(() => {
    if (productSearch.barcodeError) setError(productSearch.barcodeError);
    if (productSearch.barcodeNotice) setNotice(productSearch.barcodeNotice);
  }, [productSearch.barcodeError, productSearch.barcodeNotice]);

  const selectCustomer = useCallback((c: SaleCustomerHit) => {
    setCustomer(c);
    setCustomerPanel(false);
    setCreditOverride(false);
    setCreditOverrideReason("");
    setNotice(null);
    window.setTimeout(() => focusAndSelect(productSearchRef.current), 40);
  }, []);

  const buildBookBody = useCallback(
    (submit: boolean, idempotencyKey?: string) => {
      if (!branch || !customer) return null;
      return {
        branchCode: branch.code,
        tradeCustomerId: customer.id,
        warehouseId: warehouseId || undefined,
        salesmanEmployeeId: salesmanEmployeeId || undefined,
        submit,
        creditOverride: creditOverride || undefined,
        creditOverrideReason: creditOverride ? creditOverrideReason.trim() || undefined : undefined,
        idempotencyKey,
        lines: cart.lines.map((l) => ({
          medicineId: l.medicineId,
          quantity: l.qty,
          freeQuantity: l.freeQty || undefined,
          unitPricePkr: l.unitPricePkr,
          discountPkr: l.discountPkr || undefined,
        })),
      };
    },
    [branch, customer, warehouseId, salesmanEmployeeId, creditOverride, creditOverrideReason, cart.lines],
  );

  const persistLocalHold = useCallback(() => {
    if (!customer || !cart.lines.length) return;
    const payload: LocalHoldPayload = {
      customer,
      warehouseId,
      salesmanEmployeeId,
      cart: cart.lines,
      at: Date.now(),
    };
    localStorage.setItem(HOLD_KEY, JSON.stringify(payload));
  }, [customer, warehouseId, salesmanEmployeeId, cart.lines]);

  const holdSale = useCallback(async () => {
    if (!branch || !customer || cart.lines.length === 0) return;
    setError(null);
    persistLocalHold();
    try {
      const body = buildBookBody(false, crypto.randomUUID());
      if (!body) return;
      const order = await bookSale(body);
      setNotice(`Held ${order.orderNumber ?? "draft"} (local backup saved)`);
      cart.clear();
      setCreditOverride(false);
      invalidate();
      void held.refetch();
    } catch (err) {
      setNotice("Server hold failed — local backup saved");
      setError(err instanceof Error ? err.message : "Hold failed");
    }
  }, [branch, customer, cart, buildBookBody, persistLocalHold, invalidate, held]);

  const bookOrder = useCallback(
    async (andPrint: boolean) => {
      if (!branch || !customer || cart.lines.length === 0 || booking) return;
      if (creditBlocked) {
        setError("Credit limit exceeded — enable credit override to book");
        return;
      }
      setBooking(true);
      setError(null);
      const idempotencyKey = crypto.randomUUID();
      const body = buildBookBody(true, idempotencyKey);
      if (!body) {
        setBooking(false);
        return;
      }
      try {
        const validation = await validateSale(body);
        if (!validation.ok || validation.issues.some((i) => (i.severity ?? "error") === "error")) {
          const msg = formatSaleValidateErrors(validation);
          setError(msg || "Validation failed");
          return;
        }
        const order = await bookSale(body);
        setNotice(`Booked ${order.orderNumber ?? "order"}`);
        if (andPrint) {
          try {
            await printDistBookingSlip({
              branchName: branch.name || branch.code,
              branchCode: branch.code,
              orderNumber: order.orderNumber ?? "BOOKING",
              customerName: customer.name,
              lines: cart.lines.map((l) => ({
                label: l.name,
                qty: l.qty,
                unitPrice: l.unitPricePkr,
              })),
              totalPkr: order.totalPkr ?? cart.totals.net,
            });
            setNotice(`Booked ${order.orderNumber ?? "order"} — print dialog opened`);
          } catch (printErr) {
            setError(printErr instanceof Error ? printErr.message : "Print failed — sale is booked");
          }
        }
        cart.clear();
        setCreditOverride(false);
        setCreditOverrideReason("");
        localStorage.removeItem(HOLD_KEY);
        invalidate();
      } catch (err) {
        // Keep cart on failure
        setError(err instanceof Error ? err.message : "Book failed");
      } finally {
        setBooking(false);
      }
    },
    [branch, customer, cart, booking, creditBlocked, buildBookBody, invalidate],
  );

  const newSale = useCallback(() => {
    cart.clear();
    setCustomer(null);
    setSalesmanEmployeeId("");
    setCreditOverride(false);
    setCreditOverrideReason("");
    setError(null);
    setNotice(null);
    setCustomerPanel(true);
    setHeldPanel(false);
    window.setTimeout(() => customerSearchRef.current?.focus(), 40);
  }, [cart]);

  const restoreLocalHold = useCallback(() => {
    try {
      const raw = localStorage.getItem(HOLD_KEY);
      if (!raw) {
        setNotice("No local held cart");
        return;
      }
      const data = JSON.parse(raw) as LocalHoldPayload;
      if (data.customer) setCustomer(data.customer);
      if (data.warehouseId) setWarehouseId(data.warehouseId);
      if (data.salesmanEmployeeId) setSalesmanEmployeeId(data.salesmanEmployeeId);
      if (data.cart?.length) cart.replaceAll(data.cart);
      setCustomerPanel(false);
      setHeldPanel(false);
      setNotice("Local hold restored");
      window.setTimeout(() => focusAndSelect(productSearchRef.current), 40);
    } catch {
      setError("Could not restore local hold");
    }
  }, [cart]);

  const resumeHeld = useCallback(
    (order: {
      id: string;
      tradeCustomerId?: string;
      customerName?: string;
      warehouseId?: string | null;
      lines?: { medicineId: string; quantity: number; freeQty?: number; unitPricePkr?: number }[];
      totalPkr?: number;
    }) => {
      if (order.tradeCustomerId) {
        setCustomer({
          id: order.tradeCustomerId,
          name: order.customerName ?? "Customer",
        });
      }
      if (order.warehouseId) setWarehouseId(order.warehouseId);
      if (order.lines?.length) {
        cart.replaceAll(
          order.lines.map((l) => ({
            key: `${l.medicineId}-${crypto.randomUUID().slice(0, 8)}`,
            medicineId: l.medicineId,
            name: l.medicineId,
            qty: l.quantity,
            freeQty: l.freeQty ?? 0,
            unitPricePkr: l.unitPricePkr ?? 0,
            discountPkr: 0,
            taxPkr: 0,
          })),
        );
      }
      setHeldPanel(false);
      setCustomerPanel(false);
      setNotice(`Resumed held order`);
      window.setTimeout(() => focusAndSelect(productSearchRef.current), 40);
    },
    [cart],
  );

  useSaleShortcuts({
    onCustomerFocus: () => {
      setCustomerPanel(true);
      setHeldPanel(false);
      window.setTimeout(() => customerSearchRef.current?.focus(), 30);
    },
    onProductFocus: () => {
      setCustomerPanel(false);
      focusAndSelect(productSearchRef.current);
    },
    onHold: () => void holdSale(),
    onBook: () => void bookOrder(false),
    onBookAndPrint: () => void bookOrder(true),
    onNewSale: () => newSale(),
    onEscape: () => {
      setOrdersOpen(false);
      setHeldPanel(false);
      if (customer) setCustomerPanel(false);
    },
    onDeleteLine: () => cart.removeSelected(),
    onOrders: () => setOrdersOpen(true),
  });

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    const pipeline = new Set(["approved", "stock_reserved", "picking", "packed", "ready_for_dispatch"]);
    const pending = new Set([
      "draft",
      "booked",
      "submitted",
      "approved",
      "stock_reserved",
      "picking",
      "packed",
      "ready_for_dispatch",
    ]);
    return (orders.data ?? []).filter((o) => {
      if (creditOverrideOnly && !o.creditOverride) return false;
      if (focus === "pending" && !pending.has(o.status)) return false;
      if (focus === "pipeline" && !pipeline.has(o.status)) return false;
      if (focus === "pendingApproval" && !["booked", "submitted"].includes(o.status)) return false;
      if (
        orderStatus !== "All" &&
        focus !== "pipeline" &&
        focus !== "pending" &&
        focus !== "pendingApproval" &&
        o.status !== orderStatus
      ) {
        return false;
      }
      if (!q) return true;
      return String(o.orderNumber ?? "").toLowerCase().includes(q) || String(o.status ?? "").includes(q);
    });
  }, [orders.data, orderSearch, orderStatus, creditOverrideOnly, focus]);

  const act = (p: Promise<unknown>) =>
    p
      .then(() => {
        invalidate();
        setError(null);
      })
      .catch((err: Error) => setError(err.message));

  async function printExisting(order: {
    orderNumber: string;
    totalPkr?: number;
    tradeCustomerId?: string;
  }) {
    if (!branch) return;
    try {
      await printDistBookingSlip({
        branchName: branch.name || branch.code,
        branchCode: branch.code,
        orderNumber: order.orderNumber,
        customerName: customer?.name ?? "Customer",
        lines: [{ label: `Order ${order.orderNumber}`, qty: 1, unitPrice: order.totalPkr ?? 0 }],
        totalPkr: order.totalPkr ?? 0,
        modeLabel: "Order copy",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Print failed");
    }
  }

  const warehouseOptions = (warehouses.data ?? []) as { id: string; name?: string; code?: string }[];
  const employeeOptions = employees.data ?? [];

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-2">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Sale Window</h1>
            <span className="text-[11px] text-slate-500">
              F2 customer · F4 search · F8 hold · F9 book · F10 print · Ctrl+N new · F7 orders
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <DistButton
              variant="secondary"
              className="max-w-[14rem] truncate !py-1 text-xs"
              onClick={() => {
                setCustomerPanel(true);
                window.setTimeout(() => customerSearchRef.current?.focus(), 30);
              }}
            >
              {customer ? customer.name : "Customer (F2)"}
            </DistButton>
            {employeeOptions.length > 0 ? (
              <DistSelect
                className="!w-auto min-w-[8rem] !py-1 text-xs"
                value={salesmanEmployeeId}
                onChange={(e) => setSalesmanEmployeeId(e.target.value)}
                title="Salesman"
              >
                <option value="">Salesman</option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </DistSelect>
            ) : null}
            {warehouseOptions.length > 0 ? (
              <DistSelect
                className="!w-auto min-w-[8rem] !py-1 text-xs"
                value={warehouseId}
                onChange={(e) => {
                  const next = e.target.value;
                  setWarehouseId(next);
                  // Re-check stock/pricing for every line against the new warehouse.
                  for (const line of cart.lines) {
                    window.setTimeout(() => {
                      void enrichLine(line.key, line.medicineId, line.qty, line.name, line.sku, line.freeQty);
                    }, 0);
                  }
                }}
                title="Warehouse"
              >
                {warehouseOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name ?? w.code ?? w.id}
                  </option>
                ))}
              </DistSelect>
            ) : null}
            {customer ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 tabular-nums dark:border-slate-700 dark:bg-slate-900">
                  Limit {formatPkr(creditLimit)}
                </span>
                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 tabular-nums dark:border-slate-700 dark:bg-slate-900">
                  Due {formatPkr(outstanding)}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 tabular-nums ${
                    creditRisk
                      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                      : availableCredit != null && availableCredit < creditLimit * 0.15
                        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  }`}
                >
                  Avail {availableCredit != null ? formatPkr(availableCredit) : "—"}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <DistButton variant="ghost" className="!py-1 text-xs" onClick={newSale}>
            New
          </DistButton>
          <DistButton
            variant="secondary"
            className="!py-1 text-xs"
            disabled={!customer || cart.lines.length === 0}
            onClick={() => void holdSale()}
          >
            Hold
          </DistButton>
          <DistButton
            variant="secondary"
            className="!py-1 text-xs"
            onClick={() => {
              setHeldPanel(true);
              setCustomerPanel(false);
            }}
          >
            Held
          </DistButton>
          <DistButton
            variant="secondary"
            className="!py-1 text-xs"
            onClick={() => setOrdersOpen(true)}
          >
            Orders
          </DistButton>
          <DistButton
            className="!py-1 text-xs"
            disabled={!customer || cart.lines.length === 0 || booking || creditBlocked}
            onClick={() => void bookOrder(false)}
          >
            {booking ? "Booking…" : "Book"}
          </DistButton>
          <DistButton
            variant="secondary"
            className="!py-1 text-xs"
            disabled={!customer || cart.lines.length === 0 || booking || creditBlocked}
            onClick={() => void bookOrder(true)}
          >
            Book&Print
          </DistButton>
        </div>
      </header>

      {error ? <DistErrorBanner message={error} onRetry={() => setError(null)} /> : null}
      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left: search + results */}
        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
          <div className="border-b border-slate-200 p-2 dark:border-slate-800">
            <DistInput
              ref={productSearchRef}
              data-scan-target="true"
              className="!py-2"
              placeholder={
                customer ? "Search product / SKU / barcode (F4)…" : "Select customer first (F2)"
              }
              disabled={!customer}
              value={productSearch.query}
              onChange={(e) => productSearch.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  productSearch.moveHighlight(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  productSearch.moveHighlight(-1);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const hit = productSearch.highlighted;
                  if (hit) addProductStable(hit, 1);
                }
              }}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {!customer ? (
              <DistEmptyState
                title="Select a trade customer"
                description="Press F2 or use the Customer button to begin."
                action={
                  <DistButton
                    className="mt-2"
                    onClick={() => {
                      setCustomerPanel(true);
                      window.setTimeout(() => customerSearchRef.current?.focus(), 30);
                    }}
                  >
                    Choose customer
                  </DistButton>
                }
              />
            ) : productSearch.isLoading && !productSearch.results.length ? (
              <div className="p-3">
                <DistLoadingBlock label="Searching…" />
              </div>
            ) : productSearch.debounced && productSearch.results.length === 0 ? (
              <DistEmptyState title="No products match" description="Try another name, SKU, or barcode." />
            ) : !productSearch.debounced ? (
              <DistEmptyState
                title="Search to add products"
                description="Type at least one character. Results come from the server."
              />
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/90">
                  <tr>
                    <th className="px-2 py-1.5">Product</th>
                    <th className="px-2 py-1.5">Company</th>
                    <th className="px-2 py-1.5">Pack</th>
                    <th className="px-2 py-1.5 text-right">Avail</th>
                    <th className="px-2 py-1.5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {productSearch.results.map((p, idx) => {
                    const active = idx === productSearch.highlightIndex;
                    return (
                      <tr
                        key={p.id}
                        className={`cursor-pointer ${
                          active
                            ? "bg-cyan-50 dark:bg-cyan-950/30"
                            : "hover:bg-slate-50 dark:hover:bg-slate-900/40"
                        }`}
                        onMouseEnter={() => productSearch.setHighlightIndex(idx)}
                        onClick={() => addProductStable(p, 1)}
                      >
                        <td className="px-2 py-1.5">
                          <div className="font-medium text-slate-900 dark:text-white">{p.name}</div>
                          <div className="font-mono text-[10px] text-slate-500">{p.sku ?? "—"}</div>
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300">
                          {p.companyName ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600">{p.pack ?? "—"}</td>
                        <td
                          className={`px-2 py-1.5 text-right tabular-nums text-xs ${
                            Number(p.availableQty ?? 0) > 0 ? "text-slate-600" : "text-red-600"
                          }`}
                        >
                          {p.availableQty != null ? p.availableQty : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {formatPkr(catalogPrice(p))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Right: cart */}
        <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
          <div className="border-b border-slate-200 px-2.5 py-2 dark:border-slate-800">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cart</div>
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {customer?.name ?? "No customer"}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {cart.lines.length === 0 ? (
              <DistEmptyState title="Cart empty" description="Search or scan to add lines." />
            ) : (
              cart.lines.map((l) => {
                const batch = formatBatchSummary(l);
                const selected = cart.selectedKey === l.key;
                return (
                  <div
                    key={l.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => cart.setSelectedKey(l.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") cart.setSelectedKey(l.key);
                    }}
                    className={`rounded-md border p-2 ${
                      selected
                        ? "border-cyan-500 bg-cyan-50/60 dark:border-cyan-600 dark:bg-cyan-950/20"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {l.name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {l.sku ?? "—"}
                          {l.priceSource ? ` · ${l.priceSource}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] text-slate-400 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          cart.remove(l.key);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    {batch ? (
                      <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{batch}</div>
                    ) : null}
                    {l.fulfillable === false ? (
                      <div className="mt-0.5 text-[10px] text-red-600">
                        Shortfall {l.shortfall ?? "?"}
                      </div>
                    ) : null}
                    {(l.freeQty > 0 || l.schemeName) && (
                      <div className="mt-0.5 text-[10px] text-cyan-700 dark:text-cyan-300">
                        Free {l.freeQty}
                        {l.schemeName ? ` · ${l.schemeName}` : ""}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-6 w-6 rounded border border-slate-300 text-xs dark:border-slate-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = Math.max(0, l.qty - 1);
                            cart.updateQty(l.key, next);
                            if (next > 0) scheduleEnrich({ ...l, qty: next });
                          }}
                        >
                          −
                        </button>
                        <input
                          className={`${distInputClass} !w-12 !px-1 !py-0.5 text-center text-sm tabular-nums`}
                          value={l.qty}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const next = Math.max(0, Math.round(Number(e.target.value) || 0));
                            cart.updateQty(l.key, next);
                            if (next > 0) scheduleEnrich({ ...l, qty: next });
                          }}
                        />
                        <button
                          type="button"
                          className="h-6 w-6 rounded border border-slate-300 text-xs dark:border-slate-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = l.qty + 1;
                            cart.updateQty(l.key, next);
                            scheduleEnrich({ ...l, qty: next });
                          }}
                        >
                          +
                        </button>
                        <span className="text-[10px] text-slate-400">@ {formatPkr(l.unitPricePkr)}</span>
                      </div>
                      <span className="text-sm tabular-nums font-medium">
                        {formatPkr(cart.lineNet(l))}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="space-y-1 border-t border-slate-200 p-2.5 text-sm dark:border-slate-800">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatPkr(cart.totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Discount</span>
              <span className="tabular-nums">{formatPkr(cart.totals.discount)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Free units</span>
              <span className="tabular-nums">{cart.totals.freeUnits}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Tax</span>
              <span className="tabular-nums">{formatPkr(cart.totals.tax)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Net</span>
              <span className="tabular-nums">{formatPkr(cart.totals.net)}</span>
            </div>
            {customer && creditLimit > 0 ? (
              <div
                className={`flex justify-between text-xs ${
                  creditRisk ? "font-medium text-red-700 dark:text-red-300" : "text-slate-500"
                }`}
              >
                <span>Projected due</span>
                <span className="tabular-nums">{formatPkr(projectedOutstanding)}</span>
              </div>
            ) : null}
            {creditRisk ? (
              <div className="space-y-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={creditOverride}
                    onChange={(e) => {
                      setCreditOverride(e.target.checked);
                      if (!e.target.checked) setCreditOverrideReason("");
                    }}
                  />
                  Credit limit exceeded — override to book
                </label>
                {creditOverride ? (
                  <DistInput
                    className="!py-1 text-xs"
                    placeholder="Override reason (required)"
                    value={creditOverrideReason}
                    onChange={(e) => setCreditOverrideReason(e.target.value)}
                  />
                ) : null}
              </div>
            ) : null}
            <DistButton
              className="w-full !py-2"
              disabled={!customer || cart.lines.length === 0 || booking || creditBlocked}
              onClick={() => void bookOrder(false)}
            >
              {booking ? "Booking…" : "Book (F9)"}
            </DistButton>
            <DistButton
              variant="secondary"
              className="w-full !py-1.5"
              disabled={!customer || cart.lines.length === 0 || booking || creditBlocked}
              onClick={() => void bookOrder(true)}
            >
              Book & Print (F10)
            </DistButton>
          </div>
        </aside>
      </div>

      {/* Customer panel */}
      {customerPanel ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Customer</div>
              <div className="text-[11px] text-slate-500">Search name, code, or phone</div>
            </div>
            {customer ? (
              <DistButton variant="ghost" className="!py-1 text-xs" onClick={() => setCustomerPanel(false)}>
                Close
              </DistButton>
            ) : null}
          </div>
          <div className="border-b border-slate-200 p-2 dark:border-slate-800">
            <DistInput
              ref={customerSearchRef}
              autoFocus
              placeholder="Search customers…"
              value={customerSearch.query}
              onChange={(e) => customerSearch.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  customerSearch.moveHighlight(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  customerSearch.moveHighlight(-1);
                } else if (e.key === "Enter" && customerSearch.highlighted) {
                  e.preventDefault();
                  selectCustomer(customerSearch.highlighted);
                } else if (e.key === "Escape" && customer) {
                  setCustomerPanel(false);
                }
              }}
            />
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {customerSearch.isLoading ? <DistLoadingBlock label="Searching…" /> : null}
            {!customerSearch.debounced ? (
              <DistEmptyState title="Type to search" description="Server search — no full customer dump." />
            ) : customerSearch.results.length === 0 ? (
              <DistEmptyState title="No customers found" />
            ) : (
              customerSearch.results.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  className={`w-full rounded-md border px-2.5 py-2 text-left ${
                    idx === customerSearch.highlightIndex
                      ? "border-cyan-500 bg-cyan-50 dark:border-cyan-600 dark:bg-cyan-950/30"
                      : "border-slate-200 hover:border-cyan-400 dark:border-slate-700"
                  }`}
                  onMouseEnter={() => customerSearch.setHighlightIndex(idx)}
                  onClick={() => selectCustomer(c)}
                >
                  <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {c.code ?? "—"}
                    {c.phone ? ` · ${c.phone}` : ""}
                    {" · "}Due {formatPkr(c.outstandingPkr ?? 0)}
                    {(c.creditLimitPkr ?? 0) > 0 ? ` · Limit ${formatPkr(c.creditLimitPkr ?? 0)}` : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* Held panel */}
      {heldPanel ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <div>
              <div className="text-sm font-semibold">Held sales</div>
              <div className="text-[11px] text-slate-500">Server drafts + local emergency backup</div>
            </div>
            <DistButton variant="ghost" className="!py-1 text-xs" onClick={() => setHeldPanel(false)}>
              Close
            </DistButton>
          </div>
          <div className="space-y-2 overflow-y-auto p-2">
            <DistButton variant="secondary" className="w-full !py-1.5 text-xs" onClick={restoreLocalHold}>
              Restore local hold
            </DistButton>
            {held.isLoading ? <DistLoadingBlock label="Loading held…" /> : null}
            {(held.data ?? []).length === 0 && !held.isLoading ? (
              <DistEmptyState title="No server held drafts" description="Hold saves a draft when sales/book is available." />
            ) : (
              (held.data ?? []).map((h) => (
                <div
                  key={h.id}
                  className="rounded-md border border-slate-200 p-2 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{h.orderNumber ?? h.id}</div>
                      <div className="text-[11px] text-slate-500">
                        {h.customerName ?? h.tradeCustomerId ?? "—"} · {formatPkr(h.totalPkr ?? 0)}
                      </div>
                    </div>
                    <DistStatusBadge status={h.status ?? "draft"} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <DistButton className="!py-1 text-xs" onClick={() => resumeHeld(h)}>
                      Resume
                    </DistButton>
                    <DistButton
                      variant="ghost"
                      className="!py-1 text-xs text-red-600"
                      onClick={() =>
                        void deleteHeldSale(h.id)
                          .then(() => held.refetch())
                          .catch((err: Error) => setError(err.message))
                      }
                    >
                      Delete
                    </DistButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* Orders pipeline (secondary) */}
      {ordersOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOrdersOpen(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
              <div>
                <div className="text-sm font-semibold">Orders pipeline</div>
                <div className="text-[11px] text-slate-500">Approve · reserve · invoice · print (F7)</div>
              </div>
              <DistButton variant="ghost" className="!py-1 text-xs" onClick={() => setOrdersOpen(false)}>
                Close
              </DistButton>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-200 p-2 dark:border-slate-800">
              <DistInput
                className="min-w-[10rem] flex-1"
                placeholder="Search order #…"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
              <DistSelect value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)}>
                <option value="All">All status</option>
                {[
                  "draft",
                  "booked",
                  "approved",
                  "picking",
                  "packed",
                  "invoiced",
                  "dispatched",
                  "delivered",
                  "cancelled",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </DistSelect>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={creditOverrideOnly}
                  onChange={(e) => setCreditOverrideOnly(e.target.checked)}
                />
                Credit override
              </label>
            </div>
            <div className="space-y-2 overflow-y-auto p-2">
              {filteredOrders.map((o) => (
                <div key={o.id} className="rounded-md border border-slate-200 p-2.5 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{o.orderNumber}</div>
                      <div className="text-xs text-slate-500">{formatPkr(Number(o.totalPkr ?? 0))}</div>
                    </div>
                    <DistStatusBadge status={o.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(NEXT_ACTIONS[o.status] ?? []).map((a) => (
                      <DistButton
                        key={a.label}
                        variant="secondary"
                        className="!py-1 text-xs"
                        onClick={() => {
                          if (a.kind === "approve") act(approvePharmacyDistOrder(o.id));
                          else if (a.kind === "invoice") act(invoicePharmacyDistOrder(o.id));
                          else if (a.kind === "print") void printExisting(o);
                          else if (a.status) act(advancePharmacyDistOrder(o.id, a.status));
                        }}
                      >
                        {a.label}
                      </DistButton>
                    ))}
                  </div>
                </div>
              ))}
              {filteredOrders.length === 0 ? (
                <DistEmptyState title="No matching orders" />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
