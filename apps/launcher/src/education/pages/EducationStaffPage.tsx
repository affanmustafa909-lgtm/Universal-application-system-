import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationStaff,
  fetchEducationDepartments,
  fetchEducationStaff,
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

export function EducationStaffPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [staffCategoryCode, setStaffCategoryCode] = useState("");
  const [employmentTypeCode, setEmploymentTypeCode] = useState("");
  const [salaryPkr, setSalaryPkr] = useState("");
  const [joiningDate, setJoiningDate] = useState("");

  const staffQuery = useQuery({
    queryKey: ["education", "staff", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStaff(branch!.code),
  });
  const departmentsQuery = useQuery({
    queryKey: ["education", "departments", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationDepartments(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationStaff({
        branchCode: branch!.code,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        designation: designation.trim() || undefined,
        departmentId: departmentId || undefined,
        staffCategoryCode: staffCategoryCode.trim() || undefined,
        employmentTypeCode: employmentTypeCode.trim() || undefined,
        salaryPkr: salaryPkr ? Number(salaryPkr) : undefined,
        joiningDate: joiningDate || undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setDesignation("");
      setSalaryPkr("");
      setNotice("Staff member created");
    },
  });

  const filtered = useMemo(() => {
    const list = staffQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        (s.lastName ?? "").toLowerCase().includes(q) ||
        s.employeeNumber.toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q),
    );
  }, [staffQuery.data, search]);

  const disabledReason = !branch?.code
    ? "Select a branch first"
    : !firstName.trim()
      ? "Enter first name"
      : staffQuery.isError
        ? "Staff API unavailable"
        : createMutation.isPending
          ? "Saving…"
          : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Staff" subtitle="Non-teaching staff directory and employment records." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {staffQuery.isError ? (
        <div className={noticeErrorClass}>{(staffQuery.error as Error).message}</div>
      ) : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="Add staff member">
        <EducationField label="First name" required>
          <EducationInput value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </EducationField>
        <EducationField label="Last name">
          <EducationInput value={lastName} onChange={(e) => setLastName(e.target.value)} />
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
        <EducationField label="Staff category">
          <EducationInput
            value={staffCategoryCode}
            onChange={(e) => setStaffCategoryCode(e.target.value)}
          />
        </EducationField>
        <EducationField label="Employment type">
          <EducationInput
            value={employmentTypeCode}
            onChange={(e) => setEmploymentTypeCode(e.target.value)}
          />
        </EducationField>
        <EducationField label="Salary (PKR)">
          <EducationInput
            type="number"
            value={salaryPkr}
            onChange={(e) => setSalaryPkr(e.target.value)}
          />
        </EducationField>
        <EducationField label="Joining date">
          <EducationInput
            type="date"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
          />
        </EducationField>
        <div className="col-span-full flex flex-wrap items-center gap-2">
          <EducationPrimaryButton
            disabled={Boolean(disabledReason)}
            title={disabledReason ?? undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Add staff
          </EducationPrimaryButton>
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
          {filtered.length} / {(staffQuery.data ?? []).length}
        </span>
      </div>

      <EducationDataTable
        columns={["Emp #", "Name", "Designation", "Phone", "Salary", "Status"]}
        rows={filtered.map((s) => [
          s.employeeNumber,
          `${s.firstName} ${s.lastName ?? ""}`.trim(),
          s.designation ?? "—",
          s.phone ?? "—",
          s.salaryPkr,
          s.status,
        ])}
      />
    </div>
  );
}
