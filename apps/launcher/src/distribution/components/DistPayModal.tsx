import { useEffect, useMemo, useState } from "react";
import { formatPkr } from "../../pharmacy/hooks/usePharmacy";
import {
  distEnabledPayMethods,
  loadDistSaleWindowSettings,
  type DistPayMethod,
  type DistSaleWindowSettings,
} from "../lib/distSaleWindowSettings";
import { DistButton, DistInput } from "../ui/DistUi";

export type { DistPayMethod };

export type DistPayConfirmPayload = {
  paymentMethod: DistPayMethod;
  /** Cash tendered (may be > bill for change). */
  amountReceived: number;
  /** Amount applied to the bill (capped at total after discount). */
  amountPaid: number;
  changePkr: number;
  /** Extra bill discount entered in this popup (Rs). */
  discountPkr: number;
  /** Bank transfer details (when method = Bank). */
  bank?: {
    bankName: string;
    accountTitle?: string;
    slipNo: string;
    transferDate?: string;
  };
  /** Card details (when method = Card). */
  card?: {
    cardType: string;
    last4: string;
    authCode?: string;
  };
  notes?: string;
};

/** Flatten pay details into order/collection notes. */
export function formatDistPayDetailNotes(payload: DistPayConfirmPayload): string {
  const bits: string[] = [`[[pay:${payload.paymentMethod}]]`];
  if (payload.paymentMethod === "Bank" && payload.bank) {
    bits.push(`Bank: ${payload.bank.bankName}`);
    if (payload.bank.accountTitle) bits.push(`Title: ${payload.bank.accountTitle}`);
    bits.push(`Slip: ${payload.bank.slipNo}`);
    if (payload.bank.transferDate) bits.push(`Date: ${payload.bank.transferDate}`);
  }
  if (payload.paymentMethod === "Card" && payload.card) {
    bits.push(`Card: ${payload.card.cardType}`);
    bits.push(`****${payload.card.last4}`);
    if (payload.card.authCode) bits.push(`Auth: ${payload.card.authCode}`);
  }
  if (payload.discountPkr > 0) bits.push(`Discount ${payload.discountPkr}`);
  if (payload.notes?.trim()) bits.push(payload.notes.trim());
  return bits.join(" · ");
}

const CARD_TYPES = ["Visa", "Mastercard", "UnionPay", "Other"] as const;

type Props = {
  title?: string;
  customerName?: string | null;
  orderNumber?: string | null;
  /** Line / cart subtotal before service & tax. */
  subtotal: number;
  /** Existing cart/line discount already in the bill. */
  discount?: number;
  freeUnits?: number;
  servicePct?: number;
  servicePkr?: number;
  taxPct?: number;
  taxPkr?: number;
  /** Final amount due before popup discount. */
  total: number;
  /** Override settings (defaults to loadDistSaleWindowSettings). */
  settings?: DistSaleWindowSettings;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: DistPayConfirmPayload) => void;
};

/**
 * Distribution Pay popup — restaurant-style checkout, wholesale fields.
 * Bank / Card / Discount visibility comes from Dist Sale Window settings.
 */
