import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closeCashSession,
  fetchCashMovements,
  fetchCashSessions,
  fetchOpenCashSession,
  openCashSession,
  recordCashMovement,
} from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../../hooks/useAccounting";
import { noticeErrorClass, noticeSuccessClass } from "../../../lib/themeClasses";
import { printCashMovementSlip } from "../../../lib/printCashMovement";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingFormPanel, AccountingLoading } from "./AccountingUi";

export function CashManagementPage(): JSX.Element {
  const { branch, canOperateDrawer } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [paidType, setPaidType] = useState<"paid_in" | "paid_out">("paid_in");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidReason, setPaidReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openSessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
  });

  const sessionsQuery = useQuery({
    queryKey: ["accounting", "cash-sessions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCashSessions(branch!.code),
  });

  const openSession = openSessionQuery.data;

  const movementsQuery = useQuery({
    queryKey: ["accounting", "cash-movements", openSession?.id],
    enabled: Boolean(openSession?.id),
    queryFn: () => fetchCashMovements(openSession!.id),
  });

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["accounting"] });
  }

  const openMutation = useMutation({
    mutationFn: () =>
      openCashSession({ branchCode: branch!.code, openingFloat: Number(openingFloat) || 0 }),
    onSuccess: () => {
      invalidate();
      setError(null);
      setNotice("Session ON — cash drawer opened.");
    },
    onError: (e: Error) => setError(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      closeCashSession(openSession!.id, { countedCash: Number(countedCash) }),
    onSuccess: () => {
      invalidate();
      setCountedCash("");
      setError(null);
      setNotice("Session OFF — cash drawer closed.");
    },
    onError: (e: Error) => setError(e.message),
  });

  const movementMutation = useMutation({
    mutationFn: () =>
      recordCashMovement({
        branchCode: branch!.code,
        sessionId: openSession!.id,
        type: paidType,
        amountPkr: Number(paidAmount),
        reason: paidReason.trim(),
      }),
    onSuccess: async () => {
      const amountNum = Number(paidAmount);
      const reasonText = paidReason.trim();
      const type = paidType;
      invalidate();
      void movementsQuery.refetch();
      setPaidAmount("");
      setPaidReason("");
      setError(null);
      setNotice(type === "paid_in" ? `Cash In: ${formatPkr(amountNum)}` : `Cash Out: ${formatPkr(amountNum)}`);
      try {
        await printCashMovementSlip({
          branchName: branch?.name ?? "POPS",
          branchCode: branch?.code,
          sessionRef: openSession?.sessionRef,
          type,
          amountPkr: amountNum,
          reason: reasonText,
        });
      } catch {
        /* best-effort */
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  if (openSessionQuery.isLoading || sessionsQuery.isLoading) return <AccountingLoading />;
  if (openSessionQuery.isError) {
    return <AccountingError message={(openSessionQuery.error as Error).message} />;
  }
  if (sessionsQuery.isError) {
    return <AccountingError message={(sessionsQuery.error as Error).message} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cash management"
        subtitle="Session ON/OFF plus Cash In / Cash Out for the active drawer."
      />

      {error ? <div className={noticeErrorClass}>{error}</div> : null}
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}

      {canOperateDrawer && !openSession ? (
        <AccountingFormPanel
          title="Session ON — open cash drawer"
          submitLabel="Session ON"
          disabled={openMutation.isPending}
          onSubmit={() => {
            if (!branch?.code) return;
            openMutation.mutate();
          }}
        >
          <input
            className={accountingInputClass}
            placeholder="Opening float (PKR)"
            type="number"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
        </AccountingFormPanel>
      ) : null}

      {canOperateDrawer && openSession ? (
        <>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Session ON — {openSession.sessionRef}
              </h2>
              <Badge tone="success">Open</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Expected in drawer: {formatPkr(openSession.liveExpectedCash)} · Cash sales:{" "}
              {formatPkr(openSession.cashSales)} · Adjustments: {formatPkr(openSession.cashAdjustments)}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AccountingFormPanel
              title="Cash In"
              submitLabel="Record Cash In"
              disabled={
                movementMutation.isPending || paidType !== "paid_in" || !paidAmount || !paidReason.trim()
              }
              onSubmit={() => {
                setPaidType("paid_in");
                movementMutation.mutate();
              }}
            >
              <input
                className={accountingInputClass}
                type="number"
                min={1}
                placeholder="Amount (PKR)"
                value={paidType === "paid_in" ? paidAmount : ""}
                onChange={(e) => {
                  setPaidType("paid_in");
                  setPaidAmount(e.target.value);
                }}
              />
              <input
                className={accountingInputClass}
                placeholder="Reason"
                value={paidType === "paid_in" ? paidReason : ""}
                onChange={(e) => {
                  setPaidType("paid_in");
                  setPaidReason(e.target.value);
                }}
              />
            </AccountingFormPanel>

            <AccountingFormPanel
              title="Cash Out"
              submitLabel="Record Cash Out"
              disabled={
                movementMutation.isPending || paidType !== "paid_out" || !paidAmount || !paidReason.trim()
              }
              onSubmit={() => {
                setPaidType("paid_out");
                movementMutation.mutate();
              }}
            >
              <input
                className={accountingInputClass}
                type="number"
                min={1}
                placeholder="Amount (PKR)"
                value={paidType === "paid_out" ? paidAmount : ""}
                onChange={(e) => {
                  setPaidType("paid_out");
                  setPaidAmount(e.target.value);
                }}
              />
              <input
                className={accountingInputClass}
                placeholder="Reason"
                value={paidType === "paid_out" ? paidReason : ""}
                onChange={(e) => {
                  setPaidType("paid_out");
                  setPaidReason(e.target.value);
                }}
              />
            </AccountingFormPanel>
          </div>

          {(movementsQuery.data ?? []).length > 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
              <h3 className="mb-2 text-sm font-semibold">Cash In / Out log</h3>
              <SimpleTable
                rowKey={(r) => String(r.id)}
                columns={[
                  { key: "type", header: "Type" },
                  {
                    key: "amountPkr",
                    header: "Amount",
                    render: (r) => formatPkr(Number(r.amountPkr)),
                  },
                  { key: "reason", header: "Reason" },
                  {
                    key: "createdAt",
                    header: "Time",
                    render: (r) => new Date(String(r.createdAt)).toLocaleString(),
                  },
                ]}
                rows={(movementsQuery.data ?? []) as unknown as Record<string, unknown>[]}
              />
            </div>
          ) : null}

          <AccountingFormPanel
            title={`Session OFF — ${openSession.sessionRef}`}
            submitLabel="Session OFF"
            disabled={closeMutation.isPending || !countedCash}
            onSubmit={() => closeMutation.mutate()}
          >
            <input
              className={accountingInputClass}
              placeholder="Counted cash (PKR)"
              type="number"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
            />
            <button
              type="button"
              className="text-xs text-cyan-600 underline"
              onClick={() => setCountedCash(String(openSession.liveExpectedCash))}
            >
              Use expected ({formatPkr(openSession.liveExpectedCash)})
            </button>
          </AccountingFormPanel>
        </>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.sessionRef)}
          columns={[
            { key: "sessionRef", header: "Session" },
            { key: "openedBy", header: "Opened by" },
            {
              key: "openingFloat",
              header: "Float",
              render: (r) => formatPkr(Number(r.openingFloat)),
            },
            {
              key: "expectedCash",
              header: "Expected",
              render: (r) => (r.expectedCash != null ? formatPkr(Number(r.expectedCash)) : "—"),
            },
            {
              key: "countedCash",
              header: "Counted",
              render: (r) => (r.countedCash != null ? formatPkr(Number(r.countedCash)) : "—"),
            },
            {
              key: "variance",
              header: "Variance",
              render: (r) => (r.variance != null ? formatPkr(Number(r.variance)) : "—"),
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "open" ? "warning" : "success"}>{String(r.status)}</Badge>
              ),
            },
          ]}
          rows={(sessionsQuery.data ?? []) as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
