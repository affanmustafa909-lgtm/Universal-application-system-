import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import { useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSelect,
} from "./EducationUi";

export type EducationModuleField = {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "email" | "date" | "select" | "textarea";
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** When true, field is omitted from create body if empty. */
  omitIfEmpty?: boolean;
};

export type EducationModuleColumn = {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => ReactNode;
};

function cellValue(row: Record<string, unknown>, key: string): ReactNode {
  const v = row[key];
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function EducationModulePage({
  title,
  subtitle,
  resourceKey,
  fetchList,
  createFn,
  fields,
  columns,
  searchKeys = [],
  createLabel = "Create",
  formTitle = "New record",
  buildBody,
  extras,
  requireBranch = true,
}: {
  title: string;
  subtitle: string;
  resourceKey: string;
  fetchList: (branchCode: string) => Promise<unknown[]>;
  createFn?: (body: unknown) => Promise<unknown>;
  fields: EducationModuleField[];
  columns: EducationModuleColumn[];
  searchKeys?: string[];
  createLabel?: string;
  formTitle?: string;
  buildBody?: (values: Record<string, string>, branchCode: string) => unknown;
  extras?: ReactNode;
  requireBranch?: boolean;
}): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ""])),
  );

  const listQuery = useQuery({
    queryKey: ["education", resourceKey, branch?.code ?? "org"],
    enabled: Boolean(branch?.code) || !requireBranch,
    queryFn: () => fetchList(branch?.code ?? ""),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createFn) throw new Error("Create API is not available for this module");
      if (requireBranch && !branch?.code) throw new Error("Select a branch first");
      const branchCode = branch?.code ?? "";
      const body =
        buildBody?.(values, branchCode) ??
        (() => {
          const out: Record<string, unknown> = {};
          if (branchCode) out.branchCode = branchCode;
          for (const f of fields) {
            const raw = (values[f.key] ?? "").trim();
            if (!raw && (f.omitIfEmpty !== false)) {
              if (f.required) continue;
              continue;
            }
            if (f.type === "number") out[f.key] = raw === "" ? undefined : Number(raw);
            else out[f.key] = raw || undefined;
          }
          return out;
        })();
      return createFn(body);
    },
    onSuccess: () => {
      invalidate();
      setValues(Object.fromEntries(fields.map((f) => [f.key, ""])));
      setNotice("Saved successfully");
    },
  });

  const filtered = useMemo(() => {
    const list = (listQuery.data ?? []) as Record<string, unknown>[];
    const q = search.trim().toLowerCase();
    if (!q || searchKeys.length === 0) return list;
    return list.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)),
    );
  }, [listQuery.data, search, searchKeys]);

  const requiredOk = fields
    .filter((f) => f.required)
    .every((f) => (values[f.key] ?? "").trim().length > 0);

  const apiMissing = listQuery.isError;
  const apiErrorMsg = listQuery.isError ? (listQuery.error as Error).message : null;
  const createDisabledReason =
    requireBranch && !branch?.code
      ? "Select a branch first"
      : !createFn
        ? "Create API not configured"
        : apiMissing
          ? "API unavailable"
          : !requiredOk
            ? "Fill required fields"
            : createMutation.isPending
              ? "Saving…"
              : null;

  return (
    <div className="space-y-5">
      <PageHeader title={title} subtitle={subtitle} />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {apiErrorMsg ? <div className={noticeErrorClass}>{apiErrorMsg}</div> : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      {createFn ? (
        <EducationFormSection title={formTitle}>
          {fields.map((f) => (
            <EducationField key={f.key} label={f.label} required={f.required}>
              {f.type === "select" ? (
                <EducationSelect
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </EducationSelect>
              ) : f.type === "textarea" ? (
                <EducationInput
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              ) : (
                <EducationInput
                  type={f.type ?? "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              )}
            </EducationField>
          ))}
          <div className="col-span-full flex flex-wrap items-center gap-2">
            <EducationPrimaryButton
              disabled={Boolean(createDisabledReason)}
              title={createDisabledReason ?? undefined}
              onClick={() => {
                setNotice(null);
                createMutation.mutate();
              }}
            >
              {createLabel}
            </EducationPrimaryButton>
            {createDisabledReason && createDisabledReason !== "Fill required fields" ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">{createDisabledReason}</span>
            ) : null}
          </div>
        </EducationFormSection>
      ) : null}

      {extras}

      <div className="flex flex-wrap items-center gap-2">
        <EducationInput
          className="min-w-[12rem] flex-1 sm:max-w-xs"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {filtered.length} / {(listQuery.data ?? []).length}
        </span>
      </div>

      <EducationDataTable
        columns={columns.map((c) => c.label)}
        rows={filtered.map((row) =>
          columns.map((c) => (c.render ? c.render(row) : cellValue(row, c.key))),
        )}
      />
    </div>
  );
}
