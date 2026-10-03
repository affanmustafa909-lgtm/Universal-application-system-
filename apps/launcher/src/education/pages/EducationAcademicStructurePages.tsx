import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationBatch,
  createEducationBatchStudent,
  createEducationCourse,
  createEducationDepartment,
  createEducationProgram,
  fetchEducationBatches,
  fetchEducationBatchStudents,
  fetchEducationCourses,
  fetchEducationDepartments,
  fetchEducationPrograms,
  fetchEducationStudents,
} from "../api/education";
import { formatPkr, useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSelect,
} from "../ui/EducationUi";

export function EducationDepartmentsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const query = useQuery({
    queryKey: ["education", "departments", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationDepartments(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationDepartment({
        branchCode: branch!.code,
        name: name.trim(),
        code: code.trim(),
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setName("");
      setCode("");
      setNotice("Department created");
    },
  });

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  const disabled =
    !branch?.code || !name.trim() || !code.trim() || query.isError || createMutation.isPending;

  return (
    <div className="space-y-5">
      <PageHeader title="Departments" subtitle="Academic and administrative departments." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {query.isError ? <div className={noticeErrorClass}>{(query.error as Error).message}</div> : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New department">
        <EducationField label="Name" required>
          <EducationInput value={name} onChange={(e) => setName(e.target.value)} />
        </EducationField>
        <EducationField label="Code" required>
          <EducationInput value={code} onChange={(e) => setCode(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={disabled}
            title={
              query.isError
                ? "Departments API unavailable"
                : !branch?.code
                  ? "Select a branch first"
                  : undefined
            }
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Create department
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <EducationDataTable
        columns={["Code", "Name", "Status"]}
        rows={filtered.map((d) => [d.code, d.name, d.status])}
      />
    </div>
  );
}

export function EducationProgramsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const query = useQuery({
    queryKey: ["education", "programs", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationPrograms(branch!.code),
  });
  const departmentsQuery = useQuery({
    queryKey: ["education", "departments", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationDepartments(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationProgram({
        branchCode: branch!.code,
        name: name.trim(),
        code: code.trim(),
        departmentId: departmentId || undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setName("");
      setCode("");
      setNotice("Program created");
    },
  });

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Programs"
        subtitle="Degree and diploma programs for colleges and academies."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {query.isError ? <div className={noticeErrorClass}>{(query.error as Error).message}</div> : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New program">
        <EducationField label="Name" required>
          <EducationInput value={name} onChange={(e) => setName(e.target.value)} />
        </EducationField>
        <EducationField label="Code" required>
          <EducationInput value={code} onChange={(e) => setCode(e.target.value)} />
        </EducationField>
        <EducationField label="Department">
          <EducationSelect value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">—</option>
            {(departmentsQuery.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code || !name.trim() || !code.trim() || query.isError || createMutation.isPending
            }
            title={query.isError ? "Programs API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Create program
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <EducationDataTable
        columns={["Code", "Name", "Department", "Status"]}
        rows={filtered.map((p) => [p.code, p.name, p.departmentId ?? "—", p.status])}
      />
    </div>
  );
}

export function EducationCoursesPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [programId, setProgramId] = useState("");
  const [durationText, setDurationText] = useState("");
  const [feePkr, setFeePkr] = useState("");

  const query = useQuery({
    queryKey: ["education", "courses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationCourses(branch!.code),
  });
  const programsQuery = useQuery({
    queryKey: ["education", "programs", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationPrograms(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationCourse({
        branchCode: branch!.code,
        name: name.trim(),
        code: code.trim(),
        programId: programId || undefined,
        durationText: durationText.trim() || undefined,
        feePkr: feePkr ? Number(feePkr) : undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setName("");
      setCode("");
      setDurationText("");
      setFeePkr("");
      setNotice("Course created");
    },
  });

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Courses" subtitle="Course catalog linked to programs and subjects." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {query.isError ? <div className={noticeErrorClass}>{(query.error as Error).message}</div> : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New course">
        <EducationField label="Name" required>
          <EducationInput value={name} onChange={(e) => setName(e.target.value)} />
        </EducationField>
        <EducationField label="Code" required>
          <EducationInput value={code} onChange={(e) => setCode(e.target.value)} />
        </EducationField>
        <EducationField label="Program">
          <EducationSelect value={programId} onChange={(e) => setProgramId(e.target.value)}>
            <option value="">—</option>
            {(programsQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Duration">
          <EducationInput value={durationText} onChange={(e) => setDurationText(e.target.value)} />
        </EducationField>
        <EducationField label="Fee (PKR)">
          <EducationInput type="number" value={feePkr} onChange={(e) => setFeePkr(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code || !name.trim() || !code.trim() || query.isError || createMutation.isPending
            }
            title={query.isError ? "Courses API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Create course
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <EducationDataTable
        columns={["Code", "Name", "Duration", "Fee", "Status"]}
        rows={filtered.map((c) => [
          c.code,
          c.name,
          c.durationText ?? "—",
          formatPkr(c.feePkr),
          c.status,
        ])}
      />
    </div>
  );
}

export function EducationBatchesPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [courseId, setCourseId] = useState("");
  const [timingText, setTimingText] = useState("");
  const [daysText, setDaysText] = useState("");
  const [enrollBatchId, setEnrollBatchId] = useState("");
  const [enrollStudentId, setEnrollStudentId] = useState("");

  const query = useQuery({
    queryKey: ["education", "batches", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationBatches(branch!.code),
  });
  const coursesQuery = useQuery({
    queryKey: ["education", "courses", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationCourses(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });
  const enrollmentsQuery = useQuery({
    queryKey: ["education", "batch-students", branch?.code, enrollBatchId],
    enabled: Boolean(branch?.code) && Boolean(enrollBatchId),
    queryFn: () => fetchEducationBatchStudents(branch!.code, enrollBatchId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationBatch({
        branchCode: branch!.code,
        name: name.trim(),
        code: code.trim(),
        courseId: courseId || undefined,
        timingText: timingText.trim() || undefined,
        daysText: daysText.trim() || undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setName("");
      setCode("");
      setTimingText("");
      setDaysText("");
      setNotice("Batch created");
    },
  });

  const enrollMutation = useMutation({
    mutationFn: () =>
      createEducationBatchStudent({
        branchCode: branch!.code,
        batchId: enrollBatchId,
        studentId: enrollStudentId,
        status: "active",
        enrolledAt: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => {
      invalidate(["batch-students"]);
      setEnrollStudentId("");
      setNotice("Student enrolled in batch");
    },
  });

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Batches" subtitle="Batch / cohort grouping within sessions. Enroll students below." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {query.isError ? <div className={noticeErrorClass}>{(query.error as Error).message}</div> : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}
      {enrollMutation.isError ? (
        <div className={noticeErrorClass}>{(enrollMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New batch">
        <EducationField label="Name" required>
          <EducationInput value={name} onChange={(e) => setName(e.target.value)} />
        </EducationField>
        <EducationField label="Code" required>
          <EducationInput value={code} onChange={(e) => setCode(e.target.value)} />
        </EducationField>
        <EducationField label="Course">
          <EducationSelect value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">—</option>
            {(coursesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Timing">
          <EducationInput value={timingText} onChange={(e) => setTimingText(e.target.value)} />
        </EducationField>
        <EducationField label="Days">
          <EducationInput value={daysText} onChange={(e) => setDaysText(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code || !name.trim() || !code.trim() || query.isError || createMutation.isPending
            }
            title={query.isError ? "Batches API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Create batch
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Enroll student in batch">
        <EducationField label="Batch" required>
          <EducationSelect value={enrollBatchId} onChange={(e) => setEnrollBatchId(e.target.value)}>
            <option value="">—</option>
            {(query.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Student" required>
          <EducationSelect
            value={enrollStudentId}
            onChange={(e) => setEnrollStudentId(e.target.value)}
          >
            <option value="">—</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName ?? ""}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!enrollBatchId || !enrollStudentId || enrollMutation.isPending}
            onClick={() => {
              setNotice(null);
              enrollMutation.mutate();
            }}
          >
            Enroll student
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      {enrollBatchId ? (
        <EducationDataTable
          columns={["Enrollment ID", "Student", "Status", "Enrolled"]}
          rows={(enrollmentsQuery.data ?? []).map((e) => [
            e.id.slice(0, 8),
            e.studentId.slice(0, 8),
            e.status,
            e.enrolledAt ?? "—",
          ])}
        />
      ) : null}

      <EducationInput
        className="max-w-xs"
        placeholder="Search batches…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <EducationDataTable
        columns={["Code", "Name", "Timing", "Days", "Status"]}
        rows={filtered.map((b) => [
          b.code,
          b.name,
          b.timingText ?? "—",
          b.daysText ?? "—",
          b.status,
        ])}
      />
    </div>
  );
}
