import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { EducationLookupCategory } from "@platform/contracts";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  EDUCATION_LOOKUP_CATEGORIES,
  createEducationLookup,
  fetchEducationLookups,
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

export function EducationLookupsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [category, setCategory] = useState<EducationLookupCategory>("student_status");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [notice, setNotice] = useState<string | null>(null);

  const lookupsQuery = useQuery({
    queryKey: ["education", "lookups", branch?.code, category],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLookups(branch!.code, category),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationLookup({
        branchCode: branch!.code,
        category,
        code: code.trim(),
        label: label.trim(),
        sortOrder: Number(sortOrder) || 0,
        isActive: true,
      }),
    onSuccess: () => {
      invalidate();
      setCode("");
      setLabel("");
      setNotice("Lookup added");
    },
  });

  const rows = useMemo(() => lookupsQuery.data ?? [], [lookupsQuery.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configurable lookups"
        subtitle="Manage labels and status codes used across admissions, students, fees, attendance, and exams. Never hard-code these in business logic."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {lookupsQuery.isError ? (
        <div className={noticeErrorClass}>{(lookupsQuery.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="Add lookup value" description="Values appear in forms that use this category.">
        <EducationField label="Category" required>
          <EducationSelect
            value={category}
            onChange={(e) => setCategory(e.target.value as EducationLookupCategory)}
          >
            {EDUCATION_LOOKUP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Code" required>
          <EducationInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. active" />
        </EducationField>
        <EducationField label="Label" required>
          <EducationInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Active" />
        </EducationField>
        <EducationField label="Sort order">
          <EducationInput type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!code.trim() || !label.trim() || createMutation.isPending}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Add lookup
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationDataTable
        columns={["Code", "Label", "Sort", "Active", "Category"]}
        rows={rows.map((r) => [r.code, r.label, r.sortOrder, r.isActive ? "Yes" : "No", r.category])}
      />
    </div>
  );
}
