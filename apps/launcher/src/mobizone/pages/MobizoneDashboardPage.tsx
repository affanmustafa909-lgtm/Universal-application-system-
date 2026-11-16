import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMobizoneBranchCode, useMobizoneDb } from "../hooks/useMobizone";
import { syncMobizoneLedgerNow } from "../lib/mobizoneLedgerSync";
import {
  bankLedgerName,
  formatPkr,
  getCashBankBalances,
  getMobizoneDashboard,
  getPositionMoneyHistory,
  getTotalPosition,
  isLivePurchase,
  isLiveSale,
  seedFriendlyDefaults,
  type PositionMoneyLine,
} from "../lib/mobizoneStore";
import {
  MzPage,
  MzScreenTitle,
  MzSecondaryButton,
  MzStat,
} from "../ui/MobizoneUi";

export function MobizoneDashboardPage(): JSX.Element {
  const branchCode = useMobizoneBranchCode();
  const { db, refresh, ready } = useMobizoneDb();
  const m = branchCode ? getMobizoneDashboard(branchCode) : null;
  const money = useMemo(() => getCashBankBalances(db), [db]);
  const position = useMemo(() => getTotalPosition(db), [db]);
  const moneyLines = useMemo(() => getPositionMoneyHistory(db, 60), [db]);
  const [txFilter, setTxFilter] = useState<"all" | "cash_in" | "cash_out" | "bank_in" | "bank_out">(
    "all",
  );
  const [selectedTx, setSelectedTx] = useState<PositionMoneyLine | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const looksEmpty =
    ready &&
    db.devices.length === 0 &&
    db.sales.length === 0 &&
    db.purchases.length === 0 &&
    !(db.cashOpeningBalancePkr > 0);

  const salesAgg = useMemo(() => {
    const live = db.sales.filter(isLiveSale);
    const total = live.reduce((n, s) => n + (s.pricePkr || 0), 0);
    const received = live.reduce(
      (n, s) => n + ((s.payment?.cashPkr || 0) + (s.payment?.bankPkr || 0)),
      0,
    );
    return { total, received, remaining: Math.max(0, total - received) };
  }, [db.sales]);

  const purchaseAgg = useMemo(() => {
    const live = db.purchases.filter(isLivePurchase);
    const total = live.reduce((n, p) => n + (p.purchasePricePkr || 0), 0);
    const paid = live.reduce(
      (n, p) => n + ((p.payment?.cashPkr || 0) + (p.payment?.bankPkr || 0)),
      0,
    );
    return { total, paid, remaining: Math.max(0, total - paid) };
  }, [db.purchases]);

  const filteredTx = useMemo(() => {
    return moneyLines.filter((line) => {
      if (txFilter === "cash_in") return line.cashInPkr > 0;
      if (txFilter === "cash_out") return line.cashOutPkr > 0;
      if (txFilter === "bank_in") return line.bankInPkr > 0;
      if (txFilter === "bank_out") return line.bankOutPkr > 0;
      return true;
    });
  }, [moneyLines, txFilter]);

  useEffect(() => {
    if (!branchCode) return;
    seedFriendlyDefaults(branchCode);
    refresh();
  }, [branchCode, refresh]);

  async function onSyncCloud(): Promise<void> {
    if (!branchCode || syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncMobizoneLedgerNow(branchCode);
      refresh();
      if (result === "pulled") setSyncMsg("Synced from cloud — laptop/mobile data loaded.");
      else if (result === "pushed") setSyncMsg("Pushed this device’s ledger to cloud.");
      else if (result === "ok") setSyncMsg("Already in sync.");
      else setSyncMsg("Cloud unreachable — local data still safe on this device.");
    } catch {
      setSyncMsg("Sync failed — check internet, then retry.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <MzPage>
      <MzScreenTitle
        title="Financial Dashboard"
        subtitle="Cash · Bank · Investment · Cash In/Out — one place. Sale/Purchase from side menu."
      />

      <div className="flex flex-wrap items-center gap-2">
        <MzSecondaryButton onClick={() => void onSyncCloud()} disabled={syncing || !branchCode}>
          {syncing ? "Syncing…" : "Sync laptop ↔ mobile"}
        </MzSecondaryButton>
        {syncMsg ? <p className="text-xs text-[var(--mz-muted,#64748b)]">{syncMsg}</p> : null}
      </div>
      {looksEmpty ? (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          Dashboard is Rs 0 because this device has no ledger yet. Tap <strong>Sync laptop ↔ mobile</strong> after
          saving data on the other device, or add a purchase/sale here.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MzStat label="Cash in Hand" value={formatPkr(money.cash)} />
        <MzStat label="Bank Balance" value={formatPkr(money.bank)} />
        <MzStat label="Total Balance" value={formatPkr(money.cash + money.bank)} />
      </div>

      <div className="mz-balance-hero mz-balance-hero--dynamic">
        <p className="mz-balance-label">Investment (separate)</p>
        <p className="mz-balance-value">{formatPkr(position.investmentPkr)}</p>
        <p className="mz-balance-sub">Cash capital + Bank capital + Stock (maal) value</p>
        <div className="mz-position-cards">
          <div className="mz-position-card mz-position-card--cash">
            <span>Cash capital</span>
            <strong>{formatPkr(position.cashPkr)}</strong>
          </div>
          <div className="mz-position-card mz-position-card--bank">
            <span>Bank capital</span>
            <strong>{formatPkr(position.bankPkr)}</strong>
          </div>
          <div className="mz-position-card mz-position-card--stock">
            <span>Stock value</span>
            <strong>{formatPkr(position.stockValuePkr)}</strong>
          </div>
          <div className="mz-position-card">
            <span>Phones in stock</span>
            <strong>{m?.inStock ?? "—"}</strong>
          </div>
        </div>
        <div className="mz-balance-ledgers">
          <div className="mz-balance-ledger-row">
            <Link to="/pops/mobizone/banks" className="mz-balance-ledger-chip mz-balance-ledger-chip--bank">
              <span className="mz-balance-ledger-name">Investment / capital</span>
              <span className="mz-balance-ledger-amt">Open →</span>
            </Link>
            <Link to="/pops/mobizone/money-ledger?kind=cash" className="mz-balance-ledger-chip">
              <span className="mz-balance-ledger-name">Cash Ledger</span>
              <span className="mz-balance-ledger-amt">{formatPkr(money.cash)}</span>
            </Link>
            {db.bankAccounts.map((a) => (
              <Link
                key={a.id}
                to={`/pops/mobizone/money-ledger?kind=bank&accountId=${a.id}`}
                className="mz-balance-ledger-chip mz-balance-ledger-chip--bank"
              >
                <span className="mz-balance-ledger-name">{bankLedgerName(a)}</span>
                <span className="mz-balance-ledger-amt">
                  {formatPkr(money.byAccount[a.id] ?? a.openingBalancePkr ?? 0)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" className="mz-quick-card text-left" onClick={() => setTxFilter("cash_in")}>
          <span className="mz-quick-title">Cash In</span>
          <span className="mz-quick-note">Sales received in cash</span>
        </button>
        <button type="button" className="mz-quick-card text-left" onClick={() => setTxFilter("bank_in")}>
          <span className="mz-quick-title">Bank In</span>
          <span className="mz-quick-note">Sales received in bank</span>
        </button>
        <button type="button" className="mz-quick-card text-left" onClick={() => setTxFilter("cash_out")}>
          <span className="mz-quick-title">Cash Out</span>
          <span className="mz-quick-note">Purchases paid cash</span>
        </button>
        <button type="button" className="mz-quick-card text-left" onClick={() => setTxFilter("bank_out")}>
          <span className="mz-quick-title">Bank Out</span>
          <span className="mz-quick-note">Purchases paid bank</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="mz-quick-card">
          <span className="mz-quick-title">Sales (live)</span>
          <span className="mz-quick-note">
            Total {formatPkr(salesAgg.total)} · Received {formatPkr(salesAgg.received)} · Receivable{" "}
            {formatPkr(salesAgg.remaining)}
          </span>
        </div>
        <div className="mz-quick-card">
          <span className="mz-quick-title">Purchases (live)</span>
          <span className="mz-quick-note">
            Total {formatPkr(purchaseAgg.total)} · Paid {formatPkr(purchaseAgg.paid)} · Payable{" "}
            {formatPkr(purchaseAgg.remaining)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <MzStat label="Today sales" value={m ? formatPkr(m.todaySalesPkr) : "—"} />
        <MzStat label="Today buy" value={m ? formatPkr(m.todayPurchasesPkr) : "—"} />
        <MzStat label="Today profit" value={m ? formatPkr(m.todayProfitPkr) : "—"} />
        <MzStat label="Receivable" value={m ? formatPkr(m.pendingReceivablesPkr) : "—"} />
      </div>

      <p className="mz-section-title" style={{ marginBottom: "-0.35rem" }}>
        Transaction history
        {txFilter !== "all" ? (
          <button type="button" className="ml-2 text-sm font-normal underline" onClick={() => setTxFilter("all")}>
            Show all
          </button>
        ) : null}
      </p>
      <div className="mz-receive-panel">
        {filteredTx.length === 0 ? (
          <p className="mz-receive-empty">No transactions yet</p>
        ) : (
          <ul className="mz-receive-list">
            {filteredTx.slice(0, 25).map((line) => (
              <li key={line.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 text-left"
                  onClick={() => setSelectedTx(line)}
                >
                  <span className="mz-receive-label">{line.label}</span>
                  <span className="mz-receive-amt">
                    {line.cashInPkr > 0 ? `Cash In ${formatPkr(line.cashInPkr)} · ` : ""}
                    {line.cashOutPkr > 0 ? `Cash Out ${formatPkr(line.cashOutPkr)} · ` : ""}
                    {line.bankInPkr > 0 ? `Bank In ${formatPkr(line.bankInPkr)} · ` : ""}
                    {line.bankOutPkr > 0 ? `Bank Out ${formatPkr(line.bankOutPkr)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedTx ? (
        <div className="mz-quick-card" role="dialog" aria-label="Transaction detail">
          <span className="mz-quick-title">{selectedTx.label}</span>
          <span className="mz-quick-note">
            {new Date(selectedTx.at).toLocaleString()} · {selectedTx.kind}
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>Cash In: {formatPkr(selectedTx.cashInPkr)}</div>
            <div>Cash Out: {formatPkr(selectedTx.cashOutPkr)}</div>
            <div>Bank In: {formatPkr(selectedTx.bankInPkr)}</div>
            <div>Bank Out: {formatPkr(selectedTx.bankOutPkr)}</div>
            <div className="col-span-2 font-semibold">
              Total move:{" "}
              {formatPkr(
                selectedTx.cashInPkr +
                  selectedTx.cashOutPkr +
                  selectedTx.bankInPkr +
                  selectedTx.bankOutPkr,
              )}
            </div>
          </div>
          <button type="button" className="mz-btn-secondary mt-3 px-3 py-2 text-sm" onClick={() => setSelectedTx(null)}>
            Close
          </button>
        </div>
      ) : null}
    </MzPage>
  );
}
