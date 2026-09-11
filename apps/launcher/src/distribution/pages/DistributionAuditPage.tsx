import { useQuery } from "@tanstack/react-query";
import { ioApi } from "../../pharmacy/api/pharmacy-io";
import { DistDataTable, DistPageShell } from "../ui/DistUi";
import { DistPagination } from "../components/DistPagination";
import { useState } from "react";

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
          { key: "createdAt", header: "When" },
          { key: "action", header: "Action" },
          { key: "entityType", header: "Module" },
          { key: "entityId", header: "Record" },
          { key: "reason", header: "Reason" },
          { key: "userId", header: "User" },
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
