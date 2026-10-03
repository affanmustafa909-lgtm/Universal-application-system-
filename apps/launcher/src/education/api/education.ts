import {
  EDUCATION_LOOKUP_CATEGORIES,
  educationAcademicSessionSchema,
  educationAdmissionSchema,
  educationAlumniSchema,
  educationAssignmentSchema,
  educationAssignmentSubmissionSchema,
  educationAttendanceSchema,
  educationBatchSchema,
  educationBatchStudentSchema,
  educationBookIssueSchema,
  educationBookSchema,
  educationClassSchema,
  educationCourseSchema,
  educationCustomFieldDefSchema,
  educationCustomFieldValueSchema,
  educationDashboardSchema,
  educationDepartmentSchema,
  educationDisciplineIncidentSchema,
  educationDocumentTemplateSchema,
  educationEnquirySchema,
  educationEventSchema,
  educationExamSchema,
  educationExamSubjectSchema,
  educationExpenseSchema,
  educationFeeInvoiceSchema,
  educationFeePaymentSchema,
  educationFeeRefundSchema,
  educationFeeStructureSchema,
  educationFinanceTxnSchema,
  educationGeneratedDocumentSchema,
  educationGuardianSchema,
  educationHealthRecordSchema,
  educationHealthVisitSchema,
  educationHostelAllocationSchema,
  educationHostelBedSchema,
  educationHostelRoomSchema,
  educationHostelSchema,
  educationLeaveRequestSchema,
  educationLookupSchema,
  educationMarkSchema,
  educationModuleSchema,
  educationNoticeSchema,
  educationPayrollRunSchema,
  educationPayslipSchema,
  educationPeriodSchema,
  educationProgramSchema,
  educationRoomSchema,
  educationRouteSchema,
  educationRouteStopSchema,
  educationScholarshipAwardSchema,
  educationScholarshipSchema,
  educationSectionSchema,
  educationSettingSchema,
  educationStaffSchema,
  educationStudentLifecycleSchema,
  educationStudentSchema,
  educationSubjectSchema,
  educationTimetableSlotSchema,
  educationTransportAssignmentSchema,
  educationVehicleSchema,
  type EducationLookupCategory,
  type EducationModuleKey,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

type ZodLike<T> = { parse: (v: unknown) => T };

async function parseError(res: Response, fallback: string): Promise<never> {
  let msg = fallback;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {
    // ignore
  }
  throw new Error(msg);
}

function parseFlexible<T>(schema: ZodLike<T> | undefined, json: unknown): T {
  if (schema) {
    try {
      return schema.parse(json);
    } catch {
      return json as T;
    }
  }
  return json as T;
}

function parseFlexibleArray<T>(schema: ZodLike<T> | undefined, json: unknown): T[] {
  if (!Array.isArray(json)) return [];
  return json.map((row) => parseFlexible(schema, row));
}

function qs(branchCode: string, extra?: Record<string, string | undefined>): string {
  const params: Record<string, string> = { branchCode };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && v !== "") params[k] = v;
    }
  }
  return new URLSearchParams(params).toString();
}

async function getJson(path: string, fallback: string): Promise<unknown> {
  const res = await authFetch(path);
  if (!res.ok) await parseError(res, fallback);
  return res.json();
}

async function sendJson(
  path: string,
  method: string,
  body: unknown,
  fallback: string,
): Promise<unknown> {
  const res = await authFetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, fallback);
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export { EDUCATION_LOOKUP_CATEGORIES };

