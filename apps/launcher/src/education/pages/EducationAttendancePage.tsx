import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  bulkMarkEducationAttendance,
  fetchEducationAttendance,
  fetchEducationClasses,
  fetchEducationLookups,
  fetchEducationSections,
  fetchEducationStudents,
} from "../api/education";
import { educationMutedClass, useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import { printEducationAttendanceRegister } from "../lib/printAttendanceRegister";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSelect,
  EducationSecondaryButton,
  EducationStatCard,
} from "../ui/EducationUi";

export function EducationAttendancePage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [defaultStatus, setDefaultStatus] = useState("present");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [printError, setPrintError] = useState<string | null>(null);

  const branding = useMemo(
    () => ({
      institutionName: "EducationFlow",
      branchName: branch?.name ?? branch?.code ?? "",
    }),
    [branch?.name, branch?.code],
  );

  const attendanceQuery = useQuery({
    queryKey: ["education", "attendance", branch?.code, date, classId, sectionId],
    enabled: Boolean(branch?.code) && Boolean(date),
    queryFn: () =>
      fetchEducationAttendance(branch!.code, {
        date,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
      }),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });
  const classesQuery = useQuery({
    queryKey: ["education", "classes", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationClasses(branch!.code),
  });
  const sectionsQuery = useQuery({
    queryKey: ["education", "sections", branch?.code, classId],
    enabled: Boolean(branch?.code) && Boolean(classId),
    queryFn: () => fetchEducationSections(branch!.code, classId),
  });
  const statusLookupsQuery = useQuery({
    queryKey: ["education", "lookups", branch?.code, "attendance_status"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLookups(branch!.code, "attendance_status"),
  });

  const classStudents = useMemo(() => {
    const all = studentsQuery.data ?? [];
    return all.filter((s) => {
      if (classId && s.classId !== classId) return false;
      if (sectionId && s.sectionId !== sectionId) return false;
      return Boolean(classId);
    });
  }, [studentsQuery.data, classId, sectionId]);

  const studentById = useMemo(() => {
    const map = new Map<string, (typeof classStudents)[number]>();
    for (const s of studentsQuery.data ?? []) map.set(s.id, s);
    return map;
  }, [studentsQuery.data]);

  const statusOptions =
    statusLookupsQuery.data && statusLookupsQuery.data.length > 0
      ? statusLookupsQuery.data.map((l) => ({ value: l.code, label: l.label }))
      : [
          { value: "present", label: "Present" },
          { value: "absent", label: "Absent" },
          { value: "late", label: "Late" },
          { value: "leave", label: "Leave" },
        ];

  // Prefill marks from saved attendance for the selected date/class.
  useEffect(() => {
    const saved = attendanceQuery.data ?? [];
    if (!classId || classStudents.length === 0) return;
    const next: Record<string, string> = {};
    for (const s of classStudents) {
      const row = saved.find((a) => a.personType === "student" && a.personId === s.id);
      next[s.id] = row?.statusCode || defaultStatus;
    }
    setMarks(next);
  }, [attendanceQuery.data, classStudents, classId, defaultStatus]);

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, leave: 0, other: 0 };
    for (const s of classStudents) {
      const code = (marks[s.id] || defaultStatus).toLowerCase();
      if (code in counts) counts[code as keyof typeof counts] += 1;
      else counts.other += 1;
    }
    return counts;
  }, [classStudents, marks, defaultStatus]);

  const bulkMutation = useMutation({
    mutationFn: () => {
      const records = classStudents.map((s) => ({
        date,
        personType: "student" as const,
        personId: s.id,
        statusCode: marks[s.id] || defaultStatus,
        classId: classId || s.classId || undefined,
        sectionId: sectionId || s.sectionId || undefined,
      }));
      return bulkMarkEducationAttendance({
        branchCode: branch!.code,
        date,
        records,
      });
    },
    onSuccess: () => {
      invalidate(["attendance"]);
      setNotice(`Attendance saved for ${classStudents.length} students`);
    },
  });

  const applyDefault = () => {
    const next: Record<string, string> = {};
    for (const s of classStudents) next[s.id] = defaultStatus;
    setMarks(next);
  };

  const printRegister = async () => {
    setPrintError(null);
    if (!classId || !date) {
      setPrintError("Select date and class to print register");
      return;
    }
    const className = (classesQuery.data ?? []).find((c) => c.id === classId)?.name;
    const sectionName = (sectionsQuery.data ?? []).find((s) => s.id === sectionId)?.name;
    const rows =
      classStudents.length > 0
        ? classStudents.map((s) => ({
            personLabel: `${s.firstName} ${s.lastName ?? ""}`.trim(),
            statusCode: marks[s.id] || defaultStatus,
          }))
        : (attendanceQuery.data ?? []).map((a) => {
            const student = studentById.get(a.personId);
            return {
              personLabel: student
                ? `${student.firstName} ${student.lastName ?? ""}`.trim()
                : a.personId.slice(0, 8),
              statusCode: a.statusCode,
              notes: a.notes ?? undefined,
            };
          });
    const result = await printEducationAttendanceRegister({
      date,
      className,
      sectionName,
      rows,
      branding,
    });
    if (!result.ok) setPrintError(result.error ?? "Print failed");
  };

  const disabledReason = !branch?.code
    ? "Select a branch first"
    : !date
      ? "Select a date"
      : !classId
        ? "Select a class to mark attendance"
        : classStudents.length === 0
          ? "No students in this class/section"
          : attendanceQuery.isError
            ? "Attendance API unavailable"
            : bulkMutation.isPending
              ? "Saving…"
              : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        subtitle="Mark student attendance by class and date. Re-saving updates existing marks."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {printError ? <div className={noticeErrorClass}>{printError}</div> : null}
      {attendanceQuery.isError ? (
        <div className={noticeErrorClass}>{(attendanceQuery.error as Error).message}</div>
      ) : null}
      {bulkMutation.isError ? (
        <div className={noticeErrorClass}>{(bulkMutation.error as Error).message}</div>
      ) : null}

      {classId ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <EducationStatCard label="Present" value={summary.present} tone="success" />
          <EducationStatCard label="Absent" value={summary.absent} tone="danger" />
          <EducationStatCard label="Late" value={summary.late} tone="warning" />
          <EducationStatCard label="On leave" value={summary.leave} />
        </div>
      ) : null}

      <EducationFormSection
        title="Filters & bulk mark"
        description="Choose class (required), optional section, then set status per student."
      >
        <EducationField label="Date" required>
          <EducationInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </EducationField>
        <EducationField label="Class" required>
          <EducationSelect
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
              setMarks({});
            }}
          >
            <option value="">Select class</option>
            {(classesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Section">
          <EducationSelect
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!classId}
          >
            <option value="">All sections</option>
            {(sectionsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Default status">
          <EducationSelect value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value)}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <div className="col-span-full flex flex-wrap items-center gap-2">
          <EducationSecondaryButton type="button" onClick={applyDefault} disabled={!classId}>
            Apply default to all
          </EducationSecondaryButton>
          <EducationSecondaryButton
            type="button"
            disabled={!classId || !date}
            onClick={() => void printRegister()}
          >
            Print register
          </EducationSecondaryButton>
          <EducationPrimaryButton
            disabled={Boolean(disabledReason)}
            title={disabledReason ?? undefined}
            onClick={() => {
              setNotice(null);
              bulkMutation.mutate();
            }}
          >
            Save attendance
          </EducationPrimaryButton>
          {disabledReason ? <span className={educationMutedClass}>{disabledReason}</span> : null}
        </div>
      </EducationFormSection>

      <EducationDataTable
        columns={["Student", "Admission #", "Status"]}
        rows={classStudents.map((s) => [
          `${s.firstName} ${s.lastName ?? ""}`.trim(),
          s.admissionNumber ?? s.studentNumber ?? "—",
          <EducationSelect
            key={s.id}
            value={marks[s.id] ?? defaultStatus}
            onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value }))}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </EducationSelect>,
        ])}
      />

      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Saved records for {date}</h3>
      <EducationDataTable
        columns={["Student", "Type", "Status", "Class", "Notes"]}
        rows={(attendanceQuery.data ?? []).map((a) => {
          const student = studentById.get(a.personId);
          const name = student
            ? `${student.firstName} ${student.lastName ?? ""}`.trim()
            : a.personId.slice(0, 8);
          const cls =
            (classesQuery.data ?? []).find((c) => c.id === a.classId)?.name ??
            a.classId?.slice(0, 8) ??
            "—";
          return [name, a.personType, a.statusCode, cls, a.notes ?? "—"];
        })}
      />
    </div>
  );
}
