import type { PopsNavItem } from "../../pops/spec/modules";

/** EducationFlow ERP sidebar — School • Academy • College. */
export const educationNavItems: PopsNavItem[] = [
  { type: "link", path: "education/dashboard", label: "Dashboard" },
  { type: "link", path: "education/control-center", label: "Control Center" },
  { type: "link", path: "education/lookups", label: "Lookups" },
  {
    type: "group",
    label: "People",
    children: [
      { path: "education/admissions", label: "Admissions" },
      { path: "education/students", label: "Students" },
      { path: "education/parents", label: "Parents" },
      { path: "education/teachers", label: "Teachers" },
      { path: "education/staff", label: "Staff" },
      { path: "education/leave", label: "Leave" },
      { path: "education/discipline", label: "Discipline" },
    ],
  },
  {
    type: "group",
    label: "Academics",
    children: [
      { path: "education/academics", label: "Sessions & structure" },
      { path: "education/classes", label: "Classes" },
      { path: "education/sections", label: "Sections" },
      { path: "education/subjects", label: "Subjects" },
      { path: "education/departments", label: "Departments" },
      { path: "education/programs", label: "Programs" },
      { path: "education/courses", label: "Courses" },
      { path: "education/batches", label: "Batches" },
      { path: "education/timetable", label: "Timetable" },
      { path: "education/assignments", label: "Assignments" },
      { path: "education/lifecycle", label: "Student lifecycle / Promotion" },
    ],
  },
  {
    type: "group",
    label: "Attendance & exams",
    children: [
      { path: "education/attendance", label: "Attendance" },
      { path: "education/examinations", label: "Examinations" },
      { path: "education/results", label: "Results" },
    ],
  },
  {
    type: "group",
    label: "Fees & finance",
    children: [
      { path: "education/fees", label: "Fees" },
      { path: "education/finance", label: "Finance" },
      { path: "education/expenses", label: "Expenses" },
      { path: "education/payroll", label: "Payroll" },
      { path: "education/scholarships", label: "Scholarships" },
      { path: "education/refunds", label: "Refunds" },
    ],
  },
  {
    type: "group",
    label: "Campus services",
    children: [
      { path: "education/library", label: "Library" },
      { path: "education/transport", label: "Transport" },
      { path: "education/communication", label: "Communication" },
      { path: "education/documents", label: "Documents" },
      { path: "education/facilities", label: "Facilities / Buildings" },
      { path: "education/labs", label: "Labs & Equipment" },
      { path: "education/inventory", label: "Inventory" },
      { path: "education/front-desk", label: "Front desk" },
      { path: "education/events", label: "Events" },
      { path: "education/hostel", label: "Hostel" },
      { path: "education/alumni", label: "Alumni" },
      { path: "education/health", label: "Health" },
    ],
  },
  {
    type: "group",
    label: "Reports & admin",
    children: [
      { path: "education/reports", label: "Reports" },
      { path: "auth", label: "Users & roles" },
      { path: "education/settings", label: "Settings" },
      { path: "multi-branch", label: "Branches" },
      { path: "notifications", label: "Notifications" },
      { path: "sync", label: "Backup / sync" },
      { path: "education/custom-fields", label: "Custom fields" },
      { path: "education/workflows", label: "Workflows" },
      { path: "education/notification-rules", label: "Notification rules" },
      { path: "education/system-health", label: "System health" },
    ],
  },
];

export const EDUCATION_ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full campus control, users, fees, and settings",
  principal: "Principal — academics, teachers, reports, admissions",
  accountant: "Accountant — fees, invoices, payments, expenses",
  teacher: "Teacher — classes, attendance, examinations, results",
  registrar: "Registrar — admissions, students, documents",
};
