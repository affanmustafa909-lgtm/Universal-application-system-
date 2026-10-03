import {
  createEducationEnquiry,
  fetchEducationEnquiries,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationFrontDeskPage(): JSX.Element {
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
      ]}
    />
  );
}
