import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationHealthRecord,
  createEducationHealthVisit,
  fetchEducationHealthRecords,
  fetchEducationHealthVisits,
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

export function EducationHealthPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [healthRecordId, setHealthRecordId] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [reason, setReason] = useState("");
  const [treatment, setTreatment] = useState("");

  const recordsQuery = useQuery({
    queryKey: ["education", "health-records", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationHealthRecords(branch!.code),
  });
  const visitsQuery = useQuery({
    queryKey: ["education", "health-visits", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationHealthVisits(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });

  const recordMutation = useMutation({
    mutationFn: () =>
      createEducationHealthRecord({
        branchCode: branch!.code,
        studentId,
        allergies: allergies.trim() || undefined,
        notes: notes.trim() || undefined,
        emergencyContact: emergencyContact.trim() || undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Health record saved");
      setAllergies("");
      setNotes("");
      setEmergencyContact("");
    },
  });

  const visitMutation = useMutation({
    mutationFn: () =>
      createEducationHealthVisit({
        healthRecordId,
        visitDate,
        reason: reason.trim() || undefined,
        treatment: treatment.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Health visit recorded");
      setReason("");
      setTreatment("");
    },
  });

  const filtered = useMemo(() => {
    const list = recordsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.studentId.toLowerCase().includes(q) ||
        (r.allergies ?? "").toLowerCase().includes(q) ||
        (r.emergencyContact ?? "").toLowerCase().includes(q),
    );
  }, [recordsQuery.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Health" subtitle="Student health records and clinic visit log." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {recordsQuery.isError ? (
        <div className={noticeErrorClass}>{(recordsQuery.error as Error).message}</div>
      ) : null}
      {recordMutation.isError ? (
        <div className={noticeErrorClass}>{(recordMutation.error as Error).message}</div>
      ) : null}
      {visitMutation.isError ? (
        <div className={noticeErrorClass}>{(visitMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New health record">
        <EducationField label="Student" required>
          <EducationSelect value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">—</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName ?? ""}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Allergies">
          <EducationInput value={allergies} onChange={(e) => setAllergies(e.target.value)} />
        </EducationField>
        <EducationField label="Emergency contact">
          <EducationInput
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value)}
          />
        </EducationField>
        <EducationField label="Notes">
          <EducationInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code || !studentId || recordsQuery.isError || recordMutation.isPending
            }
            onClick={() => {
              setNotice(null);
              recordMutation.mutate();
            }}
          >
            Save record
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Log clinic visit">
        <EducationField label="Health record" required>
          <EducationSelect
            value={healthRecordId}
            onChange={(e) => setHealthRecordId(e.target.value)}
          >
            <option value="">—</option>
            {(recordsQuery.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.studentId.slice(0, 8)} — {r.allergies ?? "no allergies noted"}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Visit date" required>
          <EducationInput type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </EducationField>
        <EducationField label="Reason">
          <EducationInput value={reason} onChange={(e) => setReason(e.target.value)} />
        </EducationField>
        <EducationField label="Treatment">
          <EducationInput value={treatment} onChange={(e) => setTreatment(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!healthRecordId || !visitDate || visitMutation.isPending}
            onClick={() => {
              setNotice(null);
              visitMutation.mutate();
            }}
          >
            Log visit
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search records…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Health records</h3>
      <EducationDataTable
        columns={["Student", "Allergies", "Emergency", "Status", "Last visit"]}
        rows={filtered.map((r) => [
          r.studentId.slice(0, 8),
          r.allergies ?? "—",
          r.emergencyContact ?? "—",
          r.status,
          r.lastVisitDate ?? "—",
        ])}
      />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Visits</h3>
      <EducationDataTable
        columns={["Date", "Record", "Reason", "Treatment"]}
        rows={(visitsQuery.data ?? []).map((v) => [
          v.visitDate,
          v.healthRecordId.slice(0, 8),
          v.reason ?? "—",
          v.treatment ?? "—",
        ])}
      />
    </div>
  );
}
