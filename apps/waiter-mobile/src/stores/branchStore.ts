import { create } from "zustand";
import type { PopsBranch } from "@platform/contracts";
import { secureDelete, secureGet, secureSet } from "../lib/secureStorage";

const BRANCH_KEY = "pops-waiter-branch";

type BranchState = {
  branch: PopsBranch | null;
  hydrated: boolean;
  setBranch: (branch: PopsBranch) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
};

export const useBranchStore = create<BranchState>((set) => ({
  branch: null,
  hydrated: false,

  setBranch: (branch) => {
    void secureSet(BRANCH_KEY, JSON.stringify(branch));
    set({ branch });
  },

  clear: () => {
    void secureDelete(BRANCH_KEY);
    set({ branch: null });
  },

  hydrate: async () => {
    const finish = (branch: PopsBranch | null) => set({ branch, hydrated: true });
    const watchdog = setTimeout(() => {
      if (useBranchStore.getState().hydrated) return;
      console.warn("[branchStore] hydrate watchdog — forcing empty branch");
      finish(null);
    }, 2500);

    try {
      const raw = await secureGet(BRANCH_KEY);
      clearTimeout(watchdog);
      if (!raw) {
        finish(null);
        return;
      }
      try {
        finish(JSON.parse(raw) as PopsBranch);
      } catch {
        finish(null);
      }
    } catch (err) {
      console.warn("[branchStore] hydrate failed:", err);
      clearTimeout(watchdog);
      finish(null);
    }
  },
}));