export type EducationTeacher = {
  id: string;
  organizationId?: string;
  branchId?: string;
  employeeNumber: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  departmentId?: string | null;
  designation?: string | null;
  employmentTypeCode?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type EducationFinanceSummary = {
  incomePkr?: number;
  expensePkr?: number;
  netPkr?: number;
  pendingFeesPkr?: number;
  collectedPkr?: number;
  payrollPkr?: number;
  [key: string]: unknown;
};

export type EducationAuditLog = {
  id: string;
  action?: string;
  moduleKey?: string;
  recordId?: string | null;
  detail?: string | null;
  createdAt?: string;
  [key: string]: unknown;
};

export type EducationRow = Record<string, unknown> & { id?: string };

export async function fetchEducationDashboard(branchCode: string) {
  const json = await getJson(
    `/v1/education/dashboard?${qs(branchCode)}`,
    "Failed to load education dashboard",
  );
  try {
    const base = educationDashboardSchema.parse(json);
    return {
      ...base,
      ...(typeof json === "object" && json ? (json as Record<string, unknown>) : {}),
    };
  } catch {
    return json as ReturnType<typeof educationDashboardSchema.parse> & Record<string, unknown>;
  }
}

export async function fetchEducationModules() {
  return parseFlexibleArray(educationModuleSchema, await getJson("/v1/education/modules", "Failed to load modules"));
}

export async function upsertEducationModule(body: {
  moduleKey: EducationModuleKey;
  enabled: boolean;
  sortOrder?: number;
}) {
  return parseFlexible(
    educationModuleSchema,
    await sendJson("/v1/education/modules", "POST", body, "Failed to update module"),
  );
}

export async function bootstrapEducationDefaults(branchCode?: string) {
  return sendJson(
    "/v1/education/bootstrap-defaults",
    "POST",
    branchCode ? { branchCode } : {},
    "Failed to initialize EducationFlow defaults",
  ) as Promise<{ ok: boolean; lookupsCreated?: number; modulesCreated?: number }>;
}

export async function fetchEducationLookups(branchCode: string, category?: EducationLookupCategory) {
  return parseFlexibleArray(
    educationLookupSchema,
    await getJson(
    `/v1/education/lookups?${qs(branchCode, category ? { category } : undefined)}`,
      "Failed to load lookups",
    ),
  );
}

export async function createEducationLookup(body: unknown) {
  return parseFlexible(
    educationLookupSchema,
    await sendJson("/v1/education/lookups", "POST", body, "Failed to create lookup"),
  );
}

export async function updateEducationLookup(id: string, body: unknown) {
  return parseFlexible(
    educationLookupSchema,
    await sendJson(`/v1/education/lookups/${id}`, "PATCH", body, "Failed to update lookup"),
  );
}

export async function fetchEducationSettings(branchCode: string) {
  return parseFlexibleArray(
    educationSettingSchema,
    await getJson(`/v1/education/settings?${qs(branchCode)}`, "Failed to load settings"),
  );
}

export async function upsertEducationSetting(body: unknown) {
  return parseFlexible(
    educationSettingSchema,
    await sendJson("/v1/education/settings", "POST", body, "Failed to save setting"),
  );
}

export async function fetchEducationSessions(branchCode: string) {
  return parseFlexibleArray(
    educationAcademicSessionSchema,
    await getJson(`/v1/education/sessions?${qs(branchCode)}`, "Failed to load academic sessions"),
  );
}

export async function createEducationSession(body: unknown) {
  return parseFlexible(
    educationAcademicSessionSchema,
    await sendJson("/v1/education/sessions", "POST", body, "Failed to create session"),
  );
}

export async function fetchEducationClasses(branchCode: string) {
  return parseFlexibleArray(
    educationClassSchema,
    await getJson(`/v1/education/classes?${qs(branchCode)}`, "Failed to load classes"),
  );
}

export async function createEducationClass(body: unknown) {
  return parseFlexible(
    educationClassSchema,
    await sendJson("/v1/education/classes", "POST", body, "Failed to create class"),
  );
}

export async function fetchEducationSections(branchCode: string, classId?: string) {
  return parseFlexibleArray(
    educationSectionSchema,
    await getJson(
    `/v1/education/sections?${qs(branchCode, classId ? { classId } : undefined)}`,
      "Failed to load sections",
    ),
  );
}

export async function createEducationSection(body: unknown) {
  return parseFlexible(
    educationSectionSchema,
    await sendJson("/v1/education/sections", "POST", body, "Failed to create section"),
  );
}

export async function fetchEducationSubjects(branchCode: string) {
  return parseFlexibleArray(
    educationSubjectSchema,
    await getJson(`/v1/education/subjects?${qs(branchCode)}`, "Failed to load subjects"),
  );
}

export async function createEducationSubject(body: unknown) {
  return parseFlexible(
    educationSubjectSchema,
    await sendJson("/v1/education/subjects", "POST", body, "Failed to create subject"),
  );
}

export async function fetchEducationStudents(branchCode: string) {
  return parseFlexibleArray(
    educationStudentSchema,
    await getJson(`/v1/education/students?${qs(branchCode)}`, "Failed to load students"),
  );
}

export async function createEducationStudent(body: unknown) {
  return parseFlexible(
    educationStudentSchema,
    await sendJson("/v1/education/students", "POST", body, "Failed to enroll student"),
  );
}

export async function updateEducationStudent(id: string, body: unknown) {
  return parseFlexible(
    educationStudentSchema,
    await sendJson(`/v1/education/students/${id}`, "PATCH", body, "Failed to update student"),
  );
}

export async function fetchEducationFeeStructures(branchCode: string) {
  return parseFlexibleArray(
    educationFeeStructureSchema,
    await getJson(`/v1/education/fee-structures?${qs(branchCode)}`, "Failed to load fee structures"),
  );
}

export async function createEducationFeeStructure(body: unknown) {
  return parseFlexible(
    educationFeeStructureSchema,
    await sendJson("/v1/education/fee-structures", "POST", body, "Failed to create fee structure"),
  );
}

export async function fetchEducationFeeInvoices(branchCode: string) {
  return parseFlexibleArray(
    educationFeeInvoiceSchema,
    await getJson(`/v1/education/fee-invoices?${qs(branchCode)}`, "Failed to load fee invoices"),
  );
}

export async function createEducationFeeInvoice(body: unknown) {
  return parseFlexible(
    educationFeeInvoiceSchema,
    await sendJson("/v1/education/fee-invoices", "POST", body, "Failed to create fee invoice"),
  );
}

export async function fetchEducationFeePayments(branchCode: string) {
  return parseFlexibleArray(
    educationFeePaymentSchema,
    await getJson(`/v1/education/fee-payments?${qs(branchCode)}`, "Failed to load fee payments"),
  );
}

export async function createEducationFeePayment(body: unknown) {
  return parseFlexible(
    educationFeePaymentSchema,
    await sendJson("/v1/education/fee-payments", "POST", body, "Failed to record payment"),
  );
}

export async function fetchEducationAdmissions(branchCode: string) {
  return parseFlexibleArray(
    educationAdmissionSchema,
    await getJson(`/v1/education/admissions?${qs(branchCode)}`, "Failed to load admissions"),
  );
}

export async function createEducationAdmission(body: unknown) {
  return parseFlexible(
    educationAdmissionSchema,
    await sendJson("/v1/education/admissions", "POST", body, "Failed to create admission"),
  );
}

/* ——— Guardians ——— */
export async function fetchEducationGuardians(branchCode: string) {
  return parseFlexibleArray(
    educationGuardianSchema,
    await getJson(`/v1/education/guardians?${qs(branchCode)}`, "Failed to load guardians"),
  );
}
export async function createEducationGuardian(body: unknown) {
  return parseFlexible(
    educationGuardianSchema,
    await sendJson("/v1/education/guardians", "POST", body, "Failed to create guardian"),
  );
}
export async function updateEducationGuardian(id: string, body: unknown) {
  return parseFlexible(
    educationGuardianSchema,
    await sendJson(`/v1/education/guardians/${id}`, "PATCH", body, "Failed to update guardian"),
  );
}

/* ——— Staff ——— */
export async function fetchEducationStaff(branchCode: string) {
  return parseFlexibleArray(
    educationStaffSchema,
    await getJson(`/v1/education/staff?${qs(branchCode)}`, "Failed to load staff"),
  );
}
export async function createEducationStaff(body: unknown) {
  return parseFlexible(
    educationStaffSchema,
    await sendJson("/v1/education/staff", "POST", body, "Failed to create staff"),
  );
}
export async function updateEducationStaff(id: string, body: unknown) {
  return parseFlexible(
    educationStaffSchema,
    await sendJson(`/v1/education/staff/${id}`, "PATCH", body, "Failed to update staff"),
  );
}

/* ——— Teachers ——— */
export async function fetchEducationTeachers(branchCode: string) {
  return parseFlexibleArray<EducationTeacher>(
    undefined,
    await getJson(`/v1/education/teachers?${qs(branchCode)}`, "Failed to load teachers"),
  );
}
export async function createEducationTeacher(body: unknown) {
  return parseFlexible<EducationTeacher>(
    undefined,
    await sendJson("/v1/education/teachers", "POST", body, "Failed to create teacher"),
  );
}
export async function updateEducationTeacher(id: string, body: unknown) {
  return parseFlexible<EducationTeacher>(
    undefined,
    await sendJson(`/v1/education/teachers/${id}`, "PATCH", body, "Failed to update teacher"),
  );
}

/* ——— Departments / Programs / Courses / Batches ——— */
export async function fetchEducationDepartments(branchCode: string) {
  return parseFlexibleArray(
    educationDepartmentSchema,
    await getJson(`/v1/education/departments?${qs(branchCode)}`, "Failed to load departments"),
  );
}
export async function createEducationDepartment(body: unknown) {
  return parseFlexible(
    educationDepartmentSchema,
    await sendJson("/v1/education/departments", "POST", body, "Failed to create department"),
  );
}
export async function updateEducationDepartment(id: string, body: unknown) {
  return parseFlexible(
    educationDepartmentSchema,
    await sendJson(`/v1/education/departments/${id}`, "PATCH", body, "Failed to update department"),
  );
}

export async function fetchEducationPrograms(branchCode: string) {
  return parseFlexibleArray(
    educationProgramSchema,
    await getJson(`/v1/education/programs?${qs(branchCode)}`, "Failed to load programs"),
  );
}
export async function createEducationProgram(body: unknown) {
  return parseFlexible(
    educationProgramSchema,
    await sendJson("/v1/education/programs", "POST", body, "Failed to create program"),
  );
}
export async function updateEducationProgram(id: string, body: unknown) {
  return parseFlexible(
    educationProgramSchema,
    await sendJson(`/v1/education/programs/${id}`, "PATCH", body, "Failed to update program"),
  );
}

export async function fetchEducationCourses(branchCode: string) {
  return parseFlexibleArray(
    educationCourseSchema,
    await getJson(`/v1/education/courses?${qs(branchCode)}`, "Failed to load courses"),
  );
}
export async function createEducationCourse(body: unknown) {
  return parseFlexible(
    educationCourseSchema,
    await sendJson("/v1/education/courses", "POST", body, "Failed to create course"),
  );
}
export async function updateEducationCourse(id: string, body: unknown) {
  return parseFlexible(
    educationCourseSchema,
    await sendJson(`/v1/education/courses/${id}`, "PATCH", body, "Failed to update course"),
  );
}

export async function fetchEducationBatches(branchCode: string) {
  return parseFlexibleArray(
    educationBatchSchema,
    await getJson(`/v1/education/batches?${qs(branchCode)}`, "Failed to load batches"),
  );
}
export async function createEducationBatch(body: unknown) {
  return parseFlexible(
    educationBatchSchema,
    await sendJson("/v1/education/batches", "POST", body, "Failed to create batch"),
  );
}
export async function updateEducationBatch(id: string, body: unknown) {
  return parseFlexible(
    educationBatchSchema,
    await sendJson(`/v1/education/batches/${id}`, "PATCH", body, "Failed to update batch"),
  );
}

export async function fetchEducationBatchStudents(branchCode: string, batchId?: string) {
  return parseFlexibleArray(
    educationBatchStudentSchema,
    await getJson(
      `/v1/education/batch-students?${qs(branchCode, batchId ? { batchId } : undefined)}`,
      "Failed to load batch enrollments",
    ),
  );
}
export async function createEducationBatchStudent(body: unknown) {
  return parseFlexible(
    educationBatchStudentSchema,
    await sendJson("/v1/education/batch-students", "POST", body, "Failed to enroll student in batch"),
  );
}

/* ——— Timetable ——— */
export async function fetchEducationPeriods(branchCode: string) {
  return parseFlexibleArray(
    educationPeriodSchema,
    await getJson(`/v1/education/periods?${qs(branchCode)}`, "Failed to load periods"),
  );
}
export async function createEducationPeriod(body: unknown) {
  return parseFlexible(
    educationPeriodSchema,
    await sendJson("/v1/education/periods", "POST", body, "Failed to create period"),
  );
}

export async function fetchEducationRooms(branchCode: string) {
  return parseFlexibleArray(
    educationRoomSchema,
    await getJson(`/v1/education/rooms?${qs(branchCode)}`, "Failed to load rooms"),
  );
}
export async function createEducationRoom(body: unknown) {
  return parseFlexible(
    educationRoomSchema,
    await sendJson("/v1/education/rooms", "POST", body, "Failed to create room"),
  );
}

export async function fetchEducationTimetable(branchCode: string, extra?: Record<string, string>) {
  return parseFlexibleArray(
    educationTimetableSlotSchema,
    await getJson(`/v1/education/timetable-slots?${qs(branchCode, extra)}`, "Failed to load timetable"),
  );
}
export async function createEducationTimetableSlot(body: unknown) {
  return parseFlexible(
    educationTimetableSlotSchema,
    await sendJson("/v1/education/timetable-slots", "POST", body, "Failed to create timetable slot"),
  );
}
export async function updateEducationTimetableSlot(id: string, body: unknown) {
  return parseFlexible(
    educationTimetableSlotSchema,
    await sendJson(`/v1/education/timetable-slots/${id}`, "PATCH", body, "Failed to update timetable slot"),
  );
}

/* ——— Attendance ——— */
export async function fetchEducationAttendance(
  branchCode: string,
  extra?: Record<string, string | undefined>,
) {
  return parseFlexibleArray(
    educationAttendanceSchema,
    await getJson(`/v1/education/attendance?${qs(branchCode, extra)}`, "Failed to load attendance"),
  );
}
export async function createEducationAttendance(body: unknown) {
  return parseFlexible(
    educationAttendanceSchema,
    await sendJson("/v1/education/attendance", "POST", body, "Failed to mark attendance"),
  );
}
export async function bulkMarkEducationAttendance(body: unknown) {
  return sendJson("/v1/education/attendance/bulk", "POST", body, "Failed to bulk-mark attendance");
}

/* ——— Exams / Marks ——— */
export async function fetchEducationExams(branchCode: string) {
  return parseFlexibleArray(
    educationExamSchema,
    await getJson(`/v1/education/exams?${qs(branchCode)}`, "Failed to load exams"),
  );
}
export async function createEducationExam(body: unknown) {
  return parseFlexible(
    educationExamSchema,
    await sendJson("/v1/education/exams", "POST", body, "Failed to create exam"),
  );
}
export async function updateEducationExam(id: string, body: unknown) {
  return parseFlexible(
    educationExamSchema,
    await sendJson(`/v1/education/exams/${id}`, "PATCH", body, "Failed to update exam"),
  );
}

export async function fetchEducationExamSubjects(branchCode: string, examId?: string) {
  return parseFlexibleArray(
    educationExamSubjectSchema,
    await getJson(
      `/v1/education/exam-subjects?${qs(branchCode, examId ? { examId } : undefined)}`,
      "Failed to load exam subjects",
    ),
  );
}
export async function createEducationExamSubject(body: unknown) {
  return parseFlexible(
    educationExamSubjectSchema,
    await sendJson("/v1/education/exam-subjects", "POST", body, "Failed to add exam subject"),
  );
}

export async function fetchEducationMarks(branchCode: string, examId?: string) {
  return parseFlexibleArray(
    educationMarkSchema,
    await getJson(
      `/v1/education/marks?${qs(branchCode, examId ? { examId } : undefined)}`,
      "Failed to load marks",
    ),
  );
}
export async function createEducationMark(body: unknown) {
  return parseFlexible(
    educationMarkSchema,
    await sendJson("/v1/education/marks", "POST", body, "Failed to save mark"),
  );
}
export async function updateEducationMark(id: string, body: unknown) {
  return parseFlexible(
    educationMarkSchema,
    await sendJson(`/v1/education/marks/${id}`, "PATCH", body, "Failed to update mark"),
  );
}

/* ——— Finance / Expenses ——— */
export async function fetchEducationFinanceSummary(branchCode: string) {
  return parseFlexible<EducationFinanceSummary>(
    undefined,
    await getJson(`/v1/education/finance/summary?${qs(branchCode)}`, "Failed to load finance summary"),
  );
}
export async function fetchEducationFinanceTxns(branchCode: string) {
  return parseFlexibleArray(
    educationFinanceTxnSchema,
    await getJson(`/v1/education/finance-txns?${qs(branchCode)}`, "Failed to load finance transactions"),
  );
}
export async function createEducationFinanceTxn(body: unknown) {
  return parseFlexible(
    educationFinanceTxnSchema,
    await sendJson("/v1/education/finance-txns", "POST", body, "Failed to create finance transaction"),
  );
}

export async function fetchEducationExpenses(branchCode: string) {
  return parseFlexibleArray(
    educationExpenseSchema,
    await getJson(`/v1/education/expenses?${qs(branchCode)}`, "Failed to load expenses"),
  );
}
export async function createEducationExpense(body: unknown) {
  return parseFlexible(
    educationExpenseSchema,
    await sendJson("/v1/education/expenses", "POST", body, "Failed to create expense"),
  );
}
export async function updateEducationExpense(id: string, body: unknown) {
  return parseFlexible(
    educationExpenseSchema,
    await sendJson(`/v1/education/expenses/${id}`, "PATCH", body, "Failed to update expense"),
  );
}

/* ——— Payroll ——— */
export async function fetchEducationPayrollRuns(branchCode: string) {
  return parseFlexibleArray(
    educationPayrollRunSchema,
    await getJson(`/v1/education/payroll-runs?${qs(branchCode)}`, "Failed to load payroll runs"),
  );
}
export async function createEducationPayrollRun(body: unknown) {
  return parseFlexible(
    educationPayrollRunSchema,
    await sendJson("/v1/education/payroll-runs", "POST", body, "Failed to create payroll run"),
  );
}
export async function updateEducationPayrollRun(id: string, body: unknown) {
  return parseFlexible(
    educationPayrollRunSchema,
    await sendJson(`/v1/education/payroll-runs/${id}`, "PATCH", body, "Failed to update payroll run"),
  );
}

export async function fetchEducationPayslips(branchCode: string, payrollRunId?: string) {
  return parseFlexibleArray(
    educationPayslipSchema,
    await getJson(
      `/v1/education/payslips?${qs(branchCode, payrollRunId ? { payrollRunId } : undefined)}`,
      "Failed to load payslips",
    ),
  );
}
export async function createEducationPayslip(body: unknown) {
  return parseFlexible(
    educationPayslipSchema,
    await sendJson("/v1/education/payslips", "POST", body, "Failed to create payslip"),
  );
}

/* ——— Library ——— */
export async function fetchEducationBooks(branchCode: string) {
  return parseFlexibleArray(
    educationBookSchema,
    await getJson(`/v1/education/books?${qs(branchCode)}`, "Failed to load books"),
  );
}
export async function createEducationBook(body: unknown) {
  return parseFlexible(
    educationBookSchema,
    await sendJson("/v1/education/books", "POST", body, "Failed to create book"),
  );
}
export async function updateEducationBook(id: string, body: unknown) {
  return parseFlexible(
    educationBookSchema,
    await sendJson(`/v1/education/books/${id}`, "PATCH", body, "Failed to update book"),
  );
}

export async function fetchEducationBookIssues(branchCode: string) {
  return parseFlexibleArray(
    educationBookIssueSchema,
    await getJson(`/v1/education/book-issues?${qs(branchCode)}`, "Failed to load book issues"),
  );
}
export async function createEducationBookIssue(body: unknown) {
  return parseFlexible(
    educationBookIssueSchema,
    await sendJson("/v1/education/book-issues", "POST", body, "Failed to issue book"),
  );
}
export async function updateEducationBookIssue(id: string, body: unknown) {
  return parseFlexible(
    educationBookIssueSchema,
    await sendJson(`/v1/education/book-issues/${id}`, "PATCH", body, "Failed to update book issue"),
  );
}

/* ——— Transport ——— */
export async function fetchEducationVehicles(branchCode: string) {
  return parseFlexibleArray(
    educationVehicleSchema,
    await getJson(`/v1/education/vehicles?${qs(branchCode)}`, "Failed to load vehicles"),
  );
}
export async function createEducationVehicle(body: unknown) {
  return parseFlexible(
    educationVehicleSchema,
    await sendJson("/v1/education/vehicles", "POST", body, "Failed to create vehicle"),
  );
}

export async function fetchEducationRoutes(branchCode: string) {
  return parseFlexibleArray(
    educationRouteSchema,
    await getJson(`/v1/education/routes?${qs(branchCode)}`, "Failed to load routes"),
  );
}
export async function createEducationRoute(body: unknown) {
  return parseFlexible(
    educationRouteSchema,
    await sendJson("/v1/education/routes", "POST", body, "Failed to create route"),
  );
}

export async function fetchEducationRouteStops(branchCode: string, routeId?: string) {
  return parseFlexibleArray(
    educationRouteStopSchema,
    await getJson(
      `/v1/education/route-stops?${qs(branchCode, routeId ? { routeId } : undefined)}`,
      "Failed to load route stops",
    ),
  );
}
export async function createEducationRouteStop(body: unknown) {
  return parseFlexible(
    educationRouteStopSchema,
    await sendJson("/v1/education/route-stops", "POST", body, "Failed to create route stop"),
  );
}

export async function fetchEducationTransportAssignments(branchCode: string) {
  return parseFlexibleArray(
    educationTransportAssignmentSchema,
    await getJson(
      `/v1/education/transport-assignments?${qs(branchCode)}`,
      "Failed to load transport assignments",
    ),
  );
}
export async function createEducationTransportAssignment(body: unknown) {
  return parseFlexible(
    educationTransportAssignmentSchema,
    await sendJson(
      "/v1/education/transport-assignments",
      "POST",
      body,
      "Failed to assign transport",
    ),
  );
}

/* ——— Notices ——— */
export async function fetchEducationNotices(branchCode: string) {
  return parseFlexibleArray(
    educationNoticeSchema,
    await getJson(`/v1/education/notices?${qs(branchCode)}`, "Failed to load notices"),
  );
}
export async function createEducationNotice(body: unknown) {
  return parseFlexible(
    educationNoticeSchema,
    await sendJson("/v1/education/notices", "POST", body, "Failed to create notice"),
  );
}
export async function updateEducationNotice(id: string, body: unknown) {
  return parseFlexible(
    educationNoticeSchema,
    await sendJson(`/v1/education/notices/${id}`, "PATCH", body, "Failed to update notice"),
  );
}

/* ——— Documents ——— */
export async function fetchEducationDocumentTemplates(branchCode: string) {
  return parseFlexibleArray(
    educationDocumentTemplateSchema,
    await getJson(
      `/v1/education/document-templates?${qs(branchCode)}`,
      "Failed to load document templates",
    ),
  );
}
export async function createEducationDocumentTemplate(body: unknown) {
  return parseFlexible(
    educationDocumentTemplateSchema,
    await sendJson(
      "/v1/education/document-templates",
      "POST",
      body,
      "Failed to create document template",
    ),
  );
}
export async function generateEducationDocument(body: unknown) {
  return parseFlexible(
    educationGeneratedDocumentSchema,
    await sendJson("/v1/education/documents/generate", "POST", body, "Failed to generate document"),
  );
}

/* ——— Reports / Audit ——— */
export async function fetchEducationReport(reportKey: string, branchCode: string) {
  return getJson(
    `/v1/education/reports/${reportKey}?${qs(branchCode)}`,
    `Failed to load ${reportKey} report`,
  );
}

export async function fetchEducationAuditLogs(branchCode: string) {
  return parseFlexibleArray<EducationAuditLog>(
    undefined,
    await getJson(`/v1/education/audit-logs?${qs(branchCode)}`, "Failed to load audit logs"),
  );
}

export async function pingEducationApi(): Promise<{
  ok: boolean;
  latencyMs: number;
  message?: string;
}> {
  const start = Date.now();
  try {
    await getJson("/v1/education/modules", "Education API health check failed");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, message: (e as Error).message };
  }
}

