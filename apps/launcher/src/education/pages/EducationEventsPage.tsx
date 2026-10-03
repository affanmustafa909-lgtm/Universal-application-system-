import {
  createEducationEvent,
  fetchEducationEvents,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationEventsPage(): JSX.Element {
  return (
    <EducationModulePage
      title="Events"
      subtitle="Plan and publish campus events for students, parents, and staff."
      resourceKey="events"
      fetchList={fetchEducationEvents}
      createFn={createEducationEvent}
      createLabel="Create event"
      formTitle="New event"
      searchKeys={["title", "eventTypeCode", "status", "audienceCode"]}
      fields={[
        { key: "title", label: "Title", required: true },
        { key: "eventTypeCode", label: "Event type", required: true },
        { key: "startDate", label: "Start date", required: true, type: "date" },
        { key: "endDate", label: "End date", type: "date", omitIfEmpty: true },
        { key: "audienceCode", label: "Audience", omitIfEmpty: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ],
        },
        { key: "description", label: "Description", omitIfEmpty: true },
      ]}
      columns={[
        { key: "title", label: "Title" },
        { key: "eventTypeCode", label: "Type" },
        { key: "startDate", label: "Start" },
        { key: "endDate", label: "End" },
        { key: "audienceCode", label: "Audience" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
