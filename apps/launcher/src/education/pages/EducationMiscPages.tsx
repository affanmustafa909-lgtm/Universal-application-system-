import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationDocumentTemplate,
  createEducationNotice,
  fetchEducationAuditLogs,
  fetchEducationDocumentTemplates,
  fetchEducationNotices,
  fetchEducationReport,
  fetchEducationSettings,
  fetchEducationStudents,
  generateEducationDocument,
  upsertEducationSetting,
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

export function EducationCommunicationPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [audienceCode, setAudienceCode] = useState("");
  const [status, setStatus] = useState<"draft" | "scheduled" | "published" | "archived">("draft");

  const noticesQuery = useQuery({
    queryKey: ["education", "notices", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationNotices(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationNotice({
        branchCode: branch!.code,
        title: title.trim(),
        body: body.trim(),
        categoryCode: categoryCode.trim() || undefined,
        audienceCode: audienceCode.trim() || undefined,
        status,
        publishAt: status === "published" ? new Date().toISOString() : undefined,
      }),
    onSuccess: () => {
      invalidate();
      setTitle("");
      setBody("");
      setNotice("Notice saved");
    },
  });

  const filtered = useMemo(() => {
    const list = noticesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [noticesQuery.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Communication" subtitle="Notices and campus announcements." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {noticesQuery.isError ? (
        <div className={noticeErrorClass}>{(noticesQuery.error as Error).message}</div>
      ) : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New notice">
        <EducationField label="Title" required>
          <EducationInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </EducationField>
        <EducationField label="Category">
          <EducationInput value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} />
        </EducationField>
        <EducationField label="Audience">
          <EducationInput value={audienceCode} onChange={(e) => setAudienceCode(e.target.value)} />
        </EducationField>
        <EducationField label="Status">
          <EducationSelect
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </EducationSelect>
        </EducationField>
        <EducationField label="Body" required>
          <EducationInput value={body} onChange={(e) => setBody(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !title.trim() ||
              !body.trim() ||
              noticesQuery.isError ||
              createMutation.isPending
            }
            title={noticesQuery.isError ? "Notices API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Save notice
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search notices…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <EducationDataTable
        columns={["Title", "Audience", "Category", "Status", "Published"]}
        rows={filtered.map((n) => [
          n.title,
          n.audienceCode ?? "—",
          n.categoryCode ?? "—",
          n.status,
          n.publishAt?.slice(0, 10) ?? "—",
        ])}
      />
    </div>
  );
}

export function EducationDocumentsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [documentTypeCode, setDocumentTypeCode] = useState("certificate");
  const [bodyHtml, setBodyHtml] = useState("<p>{{studentName}}</p>");
  const [templateId, setTemplateId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [genTitle, setGenTitle] = useState("");

  const templatesQuery = useQuery({
    queryKey: ["education", "document-templates", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationDocumentTemplates(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createEducationDocumentTemplate({
        branchCode: branch!.code,
        name: name.trim(),
        documentTypeCode: documentTypeCode.trim() || "certificate",
        bodyHtml: bodyHtml.trim(),
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setName("");
      setNotice("Template saved");
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateEducationDocument({
        branchCode: branch!.code,
        templateId,
        studentId: studentId || undefined,
        title: genTitle.trim() || name || "Generated document",
        status: "generated",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Document generated");
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        subtitle="Document templates and generate certificates / letters."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {templatesQuery.isError ? (
        <div className={noticeErrorClass}>{(templatesQuery.error as Error).message}</div>
      ) : null}
      {createMutation.isError ? (
        <div className={noticeErrorClass}>{(createMutation.error as Error).message}</div>
      ) : null}
      {generateMutation.isError ? (
        <div className={noticeErrorClass}>{(generateMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New template">
        <EducationField label="Name" required>
          <EducationInput value={name} onChange={(e) => setName(e.target.value)} />
        </EducationField>
        <EducationField label="Document type">
          <EducationInput
            value={documentTypeCode}
            onChange={(e) => setDocumentTypeCode(e.target.value)}
          />
        </EducationField>
        <EducationField label="Body HTML" required>
          <EducationInput value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !name.trim() ||
              !bodyHtml.trim() ||
              templatesQuery.isError ||
              createMutation.isPending
            }
            title={templatesQuery.isError ? "Templates API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createMutation.mutate();
            }}
          >
            Save template
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Generate document">
        <EducationField label="Template" required>
          <EducationSelect value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">—</option>
            {(templatesQuery.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Student">
          <EducationSelect value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">—</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName ?? ""}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Document title">
          <EducationInput value={genTitle} onChange={(e) => setGenTitle(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!templateId || generateMutation.isPending}
            onClick={() => {
              setNotice(null);
              generateMutation.mutate();
            }}
          >
            Generate
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationDataTable
        columns={["Name", "Type", "Status", "Updated"]}
        rows={(templatesQuery.data ?? []).map((t) => [
          t.name,
          t.documentTypeCode,
          t.status,
          t.updatedAt?.slice(0, 10) ?? "—",
        ])}
      />
    </div>
  );
}

const REPORT_KEYS = [
  { key: "students", label: "Students report" },
  { key: "attendance", label: "Attendance report" },
  { key: "fees", label: "Fees report" },
  { key: "exams", label: "Exams report" },
  { key: "finance", label: "Finance report" },
  { key: "payroll", label: "Payroll report" },
] as const;

export function EducationReportsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const auditQuery = useQuery({
    queryKey: ["education", "audit-logs", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationAuditLogs(branch!.code),
  });

  const loadReport = async (key: string) => {
    if (!branch?.code) {
      setError("Select a branch first");
      return;
    }
    setLoading(true);
    setError(null);
    setActiveKey(key);
    try {
      const data = await fetchEducationReport(key, branch.code);
      setPayload(data);
    } catch (e) {
      setPayload(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Academic, fee, and operational report center. Also shows recent audit logs."
      />
      {!branch?.code ? (
        <div className={noticeErrorClass}>Select a branch to fetch reports.</div>
      ) : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        {REPORT_KEYS.map((r) => (
          <EducationSecondaryButton
            key={r.key}
            disabled={!branch?.code || loading}
            onClick={() => void loadReport(r.key)}
          >
            {r.label}
          </EducationSecondaryButton>
        ))}
      </div>

      {loading ? <p className="text-sm text-slate-500 dark:text-slate-400">Loading report…</p> : null}
      {activeKey && payload != null ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
            Report: {activeKey}
          </h3>
          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </section>
      ) : null}

      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Audit logs</h3>
      {auditQuery.isError ? (
        <div className={noticeErrorClass}>{(auditQuery.error as Error).message}</div>
      ) : null}
      <EducationDataTable
        columns={["When", "Action", "Module", "Record", "Detail"]}
        rows={(auditQuery.data ?? []).map((a) => [
          a.createdAt?.slice(0, 19) ?? "—",
          a.action ?? "—",
          a.moduleKey ?? "—",
          a.recordId ?? "—",
          a.detail ?? "—",
        ])}
      />
    </div>
  );
}

export function EducationSettingsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [valueJson, setValueJson] = useState("{}");

  const settingsQuery = useQuery({
    queryKey: ["education", "settings", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSettings(branch!.code),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertEducationSetting({
        branchCode: branch!.code,
        key: key.trim(),
        valueJson: valueJson.trim() || "{}",
      }),
    onSuccess: () => {
      invalidate(["settings"]);
      setKey("");
      setValueJson("{}");
      setNotice("Setting saved");
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Education settings"
        subtitle="Institution key/value settings for EducationFlow. Manage modules and lookups from Control Center."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pops/education/control-center"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Control Center
            </Link>
            <Link
              to="/pops/education/lookups"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Lookups
            </Link>
          </div>
        }
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {settingsQuery.isError ? (
        <div className={noticeErrorClass}>{(settingsQuery.error as Error).message}</div>
      ) : null}
      {saveMutation.isError ? (
        <div className={noticeErrorClass}>{(saveMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="Upsert setting">
        <EducationField label="Key" required>
          <EducationInput value={key} onChange={(e) => setKey(e.target.value)} placeholder="institution.name" />
        </EducationField>
        <EducationField label="Value JSON" required>
          <EducationInput value={valueJson} onChange={(e) => setValueJson(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code || !key.trim() || settingsQuery.isError || saveMutation.isPending
            }
            title={
              !branch?.code
                ? "Select a branch first"
                : settingsQuery.isError
                  ? "Settings API unavailable"
                  : undefined
            }
            onClick={() => {
              setNotice(null);
              saveMutation.mutate();
            }}
          >
            Save setting
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationDataTable
        columns={["Key", "Value", "Updated"]}
        rows={(settingsQuery.data ?? []).map((s) => [
          s.key,
          s.valueJson,
          s.updatedAt?.slice(0, 19) ?? "—",
        ])}
      />
    </div>
  );
}