/* ——— Leave ——— */
export async function fetchEducationLeaveRequests(branchCode: string) {
  return parseFlexibleArray(
    educationLeaveRequestSchema,
    await getJson(`/v1/education/leave-requests?${qs(branchCode)}`, "Failed to load leave requests"),
  );
}
export async function createEducationLeaveRequest(body: unknown) {
  return parseFlexible(
    educationLeaveRequestSchema,
    await sendJson("/v1/education/leave-requests", "POST", body, "Failed to create leave request"),
  );
}
export async function updateEducationLeaveRequest(id: string, body: unknown) {
  return parseFlexible(
    educationLeaveRequestSchema,
    await sendJson(
      `/v1/education/leave-requests/${id}`,
      "PATCH",
      body,
      "Failed to update leave request",
    ),
  );
}

/* ——— Discipline ——— */
export async function fetchEducationDisciplineIncidents(branchCode: string) {
  return parseFlexibleArray(
    educationDisciplineIncidentSchema,
    await getJson(
      `/v1/education/discipline?${qs(branchCode)}`,
      "Failed to load discipline incidents",
    ),
  );
}
export async function createEducationDisciplineIncident(body: unknown) {
  return parseFlexible(
    educationDisciplineIncidentSchema,
    await sendJson(
      "/v1/education/discipline",
      "POST",
      body,
      "Failed to create discipline incident",
    ),
  );
}
export async function updateEducationDisciplineIncident(id: string, body: unknown) {
  return parseFlexible(
    educationDisciplineIncidentSchema,
    await sendJson(
      `/v1/education/discipline/${id}`,
      "PATCH",
      body,
      "Failed to update discipline incident",
    ),
  );
}

