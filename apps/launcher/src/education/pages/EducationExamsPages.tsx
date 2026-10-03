import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationExam,
  createEducationExamSubject,
  createEducationMark,
  fetchEducationClasses,
  fetchEducationExamSubjects,
  fetchEducationExams,
  fetchEducationLookups,
  fetchEducationMarks,
  fetchEducationSessions,
  fetchEducationStudents,
  fetchEducationSubjects,
} from "../api/education";
import { useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSelect,
} from "../ui/EducationUi";

export function EducationExaminationsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [examTypeCode, setExamTypeCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [totalMarks, setTotalMarks] = useState("100");
  const [passingMarks, setPassingMarks] = useState("40");

  const [markExamId, setMarkExamId] = useState("");
  const [markExamSubjectId, setMarkExamSubjectId] = useState("");
  const [markStudentId, setMarkStudentId] = useState("");
  const [obtainedMarks, setObtainedMarks] = useState("");

  const examsQuery = useQuery({
    queryKey: ["education", "exams", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationExams(branch!.code),
  });
  const sessionsQuery = useQuery({
    queryKey: ["education", "sessions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSessions(branch!.code),
  });
  const classesQuery = useQuery({
    queryKey: ["education", "classes", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationClasses(branch!.code),
  });
  const typeLookupsQuery = useQuery({
    queryKey: ["education", "lookups", branch?.code, "exam_type"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLookups(branch!.code, "exam_type"),
  });
  const subjectsQuery = useQuery({
    queryKey: ["education", "subjects", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSubjects(branch!.code),
  });
  const examSubjectsQuery = useQuery({
    queryKey: ["education", "exam-subjects", branch?.code, markExamId || examId],
    enabled: Boolean(branch?.code) && Boolean(markExamId || examId),
    queryFn: () => fetchEducationExamSubjects(branch!.code, markExamId || examId),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });

  const createExamMutation = useMutation({
    mutationFn: () =>
      createEducationExam({
        branchCode: branch!.code,
        name: name.trim(),
        examTypeCode: examTypeCode || "midterm",
        sessionId: sessionId || undefined,
        classId: classId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: "scheduled",
      }),
    onSuccess: () => {
      invalidate();
      setName("");
      setNotice("Exam created");
    },
  });

  const addSubjectMutation = useMutation({
    mutationFn: () =>
      createEducationExamSubject({
        examId,
        subjectId: subjectId || undefined,
        totalMarks: Number(totalMarks) || 100,
        passingMarks: Number(passingMarks) || 40,
      }),
    onSuccess: () => {
      invalidate(["exam-subjects"]);
      setNotice("Exam subject added");
    },
  });

  const markMutation = useMutation({
    mutationFn: () =>
      createEducationMark({
        branchCode: branch!.code,
        examId: markExamId,
        examSubjectId: markExamSubjectId,
        studentId: markStudentId,
        obtainedMarks: Number(obtainedMarks) || 0,
        status: "entered",
      }),
    onSuccess: () => {
      invalidate(["marks"]);
      setObtainedMarks("");
      setNotice("Mark saved");
    },
  });

  const filtered = useMemo(() => {
    const list = examsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) => e.name.toLowerCase().includes(q) || e.examTypeCode.toLowerCase().includes(q),
    );
  }, [examsQuery.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Examinations"
        subtitle="Exam schedules, subject papers, and marks entry."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {examsQuery.isError ? (
        <div className={noticeErrorClass}>{(examsQuery.error as Error).message}</div>
      ) : null}
      {createExamMutation.isError ? (
        <div className={noticeErrorClass}>{(createExamMutation.error as Error).message}</div>
      ) : null}
      {addSubjectMutation.isError ? (
        <div className={noticeErrorClass}>{(addSubjectMutation.error as Error).message}</div>
      ) : null}
      {markMutation.isError ? (
        <div className={noticeErrorClass}>{(markMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="Create exam">
        <EducationField label="Name" required>
          <EducationInput value={name} onChange={(e) => setName(e.target.value)} />
        </EducationField>
        <EducationField label="Exam type">
          <EducationSelect value={examTypeCode} onChange={(e) => setExamTypeCode(e.target.value)}>
            <option value="">midterm</option>
            {(typeLookupsQuery.data ?? []).map((t) => (
              <option key={t.id} value={t.code}>
                {t.label}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Session">
          <EducationSelect value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">—</option>
            {(sessionsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Class">
          <EducationSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">—</option>
            {(classesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Start date">
          <EducationInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </EducationField>
        <EducationField label="End date">
          <EducationInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!name.trim() || !branch?.code || examsQuery.isError || createExamMutation.isPending}
            title={examsQuery.isError ? "Exams API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createExamMutation.mutate();
            }}
          >
            Create exam
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Add exam subject / paper">
        <EducationField label="Exam" required>
          <EducationSelect value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">—</option>
            {(examsQuery.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Subject">
          <EducationSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">—</option>
            {(subjectsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Total marks">
          <EducationInput type="number" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} />
        </EducationField>
        <EducationField label="Passing marks">
          <EducationInput
            type="number"
            value={passingMarks}
            onChange={(e) => setPassingMarks(e.target.value)}
          />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!examId || addSubjectMutation.isPending}
            onClick={() => {
              setNotice(null);
              addSubjectMutation.mutate();
            }}
          >
            Add subject
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Marks entry">
        <EducationField label="Exam" required>
          <EducationSelect
            value={markExamId}
            onChange={(e) => {
              setMarkExamId(e.target.value);
              setMarkExamSubjectId("");
            }}
          >
            <option value="">—</option>
            {(examsQuery.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Exam subject" required>
          <EducationSelect
            value={markExamSubjectId}
            onChange={(e) => setMarkExamSubjectId(e.target.value)}
          >
            <option value="">—</option>
            {(examSubjectsQuery.data ?? []).map((es) => (
              <option key={es.id} value={es.id}>
                {es.subjectId?.slice(0, 8) ?? es.id.slice(0, 8)} (/{es.totalMarks})
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Student" required>
          <EducationSelect value={markStudentId} onChange={(e) => setMarkStudentId(e.target.value)}>
            <option value="">—</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName ?? ""}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Obtained marks" required>
          <EducationInput
            type="number"
            value={obtainedMarks}
            onChange={(e) => setObtainedMarks(e.target.value)}
          />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !markExamId ||
              !markExamSubjectId ||
              !markStudentId ||
              obtainedMarks === "" ||
              markMutation.isPending
            }
            onClick={() => {
              setNotice(null);
              markMutation.mutate();
            }}
          >
            Save mark
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search exams…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <EducationDataTable
        columns={["Name", "Type", "Status", "Start", "End"]}
        rows={filtered.map((e) => [
          e.name,
          e.examTypeCode,
          e.status,
          e.startDate ?? "—",
          e.endDate ?? "—",
        ])}
      />
    </div>
  );
}

export function EducationResultsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const [examId, setExamId] = useState("");
  const [search, setSearch] = useState("");

  const examsQuery = useQuery({
    queryKey: ["education", "exams", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationExams(branch!.code),
  });
  const marksQuery = useQuery({
    queryKey: ["education", "marks", branch?.code, examId],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationMarks(branch!.code, examId || undefined),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });

  const studentName = useMemo(() => {
    const map = new Map(
      (studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName ?? ""}`.trim()]),
    );
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [studentsQuery.data]);

  const filtered = useMemo(() => {
    const list = marksQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        studentName(m.studentId).toLowerCase().includes(q) ||
        (m.gradeCode ?? "").toLowerCase().includes(q) ||
        (m.passFail ?? "").toLowerCase().includes(q),
    );
  }, [marksQuery.data, search, studentName]);

  return (
    <div className="space-y-5">
      <PageHeader title="Results" subtitle="Marks and results by exam." />
      {marksQuery.isError ? (
        <div className={noticeErrorClass}>{(marksQuery.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="Filter">
        <EducationField label="Exam">
          <EducationSelect value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">All exams</option>
            {(examsQuery.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Search">
          <EducationInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Student, grade…"
          />
        </EducationField>
      </EducationFormSection>

      <EducationDataTable
        columns={["Student", "Exam", "Subject paper", "Marks", "Grade", "Pass/Fail", "Status"]}
        rows={filtered.map((m) => [
          studentName(m.studentId),
          m.examId.slice(0, 8),
          m.examSubjectId.slice(0, 8),
          m.obtainedMarks,
          m.gradeCode ?? "—",
          m.passFail ?? "—",
          m.status,
        ])}
      />
    </div>
  );
}
