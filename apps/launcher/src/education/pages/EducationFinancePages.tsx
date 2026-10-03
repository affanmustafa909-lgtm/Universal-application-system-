import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationExpense,
  createEducationFinanceTxn,
  createEducationPayrollRun,
  fetchEducationExpenses,
  fetchEducationFinanceSummary,
  fetchEducationFinanceTxns,
  fetchEducationPayrollRuns,
  fetchEducationPayslips,
  updateEducationExpense,
  updateEducationPayrollRun,
} from "../api/education";
import { formatPkr, useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSecondaryButton,
  EducationSelect,
  EducationStatCard,
} from "../ui/EducationUi";

export function EducationFinancePage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [txnType, setTxnType] = useState<"income" | "expense" | "refund" | "adjustment">("income");
  const [title, setTitle] = useState("");
  const [amountPkr, setAmountPkr] = useState("");
  const [refModule, setRefModule] = useState("manual");
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));

  const summaryQuery = useQuery({
    queryKey: ["education", "finance-summary", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationFinanceSummary(branch!.code),
  });
  const txnsQuery = useQuery({
    queryKey: ["education", "finance-txns", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationFinanceTxns(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationFinanceTxn({
        branchCode: branch!.code,
        txnType,
        amountPkr: Number(amountPkr) || 0,
        refModule: refModule.trim() || "manual",
        title: title.trim(),
        txnDate,
        status: "posted",
      }),
    onSuccess: () => {
      invalidate();
      setTitle("");
      setAmountPkr("");
      setNotice("Transaction recorded");
    },
  });

  const summary = summaryQuery.data ?? {};

  return (
    <div className="space-y-5">
      <PageHeader title="Finance" subtitle="Campus finance summary and ledger transactions." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {summaryQuery.isError ? (
        <div className={noticeErrorClass}>{(summaryQuery.error as Error).message}</div>
      ) : null}
      {txnsQuery.isError ? (
        <div className={noticeErrorClass}>{(txnsQuery.error as Error).message}</div>
      ) : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      {!summaryQuery.isError ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.incomePkr != null ? (
            <EducationStatCard label="Income" value={formatPkr(Number(summary.incomePkr))} tone="success" />
          ) : null}
          {summary.expensePkr != null ? (
            <EducationStatCard label="Expenses" value={formatPkr(Number(summary.expensePkr))} tone="warning" />
          ) : null}
          {summary.netPkr != null ? (
            <EducationStatCard label="Net" value={formatPkr(Number(summary.netPkr))} />
          ) : null}
          {summary.pendingFeesPkr != null ? (
            <EducationStatCard
              label="Pending fees"
              value={formatPkr(Number(summary.pendingFeesPkr))}
              tone="warning"
            />
          ) : null}
          {summary.collectedPkr != null ? (
            <EducationStatCard
              label="Collected"
              value={formatPkr(Number(summary.collectedPkr))}
              tone="success"
            />
          ) : null}
          {summary.payrollPkr != null ? (
            <EducationStatCard label="Payroll" value={formatPkr(Number(summary.payrollPkr))} />
          ) : null}
          {Object.keys(summary).length === 0 && summaryQuery.isSuccess ? (
            <div className="col-span-full text-sm text-slate-500 dark:text-slate-400">No summary figures returned by API.</div>
          ) : null}
        </div>
      ) : null}

      <EducationFormSection title="Record transaction">
        <EducationField label="Type" required>
          <EducationSelect
            value={txnType}
            onChange={(e) => setTxnType(e.target.value as typeof txnType)}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="refund">Refund</option>
            <option value="adjustment">Adjustment</option>
          </EducationSelect>
        </EducationField>
        <EducationField label="Title" required>
          <EducationInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </EducationField>
        <EducationField label="Amount (PKR)" required>
          <EducationInput type="number" value={amountPkr} onChange={(e) => setAmountPkr(e.target.value)} />
        </EducationField>
        <EducationField label="Ref module">
          <EducationInput value={refModule} onChange={(e) => setRefModule(e.target.value)} />
        </EducationField>
        <EducationField label="Date" required>
          <EducationInput type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !title.trim() ||
              !amountPkr ||
              txnsQuery.isError ||
              createMutation.isPending
            }
            title={txnsQuery.isError ? "Finance txns API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Post transaction
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationDataTable
        columns={["Date", "Type", "Title", "Amount", "Module", "Status"]}
        rows={(txnsQuery.data ?? []).map((t) => [
          t.txnDate,
          t.txnType,
          t.title,
          formatPkr(t.amountPkr),
          t.refModule,
          t.status,
        ])}
      />
    </div>
  );
}

export function EducationExpensesPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [amountPkr, setAmountPkr] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const query = useQuery({
    queryKey: ["education", "expenses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationExpenses(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationExpense({
        branchCode: branch!.code,
        title: title.trim(),
        categoryCode: categoryCode.trim() || "general",
        amountPkr: Number(amountPkr) || 0,
        expenseDate: expenseDate || undefined,
        notes: notes.trim() || undefined,
        status: "draft",
      }),
    onSuccess: () => {
      invalidate();
      setTitle("");
      setAmountPkr("");
      setNotes("");
      setNotice("Expense created as draft");
    },
  });

  const workflowMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateEducationExpense(id, { status }),
    onSuccess: (_d, vars) => {
      invalidate(["expenses"]);
      setNotice(`Expense marked ${vars.status}`);
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Expenses" subtitle="Operational expenses with draft → approve → paid workflow." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {query.isError ? <div className={noticeErrorClass}>{(query.error as Error).message}</div> : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}
      {workflowMutation.isError ? (
        <div className={noticeErrorClass}>{(workflowMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New expense">
        <EducationField label="Title" required>
          <EducationInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </EducationField>
        <EducationField label="Category code">
          <EducationInput value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} />
        </EducationField>
        <EducationField label="Amount (PKR)" required>
          <EducationInput type="number" value={amountPkr} onChange={(e) => setAmountPkr(e.target.value)} />
        </EducationField>
        <EducationField label="Date">
          <EducationInput type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </EducationField>
        <EducationField label="Notes">
          <EducationInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code || !title.trim() || !amountPkr || query.isError || createMutation.isPending
            }
            title={query.isError ? "Expenses API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Create draft
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationDataTable
        columns={["Title", "Category", "Amount", "Date", "Status", "Actions"]}
        rows={(query.data ?? []).map((e) => [
          e.title,
          e.categoryCode,
          formatPkr(e.amountPkr),
          e.expenseDate ?? "—",
          e.status,
          <div key={e.id} className="flex flex-wrap gap-1">
            {e.status === "draft" || e.status === "pending" ? (
              <EducationSecondaryButton
                disabled={workflowMutation.isPending}
                onClick={() => workflowMutation.mutate({ id: e.id, status: "approved" })}
              >
                Approve
              </EducationSecondaryButton>
            ) : null}
            {e.status === "approved" ? (
              <EducationPrimaryButton
                disabled={workflowMutation.isPending}
                onClick={() => workflowMutation.mutate({ id: e.id, status: "paid" })}
              >
                Mark paid
              </EducationPrimaryButton>
            ) : null}
            {e.status === "draft" ? (
              <EducationSecondaryButton
                disabled={workflowMutation.isPending}
                onClick={() => workflowMutation.mutate({ id: e.id, status: "pending" })}
              >
                Submit
              </EducationSecondaryButton>
            ) : null}
            {e.status !== "cancelled" && e.status !== "paid" ? (
              <EducationSecondaryButton
                disabled={workflowMutation.isPending}
                onClick={() => workflowMutation.mutate({ id: e.id, status: "cancelled" })}
              >
                Cancel
              </EducationSecondaryButton>
            ) : null}
          </div>,
        ])}
      />
    </div>
  );
}

export function EducationPayrollPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");

  const runsQuery = useQuery({
    queryKey: ["education", "payroll-runs", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationPayrollRuns(branch!.code),
  });
  const payslipsQuery = useQuery({
    queryKey: ["education", "payslips", branch?.code, selectedRunId],
    enabled: Boolean(branch?.code) && Boolean(selectedRunId),
    queryFn: () => fetchEducationPayslips(branch!.code, selectedRunId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationPayrollRun({
        branchCode: branch!.code,
        periodLabel: periodLabel.trim(),
        status: "draft",
        totalPkr: 0,
      }),
    onSuccess: () => {
      invalidate();
      setPeriodLabel("");
      setNotice("Payroll run created");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "draft" | "calculated" | "approved" | "paid" }) =>
      updateEducationPayrollRun(id, { status }),
    onSuccess: (_d, vars) => {
      invalidate(["payroll-runs"]);
      setNotice(`Payroll run marked ${vars.status}`);
    },
  });

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);

  return (
    <div className="space-y-5">
      <PageHeader title="Payroll" subtitle="Teacher and staff payroll runs and payslips." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {runsQuery.isError ? (
        <div className={noticeErrorClass}>{(runsQuery.error as Error).message}</div>
      ) : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New payroll run">
        <EducationField label="Period label" required hint="e.g. 2026-03">
          <EducationInput value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code || !periodLabel.trim() || runsQuery.isError || createMutation.isPending
            }
            title={runsQuery.isError ? "Payroll API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Create run
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationDataTable
        columns={["Period", "Status", "Total", "Actions"]}
        rows={runs.map((r) => [
          r.periodLabel,
          r.status,
          formatPkr(r.totalPkr),
          <div key={r.id} className="flex flex-wrap gap-1">
            <EducationSecondaryButton onClick={() => setSelectedRunId(r.id)}>
              Payslips
            </EducationSecondaryButton>
            {r.status === "draft" ? (
              <EducationSecondaryButton
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: r.id, status: "calculated" })}
              >
                Calculate
              </EducationSecondaryButton>
            ) : null}
            {r.status === "calculated" ? (
              <EducationSecondaryButton
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: r.id, status: "approved" })}
              >
                Approve
              </EducationSecondaryButton>
            ) : null}
            {r.status === "approved" ? (
              <EducationPrimaryButton
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: r.id, status: "paid" })}
              >
                Mark paid
              </EducationPrimaryButton>
            ) : null}
          </div>,
        ])}
      />

      {selectedRunId ? (
        <>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Payslips for selected run
          </h3>
          {payslipsQuery.isError ? (
            <div className={noticeErrorClass}>{(payslipsQuery.error as Error).message}</div>
          ) : null}
          <EducationDataTable
            columns={["Person", "Type", "Basic", "Allowances", "Deductions", "Net", "Status"]}
            rows={(payslipsQuery.data ?? []).map((p) => [
              p.personId.slice(0, 8),
              p.personType,
              formatPkr(p.basicPkr),
              formatPkr(p.allowancesPkr),
              formatPkr(p.deductionsPkr),
              formatPkr(p.netPkr),
              p.status,
            ])}
          />
        </>
      ) : null}
    </div>
  );
}
