import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@platform/ui";
import { useMemo, useState } from "react";
import type { ClosingStatus } from "@platform/contracts";
import { closeCashSession } from "../../api/accounting";
import {
  closeDay,
  closeKitchenAtDayEnd,
  fetchClosingStatus,
  pauseOrders,
  resumeOrders,
  runZReport,
  verifyBackup,
} from "../../api/closing";
import { formatPkr, useAccountingAccess } from "../../hooks/useAccounting";
import { useActiveSystemId } from "../../../hooks/useActiveSystemId";
import { useSessionStore } from "../../../stores/sessionStore";
import { PageHeader } from "../../ui/PageHeader";

const STEP_ACTIONS: Record<string, "pause" | "kitchen" | "zreport" | "backup"> = {
  s1: "pause",
  s3: "kitchen",
  s4: "zreport",
  s5: "backup",
};

const DIST_CHECKLIST: Record<string, { label: string; hintDone?: string; hintTodo?: string }> = {
  s1: {
    label: "Stop new bookings / handover to night",
    hintDone: "New Sale Window bookings are paused.",
    hintTodo: "Pause new bookings before closing.",
  },
  s2: {
    label: "Reconcile cash & collections",
  },
  s3: {
    label: "Confirm warehouse / dispatch queue clear",
    hintDone: "Dispatch queue clear.",
    hintTodo: "Confirm packing / dispatch queue is clear.",
  },
  s4: {
    label: "Run Z-report & day sales summary",
    hintTodo: "Generate today's distribution Z-report.",
  },
  s5: {
    label: "Verify backup completed",
  },
};

function adaptClosingForDistribution(status: ClosingStatus): ClosingStatus {
  return {
    ...status,
    checklist: status.checklist.map((s) => {
      const dist = DIST_CHECKLIST[s.id];
      if (!dist) return s;
      const hint =
        s.done && dist.hintDone
          ? dist.hintDone
          : !s.done && dist.hintTodo
            ? dist.hintTodo
            : s.hint
                ?.replace(/kitchen|KOT/gi, "dispatch")
                .replace(/bill\(s\)/gi, "booking(s)")
                .replace(/PRA queue flush/gi, "day sales summary");
      return { ...s, label: dist.label, hint };
    }),
    blockers: status.blockers.map((b) =>
      b
        .replace(/Pause new orders/gi, "Pause new bookings")
        .replace(/held\/open bill/gi, "held/open booking")
        .replace(/kitchen ticket\(s\) still open/gi, "dispatch items still open"),
    ),
  };
}

