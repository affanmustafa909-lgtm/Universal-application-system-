import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ioApi } from "../../pharmacy/api/pharmacy-io";
import { DistDataTable, DistFilterBar, DistFilterValues, DistPageShell } from "../ui/DistUi";
import { DistPagination } from "../components/DistPagination";
import { filterDistRows } from "../lib/distListFilters";
import { looksLikeUuid } from "../lib/customerDisplay";

function friendlyModule(entityType: unknown): string {
  const raw = String(entityType ?? "").trim();
  if (!raw) return "—";
  return raw
    .replace(/^pharmacy_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayLabel(preferred?: unknown, fallback?: unknown): string {
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
  const [filters, setFilters] = useState<DistFilterValues>({ preset: "30d" });
  const audit = useQuery({
    queryKey: ["distribution", "audit", page],
    queryFn: () => ioApi.audit(page),
  });

  const rows = useMemo(() => {
    const items = (audit.data?.items ?? []) as Array<Record<string, unknown>>;
    return filterDistRows(items, filters, {
      dateFields: ["createdAt"],
      searchFields: [
        "action",
        "entityType",
        "entityId",
        "entityLabel",
        "recordLabel",
        "reason",
        "userLabel",
        "userName",
        "userEmail",
      ],
      statusField: "action",
    });
  }, [audit.data, filters]);

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
      <DistFilterBar
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        showTime
        searchPlaceholder="Action, module, record, user…"
        statusOptions={[
          { value: "create", label: "Create" },
          { value: "update", label: "Update" },
          { value: "delete", label: "Delete" },
          { value: "import", label: "Import" },
          { value: "status", label: "Status change" },
        ]}
        qualityOptions={[
          { value: "critical", label: "Critical / delete" },
          { value: "warning", label: "Updates" },
          { value: "info", label: "Creates / imports" },
        ]}
      />

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
            render: (r) => displayLabel(r.entityLabel ?? r.recordLabel, r.entityId),
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
        rows={
          filters.quality
            ? rows.filter((r) => {
                const a = String(r.action ?? "").toLowerCase();
                if (filters.quality === "critical") return a.includes("delete") || a.includes("void");
                if (filters.quality === "warning") return a.includes("update") || a.includes("status");
                if (filters.quality === "info")
                  return a.includes("create") || a.includes("import") || a.includes("post");
                return true;
              })
            : rows
        }
        rowKey={(r) => String(r.id)}
        loading={audit.isLoading}
        empty="No audit rows match filters."
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
