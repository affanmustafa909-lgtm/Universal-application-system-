import {
  createEducationAssignment,
  fetchEducationAssignments,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationAssignmentsPage(): JSX.Element {
  return (
    <EducationModulePage
      title="Assignments"
      subtitle="Create and publish class or course assignments with due dates and marks."
      resourceKey="assignments"
      fetchList={fetchEducationAssignments}
      createFn={createEducationAssignment}
      createLabel="Create assignment"
      formTitle="New assignment"
      searchKeys={["title", "status", "classId", "subjectId"]}
      fields={[
        { key: "title", label: "Title", required: true },
        { key: "description", label: "Description", omitIfEmpty: true },
        { key: "subjectId", label: "Subject ID", omitIfEmpty: true },
        { key: "courseId", label: "Course ID", omitIfEmpty: true },
        { key: "classId", label: "Class ID", omitIfEmpty: true },
        { key: "sectionId", label: "Section ID", omitIfEmpty: true },
        { key: "batchId", label: "Batch ID", omitIfEmpty: true },
        { key: "teacherId", label: "Teacher ID", omitIfEmpty: true },
        { key: "dueDate", label: "Due date", type: "date", omitIfEmpty: true },
        { key: "totalMarks", label: "Total marks", type: "number", omitIfEmpty: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
            { value: "completed", label: "Completed" },
            { value: "archived", label: "Archived" },
          ],
        },
      ]}
      columns={[
        { key: "title", label: "Title" },
        { key: "dueDate", label: "Due" },
        { key: "totalMarks", label: "Marks" },
        { key: "status", label: "Status" },
        { key: "classId", label: "Class" },
        { key: "subjectId", label: "Subject" },
        { key: "teacherId", label: "Teacher" },
      ]}
    />
  );
}