export function ClosingPage(): JSX.Element {
  const systemId = useActiveSystemId();
  const isDist = systemId === "distribution" || systemId === "pharmacy";
  const { branch, canManage } = useAccountingAccess();
  const claims = useSessionStore((s) => s.claims);
  const canClose =
    canManage ||
    claims?.permissions.includes("pops.closing.report") ||
    claims?.permissions.includes("*");
  const queryClient = useQueryClient();
  const [countedCash, setCountedCash] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["closing", branch?.code, "manage"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchClosingStatus(branch!.code, { forPos: false }),
    refetchInterval: 30_000,
  });

  const status = useMemo(() => {
    const raw = statusQuery.data;
    if (!raw) return undefined;
    return isDist ? adaptClosingForDistribution(raw) : raw;
  }, [statusQuery.data, isDist]);

  const ordersPausedForToday = Boolean(status?.ordersPaused);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["closing"] });
    void queryClient.invalidateQueries({ queryKey: ["accounting"] });
    if (!isDist) {
      void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  };

  const actionMutation = useMutation({
    mutationFn: async (action: "pause" | "resume" | "kitchen" | "zreport" | "backup") => {
      if (!branch?.code) throw new Error("No branch selected");
      switch (action) {
        case "pause":
          return pauseOrders(branch.code);
        case "resume":
          return resumeOrders(branch.code);
        case "kitchen":
          return closeKitchenAtDayEnd(branch.code);
        case "zreport":
          return runZReport(branch.code).then((r) => r.status);
        case "backup":
          return verifyBackup(branch.code);
      }
    },
    onSuccess: (_data, action) => {
      setError(null);
      const labels = isDist
        ? {
            pause: "New bookings paused",
            resume: "Bookings resumed — Sale Window can take orders again",
            kitchen: "Dispatch queue confirmed clear",
            zreport: "Z-report generated — day sales summary ready",
            backup: "Backup snapshot verified",
          }
        : {
            pause: "New orders paused",
            resume: "New orders resumed — POS can take orders again",
            kitchen: "Open kitchen tickets closed",
            zreport: "Z-report generated and PRA queue flushed",
            backup: "Backup snapshot verified",
          };
      setMessage(labels[action]);
      invalidate();
    },
    onError: (err: Error) => {
      setMessage(null);
      setError(err.message);
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: ({ sessionId, counted }: { sessionId: string; counted: number }) =>
      closeCashSession(sessionId, { countedCash: counted }),
    onSuccess: () => {
      setError(null);
      setMessage("Cash session closed and reconciled");
      setCountedCash("");
      invalidate();
    },
    onError: (err: Error) => {
      setMessage(null);
      setError(err.message);
    },
  });

  const closeDayMutation = useMutation({
    mutationFn: () => {
      if (!branch?.code) throw new Error("No branch selected");
      return closeDay(branch.code);
    },
    onSuccess: (result) => {
      setError(null);
      setMessage(
        `Day ${result.businessDate} closed. Next business date: ${result.nextBusinessDate}. Z-report: ${result.zReportRef}`,
      );
      invalidate();
    },
    onError: (err: Error) => {
      setMessage(null);
      setError(err.message);
    },
  });

  const openSession = status?.openCashSession;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Backup & closing"
        subtitle={
          isDist
            ? "Distribution day-end checklist — cash session, sales summary, and backup."
            : "Shift / day-end checklist linked to live accounting and cash sessions."
        }
        actions={
          <Link
            to="/pops/accounting/reports"
            className="rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-amber-500"
          >
            Z-report / P&amp;L
          </Link>
        }
      />

      {ordersPausedForToday ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div>
            {isDist
              ? `New Sale Window bookings are paused for day closing. Business date: ${status?.businessDate}`
              : `New POS and kitchen orders are paused for day closing. Business date: ${status?.businessDate}`}
          </div>
          {canClose ? (
            <Button
              className="shrink-0 text-xs"
              disabled={actionMutation.isPending}
              onClick={() => actionMutation.mutate("resume")}
            >
              {isDist ? "Resume bookings" : "Resume orders"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Closing checklist</div>
          {statusQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-500">Loading checklist…</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(status?.checklist ?? []).map((s) => {
                const action = STEP_ACTIONS[s.id];
                // Distribution: no kitchen KOT step action
                const skipKitchen = isDist && action === "kitchen";
                const showAction = canClose && action && !s.done && s.id !== "s2" && !skipKitchen;
                return (
                  <li key={s.id}>
                    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${s.done ? "bg-emerald-500" : "border border-slate-600"}`}
                        />
                        <div>
                          <span>{s.label}</span>
                          {s.hint ? <p className="mt-0.5 text-xs text-slate-500">{s.hint}</p> : null}
                        </div>
                      </div>
                      {showAction ? (
                        <Button
                          className="shrink-0 text-xs"
                          disabled={actionMutation.isPending}
                          onClick={() => actionMutation.mutate(action)}
                        >
                          {action === "pause"
                            ? isDist
                              ? "Pause bookings"
                              : "Pause orders"
                            : action === "kitchen"
                              ? "Close KOTs"
                              : action === "zreport"
                                ? "Run Z-report"
                                : "Run backup"}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {status && status.blockers.length > 0 && !status.canCloseDay ? (
            <div className="mt-4 rounded-md border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-400">
              <div className="font-medium text-slate-300">Before closing day</div>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {status.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-sm font-medium text-white">Shift summary (live)</div>
            {statusQuery.isLoading ? (
              <p className="mt-3 text-sm text-slate-500">Loading accounting data…</p>
            ) : (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <dt>Today&apos;s sales</dt>
                  <dd className="text-white">{formatPkr(status?.shiftSummary.todaySales ?? 0)}</dd>
                </div>
                <div className="flex justify-between text-slate-400">
                  <dt>{isDist ? "Sales booked" : "Orders completed"}</dt>
                  <dd className="text-white">{status?.shiftSummary.orderCount ?? 0}</dd>
                </div>
                <div className="flex justify-between text-slate-400">
                  <dt>Cash in hand</dt>
                  <dd className="text-white">{formatPkr(status?.shiftSummary.cashInHand ?? 0)}</dd>
                </div>
                <div className="flex justify-between text-slate-400">
                  <dt>Month profit / loss</dt>
                  <dd className="text-white">{formatPkr(status?.shiftSummary.profitLoss ?? 0)}</dd>
                </div>
                <div className="flex justify-between text-slate-400">
                  <dt>Net profit (P&amp;L)</dt>
                  <dd className="text-white">{formatPkr(status?.shiftSummary.netProfit ?? 0)}</dd>
                </div>
              </dl>
            )}
          </div>

          {status?.lastZReport ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm">
              <div className="font-medium text-white">Latest Z-report — {status.lastZReport.reportRef}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
                <div>Cash sales</div>
                <div className="text-right text-slate-200">{formatPkr(status.lastZReport.cashSales)}</div>
                <div>{isDist ? "Credit / other" : "Card sales"}</div>
                <div className="text-right text-slate-200">{formatPkr(status.lastZReport.cardSales)}</div>
                <div>Tax collected</div>
                <div className="text-right text-slate-200">{formatPkr(status.lastZReport.taxCollected)}</div>
              </dl>
            </div>
          ) : null}

          {openSession && canManage ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="text-sm font-medium text-amber-200">
                Open cash session — {openSession.sessionRef}
              </div>
              <p className="mt-1 text-xs text-slate-400">Float: {formatPkr(openSession.openingFloat)}</p>
              <div className="mt-3 flex gap-2">
                <input
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  placeholder="Counted cash (PKR)"
                  type="number"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                />
                <Button
                  className="text-xs"
                  disabled={!countedCash || closeShiftMutation.isPending}
                  onClick={() =>
                    closeShiftMutation.mutate({
                      sessionId: openSession.id,
                      counted: Number(countedCash),
                    })
                  }
                >
                  Close shift
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
              {openSession
                ? "Cash session open — ask a manager to close."
                : status?.closedSessionsToday.length
                  ? `${status.closedSessionsToday.length} shift(s) reconciled today.`
                  : "No open cash session. Open one under Accounting → Cash management if needed."}
            </div>
          )}

          {canClose ? (
            <Button
              className="text-xs"
              disabled={!status?.canCloseDay || closeDayMutation.isPending}
              onClick={() => closeDayMutation.mutate()}
            >
              {closeDayMutation.isPending ? "Closing day…" : "Close day"}
            </Button>
          ) : (
            <p className="text-xs text-slate-500">You need closing or accounting permissions to close the day.</p>
          )}
        </div>
      </div>
    </div>
  );
}
