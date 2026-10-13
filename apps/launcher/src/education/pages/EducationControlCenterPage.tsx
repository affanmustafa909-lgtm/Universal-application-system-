import { useMutation, useQuery } from "@tanstack/react-query";
import { EDUCATION_MODULES, type EducationModuleKey } from "@platform/contracts";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  bootstrapEducationDefaults,
  fetchEducationModules,
  fetchEducationSettings,
  seedEducationDocumentTemplates,
  upsertEducationModule,
  upsertEducationSetting,
} from "../api/education";
import { useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EDUCATION_INSTITUTION_PROFILES,
  educationModulesForInstitutionType,
  parseEducationInstitutionType,
  type EducationInstitutionType,
} from "../spec/nav";
import { useState } from "react";
import { EducationPrimaryButton, EducationSelect } from "../ui/EducationUi";
import { Link } from "react-router-dom";

const MODULE_LABELS: Record<EducationModuleKey, string> = {
  dashboard: "Dashboard",
  admissions: "Admissions",
  students: "Students",
  parents: "Parents",
  teachers: "Teachers",
  staff: "Staff",
  academics: "Academics",
  classes: "Classes",
  sections: "Sections",
  departments: "Departments",
  programs: "Programs",
  courses: "Courses",
  batches: "Batches",
  timetable: "Timetable",
  attendance: "Attendance",
  examinations: "Examinations",
  results: "Results",
  fees: "Fees",
  finance: "Finance",
  expenses: "Expenses",
  payroll: "Payroll",
  library: "Library",
  transport: "Transport",
  communication: "Communication",
  documents: "Documents",
  reports: "Reports",
  users: "Users",
  roles: "Roles",
  settings: "Settings",
  control_center: "Control Center",
  leave: "Leave",
  discipline: "Discipline",
  lifecycle: "Student lifecycle",
  assignments: "Assignments",
  scholarships: "Scholarships",
  refunds: "Refunds",
  facilities: "Facilities",
  labs: "Labs",
  equipment: "Equipment",
  inventory: "Inventory",
  front_desk: "Front desk",
  events: "Events",
  alumni: "Alumni",
  health: "Health",
  hostel: "Hostel",
  custom_fields: "Custom fields",
  workflows: "Workflows",
  notification_rules: "Notification rules",
  student_portal: "Student portal",
  parent_portal: "Parent portal",
};

export function EducationControlCenterPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [institutionType, setInstitutionType] = useState<EducationInstitutionType | "">("");

  const modulesQuery = useQuery({
    queryKey: ["education", "modules"],
    queryFn: fetchEducationModules,
  });

  const settingsQuery = useQuery({
    queryKey: ["education", "settings", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSettings(branch!.code),
  });

  const savedType = parseEducationInstitutionType(
    settingsQuery.data?.find((s) => s.key === "institution_type")?.valueJson?.replace(/^"|"$/g, ""),
  );

  const toggleMutation = useMutation({
    mutationFn: (payload: { moduleKey: EducationModuleKey; enabled: boolean }) =>
      upsertEducationModule(payload),
    onSuccess: () => {
      invalidate();
      setNotice("Module updated");
    },
  });

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      const result = await bootstrapEducationDefaults(branch?.code);
      if (branch?.code) await seedEducationDocumentTemplates(branch.code);
      return result;
    },
    onSuccess: () => {
      invalidate();
      setNotice("Defaults initialized — lookups, modules, and document/certificate templates seeded.");
    },
  });

  const applyProfileMutation = useMutation({
    mutationFn: async (type: EducationInstitutionType) => {
      const enabledKeys = new Set(educationModulesForInstitutionType(type) ?? []);
      await upsertEducationSetting({
        branchCode: branch?.code,
        key: "institution_type",
        valueJson: JSON.stringify(type),
      });
      for (const key of EDUCATION_MODULES) {
        const shouldEnable =
          key === "dashboard" ||
          key === "control_center" ||
          key === "settings" ||
          key === "documents" ||
          key === "reports" ||
          enabledKeys.has(key);
        await upsertEducationModule({ moduleKey: key, enabled: shouldEnable });
      }
      if (branch?.code) await seedEducationDocumentTemplates(branch.code);
      return type;
    },
    onSuccess: (type) => {
      invalidate();
      setInstitutionType(type);
      setNotice(
        `Applied ${type} profile — modules tuned for ${type}, certificate/receipt templates ready.`,
      );
    },
  });

  const byKey = new Map((modulesQuery.data ?? []).map((m) => [m.moduleKey, m]));
  const activeType = institutionType || savedType || "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="System Control Center"
        subtitle="Configure EducationFlow for your school, academy, or college. Everything is admin-managed — no hard-coded classes, fees, or statuses."
        actions={
          <div className="flex flex-wrap gap-2">
            <EducationPrimaryButton
              type="button"
              disabled={!branch?.code || bootstrapMutation.isPending}
              onClick={() => {
                setNotice(null);
                bootstrapMutation.mutate();
              }}
            >
              {bootstrapMutation.isPending ? "Initializing…" : "Initialize defaults"}
            </EducationPrimaryButton>
            <Link
              to="/pops/education/lookups"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Manage lookups
            </Link>
            <Link
              to="/pops/education/documents"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Certificates & documents
            </Link>
          </div>
        }
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {bootstrapMutation.isError ? (
        <div className={noticeErrorClass}>{(bootstrapMutation.error as Error).message}</div>
      ) : null}
      {applyProfileMutation.isError ? (
        <div className={noticeErrorClass}>{(applyProfileMutation.error as Error).message}</div>
      ) : null}
      {modulesQuery.isError ? (
        <div className={noticeErrorClass}>{(modulesQuery.error as Error).message}</div>
      ) : null}

      <div className="rounded-xl border border-teal-200/80 bg-teal-50/60 px-4 py-3 text-sm text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-100">
        Start here: pick School / Academy / College, initialize defaults (also seeds fee receipts & certificates),
        then enroll students and set fee structures. Print receipts, marksheets, and certificates from each module.
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Institution type</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Applies a recommended module pack (school grades, academy batches, or college programs) and seeds
          printable document templates. You can still toggle modules below.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Profile
            </label>
            <EducationSelect
              value={activeType}
              onChange={(e) => setInstitutionType(e.target.value as EducationInstitutionType | "")}
            >
              <option value="">— Select —</option>
              {(Object.keys(EDUCATION_INSTITUTION_PROFILES) as EducationInstitutionType[]).map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </EducationSelect>
          </div>
          <EducationPrimaryButton
            type="button"
            disabled={!activeType || applyProfileMutation.isPending}
            onClick={() => {
              if (!activeType) return;
              setNotice(null);
              applyProfileMutation.mutate(activeType);
            }}
          >
            {applyProfileMutation.isPending ? "Applying…" : "Apply profile"}
          </EducationPrimaryButton>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {EDUCATION_MODULES.map((key) => {
          const row = byKey.get(key);
          const enabled = row?.enabled ?? true;
          return (
            <label
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">{MODULE_LABELS[key]}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{key}</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={enabled}
                disabled={toggleMutation.isPending || key === "control_center" || key === "dashboard"}
                onChange={(e) => {
                  setNotice(null);
                  toggleMutation.mutate({ moduleKey: key, enabled: e.target.checked });
                }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
