import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  convertEducationAdmission,
  createEducationAdmission,
  fetchEducationAdmissions,
  fetchEducationClasses,
  fetchEducationLookups,
  fetchEducationSessions,
  updateEducationAdmission,
} from "../api/education";
import { useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import { printEducationCertificate } from "../lib/printCertificate";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSecondaryButton,
  EducationSelect,
} from "../ui/EducationUi";

export function EducationAdmissionsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [applicantName, setApplicantName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [admissionTypeCode, setAdmissionTypeCode] = useState("");
  const [statusCode, setStatusCode] = useState("pending");
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [notes, setNotes] = useState("");

  const branding = useMemo(
    () => ({
      institutionName: "EducationFlow",
      branchName: branch?.name ?? branch?.code ?? "",
    }),
    [branch?.name, branch?.code],
  );

  const admissionsQuery = useQuery({
    queryKey: ["education", "admissions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationAdmissions(branch!.code),
  });
  const classesQuery = useQuery({
    queryKey: ["education", "classes", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationClasses(branch!.code),
  });
  const sessionsQuery = useQuery({
    queryKey: ["education", "sessions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSessions(branch!.code),
  });
  const typeLookupsQuery = useQuery({
    queryKey: ["education", "lookups", branch?.code, "admission_type"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLookups(branch!.code, "admission_type"),
  });
  const statusLookupsQuery = useQuery({
    queryKey: ["education", "lookups", branch?.code, "admission_status"],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLookups(branch!.code, "admission_status"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationAdmission({
        branchCode: branch!.code,
        applicantName: applicantName.trim(),
        fatherName: fatherName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        admissionTypeCode: admissionTypeCode || "new",
        statusCode: statusCode || "pending",
        classId: classId || undefined,
        sessionId: sessionId || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setApplicantName("");
      setFatherName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setNotice("Admission application created");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, statusCode: next }: { id: string; statusCode: string }) =>
      updateEducationAdmission(id, { statusCode: next }),
    onSuccess: () => {
      invalidate(["admissions"]);
      setNotice("Admission status updated");
    },
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => convertEducationAdmission(id),
    onSuccess: () => {
      invalidate();
      setNotice("Admission converted to student");
    },
  });

  const printAdmissionLetter = async (a: {
    id: string;
    applicantName: string;
    fatherName?: string | null;
    phone?: string | null;
    applicationNumber: string;
    statusCode: string;
    classId?: string | null;
    sessionId?: string | null;
    notes?: string | null;
  }) => {
    setErrorNotice(null);
    const result = await printEducationCertificate({
      kind: "admission_letter",
      applicantName: a.applicantName,
      studentName: a.applicantName,
      fatherName: a.fatherName ?? undefined,
      phone: a.phone ?? undefined,
      applicationNumber: a.applicationNumber,
      status: a.statusCode,
      className: (classesQuery.data ?? []).find((c) => c.id === a.classId)?.name,
      sessionName: (sessionsQuery.data ?? []).find((s) => s.id === a.sessionId)?.name,
      notes: a.notes ?? undefined,
      branding,
    });
    if (!result.ok) setErrorNotice(result.error ?? "Print failed");
  };

  const filtered = useMemo(() => {
    const list = admissionsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        a.applicantName.toLowerCase().includes(q) ||
        a.applicationNumber.toLowerCase().includes(q) ||
        (a.phone ?? "").toLowerCase().includes(q),
    );
  }, [admissionsQuery.data, search]);

  const statusOptions =
    statusLookupsQuery.data && statusLookupsQuery.data.length > 0
      ? statusLookupsQuery.data
      : [
          { id: "pending", code: "pending", label: "Pending" },
          { id: "accepted", code: "accepted", label: "Accepted" },
          { id: "rejected", code: "rejected", label: "Rejected" },
          { id: "converted", code: "converted", label: "Converted" },
        ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admissions"
        subtitle="Capture and track student admission applications for school, academy, or college."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {errorNotice ? <div className={noticeErrorClass}>{errorNotice}</div> : null}
      {admissionsQuery.isError ? (
        <div className={noticeErrorClass}>{(admissionsQuery.error as Error).message}</div>
      ) : null}
      {statusMutation.isError ? (
        <div className={noticeErrorClass}>{(statusMutation.error as Error).message}</div>
      ) : null}
      {convertMutation.isError ? (
        <div className={noticeErrorClass}>{(convertMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New application">
        <EducationField label="Applicant name" required>
          <EducationInput value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
        </EducationField>
        <EducationField label="Father name">
          <EducationInput value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
        </EducationField>
        <EducationField label="Phone">
          <EducationInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </EducationField>
        <EducationField label="Email">
          <EducationInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </EducationField>
        <EducationField label="Admission type">
          <EducationSelect value={admissionTypeCode} onChange={(e) => setAdmissionTypeCode(e.target.value)}>
            <option value="">new</option>
            {(typeLookupsQuery.data ?? []).map((t) => (
              <option key={t.id} value={t.code}>
                {t.label}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Status">
          <EducationSelect value={statusCode} onChange={(e) => setStatusCode(e.target.value)}>
            {statusOptions.map((s) => (
              <option key={s.id} value={s.code}>
                {s.label}
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
        <EducationField label="Notes">
          <EducationInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!applicantName.trim() || createMutation.isPending}
            onClick={() => {
              setNotice(null);
              setErrorNotice(null);
              createMutation.mutate();
            }}
          >
            Submit application
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <div className="flex flex-wrap items-center gap-2">
        <EducationInput
          className="min-w-[12rem] flex-1 sm:max-w-xs"
          placeholder="Search applicant, application #, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {filtered.length} / {(admissionsQuery.data ?? []).length}
        </span>
      </div>

      <EducationDataTable
        columns={["Application #", "Applicant", "Father", "Type", "Status", "Phone", "Actions"]}
        rows={filtered.map((a) => [
          a.applicationNumber,
          a.applicantName,
          a.fatherName ?? "—",
          a.admissionTypeCode,
          <EducationSelect
            key={`status-${a.id}`}
            value={a.statusCode}
            disabled={statusMutation.isPending}
            onChange={(e) => {
              setNotice(null);
              setErrorNotice(null);
              statusMutation.mutate({ id: a.id, statusCode: e.target.value });
            }}
          >
            {statusOptions.map((s) => (
              <option key={s.id} value={s.code}>
                {s.label}
              </option>
            ))}
          </EducationSelect>,
          a.phone ?? "—",
          <div key={`actions-${a.id}`} className="flex flex-wrap gap-1">
            <EducationSecondaryButton
              className="px-2 py-1"
              disabled={convertMutation.isPending || a.statusCode === "converted"}
              onClick={() => {
                setNotice(null);
                setErrorNotice(null);
                convertMutation.mutate(a.id);
              }}
            >
              Convert to student
            </EducationSecondaryButton>
            <EducationSecondaryButton
              className="px-2 py-1"
              onClick={() => void printAdmissionLetter(a)}
            >
              Print letter
            </EducationSecondaryButton>
          </div>,
        ])}
      />
    </div>
  );
}
