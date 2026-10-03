import {
  createEducationLeaveRequest,
  fetchEducationLeaveRequests,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationLeavePage(): JSX.Element {
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
      ]}
    />
  );
}
