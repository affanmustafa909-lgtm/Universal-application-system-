import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString()}`;
}

export const educationInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:shadow-none dark:focus:ring-blue-500/30";

export const educationSelectClass = educationInputClass;

export const educationPanelClass =
  "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40";

export const educationHeadingClass = "text-sm font-semibold text-slate-900 dark:text-slate-100";

export const educationMutedClass = "text-xs text-slate-500 dark:text-slate-400";

export function useEducationAccess() {
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const perms = claims?.permissions ?? [];
  const canManage =
    perms.includes("*") ||
    perms.includes("pops.settings.manage") ||
    perms.includes("pops.inventory.manage");
  return { branch, canManage };
}

export function useInvalidateEducation() {
  const queryClient = useQueryClient();
  return (extraKeys?: string[]) => {
    void queryClient.invalidateQueries({ queryKey: ["education"] });
    if (extraKeys?.length) {
      for (const key of extraKeys) {
        void queryClient.invalidateQueries({ queryKey: ["education", key] });
      }
    }
  };
}
