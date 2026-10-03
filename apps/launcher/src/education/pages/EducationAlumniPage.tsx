import {
  createEducationAlumni,
  fetchEducationAlumni,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationAlumniPage(): JSX.Element {
  return (
    <EducationModulePage
      title="Alumni"
      subtitle="Maintain alumni directory with graduation year, career, and contact details."
      resourceKey="alumni"
      fetchList={fetchEducationAlumni}
      createFn={createEducationAlumni}
      createLabel="Add alumni"
      formTitle="New alumni record"
      searchKeys={["fullName", "programOrClass", "company", "status", "email"]}
      fields={[
        { key: "fullName", label: "Full name", required: true },
        { key: "studentId", label: "Student ID", omitIfEmpty: true },
        { key: "graduationYear", label: "Graduation year", type: "number", omitIfEmpty: true },
        { key: "programOrClass", label: "Program / class", omitIfEmpty: true },
        { key: "phone", label: "Phone", omitIfEmpty: true },
        { key: "email", label: "Email", type: "email", omitIfEmpty: true },
        { key: "company", label: "Company", omitIfEmpty: true },
        { key: "position", label: "Position", omitIfEmpty: true },
        { key: "location", label: "Location", omitIfEmpty: true },
        { key: "achievements", label: "Achievements", omitIfEmpty: true },
        { key: "status", label: "Status", omitIfEmpty: true, placeholder: "active" },
      ]}
      columns={[
        { key: "fullName", label: "Name" },
        { key: "graduationYear", label: "Year" },
        { key: "programOrClass", label: "Program" },
        { key: "company", label: "Company" },
        { key: "position", label: "Position" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
