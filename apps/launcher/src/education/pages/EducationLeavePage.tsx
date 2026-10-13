import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  approveEducationLeaveRequest,
  createEducationLeaveRequest,
  fetchEducationLeaveRequests,
} from "../api/education";
import { useInvalidateEducation } from "../hooks/useEducation";
import { EducationModulePage } from "../ui/EducationModulePage";
import { EducationSecondaryButton } from "../ui/EducationUi";

export function EducationLeavePage(): JSX.Element {
  const invalidate = useInvalidateEducation();
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveEducationLeaveRequest(id),
    onSuccess: () => {
      invalidate(["leave-requests"]);
      setActionNotice("Leave request approved");
      setActionError(null);
    },
    onError: (e: Error) => {
      setActionError(e.message);
      setActionNotice(null);
    },
  });

  return (
    <EducationModulePage
      title="Leave"
      subtitle="Student, teacher, and staff leave requests with approval status."
      resourceKey="leave-requests"
      fetchList={fetchEducationLeaveRequests}
      createFn={createEducationLeaveRequest}
      createLabel="Submit leave"
      formTitle="New leave request"
      searchKeys={["applicantId", "leaveTypeCode", "reason", "status"]}
      extras={
        <>
          {actionNotice ? <div className={noticeSuccessClass}>{actionNotice}</div> : null}
          {actionError ? <div className={noticeErrorClass}>{actionError}</div> : null}
        </>
      }
      fields={[
        {
          key: "applicantType",
          label: "Applicant type",
          required: true,
          type: "select",
          options: [
            { value: "student", label: "Student" },
            { value: "teacher", label: "Teacher" },
            { value: "staff", label: "Staff" },
          ],
        },
        { key: "applicantId", label: "Applicant ID", required: true, placeholder: "UUID" },
        { key: "leaveTypeCode", label: "Leave type code", required: true, placeholder: "sick / casual / …" },
        { key: "startDate", label: "Start date", required: true, type: "date" },
        { key: "endDate", label: "End date", required: true, type: "date" },
        { key: "days", label: "Days", type: "number", omitIfEmpty: true },
        { key: "reason", label: "Reason", required: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "draft", label: "Draft" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "cancelled", label: "Cancelled" },
          ],
        },
        { key: "remarks", label: "Remarks", omitIfEmpty: true },
      ]}
      columns={[
        { key: "applicantType", label: "Type" },
        { key: "applicantId", label: "Applicant" },
        { key: "leaveTypeCode", label: "Leave type" },
        { key: "startDate", label: "Start" },
        { key: "endDate", label: "End" },
        { key: "days", label: "Days" },
        { key: "status", label: "Status" },
        { key: "reason", label: "Reason" },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const status = String(row.status ?? "");
            const id = String(row.id ?? "");
            if (!id || status === "approved" || status === "cancelled" || status === "rejected") {
              return "—";
            }
            return (
              <EducationSecondaryButton
                className="px-2 py-1"
                disabled={approveMutation.isPending}
                onClick={() => {
                  setActionNotice(null);
                  setActionError(null);
                  approveMutation.mutate(id);
                }}
              >
                Approve
              </EducationSecondaryButton>
            );
          },
        },
      ]}
    />
  );
}
