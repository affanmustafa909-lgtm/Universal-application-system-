import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import { fetchEducationAuditLogs, pingEducationApi } from "../api/education";
import { useEducationAccess } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationPrimaryButton,
  EducationSecondaryButton,
  EducationStatCard,
} from "../ui/EducationUi";

export function EducationSystemHealthPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    ok: boolean;
    latencyMs: number;
    message?: string;
  } | null>(null);

  const auditQuery = useQuery({
    queryKey: ["education", "audit-logs", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationAuditLogs(branch!.code),
  });

  const runPing = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const result = await pingEducationApi();
      setPingResult(result);
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="System health"
        subtitle="API health ping and recent EducationFlow audit activity."
        actions={
          <div className="flex flex-wrap gap-2">
            <EducationPrimaryButton disabled={pinging} onClick={() => void runPing()}>
              {pinging ? "Pinging…" : "Ping API"}
            </EducationPrimaryButton>
            <EducationSecondaryButton
              disabled={auditQuery.isFetching}
              onClick={() => void auditQuery.refetch()}
            >
              Refresh audit logs
            </EducationSecondaryButton>
          </div>
        }
      />

      {pingResult ? (
        pingResult.ok ? (
          <div className={noticeSuccessClass}>
            Education API healthy — {pingResult.latencyMs} ms
          </div>
        ) : (
          <div className={noticeErrorClass}>
            Education API unreachable ({pingResult.latencyMs} ms)
            {pingResult.message ? `: ${pingResult.message}` : ""}
          </div>
        )
      ) : null}

      {auditQuery.isError ? (
        <div className={noticeErrorClass}>{(auditQuery.error as Error).message}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <EducationStatCard
          label="API status"
          value={pingResult ? (pingResult.ok ? "OK" : "Down") : "—"}
          tone={pingResult ? (pingResult.ok ? "success" : "danger") : "default"}
        />
        <EducationStatCard
          label="Latency"
          value={pingResult ? `${pingResult.latencyMs} ms` : "—"}
          tone={
            pingResult && pingResult.ok
              ? pingResult.latencyMs > 1000
                ? "warning"
                : "success"
              : "default"
          }
        />
        <EducationStatCard
          label="Audit entries"
          value={auditQuery.data?.length ?? (branch?.code ? "…" : "—")}
        />
      </div>

      {!branch?.code ? (
        <div className={noticeErrorClass}>Select a branch to load audit logs.</div>
      ) : null}

      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent audit logs</h3>
      <EducationDataTable
        columns={["When", "Action", "Module", "Record", "Detail"]}
        rows={(auditQuery.data ?? []).slice(0, 100).map((log) => [
          String(log.createdAt ?? "").slice(0, 19).replace("T", " ") || "—",
          log.action ?? "—",
          log.moduleKey ?? "—",
          log.recordId ? String(log.recordId).slice(0, 8) : "—",
          log.detail ?? "—",
        ])}
      />
    </div>
  );
}
