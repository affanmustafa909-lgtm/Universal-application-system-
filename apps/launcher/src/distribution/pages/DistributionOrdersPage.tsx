import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { isOnline } from "@platform/connectivity";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import {
  advancePharmacyDistOrder,
  approvePharmacyDistOrder,
  cashSettlePharmacyDistOrder,
  createPharmacyCollection,
  fetchPharmacyDistOrder,
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
  quoteSalePricing,
  type SaleCustomerHit,
  type SaleProductHit,
} from "../../pharmacy/api/pharmacy-sales";
import { fetchOpenCashSession, recordCashMovement } from "../../pops/api/accounting";
import {
  effectiveTaxPct,
  loadPosSettings,
  POS_SETTINGS_CHANGED_EVENT,
  type PosSettings,
} from "../../pops/lib/posSettings";
import { PosCreateAccountModal } from "../../pops/components/PosCreateAccountModal";
import { PosPayInModal } from "../../pops/components/PosPayInModal";
import { PosPayOutModal } from "../../pops/components/PosPayOutModal";
import { isLocalDataMode } from "../../stores/dataModeStore";
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
import { DistPayModal, type DistPayConfirmPayload } from "../components/DistPayModal";
import { printDistBookingSlip, printDistOrderReceipt } from "../lib/printDistOrder";
import {
  DIST_SALE_UNITS,
  distConvertSaleQty,
  distSaleUnitHint,
  distSaleUnitLabel,
  distToStripQty,
  distUnitPrice,
  formatPackLabel,
  medicinePackPrices,
  parseDistSaleUnit,
  type DistSaleUnit,
} from "../lib/medicinePackPricing";
import {
  DIST_SALE_WINDOW_SETTINGS_CHANGED,
  loadDistSaleWindowSettings,
  type DistSaleWindowSettings,
} from "../lib/distSaleWindowSettings";
import { customerDisplayName } from "../lib/customerDisplay";
import {
  enqueueDistOfflineSale,
  pendingDistOfflineLabel,
} from "../lib/distOfflineSales";
import {
  useSaleCart,
  useSaleCustomerSearch,
  useSaleProductSearch,
  useSaleShortcuts,
  type SaleCartLine,
} from "../sales";

const HOLD_KEY = "dist-sales-hold-v1";
const DIST = "/pops/distribution";

function normalizeCartLine(
  l: Partial<SaleCartLine> & { medicineId: string; name?: string; qty?: number; unitPricePkr?: number },
): SaleCartLine {
  const saleUnit = parseDistSaleUnit(l.saleUnit);
  const unitPricePkr = Math.max(0, Math.round(Number(l.unitPricePkr ?? 0)));
  const stripPricePkr = Math.max(
    0,
    Math.round(Number(l.stripPricePkr ?? (saleUnit === "pata" ? unitPricePkr : unitPricePkr))),
  );
  return {
    key: l.key ?? `${l.medicineId}-${crypto.randomUUID().slice(0, 8)}`,
    medicineId: l.medicineId,
    name: l.name ?? l.medicineId,
    sku: l.sku,
    qty: Math.max(1, Math.round(Number(l.qty ?? 1))),
    freeQty: Math.max(0, Math.round(Number(l.freeQty ?? 0))),
    unitPricePkr,
    stripPricePkr,
    saleUnit,
    priceSource: l.priceSource ?? null,
    discountPkr: Math.max(0, Number(l.discountPkr ?? 0)),
    taxPkr: Math.max(0, Number(l.taxPkr ?? 0)),
    schemeName: l.schemeName ?? null,
    allocations: l.allocations,
    availableQty: l.availableQty ?? null,
    shortfall: l.shortfall ?? null,
    fulfillable: l.fulfillable ?? null,
    companyName: l.companyName ?? null,
    pack: l.pack ?? null,
    genericName: l.genericName ?? null,
    tabletsPerStrip: l.tabletsPerStrip ?? null,
    stripsPerBox: l.stripsPerBox ?? null,
  };
}

function cartLinesForPrint(lines: SaleCartLine[]) {
  return lines.map((l) => {
    const pack =
      Number(l.tabletsPerStrip) > 1 || Number(l.stripsPerBox) > 1
        ? formatPackLabel(l.tabletsPerStrip, l.stripsPerBox)
        : "";
    const strip = l.stripPricePkr > 0 ? l.stripPricePkr : l.unitPricePkr;
    const prices = strip > 0 ? medicinePackPrices(strip, l.tabletsPerStrip, l.stripsPerBox) : null;
    const rateNote =
      prices && (prices.tabletsPerStrip > 1 || prices.stripsPerBox > 1)
        ? `Pata ${prices.pataPkr} · Pack ${prices.packPkr}`
        : "";
    const unitLabel = distSaleUnitLabel(l.saleUnit ?? "pata");
    const note =
      [l.sku, l.companyName, unitLabel, rateNote].filter((x) => x && String(x).trim()).join(" · ") ||
      undefined;
    return {
      label: l.name,
      qty: l.qty,
      unitPrice: l.unitPricePkr,
      freeQty: l.freeQty > 0 ? l.freeQty : undefined,
      pack: pack || undefined,
      note,
    };
  });
}

function bookLinePayload(l: SaleCartLine) {
  const unit = l.saleUnit ?? "pata";
  const stripPrice = Math.max(0, Math.round(l.stripPricePkr || l.unitPricePkr));
  if (unit === "goli") {
    return {
      medicineId: l.medicineId,
      quantity: l.qty,
      freeQuantity: l.freeQty || undefined,
      unitPricePkr: l.unitPricePkr,
      discountPkr: l.discountPkr || undefined,
    };
  }
  const quantity = distToStripQty(l.qty, unit, l.tabletsPerStrip, l.stripsPerBox);
  const freeQuantity = l.freeQty
    ? distToStripQty(l.freeQty, unit, l.tabletsPerStrip, l.stripsPerBox)
    : undefined;
  return {
    medicineId: l.medicineId,
    quantity,
    freeQuantity,
    unitPricePkr: stripPrice,
    discountPkr: l.discountPkr || undefined,
  };
}

function shouldSaveSaleOffline(err?: unknown): boolean {
  if (isLocalDataMode() || !isOnline()) return true;
  if (!(err instanceof Error)) return false;
  const m = err.message;
  return (
    m === "Load failed" ||
    m === "Failed to fetch" ||
    /network|fetch|offline|ECONNREFUSED|ENOTFOUND|timed?\s*out/i.test(m)
  );
}

function isOutOfStock(p: { availableQty?: number | null }): boolean {
  return p.availableQty != null && Number(p.availableQty) <= 0;
}

function paymentInfo(o: Record<string, unknown>): {
  paidLabel: "Paid" | "Pay" | "Not paid";
  paidTone: "success" | "warning" | "neutral";
  methodLabel: "Cash" | "Credit" | "—";
  methodTone: "success" | "warning" | "neutral";
  isPaid: boolean;
  isCash: boolean;
  isCredit: boolean;
} {
  const notes = String(o.notes ?? "");
  const methodFromNotes = /\[\[pm:Cash\]\]/i.test(notes)
    ? "cash"
    : /\[\[pm:Credit\]\]/i.test(notes)
      ? "credit"
      : "";
  const methodRaw = String(o.paymentMethod ?? o.payment_method ?? methodFromNotes ?? "").toLowerCase();
  const payStatus = String(o.paymentStatus ?? o.payment_status ?? "").toLowerCase();
  const due = Number(o.amountDuePkr ?? o.amountDue ?? NaN);
  const status = String(o.status ?? "").toLowerCase();
  const isCash =
    methodRaw === "cash" ||
    (Number.isFinite(due) && due <= 0 && (status === "invoiced" || status === "delivered"));
  const isCredit =
    methodRaw === "credit" || (Number.isFinite(due) && due > 0) || methodRaw.includes("credit");
  const isPaid =
    payStatus === "paid" ||
    payStatus === "settled" ||
    (status === "invoiced" && (isCash || payStatus === "paid")) ||
    (Number.isFinite(due) && due <= 0 && (status === "invoiced" || status === "delivered" || status === "dispatched"));
  const isOpen =
    status === "draft" ||
    status === "booked" ||
    status === "held" ||
    status === "submitted" ||
    status === "approved";

  if (isPaid) {
    return {
      paidLabel: "Paid",
      paidTone: "success",
      methodLabel: isCredit && !isCash ? "Credit" : "Cash",
      methodTone: isCredit && !isCash ? "warning" : "success",
      isPaid: true,
      isCash: !isCredit || isCash,
      isCredit: isCredit && !isCash,
    };
  }
  if (isCredit || (Number.isFinite(due) && due > 0) || payStatus === "unpaid") {
    return {
      paidLabel: "Pay",
      paidTone: "warning",
      methodLabel: methodRaw === "cash" ? "Cash" : "Credit",
      methodTone: methodRaw === "cash" ? "success" : "warning",
      isPaid: false,
      isCash: methodRaw === "cash",
      isCredit: methodRaw !== "cash",
    };
  }
  if (isOpen) {
    return {
      paidLabel: "Not paid",
      paidTone: "neutral",
      methodLabel: methodRaw === "cash" ? "Cash" : methodRaw === "credit" ? "Credit" : "—",
      methodTone: "neutral",
      isPaid: false,
      isCash: methodRaw === "cash",
      isCredit: methodRaw === "credit",
    };
  }
  return {
    paidLabel: "Pay",
    paidTone: "neutral",
    methodLabel: methodRaw === "cash" ? "Cash" : methodRaw === "credit" ? "Credit" : "—",
    methodTone: "neutral",
    isPaid: false,
    isCash: methodRaw === "cash",
    isCredit: methodRaw === "credit",
  };
}

