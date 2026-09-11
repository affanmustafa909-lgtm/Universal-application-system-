import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { financeApi } from "../../pharmacy/api/pharmacy-finance";
import { formatPkr, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import { DistButton, DistDataTable, DistPageShell, DistPanel } from "../ui/DistUi";

const DIST = "/pops/distribution";

export function DistributionFinanceReconciliationPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const recon = useQuery({
    queryKey: ["distribution", "finance", "reconciliation", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => financeApi.reconciliation(branch!.code),
  });
  const checks = (recon.data?.checks ?? []) as Array<Record<string, unknown>>;

  return (
    <DistPageShell
      title="Financial reconciliation"
      subtitle="Mismatches are listed. Nothing is auto-corrected."
      breadcrumb={[
        { label: "Distribution", to: `${DIST}/ps` },
        { label: "Finance", to: `${DIST}/finance` },
        { label: "Reconciliation" },
      ]}
      actions={
        <Link to={`${DIST}/finance/periods`}>
          <DistButton variant="secondary">Periods</DistButton>
        </Link>
      }
    >
      <DistPanel title="Integrity checks">
        <DistDataTable
          columns={[
            { key: "severity", header: "Severity" },
            { key: "label", header: "Check" },
            { key: "expectedPkr", header: "Expected", render: (r) => formatPkr(Number(r.expectedPkr ?? 0)) },
            { key: "actualPkr", header: "Actual", render: (r) => formatPkr(Number(r.actualPkr ?? 0)) },
            { key: "differencePkr", header: "Difference", render: (r) => formatPkr(Number(r.differencePkr ?? 0)) },
          ]}
          rows={checks}
          rowKey={(r) => String(r.code)}
          loading={recon.isLoading}
          empty="No reconciliation checks returned."
        />
      </DistPanel>
    </DistPageShell>
  );
}
