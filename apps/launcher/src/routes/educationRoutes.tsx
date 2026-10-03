import { Navigate, Route } from "react-router-dom";
import { lazy } from "react";

const EducationDashboardPage = lazy(() =>
  import("../education/pages/EducationDashboardPage").then((m) => ({ default: m.EducationDashboardPage })),
);
const EducationControlCenterPage = lazy(() =>
  import("../education/pages/EducationControlCenterPage").then((m) => ({
    default: m.EducationControlCenterPage,
  })),
);
const EducationLookupsPage = lazy(() =>
  import("../education/pages/EducationLookupsPage").then((m) => ({ default: m.EducationLookupsPage })),
);
const EducationStudentsPage = lazy(() =>
  import("../education/pages/EducationStudentsPage").then((m) => ({ default: m.EducationStudentsPage })),
);
const EducationAcademicsPage = lazy(() =>
  import("../education/pages/EducationAcademicsPage").then((m) => ({ default: m.EducationAcademicsPage })),
);
const EducationFeesPage = lazy(() =>
  import("../education/pages/EducationFeesPage").then((m) => ({ default: m.EducationFeesPage })),
);
const EducationAdmissionsPage = lazy(() =>
  import("../education/pages/EducationAdmissionsPage").then((m) => ({ default: m.EducationAdmissionsPage })),
);
const EducationTeachersPage = lazy(() =>
  import("../education/pages/EducationTeachersPage").then((m) => ({ default: m.EducationTeachersPage })),
);
const EducationParentsPage = lazy(() =>
  import("../education/pages/EducationParentsPage").then((m) => ({ default: m.EducationParentsPage })),
);
const EducationStaffPage = lazy(() =>
  import("../education/pages/EducationStaffPage").then((m) => ({ default: m.EducationStaffPage })),
);
const EducationDepartmentsPage = lazy(() =>
  import("../education/pages/EducationAcademicStructurePages").then((m) => ({
    default: m.EducationDepartmentsPage,
  })),
);
const EducationProgramsPage = lazy(() =>
  import("../education/pages/EducationAcademicStructurePages").then((m) => ({
    default: m.EducationProgramsPage,
  })),
);
const EducationCoursesPage = lazy(() =>
  import("../education/pages/EducationAcademicStructurePages").then((m) => ({
    default: m.EducationCoursesPage,
  })),
);
const EducationBatchesPage = lazy(() =>
  import("../education/pages/EducationAcademicStructurePages").then((m) => ({
    default: m.EducationBatchesPage,
  })),
);
const EducationTimetablePage = lazy(() =>
  import("../education/pages/EducationTimetablePage").then((m) => ({ default: m.EducationTimetablePage })),
);
const EducationAttendancePage = lazy(() =>
  import("../education/pages/EducationAttendancePage").then((m) => ({
    default: m.EducationAttendancePage,
  })),
);
const EducationExaminationsPage = lazy(() =>
  import("../education/pages/EducationExamsPages").then((m) => ({
    default: m.EducationExaminationsPage,
  })),
);
const EducationResultsPage = lazy(() =>
  import("../education/pages/EducationExamsPages").then((m) => ({ default: m.EducationResultsPage })),
);
const EducationFinancePage = lazy(() =>
  import("../education/pages/EducationFinancePages").then((m) => ({ default: m.EducationFinancePage })),
);
const EducationExpensesPage = lazy(() =>
  import("../education/pages/EducationFinancePages").then((m) => ({ default: m.EducationExpensesPage })),
);
const EducationPayrollPage = lazy(() =>
  import("../education/pages/EducationFinancePages").then((m) => ({ default: m.EducationPayrollPage })),
);
const EducationLibraryPage = lazy(() =>
  import("../education/pages/EducationOpsPages").then((m) => ({ default: m.EducationLibraryPage })),
);
const EducationTransportPage = lazy(() =>
  import("../education/pages/EducationOpsPages").then((m) => ({ default: m.EducationTransportPage })),
);
const EducationCommunicationPage = lazy(() =>
  import("../education/pages/EducationMiscPages").then((m) => ({
    default: m.EducationCommunicationPage,
  })),
);
const EducationDocumentsPage = lazy(() =>
  import("../education/pages/EducationMiscPages").then((m) => ({
    default: m.EducationDocumentsPage,
  })),
);
const EducationReportsPage = lazy(() =>
  import("../education/pages/EducationMiscPages").then((m) => ({ default: m.EducationReportsPage })),
);
const EducationSettingsPage = lazy(() =>
  import("../education/pages/EducationMiscPages").then((m) => ({ default: m.EducationSettingsPage })),
);
const EducationLeavePage = lazy(() =>
  import("../education/pages/EducationLeavePage").then((m) => ({ default: m.EducationLeavePage })),
);
const EducationDisciplinePage = lazy(() =>
  import("../education/pages/EducationDisciplinePage").then((m) => ({
    default: m.EducationDisciplinePage,
  })),
);
const EducationLifecyclePage = lazy(() =>
  import("../education/pages/EducationLifecyclePage").then((m) => ({
    default: m.EducationLifecyclePage,
  })),
);
const EducationAssignmentsPage = lazy(() =>
  import("../education/pages/EducationAssignmentsPage").then((m) => ({
    default: m.EducationAssignmentsPage,
  })),
);
const EducationScholarshipsPage = lazy(() =>
  import("../education/pages/EducationScholarshipsPage").then((m) => ({
    default: m.EducationScholarshipsPage,
  })),
);
const EducationRefundsPage = lazy(() =>
  import("../education/pages/EducationRefundsPage").then((m) => ({ default: m.EducationRefundsPage })),
);
const EducationFacilitiesPage = lazy(() =>
  import("../education/pages/EducationFacilitiesPage").then((m) => ({
    default: m.EducationFacilitiesPage,
  })),
);
const EducationLabsPage = lazy(() =>
  import("../education/pages/EducationLabsPage").then((m) => ({ default: m.EducationLabsPage })),
);
const EducationInventoryPage = lazy(() =>
  import("../education/pages/EducationInventoryPage").then((m) => ({
    default: m.EducationInventoryPage,
  })),
);
const EducationFrontDeskPage = lazy(() =>
  import("../education/pages/EducationFrontDeskPage").then((m) => ({
    default: m.EducationFrontDeskPage,
  })),
);
const EducationEventsPage = lazy(() =>
  import("../education/pages/EducationEventsPage").then((m) => ({ default: m.EducationEventsPage })),
);
const EducationAlumniPage = lazy(() =>
  import("../education/pages/EducationAlumniPage").then((m) => ({ default: m.EducationAlumniPage })),
);
const EducationHealthPage = lazy(() =>
  import("../education/pages/EducationHealthPage").then((m) => ({ default: m.EducationHealthPage })),
);
const EducationHostelPage = lazy(() =>
  import("../education/pages/EducationHostelPage").then((m) => ({ default: m.EducationHostelPage })),
);
const EducationCustomFieldsPage = lazy(() =>
  import("../education/pages/EducationCustomFieldsPage").then((m) => ({
    default: m.EducationCustomFieldsPage,
  })),
);
const EducationWorkflowsPage = lazy(() =>
  import("../education/pages/EducationWorkflowsPage").then((m) => ({
    default: m.EducationWorkflowsPage,
  })),
);
const EducationNotificationRulesPage = lazy(() =>
  import("../education/pages/EducationNotificationRulesPage").then((m) => ({
    default: m.EducationNotificationRulesPage,
  })),
);
const EducationSystemHealthPage = lazy(() =>
  import("../education/pages/EducationSystemHealthPage").then((m) => ({
    default: m.EducationSystemHealthPage,
  })),
);

