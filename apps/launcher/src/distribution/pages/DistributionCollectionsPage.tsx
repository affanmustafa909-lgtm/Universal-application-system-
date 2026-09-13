import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  collectionsApi,
  type ChequeStatus,
  type CreateCollectionInput,
} from "../../pharmacy/api/pharmacy-collections-ops";
import { fetchPharmacyTradeCustomers } from "../../pharmacy/api/pharmacy-erp";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import { errorMessage } from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistSelect,
} from "../ui/DistUi";
import { printDistDocument } from "../lib/printDistOrder";
import { customerDisplayName, tradeCustomerNameMap } from "../lib/customerDisplay";

const DIST = "/pops/distribution";

const PAYMENT_METHODS = ["Cash", "Bank", "Cheque", "Card", "Online", "Adjustment"] as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function DistributionCollectionsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([["distribution", "collections"]]);
  const [searchParams] = useSearchParams();

  const customerFromQuery = searchParams.get("tradeCustomerId") ?? searchParams.get("customerId") ?? "";

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [actionError, setActionError] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(Boolean(customerFromQuery));
  const [tradeCustomerId, setTradeCustomerId] = useState(customerFromQuery);
  const [amountPkr, setAmountPkr] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [advance, setAdvance] = useState(false);
  const [allocMap, setAllocMap] = useState<Record<string, number>>({});
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [chequeStatus, setChequeStatus] = useState<ChequeStatus>("pending");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (customerFromQuery) {
      setTradeCustomerId(customerFromQuery);
      setComposerOpen(true);
    }
  }, [customerFromQuery]);

  const list = useQuery({
    queryKey: ["distribution", "collections", "list", branchCode, debounced, page, pageSize, customerFromQuery],
    enabled: Boolean(branchCode),
    queryFn: () =>
      collectionsApi.list({
        branchCode: branchCode!,
        q: debounced || undefined,
        tradeCustomerId: customerFromQuery || undefined,
        page,
        pageSize,
      }),
  });

  const customers = useQuery({
    queryKey: ["pharmacy", "trade-customers", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchPharmacyTradeCustomers(branchCode),
  });

  const custNames = useMemo(
    () => tradeCustomerNameMap((customers.data ?? []) as { id?: string; name?: string | null; code?: string | null }[]),
    [customers.data],
  );

  const openInvoices = useQuery({
    queryKey: ["distribution", "collections", "open-invoices", tradeCustomerId],
    enabled: Boolean(tradeCustomerId) && composerOpen,
    queryFn: () => collectionsApi.openInvoicesForCustomer(tradeCustomerId),
  });

  useEffect(() => {
    setAllocMap({});
    setAdvance(false);
  }, [tradeCustomerId]);

  const allocatedTotal = useMemo(
    () => Object.values(allocMap).reduce((s, n) => s + (Number(n) || 0), 0),
    [allocMap],
  );
  const remainder = Math.round((Number(amountPkr) || 0) * 100 - allocatedTotal * 100) / 100;
  const isCheque = paymentMethod.toLowerCase() === "cheque";

  const canSubmit = useMemo(() => {
    if (!branchCode || !tradeCustomerId || !(amountPkr > 0)) return false;
    if (advance) return allocatedTotal <= amountPkr + 0.009;
    return allocatedTotal > 0 && Math.abs(remainder) < 0.01;
  }, [branchCode, tradeCustomerId, amountPkr, advance, allocatedTotal, remainder]);

  function resetComposer() {
    setTradeCustomerId(customerFromQuery);
    setAmountPkr(0);
    setPaymentMethod("Cash");
    setReference("");
    setNotes("");
    setAdvance(false);
    setAllocMap({});
    setChequeNumber("");
    setChequeBank("");
    setChequeDate("");
    setChequeStatus("pending");
  }

  const createMut = useMutation({
    mutationFn: () => {
      const allocations = Object.entries(allocMap)
        .map(([invoiceId, amt]) => ({ invoiceId, amountPkr: Number(amt) || 0 }))
        .filter((a) => a.amountPkr > 0);

      if (!advance && allocations.length === 0) {
        throw new Error("Allocate to at least one invoice, or mark as advance.");
      }
      if (allocatedTotal > amountPkr + 0.009) {
        throw new Error("Allocated amount cannot exceed collection amount.");
      }
      if (!advance && Math.abs(allocatedTotal - amountPkr) > 0.01) {
        throw new Error("Allocations must equal the collection amount, or enable advance for the remainder.");
      }

      const body: CreateCollectionInput = {
        branchCode: branchCode!,
        tradeCustomerId,
        amountPkr,
        paymentMethod,
        reference: reference || undefined,
        notes: notes || undefined,
        allocations: allocations.length ? allocations : undefined,
        advance: advance || undefined,
      };
      if (isCheque) {
        body.chequeNumber = chequeNumber || undefined;
        body.chequeBank = chequeBank || undefined;
        body.chequeDate = chequeDate || undefined;
        body.chequeStatus = chequeStatus;
      }
      return collectionsApi.create(body);
    },
    onSuccess: () => {
      setActionError(null);
      setComposerOpen(false);
      resetComposer();
      invalidate();
      void list.refetch();
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  function autoFillFifo() {
    let left = Number(amountPkr) || 0;
    const next: Record<string, number> = {};
    for (const inv of openInvoices.data ?? []) {
      if (left <= 0) break;
      const take = Math.min(left, Number(inv.amountDuePkr) || 0);
      if (take > 0) {
        next[inv.id] = take;
        left = Math.round((left - take) * 100) / 100;
      }
    }
    setAllocMap(next);
    setAdvance(left > 0);
  }

  const rows = list.data?.items ?? [];

  return (
    <DistPageShell
      title="Collections"
      subtitle="Multi-invoice receipts — allocate across open invoices or post as advance."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Collections", to: `${DIST}/collection` },
        { label: "List" },
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={`${DIST}/collection`}>
            <DistButton variant="ghost">Dashboard</DistButton>
          </Link>
          <Link to={`${DIST}/aging`}>
            <DistButton variant="secondary">Aging</DistButton>
          </Link>
          <Link to={`${DIST}/recovery`}>
            <DistButton variant="secondary">Recovery</DistButton>
          </Link>
          <DistButton onClick={() => setComposerOpen(true)}>New collection</DistButton>
        </div>
      }
      error={!branch ? "Select a branch to load collections." : null}
    >
      {actionError ? <DistErrorBanner message={actionError} onRetry={() => setActionError(null)} /> : null}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <label className="text-xs text-slate-500">
          Search
          <DistInput
            className="mt-1 min-w-[14rem]"
            placeholder="Collection #, customer, reference…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <DistDataTable
        loading={list.isLoading}
        rows={rows}
        rowKey={(r) => r.id}
        empty={debounced ? "No collections match filters" : "No collections yet"}
        columns={[
          { key: "collectionNumber", header: "Collection#" },
          {
            key: "customer",
            header: "Customer",
            render: (r) => customerDisplayName(r, custNames),
          },
          {
            key: "amountPkr",
            header: "Amount",
            render: (r) => formatPkr(Number(r.amountPkr ?? 0)),
          },
          {
            key: "paymentMethod",
            header: "Method",
            render: (r) => r.paymentMethod ?? "—",
          },
          {
            key: "invoice",
            header: "Invoice / alloc",
            render: (r) => {
              if (r.allocations?.length) {
                return r.allocations
                  .map((a) => `${a.invoiceNumber ?? a.invoiceId}: ${formatPkr(a.amountPkr)}`)
                  .join("; ");
              }
              return r.invoiceNumber ?? r.invoiceId ?? "—";
            },
          },
          {
            key: "collectedAt",
            header: "When",
            render: (r) => {
              const d = r.collectedAt ?? r.createdAt;
              return d ? new Date(d).toLocaleString() : "—";
            },
          },
          {
            key: "actions",
            header: "Print",
            render: (r) => (
              <button
                type="button"
                className="text-xs font-semibold text-cyan-700 dark:text-cyan-400"
                onClick={(e) => {
                  e.stopPropagation();
                  void printDistDocument({
                    title: "Collection receipt",
                    documentNumber: String(r.collectionNumber ?? r.id),
                    partyLabel: "Customer",
                    partyName: customerDisplayName(r, custNames),
                    meta: [
                      { label: "Method", value: String(r.paymentMethod ?? "—") },
                      {
                        label: "When",
                        value: r.collectedAt || r.createdAt
                          ? new Date(String(r.collectedAt ?? r.createdAt)).toLocaleString()
                          : "—",
                      },
                      { label: "Reference", value: String(r.referenceNo ?? r.chequeNumber ?? "—") },
                    ],
                    lines:
                      (r.allocations ?? []).length > 0
                        ? (r.allocations ?? []).map((a) => ({
                            label: String(a.invoiceNumber ?? a.invoiceId ?? "Invoice"),
                            qty: 1,
                            unitPrice: Number(a.amountPkr ?? 0),
                          }))
                        : [
                            {
                              label: "Receipt amount",
                              qty: 1,
                              unitPrice: Number(r.amountPkr ?? 0),
                            },
                          ],
                    totalPkr: Number(r.amountPkr ?? 0),
                    footerNote: "Official collection receipt — distribution",
                  }).catch((err) => setActionError(errorMessage(err, "Print failed")));
                }}
              >
                Print
              </button>
            ),
          },
        ]}
      />

      {list.data ? (
        <DistPagination
          page={list.data.page}
          pageSize={list.data.pageSize}
          total={list.data.total}
          totalPages={list.data.totalPages}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      ) : null}

      <DistMasterDrawer
        open={composerOpen}
        title="Compose collection"
        subtitle="Allocate across invoices or mark advance. Bare amounts are rejected."
        widthClass="max-w-xl"
        onClose={() => !createMut.isPending && setComposerOpen(false)}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              Allocated {formatPkr(allocatedTotal)}
              {amountPkr > 0 ? ` / ${formatPkr(amountPkr)}` : ""}
              {remainder !== 0 && amountPkr > 0 ? ` · rem ${formatPkr(remainder)}` : ""}
            </div>
            <DistButton
              disabled={createMut.isPending || !canSubmit}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Posting…" : "Post collection"}
            </DistButton>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Customer">
            <DistSelect
              value={tradeCustomerId}
              onChange={(e) => setTradeCustomerId(e.target.value)}
              required
            >
              <option value="">Select customer</option>
              {(customers.data ?? []).map((c: { id: string; name: string; code?: string; outstandingPkr?: number }) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} — ` : ""}
                  {c.name} ({formatPkr(Number(c.outstandingPkr ?? 0))})
                </option>
              ))}
            </DistSelect>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount (PKR)">
              <DistInput
                type="number"
                min={1}
                value={amountPkr || ""}
                onChange={(e) => setAmountPkr(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Method">
              <DistSelect value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </DistSelect>
            </Field>
          </div>

          <Field label="Reference">
            <DistInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Notes">
            <DistInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </Field>

          {isCheque ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cheque details</p>
              <Field label="Cheque number">
                <DistInput value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
              </Field>
              <Field label="Bank">
                <DistInput value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Cheque date">
                  <DistInput
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <DistSelect
                    value={chequeStatus}
                    onChange={(e) => setChequeStatus(e.target.value as ChequeStatus)}
                  >
                    <option value="pending">Pending</option>
                    <option value="deposited">Deposited</option>
                    <option value="cleared">Cleared</option>
                    <option value="bounced">Bounced</option>
                    <option value="cancelled">Cancelled</option>
                  </DistSelect>
                </Field>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={advance}
                onChange={(e) => setAdvance(e.target.checked)}
              />
              Advance (hold unallocated — does not reduce outstanding until allocated)
            </label>
            <DistButton
              variant="ghost"
              disabled={!amountPkr || !(openInvoices.data?.length)}
              onClick={autoFillFifo}
            >
              Auto-allocate FIFO
            </DistButton>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Open invoices</p>
            {!tradeCustomerId ? (
              <p className="text-xs text-slate-500">Select a customer to load open invoices.</p>
            ) : openInvoices.isLoading ? (
              <p className="text-xs text-slate-500">Loading invoices…</p>
            ) : openInvoices.isError ? (
              <p className="text-xs text-red-600">{errorMessage(openInvoices.error)}</p>
            ) : !(openInvoices.data?.length) ? (
              <p className="text-xs text-slate-500">
                No open invoices — use Advance to post unallocated cash.
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {openInvoices.data.map((inv) => (
                  <div
                    key={inv.id}
                    className="grid grid-cols-[1fr_6rem] items-center gap-2 rounded border border-slate-100 px-2 py-1.5 dark:border-slate-800"
                  >
                    <div className="min-w-0 text-xs">
                      <div className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-slate-500">
                        Due {formatPkr(inv.amountDuePkr)}
                        {inv.invoiceDate
                          ? ` · ${new Date(inv.invoiceDate).toLocaleDateString()}`
                          : ""}
                      </div>
                    </div>
                    <DistInput
                      type="number"
                      min={0}
                      max={inv.amountDuePkr}
                      className="text-right"
                      value={allocMap[inv.id] ?? ""}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        setAllocMap((prev) => {
                          const next = { ...prev };
                          if (v <= 0) delete next[inv.id];
                          else next[inv.id] = Math.min(v, inv.amountDuePkr);
                          return next;
                        });
                      }}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DistMasterDrawer>
    </DistPageShell>
  );
}
