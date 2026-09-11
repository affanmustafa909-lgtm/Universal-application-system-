import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  agingDayBucketLabel,
  collectionsApi,
  type RecoveryQueueItem,
} from "../../pharmacy/api/pharmacy-collections-ops";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import {
  DistButton,
  DistDataTable,
  DistInput,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

const DIST = "/pops/distribution";

const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "info", label: "Info" },
  { value: "low", label: "Low" },
];

function priorityTone(p: RecoveryQueueItem["priority"]): "neutral" | "warning" | "danger" | "info" {
  if (p === "critical") return "danger";
  if (p === "warning" || p === "high") return "warning";
  if (p === "info" || p === "low") return "info";
  return "neutral";
}

export function DistributionRecoveryPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const [searchParams, setSearchParams] = useSearchParams();

  const priorityParam = searchParams.get("priority") ?? "";
  const [priority, setPriority] = useState(priorityParam);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPriority(priorityParam);
    setPage(1);
  }, [priorityParam]);

  const recovery = useQuery({
    queryKey: ["distribution", "collections", "recovery", branchCode, priority, debounced, page, pageSize],
    enabled: Boolean(branchCode),
    queryFn: () =>
      collectionsApi.recovery({
        branchCode,
        priority: priority || undefined,
        q: debounced || undefined,
        page,
        pageSize,
      }),
  });

  const rows = recovery.data?.items ?? [];

  return (
    <DistPageShell
      title="Recovery queue"
      subtitle="Prioritized follow-ups — overdue, credit exceeded, bounced cheques, promises."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Collections", to: `${DIST}/collection` },
        { label: "Recovery" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/collection`}>
            <DistButton variant="ghost">Dashboard</DistButton>
          </Link>
          <Link to={`${DIST}/aging?focus=overdue`}>
            <DistButton variant="secondary">Aging overdue</DistButton>
          </Link>
          <Link to={`${DIST}/collections`}>
            <DistButton>Record collection</DistButton>
          </Link>
        </div>
      }
      error={
        !branch
          ? "Select a branch to load recovery."
          : recovery.isError
            ? (recovery.error as Error).message
            : null
      }
      loading={recovery.isLoading && !recovery.data}
    >
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="text-xs text-slate-500">
          Priority
          <DistSelect
            className="mt-1 min-w-[10rem]"
            value={priority}
            onChange={(e) => {
              const next = e.target.value;
              setPriority(next);
              setPage(1);
              const sp = new URLSearchParams(searchParams);
              if (next) sp.set("priority", next);
              else sp.delete("priority");
              setSearchParams(sp, { replace: true });
            }}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 min-w-[14rem]"
            placeholder="Customer, code, reference…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <DistDataTable
        loading={recovery.isLoading}
        rows={rows}
        rowKey={(r) => r.id}
        empty={debounced || priority ? "No recovery items match filters" : "Recovery queue is clear"}
        columns={[
          {
            key: "priority",
            header: "Priority",
            render: (r) => <DistStatusBadge status={r.priority} tone={priorityTone(r.priority)} />,
          },
          {
            key: "kind",
            header: "Kind",
            render: (r) => r.kind ?? (r.bucket ? agingDayBucketLabel(r.bucket) : "—"),
          },
          {
            key: "code",
            header: "Code",
            render: (r) => r.code ?? "—",
          },
          { key: "name", header: "Customer" },
          {
            key: "amount",
            header: "Amount",
            render: (r) => formatPkr(r.outstandingPkr),
          },
          {
            key: "reason",
            header: "Detail",
            render: (r) => r.detail ?? r.reason ?? r.reference ?? "—",
          },
          {
            key: "reference",
            header: "Ref",
            render: (r) => r.reference ?? r.invoiceId ?? r.collectionId ?? r.promiseId ?? "—",
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) =>
              r.tradeCustomerId ? (
                <Link
                  to={`${DIST}/collections?tradeCustomerId=${encodeURIComponent(r.tradeCustomerId)}`}
                  className="text-xs font-semibold text-cyan-700 dark:text-cyan-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  Collect
                </Link>
              ) : (
                "—"
              ),
          },
        ]}
      />

      {recovery.data ? (
        <DistPagination
          page={recovery.data.page}
          pageSize={recovery.data.pageSize}
          total={recovery.data.total}
          totalPages={recovery.data.totalPages}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      ) : null}
    </DistPageShell>
  );
}
