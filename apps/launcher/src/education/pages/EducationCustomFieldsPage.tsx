import {
  createEducationCustomFieldDef,
  fetchEducationCustomFieldDefs,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationCustomFieldsPage(): JSX.Element {
  return (
    <EducationModulePage
      title="Custom fields"
      subtitle="Define extra fields for students, staff, admissions, and other entities."
      resourceKey="custom-field-defs"
      fetchList={async () => fetchEducationCustomFieldDefs()}
      createFn={createEducationCustomFieldDef}
      createLabel="Add field"
      formTitle="New custom field"
      requireBranch={false}
      searchKeys={["entityType", "fieldKey", "label", "fieldType"]}
      fields={[
        {
          key: "entityType",
          label: "Entity type",
          required: true,
          placeholder: "student / staff / admission / …",
        },
        { key: "fieldKey", label: "Field key", required: true },
        { key: "label", label: "Label", required: true },
        {
          key: "fieldType",
          label: "Field type",
          required: true,
          type: "select",
          options: [
            { value: "text", label: "Text" },
            { value: "number", label: "Number" },
            { value: "email", label: "Email" },
            { value: "phone", label: "Phone" },
            { value: "date", label: "Date" },
            { value: "dropdown", label: "Dropdown" },
            { value: "multiselect", label: "Multi-select" },
            { value: "checkbox", label: "Checkbox" },
            { value: "textarea", label: "Textarea" },
            { value: "file", label: "File" },
            { value: "boolean", label: "Boolean" },
          ],
        },
        {
          key: "required",
          label: "Required",
          type: "select",
          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],
        },
        { key: "optionsJson", label: "Options JSON", omitIfEmpty: true, placeholder: '["A","B"]' },
        { key: "sortOrder", label: "Sort order", type: "number", omitIfEmpty: true },
      ]}
      buildBody={(values) => ({
        entityType: values.entityType.trim(),
        fieldKey: values.fieldKey.trim(),
        label: values.label.trim(),
        fieldType: values.fieldType,
        required: values.required === "true",
        optionsJson: values.optionsJson.trim() || undefined,
        sortOrder: values.sortOrder ? Number(values.sortOrder) : undefined,
        isActive: true,
      })}
      columns={[
        { key: "entityType", label: "Entity" },
        { key: "fieldKey", label: "Key" },
        { key: "label", label: "Label" },
        { key: "fieldType", label: "Type" },
        {
          key: "required",
          label: "Required",
          render: (row) => (row.required ? "Yes" : "No"),
        },
        {
          key: "isActive",
          label: "Active",
          render: (row) => (row.isActive ? "Yes" : "No"),
        },
      ]}
    />
  );
}
