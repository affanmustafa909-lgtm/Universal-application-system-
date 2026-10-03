import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationGuardian,
  fetchEducationGuardians,
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

export function EducationParentsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relationshipCode, setRelationshipCode] = useState("");
  const [address, setAddress] = useState("");
  const [studentId, setStudentId] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);

  const guardiansQuery = useQuery({
    queryKey: ["education", "guardians", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationGuardians(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationGuardian({
        branchCode: branch!.code,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        relationshipCode: relationshipCode.trim() || undefined,
        address: address.trim() || undefined,
        status: "active",
        studentId: studentId || undefined,
        isPrimary: studentId ? isPrimary : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setFullName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setStudentId("");
      setNotice("Guardian saved");
    },
  });

  const filtered = useMemo(() => {
    const list = guardiansQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (g) =>
        g.fullName.toLowerCase().includes(q) ||
        (g.phone ?? "").toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q),
    );
  }, [guardiansQuery.data, search]);

  const disabledReason = !branch?.code
    ? "Select a branch first"
    : !fullName.trim()
      ? "Enter guardian name"
      : guardiansQuery.isError
        ? "Guardians API unavailable"
        : createMutation.isPending
          ? "Saving…"
          : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parents / Guardians"
        subtitle="Guardian contacts linked to students for school, academy, or college."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {guardiansQuery.isError ? (
        <div className={noticeErrorClass}>{(guardiansQuery.error as Error).message}</div>
      ) : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="Add guardian" description="Optionally link to a student on create.">
        <EducationField label="Full name" required>
          <EducationInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </EducationField>
        <EducationField label="Phone">
          <EducationInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </EducationField>
        <EducationField label="Email">
          <EducationInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </EducationField>
        <EducationField label="Relationship code">
          <EducationInput
            value={relationshipCode}
            onChange={(e) => setRelationshipCode(e.target.value)}
            placeholder="father / mother / guardian"
          />
        </EducationField>
        <EducationField label="Address">
          <EducationInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </EducationField>
        <EducationField label="Link student">
          <EducationSelect value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— none —</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName ?? ""} ({s.admissionNumber ?? s.id.slice(0, 8)})
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        {studentId ? (
          <EducationField label="Primary contact">
            <EducationSelect
              value={isPrimary ? "yes" : "no"}
              onChange={(e) => setIsPrimary(e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </EducationSelect>
          </EducationField>
        ) : null}
        <div className="col-span-full flex flex-wrap items-center gap-2">
          <EducationPrimaryButton
            disabled={Boolean(disabledReason)}
            title={disabledReason ?? undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Save guardian
          </EducationPrimaryButton>
          {disabledReason && disabledReason !== "Enter guardian name" ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">{disabledReason}</span>
          ) : null}
        </div>
      </EducationFormSection>

      <div className="flex flex-wrap items-center gap-2">
        <EducationInput
          className="min-w-[12rem] flex-1 sm:max-w-xs"
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {filtered.length} / {(guardiansQuery.data ?? []).length}
        </span>
      </div>

      <EducationDataTable
        columns={["Name", "Phone", "Email", "Relationship", "Status"]}
        rows={filtered.map((g) => [
          g.fullName,
          g.phone ?? "—",
          g.email ?? "—",
          g.relationshipCode ?? "—",
          g.status,
        ])}
      />
    </div>
  );
}