/** EducationFlow routes. Rendered only in education or suite editions. */
export function educationRoutes(): JSX.Element {
  return (
    <>
      <Route path="education" element={<Navigate to="/pops/education/dashboard" replace />} />
      <Route path="education/dashboard" element={<EducationDashboardPage />} />
      <Route path="education/control-center" element={<EducationControlCenterPage />} />
      <Route path="education/lookups" element={<EducationLookupsPage />} />
      <Route path="education/students" element={<EducationStudentsPage />} />
      <Route path="education/academics" element={<EducationAcademicsPage />} />
      <Route path="education/classes" element={<Navigate to="/pops/education/academics" replace />} />
      <Route path="education/sections" element={<Navigate to="/pops/education/academics" replace />} />
      <Route path="education/subjects" element={<Navigate to="/pops/education/academics" replace />} />
      <Route path="education/fees" element={<EducationFeesPage />} />
      <Route path="education/admissions" element={<EducationAdmissionsPage />} />
      <Route path="education/teachers" element={<EducationTeachersPage />} />
      <Route path="education/parents" element={<EducationParentsPage />} />
      <Route path="education/staff" element={<EducationStaffPage />} />
      <Route path="education/departments" element={<EducationDepartmentsPage />} />
      <Route path="education/programs" element={<EducationProgramsPage />} />
      <Route path="education/courses" element={<EducationCoursesPage />} />
      <Route path="education/batches" element={<EducationBatchesPage />} />
      <Route path="education/timetable" element={<EducationTimetablePage />} />
      <Route path="education/attendance" element={<EducationAttendancePage />} />
      <Route path="education/examinations" element={<EducationExaminationsPage />} />
      <Route path="education/results" element={<EducationResultsPage />} />
      <Route path="education/finance" element={<EducationFinancePage />} />
      <Route path="education/expenses" element={<EducationExpensesPage />} />
      <Route path="education/payroll" element={<EducationPayrollPage />} />
      <Route path="education/library" element={<EducationLibraryPage />} />
      <Route path="education/transport" element={<EducationTransportPage />} />
      <Route path="education/communication" element={<EducationCommunicationPage />} />
      <Route path="education/documents" element={<EducationDocumentsPage />} />
      <Route path="education/reports" element={<EducationReportsPage />} />
      <Route path="education/settings" element={<EducationSettingsPage />} />
      <Route path="education/leave" element={<EducationLeavePage />} />
      <Route path="education/discipline" element={<EducationDisciplinePage />} />
      <Route path="education/lifecycle" element={<EducationLifecyclePage />} />
      <Route path="education/assignments" element={<EducationAssignmentsPage />} />
      <Route path="education/scholarships" element={<EducationScholarshipsPage />} />
      <Route path="education/refunds" element={<EducationRefundsPage />} />
      <Route path="education/facilities" element={<EducationFacilitiesPage />} />
      <Route path="education/labs" element={<EducationLabsPage />} />
      <Route path="education/inventory" element={<EducationInventoryPage />} />
      <Route path="education/front-desk" element={<EducationFrontDeskPage />} />
      <Route path="education/events" element={<EducationEventsPage />} />
      <Route path="education/alumni" element={<EducationAlumniPage />} />
      <Route path="education/health" element={<EducationHealthPage />} />
      <Route path="education/hostel" element={<EducationHostelPage />} />
      <Route path="education/custom-fields" element={<EducationCustomFieldsPage />} />
      <Route path="education/workflows" element={<EducationWorkflowsPage />} />
      <Route path="education/notification-rules" element={<EducationNotificationRulesPage />} />
      <Route path="education/system-health" element={<EducationSystemHealthPage />} />
    </>
  );
}
