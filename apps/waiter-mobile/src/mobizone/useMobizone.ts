import { useCallback, useEffect, useState } from "react";
import { useBranchStore } from "../stores/branchStore";
import {
  getMobizoneDashboard,
  loadMobizoneDb,
  registerMobizoneLedgerSyncHooks,
  seedFriendlyDefaults,
  type MobizoneDb,
} from "./storeCore";
import {
  pullMobizoneLedgerFromCloud,
  scheduleMobizoneLedgerPush,
  setLocalLedgerRevisedAt,
} from "./ledgerSync";
import { pullDesktopShopControl } from "./shopControlSync";
import { hydrateMobizoneStorage } from "./storage";
import type { MobizoneDashboard } from "@platform/contracts";

registerMobizoneLedgerSyncHooks({
  setRevisedAt: setLocalLedgerRevisedAt,
  onLocalSave: scheduleMobizoneLedgerPush,
});

export function useMobizoneBranchCode(): string {
  return useBranchStore((s) => s.branch?.code) ?? "MAIN";
}

export function useMobizoneDb(): {
  branchCode: string;
  db: MobizoneDb;
  ready: boolean;
  refresh: () => void;
  dashboard: MobizoneDashboard | null;
} {
  const branchCode = useMobizoneBranchCode();
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await hydrateMobizoneStorage(branchCode);
      if (!alive) return;
      seedFriendlyDefaults(branchCode);
      try {
        await pullDesktopShopControl(branchCode);
      } catch {
        /* offline / API not redeployed yet — keep local settings */
      }
      try {
        const pulled = await pullMobizoneLedgerFromCloud(branchCode);
        if (pulled && alive) setTick((n) => n + 1);
      } catch {
        /* offline — keep local AsyncStorage ledger */
      }
      if (!alive) return;
      setReady(true);
      setTick((n) => n + 1);
    })();
    return () => {
      alive = false;
    };
  }, [branchCode]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const db = ready ? loadMobizoneDb(branchCode) : loadMobizoneDb("__empty__");
  const dashboard = ready ? getMobizoneDashboard(branchCode) : null;
  void tick;

  return { branchCode, db, ready, refresh, dashboard };
}
