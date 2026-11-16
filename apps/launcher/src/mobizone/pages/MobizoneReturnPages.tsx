import { useMemo, useState } from "react";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr, returnPurchase, returnSale } from "../lib/mobizoneStore";
import { MzOptionalCameraImeiScan } from "../components/MzOptionalCameraImeiScan";
import {
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzScreenTitle,
  MzSection,
} from "../ui/MobizoneUi";

export function MobizoneSaleReturnPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.sales
      .filter((s) => !s.returnedAt && !s.deletedAt)
      .filter((s) => {
        if (!needle) return true;
        return (
          s.imei.toLowerCase().includes(needle) ||
          s.customerName.toLowerCase().includes(needle) ||
          s.brand.toLowerCase().includes(needle) ||
          s.model.toLowerCase().includes(needle) ||
          (s.customerPhone ?? "").toLowerCase().includes(needle)
        );
      });
  }, [db.sales, q]);

  function applyImei(code: string): void {
    setQ(code);
    setMsg(null);
    setErr(null);
  }

  function onReturn(saleId: string, label: string): void {
    if (!branchCode) return;
    if (
      !window.confirm(
        `Sale return: ${label}?\nPhone stock mein wapas · customer ko refund ledger.`,
      )
    ) {
      return;
    }
    try {
      returnSale(branchCode, saleId, "Sale return counter");
      setErr(null);
      setMsg("Sale return done — phone added back to stock.");
      refresh();
    } catch (e) {
      setMsg(null);
      setErr(e instanceof Error ? e.message : "Sale return failed");
    }
  }

  return (
    <MzPage>
      <MzScreenTitle
        title="Sale return"
        subtitle="Sirf IMEI scan / type karein — matching sale dikhegi, phir Return."
      />
      <MzSection title="1 · Scan / type IMEI">
        <div className="space-y-2">
          <MzField label="IMEI / customer / model">
            <MzInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Scan IMEI or type name…"
              autoFocus
              className="font-mono"
            />
          </MzField>
          <MzOptionalCameraImeiScan label="Camera scan IMEI" onDetected={applyImei} />
          <p className={`text-xs ${mutedClass}`}>
            Customer return yahan — galat entry delete ke liye Sales history → Delete use karein.
          </p>
        </div>
        {msg ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{msg}</p> : null}
        {err ? <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{err}</p> : null}
      </MzSection>

      <MzSection title={q.trim() ? `2 · Matches (${rows.length})` : "2 · Recent open sales"}>
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className={`text-sm ${mutedClass}`}>No open sales found (or already returned/deleted).</p>
          ) : null}
          {rows.slice(0, q.trim() ? 40 : 12).map((s) => (
            <article
              key={s.id}
              className={`${cardClass} flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {s.brand} {s.model}
                </p>
                <p className={`text-xs ${mutedClass}`}>
                  {s.customerName} · {s.imei} · {formatPkr(s.pricePkr)}
                </p>
                <p className={`text-xs ${mutedClass}`}>{new Date(s.createdAt).toLocaleString()}</p>
              </div>
              <MzPrimaryButton onClick={() => onReturn(s.id, `${s.brand} ${s.model} (${s.imei})`)}>
                Return sale
              </MzPrimaryButton>
            </article>
          ))}
        </div>
      </MzSection>
    </MzPage>
  );
}

export function MobizonePurchaseReturnPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.purchases
      .filter((p) => !p.returnedAt && !p.deletedAt)
      .filter((p) => {
        const device = db.devices.find((d) => d.id === p.deviceId);
        if (!device || device.status !== "in_stock") return false;
        if (!needle) return true;
        return (
          p.imei.toLowerCase().includes(needle) ||
          p.sellerName.toLowerCase().includes(needle) ||
          p.brand.toLowerCase().includes(needle) ||
          p.model.toLowerCase().includes(needle) ||
          (p.sellerPhone ?? "").toLowerCase().includes(needle)
        );
      });
  }, [db.purchases, db.devices, q]);

  function applyImei(code: string): void {
    setQ(code);
    setMsg(null);
    setErr(null);
  }

  function onReturn(purchaseId: string, label: string): void {
    if (!branchCode) return;
    if (
      !window.confirm(
        `Purchase return: ${label}?\nPhone stock se hate · seller ko amount wapas ledger.`,
      )
    ) {
      return;
    }
    try {
      returnPurchase(branchCode, purchaseId, "Purchase return counter");
      setErr(null);
      setMsg("Purchase return done — phone removed from stock.");
      refresh();
    } catch (e) {
      setMsg(null);
      setErr(e instanceof Error ? e.message : "Purchase return failed");
    }
  }

  return (
    <MzPage>
      <MzScreenTitle
        title="Purchase return"
        subtitle="IMEI scan / type — in-stock purchase dikhegi, phir Return to seller."
      />
      <MzSection title="1 · Scan / type IMEI">
        <div className="space-y-2">
          <MzField label="IMEI / seller / model">
            <MzInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Scan IMEI or type seller…"
              autoFocus
              className="font-mono"
            />
          </MzField>
          <MzOptionalCameraImeiScan label="Camera scan IMEI" onDetected={applyImei} />
          <p className={`text-xs ${mutedClass}`}>
            Seller return yahan — galat buy delete ke liye Purchase history → Delete.
          </p>
        </div>
        {msg ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{msg}</p> : null}
        {err ? <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{err}</p> : null}
      </MzSection>

      <MzSection title={q.trim() ? `2 · Matches (${rows.length})` : "2 · In-stock purchases"}>
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className={`text-sm ${mutedClass}`}>
              No returnable purchases (sold phones need sale return first).
            </p>
          ) : null}
          {rows.slice(0, q.trim() ? 40 : 12).map((p) => (
            <article
              key={p.id}
              className={`${cardClass} flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {p.brand} {p.model}
                </p>
                <p className={`text-xs ${mutedClass}`}>
                  {p.sellerName} · {p.imei} · {formatPkr(p.purchasePricePkr)}
                </p>
                <p className={`text-xs ${mutedClass}`}>{new Date(p.createdAt).toLocaleString()}</p>
              </div>
              <MzPrimaryButton
                onClick={() => onReturn(p.id, `${p.brand} ${p.model} (${p.imei})`)}
              >
                Return to seller
              </MzPrimaryButton>
            </article>
          ))}
        </div>
      </MzSection>
    </MzPage>
  );
}
