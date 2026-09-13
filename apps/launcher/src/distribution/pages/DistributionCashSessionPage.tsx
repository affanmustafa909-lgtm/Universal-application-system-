import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  closeCashSession,
  fetchCashMovements,
  fetchCashSessions,
  fetchOpenCashSession,
  openCashSession,
  recordCashMovement,
} from "../../pops/api/accounting";
import { parseCashMovementReason, printCashMovementSlip } from "../../pops/lib/printCashMovement";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistKpiCard,
  DistPageShell,
  DistPanel,
  DistStatusBadge,
} from "../ui/DistUi";

const DIST = "/pops/distribution";
const ACC = "/pops/accounting";

function sumByType(
  rows: { type: string; amountPkr: number }[],
  type: "paid_in" | "paid_out",
): number {
  return rows.filter((m) => m.type === type).reduce((s, m) => s + m.amountPkr, 0);
}

export function DistributionCashSessionPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const queryClient = useQueryClient();

  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [paidType, setPaidType] = useState<"paid_in" | "paid_out">("paid_in");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidReason, setPaidReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openSessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchOpenCashSession(branchCode!),
  });

  const sessionsQuery = useQuery({
    queryKey: ["accounting", "cash-sessions", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchCashSessions(branchCode!),
  });

  const openSession = openSessionQuery.data ?? null;

  const movementsQuery = useQuery({
    queryKey: ["accounting", "cash-movements", openSession?.id],
    enabled: Boolean(openSession?.id),
    queryFn: () => fetchCashMovements(openSession!.id),
  });

  const movements = movementsQuery.data ?? [];
  const paidInTotal = useMemo(() => sumByType(movements, "paid_in"), [movements]);
  const paidOutTotal = useMemo(() => sumByType(movements, "paid_out"), [movements]);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["accounting"] });
  }

  const openMutation = useMutation({
    mutationFn: () =>
      openCashSession({
        branchCode: branchCode!,
        openingFloat: Number(openingFloat) || 0,
      }),
    onSuccess: () => {
      invalidate();
      setActionError(null);
      setNotice("Session ON — cash drawer is open. You can record Cash In / Cash Out.");
    },
    onError: (e: Error) => {
      setNotice(null);
      setActionError(e.message);
    },
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      closeCashSession(openSession!.id, { countedCash: Number(countedCash) }),
    onSuccess: () => {
      invalidate();
      setCountedCash("");
      setActionError(null);
      setNotice("Session OFF — cash drawer closed and reconciled.");
    },
    onError: (e: Error) => {
      setNotice(null);
      setActionError(e.message);
    },
  });

  const movementMutation = useMutation({
    mutationFn: (vars: { type: "paid_in" | "paid_out"; amountPkr: number; reason: string }) =>
      recordCashMovement({
        branchCode: branchCode!,
        sessionId: openSession!.id,
        type: vars.type,
        amountPkr: vars.amountPkr,
        reason: vars.reason,
      }),
    onSuccess: async (_data, vars) => {
      invalidate();
      void movementsQuery.refetch();
      setPaidAmount("");
      setPaidReason("");
      setActionError(null);
      setNotice(
        vars.type === "paid_in"
          ? `Cash In recorded: ${formatPkr(vars.amountPkr)}`
          : `Cash Out recorded: ${formatPkr(vars.amountPkr)}`,
      );
      try {
        await printCashMovementSlip({
          branchName: branch?.name ?? "Distribution",
          branchCode: branch?.code,
          sessionRef: openSession?.sessionRef,
          type: vars.type,
          amountPkr: vars.amountPkr,
          reason: vars.reason,
        });
      } catch {
        // print is best-effort
      }
    },
    onError: (e: Error) => {
      setNotice(null);
      setActionError(e.message);
    },
  });

  function submitMovement(type: "paid_in" | "paid_out"): void {
    const amountPkr = Number(paidAmount);
    const reason = paidReason.trim();
    if (!amountPkr || amountPkr <= 0 || !reason) {
      setActionError("Enter amount (PKR) and reason.");
      return;
    }
    if (!openSession) {
      setActionError("Turn session ON first.");
      return;
    }
    movementMutation.mutate({ type, amountPkr, reason });
  }

  const loadError =
    openSessionQuery.isError
      ? (openSessionQuery.error as Error).message
      : sessionsQuery.isError
        ? (sessionsQuery.error as Error).message
        : null;

  return (
    <DistPageShell
      title="Cash session"
      subtitle="Session ON/OFF for the till, plus Cash In / Cash Out during the open session."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Finance", to: `${DIST}/finance` },
        { label: "Cash session" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/finance`}>
            <DistButton variant="secondary">Finance</DistButton>
          </Link>
          <Link to={`${ACC}/bank`}>
            <DistButton variant="secondary">Bank</DistButton>
          </Link>
        </div>
      }
      error={!branch ? "Select a branch." : loadError}
    >
      {actionError ? <DistErrorBanner message={actionError} /> : null}
      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {notice}
        </p>
      ) : null}

      {!openSession ? (
        <DistPanel title="Session OFF" subtitle="Open the cash drawer to start the shift">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              openMutation.mutate();
            }}
          >
            <label className="text-xs text-slate-500">
              Opening float (PKR)
              <DistInput
                className="mt-1 block min-w-[10rem]"
                type="number"
                min={0}
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
              />
            </label>
            <DistButton type="submit" disabled={!branchCode || openMutation.isPending}>
              {openMutation.isPending ? "Opening…" : "Session ON"}
            </DistButton>
          </form>
        </DistPanel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <DistStatusBadge status="open" tone="success" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Session ON — {openSession.sessionRef}
            </span>
            <span className="text-xs text-slate-500">
              Opened by {openSession.openedBy} · {new Date(openSession.openedAt).toLocaleString()}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DistKpiCard label="Opening float" value={formatPkr(openSession.openingFloat)} />
            <DistKpiCard label="Cash sales" value={formatPkr(openSession.cashSales)} />
            <DistKpiCard
              label="Cash In / Out"
              value={formatPkr(openSession.cashAdjustments)}
              hint={`In ${formatPkr(paidInTotal)} · Out ${formatPkr(paidOutTotal)}`}
            />
            <DistKpiCard label="Expected in drawer" value={formatPkr(openSession.liveExpectedCash)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DistPanel title="Cash In" subtitle="Add cash to the drawer (float top-up, owner deposit)">
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPaidType("paid_in");
                  submitMovement("paid_in");
                }}
              >
                <label className="block text-xs text-slate-500">
                  Amount (PKR)
                  <DistInput
                    className="mt-1"
                    type="number"
                    min={1}
                    value={paidType === "paid_in" ? paidAmount : ""}
                    onChange={(e) => {
                      setPaidType("paid_in");
                      setPaidAmount(e.target.value);
                    }}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Reason / party
                  <DistInput
                    className="mt-1"
                    placeholder="e.g. Owner deposit, bank withdraw"
                    value={paidType === "paid_in" ? paidReason : ""}
                    onChange={(e) => {
                      setPaidType("paid_in");
                      setPaidReason(e.target.value);
                    }}
                  />
                </label>
                <DistButton type="submit" disabled={movementMutation.isPending}>
                  Record Cash In
                </DistButton>
              </form>
            </DistPanel>

            <DistPanel title="Cash Out" subtitle="Remove cash (vendor payment, expense, safe drop)">
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPaidType("paid_out");
                  submitMovement("paid_out");
                }}
              >
                <label className="block text-xs text-slate-500">
                  Amount (PKR)
                  <DistInput
                    className="mt-1"
                    type="number"
                    min={1}
                    value={paidType === "paid_out" ? paidAmount : ""}
                    onChange={(e) => {
                      setPaidType("paid_out");
                      setPaidAmount(e.target.value);
                    }}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  Reason / party
                  <DistInput
                    className="mt-1"
                    placeholder="e.g. Petty expense, vendor cash"
                    value={paidType === "paid_out" ? paidReason : ""}
                    onChange={(e) => {
                      setPaidType("paid_out");
                      setPaidReason(e.target.value);
                    }}
                  />
                </label>
                <DistButton type="submit" variant="secondary" disabled={movementMutation.isPending}>
                  Record Cash Out
                </DistButton>
              </form>
            </DistPanel>
          </div>

          <DistPanel title="Session OFF" subtitle="Count drawer cash and close the shift">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!countedCash) {
                  setActionError("Enter counted cash to close the session.");
                  return;
                }
                closeMutation.mutate();
              }}
            >
              <label className="text-xs text-slate-500">
                Counted cash (PKR)
                <DistInput
                  className="mt-1 block min-w-[10rem]"
                  type="number"
                  min={0}
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder={String(openSession.liveExpectedCash)}
                />
              </label>
              <DistButton type="submit" variant="secondary" disabled={closeMutation.isPending}>
                {closeMutation.isPending ? "Closing…" : "Session OFF"}
              </DistButton>
              <DistButton
                type="button"
                variant="ghost"
                onClick={() => setCountedCash(String(openSession.liveExpectedCash))}
              >
                Use expected
              </DistButton>
            </form>
          </DistPanel>

          {movements.length > 0 ? (
            <DistPanel title="Cash In / Out log" subtitle="Movements for this open session">
              <DistDataTable
                rowKey={(r) => r.id}
                rows={[...movements].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                )}
                columns={[
                  {
                    key: "type",
                    header: "Type",
                    render: (r) => (
                      <DistStatusBadge
                        status={r.type === "paid_in" ? "cash in" : "cash out"}
                        tone={r.type === "paid_in" ? "success" : "warning"}
                      />
                    ),
                  },
                  {
                    key: "party",
                    header: "Party",
                    render: (r) => parseCashMovementReason(r.reason).party || "—",
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    className: "text-right tabular-nums",
                    render: (r) =>
                      r.type === "paid_in"
                        ? `+${formatPkr(r.amountPkr)}`
                        : `−${formatPkr(r.amountPkr)}`,
                  },
                  {
                    key: "reason",
                    header: "Reason",
                    render: (r) => parseCashMovementReason(r.reason).note || r.reason,
                  },
                  {
                    key: "time",
                    header: "Time",
                    render: (r) => new Date(r.createdAt).toLocaleString(),
                  },
                ]}
              />
            </DistPanel>
          ) : null}
        </>
      )}

      <DistPanel title="Recent sessions" subtitle="Open and closed cash sessions for this branch">
        {sessionsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <DistDataTable
            empty="No cash sessions yet"
            rowKey={(r) => r.id}
            rows={sessionsQuery.data ?? []}
            columns={[
              { key: "sessionRef", header: "Session" },
              { key: "openedBy", header: "Opened by" },
              {
                key: "openingFloat",
                header: "Float",
                className: "text-right tabular-nums",
                render: (r) => formatPkr(r.openingFloat),
              },
              {
                key: "expectedCash",
                header: "Expected",
                className: "text-right tabular-nums",
                render: (r) => (r.expectedCash != null ? formatPkr(r.expectedCash) : "—"),
              },
              {
                key: "countedCash",
                header: "Counted",
                className: "text-right tabular-nums",
                render: (r) => (r.countedCash != null ? formatPkr(r.countedCash) : "—"),
              },
              {
                key: "variance",
                header: "Variance",
                className: "text-right tabular-nums",
                render: (r) => (r.variance != null ? formatPkr(r.variance) : "—"),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <DistStatusBadge
                    status={r.status}
                    tone={r.status === "open" ? "success" : "neutral"}
                  />
                ),
              },
            ]}
          />
        )}
      </DistPanel>
    </DistPageShell>
  );
}
