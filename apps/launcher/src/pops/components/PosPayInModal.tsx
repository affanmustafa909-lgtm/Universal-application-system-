import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchOpenCashSession, recordCashMovement } from "../api/accounting";
import { formatPkr } from "../hooks/useAccounting";
import { fieldInputClass, modalBackdropRaisedClass } from "../lib/themeClasses";
import { printCashMovementSlip } from "../lib/printCashMovement";
import { usePopsStore } from "../../stores/popsStore";

type Props = {
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

/** Quick Pay In from POS / Sale Window — cash into the open drawer session. */
export function PosPayInModal({ onClose, onSuccess }: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
  });

  const openSession = sessionQuery.data;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!branch?.code) throw new Error("Select a branch first.");
      if (!openSession) throw new Error("Open a cash session first (Session ON / Cashier in).");
      const amountPkr = Math.round(Number(amount));
      if (!Number.isFinite(amountPkr) || amountPkr <= 0) {
        throw new Error("Amount must be greater than 0.");
      }
      const reasonText = reason.trim();
      if (!reasonText) throw new Error("Enter a reason.");
      return recordCashMovement({
        branchCode: branch.code,
        sessionId: openSession.id,
        type: "paid_in",
        amountPkr,
        reason: reasonText,
      });
    },
    onSuccess: async (row) => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      onSuccess?.(`Pay In recorded: ${formatPkr(row.amountPkr)}`);
      try {
        await printCashMovementSlip({
          branchName: branch?.name ?? "POPS",
          branchCode: branch?.code,
          sessionRef: openSession?.sessionRef,
          type: "paid_in",
          amountPkr: row.amountPkr,
          reason: row.reason,
        });
      } catch {
        /* best-effort */
      }
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className={modalBackdropRaisedClass} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pay In</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Add cash to the open drawer (float top-up, owner deposit, bank withdraw).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {sessionQuery.isLoading ? (
          <p className="mt-3 text-xs text-slate-500">Checking cash session…</p>
        ) : !openSession ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            No open session. Open Session ON / Cashier in first, then Pay In.
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-slate-500">
            Session {openSession.sessionRef} · Expected {formatPkr(openSession.liveExpectedCash)}
          </p>
        )}

        {error ? (
          <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label className="block text-xs text-slate-500">
            Amount (PKR)
            <input
              className={`${fieldInputClass} mt-1`}
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label className="block text-xs text-slate-500">
            Reason
            <input
              className={`${fieldInputClass} mt-1`}
              placeholder="e.g. Owner deposit"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!openSession || mutation.isPending}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Record Pay In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
