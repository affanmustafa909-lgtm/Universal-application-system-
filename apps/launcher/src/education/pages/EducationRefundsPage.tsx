import {
  createEducationFeeRefund,
  fetchEducationFeeRefunds,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";
import { formatPkr } from "../hooks/useEducation";

export function EducationRefundsPage(): JSX.Element {
  return (
    <EducationModulePage
      title="Refunds"
      subtitle="Request and track student fee refunds."
      resourceKey="fee-refunds"
      fetchList={fetchEducationFeeRefunds}
      createFn={createEducationFeeRefund}
      createLabel="Request refund"
      formTitle="New refund request"
      searchKeys={["studentId", "reason", "status"]}
      fields={[
        { key: "studentId", label: "Student ID", required: true, placeholder: "UUID" },
        { key: "invoiceId", label: "Invoice ID", omitIfEmpty: true },
        { key: "paymentId", label: "Payment ID", omitIfEmpty: true },
        { key: "amountPkr", label: "Amount (PKR)", required: true, type: "number" },
        { key: "reason", label: "Reason", required: true },
        { key: "paymentMethodCode", label: "Payment method", omitIfEmpty: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "requested", label: "Requested" },
            { value: "approved", label: "Approved" },
            { value: "processed", label: "Processed" },
            { value: "completed", label: "Completed" },
            { value: "rejected", label: "Rejected" },
          ],
        },
        { key: "remarks", label: "Remarks", omitIfEmpty: true },
      ]}
      columns={[
        { key: "studentId", label: "Student" },
        {
          key: "amountPkr",
          label: "Amount",
          render: (row) => formatPkr(Number(row.amountPkr ?? 0)),
        },
        { key: "status", label: "Status" },
        { key: "reason", label: "Reason" },
        { key: "invoiceId", label: "Invoice" },
        { key: "createdAt", label: "Created", render: (row) => String(row.createdAt ?? "").slice(0, 10) || "—" },
      ]}
    />
  );
}
