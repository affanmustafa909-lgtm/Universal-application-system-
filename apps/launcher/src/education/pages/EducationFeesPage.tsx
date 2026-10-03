import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationFeeInvoice,
  createEducationFeePayment,
  createEducationFeeStructure,
  fetchEducationFeeInvoices,
  fetchEducationFeePayments,
  fetchEducationFeeStructures,
  fetchEducationLookups,
  fetchEducationStudents,
} from "../api/education";
import { formatPkr, useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSelect,
} from "../ui/EducationUi";

export function EducationFeesPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"structures" | "invoices" | "payments">("structures");

  const [structName, setStructName] = useState("");
  const [feeTypeCode, setFeeTypeCode] = useState("");
  const [amountPkr, setAmountPkr] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const [invoiceStudentId, setInvoiceStudentId] = useState("");
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceFeeType, setInvoiceFeeType] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");

  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const structuresQuery = useQuery({
    queryKey: ["education", "fee-structures", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationFeeStructures(branch!.code),
  });
  const invoicesQuery = useQuery({
    queryKey: ["education", "fee-invoices", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationFeeInvoices(branch!.code),
  });
  const paymentsQuery = useQuery({
    queryKey: ["education", "fee-payments", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationFeePayments(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });
  const feeTypesQuery = useQuery({
    queryKey: ["education", "lookups", branch?.code, "fee_type"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLookups(branch!.code, "fee_type"),
  });
  const paymentMethodsQuery = useQuery({
    queryKey: ["education", "lookups", branch?.code, "payment_method"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLookups(branch!.code, "payment_method"),
  });

  const structureMutation = useMutation({
    mutationFn: () =>
      createEducationFeeStructure({
        branchCode: branch!.code,
        name: structName.trim(),
        feeTypeCode: feeTypeCode || "tuition",
        amountPkr: Number(amountPkr) || 0,
        frequency,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setStructName("");
      setAmountPkr("");
      setNotice("Fee structure created");
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: () =>
      createEducationFeeInvoice({
        branchCode: branch!.code,
        studentId: invoiceStudentId,
        feeTypeCode: invoiceFeeType || "tuition",
        title: invoiceTitle.trim(),
        amountPkr: Number(invoiceAmount) || 0,
      }),
    onSuccess: () => {
      invalidate();
      setInvoiceTitle("");
      setInvoiceAmount("");
      setNotice("Invoice created");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      createEducationFeePayment({
        branchCode: branch!.code,
        invoiceId: paymentInvoiceId,
        amountPkr: Number(paymentAmount) || 0,
        paymentMethodCode: paymentMethod || "cash",
      }),
    onSuccess: () => {
      invalidate();
      setPaymentAmount("");
      setNotice("Payment recorded");
    },
  });

  const tabs = [
    { id: "structures" as const, label: "Structures" },
    { id: "invoices" as const, label: "Invoices" },
    { id: "payments" as const, label: "Payments" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fees"
        subtitle="Define fee structures, raise invoices, and record student payments."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? "bg-blue-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "structures" ? (
        <>
          <EducationFormSection title="New fee structure">
            <EducationField label="Name" required>
              <EducationInput value={structName} onChange={(e) => setStructName(e.target.value)} />
            </EducationField>
            <EducationField label="Fee type">
              <EducationSelect value={feeTypeCode} onChange={(e) => setFeeTypeCode(e.target.value)}>
                <option value="">tuition</option>
                {(feeTypesQuery.data ?? []).map((f) => (
                  <option key={f.id} value={f.code}>
                    {f.label}
                  </option>
                ))}
              </EducationSelect>
            </EducationField>
            <EducationField label="Amount (PKR)" required>
              <EducationInput type="number" value={amountPkr} onChange={(e) => setAmountPkr(e.target.value)} />
            </EducationField>
            <EducationField label="Frequency">
              <EducationSelect value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="one_time">One-time</option>
              </EducationSelect>
            </EducationField>
            <div className="col-span-full">
              <EducationPrimaryButton
                disabled={!structName.trim() || structureMutation.isPending}
                onClick={() => {
                  setNotice(null);
                  structureMutation.mutate();
                }}
              >
                Add structure
              </EducationPrimaryButton>
            </div>
          </EducationFormSection>
          {structuresQuery.isError ? (
            <div className={noticeErrorClass}>{(structuresQuery.error as Error).message}</div>
          ) : null}
          <EducationDataTable
            columns={["Name", "Type", "Amount", "Frequency", "Status"]}
            rows={(structuresQuery.data ?? []).map((s) => [
              s.name,
              s.feeTypeCode,
              formatPkr(s.amountPkr),
              s.frequency,
              s.status,
            ])}
          />
        </>
      ) : null}

      {tab === "invoices" ? (
        <>
          <EducationFormSection title="Raise invoice">
            <EducationField label="Student" required>
              <EducationSelect value={invoiceStudentId} onChange={(e) => setInvoiceStudentId(e.target.value)}>
                <option value="">—</option>
                {(studentsQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentNumber} — {[s.firstName, s.lastName].filter(Boolean).join(" ")}
                  </option>
                ))}
              </EducationSelect>
            </EducationField>
            <EducationField label="Title" required>
              <EducationInput value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} />
            </EducationField>
            <EducationField label="Fee type">
              <EducationSelect value={invoiceFeeType} onChange={(e) => setInvoiceFeeType(e.target.value)}>
                <option value="">tuition</option>
                {(feeTypesQuery.data ?? []).map((f) => (
                  <option key={f.id} value={f.code}>
                    {f.label}
                  </option>
                ))}
              </EducationSelect>
            </EducationField>
            <EducationField label="Amount (PKR)" required>
              <EducationInput type="number" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
            </EducationField>
            <div className="col-span-full">
              <EducationPrimaryButton
                disabled={!invoiceStudentId || !invoiceTitle.trim() || invoiceMutation.isPending}
                onClick={() => {
                  setNotice(null);
                  invoiceMutation.mutate();
                }}
              >
                Create invoice
              </EducationPrimaryButton>
            </div>
          </EducationFormSection>
          <EducationDataTable
            columns={["Voucher", "Title", "Amount", "Paid", "Status", "Due"]}
            rows={(invoicesQuery.data ?? []).map((i) => [
              i.voucherNumber,
              i.title,
              formatPkr(i.amountPkr),
              formatPkr(i.paidPkr),
              i.status,
              i.dueDate ?? "—",
            ])}
          />
        </>
      ) : null}

      {tab === "payments" ? (
        <>
          <EducationFormSection title="Record payment">
            <EducationField label="Invoice" required>
              <EducationSelect value={paymentInvoiceId} onChange={(e) => setPaymentInvoiceId(e.target.value)}>
                <option value="">—</option>
                {(invoicesQuery.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.voucherNumber} — {i.title} ({formatPkr(i.amountPkr - i.paidPkr)} due)
                  </option>
                ))}
              </EducationSelect>
            </EducationField>
            <EducationField label="Amount (PKR)" required>
              <EducationInput type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </EducationField>
            <EducationField label="Payment method">
              <EducationSelect value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">cash</option>
                {(paymentMethodsQuery.data ?? []).map((m) => (
                  <option key={m.id} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </EducationSelect>
            </EducationField>
            <div className="col-span-full">
              <EducationPrimaryButton
                disabled={!paymentInvoiceId || !paymentAmount || paymentMutation.isPending}
                onClick={() => {
                  setNotice(null);
                  paymentMutation.mutate();
                }}
              >
                Record payment
              </EducationPrimaryButton>
            </div>
          </EducationFormSection>
          <EducationDataTable
            columns={["Receipt", "Amount", "Method", "Paid at"]}
            rows={(paymentsQuery.data ?? []).map((p) => [
              p.receiptNumber,
              formatPkr(p.amountPkr),
              p.paymentMethodCode,
              p.paidAt.slice(0, 19).replace("T", " "),
            ])}
          />
        </>
      ) : null}
    </div>
  );
}
