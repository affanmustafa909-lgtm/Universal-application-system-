import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { purchaseApi } from "../../pharmacy/api/pharmacy-purchase";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistPagination } from "../components/DistPagination";
import { errorMessage, formatDate } from "../components/DistInventoryShared";
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

export function DistributionPurchaseInvoicesPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;
  const invalidate = useInvalidatePharmacy([["distribution", "purchase"]]);

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [grnId, setGrnId] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const list = useQuery({
    queryKey: ["distribution", "purchase", "invoices", branchCode, status, page],
    enabled: Boolean(branchCode),
    queryFn: () =>
      purchaseApi.listInvoices({
        branchCode: branchCode!,
        status: status || undefined,
        page,
        pageSize: 25,
      }),
  });

  const grns = useQuery({
    queryKey: ["distribution", "purchase", "invoice-grns", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => purchaseApi.listGrns({ branchCode: branchCode!, page: 1, pageSize: 50 }),
  });

  const selectedGrn = (grns.data?.items ?? []).find((g) => g.id === grnId);

  const create = useMutation({
    mutationFn: () => {
      if (!selectedGrn?.supplierId) {
        throw new Error("Selected GRN has no supplier — cannot create invoice");
      }
      return purchaseApi.createInvoice({
        branchCode: branchCode!,
        supplierId: selectedGrn.supplierId,
        grnId,
        purchaseOrderId: selectedGrn.purchaseOrderId ?? undefined,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
        invoiceDate,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        post: true,
      });
    },
    onSuccess: () => {
      setActionError(null);
      setGrnId("");
      setSupplierInvoiceNumber("");
      setNotes("");
      invalidate();
      void list.refetch();
    },
    onError: (e) => setActionError(errorMessage(e, "Failed to create invoice")),
  });

  return (
    <DistPageShell
      title="Purchase invoices"
      subtitle="Documentary three-way match against GRN. AP already posts at GRN via JV — invoices here do not double-post by default."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Purchases", to: `${DIST}/purchase` },
        { label: "Invoices" },
      ]}
      actions={
        <Link to={`${DIST}/purchase-grn`}>
          <DistButton variant="secondary">GRN register</DistButton>
        </Link>
      }
      error={!branch ? "Select a branch." : null}
    >
      {actionError ? <DistErrorBanner message={actionError} /> : null}

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <h2 className="text-sm font-semibold">Create from GRN</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-500">
            GRN
            <DistSelect className="mt-1" value={grnId} onChange={(e) => setGrnId(e.target.value)}>
              <option value="">Select GRN…</option>
              {(grns.data?.items ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.grnNumber} · {formatPkr(g.totalPkr)}
                </option>
              ))}
            </DistSelect>
          </label>
          <label className="text-xs text-slate-500">
            Supplier invoice #
            <DistInput
              className="mt-1"
              value={supplierInvoiceNumber}
              onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-500">
            Invoice date
            <DistInput
              type="date"
              className="mt-1"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-500">
            Due date
            <DistInput
              type="date"
              className="mt-1"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            Notes
            <DistInput className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <DistButton
          disabled={!grnId || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Saving…" : "Create invoice"}
        </DistButton>
      </section>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Status
          <DistSelect
            className="mt-1 block min-w-[10rem]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="cancelled">Cancelled</option>
          </DistSelect>
        </label>
      </div>

      <DistDataTable
        loading={list.isLoading}
        empty="No purchase invoices (Phase 6 invoice routes may still be landing)"
        rowKey={(r) => r.id}
        rows={list.data?.items ?? []}
        columns={[
          { key: "invoiceNumber", header: "PINV#" },
          {
            key: "supplierInvoiceNumber",
            header: "Supplier inv",
            render: (r) => r.supplierInvoiceNumber ?? "—",
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <DistStatusBadge status={r.status} />,
          },
          {
            key: "invoiceDate",
            header: "Date",
            render: (r) => formatDate(r.invoiceDate),
          },
          {
            key: "totalPkr",
            header: "Total",
            className: "text-right tabular-nums",
            render: (r) => formatPkr(r.totalPkr ?? 0),
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
        />
      ) : null}
    </DistPageShell>
  );
}
