import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  AGING_BUCKET_ORDER,
  agingDayBucketLabel,
  collectionsApi,
  type AgingDayBucket,
} from "../../pharmacy/api/pharmacy-collections-ops";
import { fetchPharmacyAreas } from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import {
  DistButton,
  DistDataTable,
  DistFilterBar,
  DistFilterValues,
  DistKpiCard,
  DistPageShell,
  exportRowsToCsv,
} from "../ui/DistUi";
import { customerDisplayName } from "../lib/customerDisplay";

const DIST = "/pops/distribution";

type BucketFilter = AgingDayBucket | "all" | "overdue";

export function DistributionAgingPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get("focus");
  const bucketParam = searchParams.get("bucket") as BucketFilter | null;

  const [filters, setFilters] = useState<DistFilterValues>({});
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>(() => {
    if (focus === "overdue") return "overdue";
    if (bucketParam && (AGING_BUCKET_ORDER.includes(bucketParam as AgingDayBucket) || bucketParam === "overdue")) {
      return bucketParam;
    }
    return "all";
  });
  const [creditExceededOnly, setCreditExceededOnly] = useState(focus === "creditExceeded");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    if (focus === "overdue") {
      setBucketFilter("overdue");
      setCreditExceededOnly(false);
    } else if (focus === "creditExceeded") {
      setCreditExceededOnly(true);
      setBucketFilter("all");
    }
  }, [focus]);

  useEffect(() => {
    if (bucketParam && (AGING_BUCKET_ORDER.includes(bucketParam as AgingDayBucket) || bucketParam === "overdue")) {
      setBucketFilter(bucketParam);
    }
  }, [bucketParam]);

  const areas = useQuery({ queryKey: ["pharmacy", "areas"], queryFn: fetchPharmacyAreas });

  const aging = useQuery({
    queryKey: [
      "distribution",
      "collections",
      "aging",
      branchCode,
      bucketFilter,
      filters.q,
      filters.areaId,
      creditExceededOnly,
      page,
      pageSize,
    ],
    enabled: Boolean(branchCode),
    queryFn: () =>
      collectionsApi.aging({
        branchCode,
        bucket: bucketFilter,
        q: filters.q,
        areaId: filters.areaId,
        creditExceededOnly: creditExceededOnly || undefined,
        page,
        pageSize,
      }),
  });

  const areaName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of areas.data ?? []) m.set(a.id, a.name);
    return m;
  }, [areas.data]);

  const summary = aging.data?.summary;
  const rows = aging.data?.items.items ?? [];

  function setBucket(next: BucketFilter, credit = false) {
    setBucketFilter(next);
    setCreditExceededOnly(credit);
    setPage(1);
    const sp = new URLSearchParams(searchParams);
    if (credit) {
      sp.set("focus", "creditExceeded");
      sp.delete("bucket");
    } else if (next === "overdue") {
      sp.set("focus", "overdue");
      sp.delete("bucket");
    } else if (next === "all") {
      sp.delete("focus");
      sp.delete("bucket");
    } else {
      sp.delete("focus");
      sp.set("bucket", next);
    }
    setSearchParams(sp, { replace: true });
  }

  return (
    <DistPageShell
      title="Aging / outstanding"
      subtitle="Day-based AR buckets (invoice date + credit days) — not amount-risk thresholds."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Collections", to: `${DIST}/collection` },
        { label: "Aging" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/collection`}>
            <DistButton variant="ghost">Dashboard</DistButton>
          </Link>
          <Link to={`${DIST}/collections`}>
            <DistButton>Record collection</DistButton>
          </Link>
          <Link to={`${DIST}/recovery`}>
            <DistButton variant="secondary">Recovery</DistButton>
          </Link>
        </div>
      }
      error={
        !branch
          ? "Select a branch to load aging."
          : aging.isError
            ? (aging.error as Error).message
            : null
      }
      loading={aging.isLoading && !aging.data}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DistKpiCard
          label="Total outstanding"
          value={formatPkr(summary?.totalOutstandingPkr ?? 0)}
        />
        <DistKpiCard label="Accounts due" value={summary?.accounts ?? 0} />
        <DistKpiCard
          label="Overdue"
          value={formatPkr(summary?.overdueAmountPkr ?? 0)}
          hint={summary?.overdueCustomers ? `${summary.overdueCustomers} customers` : undefined}
          tone={(summary?.overdueAmountPkr ?? 0) > 0 ? "warning" : "default"}
          to={`${DIST}/aging?focus=overdue`}
        />
        <DistKpiCard
          label="Credit exceeded"
          value={summary?.creditExceeded ?? 0}
          tone={(summary?.creditExceeded ?? 0) > 0 ? "danger" : "default"}
          to={`${DIST}/aging?focus=creditExceeded`}
        />
      </div>

      {summary?.byBucket?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {summary.byBucket.map((b) => (
            <DistKpiCard
              key={b.bucket}
              label={agingDayBucketLabel(b.bucket)}
              value={formatPkr(b.amount)}
              hint={b.customers ? `${b.customers} acct` : undefined}
              to={`${DIST}/aging?bucket=${b.bucket}`}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", "All"],
            ["overdue", "Overdue"],
            ...AGING_BUCKET_ORDER.map((b) => [b, agingDayBucketLabel(b)] as const),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setBucket(id as BucketFilter)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              bucketFilter === id && !creditExceededOnly
                ? "bg-cyan-600 text-white"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBucket("all", true)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            creditExceededOnly
              ? "bg-red-600 text-white"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
        >
          Credit exceeded
        </button>
      </div>

      <DistFilterBar
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        areas={areas.data ?? []}
      />

      <DistDataTable
        loading={aging.isLoading}
        rows={rows}
        rowKey={(r) => r.tradeCustomerId}
        empty="No outstanding balances in this bucket"
        onExport={
          rows.length
            ? () =>
                exportRowsToCsv(
                  "aging.csv",
                  [
                    "code",
                    "name",
                    "area",
                    "outstanding",
                    "limit",
                    "bucket",
                    "daysPastDue",
                    "current",
                    "d1_30",
                    "d31_60",
                    "d61_90",
                    "d91_120",
                    "d120_plus",
                  ],
                  rows.map((r) => [
                    r.code ?? "",
                    r.name,
                    r.areaId ? areaName.get(r.areaId) ?? "" : "",
                    r.outstandingPkr,
                    r.creditLimitPkr ?? 0,
                    r.bucket,
                    r.daysPastDue,
                    r.buckets?.current ?? 0,
                    r.buckets?.d1_30 ?? 0,
                    r.buckets?.d31_60 ?? 0,
                    r.buckets?.d61_90 ?? 0,
                    r.buckets?.d91_120 ?? 0,
                    r.buckets?.d120_plus ?? 0,
                  ]),
                )
            : undefined
        }
        columns={[
          { key: "code", header: "Code", render: (r) => r.code ?? "—" },
          { key: "name", header: "Customer", render: (r) => customerDisplayName(r) },
          {
            key: "area",
            header: "Area",
            render: (r) => (r.areaId ? areaName.get(r.areaId) ?? "—" : "—"),
          },
          {
            key: "outstandingPkr",
            header: "Outstanding",
            render: (r) => formatPkr(r.outstandingPkr),
          },
          {
            key: "creditLimitPkr",
            header: "Limit",
            render: (r) => formatPkr(Number(r.creditLimitPkr ?? 0)),
          },
          {
            key: "bucket",
            header: "Worst bucket",
            render: (r) => agingDayBucketLabel(r.bucket),
          },
          {
            key: "daysPastDue",
            header: "DPD",
            render: (r) => (r.daysPastDue > 0 ? `${r.daysPastDue}d` : "—"),
          },
          {
            key: "flags",
            header: "Flags",
            render: (r) =>
              [
                r.overdue ? "Overdue" : null,
                r.creditExceeded ? "Credit+" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—",
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <Link
                to={`${DIST}/collections?tradeCustomerId=${encodeURIComponent(r.tradeCustomerId)}`}
                className="text-xs font-semibold text-cyan-700 dark:text-cyan-400"
                onClick={(e) => e.stopPropagation()}
              >
                Collect
              </Link>
            ),
          },
        ]}
      />

      {aging.data?.items ? (
        <DistPagination
          page={aging.data.items.page}
          pageSize={aging.data.items.pageSize}
          total={aging.data.items.total}
          totalPages={aging.data.items.totalPages}
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