/* ——— Student lifecycle ——— */
export async function fetchEducationStudentLifecycle(branchCode: string) {
  return parseFlexibleArray(
    educationStudentLifecycleSchema,
    await getJson(
      `/v1/education/lifecycle?${qs(branchCode)}`,
      "Failed to load student lifecycle records",
    ),
  );
}
export async function createEducationStudentLifecycle(body: unknown) {
  const action = String((body as { actionType?: string })?.actionType ?? "promote").toLowerCase();
  const path =
    action === "transfer"
      ? "/v1/education/lifecycle/transfer"
      : action === "withdraw"
        ? "/v1/education/lifecycle/withdraw"
        : action === "graduate"
          ? "/v1/education/lifecycle/graduate"
          : action === "archive"
            ? "/v1/education/lifecycle/archive"
            : "/v1/education/lifecycle/promote";
  return parseFlexible(
    educationStudentLifecycleSchema,
    await sendJson(path, "POST", body, "Failed to create lifecycle action"),
  );
}
export async function updateEducationStudentLifecycle(id: string, body: unknown) {
  // Backend has no PATCH for lifecycle rows; promote/transfer create new records.
  return parseFlexible(
    educationStudentLifecycleSchema,
    await sendJson(
      `/v1/education/lifecycle/promote`,
      "POST",
      { ...(body as object), id },
      "Failed to update lifecycle action",
    ),
  );
}

