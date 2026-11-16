import { useCallback, useEffect, useMemo, useState } from "react";
import { usePopsStore } from "../../stores/popsStore";
import {
  hydrateMobizoneDb,
  loadMobizoneDb,
  registerMobizoneLedgerSyncHooks,
  type MobizoneDb,
} from "../lib/mobizoneStore";
import {
  pullMobizoneLedgerFromCloud,
  scheduleMobizoneLedgerPush,
  setLocalLedgerRevisedAt,
} from "../lib/mobizoneLedgerSync";

registerMobizoneLedgerSyncHooks({
  setRevisedAt: setLocalLedgerRevisedAt,
  onLocalSave: scheduleMobizoneLedgerPush,
});

export function useMobizoneBranchCode(): string | null {
  return usePopsStore((s) => s.branch?.code ?? null);
}

function emptyUiDb(): MobizoneDb {
  return {
    customers: [],
    devices: [],
    sales: [],
    purchases: [],
    bankAccounts: [],
    shopkeepers: [],
    ledger: [],
    expenses: [],
    expenseAccounts: [],
    vouchers: [],
    cashOpeningBalancePkr: 0,
  };
}

/** Local-store snapshot with IndexedDB hydrate + refresh counter. */
export function useMobizoneDb(): {
  branchCode: string | null;
  db: MobizoneDb;
  refresh: () => void;
  ready: boolean;
} {
  const branchCode = useMobizoneBranchCode();
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!branchCode) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void (async () => {
      await hydrateMobizoneDb(branchCode);
      if (cancelled) return;
      try {
        const pulled = await pullMobizoneLedgerFromCloud(branchCode);
        if (pulled && !cancelled) setTick((t) => t + 1);
      } catch {
        /* offline — local IndexedDB still used */
      }
      if (cancelled) return;
      setReady(true);
      setTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [branchCode]);

  const db = useMemo((): MobizoneDb => {
    void tick;
    if (!branchCode) return emptyUiDb();
    return loadMobizoneDb(branchCode);
  }, [branchCode, tick]);

  return { branchCode, db, refresh, ready };
}
