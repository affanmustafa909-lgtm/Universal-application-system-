import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ioApi } from "../../pharmacy/api/pharmacy-io";
import { DistDataTable, DistPageShell } from "../ui/DistUi";
import { DistPagination } from "../components/DistPagination";
import { looksLikeUuid } from "../lib/customerDisplay";

function friendlyModule(entityType: unknown): string {
  const raw = String(entityType ?? "").trim();
  if (!raw) return "—";
  return raw
    .replace(/^pharmacy_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayLabel(
  preferred?: unknown,
  fallback?: unknown,
): string {
  const pref = preferred != null ? String(preferred).trim() : "";
  if (pref && !looksLikeUuid(pref)) return pref;
  const fb = fallback != null ? String(fallback).trim() : "";
  if (fb && !looksLikeUuid(fb)) return fb;
  return "—";
}

function formatWhen(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

export function DistributionAuditPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const audit = useQuery({
    queryKey: ["distribution", "audit", page],
    queryFn: () => ioApi.audit(page),
  });

  return (
    <DistPageShell
      title="Audit log"
      subtitle="Creates, updates, imports, and inventory documents. Posted journals are reversed, not edited."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Administration", to: "/pops/distribution/admin" },
        { label: "Audit" },
      ]}
    >
      <DistDataTable
        columns={[
          {
            key: "createdAt",
            header: "When",
            render: (r) => formatWhen(r.createdAt),
          },
          {
            key: "action",
            header: "Action",
            render: (r) => String(r.action ?? "—"),
          },
          {
            key: "entityType",
            header: "Module",
            render: (r) => friendlyModule(r.entityType),
          },
          {
            key: "entityId",
            header: "Record",
            render: (r) =>
              displayLabel(r.entityLabel ?? r.recordLabel, r.entityId),
          },
          {
            key: "reason",
            header: "Reason",
            render: (r) => {
              const reason = r.reason != null ? String(r.reason).trim() : "";
              return reason && !looksLikeUuid(reason) ? reason : "—";
            },
          },
          {
            key: "userId",
            header: "User",
            render: (r) =>
              displayLabel(r.userLabel ?? r.userDisplay ?? r.userName ?? r.userEmail, r.userId),
          },
        ]}
        rows={(audit.data?.items ?? []) as Array<Record<string, unknown>>}
        rowKey={(r) => String(r.id)}
        loading={audit.isLoading}
        empty="No audit rows yet."
      />
      <DistPagination
        page={page}
        pageSize={audit.data?.pageSize ?? 50}
        total={audit.data?.total ?? 0}
        onPageChange={setPage}
      />
    </DistPageShell>
  );
}