/* ——— Assignments ——— */
export async function fetchEducationAssignments(branchCode: string) {
  return parseFlexibleArray(
    educationAssignmentSchema,
    await getJson(`/v1/education/assignments?${qs(branchCode)}`, "Failed to load assignments"),
  );
}
export async function createEducationAssignment(body: unknown) {
  return parseFlexible(
    educationAssignmentSchema,
    await sendJson("/v1/education/assignments", "POST", body, "Failed to create assignment"),
  );
}
export async function updateEducationAssignment(id: string, body: unknown) {
  return parseFlexible(
    educationAssignmentSchema,
    await sendJson(`/v1/education/assignments/${id}`, "PATCH", body, "Failed to update assignment"),
  );
}

export async function fetchEducationAssignmentSubmissions(
  branchCode: string,
  assignmentId?: string,
) {
  return parseFlexibleArray(
    educationAssignmentSubmissionSchema,
    await getJson(
      `/v1/education/assignment-submissions?${qs(branchCode, assignmentId ? { assignmentId } : undefined)}`,
      "Failed to load assignment submissions",
    ),
  );
}
export async function createEducationAssignmentSubmission(body: unknown) {
  return parseFlexible(
    educationAssignmentSubmissionSchema,
    await sendJson(
      "/v1/education/assignment-submissions",
      "POST",
      body,
      "Failed to create assignment submission",
    ),
  );
}

