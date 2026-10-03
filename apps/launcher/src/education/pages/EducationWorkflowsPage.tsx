import {
  createEducationWorkflowDef,
  fetchEducationWorkflowDefs,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationWorkflowsPage(): JSX.Element {
  return (
    <EducationModulePage
      title="Workflows"
      subtitle="Configure workflow definitions and state machines for campus processes."
      resourceKey="workflow-defs"
      fetchList={async () => fetchEducationWorkflowDefs()}
      createFn={createEducationWorkflowDef}
      createLabel="Create workflow"
      formTitle="New workflow"
      requireBranch={false}
      searchKeys={["workflowKey", "name"]}
      fields={[
        { key: "workflowKey", label: "Workflow key", required: true, placeholder: "admission_review" },
        { key: "name", label: "Name", required: true },
        {
          key: "statesJson",
          label: "States JSON",
          required: true,
          placeholder: '["draft","pending","approved"]',
        },
      ]}
      buildBody={(values) => ({
        workflowKey: values.workflowKey.trim(),
        name: values.name.trim(),
        statesJson: values.statesJson.trim(),
        isActive: true,
      })}
      columns={[
        { key: "workflowKey", label: "Key" },
        { key: "name", label: "Name" },
        { key: "statesJson", label: "States" },
        {
          key: "isActive",
          label: "Active",
          render: (row) => (row.isActive === false ? "No" : "Yes"),
        },
      ]}
    />
  );
}
