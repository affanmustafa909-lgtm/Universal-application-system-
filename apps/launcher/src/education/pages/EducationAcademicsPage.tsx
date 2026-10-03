import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationClass,
  createEducationSection,
  createEducationSession,
  createEducationSubject,
  fetchEducationClasses,
  fetchEducationSections,
  fetchEducationSessions,
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

export function EducationAcademicsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"sessions" | "classes" | "sections" | "subjects">("sessions");

  const [sessionName, setSessionName] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [classSessionId, setClassSessionId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionCode, setSectionCode] = useState("");
  const [sectionClassId, setSectionClassId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

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
  const sectionsQuery = useQuery({
    queryKey: ["education", "sections", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSections(branch!.code),
  });
  const subjectsQuery = useQuery({
    queryKey: ["education", "subjects", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSubjects(branch!.code),
  });

  const sessionMutation = useMutation({
    mutationFn: () =>
      createEducationSession({
        branchCode: branch!.code,
        name: sessionName.trim(),
        code: sessionCode.trim(),
        isCurrent: false,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setSessionName("");
      setSessionCode("");
      setNotice("Session created");
    },
  });

  const classMutation = useMutation({
    mutationFn: () =>
      createEducationClass({
        branchCode: branch!.code,
        name: className.trim(),
        code: classCode.trim(),
        sessionId: classSessionId || undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setClassName("");
      setClassCode("");
      setNotice("Class created");
    },
  });

  const sectionMutation = useMutation({
    mutationFn: () =>
      createEducationSection({
        branchCode: branch!.code,
        classId: sectionClassId,
        name: sectionName.trim(),
        code: sectionCode.trim(),
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setSectionName("");
      setSectionCode("");
      setNotice("Section created");
    },
  });

  const subjectMutation = useMutation({
    mutationFn: () =>
      createEducationSubject({
        branchCode: branch!.code,
        name: subjectName.trim(),
        code: subjectCode.trim(),
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setSubjectName("");
      setSubjectCode("");
      setNotice("Subject created");
    },
  });

  const tabs = [
    { id: "sessions" as const, label: "Sessions" },
    { id: "classes" as const, label: "Classes" },
    { id: "sections" as const, label: "Sections" },
    { id: "subjects" as const, label: "Subjects" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Academics"
        subtitle="Manage academic sessions, classes, sections, and subjects for the campus."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? "bg-blue-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sessions" ? (
        <>
          <EducationFormSection title="New academic session">
            <EducationField label="Name" required>
              <EducationInput value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
            </EducationField>
            <EducationField label="Code" required>
              <EducationInput value={sessionCode} onChange={(e) => setSessionCode(e.target.value)} />
            </EducationField>
            <div className="col-span-full">
              <EducationPrimaryButton
                disabled={!sessionName.trim() || !sessionCode.trim() || sessionMutation.isPending}
                onClick={() => {
                  setNotice(null);
                  sessionMutation.mutate();
                }}
              >
                Add session
              </EducationPrimaryButton>
            </div>
          </EducationFormSection>
          {sessionsQuery.isError ? (
            <div className={noticeErrorClass}>{(sessionsQuery.error as Error).message}</div>
          ) : null}
          <EducationDataTable
            columns={["Name", "Code", "Current", "Status", "Start", "End"]}
            rows={(sessionsQuery.data ?? []).map((s) => [
              s.name,
              s.code,
              s.isCurrent ? "Yes" : "No",
              s.status,
              s.startDate ?? "—",
              s.endDate ?? "—",
            ])}
          />
        </>
      ) : null}

      {tab === "classes" ? (
        <>
          <EducationFormSection title="New class">
            <EducationField label="Name" required>
              <EducationInput value={className} onChange={(e) => setClassName(e.target.value)} />
            </EducationField>
            <EducationField label="Code" required>
              <EducationInput value={classCode} onChange={(e) => setClassCode(e.target.value)} />
            </EducationField>
            <EducationField label="Session">
              <EducationSelect value={classSessionId} onChange={(e) => setClassSessionId(e.target.value)}>
                <option value="">—</option>
                {(sessionsQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </EducationSelect>
            </EducationField>
            <div className="col-span-full">
              <EducationPrimaryButton
                disabled={!className.trim() || !classCode.trim() || classMutation.isPending}
                onClick={() => {
                  setNotice(null);
                  classMutation.mutate();
                }}
              >
                Add class
              </EducationPrimaryButton>
            </div>
          </EducationFormSection>
          <EducationDataTable
            columns={["Name", "Code", "Level", "Status"]}
            rows={(classesQuery.data ?? []).map((c) => [c.name, c.code, c.level ?? "—", c.status])}
          />
        </>
      ) : null}

      {tab === "sections" ? (
        <>
          <EducationFormSection title="New section">
            <EducationField label="Class" required>
              <EducationSelect value={sectionClassId} onChange={(e) => setSectionClassId(e.target.value)}>
                <option value="">—</option>
                {(classesQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </EducationSelect>
            </EducationField>
            <EducationField label="Name" required>
              <EducationInput value={sectionName} onChange={(e) => setSectionName(e.target.value)} />
            </EducationField>
            <EducationField label="Code" required>
              <EducationInput value={sectionCode} onChange={(e) => setSectionCode(e.target.value)} />
            </EducationField>
            <div className="col-span-full">
              <EducationPrimaryButton
                disabled={
                  !sectionClassId || !sectionName.trim() || !sectionCode.trim() || sectionMutation.isPending
                }
                onClick={() => {
                  setNotice(null);
                  sectionMutation.mutate();
                }}
              >
                Add section
              </EducationPrimaryButton>
            </div>
          </EducationFormSection>
          <EducationDataTable
            columns={["Name", "Code", "Class ID", "Capacity", "Status"]}
            rows={(sectionsQuery.data ?? []).map((s) => [
              s.name,
              s.code,
              s.classId.slice(0, 8),
              s.capacity ?? "—",
              s.status,
            ])}
          />
        </>
      ) : null}

      {tab === "subjects" ? (
        <>
          <EducationFormSection title="New subject">
            <EducationField label="Name" required>
              <EducationInput value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
            </EducationField>
            <EducationField label="Code" required>
              <EducationInput value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} />
            </EducationField>
            <div className="col-span-full">
              <EducationPrimaryButton
                disabled={!subjectName.trim() || !subjectCode.trim() || subjectMutation.isPending}
                onClick={() => {
                  setNotice(null);
                  subjectMutation.mutate();
                }}
              >
                Add subject
              </EducationPrimaryButton>
            </div>
          </EducationFormSection>
          <EducationDataTable
            columns={["Name", "Code", "Credit hours", "Status"]}
            rows={(subjectsQuery.data ?? []).map((s) => [
              s.name,
              s.code,
              s.creditHours ?? "—",
              s.status,
            ])}
          />
        </>
      ) : null}
    </div>
  );
}