/* ——— Scholarships ——— */
export async function fetchEducationScholarships(branchCode: string) {
  return parseFlexibleArray(
    educationScholarshipSchema,
    await getJson(`/v1/education/scholarships?${qs(branchCode)}`, "Failed to load scholarships"),
  );
}
export async function createEducationScholarship(body: unknown) {
  return parseFlexible(
    educationScholarshipSchema,
    await sendJson("/v1/education/scholarships", "POST", body, "Failed to create scholarship"),
  );
}
export async function updateEducationScholarship(id: string, body: unknown) {
  return parseFlexible(
    educationScholarshipSchema,
    await sendJson(`/v1/education/scholarships/${id}`, "PATCH", body, "Failed to update scholarship"),
  );
}

export async function fetchEducationScholarshipAwards(branchCode: string, scholarshipId?: string) {
  return parseFlexibleArray(
    educationScholarshipAwardSchema,
    await getJson(
      `/v1/education/scholarship-awards?${qs(branchCode, scholarshipId ? { scholarshipId } : undefined)}`,
      "Failed to load scholarship awards",
    ),
  );
}
export async function createEducationScholarshipAward(body: unknown) {
  return parseFlexible(
    educationScholarshipAwardSchema,
    await sendJson(
      "/v1/education/scholarship-awards",
      "POST",
      body,
      "Failed to award scholarship",
    ),
  );
}

