import {
  createEducationNotificationRule,
  fetchEducationNotificationRules,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationNotificationRulesPage(): JSX.Element {
  return (
    <EducationModulePage
      title="Notification rules"
      subtitle="Define automated notification triggers, audiences, and message templates."
      resourceKey="notification-rules"
      fetchList={async () => fetchEducationNotificationRules()}
      createFn={createEducationNotificationRule}
      createLabel="Create rule"
      formTitle="New notification rule"
      requireBranch={false}
      searchKeys={["ruleKey", "triggerKey", "audienceCode"]}
      fields={[
        { key: "ruleKey", label: "Rule key", required: true },
        { key: "triggerKey", label: "Trigger key", required: true, placeholder: "fee_overdue" },
        { key: "audienceCode", label: "Audience", required: true, placeholder: "parents / students / …" },
        { key: "messageTemplate", label: "Message template", required: true },
        {
          key: "enabled",
          label: "Enabled",
          type: "select",
          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],
        },
      ]}
      buildBody={(values) => ({
        ruleKey: values.ruleKey.trim(),
        triggerKey: values.triggerKey.trim(),
        audienceCode: values.audienceCode.trim(),
        messageTemplate: values.messageTemplate.trim(),
        enabled: values.enabled !== "false",
      })}
      columns={[
        { key: "ruleKey", label: "Rule" },
        { key: "triggerKey", label: "Trigger" },
        { key: "audienceCode", label: "Audience" },
        { key: "messageTemplate", label: "Template" },
        {
          key: "enabled",
          label: "Enabled",
          render: (row) => (row.enabled === false ? "No" : "Yes"),
        },
      ]}
    />
  );
}
