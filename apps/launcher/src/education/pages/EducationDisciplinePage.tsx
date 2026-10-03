import {
  createEducationDisciplineIncident,
  fetchEducationDisciplineIncidents,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationDisciplinePage(): JSX.Element {
  return (
    <EducationModulePage
      title="Discipline"
      subtitle="Record student discipline incidents, severity, and actions taken."
      resourceKey="discipline-incidents"
      fetchList={fetchEducationDisciplineIncidents}
      createFn={createEducationDisciplineIncident}
      createLabel="Log incident"
      formTitle="New discipline incident"
      searchKeys={["studentId", "incidentTypeCode", "severityCode", "description", "status"]}
      fields={[
        { key: "studentId", label: "Student ID", required: true, placeholder: "UUID" },
        { key: "classId", label: "Class ID", omitIfEmpty: true, placeholder: "UUID" },
        { key: "sectionId", label: "Section ID", omitIfEmpty: true, placeholder: "UUID" },
        { key: "incidentDate", label: "Incident date", required: true, type: "date" },
        { key: "incidentTypeCode", label: "Incident type", required: true },
        { key: "severityCode", label: "Severity", required: true },
        { key: "actionCode", label: "Action", omitIfEmpty: true },
        { key: "description", label: "Description", required: true },
        { key: "warning", label: "Warning note", omitIfEmpty: true },
        { key: "responsibleStaffId", label: "Responsible staff ID", omitIfEmpty: true },
        {
          key: "parentNotified",
          label: "Parent notified",
          type: "select",
          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],
        },
        { key: "status", label: "Status", omitIfEmpty: true, placeholder: "open" },
        { key: "remarks", label: "Remarks", omitIfEmpty: true },
      ]}
      buildBody={(values, branchCode) => ({
        branchCode,
        studentId: values.studentId.trim(),
        classId: values.classId.trim() || undefined,
        sectionId: values.sectionId.trim() || undefined,
        incidentDate: values.incidentDate,
        incidentTypeCode: values.incidentTypeCode.trim(),
        severityCode: values.severityCode.trim(),
        actionCode: values.actionCode.trim() || undefined,
        description: values.description.trim(),
        warning: values.warning.trim() || undefined,
        responsibleStaffId: values.responsibleStaffId.trim() || undefined,
        parentNotified: values.parentNotified === "true",
        status: values.status.trim() || undefined,
        remarks: values.remarks.trim() || undefined,
      })}
      columns={[
        { key: "incidentDate", label: "Date" },
        { key: "studentId", label: "Student" },
        { key: "incidentTypeCode", label: "Type" },
        { key: "severityCode", label: "Severity" },
        { key: "actionCode", label: "Action" },
        { key: "status", label: "Status" },
        {
          key: "parentNotified",
          label: "Parent notified",
          render: (row) => (row.parentNotified ? "Yes" : "No"),
        },
        { key: "description", label: "Description" },
      ]}
    />
  );
}
