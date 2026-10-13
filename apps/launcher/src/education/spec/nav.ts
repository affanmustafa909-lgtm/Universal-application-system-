import type { EducationModuleKey } from "@platform/contracts";
import type { PopsNavGroup, PopsNavItem, PopsNavLink } from "../../pops/spec/modules";

/** EducationFlow Management System sidebar — School • Academy • College. */
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

/** Map nav path → Education module key (paths without a module stay always visible). */
export const EDUCATION_NAV_PATH_MODULE: Record<string, EducationModuleKey> = {
  "education/dashboard": "dashboard",
  "education/control-center": "control_center",
  "education/admissions": "admissions",
  "education/students": "students",
  "education/parents": "parents",
  "education/teachers": "teachers",
  "education/staff": "staff",
  "education/leave": "leave",
  "education/discipline": "discipline",
  "education/academics": "academics",
  "education/classes": "classes",
  "education/sections": "sections",
  "education/subjects": "academics",
  "education/departments": "departments",
  "education/programs": "programs",
  "education/courses": "courses",
  "education/batches": "batches",
  "education/timetable": "timetable",
  "education/assignments": "assignments",
  "education/lifecycle": "lifecycle",
  "education/attendance": "attendance",
  "education/examinations": "examinations",
  "education/results": "results",
  "education/fees": "fees",
  "education/finance": "finance",
  "education/expenses": "expenses",
  "education/payroll": "payroll",
  "education/scholarships": "scholarships",
  "education/refunds": "refunds",
  "education/library": "library",
  "education/transport": "transport",
  "education/communication": "communication",
  "education/documents": "documents",
  "education/facilities": "facilities",
  "education/labs": "labs",
  "education/inventory": "inventory",
  "education/front-desk": "front_desk",
  "education/events": "events",
  "education/hostel": "hostel",
  "education/alumni": "alumni",
  "education/health": "health",
  "education/reports": "reports",
  "education/settings": "settings",
  "education/custom-fields": "custom_fields",
  "education/workflows": "workflows",
  "education/notification-rules": "notification_rules",
};

export type EducationInstitutionType = "school" | "college" | "university" | "academy";

/** Modules emphasized / typically enabled per institution type profile. */
export const EDUCATION_INSTITUTION_PROFILES: Record<EducationInstitutionType, EducationModuleKey[]> = {
  school: [
    "dashboard",
    "admissions",
    "students",
    "parents",
    "teachers",
    "staff",
    "academics",
    "classes",
    "sections",
    "timetable",
    "attendance",
    "examinations",
    "results",
    "fees",
    "finance",
    "library",
    "transport",
    "communication",
    "documents",
    "reports",
    "settings",
    "control_center",
    "leave",
    "discipline",
    "lifecycle",
    "front_desk",
    "hostel",
    "health",
  ],
  academy: [
    "dashboard",
    "admissions",
    "students",
    "teachers",
    "staff",
    "batches",
    "courses",
    "timetable",
    "attendance",
    "examinations",
    "results",
    "fees",
    "finance",
    "communication",
    "documents",
    "reports",
    "settings",
    "control_center",
    "front_desk",
  ],
  college: [
    "dashboard",
    "admissions",
    "students",
    "parents",
    "teachers",
    "staff",
    "departments",
    "programs",
    "courses",
    "batches",
    "timetable",
    "attendance",
    "examinations",
    "results",
    "fees",
    "finance",
    "expenses",
    "payroll",
    "library",
    "hostel",
    "labs",
    "alumni",
    "reports",
    "settings",
    "control_center",
    "lifecycle",
    "scholarships",
  ],
  university: [
    "dashboard",
    "admissions",
    "students",
    "teachers",
    "staff",
    "departments",
    "programs",
    "courses",
    "batches",
    "timetable",
    "attendance",
    "examinations",
    "results",
    "fees",
    "finance",
    "expenses",
    "payroll",
    "library",
    "hostel",
    "labs",
    "alumni",
    "reports",
    "settings",
    "control_center",
    "lifecycle",
    "scholarships",
    "custom_fields",
    "workflows",
  ],
};

export function parseEducationInstitutionType(
  value: string | null | undefined,
): EducationInstitutionType | null {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "school" || v === "college" || v === "university" || v === "academy") return v;
  return null;
}

export function educationModulesForInstitutionType(
  type: string | null | undefined,
): EducationModuleKey[] | null {
  const parsed = parseEducationInstitutionType(type);
  if (!parsed) return null;
  return EDUCATION_INSTITUTION_PROFILES[parsed];
}

type ModuleFlag = { moduleKey: string; enabled: boolean };

/**
 * Filter education nav by enabled modules.
 * When `modules` is empty/undefined, returns items unchanged (all visible).
 * Paths without a module mapping (lookups, auth, multi-branch, sync, system-health) stay visible.
 */
export function filterEducationNavByModules(
  items: PopsNavItem[],
  modules: ModuleFlag[] | null | undefined,
): PopsNavItem[] {
  if (!modules || modules.length === 0) return items;

  const enabled = new Set(modules.filter((m) => m.enabled).map((m) => m.moduleKey));
  const knownKeys = new Set(modules.map((m) => m.moduleKey));

  const pathAllowed = (path: string): boolean => {
    const key = EDUCATION_NAV_PATH_MODULE[path];
    if (!key) return true;
    if (!knownKeys.has(key)) return true;
    return enabled.has(key);
  };

  const out: PopsNavItem[] = [];
  for (const item of items) {
    if (item.type === "link") {
      if (pathAllowed(item.path)) out.push(item);
      continue;
    }
    const children = item.children.filter((c) => pathAllowed(c.path));
    if (children.length === 0) continue;
    if (children.length === 1) {
      const only = children[0]!;
      const link: PopsNavLink = { type: "link", path: only.path, label: only.label };
      out.push(link);
      continue;
    }
    const group: PopsNavGroup = { type: "group", label: item.label, children };
    out.push(group);
  }
  return out;
}
