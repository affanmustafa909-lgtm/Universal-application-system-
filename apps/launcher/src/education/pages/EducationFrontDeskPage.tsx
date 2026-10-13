import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  convertEducationEnquiry,
  createEducationEnquiry,
  fetchEducationEnquiries,
} from "../api/education";
import { useInvalidateEducation } from "../hooks/useEducation";
import { EducationModulePage } from "../ui/EducationModulePage";
import { EducationSecondaryButton } from "../ui/EducationUi";

export function EducationFrontDeskPage(): JSX.Element {
  const invalidate = useInvalidateEducation();
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const convertMutation = useMutation({
    mutationFn: (id: string) => convertEducationEnquiry(id),
    onSuccess: () => {
      invalidate(["enquiries", "admissions"]);
      setActionNotice("Enquiry converted to admission");
      setActionError(null);
    },
    onError: (e: Error) => {
      setActionError(e.message);
      setActionNotice(null);
    },
  });

  return (
    <EducationModulePage
      title="Front desk"
      subtitle="Capture admission enquiries, follow-ups, and conversion status."
      resourceKey="enquiries"
      fetchList={fetchEducationEnquiries}
      createFn={createEducationEnquiry}
      createLabel="Log enquiry"
      formTitle="New enquiry"
      searchKeys={["name", "phone", "email", "status", "interestedProgram"]}
      extras={
        <>
          {actionNotice ? <div className={noticeSuccessClass}>{actionNotice}</div> : null}
          {actionError ? <div className={noticeErrorClass}>{actionError}</div> : null}
        </>
      }
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "phone", label: "Phone", omitIfEmpty: true },
        { key: "email", label: "Email", type: "email", omitIfEmpty: true },
        { key: "interestedProgram", label: "Interested program", omitIfEmpty: true },
        { key: "interestedClassId", label: "Interested class ID", omitIfEmpty: true },
        { key: "sourceCode", label: "Source", omitIfEmpty: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "new", label: "New" },
            { value: "contacted", label: "Contacted" },
            { value: "follow_up", label: "Follow up" },
            { value: "converted", label: "Converted" },
            { value: "closed", label: "Closed" },
            { value: "lost", label: "Lost" },
          ],
        },
        { key: "assignedStaffId", label: "Assigned staff ID", omitIfEmpty: true },
        { key: "followUpDate", label: "Follow-up date", type: "date", omitIfEmpty: true },
        { key: "remarks", label: "Remarks", omitIfEmpty: true },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "interestedProgram", label: "Program" },
        { key: "sourceCode", label: "Source" },
        { key: "status", label: "Status" },
        { key: "followUpDate", label: "Follow-up" },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const status = String(row.status ?? "");
            const id = String(row.id ?? "");
            if (!id || status === "converted" || status === "closed" || status === "lost") {
              return "—";
            }
            return (
              <EducationSecondaryButton
                className="px-2 py-1"
                disabled={convertMutation.isPending}
                onClick={() => {
                  setActionNotice(null);
                  setActionError(null);
                  convertMutation.mutate(id);
                }}
              >
                Convert
              </EducationSecondaryButton>
            );
          },
        },
      ]}
    />
  );
}