export function DistPayModal({
  title = "Collect payment",
  customerName,
  orderNumber,
  subtotal,
  discount = 0,
  freeUnits = 0,
  servicePct = 0,
  servicePkr = 0,
  taxPct = 0,
  taxPkr = 0,
  total,
  settings: settingsProp,
  isSubmitting = false,
  onClose,
  onConfirm,
}: Props): JSX.Element {
  const settings = settingsProp ?? loadDistSaleWindowSettings();
  const methods = useMemo(() => distEnabledPayMethods(settings), [settings]);
  const allowDiscount = settings.allowPayDiscount;
  const maxDiscountPct = settings.maxDiscountPct;

  const baseTotal = Math.max(0, Math.round(total));
  const [method, setMethod] = useState<DistPayMethod>(methods[0] ?? "Cash");
  const [discountInput, setDiscountInput] = useState("0");
  const [discountMode, setDiscountMode] = useState<"rs" | "pct">("rs");
  const [receivedInput, setReceivedInput] = useState(String(baseTotal));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [slipNo, setSlipNo] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cardType, setCardType] = useState<string>("Visa");
  const [cardLast4, setCardLast4] = useState("");
  const [authCode, setAuthCode] = useState("");

  useEffect(() => {
    if (!methods.includes(method)) setMethod(methods[0] ?? "Cash");
  }, [methods, method]);

  const extraDiscount = useMemo(() => {
    if (!allowDiscount) return 0;
    const raw = Math.max(0, Number(discountInput) || 0);
    if (discountMode === "pct") {
      const capped = Math.min(maxDiscountPct, raw);
      return Math.min(baseTotal, Math.round((baseTotal * capped) / 100));
    }
    const maxRs = Math.round((baseTotal * maxDiscountPct) / 100);
    return Math.min(baseTotal, Math.round(raw), maxRs);
  }, [allowDiscount, discountInput, discountMode, baseTotal, maxDiscountPct]);

  const billTotal = Math.max(0, baseTotal - extraDiscount);

  useEffect(() => {
    setReceivedInput(String(billTotal));
    setError(null);
  }, [billTotal, method]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !isSubmitting) {
        e.preventDefault();
        handleConfirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, isSubmitting, method, receivedInput, notes, billTotal, extraDiscount]);

  const received = Math.max(0, Math.round(Number(receivedInput) || 0));
  const change = useMemo(() => Math.max(0, received - billTotal), [received, billTotal]);
  const short = useMemo(() => Math.max(0, billTotal - received), [received, billTotal]);

  function handleConfirm(): void {
    if (method === "Bank") {
      if (!bankName.trim()) {
        setError("Bank name required");
        return;
      }
      if (!slipNo.trim()) {
        setError("Slip / transfer reference required");
        return;
      }
    }
    if (method === "Card") {
      const last4 = cardLast4.replace(/\D/g, "");
      if (last4.length !== 4) {
        setError("Enter last 4 digits of the card");
        return;
      }
    }

    const bank =
      method === "Bank"
        ? {
            bankName: bankName.trim(),
            accountTitle: accountTitle.trim() || undefined,
            slipNo: slipNo.trim(),
            transferDate: transferDate || undefined,
          }
        : undefined;
    const card =
      method === "Card"
        ? {
            cardType: cardType || "Other",
            last4: cardLast4.replace(/\D/g, "").slice(-4),
            authCode: authCode.trim() || undefined,
          }
        : undefined;

    const basePayload = {
      paymentMethod: method,
      discountPkr: extraDiscount,
      bank,
      card,
      notes: notes.trim() || undefined,
    } as const;

    if (billTotal <= 0 && extraDiscount >= baseTotal && baseTotal > 0) {
      setError(null);
      onConfirm({
        ...basePayload,
        amountReceived: 0,
        amountPaid: 0,
        changePkr: 0,
        notes: formatDistPayDetailNotes({
          ...basePayload,
          amountReceived: 0,
          amountPaid: 0,
          changePkr: 0,
          discountPkr: extraDiscount,
        }),
      });
      return;
    }
    if (billTotal <= 0) {
      setError("Nothing to collect");
      return;
    }
    if (method === "Cash" && received < billTotal) {
      setError(`Short ${formatPkr(short)} — enter full cash or use Bank/Card`);
      return;
    }
    setError(null);
    const amountReceived = method === "Cash" ? Math.max(received, billTotal) : billTotal;
    const changePkr = method === "Cash" ? change : 0;
    onConfirm({
      ...basePayload,
      amountReceived,
      amountPaid: billTotal,
      changePkr,
      notes: formatDistPayDetailNotes({
        ...basePayload,
        amountReceived,
        amountPaid: billTotal,
        changePkr,
        discountPkr: extraDiscount,
      }),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dist-pay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-transparent">
          <h2 id="dist-pay-title" className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Wholesale payment — methods & discount follow Sale Window settings.
          </p>
          {(customerName || orderNumber) && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
              {customerName ? (
                <span>
                  Customer: <span className="font-semibold text-slate-900 dark:text-white">{customerName}</span>
                </span>
              ) : null}
              {orderNumber ? (
                <span>
                  Order: <span className="font-mono font-semibold">{orderNumber}</span>
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-xs">
          <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatPkr(subtotal)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-slate-500">
                <span>Line discount</span>
                <span className="tabular-nums">− {formatPkr(discount)}</span>
              </div>
            ) : null}
            {freeUnits > 0 ? (
              <div className="flex justify-between text-slate-500">
                <span>Free units</span>
                <span className="tabular-nums">{freeUnits}</span>
              </div>
            ) : null}
            {servicePkr > 0 ? (
              <div className="flex justify-between text-slate-500">
                <span>Service ({servicePct}%)</span>
                <span className="tabular-nums">{formatPkr(servicePkr)}</span>
              </div>
            ) : null}
            {taxPkr > 0 ? (
              <div className="flex justify-between text-slate-500">
                <span>Tax ({taxPct}%)</span>
                <span className="tabular-nums">{formatPkr(taxPkr)}</span>
              </div>
            ) : null}
            {extraDiscount > 0 ? (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                <span>Bill discount</span>
                <span className="tabular-nums">− {formatPkr(extraDiscount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
              <span>Total due</span>
              <span className="tabular-nums text-cyan-700 dark:text-cyan-300">{formatPkr(billTotal)}</span>
            </div>
          </div>

          {allowDiscount ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  Discount (max {maxDiscountPct}%)
                </span>
                <div className="inline-flex overflow-hidden rounded border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    className={`px-2 py-0.5 text-[10px] font-semibold ${
                      discountMode === "rs" ? "bg-cyan-600 text-white" : "text-slate-500"
                    }`}
                    onClick={() => setDiscountMode("rs")}
                  >
                    Rs
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-0.5 text-[10px] font-semibold ${
                      discountMode === "pct" ? "bg-cyan-600 text-white" : "text-slate-500"
                    }`}
                    onClick={() => setDiscountMode("pct")}
                  >
                    %
                  </button>
                </div>
              </div>
              <DistInput
                className="!py-2 text-right text-sm tabular-nums"
                type="number"
                min={0}
                max={discountMode === "pct" ? maxDiscountPct : baseTotal}
                value={discountInput}
                onChange={(e) => {
                  setDiscountInput(e.target.value);
                  setError(null);
                }}
                placeholder={discountMode === "pct" ? "0 %" : "0 Rs"}
              />
            </div>
          ) : null}

          <div>
            <div className="mb-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              Payment method
            </div>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`px-3 py-1.5 text-xs font-semibold ${
                    method === m
                      ? "bg-cyan-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                  onClick={() => {
                    setMethod(m);
                    setError(null);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            {!settings.allowPayBank && !settings.allowPayCard ? (
              <p className="mt-1 text-[10px] text-slate-400">Enable Bank/Card in Settings → Sale Window.</p>
            ) : null}
          </div>

          {method === "Cash" ? (
            <label className="block text-slate-500">
              Cash received
              <DistInput
                className="mt-1 !py-2 text-right text-sm tabular-nums"
                type="number"
                min={0}
                value={receivedInput}
                onChange={(e) => {
                  setReceivedInput(e.target.value);
                  setError(null);
                }}
                autoFocus
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[billTotal, Math.ceil(billTotal / 1000) * 1000, billTotal + 500, billTotal + 1000]
                  .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
                  .slice(0, 4)
                  .map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="rounded border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-300"
                      onClick={() => {
                        setReceivedInput(String(v));
                        setError(null);
                      }}
                    >
                      {formatPkr(v)}
                    </button>
                  ))}
              </div>
              {received > 0 ? (
                <p
                  className={`mt-2 text-[11px] font-medium ${
                    short > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {short > 0
                    ? `Short ${formatPkr(short)}`
                    : change > 0
                      ? `Change ${formatPkr(change)}`
                      : "Exact amount"}
                </p>
              ) : null}
            </label>
          ) : null}

          {method === "Bank" ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Bank transfer details
              </div>
              <label className="block text-slate-500">
                Bank name *
                <DistInput
                  className="mt-1 !py-1.5"
                  placeholder="HBL / Meezan / UBL…"
                  value={bankName}
                  onChange={(e) => {
                    setBankName(e.target.value);
                    setError(null);
                  }}
                  autoFocus
                />
              </label>
              <label className="block text-slate-500">
                Account title
                <DistInput
                  className="mt-1 !py-1.5"
                  placeholder="Account / business name"
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                />
              </label>
              <label className="block text-slate-500">
                Slip / transfer ref *
                <DistInput
                  className="mt-1 !py-1.5"
                  placeholder="Slip # or TRX ID"
                  value={slipNo}
                  onChange={(e) => {
                    setSlipNo(e.target.value);
                    setError(null);
                  }}
                />
              </label>
              <label className="block text-slate-500">
                Transfer date
                <DistInput
                  className="mt-1 !py-1.5"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </label>
              <p className="text-[10px] text-slate-500">
                {formatPkr(billTotal)} will be recorded as Bank paid in full.
              </p>
            </div>
          ) : null}

          {method === "Card" ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Card details
              </div>
              <label className="block text-slate-500">
                Card type
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value)}
                >
                  {CARD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-slate-500">
                Last 4 digits *
                <DistInput
                  className="mt-1 !py-1.5 tabular-nums"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1234"
                  value={cardLast4}
                  onChange={(e) => {
                    setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setError(null);
                  }}
                  autoFocus
                />
              </label>
              <label className="block text-slate-500">
                Auth / approval code
                <DistInput
                  className="mt-1 !py-1.5"
                  placeholder="Optional POS auth code"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                />
              </label>
              <p className="text-[10px] text-slate-500">
                {formatPkr(billTotal)} will be recorded as Card paid in full.
              </p>
            </div>
          ) : null}

          <label className="block text-slate-500">
            Extra notes (optional)
            <DistInput
              className="mt-1 !py-1.5"
              placeholder="Any other remark…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {error ? <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">{error}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-transparent">
          <DistButton variant="secondary" className="!py-2" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </DistButton>
          <DistButton className="!py-2" disabled={isSubmitting} onClick={handleConfirm}>
            {isSubmitting ? "Paying…" : `Pay ${formatPkr(billTotal)}`}
          </DistButton>
        </div>
      </div>
    </div>
  );
}
