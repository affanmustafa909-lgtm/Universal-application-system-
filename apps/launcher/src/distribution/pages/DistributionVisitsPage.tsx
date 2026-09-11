import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fieldForceApi } from "../../pharmacy/api/pharmacy-field-force";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

const DIST = "/pops/distribution";
const OUTCOMES = [
  ["order_taken", "Order taken"],
  ["collection_received", "Collection received"],
  ["order_and_collection", "Order + collection"],
  ["follow_up_required", "Follow-up required"],
  ["customer_not_available", "Not available"],
  ["no_order", "No order"],
  ["other", "Other"],
] as const;

export function DistributionVisitsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([["distribution", "field-force"]]);
  const [sp, setSp] = useSearchParams();
  const date = sp.get("date") ?? new Date().toISOString().slice(0, 10);
  const status = sp.get("status") ?? "";
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<Record<string, unknown> | null>(null);
  const [outcome, setOutcome] = useState("order_taken");
  const [notes, setNotes] = useState("");
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");

  const list = useQuery({
    queryKey: ["distribution", "field-force", "visits", branch?.code, date, status, page],
    enabled: Boolean(branch?.code),
    queryFn: () =>
      fieldForceApi.visits({
        branchCode: branch!.code,
        date,
        status: status || undefined,
        page,
        pageSize: 25,
      }),
  });

  const rows = useMemo(() => (list.data?.items ?? []) as Record<string, unknown>[], [list.data]);

  const startMut = useMutation({
    mutationFn: (id: string) => fieldForceApi.startVisit(id, {}),
    onSuccess: () => invalidate(),
    onError: (e: Error) => setErr(e.message),
  });
  const completeMut = useMutation({
    mutationFn: () =>
      fieldForceApi.completeVisit(String(active!.id), {
        outcome,
        notes,
        followUpRequired: outcome === "follow_up_required",
        followUpDate: outcome === "follow_up_required" ? newDate || date : undefined,
      }),
    onSuccess: () => {
      setActive(null);
      invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });
  const missMut = useMutation({
    mutationFn: (id: string) => fieldForceApi.missVisit(id, reason || "missed"),
    onSuccess: () => invalidate(),
    onError: (e: Error) => setErr(e.message),
  });
  const reschedMut = useMutation({
    mutationFn: () => fieldForceApi.rescheduleVisit(String(active!.id), { newDate, reason: reason || "reschedule" }),
    onSuccess: () => {
      setActive(null);
      invalidate();
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <DistPageShell
      title="Visits"
      subtitle="Today's planned visits and searchable history. Server-filtered — never loads the full archive."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Field Force", to: `${DIST}/field-force` },
        { label: "Visits" },
      ]}
      actions={
        <Link to={`${DIST}/pjp`}>
          <DistButton variant="secondary">Generate from PJP</DistButton>
        </Link>
      }
    >
      {err ? <DistErrorBanner message={err} onRetry={() => setErr(null)} /> : null}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="text-xs text-slate-500">
          Date
          <DistInput
            type="date"
            className="mt-1"
            value={date}
            onChange={(e) => {
              const next = new URLSearchParams(sp);
              next.set("date", e.target.value);
              setSp(next, { replace: true });
              setPage(1);
            }}
          />
        </label>
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1 min-w-[10rem]"
            value={status}
            onChange={(e) => {
              const next = new URLSearchParams(sp);
              if (e.target.value) next.set("status", e.target.value);
              else next.delete("status");
              setSp(next, { replace: true });
              setPage(1);
            }}
          >
            <option value="">All</option>
            {["planned", "started", "completed", "missed", "cancelled", "rescheduled"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </DistSelect>
        </label>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rows={rows}
        rowKey={(r) => String(r.id)}
        empty="No visits for this filter"
        columns={[
          { key: "visitNumber", header: "Visit#" },
          { key: "customerName", header: "Customer", render: (r) => String(r.customerName ?? "—") },
          { key: "employeeName", header: "Salesman", render: (r) => String(r.employeeName ?? "—") },
          { key: "status", header: "Status", render: (r) => <DistStatusBadge status={String(r.status)} /> },
          { key: "outcome", header: "Outcome", render: (r) => String(r.outcome ?? "—").replace(/_/g, " ") },
          {
            key: "outstandingPkr",
            header: "Outstanding",
            render: (r) => formatPkr(Number(r.outstandingPkr ?? 0)),
          },
          {
            key: "actions",
            header: "",
            render: (r) => {
              const st = String(r.status);
              return (
                <div className="flex flex-wrap gap-1">
                  {st === "planned" ? (
                    <DistButton variant="secondary" onClick={() => startMut.mutate(String(r.id))}>
                      Start
                    </DistButton>
                  ) : null}
                  {st === "planned" || st === "started" ? (
                    <DistButton onClick={() => setActive(r)}>Complete</DistButton>
                  ) : null}
                  {st === "planned" ? (
                    <DistButton variant="ghost" onClick={() => missMut.mutate(String(r.id))}>
                      Miss
                    </DistButton>
                  ) : null}
                  {r.tradeCustomerId ? (
                    <Link className="text-xs font-semibold text-cyan-700" to={`${DIST}/orders?customer=${String(r.tradeCustomerId)}`}>
                      Order
                    </Link>
                  ) : null}
                  {r.tradeCustomerId ? (
                    <Link className="text-xs font-semibold text-cyan-700" to={`${DIST}/collections?customer=${String(r.tradeCustomerId)}`}>
                      Collect
                    </Link>
                  ) : null}
                </div>
              );
            },
          },
        ]}
      />
      <DistPagination page={page} pageSize={25} total={list.data?.total ?? 0} onPageChange={setPage} />

      <DistMasterDrawer open={Boolean(active)} title="Complete visit" onClose={() => setActive(null)}>
        <label className="block text-xs text-slate-500">
          Outcome
          <DistSelect className="mt-1" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {OUTCOMES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </DistSelect>
        </label>
        <label className="mt-2 block text-xs text-slate-500">
          Notes
          <DistInput className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="mt-2 block text-xs text-slate-500">
          Reschedule / follow-up date
          <DistInput type="date" className="mt-1" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </label>
        <label className="mt-2 block text-xs text-slate-500">
          Reason
          <DistInput className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="mt-3 flex gap-2">
          <DistButton onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
            Complete
          </DistButton>
          <DistButton variant="secondary" onClick={() => reschedMut.mutate()} disabled={!newDate || reschedMut.isPending}>
            Reschedule
          </DistButton>
        </div>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