/* ——— Fee refunds ——— */
export async function fetchEducationFeeRefunds(branchCode: string) {
  return parseFlexibleArray(
    educationFeeRefundSchema,
    await getJson(`/v1/education/fee-refunds?${qs(branchCode)}`, "Failed to load fee refunds"),
  );
}
export async function createEducationFeeRefund(body: unknown) {
  return parseFlexible(
    educationFeeRefundSchema,
    await sendJson("/v1/education/fee-refunds", "POST", body, "Failed to create fee refund"),
  );
}
export async function updateEducationFeeRefund(id: string, body: unknown) {
  const status = String((body as { status?: string })?.status ?? "").toLowerCase();
  const action =
    status === "processed" || status === "process"
      ? "process"
      : "approve";
  return parseFlexible(
    educationFeeRefundSchema,
    await sendJson(
      `/v1/education/fee-refunds/${id}/${action}`,
      "POST",
      body,
      "Failed to update fee refund",
    ),
  );
}

/* ——— Buildings / Facilities ——— */
export async function fetchEducationBuildings(branchCode: string) {
  return parseFlexibleArray<EducationRow>(
    undefined,
    await getJson(`/v1/education/buildings?${qs(branchCode)}`, "Failed to load buildings"),
  );
}
export async function createEducationBuilding(body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson("/v1/education/buildings", "POST", body, "Failed to create building"),
  );
}
export async function updateEducationBuilding(id: string, body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson(`/v1/education/buildings/${id}`, "PATCH", body, "Failed to update building"),
  );
}

export async function updateEducationRoom(id: string, body: unknown) {
  return parseFlexible(
    educationRoomSchema,
    await sendJson(`/v1/education/rooms/${id}`, "PATCH", body, "Failed to update room"),
  );
}

/* ——— Labs / Equipment ——— */
export async function fetchEducationLabs(branchCode: string) {
  return parseFlexibleArray<EducationRow>(
    undefined,
    await getJson(`/v1/education/labs?${qs(branchCode)}`, "Failed to load labs"),
  );
}
export async function createEducationLab(body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson("/v1/education/labs", "POST", body, "Failed to create lab"),
  );
}
export async function updateEducationLab(id: string, body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson(`/v1/education/labs/${id}`, "PATCH", body, "Failed to update lab"),
  );
}

export async function fetchEducationEquipment(branchCode: string, labId?: string) {
  return parseFlexibleArray<EducationRow>(
    undefined,
    await getJson(
      `/v1/education/equipment?${qs(branchCode, labId ? { labId } : undefined)}`,
      "Failed to load equipment",
    ),
  );
}
export async function createEducationEquipment(body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson("/v1/education/equipment", "POST", body, "Failed to create equipment"),
  );
}
export async function updateEducationEquipment(id: string, body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson(`/v1/education/equipment/${id}`, "PATCH", body, "Failed to update equipment"),
  );
}

/* ——— Inventory ——— */
export async function fetchEducationInventoryItems(branchCode: string) {
  return parseFlexibleArray<EducationRow>(
    undefined,
    await getJson(`/v1/education/inventory-items?${qs(branchCode)}`, "Failed to load inventory"),
  );
}
export async function createEducationInventoryItem(body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson("/v1/education/inventory-items", "POST", body, "Failed to create inventory item"),
  );
}
export async function updateEducationInventoryItem(id: string, body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson(
      `/v1/education/inventory-items/${id}`,
      "PATCH",
      body,
      "Failed to update inventory item",
    ),
  );
}

/* ——— Front desk / Enquiries ——— */
export async function fetchEducationEnquiries(branchCode: string) {
  return parseFlexibleArray(
    educationEnquirySchema,
    await getJson(`/v1/education/enquiries?${qs(branchCode)}`, "Failed to load enquiries"),
  );
}
export async function createEducationEnquiry(body: unknown) {
  return parseFlexible(
    educationEnquirySchema,
    await sendJson("/v1/education/enquiries", "POST", body, "Failed to create enquiry"),
  );
}
export async function updateEducationEnquiry(id: string, body: unknown) {
  return parseFlexible(
    educationEnquirySchema,
    await sendJson(`/v1/education/enquiries/${id}`, "PATCH", body, "Failed to update enquiry"),
  );
}

/* ——— Events ——— */
export async function fetchEducationEvents(branchCode: string) {
  return parseFlexibleArray(
    educationEventSchema,
    await getJson(`/v1/education/events?${qs(branchCode)}`, "Failed to load events"),
  );
}
export async function createEducationEvent(body: unknown) {
  return parseFlexible(
    educationEventSchema,
    await sendJson("/v1/education/events", "POST", body, "Failed to create event"),
  );
}
export async function updateEducationEvent(id: string, body: unknown) {
  return parseFlexible(
    educationEventSchema,
    await sendJson(`/v1/education/events/${id}`, "PATCH", body, "Failed to update event"),
  );
}

/* ——— Alumni ——— */
export async function fetchEducationAlumni(branchCode: string) {
  return parseFlexibleArray(
    educationAlumniSchema,
    await getJson(`/v1/education/alumni?${qs(branchCode)}`, "Failed to load alumni"),
  );
}
export async function createEducationAlumni(body: unknown) {
  return parseFlexible(
    educationAlumniSchema,
    await sendJson("/v1/education/alumni", "POST", body, "Failed to create alumni record"),
  );
}
export async function updateEducationAlumni(id: string, body: unknown) {
  return parseFlexible(
    educationAlumniSchema,
    await sendJson(`/v1/education/alumni/${id}`, "PATCH", body, "Failed to update alumni record"),
  );
}

/* ——— Health ——— */
export async function fetchEducationHealthRecords(branchCode: string) {
  return parseFlexibleArray(
    educationHealthRecordSchema,
    await getJson(`/v1/education/health-records?${qs(branchCode)}`, "Failed to load health records"),
  );
}
export async function createEducationHealthRecord(body: unknown) {
  return parseFlexible(
    educationHealthRecordSchema,
    await sendJson("/v1/education/health-records", "POST", body, "Failed to create health record"),
  );
}
export async function updateEducationHealthRecord(id: string, body: unknown) {
  return parseFlexible(
    educationHealthRecordSchema,
    await sendJson(
      `/v1/education/health-records/${id}`,
      "PATCH",
      body,
      "Failed to update health record",
    ),
  );
}

