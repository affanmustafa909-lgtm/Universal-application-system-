import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationScholarship,
  createEducationScholarshipAward,
  fetchEducationScholarshipAwards,
  fetchEducationScholarships,
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

export function EducationScholarshipsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [scholarshipTypeCode, setScholarshipTypeCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed" | "full_waiver">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [status, setStatus] = useState("draft");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [awardScholarshipId, setAwardScholarshipId] = useState("");
  const [awardStudentId, setAwardStudentId] = useState("");
  const [awardAmount, setAwardAmount] = useState("");

  const listQuery = useQuery({
    queryKey: ["education", "scholarships", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationScholarships(branch!.code),
  });
  const awardsQuery = useQuery({
    queryKey: ["education", "scholarship-awards", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationScholarshipAwards(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationScholarship({
        branchCode: branch!.code,
        name: name.trim(),
        scholarshipTypeCode: scholarshipTypeCode.trim(),
        discountType,
        discountValue: Number(discountValue || 0),
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Scholarship created");
      setName("");
      setScholarshipTypeCode("");
      setDiscountValue("");
    },
  });

  const awardMutation = useMutation({
    mutationFn: () =>
      createEducationScholarshipAward({
        scholarshipId: awardScholarshipId,
        studentId: awardStudentId,
        amountPkr: Number(awardAmount || 0),
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Scholarship awarded");
      setAwardAmount("");
    },
  });

  const filtered = useMemo(() => {
    const list = listQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.scholarshipTypeCode.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q),
    );
  }, [listQuery.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Scholarships" subtitle="Define scholarship schemes and award them to students." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {listQuery.isError ? (
        <div className={noticeErrorClass}>{(listQuery.error as Error).message}</div>
      ) : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}
      {awardMutation.isError ? (
        <div className={noticeErrorClass}>{(awardMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New scholarship">
        <EducationField label="Name" required>
          <EducationInput value={name} onChange={(e) => setName(e.target.value)} />
        </EducationField>
        <EducationField label="Type code" required>
          <EducationInput
            value={scholarshipTypeCode}
            onChange={(e) => setScholarshipTypeCode(e.target.value)}
          />
        </EducationField>
        <EducationField label="Discount type" required>
          <EducationSelect
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as typeof discountType)}
          >
            <option value="percent">Percent</option>
            <option value="fixed">Fixed amount</option>
            <option value="full_waiver">Full waiver</option>
          </EducationSelect>
        </EducationField>
        <EducationField label="Discount value" required>
          <EducationInput
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
        </EducationField>
        <EducationField label="Status">
          <EducationSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="rejected">Rejected</option>
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
            disabled={
              !branch?.code ||
              !name.trim() ||
              !scholarshipTypeCode.trim() ||
              listQuery.isError ||
              createMutation.isPending
            }
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Create scholarship
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Award scholarship">
        <EducationField label="Scholarship" required>
          <EducationSelect
            value={awardScholarshipId}
            onChange={(e) => setAwardScholarshipId(e.target.value)}
          >
            <option value="">—</option>
            {(listQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Student" required>
          <EducationSelect
            value={awardStudentId}
            onChange={(e) => setAwardStudentId(e.target.value)}
          >
            <option value="">—</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName ?? ""}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Amount (PKR)" required>
          <EducationInput
            type="number"
            value={awardAmount}
            onChange={(e) => setAwardAmount(e.target.value)}
          />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !awardScholarshipId ||
              !awardStudentId ||
              !awardAmount ||
              awardMutation.isPending
            }
            onClick={() => {
              setNotice(null);
              awardMutation.mutate();
            }}
          >
            Award
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search scholarships…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <EducationDataTable
        columns={["Name", "Type", "Discount", "Status", "Dates"]}
        rows={filtered.map((s) => [
          s.name,
          s.scholarshipTypeCode,
          `${s.discountType}: ${s.discountValue}`,
          s.status,
          `${s.startDate ?? "—"} → ${s.endDate ?? "—"}`,
        ])}
      />

      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Awards</h3>
      <EducationDataTable
        columns={["Scholarship", "Student", "Amount", "Status", "Awarded"]}
        rows={(awardsQuery.data ?? []).map((a) => [
          a.scholarshipId.slice(0, 8),
          a.studentId.slice(0, 8),
          formatPkr(a.amountPkr),
          a.status,
          a.awardedAt?.slice(0, 10) ?? "—",
        ])}
      />
    </div>
  );
}
