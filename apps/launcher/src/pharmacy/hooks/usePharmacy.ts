import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString()}`;
}

export const pharmacyInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:shadow-none dark:focus:ring-emerald-500/30";

export const pharmacySelectClass = pharmacyInputClass;

export const pharmacyPanelClass =
  "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40";

export const pharmacyHeadingClass = "text-sm font-semibold text-slate-900 dark:text-slate-100";

export const pharmacyMutedClass = "text-xs text-slate-500 dark:text-slate-400";

export const pharmacyRowHoverClass =
  "hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors";

export const pharmacyRowHoverNeutralClass =
  "hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors";

/**
 * Dist list/detail queries: keep the open page fresh without a manual browser refresh.
 */
export const distLiveListOptions = {
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: 12_000,
  refetchIntervalInBackground: false,
};

export function usePharmacyAccess() {
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage =
    claims?.permissions.includes("pops.inventory.manage") || claims?.permissions.includes("*");
  return { branch, canManage };
}

/** Mark Dist/Pharmacy queries stale and refetch active ones immediately. */
export function useInvalidatePharmacy(keys?: string[][]) {
  const queryClient = useQueryClient();
  return async () => {
    if (keys?.length) {
      await Promise.all(
        keys.map((key) =>
          queryClient.invalidateQueries({ queryKey: key, refetchType: "active" }),
        ),
      );
      await Promise.all(
        keys.map((key) => queryClient.refetchQueries({ queryKey: key, type: "active" })),
      );
      return;
    }
    await queryClient.invalidateQueries({
      predicate: (q) => {
        const k0 = q.queryKey[0];
        return k0 === "pharmacy" || k0 === "distribution";
      },
      refetchType: "active",
    });
  };
}