export async function fetchEducationHealthVisits(branchCode: string, healthRecordId?: string) {
  return parseFlexibleArray(
    educationHealthVisitSchema,
    await getJson(
      `/v1/education/health-visits?${qs(branchCode, healthRecordId ? { healthRecordId } : undefined)}`,
      "Failed to load health visits",
    ),
  );
}
export async function createEducationHealthVisit(body: unknown) {
  return parseFlexible(
    educationHealthVisitSchema,
    await sendJson("/v1/education/health-visits", "POST", body, "Failed to create health visit"),
  );
}

/* ——— Hostel ——— */
export async function fetchEducationHostels(branchCode: string) {
  return parseFlexibleArray(
    educationHostelSchema,
    await getJson(`/v1/education/hostels?${qs(branchCode)}`, "Failed to load hostels"),
  );
}
export async function createEducationHostel(body: unknown) {
  return parseFlexible(
    educationHostelSchema,
    await sendJson("/v1/education/hostels", "POST", body, "Failed to create hostel"),
  );
}
export async function updateEducationHostel(id: string, body: unknown) {
  return parseFlexible(
    educationHostelSchema,
    await sendJson(`/v1/education/hostels/${id}`, "PATCH", body, "Failed to update hostel"),
  );
}

export async function fetchEducationHostelRooms(branchCode: string, hostelId?: string) {
  return parseFlexibleArray(
    educationHostelRoomSchema,
    await getJson(
      `/v1/education/hostel-rooms?${qs(branchCode, hostelId ? { hostelId } : undefined)}`,
      "Failed to load hostel rooms",
    ),
  );
}
export async function createEducationHostelRoom(body: unknown) {
  return parseFlexible(
    educationHostelRoomSchema,
    await sendJson("/v1/education/hostel-rooms", "POST", body, "Failed to create hostel room"),
  );
}

export async function fetchEducationHostelBeds(branchCode: string, hostelRoomId?: string) {
  return parseFlexibleArray(
    educationHostelBedSchema,
    await getJson(
      `/v1/education/hostel-beds?${qs(branchCode, hostelRoomId ? { hostelRoomId } : undefined)}`,
      "Failed to load hostel beds",
    ),
  );
}
export async function createEducationHostelBed(body: unknown) {
  return parseFlexible(
    educationHostelBedSchema,
    await sendJson("/v1/education/hostel-beds", "POST", body, "Failed to create hostel bed"),
  );
}

export async function fetchEducationHostelAllocations(branchCode: string) {
  return parseFlexibleArray(
    educationHostelAllocationSchema,
    await getJson(
      `/v1/education/hostel-allocations?${qs(branchCode)}`,
      "Failed to load hostel allocations",
    ),
  );
}
export async function createEducationHostelAllocation(body: unknown) {
  return parseFlexible(
    educationHostelAllocationSchema,
    await sendJson(
      "/v1/education/hostel-allocations",
      "POST",
      body,
      "Failed to create hostel allocation",
    ),
  );
}

/* ——— Custom fields ——— */
export async function fetchEducationCustomFieldDefs() {
  return parseFlexibleArray(
    educationCustomFieldDefSchema,
    await getJson("/v1/education/custom-fields", "Failed to load custom field definitions"),
  );
}
export async function createEducationCustomFieldDef(body: unknown) {
  return parseFlexible(
    educationCustomFieldDefSchema,
    await sendJson(
      "/v1/education/custom-fields",
      "POST",
      body,
      "Failed to create custom field definition",
    ),
  );
}
export async function updateEducationCustomFieldDef(id: string, body: unknown) {
  return parseFlexible(
    educationCustomFieldDefSchema,
    await sendJson(
      `/v1/education/custom-fields/${id}`,
      "PATCH",
      body,
      "Failed to update custom field definition",
    ),
  );
}

export async function fetchEducationCustomFieldValues(
  entityType?: string,
  entityId?: string,
) {
  const params = new URLSearchParams();
  if (entityType) params.set("entityType", entityType);
  if (entityId) params.set("entityId", entityId);
  const q = params.toString();
  return parseFlexibleArray(
    educationCustomFieldValueSchema,
    await getJson(
      `/v1/education/custom-field-values${q ? `?${q}` : ""}`,
      "Failed to load custom field values",
    ),
  );
}
export async function createEducationCustomFieldValue(body: unknown) {
  return parseFlexible(
    educationCustomFieldValueSchema,
    await sendJson(
      "/v1/education/custom-field-values",
      "POST",
      body,
      "Failed to save custom field value",
    ),
  );
}

/* ——— Workflows ——— */
export async function fetchEducationWorkflowDefs() {
  return parseFlexibleArray<EducationRow>(
    undefined,
    await getJson("/v1/education/workflows", "Failed to load workflow definitions"),
  );
}
export async function createEducationWorkflowDef(body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson("/v1/education/workflows", "POST", body, "Failed to create workflow"),
  );
}
export async function updateEducationWorkflowDef(id: string, body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson(`/v1/education/workflows/${id}`, "PATCH", body, "Failed to update workflow"),
  );
}

/* ——— Notification rules ——— */
export async function fetchEducationNotificationRules() {
  return parseFlexibleArray<EducationRow>(
    undefined,
    await getJson("/v1/education/notification-rules", "Failed to load notification rules"),
  );
}
export async function createEducationNotificationRule(body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson(
      "/v1/education/notification-rules",
      "POST",
      body,
      "Failed to create notification rule",
    ),
  );
}
export async function updateEducationNotificationRule(id: string, body: unknown) {
  return parseFlexible<EducationRow>(
    undefined,
    await sendJson(
      `/v1/education/notification-rules/${id}`,
      "PATCH",
      body,
      "Failed to update notification rule",
    ),
  );
}
