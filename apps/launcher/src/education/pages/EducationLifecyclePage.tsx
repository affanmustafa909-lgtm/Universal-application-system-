import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationStudentLifecycle,
  fetchEducationClasses,
  fetchEducationSections,
  fetchEducationSessions,
  fetchEducationStudentLifecycle,
  fetchEducationStudents,
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

type ActionType = "promote" | "transfer" | "withdraw" | "readmit" | "graduate" | "archive";

export function EducationLifecyclePage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [actionType, setActionType] = useState<ActionType>("promote");
  const [fromSessionId, setFromSessionId] = useState("");
  const [toSessionId, setToSessionId] = useState("");
  const [fromClassId, setFromClassId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [fromSectionId, setFromSectionId] = useState("");
  const [toSectionId, setToSectionId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const listQuery = useQuery({
    queryKey: ["education", "student-lifecycle", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudentLifecycle(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
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
  const sectionsQuery = useQuery({
    queryKey: ["education", "sections", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSections(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationStudentLifecycle({
        branchCode: branch!.code,
        studentId,
        actionType,
        fromSessionId: fromSessionId || undefined,
        toSessionId: toSessionId || undefined,
        fromClassId: fromClassId || undefined,
        toClassId: toClassId || undefined,
        fromSectionId: fromSectionId || undefined,
        toSectionId: toSectionId || undefined,
        effectiveDate,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        status: "pending",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Lifecycle action saved");
      setReason("");
      setNotes("");
    },
  });

  const filtered = useMemo(() => {
    const list = listQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.studentId.toLowerCase().includes(q) ||
        r.actionType.toLowerCase().includes(q) ||
        (r.reason ?? "").toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [listQuery.data, search]);

  const disabled =
    !branch?.code ||
    !studentId ||
    !effectiveDate ||
    listQuery.isError ||
    createMutation.isPending;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Student lifecycle / Promotion"
        subtitle="Promote, transfer, or withdraw students across sessions, classes, and sections."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {listQuery.isError ? (
        <div className={noticeErrorClass}>{(listQuery.error as Error).message}</div>
      ) : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New lifecycle action">
        <EducationField label="Student" required>
          <EducationSelect value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">—</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName ?? ""} ({s.admissionNumber ?? s.id.slice(0, 8)})
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Action" required>
          <EducationSelect
            value={actionType}
            onChange={(e) => setActionType(e.target.value as ActionType)}
          >
            <option value="promote">Promote</option>
            <option value="transfer">Transfer</option>
            <option value="withdraw">Withdraw</option>
            <option value="readmit">Readmit</option>
            <option value="graduate">Graduate</option>
            <option value="archive">Archive</option>
          </EducationSelect>
        </EducationField>
        <EducationField label="Effective date" required>
          <EducationInput
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </EducationField>
        <EducationField label="From session">
          <EducationSelect value={fromSessionId} onChange={(e) => setFromSessionId(e.target.value)}>
            <option value="">—</option>
            {(sessionsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="To session">
          <EducationSelect value={toSessionId} onChange={(e) => setToSessionId(e.target.value)}>
            <option value="">—</option>
            {(sessionsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="From class">
          <EducationSelect value={fromClassId} onChange={(e) => setFromClassId(e.target.value)}>
            <option value="">—</option>
            {(classesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="To class">
          <EducationSelect value={toClassId} onChange={(e) => setToClassId(e.target.value)}>
            <option value="">—</option>
            {(classesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="From section">
          <EducationSelect value={fromSectionId} onChange={(e) => setFromSectionId(e.target.value)}>
            <option value="">—</option>
            {(sectionsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="To section">
          <EducationSelect value={toSectionId} onChange={(e) => setToSectionId(e.target.value)}>
            <option value="">—</option>
            {(sectionsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Reason">
          <EducationInput value={reason} onChange={(e) => setReason(e.target.value)} />
        </EducationField>
        <EducationField label="Notes">
          <EducationInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={disabled}
            title={listQuery.isError ? "Lifecycle API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Save action
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
        columns={["Date", "Student", "Action", "Status", "Reason"]}
        rows={filtered.map((r) => [
          r.effectiveDate,
          r.studentId.slice(0, 8),
          r.actionType,
          r.status,
          r.reason ?? "—",
        ])}
      />
    </div>
  );
}
