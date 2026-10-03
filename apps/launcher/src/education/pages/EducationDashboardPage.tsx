import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass } from "../../pops/lib/themeClasses";
import { fetchEducationDashboard } from "../api/education";
import { formatPkr, useEducationAccess } from "../hooks/useEducation";
import { EducationStatCard } from "../ui/EducationUi";

const EXTRA_KPI_DEFS: { key: string; label: string; money?: boolean }[] = [
  { key: "totalStaff", label: "Staff" },
  { key: "totalGuardians", label: "Guardians" },
  { key: "totalBatches", label: "Batches" },
  { key: "attendanceTodayPct", label: "Attendance today %" },
  { key: "openExpensesPkr", label: "Open expenses", money: true },
  { key: "libraryIssued", label: "Books issued" },
  { key: "transportAssignments", label: "Transport riders" },
  { key: "noticesPublished", label: "Published notices" },
];

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

export function EducationDashboardPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const dashboardQuery = useQuery({
    queryKey: ["education", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 30_000,
    queryFn: () => fetchEducationDashboard(branch!.code),
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading EducationFlow dashboard…
      </div>
    );
  }
  if (dashboardQuery.isError) {
    return <div className={noticeErrorClass}>{(dashboardQuery.error as Error).message}</div>;
  }

  const m = dashboardQuery.data!;
  const extraCards = EXTRA_KPI_DEFS.flatMap((def) => {
    const raw = (m as Record<string, unknown>)[def.key];
    const n = asNumber(raw);
    if (n == null) return [];
    return [
      {
        key: def.key,
        label: def.label,
        value: def.money ? formatPkr(n) : n,
      },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="EducationFlow dashboard"
        subtitle={`Campus overview for ${branch?.name ?? "branch"} — students, fees, admissions, and academics.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pops/education/students"
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              Enroll student
            </Link>
            <Link
              to="/pops/education/admissions"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Admissions
            </Link>
            <Link
              to="/pops/education/fees"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Fees
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EducationStatCard label="Total students" value={m.totalStudents} />
        <EducationStatCard label="Active students" value={m.activeStudents} tone="success" />
        <EducationStatCard label="Teachers" value={m.totalTeachers} />
        <EducationStatCard
          label="Pending admissions"
          value={m.pendingAdmissions}
          tone={m.pendingAdmissions > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EducationStatCard
          label="Pending fees"
          value={formatPkr(m.pendingFeesPkr)}
          tone={m.pendingFeesPkr > 0 ? "warning" : "default"}
        />
        <EducationStatCard label="Collected today" value={formatPkr(m.collectedTodayPkr)} tone="success" />
        <EducationStatCard label="Classes" value={m.classesCount} />
        <EducationStatCard
          label="Upcoming exams"
          value={m.upcomingExams}
          tone={m.upcomingExams > 0 ? "warning" : "default"}
        />
      </div>

      {extraCards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {extraCards.map((c) => (
            <EducationStatCard key={c.key} label={c.label} value={c.value} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