function orderHistoryLine(o: Record<string, unknown>): string {
  const parts: string[] = [];
  if (o.createdAt) parts.push(`Created ${new Date(String(o.createdAt)).toLocaleString()}`);
  if (o.updatedAt && o.updatedAt !== o.createdAt) {
    parts.push(`Updated ${new Date(String(o.updatedAt)).toLocaleString()}`);
  }
  if (o.invoicedAt) parts.push(`Invoiced ${new Date(String(o.invoicedAt)).toLocaleString()}`);
  if (o.approvedAt) parts.push(`Approved ${new Date(String(o.approvedAt)).toLocaleString()}`);
  const status = String(o.status ?? "");
  if (status) parts.push(`Status: ${status}`);
  return parts.join(" · ") || "No history timestamps";
}

const NEXT_ACTIONS: Record<
  string,
  { label: string; status?: string; kind?: "approve" | "invoice" | "print" | "pay" }[]
> = {
  draft: [
    { label: "Book", status: "booked" },
    { label: "Cancel", status: "cancelled" },
  ],
  submitted: [
    { label: "Pay", kind: "pay" },
    { label: "Approve", kind: "approve" },
  ],
  booked: [
    { label: "Pay", kind: "pay" },
    { label: "Approve", kind: "approve" },
    { label: "Print", kind: "print" },
    { label: "Cancel", status: "cancelled" },
  ],
  approved: [
    { label: "Pay", kind: "pay" },
    { label: "Reserve", status: "stock_reserved" },
    { label: "Pick", status: "picking" },
    { label: "Invoice", kind: "invoice" },
    { label: "Print", kind: "print" },
  ],
  stock_reserved: [
    { label: "Pay", kind: "pay" },
    { label: "Pick", status: "picking" },
    { label: "Invoice", kind: "invoice" },
  ],
  picking: [
    { label: "Pay", kind: "pay" },
    { label: "Pack", status: "packed" },
  ],
  packed: [
    { label: "Pay", kind: "pay" },
    { label: "Ready", status: "ready_for_dispatch" },
    { label: "Invoice", kind: "invoice" },
  ],
  ready_for_dispatch: [
    { label: "Pay", kind: "pay" },
    { label: "Dispatch", status: "dispatched" },
    { label: "Invoice", kind: "invoice" },
  ],
  invoiced: [
    { label: "Pay", kind: "pay" },
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

function productMetaLine(p: SaleProductHit): string {
  const bits = [
    p.companyName ? `Co: ${p.companyName}` : null,
    p.genericName ? `Formula: ${p.genericName}` : null,
    formatPackLabel(p.tabletsPerStrip, p.stripsPerBox),
  ].filter(Boolean);
  return bits.join(" · ");
}

function productPriceBreakdown(p: SaleProductHit): string {
  const strip = catalogPrice(p);
  const br = medicinePackPrices(strip, p.tabletsPerStrip, p.stripsPerBox);
  return `Pata ${formatPkr(br.pataPkr)} · Goli ${formatPkr(br.goliPkr)} · Pack ${formatPkr(br.packPkr)}`;
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
  const navigate = useNavigate();
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
  const [saleUi, setSaleUi] = useState<DistSaleWindowSettings>(() => loadDistSaleWindowSettings());
  const [workspace, setWorkspace] = useState<"sell" | "held" | "orders">(() => {
    if (focus === "held") return "held";
    if (focus === "pendingApproval" || focus === "pipeline" || focus === "creditOverride") return "orders";
    return "sell";
  });
  const [customerFocused, setCustomerFocused] = useState(true);
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
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Credit">("Cash");
  /** Orders list payment filter: all | paid | pay | cash | credit */
  const [payFilter, setPayFilter] = useState<"all" | "paid" | "pay" | "cash" | "credit">("all");
  const [booking, setBooking] = useState(false);
  const [posSettings, setPosSettings] = useState<PosSettings>(() => loadPosSettings(undefined));
  const [customer, setCustomer] = useState<SaleCustomerHit | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [salesmanEmployeeId, setSalesmanEmployeeId] = useState("");
  const [payInOpen, setPayInOpen] = useState(false);
  const [payOutOpen, setPayOutOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [payModal, setPayModal] = useState<
    | null
    | { source: "cart" }
    | {
        source: "order";
        order: {
          id: string;
          orderNumber?: string;
          status?: string;
          totalPkr?: number;
          tradeCustomerId?: string;
          amountDuePkr?: number;
          invoiceId?: string;
          customerName?: string;
        };
      }
  >(null);
  const [productLayout, setProductLayout] = useState<"list" | "grid">(() => {
    try {
      return localStorage.getItem("dist-sale-product-layout") === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });
  const [cartLayout, setCartLayout] = useState<"list" | "grid">(() => {
    try {
      return localStorage.getItem("dist-sale-cart-layout") === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });
  const [defaultSaleUnit, setDefaultSaleUnit] = useState<DistSaleUnit>(() => {
    try {
      return parseDistSaleUnit(localStorage.getItem("dist-sale-unit"));
    } catch {
      return "pata";
    }
  });

  const persistDefaultSaleUnit = useCallback((unit: DistSaleUnit) => {
    setDefaultSaleUnit(unit);
    try {
      localStorage.setItem("dist-sale-unit", unit);
    } catch {
      /* ignore */
    }
  }, []);

  const cashSessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
  });

  const cart = useSaleCart();
  const customerSearch = useSaleCustomerSearch({
    branchCode: branch?.code,
    enabled: Boolean(branch?.code) && workspace === "sell",
  });
  const productSearch = useSaleProductSearch({
    branchCode: branch?.code,
    warehouseId: warehouseId || undefined,
    enabled: Boolean(customer) && workspace === "sell",
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
    enabled: Boolean(branch?.code && workspace === "held"),
    staleTime: 10_000,
  });

  const orders = useQuery({
    queryKey: ["pharmacy", "dist-orders", branch?.code],
    enabled: Boolean(branch?.code && workspace === "orders"),
    queryFn: () => fetchPharmacyDistOrders(branch!.code),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (customer && workspace === "sell" && !customerFocused) {
      window.setTimeout(() => productSearchRef.current?.focus(), 40);
    }
  }, [customer?.id, workspace, customerFocused]);

  useEffect(() => {
    if (!customer && workspace === "sell") {
      setCustomerFocused(true);
      window.setTimeout(() => customerSearchRef.current?.focus(), 40);
    }
  }, [customer, workspace]);

  useEffect(() => {
    const list = (warehouses.data ?? []) as { id: string; isDefault?: boolean }[];
    if (!warehouseId && list.length) {
      const def = list.find((w) => w.isDefault) ?? list[0];
      if (def) setWarehouseId(def.id);
    }
  }, [warehouses.data, warehouseId]);

  useEffect(() => {
    setPosSettings(loadPosSettings(branch?.code));
    function onPosSettingsChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || !detail?.branchCode || detail.branchCode === branch.code) {
        setPosSettings(loadPosSettings(branch?.code));
      }
    }
    window.addEventListener(POS_SETTINGS_CHANGED_EVENT, onPosSettingsChanged);
    return () => window.removeEventListener(POS_SETTINGS_CHANGED_EVENT, onPosSettingsChanged);
  }, [branch?.code]);

  useEffect(() => {
    const onSaleUi = () => setSaleUi(loadDistSaleWindowSettings());
    window.addEventListener(DIST_SALE_WINDOW_SETTINGS_CHANGED, onSaleUi);
    return () => window.removeEventListener(DIST_SALE_WINDOW_SETTINGS_CHANGED, onSaleUi);
  }, []);

  const openPurchasingForProduct = useCallback(
    (product: SaleProductHit) => {
      const q = new URLSearchParams();
      q.set("focus", "new");
      if (product.id) q.set("medicineId", product.id);
      if (product.sku) q.set("sku", product.sku);
      if (product.name) q.set("q", product.name);
      setNotice(`${product.name} is out of stock — opening Purchase Orders`);
      navigate(`${DIST}/purchase-orders?${q.toString()}`);
    },
    [navigate],
  );

  const creditLimit = Number(customer?.creditLimitPkr ?? 0);
  const outstanding = Number(customer?.outstandingPkr ?? 0);
  const availableCredit = creditLimit > 0 ? creditLimit - outstanding : null;

  /** Match Settings → POS: Cash uses cash tax %, Credit uses default sales tax %. */
  const billTaxPct = useMemo(() => {
    if (!posSettings.taxEnabled) return 0;
    if (paymentMethod === "Cash") return effectiveTaxPct(posSettings, "cash");
    return effectiveTaxPct(posSettings);
  }, [posSettings, paymentMethod]);

  const billServicePct = Math.max(0, posSettings.servicePct);
  const taxableBase = Math.max(0, cart.totals.subtotal - cart.totals.discount);
  const billServicePkr = Math.round((taxableBase * billServicePct) / 100);
  const billTaxPkr = Math.round(((taxableBase + billServicePkr) * billTaxPct) / 100);
  const billNet = taxableBase + billServicePkr + billTaxPkr;

  const projectedOutstanding = outstanding + (paymentMethod === "Cash" ? 0 : billNet);
  const creditRisk = paymentMethod === "Credit" && creditLimit > 0 && projectedOutstanding > creditLimit;
  const creditBlocked =
    paymentMethod === "Credit" &&
    creditRisk &&
    (!creditOverride || !creditOverrideReason.trim());

  const enrichLine = useCallback(
    async (
      lineKey: string,
      medicineId: string,
      qty: number,
      name: string,
      sku?: string | null,
      freeQty = 0,
      saleUnit: DistSaleUnit = "pata",
      tabletsPerStrip?: number | null,
      stripsPerBox?: number | null,
    ) => {
      if (!branch?.code || !customer) return;
      const stripQty = distToStripQty(qty, saleUnit, tabletsPerStrip, stripsPerBox);
      const freeStrip =
        freeQty > 0 ? distToStripQty(freeQty, saleUnit, tabletsPerStrip, stripsPerBox) : 0;
      const physicalQty = Math.max(1, stripQty + freeStrip);
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
            lines: [{ medicineId, quantity: Math.max(1, stripQty) }],
          }).catch(() => null),
        ]);

        const availLine = avail?.lines?.[0];
        const quoteLine = quote?.lines?.[0];
        const stripFromQuote =
          quoteLine?.unitPricePkr != null ? Math.round(quoteLine.unitPricePkr) : null;
        cart.updateLine(lineKey, {
          allocations: availLine?.allocations,
          availableQty: availLine?.availableQty ?? null,
          fulfillable: availLine?.fulfillable ?? null,
          shortfall: availLine?.shortfall ?? null,
          ...(stripFromQuote != null
            ? {
                stripPricePkr: stripFromQuote,
                unitPricePkr: distUnitPrice(stripFromQuote, saleUnit, tabletsPerStrip, stripsPerBox),
              }
            : {}),
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
        void enrichLine(
          line.key,
          line.medicineId,
          line.qty,
          line.name,
          line.sku,
          line.freeQty,
          line.saleUnit ?? "pata",
          line.tabletsPerStrip,
          line.stripsPerBox,
        );
      }, 550);
      qtyTimers.current.set(line.key, t);
    },
    [enrichLine],
  );

  const pendingEnrichRef = useRef<{ medicineId: string; qty: number } | null>(null);

  const addProductStable = useCallback(
    (product: SaleProductHit, qty = 1, saleUnit: DistSaleUnit = defaultSaleUnit) => {
      if (saleUi.blockZeroStockAdd && isOutOfStock(product)) {
        openPurchasingForProduct(product);
        return;
      }
      if (!customer) {
        setNotice("Select a customer first");
        setWorkspace("sell");
        setCustomerFocused(true);
        window.setTimeout(() => customerSearchRef.current?.focus(), 30);
        return;
      }
      const stripPrice = catalogPrice(product);
      const unitPrice = distUnitPrice(stripPrice, saleUnit, product.tabletsPerStrip, product.stripsPerBox);
      pendingEnrichRef.current = { medicineId: product.id, qty };
      cart.add({
        medicineId: product.id,
        name: product.name,
        sku: product.sku,
        qty,
        saleUnit,
        unitPricePkr: unitPrice,
        stripPricePkr: stripPrice,
        priceSource: "catalog",
        companyName: product.companyName,
        pack: product.pack,
        genericName: product.genericName,
        tabletsPerStrip: product.tabletsPerStrip,
        stripsPerBox: product.stripsPerBox,
        availableQty: product.availableQty ?? null,
      });
      productSearch.setQuery("");
      focusAndSelect(productSearchRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cart.add / productSearch.setQuery stable enough
    [
      customer,
      cart.add,
      productSearch.setQuery,
      saleUi.blockZeroStockAdd,
      openPurchasingForProduct,
      defaultSaleUnit,
    ],
  );

  const changeLineSaleUnit = useCallback(
    (line: SaleCartLine, nextUnit: DistSaleUnit) => {
      if (nextUnit === (line.saleUnit ?? "pata")) return;
      const nextQty = distConvertSaleQty(
        line.qty,
        line.saleUnit ?? "pata",
        nextUnit,
        line.tabletsPerStrip,
        line.stripsPerBox,
      );
      const stripPrice = line.stripPricePkr || line.unitPricePkr;
      const nextPrice = distUnitPrice(stripPrice, nextUnit, line.tabletsPerStrip, line.stripsPerBox);
      const patched: SaleCartLine = {
        ...line,
        saleUnit: nextUnit,
        qty: nextQty,
        stripPricePkr: stripPrice,
        unitPricePkr: nextPrice,
      };
      cart.updateLine(line.key, {
        saleUnit: nextUnit,
        qty: nextQty,
        stripPricePkr: stripPrice,
        unitPricePkr: nextPrice,
      });
      scheduleEnrich(patched);
    },
    [cart, scheduleEnrich],
  );

  useEffect(() => {
    const pending = pendingEnrichRef.current;
    if (!pending) return;
    const line = [...cart.lines].reverse().find((l) => l.medicineId === pending.medicineId);
    if (!line) return;
    pendingEnrichRef.current = null;
    void enrichLine(
      line.key,
      line.medicineId,
      line.qty,
      line.name,
      line.sku,
      line.freeQty,
      line.saleUnit ?? "pata",
      line.tabletsPerStrip,
      line.stripsPerBox,
    );
  }, [cart.lines, enrichLine]);

  const onBarcode = useCallback(
    (code: string) => {
      if (!customer) {
        setNotice("Select customer first, then scan");
        setWorkspace("sell");
        setCustomerFocused(true);
        window.setTimeout(() => customerSearchRef.current?.focus(), 30);
        return;
      }
      void productSearch.handleBarcode(code).then((hit) => {
        if (hit) addProductStable(hit, 1);
      });
    },
    [customer, productSearch, addProductStable],
  );

  useBarcodeScanner(onBarcode, Boolean(customer) && workspace === "sell" && !customerFocused);

  useEffect(() => {
    if (productSearch.barcodeError) setError(productSearch.barcodeError);
    if (productSearch.barcodeNotice) setNotice(productSearch.barcodeNotice);
  }, [productSearch.barcodeError, productSearch.barcodeNotice]);

  const selectCustomer = useCallback((c: SaleCustomerHit) => {
    setCustomer(c);
    setCustomerFocused(false);
    customerSearch.setQuery("");
    setCreditOverride(false);
    setCreditOverrideReason("");
    setNotice(null);
    setWorkspace("sell");
    window.setTimeout(() => focusAndSelect(productSearchRef.current), 40);
  }, [customerSearch.setQuery]);

  const buildBookBody = useCallback(
    (submit: boolean, idempotencyKey?: string, billDiscountPkr?: number) => {
      if (!branch || !customer) return null;
      return {
        branchCode: branch.code,
        tradeCustomerId: customer.id,
        warehouseId: warehouseId || undefined,
        salesmanEmployeeId: salesmanEmployeeId || undefined,
        submit,
        paymentMethod,
        creditOverride: paymentMethod === "Credit" && creditOverride ? true : undefined,
        creditOverrideReason:
          paymentMethod === "Credit" && creditOverride
            ? creditOverrideReason.trim() || undefined
            : undefined,
        idempotencyKey,
        taxPkr: billTaxPkr || undefined,
        discountPkr: billDiscountPkr && billDiscountPkr > 0 ? Math.round(billDiscountPkr) : undefined,
        notes: billServicePkr > 0 ? `[[svc:${billServicePkr}]]` : undefined,
        lines: cart.lines.map((l) => bookLinePayload(l)),
      };
    },
    [
      branch,
      customer,
      warehouseId,
      salesmanEmployeeId,
      paymentMethod,
      creditOverride,
      creditOverrideReason,
      cart.lines,
      billTaxPkr,
      billServicePkr,
    ],
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
    const body = buildBookBody(false, crypto.randomUUID());
    if (!body) return;

    if (shouldSaveSaleOffline()) {
      const entry = enqueueDistOfflineSale({
        ...body,
        customerName: customer.name,
        totalPkr: cart.totals.net,
      });
      setNotice(`Held offline ${pendingDistOfflineLabel(entry)} — will sync when online`);
      cart.clear();
      setCreditOverride(false);
      return;
    }

    try {
      const order = await bookSale(body);
      setNotice(`Held ${order.orderNumber ?? "draft"} (local backup saved)`);
      cart.clear();
      setCreditOverride(false);
      invalidate();
      void held.refetch();
    } catch (err) {
      if (shouldSaveSaleOffline(err)) {
        const entry = enqueueDistOfflineSale({
          ...body,
          customerName: customer.name,
          totalPkr: cart.totals.net,
        });
        setNotice(`Held offline ${pendingDistOfflineLabel(entry)} — will sync when online`);
        setError(null);
        cart.clear();
        return;
      }
      setNotice("Server hold failed — local backup saved");
      setError(err instanceof Error ? err.message : "Hold failed");
    }
  }, [branch, customer, cart, buildBookBody, persistLocalHold, invalidate, held]);

  const bookOrder = useCallback(
    async (
      opts: boolean | { print?: boolean; pay?: boolean; payDetail?: DistPayConfirmPayload } = false,
    ) => {
      const andPrint = typeof opts === "boolean" ? opts : Boolean(opts.print);
      /** Only Book & Pay settles cash / marks Paid — Book and Book & Print just book. */
      const forcePay = typeof opts === "boolean" ? false : Boolean(opts.pay);
      const payDetail = typeof opts === "boolean" ? undefined : opts.payDetail;
      const settleMethod = payDetail?.paymentMethod ?? "Cash";

      if (!branch || !customer || cart.lines.length === 0 || booking) return;
      if (!forcePay && creditBlocked) {
        setError("Credit limit exceeded — enable credit override to book");
        return;
      }
      setBooking(true);
      setError(null);
      const idempotencyKey = crypto.randomUUID();
      const body = buildBookBody(
        true,
        idempotencyKey,
        forcePay && payDetail?.discountPkr ? payDetail.discountPkr : undefined,
      );
      if (!body) {
        setBooking(false);
        return;
      }
      if (forcePay) {
        body.paymentMethod = "Cash";
        body.creditOverride = undefined;
        body.creditOverrideReason = undefined;
        if (payDetail?.notes) {
          body.notes = body.notes ? `${body.notes} · ${payDetail.notes}` : payDetail.notes;
        } else {
          body.notes = body.notes
            ? `${body.notes} · [[pay:${settleMethod}]]`
            : `[[pay:${settleMethod}]]`;
        }
      }

      const finishOffline = () => {
        const entry = enqueueDistOfflineSale({
          ...body,
          customerName: customer.name,
          totalPkr: cart.totals.net,
        });
        const label = pendingDistOfflineLabel(entry);
        setNotice(`Saved offline ${label} — Sync Center will push when online`);
        if (andPrint) {
          const salesmanName =
            (employees.data ?? []).find((e) => e.id === salesmanEmployeeId)?.name ?? undefined;
          const wh = ((warehouses.data ?? []) as { id: string; name?: string; code?: string }[]).find(
            (w) => w.id === warehouseId,
          );
          void printDistBookingSlip({
            branchName: branch.name || branch.code,
            branchCode: branch.code,
            orderNumber: label,
            customerName: customer.name,
            customerCode: customer.code ?? undefined,
            customerPhone: customer.phone ?? undefined,
            lines: cartLinesForPrint(cart.lines),
            totalPkr: cart.totals.net,
            modeLabel: forcePay ? "Offline cash pay" : "Offline booking",
            salesmanName: salesmanName || undefined,
            warehouseName: wh?.name,
            warehouseCode: wh?.code,
            paymentMethod: forcePay ? "Cash" : paymentMethod,
          }).catch(() => {
            /* print best-effort */
          });
        }
        cart.clear();
        setCreditOverride(false);
        setCreditOverrideReason("");
        localStorage.removeItem(HOLD_KEY);
      };

      try {
        if (shouldSaveSaleOffline()) {
          finishOffline();
          return;
        }

        // `/sales/book` already validates server-side — skip a separate validate round-trip.
        const order = await bookSale(body);
        let noticeMsg = `Booked ${order.orderNumber ?? "order"} (${forcePay ? "Cash" : paymentMethod})`;
        let printedInvoiceNumber: string | undefined;
        const receiptPaymentMethod = forcePay ? "Cash" : paymentMethod;

        if (forcePay && order.id) {
          try {
            // Book & Pay only: approve + cash invoice → paymentStatus paid in sales.
            const inv = await cashSettlePharmacyDistOrder(order.id);
            printedInvoiceNumber = inv.invoiceNumber ? String(inv.invoiceNumber) : undefined;
            const due = Number(inv.amountDuePkr ?? 0);
            if (due > 0 && inv.id) {
              void createPharmacyCollection({
                branchCode: branch.code,
                tradeCustomerId: customer.id,
                invoiceId: String(inv.id),
                amountPkr: due,
                paymentMethod: "Cash",
                notes: `Cash sale ${order.orderNumber ?? ""}`,
              }).catch(() => {
                /* best-effort */
              });
            }
            const session = cashSessionQuery.data;
            if (session?.id) {
              void recordCashMovement({
                branchCode: branch.code,
                sessionId: session.id,
                type: "paid_in",
                amountPkr: Number(order.totalPkr ?? billNet),
                reason: `Cash sale ${order.orderNumber ?? inv.invoiceNumber ?? ""}`,
              }).catch(() => {
                /* drawer pay-in best-effort */
              });
            }
            noticeMsg = `Paid ${order.orderNumber ?? "order"}${
              inv.invoiceNumber ? ` · ${inv.invoiceNumber}` : ""
            } · ${settleMethod} ${formatPkr(Number(order.totalPkr ?? billNet))}${
              payDetail && payDetail.discountPkr > 0
                ? ` · disc ${formatPkr(payDetail.discountPkr)}`
                : ""
            }${
              payDetail && payDetail.changePkr > 0 ? ` · change ${formatPkr(payDetail.changePkr)}` : ""
            }${
              payDetail?.bank
                ? ` · ${payDetail.bank.bankName} #${payDetail.bank.slipNo}`
                : payDetail?.card
                  ? ` · ${payDetail.card.cardType} ****${payDetail.card.last4}`
                  : ""
            } · status Paid`;
          } catch (cashErr) {
            noticeMsg = `Booked ${order.orderNumber ?? "order"} — pay failed: ${
              cashErr instanceof Error ? cashErr.message : "error"
            }`;
          }
        }

        setNotice(noticeMsg);
        setPayModal(null);
        if (andPrint) {
          try {
            const salesmanName =
              (employees.data ?? []).find((e) => e.id === salesmanEmployeeId)?.name ?? undefined;
            const wh = ((warehouses.data ?? []) as { id: string; name?: string; code?: string }[]).find(
              (w) => w.id === warehouseId,
            );
            await printDistBookingSlip({
              branchName: branch.name || branch.code,
              branchCode: branch.code,
              orderNumber: order.orderNumber ?? "BOOKING",
              customerName: customer.name,
              customerCode: customer.code ?? undefined,
              customerPhone: customer.phone ?? undefined,
              lines: cartLinesForPrint(cart.lines),
              totalPkr: order.totalPkr ?? billNet,
              modeLabel: forcePay ? "Cash sale" : "Booking",
              invoiceNumber: printedInvoiceNumber,
              salesmanName: salesmanName || undefined,
              warehouseName: wh?.name,
              warehouseCode: wh?.code,
              paymentMethod: receiptPaymentMethod,
            });
            setNotice(`${noticeMsg} — print dialog opened`);
          } catch (printErr) {
            setError(printErr instanceof Error ? printErr.message : "Print failed — sale is booked");
          }
        }
        cart.clear();
        setCreditOverride(false);
        setCreditOverrideReason("");
        localStorage.removeItem(HOLD_KEY);
        void invalidate();
        void cashSessionQuery.refetch();
      } catch (err) {
        if (shouldSaveSaleOffline(err)) {
          finishOffline();
          return;
        }
        setError(err instanceof Error ? err.message : "Book failed");
      } finally {
        setBooking(false);
      }
    },
    [
      branch,
      customer,
      cart,
      booking,
      creditBlocked,
      buildBookBody,
      invalidate,
      paymentMethod,
      cashSessionQuery,
      billNet,
      employees.data,
      warehouses.data,
      salesmanEmployeeId,
      warehouseId,
    ],
  );

  const newSale = useCallback(() => {
    cart.clear();
    setCustomer(null);
    setSalesmanEmployeeId("");
    setCreditOverride(false);
    setCreditOverrideReason("");
    setError(null);
    setNotice(null);
    setWorkspace("sell");
    setCustomerFocused(true);
    customerSearch.setQuery("");
    window.setTimeout(() => customerSearchRef.current?.focus(), 40);
  }, [cart, customerSearch.setQuery]);

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
      if (data.cart?.length) cart.replaceAll(data.cart.map((l) => normalizeCartLine(l)));
      setCustomerFocused(false);
      setWorkspace("sell");
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
          order.lines.map((l) =>
            normalizeCartLine({
              medicineId: l.medicineId,
              name: l.medicineId,
              qty: l.quantity,
              freeQty: l.freeQty ?? 0,
              unitPricePkr: l.unitPricePkr ?? 0,
              stripPricePkr: l.unitPricePkr ?? 0,
              saleUnit: "pata",
              discountPkr: 0,
              taxPkr: 0,
            }),
          ),
        );
      }
      setWorkspace("sell");
      setCustomerFocused(false);
      setNotice(`Resumed held order`);
      window.setTimeout(() => focusAndSelect(productSearchRef.current), 40);
    },
    [cart],
  );

  useSaleShortcuts({
    onCustomerFocus: () => {
      setWorkspace("sell");
      setCustomerFocused(true);
      window.setTimeout(() => customerSearchRef.current?.focus(), 30);
    },
    onProductFocus: () => {
      setWorkspace("sell");
      setCustomerFocused(false);
      focusAndSelect(productSearchRef.current);
    },
    onHold: () => void holdSale(),
    onBook: () => void bookOrder(false),
    onBookAndPrint: () => void bookOrder({ print: true }),
    onBookAndPay: () => {
      if (!customer || cart.lines.length === 0 || booking) return;
      setPayModal({ source: "cart" });
    },
    onNewSale: () => newSale(),
    onEscape: () => {
      if (customerFocused) {
        setCustomerFocused(false);
        customerSearch.setQuery("");
        return;
      }
      setWorkspace("sell");
    },
    onDeleteLine: () => cart.removeSelected(),
    onOrders: () => setWorkspace("orders"),
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
      const pay = paymentInfo(o as Record<string, unknown>);
      if (payFilter === "paid" && !pay.isPaid) return false;
      if (payFilter === "pay" && pay.isPaid) return false;
      if (payFilter === "cash" && !pay.isCash) return false;
      if (payFilter === "credit" && !pay.isCredit) return false;
      if (!q) return true;
      return String(o.orderNumber ?? "").toLowerCase().includes(q) || String(o.status ?? "").includes(q);
    });
  }, [orders.data, orderSearch, orderStatus, creditOverrideOnly, focus, payFilter]);

  const act = (p: Promise<unknown>) =>
    p
      .then(() => {
        invalidate();
        setError(null);
      })
      .catch((err: Error) => setError(err.message));

  async function payExistingOrder(
    order: {
      id: string;
      orderNumber?: string;
      status?: string;
      totalPkr?: number;
      tradeCustomerId?: string;
      amountDuePkr?: number;
      invoiceId?: string;
    },
    payDetail?: DistPayConfirmPayload,
  ) {
    if (!branch?.code) return;
    const status = String(order.status ?? "").toLowerCase();
    const settleMethod = payDetail?.paymentMethod ?? "Cash";

    if (status === "invoiced") {
      let invoiceId = order.invoiceId ? String(order.invoiceId) : "";
      let tradeCustomerId = order.tradeCustomerId ? String(order.tradeCustomerId) : "";
      let due = Number(order.amountDuePkr ?? 0);
      if (!invoiceId || due <= 0 || !tradeCustomerId) {
        const detail = (await fetchPharmacyDistOrder(order.id)) as Record<string, unknown>;
        invoiceId = String(detail.invoiceId ?? invoiceId);
        tradeCustomerId = String(detail.tradeCustomerId ?? tradeCustomerId);
        due = Number(detail.amountDuePkr ?? order.totalPkr ?? due);
      }
      if (!invoiceId || !tradeCustomerId) {
        throw new Error("Invoice not found for this order");
      }
      if (due <= 0) {
        setNotice(`${order.orderNumber ?? "Order"} already paid`);
        void invalidate();
        return;
      }
      await createPharmacyCollection({
        branchCode: branch.code,
        tradeCustomerId,
        invoiceId,
        amountPkr: payDetail?.amountPaid ?? due,
        paymentMethod: settleMethod,
        notes:
          payDetail?.notes ??
          `Pipeline pay ${order.orderNumber ?? ""}${
            payDetail && payDetail.changePkr > 0 ? ` · change ${payDetail.changePkr}` : ""
          }`,
      });
      setNotice(
        `Paid ${order.orderNumber ?? "order"} · ${settleMethod} ${formatPkr(payDetail?.amountPaid ?? due)}${
          payDetail && payDetail.changePkr > 0 ? ` · change ${formatPkr(payDetail.changePkr)}` : ""
        }`,
      );
      return;
    }

    const inv = await cashSettlePharmacyDistOrder(order.id);
    const due = Number(inv.amountDuePkr ?? 0);
    const tradeCustomerId = order.tradeCustomerId ? String(order.tradeCustomerId) : "";
    if (due > 0 && inv.id && tradeCustomerId) {
      await createPharmacyCollection({
        branchCode: branch.code,
        tradeCustomerId,
        invoiceId: String(inv.id),
        amountPkr: due,
        paymentMethod: settleMethod,
        notes: payDetail?.notes ?? `Pipeline pay ${order.orderNumber ?? ""}`,
      });
    }
    const session = cashSessionQuery.data;
    if (session?.id) {
      void recordCashMovement({
        branchCode: branch.code,
        sessionId: session.id,
        type: "paid_in",
        amountPkr: Number(order.totalPkr ?? inv.totalPkr ?? 0),
        reason: `Pay ${settleMethod} ${order.orderNumber ?? inv.invoiceNumber ?? ""}`,
      }).catch(() => {
        /* best-effort */
      });
    }
    setNotice(
      `Paid ${order.orderNumber ?? "order"}${inv.invoiceNumber ? ` · ${inv.invoiceNumber}` : ""} · ${settleMethod}${
        payDetail && payDetail.changePkr > 0 ? ` · change ${formatPkr(payDetail.changePkr)}` : ""
      } · status Paid`,
    );
  }

  async function printExisting(order: {
    id: string;
    orderNumber: string;
    totalPkr?: number;
    tradeCustomerId?: string;
  }) {
    if (!branch) return;
    try {
      const detail = await fetchPharmacyDistOrder(order.id);
      await printDistOrderReceipt(detail, {
        branchName: branch.name || branch.code,
        branchCode: branch.code,
      });
    } catch (err) {
      // Live API may not have GET :id yet — never print a fake one-line stub.
      setError(
        err instanceof Error
          ? `${err.message} — redeploy backend for full order print, or open order after deploy.`
          : "Print failed",
      );
    }
  }

  const warehouseOptions = (warehouses.data ?? []) as { id: string; name?: string; code?: string }[];
  const employeeOptions = employees.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Sale Window</h1>
            <span className="text-[11px] text-slate-500">
              F2 customer · F4 product · F8 hold · F9 book · F11 pay · F7 orders
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
                  for (const line of cart.lines) {
                    window.setTimeout(() => {
                      void enrichLine(
                        line.key,
                        line.medicineId,
                        line.qty,
                        line.name,
                        line.sku,
                        line.freeQty,
                        line.saleUnit ?? "pata",
                        line.tabletsPerStrip,
                        line.stripsPerBox,
                      );
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
            <div className="inline-flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payment</span>
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  className={`px-2.5 py-1 text-xs font-semibold ${
                    paymentMethod === "Cash"
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                  onClick={() => setPaymentMethod("Cash")}
                  title="Cash — Paid now"
                >
                  Cash · Paid
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 text-xs font-semibold ${
                    paymentMethod === "Credit"
                      ? "bg-cyan-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                  onClick={() => setPaymentMethod("Credit")}
                  title="Credit — Pay later"
                >
                  Credit · Pay
                </button>
              </div>
            </div>
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
          {cashSessionQuery.data ? (
            <DistStatusBadge status="session on" tone="success" />
          ) : (
            <Link to={`${DIST}/cash`} className="text-[11px] text-amber-700 underline dark:text-amber-300">
              Session OFF — open cash
            </Link>
          )}
          <DistButton
            variant="ghost"
            className="!py-1 text-xs"
            title="Pay In — cash into drawer"
            onClick={() => setPayInOpen(true)}
          >
            Pay In
          </DistButton>
          <DistButton
            variant="ghost"
            className="!py-1 text-xs"
            title="Pay Out — cash from drawer"
            onClick={() => setPayOutOpen(true)}
          >
            Pay Out
          </DistButton>
          <DistButton
            variant="ghost"
            className="!py-1 text-xs"
            title="Add expense to accounts"
            onClick={() => setExpenseOpen(true)}
          >
            Expense
          </DistButton>
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
            className="!py-1 text-xs"
            disabled={!customer || cart.lines.length === 0 || booking || creditBlocked}
            onClick={() => void bookOrder(false)}
          >
            {booking ? "Booking…" : "Book"}
          </DistButton>
          <DistButton
            className="!py-1 text-xs"
            disabled={!customer || cart.lines.length === 0 || booking}
            title="Book, invoice and collect cash now"
            onClick={() => {
              if (!customer || cart.lines.length === 0 || booking) return;
              setPayModal({ source: "cart" });
            }}
          >
            Book&Pay
          </DistButton>
          <DistButton
            variant="secondary"
            className="!py-1 text-xs"
            disabled={!customer || cart.lines.length === 0 || booking || creditBlocked}
            onClick={() => void bookOrder({ print: true })}
          >
            Book&Print
          </DistButton>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-800">
        {(
          [
            { id: "sell" as const, label: "Sell" },
            { id: "held" as const, label: "Held" },
            { id: "orders" as const, label: "Orders" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setWorkspace(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              workspace === tab.id
                ? "bg-cyan-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {workspace === "orders" || workspace === "held" ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/50">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payment</span>
          {(
            [
              { id: "all" as const, label: "All" },
              { id: "paid" as const, label: "Paid" },
              { id: "pay" as const, label: "Pay" },
              { id: "cash" as const, label: "Cash" },
              { id: "credit" as const, label: "Credit" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                payFilter === f.id
                  ? f.id === "paid" || f.id === "cash"
                    ? "bg-emerald-600 text-white"
                    : f.id === "pay" || f.id === "credit"
                      ? "bg-amber-600 text-white"
                      : "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              }`}
              onClick={() => setPayFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <span className="text-[10px] text-slate-500">
            Paid = settled · Pay = due · Cash / Credit = method
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="shrink-0">
          <DistErrorBanner message={error} onRetry={() => setError(null)} />
        </div>
      ) : null}
      {notice ? (
        <p className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}

      {workspace === "sell" && !customer ? (
      <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
        <div className="border-b border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-1.5 text-sm font-semibold text-slate-900 dark:text-white">
            Select customer to start sale
          </div>
          <DistInput
            ref={customerSearchRef}
            className="!py-2.5"
            placeholder="Search name, code, or phone (F2)…"
            value={customerSearch.query}
            onFocus={() => setCustomerFocused(true)}
            onChange={(e) => {
              customerSearch.setQuery(e.target.value);
              setCustomerFocused(true);
            }}
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
              }
            }}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {customerSearch.isLoading && customerSearch.results.length === 0 ? (
            <div className="p-4">
              <DistLoadingBlock label="Loading customers…" />
            </div>
          ) : customerSearch.isError && customerSearch.results.length === 0 ? (
            <DistEmptyState
              title="Could not load customers"
              description={customerSearch.error ?? "Check connection and try again."}
            />
          ) : customerSearch.results.length === 0 ? (
            <DistEmptyState
              title={customerSearch.debounced ? "No customers found" : "No customers yet"}
              description={
                customerSearch.debounced
                  ? "Try another name, code, or phone."
                  : "Add trade customers first, then return here."
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {customerSearch.results.map((c, idx) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${
                      idx === customerSearch.highlightIndex
                        ? "bg-cyan-50 dark:bg-cyan-950/40"
                        : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    }`}
                    onMouseEnter={() => customerSearch.setHighlightIndex(idx)}
                    onClick={() => selectCustomer(c)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {c.name}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {c.code ?? "—"}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                      <div>Due {formatPkr(c.outstandingPkr ?? 0)}</div>
                      {c.creditLimitPkr != null ? (
                        <div className="text-slate-400">Limit {formatPkr(c.creditLimitPkr)}</div>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      ) : null}

      {workspace === "sell" && customer ? (
      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
          <div className="shrink-0 space-y-2 border-b border-slate-200 p-2 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {customerFocused ? (
                <DistInput
                  ref={customerSearchRef}
                  className="!py-2"
                  placeholder="Change customer (F2)…"
                  value={customerSearch.query}
                  onFocus={() => setCustomerFocused(true)}
                  onChange={(e) => {
                    customerSearch.setQuery(e.target.value);
                    setCustomerFocused(true);
                  }}
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
                    } else if (e.key === "Escape") {
                      setCustomerFocused(false);
                      customerSearch.setQuery("");
                    }
                  }}
                />
              ) : (
                <>
                  <div className="min-w-0 flex-1 truncate rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-sm font-medium text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
                    {customer.name}
                    {customer.code ? (
                      <span className="ml-1.5 font-mono text-[11px] font-normal text-cyan-700 dark:text-cyan-300">
                        {customer.code}
                      </span>
                    ) : null}
                  </div>
                  <DistButton
                    variant="secondary"
                    className="!py-1 text-xs"
                    onClick={() => {
                      setCustomerFocused(true);
                      customerSearch.setQuery("");
                      window.setTimeout(() => customerSearchRef.current?.focus(), 20);
                    }}
                  >
                    Change
                  </DistButton>
                  <DistButton
                    variant="ghost"
                    className="!py-1 text-xs"
                    onClick={() => {
                      setCustomer(null);
                      cart.clear();
                      setCustomerFocused(true);
                      customerSearch.setQuery("");
                      window.setTimeout(() => customerSearchRef.current?.focus(), 20);
                    }}
                  >
                    Clear
                  </DistButton>
                </>
              )}
            </div>
            {customerFocused ? (
              <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/50">
                {customerSearch.isLoading && customerSearch.results.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-slate-500">Searching…</p>
                ) : customerSearch.results.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-slate-500">
                    {customerSearch.debounced ? "No customers found" : "Type to search customers"}
                  </p>
                ) : (
                  customerSearch.results.map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`w-full rounded-md px-2 py-1.5 text-left ${
                        idx === customerSearch.highlightIndex
                          ? "bg-cyan-100 dark:bg-cyan-950/50"
                          : "hover:bg-white dark:hover:bg-slate-800"
                      }`}
                      onMouseEnter={() => customerSearch.setHighlightIndex(idx)}
                      onClick={() => selectCustomer(c)}
                    >
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {c.code ?? "—"}
                        {c.phone ? ` · ${c.phone}` : ""}
                        {" · "}Due {formatPkr(c.outstandingPkr ?? 0)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <DistInput
                ref={productSearchRef}
                data-scan-target="true"
                className="min-w-0 flex-1 !py-2"
                placeholder="Search product / SKU / barcode (F4)…"
                value={productSearch.query}
                onChange={(e) => productSearch.setQuery(e.target.value)}
                onFocus={() => setCustomerFocused(false)}
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
              <div
                className="inline-flex shrink-0 rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950"
                role="group"
                aria-label="Sale unit"
                title="Add as Goli / Pata / Pack"
              >
                {DIST_SALE_UNITS.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    title={distSaleUnitHint(unit)}
                    aria-pressed={defaultSaleUnit === unit}
                    onClick={() => persistDefaultSaleUnit(unit)}
                    className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
                      defaultSaleUnit === unit
                        ? "bg-cyan-600 text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {distSaleUnitLabel(unit)}
                  </button>
                ))}
              </div>
              <div
                className="inline-flex shrink-0 rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950"
                role="group"
                aria-label="Product layout"
              >
                <button
                  type="button"
                  title="List view"
                  aria-pressed={productLayout === "list"}
                  onClick={() => {
                    setProductLayout("list");
                    try {
                      localStorage.setItem("dist-sale-product-layout", "list");
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`rounded px-1.5 py-1 transition ${
                    productLayout === "list"
                      ? "bg-cyan-600 text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Grid view"
                  aria-pressed={productLayout === "grid"}
                  onClick={() => {
                    setProductLayout("grid");
                    try {
                      localStorage.setItem("dist-sale-product-layout", "grid");
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`rounded px-1.5 py-1 transition ${
                    productLayout === "grid"
                      ? "bg-cyan-600 text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
            {productSearch.isLoading && !productSearch.results.length ? (
              <div className="p-3">
                <DistLoadingBlock label="Loading products…" />
              </div>
            ) : productSearch.results.length === 0 ? (
              <DistEmptyState
                title={productSearch.debounced ? "No products match" : "Search or scan a product"}
                description="Click a row to add · Enter adds highlighted · barcode scan works anytime"
              />
            ) : productLayout === "grid" ? (
              <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 xl:grid-cols-4">
                {productSearch.results.map((p, idx) => {
                  const active = idx === productSearch.highlightIndex;
                  const oos = isOutOfStock(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      title={oos ? "Out of stock — click to open purchasing" : undefined}
                      onMouseEnter={() => productSearch.setHighlightIndex(idx)}
                      onClick={() => addProductStable(p, 1)}
                      className={`rounded-md border p-2.5 text-left transition ${
                        oos
                          ? "border-red-400 bg-red-50 ring-1 ring-red-200 dark:border-red-700 dark:bg-red-950/40 dark:ring-red-900"
                          : active
                            ? "border-cyan-500 bg-cyan-50 dark:border-cyan-600 dark:bg-cyan-950/30"
                            : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:bg-slate-900/50"
                      }`}
                    >
                      <div
                        className={`line-clamp-2 text-sm font-semibold ${
                          oos ? "text-red-800 dark:text-red-200" : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {p.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-500">{p.sku ?? "—"}</div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                        {productMetaLine(p) || "—"}
                      </div>
                      <div className="mt-1 text-[10px] tabular-nums text-slate-500">{productPriceBreakdown(p)}</div>
                      <div className="mt-2 flex items-end justify-between gap-1">
                        <span
                          className={`text-[11px] font-semibold tabular-nums ${
                            oos ? "text-red-700 dark:text-red-300" : "text-slate-500"
                          }`}
                        >
                          {oos ? "Out of stock · Avail 0" : `Avail ${p.availableQty != null ? p.availableQty : "—"}`}
                        </span>
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            oos ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {formatPkr(catalogPrice(p))}
                        </span>
                      </div>
                      {oos ? (
                        <div className="mt-1 text-[10px] font-medium text-red-700 dark:text-red-300">
                          Click → Purchase order
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/90">
                  <tr>
                    <th className="px-2 py-1.5">Product</th>
                    <th className="px-2 py-1.5">Company</th>
                    <th className="px-2 py-1.5">Formula</th>
                    <th className="px-2 py-1.5">Pack</th>
                    <th className="px-2 py-1.5 text-right">Pata</th>
                    <th className="px-2 py-1.5 text-right">Goli</th>
                    <th className="px-2 py-1.5 text-right">Pack Rs</th>
                    <th className="px-2 py-1.5 text-right">Avail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {productSearch.results.map((p, idx) => {
                    const active = idx === productSearch.highlightIndex;
                    const oos = isOutOfStock(p);
                    const br = medicinePackPrices(catalogPrice(p), p.tabletsPerStrip, p.stripsPerBox);
                    return (
                      <tr
                        key={p.id}
                        title={oos ? "Out of stock — click to open purchasing" : undefined}
                        className={`cursor-pointer ${
                          oos
                            ? "bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60"
                            : active
                              ? "bg-cyan-50 dark:bg-cyan-950/30"
                              : "hover:bg-slate-50 dark:hover:bg-slate-900/40"
                        }`}
                        onMouseEnter={() => productSearch.setHighlightIndex(idx)}
                        onClick={() => addProductStable(p, 1)}
                      >
                        <td className="px-2 py-1.5">
                          <div
                            className={`font-medium ${
                              oos ? "text-red-800 dark:text-red-200" : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {p.name}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">{p.sku ?? "—"}</div>
                          {oos ? (
                            <div className="text-[10px] font-medium text-red-700">→ Purchase</div>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300">
                          {p.companyName ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300">
                          {p.genericName ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600">
                          {formatPackLabel(p.tabletsPerStrip, p.stripsPerBox)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {formatPkr(br.pataPkr)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs text-slate-600 dark:text-slate-300">
                          {formatPkr(br.goliPkr)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs text-slate-600 dark:text-slate-300">
                          {formatPkr(br.packPkr)}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right tabular-nums text-xs font-semibold ${
                            oos ? "text-red-700 dark:text-red-300" : "text-slate-600"
                          }`}
                        >
                          {p.availableQty != null ? p.availableQty : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Right: cart — scrolls when totals/actions exceed viewport */}
        <aside className="flex min-h-0 flex-col overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
          <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 bg-white px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cart</div>
              <div className="truncate text-[10px] text-slate-500">
                Add as {distSaleUnitLabel(defaultSaleUnit)} · change per line
              </div>
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {customer?.name ?? "No customer"}
              </div>
            </div>
            <div
              className="inline-flex shrink-0 rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950"
              role="group"
              aria-label="Cart layout"
            >
              <button
                type="button"
                title="List view"
                aria-pressed={cartLayout === "list"}
                onClick={() => {
                  setCartLayout("list");
                  try {
                    localStorage.setItem("dist-sale-cart-layout", "list");
                  } catch {
                    /* ignore */
                  }
                }}
                className={`rounded px-1.5 py-1 transition ${
                  cartLayout === "list"
                    ? "bg-cyan-600 text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                title="Grid view"
                aria-pressed={cartLayout === "grid"}
                onClick={() => {
                  setCartLayout("grid");
                  try {
                    localStorage.setItem("dist-sale-cart-layout", "grid");
                  } catch {
                    /* ignore */
                  }
                }}
                className={`rounded px-1.5 py-1 transition ${
                  cartLayout === "grid"
                    ? "bg-cyan-600 text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
            </div>
          </div>
          <div
            className={`shrink-0 p-2 ${
              cartLayout === "grid"
                ? "grid grid-cols-2 gap-1.5 content-start"
                : "space-y-1.5"
            }`}
          >
            {cart.lines.length === 0 ? (
              <DistEmptyState title="Cart empty" description="Search or scan to add lines." />
            ) : (
              cart.lines.map((l) => {
                const batch = formatBatchSummary(l);
                const selected = cart.selectedKey === l.key;
                const saleUnit = l.saleUnit ?? "pata";
                const strip = l.stripPricePkr > 0 ? l.stripPricePkr : l.unitPricePkr;
                return (
                  <div
                    key={l.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => cart.setSelectedKey(l.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") cart.setSelectedKey(l.key);
                    }}
                    className={`min-w-0 rounded-md border p-2 ${
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
                        <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">
                          {[
                            l.companyName ? `Co: ${l.companyName}` : null,
                            l.genericName ? `Formula: ${l.genericName}` : null,
                            formatPackLabel(l.tabletsPerStrip, l.stripsPerBox),
                          ]
                            .filter(Boolean)
                            .join(" · ") || null}
                        </div>
                        {(() => {
                          const br = medicinePackPrices(strip, l.tabletsPerStrip, l.stripsPerBox);
                          return (
                            <div className="mt-0.5 text-[10px] tabular-nums text-slate-500">
                              Pata {formatPkr(br.pataPkr)} · Goli {formatPkr(br.goliPkr)} · Pack{" "}
                              {formatPkr(br.packPkr)}
                            </div>
                          );
                        })()}
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
                    <div
                      className="mt-1.5 inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900/60"
                      role="group"
                      aria-label="Line sale unit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {DIST_SALE_UNITS.map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          title={distSaleUnitHint(unit, l.tabletsPerStrip, l.stripsPerBox)}
                          aria-pressed={saleUnit === unit}
                          onClick={() => changeLineSaleUnit(l, unit)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            saleUnit === unit
                              ? "bg-cyan-600 text-white"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                          }`}
                        >
                          {distSaleUnitLabel(unit)}
                        </button>
                      ))}
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
                        <span className="text-[10px] text-slate-400">
                          {distSaleUnitLabel(saleUnit)} @ {formatPkr(l.unitPricePkr)}
                        </span>
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
          <div className="shrink-0 space-y-1 border-t border-slate-200 bg-white p-2.5 text-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-1.5 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-[10px] leading-snug text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
              POS rates: service {posSettings.servicePct}% · default tax {posSettings.taxPct}% · cash{" "}
              {posSettings.cashTaxPct}% · card {posSettings.cardTaxPct}%
              {!posSettings.taxEnabled ? " · tax off" : ""}
            </div>
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
            {billServicePct > 0 ? (
              <div className="flex justify-between text-xs text-slate-500">
                <span>Service {billServicePct}%</span>
                <span className="tabular-nums">{formatPkr(billServicePkr)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-xs text-slate-500">
              <span>
                Tax {billTaxPct}%
                {paymentMethod === "Cash" ? " · Cash" : " · Credit"}
              </span>
              <span className="tabular-nums">{formatPkr(billTaxPkr)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Net</span>
              <span className="tabular-nums">{formatPkr(billNet)}</span>
            </div>
            {customer && paymentMethod === "Credit" && creditLimit > 0 ? (
              <div
                className={`flex justify-between text-xs ${
                  creditRisk ? "font-medium text-red-700 dark:text-red-300" : "text-slate-500"
                }`}
              >
                <span>Projected due</span>
                <span className="tabular-nums">{formatPkr(projectedOutstanding)}</span>
              </div>
            ) : null}
            {customer ? (
              <div className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
                <span className="font-medium text-slate-800 dark:text-slate-100">Book</span> = order only ·{" "}
                <span className="font-medium text-slate-800 dark:text-slate-100">Book & Print</span> = slip ·{" "}
                <span className="font-medium text-emerald-700 dark:text-emerald-300">Book & Pay</span> = payment
                popup → Paid
                {paymentMethod === "Cash"
                  ? ` · service ${billServicePct}% · tax ${billTaxPct}% · ${formatPkr(billNet)}`
                  : ""}
              </div>
            ) : null}
            {paymentMethod === "Credit" && creditRisk ? (
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
              className="w-full !py-2"
              disabled={!customer || cart.lines.length === 0 || booking}
              title="Invoice and collect cash payment now"
              onClick={() => {
                if (!customer || cart.lines.length === 0 || booking) return;
                setPayModal({ source: "cart" });
              }}
            >
              {booking ? "Paying…" : "Book & Pay (F11)"}
            </DistButton>
            <DistButton
              variant="secondary"
              className="w-full !py-1.5"
              disabled={!customer || cart.lines.length === 0 || booking || creditBlocked}
              onClick={() => void bookOrder({ print: true })}
            >
              Book & Print (F10)
            </DistButton>
          </div>
        </aside>
      </div>
      ) : null}

      {workspace === "held" ? (
        <section className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Held sales</div>
              <div className="text-[11px] text-slate-500">Tap Resume to continue on Sell</div>
            </div>
            <DistButton variant="secondary" className="!py-1 text-xs" onClick={() => setWorkspace("sell")}>
              Back to Sell
            </DistButton>
          </div>
          <DistButton variant="secondary" className="!py-1.5 text-xs" onClick={restoreLocalHold}>
            Restore local hold
          </DistButton>
          {held.isLoading ? <DistLoadingBlock label="Loading held…" /> : null}
          {(held.data ?? []).length === 0 && !held.isLoading ? (
            <DistEmptyState title="No server held drafts" description="Hold from Sell tab saves a draft here." />
          ) : (
            (held.data ?? [])
              .filter((h) => {
                if (payFilter === "all") return true;
                const pay = paymentInfo(h as Record<string, unknown>);
                if (payFilter === "paid") return pay.isPaid;
                if (payFilter === "pay") return !pay.isPaid;
                if (payFilter === "cash") return pay.isCash || String(h.paymentMethod ?? "").toLowerCase() === "cash";
                if (payFilter === "credit")
                  return pay.isCredit || String(h.paymentMethod ?? "").toLowerCase() === "credit";
                return true;
              })
              .map((h) => (
              <div
                key={h.id}
                className="rounded-md border border-slate-200 p-2 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{h.orderNumber ?? h.id}</div>
                    <div className="text-[11px] text-slate-500">
                      {customerDisplayName(h)} · {formatPkr(h.totalPkr ?? 0)}
                    </div>
                    {saleUi.showHeldPayment ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                          Not paid · Pay
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {h.paymentMethod ? String(h.paymentMethod) : "—"}
                        </span>
                        {h.createdAt ? (
                          <span className="text-slate-400">
                            {new Date(String(h.createdAt)).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
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
        </section>
      ) : null}

      {workspace === "orders" ? (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <div>
              <div className="text-sm font-semibold">Orders pipeline</div>
              <div className="text-[11px] text-slate-500">
                Approve · reserve · invoice · print · pay
                {saleUi.showOrdersPayment ? " · paid status" : ""}
                {saleUi.showOrdersHistory ? " · history" : ""}
              </div>
            </div>
            <DistButton variant="secondary" className="!py-1 text-xs" onClick={() => setWorkspace("sell")}>
              Back to Sell
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
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {filteredOrders.map((o) => {
              const row = o as Record<string, unknown>;
              const pay = paymentInfo(row);
              return (
              <div key={o.id} className="rounded-md border border-slate-200 p-2.5 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{o.orderNumber}</div>
                    <div className="text-xs text-slate-500">{formatPkr(Number(o.totalPkr ?? 0))}</div>
                    {saleUi.showOrdersPayment ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            pay.paidTone === "success"
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                              : pay.paidTone === "warning"
                                ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {pay.paidLabel}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            pay.methodLabel === "Cash"
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                              : pay.methodLabel === "Credit"
                                ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {pay.methodLabel}
                        </span>
                      </div>
                    ) : null}
                    {saleUi.showOrdersHistory ? (
                      <div className="mt-1 text-[10px] leading-snug text-slate-500">
                        {orderHistoryLine(row)}
                      </div>
                    ) : null}
                  </div>
                  <DistStatusBadge status={o.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(NEXT_ACTIONS[o.status] ?? [])
                    .filter((a) => (a.kind === "pay" ? !pay.isPaid : true))
                    .map((a) => (
                    <DistButton
                      key={a.label}
                      variant={a.kind === "pay" ? "primary" : "secondary"}
                      className="!py-1 text-xs"
                      onClick={() => {
                        if (a.kind === "pay") {
                          setPayModal({
                            source: "order",
                            order: {
                              id: o.id,
                              orderNumber: o.orderNumber,
                              status: o.status,
                              totalPkr: Number(o.totalPkr ?? 0),
                              tradeCustomerId: o.tradeCustomerId
                                ? String(o.tradeCustomerId)
                                : undefined,
                              amountDuePkr:
                                row.amountDuePkr != null ? Number(row.amountDuePkr) : undefined,
                              invoiceId: row.invoiceId != null ? String(row.invoiceId) : undefined,
                              customerName:
                                row.customerName != null ? String(row.customerName) : undefined,
                            },
                          });
                        } else if (a.kind === "approve") act(approvePharmacyDistOrder(o.id));
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
            );
            })}
            {filteredOrders.length === 0 ? <DistEmptyState title="No matching orders" /> : null}
          </div>
        </section>
      ) : null}

      {payModal ? (
        <DistPayModal
          title={payModal.source === "cart" ? "Book & Pay" : "Collect payment"}
          customerName={
            payModal.source === "cart"
              ? customer?.name
              : payModal.order.customerName ?? customer?.name
          }
          orderNumber={payModal.source === "order" ? payModal.order.orderNumber : undefined}
          subtotal={
            payModal.source === "cart"
              ? cart.totals.subtotal
              : Number(payModal.order.totalPkr ?? 0)
          }
          discount={payModal.source === "cart" ? cart.totals.discount : 0}
          freeUnits={payModal.source === "cart" ? cart.totals.freeUnits : 0}
          servicePct={payModal.source === "cart" ? billServicePct : 0}
          servicePkr={payModal.source === "cart" ? billServicePkr : 0}
          taxPct={payModal.source === "cart" ? billTaxPct : 0}
          taxPkr={payModal.source === "cart" ? billTaxPkr : 0}
          total={
            payModal.source === "cart" ? billNet : Number(payModal.order.amountDuePkr ?? payModal.order.totalPkr ?? 0)
          }
          settings={saleUi}
          isSubmitting={booking}
          onClose={() => {
            if (!booking) setPayModal(null);
          }}
          onConfirm={(payload) => {
            if (payModal.source === "cart") {
              void bookOrder({ pay: true, payDetail: payload });
              return;
            }
            const order = payModal.order;
            setBooking(true);
            act(
              payExistingOrder(order, payload).finally(() => {
                setBooking(false);
                setPayModal(null);
              }),
            );
          }}
        />
      ) : null}
      {payInOpen ? (
        <PosPayInModal
          onClose={() => setPayInOpen(false)}
          onSuccess={(message) => {
            setNotice(message);
            setError(null);
            void cashSessionQuery.refetch();
          }}
        />
      ) : null}
      {payOutOpen ? (
        <PosPayOutModal
          onClose={() => setPayOutOpen(false)}
          onSuccess={(message) => {
            setNotice(message);
            setError(null);
            void cashSessionQuery.refetch();
          }}
        />
      ) : null}
      {expenseOpen ? (
        <PosCreateAccountModal
          initialKind="expense"
          onClose={() => setExpenseOpen(false)}
          onSuccess={(message) => {
            setNotice(message);
            setError(null);
          }}
        />
      ) : null}
    </div>
  );
}
