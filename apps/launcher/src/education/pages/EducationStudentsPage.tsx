import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationStudent,
  fetchEducationClasses,
  fetchEducationFeeStructures,
  fetchEducationLookups,
  fetchEducationSections,
  fetchEducationSessions,
  fetchEducationStudents,
  updateEducationStudent,
} from "../api/education";
import { useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import { printEducationIdCard } from "../lib/printIdCard";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSecondaryButton,
  EducationSelect,
} from "../ui/EducationUi";

export function EducationStudentsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [genderCode, setGenderCode] = useState("");
  const [statusCode, setStatusCode] = useState("active");
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [feeStructureId, setFeeStructureId] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const branding = useMemo(
    () => ({
      institutionName: "EducationFlow",
      branchName: branch?.name ?? branch?.code ?? "",
    }),
    [branch?.name, branch?.code],
  );

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
    queryKey: ["education", "sections", branch?.code, classId],
    enabled: Boolean(branch?.code) && Boolean(classId),
    queryFn: () => fetchEducationSections(branch!.code, classId),
  });
  const allSectionsQuery = useQuery({
    queryKey: ["education", "sections", branch?.code, "all"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSections(branch!.code),
  });
  const feeStructuresQuery = useQuery({
    queryKey: ["education", "fee-structures", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationFeeStructures(branch!.code),
  });
  const statusLookupsQuery = useQuery({
    queryKey: ["education", "lookups", branch?.code, "student_status"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLookups(branch!.code, "student_status"),
  });
  const genderLookupsQuery = useQuery({
    queryKey: ["education", "lookups", branch?.code, "gender"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLookups(branch!.code, "gender"),
  });

  const enrollMutation = useMutation({
    mutationFn: () =>
      createEducationStudent({
        branchCode: branch!.code,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        fatherName: fatherName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        genderCode: genderCode || undefined,
        statusCode: statusCode || "active",
        sessionId: sessionId || undefined,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        admissionNumber: admissionNumber.trim() || undefined,
        admissionDate: new Date().toISOString().slice(0, 10),
        customFieldsJson: feeStructureId
          ? JSON.stringify({ feeStructureId })
          : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setFirstName("");
      setLastName("");
      setFatherName("");
      setPhone("");
      setEmail("");
      setAdmissionNumber("");
      setFeeStructureId("");
      setNotice("Student enrolled");
    },
  });

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classesQuery.data ?? []) map.set(c.id, c.name);
    return map;
  }, [classesQuery.data]);

  const sectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allSectionsQuery.data ?? sectionsQuery.data ?? []) map.set(s.id, s.name);
    return map;
  }, [allSectionsQuery.data, sectionsQuery.data]);

  const sessionNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessionsQuery.data ?? []) map.set(s.id, s.name);
    return map;
  }, [sessionsQuery.data]);

  const statusMutation = useMutation({
    mutationFn: ({ id, statusCode: next }: { id: string; statusCode: string }) =>
      updateEducationStudent(id, { statusCode: next }),
    onSuccess: () => {
      invalidate(["students"]);
      setNotice("Student status updated");
    },
  });

  const printIdCard = async (s: {
    firstName: string;
    lastName?: string | null;
    studentNumber: string;
    classId?: string | null;
    sectionId?: string | null;
    sessionId?: string | null;
  }) => {
    setErrorNotice(null);
    const result = await printEducationIdCard({
      studentName: [s.firstName, s.lastName].filter(Boolean).join(" "),
      studentNumber: s.studentNumber,
      className: s.classId ? classNameById.get(s.classId) : undefined,
      sectionName: s.sectionId ? sectionNameById.get(s.sectionId) : undefined,
      sessionName: s.sessionId ? sessionNameById.get(s.sessionId) : undefined,
      branding,
    });
    if (!result.ok) setErrorNotice(result.error ?? "Print failed");
  };

  const filtered = useMemo(() => {
    const list = studentsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        (s.lastName ?? "").toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q),
    );
  }, [studentsQuery.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Students"
        subtitle="Enroll students with class assignment, basic profile, and optional fee structure hooks."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {errorNotice ? <div className={noticeErrorClass}>{errorNotice}</div> : null}
      {studentsQuery.isError ? (
        <div className={noticeErrorClass}>{(studentsQuery.error as Error).message}</div>
      ) : null}
      {enrollMutation.isError ? (
        <div className={noticeErrorClass}>{(enrollMutation.error as Error).message}</div>
      ) : null}
      {statusMutation.isError ? (
        <div className={noticeErrorClass}>{(statusMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="Basic profile" description="Core identity fields for the student record.">
        <EducationField label="First name" required>
          <EducationInput value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </EducationField>
        <EducationField label="Last name">
          <EducationInput value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </EducationField>
        <EducationField label="Father name">
          <EducationInput value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
        </EducationField>
        <EducationField label="Admission number">
          <EducationInput value={admissionNumber} onChange={(e) => setAdmissionNumber(e.target.value)} />
        </EducationField>
        <EducationField label="Phone">
          <EducationInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </EducationField>
        <EducationField label="Email">
          <EducationInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </EducationField>
        <EducationField label="Gender">
          <EducationSelect value={genderCode} onChange={(e) => setGenderCode(e.target.value)}>
            <option value="">—</option>
            {(genderLookupsQuery.data ?? []).map((g) => (
              <option key={g.id} value={g.code}>
                {g.label}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Status">
          <EducationSelect value={statusCode} onChange={(e) => setStatusCode(e.target.value)}>
            {(statusLookupsQuery.data ?? [{ code: "active", label: "Active", id: "fallback" }]).map((s) => (
              <option key={s.id} value={s.code}>
                {s.label}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
      </EducationFormSection>

      <EducationFormSection title="Class assignment" description="Link the student to session, class, and section.">
        <EducationField label="Academic session">
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
          <EducationSelect
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
            }}
          >
            <option value="">—</option>
            {(classesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Section">
          <EducationSelect value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
            <option value="">—</option>
            {(sectionsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
      </EducationFormSection>

      <EducationFormSection title="Fee hook" description="Optional fee structure to attach at enrollment (stored for fee workflows).">
        <EducationField label="Fee structure">
          <EducationSelect value={feeStructureId} onChange={(e) => setFeeStructureId(e.target.value)}>
            <option value="">—</option>
            {(feeStructuresQuery.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} (Rs {f.amountPkr.toLocaleString()})
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!firstName.trim() || enrollMutation.isPending}
            onClick={() => {
              setNotice(null);
              enrollMutation.mutate();
            }}
          >
            Enroll student
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <div className="flex flex-wrap items-center gap-2">
        <EducationInput
          className="min-w-[12rem] flex-1 sm:max-w-xs"
          placeholder="Search name, number, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {filtered.length} / {(studentsQuery.data ?? []).length}
        </span>
      </div>

      <EducationDataTable
        columns={["Number", "Name", "Father", "Class", "Phone", "Status", "Actions"]}
        rows={filtered.map((s) => [
          s.studentNumber,
          [s.firstName, s.lastName].filter(Boolean).join(" "),
          s.fatherName ?? "—",
          s.classId ? (classNameById.get(s.classId) ?? "—") : "—",
          s.phone ?? "—",
          <EducationSelect
            key={`status-${s.id}`}
            value={s.statusCode}
            disabled={statusMutation.isPending}
            onChange={(e) => {
              setNotice(null);
              setErrorNotice(null);
              statusMutation.mutate({ id: s.id, statusCode: e.target.value });
            }}
          >
            {(statusLookupsQuery.data ?? [
              { id: "active", code: "active", label: "Active" },
              { id: "inactive", code: "inactive", label: "Inactive" },
              { id: "alumni", code: "alumni", label: "Alumni" },
            ]).map((opt) => (
              <option key={opt.id} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </EducationSelect>,
          <EducationSecondaryButton
            key={`id-${s.id}`}
            className="px-2 py-1"
            onClick={() => void printIdCard(s)}
          >
            Print ID card
          </EducationSecondaryButton>,
        ])}
      />
    </div>
  );
}
