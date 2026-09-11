import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  COUNT_STATUSES,
  COUNT_TYPES,
  countsApi,
  type CountScope,
  type CountType,
} from "../../pharmacy/api/pharmacy-inventory";
import { categoriesApi } from "../../pharmacy/api/pharmacy-masters";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import {
  MedicinePicker,
  WarehouseFilter,
  errorMessage,
  formatDate,
  formatDateTime,
  formatQty,
  useCompanyOptions,
  type PickedMedicine,
} from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistKpiCard,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

const ALLOWED: Record<string, { record: boolean; post: boolean; cancel: boolean }> = {
  draft: { record: true, post: false, cancel: true },
  counting: { record: true, post: true, cancel: true },
  review: { record: true, post: true, cancel: true },
  posted: { record: false, post: false, cancel: false },
  cancelled: { record: false, post: false, cancel: false },
};

const NO_ACTIONS = { record: false, post: false, cancel: false };

const STATUS_TONES: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  counting: "warning",
  review: "info",
  posted: "success",
  cancelled: "danger",
};

export function DistributionStockCountPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([
    ["distribution", "stock-counts"],
    ["distribution", "inventory-dashboard"],
    ["distribution", "inventory-stock"],
  ]);

  const [status, setStatus] = useState("");
  const [countType, setCountType] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [linePage, setLinePage] = useState(1);
  const [onlyVariance, setOnlyVariance] = useState(false);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [postReason, setPostReason] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createWarehouse, setCreateWarehouse] = useState("");
  const [createType, setCreateType] = useState<CountType>("cycle");
  const [createNotes, setCreateNotes] = useState("");
  const [scopeCompanyId, setScopeCompanyId] = useState("");
  const [scopeCategoryId, setScopeCategoryId] = useState("");
  const [scopeRack, setScopeRack] = useState("");
  const [scopeMedicines, setScopeMedicines] = useState<PickedMedicine[]>([]);

  const companies = useCompanyOptions();
  const categories = useQuery({
    queryKey: ["distribution", "count-categories"],
    staleTime: 60_000,
    queryFn: () => categoriesApi.list({ page: 1, pageSize: 100, status: "active" }),
  });

  const resetPage = () => setPage(1);

  const list = useQuery({
    queryKey: ["distribution", "stock-counts", branchCode, status, countType, warehouseId, q, page, pageSize],
    enabled: Boolean(branchCode),
    queryFn: () =>
      countsApi.list({
        branchCode: branchCode!,
        status: status || undefined,
        countType: countType || undefined,
        warehouseId: warehouseId || undefined,
        q: q || undefined,
        page,
        pageSize,
      }),
  });

  const detail = useQuery({
    queryKey: ["distribution", "stock-count-detail", branchCode, detailId, linePage, onlyVariance],
    enabled: Boolean(branchCode) && Boolean(detailId),
    queryFn: () =>
      countsApi.detail(detailId!, {
        branchCode: branchCode!,
        page: linePage,
        pageSize: 25,
        onlyVariance: onlyVariance || undefined,
      }),
  });

  const afterMutation = () => {
    setActionError(null);
    invalidate();
    void list.refetch();
    void detail.refetch();
  };

  const onMutationError = (fallback: string) => (e: unknown) => setActionError(errorMessage(e, fallback));

  const create = useMutation({
    mutationFn: () => {
      const scope: CountScope = {};
      if (scopeCompanyId) scope.companyId = scopeCompanyId;
      if (scopeCategoryId) scope.categoryId = scopeCategoryId;
      if (scopeRack.trim()) scope.rackLocation = scopeRack.trim();
      if (scopeMedicines.length) scope.medicineIds = scopeMedicines.map((m) => m.id);
      return countsApi.create({
        branchCode: branchCode!,
        warehouseId: createWarehouse,
        countType: createType,
        notes: createNotes.trim() || undefined,
        scope: createType === "cycle" && Object.keys(scope).length ? scope : undefined,
      });
    },
    onSuccess: (created) => {
      setCreateOpen(false);
      setCreateNotes("");
      setScopeCompanyId("");
      setScopeCategoryId("");
      setScopeRack("");
      setScopeMedicines([]);
      setDetailId(created.id);
      setLinePage(1);
      afterMutation();
    },
    onError: onMutationError("Failed to create the count sheet"),
  });

  const record = useMutation({
    mutationFn: (input: { id: string; lines: { lineId: string; countedQuantity: number }[] }) =>
      countsApi.record(input.id, { branchCode: branchCode!, lines: input.lines }),
    onSuccess: () => {
      setCounted({});
      afterMutation();
    },
    onError: onMutationError("Failed to record the counted quantities"),
  });

  const post = useMutation({
    mutationFn: (id: string) =>
      countsApi.post(id, { branchCode: branchCode!, reason: postReason.trim() || undefined }),
    onSuccess: () => {
      setPostReason("");
      afterMutation();
    },
    onError: onMutationError("Failed to post the count"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      countsApi.cancel(id, { branchCode: branchCode!, reason: cancelReason.trim() }),
    onSuccess: () => {
      setCancelReason("");
      afterMutation();
    },
    onError: onMutationError("Failed to cancel the count"),
  });

  const count = detail.data;
  const allowed = count ? (ALLOWED[count.status] ?? NO_ACTIONS) : NO_ACTIONS;
  const busy = record.isPending || post.isPending || cancel.isPending;

  const pendingEntries = count
    ? count.lines.items
        .filter((line) => {
          const raw = counted[line.id];
          return raw !== undefined && raw !== "" && Number.isFinite(Number(raw)) && Number(raw) >= 0;
        })
        .map((line) => ({ lineId: line.id, countedQuantity: Math.floor(Number(counted[line.id])) }))
    : [];

  return (
    <DistPageShell
      title="Stock count"
      subtitle="Physical and cycle counts. A count never moves stock by itself — posting the variance generates an authorised stock adjustment."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Inventory", to: "/pops/distribution/inventory" },
        { label: "Stock count" },
      ]}
      actions={
        <DistButton
          disabled={!branchCode}
          onClick={() => {
            setActionError(null);
            setCreateOpen(true);
          }}
        >
          + New count sheet
        </DistButton>
      }
      error={!branch ? "Select a branch to load stock counts." : null}
    >
      {list.isError ? (
        <DistErrorBanner
          message={errorMessage(list.error, "Failed to load stock counts")}
          onRetry={() => void list.refetch()}
        />
      ) : null}
      {actionError ? <DistErrorBanner message={actionError} /> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1 min-w-[10rem]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              resetPage();
            }}
          >
            <option value="">All statuses</option>
            {COUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          Count type
          <DistSelect
            className="mt-1 min-w-[9rem]"
            value={countType}
            onChange={(e) => {
              setCountType(e.target.value);
              resetPage();
            }}
          >
            <option value="">All types</option>
            {COUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="text-xs text-slate-500">
          Warehouse
          <WarehouseFilter
            branchCode={branchCode}
            value={warehouseId}
            onChange={(next) => {
              setWarehouseId(next);
              resetPage();
            }}
            className="mt-1 min-w-[12rem]"
          />
        </label>
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 min-w-[12rem]"
            placeholder="Count number or notes…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
          />
        </label>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rowKey={(r) => r.id}
        rows={list.data?.items ?? []}
        empty="No stock counts match these filters"
        onRowClick={(r) => {
          setDetailId(r.id);
          setLinePage(1);
          setCounted({});
          setActionError(null);
        }}
        columns={[
          { key: "countNumber", header: "Number", className: "font-mono text-xs" },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} tone={STATUS_TONES[r.status] ?? "neutral"} />,
          },
          { key: "countType", header: "Type", render: (r) => r.countType },
          { key: "warehouseName", header: "Warehouse", render: (r) => r.warehouseName ?? "—" },
          {
            key: "lineCount",
            header: "Lines",
            className: "text-right tabular-nums",
            render: (r) => formatQty(r.lineCount),
          },
          {
            key: "varianceQuantity",
            header: "Variance qty",
            className: "text-right tabular-nums",
            render: (r) =>
              r.varianceQuantity === 0 ? "—" : (
                <span
                  className={
                    r.varianceQuantity < 0
                      ? "font-semibold text-red-700 dark:text-red-400"
                      : "font-semibold text-emerald-700 dark:text-emerald-400"
                  }
                >
                  {r.varianceQuantity > 0 ? `+${formatQty(r.varianceQuantity)}` : formatQty(r.varianceQuantity)}
                </span>
              ),
          },
          {
            key: "varianceValuePkr",
            header: "Variance value",
            className: "text-right tabular-nums",
            render: (r) => formatPkr(r.varianceValuePkr),
          },
          { key: "createdAt", header: "Created", render: (r) => formatDate(r.createdAt) },
        ]}
      />

      <DistPagination
        page={list.data?.page ?? page}
        pageSize={list.data?.pageSize ?? pageSize}
        total={list.data?.total ?? 0}
        totalPages={list.data?.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          resetPage();
        }}
      />

      <DistMasterDrawer
        open={Boolean(detailId)}
        title={count ? `Count ${count.countNumber}` : "Stock count"}
        subtitle={count ? `${count.countType} · ${count.warehouseName ?? "—"}` : undefined}
        widthClass="max-w-4xl"
        onClose={() => setDetailId(null)}
        footer={
          count ? (
            <>
              {allowed.record ? (
                <DistButton
                  variant="secondary"
                  disabled={busy || pendingEntries.length === 0}
                  onClick={() => record.mutate({ id: count.id, lines: pendingEntries })}
                >
                  Save {pendingEntries.length} counted line{pendingEntries.length === 1 ? "" : "s"}
                </DistButton>
              ) : null}
              {allowed.post ? (
                <DistButton disabled={busy || count.countedLines === 0} onClick={() => post.mutate(count.id)}>
                  Post variance
                </DistButton>
              ) : null}
              {allowed.cancel ? (
                <DistButton
                  variant="ghost"
                  disabled={busy || !cancelReason.trim()}
                  onClick={() => cancel.mutate(count.id)}
                >
                  Cancel count
                </DistButton>
              ) : null}
            </>
          ) : null
        }
      >
        {detail.isError ? (
          <DistErrorBanner
            message={errorMessage(detail.error, "Failed to load the count")}
            onRetry={() => void detail.refetch()}
          />
        ) : detail.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : count ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DistKpiCard label="Lines" value={formatQty(count.lineCount)} />
              <DistKpiCard label="Counted" value={formatQty(count.countedLines)} />
              <DistKpiCard
                label="Uncounted"
                value={formatQty(count.uncountedLines)}
                tone={count.uncountedLines > 0 ? "warning" : "success"}
                hint="Excluded from posting — a skipped line is unknown, not zero"
              />
              <DistKpiCard
                label="Variance value"
                value={formatPkr(count.varianceValuePkr)}
                tone={count.varianceQuantity === 0 ? "success" : "warning"}
                hint={`${formatQty(count.varianceLines)} lines differ · net ${formatQty(count.varianceQuantity)} units`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <DistStatusBadge status={count.status} tone={STATUS_TONES[count.status] ?? "neutral"} />
              <span>Created {formatDateTime(count.createdAt)}</span>
              {count.postedAt ? <span>Posted {formatDateTime(count.postedAt)}</span> : null}
              {count.adjustmentId ? <span>Adjustment {count.adjustmentId}</span> : null}
              {count.notes ? <span>{count.notes}</span> : null}
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={onlyVariance}
                  onChange={(e) => {
                    setOnlyVariance(e.target.checked);
                    setLinePage(1);
                  }}
                />
                Only variance lines
              </label>
            </div>

            {count.scope ? (
              <p className="text-xs text-slate-500">
                Scope: {Object.entries(count.scope).map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : v}`).join(", ")}
              </p>
            ) : null}

            <DistDataTable
              rowKey={(r) => r.id}
              rows={count.lines.items}
              empty={onlyVariance ? "No line has a variance" : "This count sheet has no lines"}
              columns={[
                { key: "medicineSku", header: "SKU", className: "font-mono text-xs" },
                { key: "medicineName", header: "Product" },
                { key: "batchNumber", header: "Batch", render: (r) => r.batchNumber ?? "—" },
                { key: "expiryDate", header: "Expiry", render: (r) => formatDate(r.expiryDate) },
                {
                  key: "systemQuantity",
                  header: "System",
                  className: "text-right tabular-nums",
                  render: (r) => formatQty(r.systemQuantity),
                },
                {
                  key: "countedQuantity",
                  header: "Counted",
                  className: "text-right",
                  render: (r) =>
                    allowed.record ? (
                      <DistInput
                        className="w-24 text-right"
                        type="number"
                        min={0}
                        placeholder={r.counted ? String(r.countedQuantity ?? 0) : "—"}
                        value={counted[r.id] ?? (r.counted ? String(r.countedQuantity ?? 0) : "")}
                        onChange={(e) => setCounted((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      />
                    ) : r.counted ? (
                      formatQty(r.countedQuantity ?? 0)
                    ) : (
                      "Not counted"
                    ),
                },
                {
                  key: "variance",
                  header: "Variance",
                  className: "text-right tabular-nums",
                  render: (r) => {
                    const raw = counted[r.id];
                    const hasEntry = raw !== undefined && raw !== "" && Number.isFinite(Number(raw));
                    if (!hasEntry && !r.counted) return <span className="text-slate-400">—</span>;
                    const variance = hasEntry
                      ? Math.floor(Number(raw)) - r.systemQuantity
                      : r.varianceQuantity;
                    if (variance === 0) return <span className="text-emerald-700 dark:text-emerald-400">0</span>;
                    return (
                      <span
                        className={
                          variance < 0
                            ? "font-semibold text-red-700 dark:text-red-400"
                            : "font-semibold text-emerald-700 dark:text-emerald-400"
                        }
                      >
                        {variance > 0 ? `+${formatQty(variance)}` : formatQty(variance)}
                      </span>
                    );
                  },
                },
                {
                  key: "unitCostPkr",
                  header: "Unit cost",
                  className: "text-right tabular-nums",
                  render: (r) => formatPkr(r.unitCostPkr),
                },
                {
                  key: "varianceValuePkr",
                  header: "Variance value",
                  className: "text-right tabular-nums",
                  render: (r) => (r.counted ? formatPkr(r.varianceValuePkr) : "—"),
                },
              ]}
            />
            <DistPagination
              page={count.lines.page}
              pageSize={count.lines.pageSize}
              total={count.lines.total}
              totalPages={count.lines.totalPages}
              onPageChange={setLinePage}
            />

            {allowed.post ? (
              <section className="space-y-2">
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  {count.uncountedLines > 0 ? (
                    <>
                      <strong>{formatQty(count.uncountedLines)} of {formatQty(count.lineCount)} lines have not
                      been counted.</strong>{" "}
                      They are excluded from posting — an uncounted line is unknown, not zero, and will keep its
                      system quantity.
                    </>
                  ) : (
                    <>Every line has been counted. Posting turns the variance into an authorised stock adjustment.</>
                  )}
                </p>
                <label className="block text-xs text-slate-500">
                  Posting reason (optional — defaults to the count number)
                  <DistInput
                    className="mt-1"
                    value={postReason}
                    onChange={(e) => setPostReason(e.target.value)}
                  />
                </label>
              </section>
            ) : null}

            {allowed.cancel ? (
              <label className="block text-xs text-slate-500">
                Cancellation reason (required)
                <DistInput
                  className="mt-1"
                  value={cancelReason}
                  placeholder="Why is this count being cancelled?"
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </DistMasterDrawer>

      <DistMasterDrawer
        open={createOpen}
        title="New count sheet"
        subtitle="The sheet snapshots current batch quantities. Batches at zero are left out."
        widthClass="max-w-2xl"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <DistButton variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </DistButton>
            <DistButton
              disabled={!branchCode || !createWarehouse || create.isPending}
              onClick={() => create.mutate()}
            >
              Generate sheet
            </DistButton>
          </>
        }
      >
        <div className="space-y-4">
          {create.isError ? (
            <DistErrorBanner message={errorMessage(create.error, "Failed to create the count sheet")} />
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Warehouse
              <WarehouseFilter
                branchCode={branchCode}
                value={createWarehouse}
                onChange={setCreateWarehouse}
                includeAll={false}
                className="mt-1"
              />
            </label>
            <label className="text-xs text-slate-500">
              Count type
              <DistSelect
                className="mt-1"
                value={createType}
                onChange={(e) => setCreateType(e.target.value as CountType)}
              >
                {COUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "full" ? "Full — every batch in the warehouse" : "Cycle — a scoped subset"}
                  </option>
                ))}
              </DistSelect>
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Notes
              <DistInput className="mt-1" value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} />
            </label>
          </div>

          {createType === "cycle" ? (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cycle scope</h3>
              <p className="text-xs text-slate-500">
                Leave everything blank to count the whole warehouse. A scope that produces more than 5,000 lines
                is refused — narrow it and run several cycle counts.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-500">
                  Company
                  <DistSelect
                    className="mt-1"
                    value={scopeCompanyId}
                    onChange={(e) => setScopeCompanyId(e.target.value)}
                  >
                    <option value="">Any company</option>
                    {(companies.data?.items ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </DistSelect>
                </label>
                <label className="text-xs text-slate-500">
                  Category
                  <DistSelect
                    className="mt-1"
                    value={scopeCategoryId}
                    onChange={(e) => setScopeCategoryId(e.target.value)}
                  >
                    <option value="">Any category</option>
                    {(categories.data?.items ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </DistSelect>
                </label>
                <label className="text-xs text-slate-500 sm:col-span-2">
                  Rack location contains
                  <DistInput className="mt-1" value={scopeRack} onChange={(e) => setScopeRack(e.target.value)} />
                </label>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-500">Specific products</span>
                <MedicinePicker
                  branchCode={branchCode}
                  onPick={(m) =>
                    setScopeMedicines((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]))
                  }
                />
                {scopeMedicines.length ? (
                  <div className="flex flex-wrap gap-1">
                    {scopeMedicines.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:border-red-400 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"
                        onClick={() => setScopeMedicines((prev) => prev.filter((p) => p.id !== m.id))}
                      >
                        {m.sku} ✕
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : (
            <p className="text-xs text-slate-500">
              A full count snapshots every batch in the selected warehouse that carries a non-zero quantity.
            </p>
          )}
        </div>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
