import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationTeacher,
  fetchEducationDepartments,
  fetchEducationTeachers,
  updateEducationTeacher,
} from "../api/education";
import { useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSecondaryButton,
  EducationSelect,
} from "../ui/EducationUi";

export function EducationTeachersPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employmentTypeCode, setEmploymentTypeCode] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [status, setStatus] = useState("active");

  const teachersQuery = useQuery({
    queryKey: ["education", "teachers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationTeachers(branch!.code),
  });
  const departmentsQuery = useQuery({
    queryKey: ["education", "departments", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationDepartments(branch!.code),
  });

  const resetForm = () => {
    setEditingId(null);
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setDesignation("");
    setDepartmentId("");
    setEmploymentTypeCode("");
    setEmployeeNumber("");
    setStatus("active");
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        branchCode: branch!.code,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        designation: designation.trim() || undefined,
        departmentId: departmentId || undefined,
        employmentTypeCode: employmentTypeCode.trim() || undefined,
        employeeNumber: employeeNumber.trim() || undefined,
        status: status || "active",
      };
      if (editingId) return updateEducationTeacher(editingId, body);
      return createEducationTeacher(body);
    },
    onSuccess: () => {
      const wasEdit = Boolean(editingId);
      invalidate(["teachers"]);
      resetForm();
      setNotice(wasEdit ? "Teacher updated" : "Teacher created");
    },
  });

  const filtered = useMemo(() => {
    const list = teachersQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.firstName.toLowerCase().includes(q) ||
        (t.lastName ?? "").toLowerCase().includes(q) ||
        (t.employeeNumber ?? "").toLowerCase().includes(q) ||
        (t.phone ?? "").toLowerCase().includes(q),
    );
  }, [teachersQuery.data, search]);

  const startEdit = (id: string) => {
    const t = (teachersQuery.data ?? []).find((x) => x.id === id);
    if (!t) return;
    setEditingId(t.id);
    setFirstName(t.firstName);
    setLastName(t.lastName ?? "");
    setPhone(t.phone ?? "");
    setEmail(t.email ?? "");
    setDesignation(t.designation ?? "");
    setDepartmentId(t.departmentId ?? "");
    setEmploymentTypeCode(t.employmentTypeCode ?? "");
    setEmployeeNumber(t.employeeNumber ?? "");
    setStatus(t.status || "active");
  };

  const disabledReason = !branch?.code
    ? "Select a branch first"
    : !firstName.trim()
      ? "Enter first name"
      : teachersQuery.isError
        ? "Teachers API unavailable"
        : saveMutation.isPending
          ? "Saving…"
          : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Teachers"
        subtitle="Teacher profiles, subject assignments, and class allocations."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {teachersQuery.isError ? (
        <div className={noticeErrorClass}>{(teachersQuery.error as Error).message}</div>
      ) : null}
      {saveMutation.isError ? (
        <div className={noticeErrorClass}>{(saveMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title={editingId ? "Edit teacher" : "New teacher"}>
        <EducationField label="First name" required>
          <EducationInput value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </EducationField>
        <EducationField label="Last name">
          <EducationInput value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </EducationField>
        <EducationField label="Employee number">
          <EducationInput
            value={employeeNumber}
            onChange={(e) => setEmployeeNumber(e.target.value)}
          />
        </EducationField>
        <EducationField label="Phone">
          <EducationInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </EducationField>
        <EducationField label="Email">
          <EducationInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </EducationField>
        <EducationField label="Designation">
          <EducationInput value={designation} onChange={(e) => setDesignation(e.target.value)} />
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
        <EducationField label="Employment type">
          <EducationInput
            value={employmentTypeCode}
            onChange={(e) => setEmploymentTypeCode(e.target.value)}
          />
        </EducationField>
        <EducationField label="Status">
          <EducationSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="on_leave">On leave</option>
          </EducationSelect>
        </EducationField>
        <div className="col-span-full flex flex-wrap items-center gap-2">
          <EducationPrimaryButton
            disabled={Boolean(disabledReason)}
            title={disabledReason ?? undefined}
            onClick={() => {
              setNotice(null);
              saveMutation.mutate();
            }}
          >
            {editingId ? "Update teacher" : "Create teacher"}
          </EducationPrimaryButton>
          {editingId ? (
            <EducationSecondaryButton onClick={resetForm}>Cancel edit</EducationSecondaryButton>
          ) : null}
          {disabledReason && disabledReason !== "Enter first name" ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">{disabledReason}</span>
          ) : null}
        </div>
      </EducationFormSection>

      <div className="flex flex-wrap items-center gap-2">
        <EducationInput
          className="min-w-[12rem] flex-1 sm:max-w-xs"
          placeholder="Search name, employee #, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {filtered.length} / {(teachersQuery.data ?? []).length}
        </span>
      </div>

      <EducationDataTable
        columns={["Emp #", "Name", "Designation", "Phone", "Status", "Actions"]}
        rows={filtered.map((t) => [
          t.employeeNumber ?? "—",
          `${t.firstName} ${t.lastName ?? ""}`.trim(),
          t.designation ?? "—",
          t.phone ?? "—",
          t.status,
          <EducationSecondaryButton key={t.id} onClick={() => startEdit(t.id)}>
            Edit
          </EducationSecondaryButton>,
        ])}
      />
    </div>
  );
}
