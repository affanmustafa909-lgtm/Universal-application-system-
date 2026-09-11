import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  purchaseApi,
  type SupplierHit,
} from "../../pharmacy/api/pharmacy-purchase";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistDrawerField, DistMasterDrawer } from "../components/DistMasterDrawer";
import { DistPagination } from "../components/DistPagination";
import { errorMessage } from "../components/DistInventoryShared";
import {
  DistButton,
  DistDataTable,
  DistErrorBanner,
  DistInput,
  DistPageShell,
  DistStatusBadge,
} from "../ui/DistUi";

const DIST = "/pops/distribution";

/** Dist-native supplier list (replaces restaurant SuppliersPage re-export). */
export function DistributionSuppliersPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const branchCode = branch?.code;

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<SupplierHit | null>(null);
  const [tab, setTab] = useState<"profile" | "performance">("profile");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const list = useQuery({
    queryKey: ["distribution", "purchase", "suppliers", branchCode, debounced],
    enabled: Boolean(branchCode),
    queryFn: () =>
      purchaseApi.searchSuppliers({
        branchCode: branchCode!,
        q: debounced || undefined,
        limit: 200,
      }),
  });

  const performance = useQuery({
    queryKey: ["distribution", "purchase", "supplier-perf", selected?.id, branchCode],
    enabled: Boolean(selected?.id) && tab === "performance",
    queryFn: () =>
      purchaseApi.supplierPerformance(selected!.id, { branchCode: branchCode }),
  });

  const all = list.data ?? [];
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rows = all.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  return (
    <DistPageShell
      title="Suppliers"
      subtitle="Shared supplier master with Dist chrome. Performance loads on demand."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Purchases", to: `${DIST}/purchase` },
        { label: "Suppliers" },
      ]}
      actions={
        <Link to={`${DIST}/purchase-orders`}>
          <DistButton variant="secondary">New PO</DistButton>
        </Link>
      }
      error={!branch ? "Select a branch." : null}
    >
      {list.isError ? (
        <DistErrorBanner message={errorMessage(list.error, "Failed to load suppliers")} />
      ) : null}

      <label className="block max-w-md text-xs text-slate-500">
        Search
        <DistInput
          className="mt-1"
          value={q}
          placeholder="Name, phone, email…"
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </label>

      <DistDataTable
        loading={list.isLoading}
        empty={debounced ? `No suppliers match “${debounced}”` : "No suppliers"}
        rowKey={(r) => r.id}
        rows={rows}
        onRowClick={(r) => {
          setSelected(r);
          setTab("profile");
        }}
        columns={[
          { key: "name", header: "Name" },
          { key: "phone", header: "Phone", render: (r) => r.phone ?? "—" },
          { key: "email", header: "Email", render: (r) => r.email ?? "—" },
          {
            key: "paymentTerms",
            header: "Terms",
            render: (r) => r.paymentTerms ?? "—",
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <DistStatusBadge
                status={r.status ?? "active"}
                tone={r.status === "inactive" ? "danger" : "success"}
              />
            ),
          },
        ]}
      />

      <DistPagination
        page={pageSafe}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      <DistMasterDrawer
        open={Boolean(selected)}
        title={selected?.name ?? "Supplier"}
        subtitle={selected?.phone ?? undefined}
        widthClass="max-w-md"
        onClose={() => setSelected(null)}
        footer={
          selected ? (
            <Link to={`${DIST}/purchase-orders`}>
              <DistButton>Create PO</DistButton>
            </Link>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <DistButton
                variant={tab === "profile" ? "primary" : "secondary"}
                onClick={() => setTab("profile")}
              >
                Profile
              </DistButton>
              <DistButton
                variant={tab === "performance" ? "primary" : "secondary"}
                onClick={() => setTab("performance")}
              >
                Performance
              </DistButton>
            </div>

            {tab === "profile" ? (
              <dl>
                <DistDrawerField label="Name" value={selected.name} />
                <DistDrawerField label="Phone" value={selected.phone} />
                <DistDrawerField label="Email" value={selected.email} />
                <DistDrawerField label="Address" value={selected.address} />
                <DistDrawerField label="Terms" value={selected.paymentTerms} />
                <DistDrawerField
                  label="Status"
                  value={<DistStatusBadge status={selected.status ?? "active"} />}
                />
              </dl>
            ) : null}

            {tab === "performance" ? (
              <div className="space-y-2">
                {performance.isLoading ? (
                  <p className="text-sm text-slate-500">Loading performance…</p>
                ) : null}
                {performance.isError ? (
                  <DistErrorBanner message={errorMessage(performance.error)} />
                ) : null}
                {performance.data ? (
                  <dl>
                    <DistDrawerField
                      label="Orders"
                      value={String(performance.data.orderCount)}
                    />
                    <DistDrawerField
                      label="Purchase total"
                      value={formatPkr(performance.data.purchaseTotalPkr)}
                    />
                    {performance.data.grnCount != null ? (
                      <DistDrawerField
                        label="GRNs"
                        value={String(performance.data.grnCount)}
                      />
                    ) : null}
                    {performance.data.returnCount != null ? (
                      <DistDrawerField
                        label="Returns"
                        value={String(performance.data.returnCount)}
                      />
                    ) : null}
                    {performance.data.onTimePct != null ? (
                      <DistDrawerField
                        label="On-time %"
                        value={`${performance.data.onTimePct}%`}
                      />
                    ) : null}
                    {performance.data.avgLeadDays != null ? (
                      <DistDrawerField
                        label="Avg lead days"
                        value={String(performance.data.avgLeadDays)}
                      />
                    ) : null}
                  </dl>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </DistMasterDrawer>
    </DistPageShell>
  );
}
