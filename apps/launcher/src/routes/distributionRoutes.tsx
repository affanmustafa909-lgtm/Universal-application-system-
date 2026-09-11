import { Navigate, Route } from "react-router-dom";
import { lazy } from "react";

const DistributionModulesPage = lazy(() =>
  import("../distribution/pages/DistributionModulesPage").then((m) => ({
    default: m.DistributionModulesPage,
  })),
);
const DistributionOrdersPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionOrdersPage })),
);
const DistributionTradeCustomersPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionTradeCustomersPage,
  })),
);
const DistributionTradeCustomerDetailPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionTradeCustomerDetailPage,
  })),
);
const DistributionWholesaleReturnsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionWholesaleReturnsPage,
  })),
);
const DistributionDeliveriesPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionDeliveriesPage,
  })),
);
const DistributionDeliveryDashboardPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionDeliveryDashboardPage,
  })),
);
const DistributionDispatchPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionDispatchPage,
  })),
);
const DistributionCollectionsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionCollectionsPage,
  })),
);
const DistributionCollectionsDashboardPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionCollectionsDashboardPage,
  })),
);
const DistributionRecoveryPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionRecoveryPage,
  })),
);
const DistributionAssignmentsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionAssignmentsPage,
  })),
);
const DistributionGeoPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionGeoPage })),
);
const DistributionPricingPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionPricingPage })),
);
const DistributionMedicinesPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionMedicinesPage,
  })),
);
const DistributionMedicineDetailPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionMedicineDetailPage,
  })),
);
const DistributionCompaniesPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionCompaniesPage,
  })),
);
const DistributionWarehousesPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionWarehousesPage,
  })),
);
const DistributionInventoryDashboardPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionInventoryDashboardPage,
  })),
);
const DistributionStockPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionStockPage })),
);
const DistributionProductInventoryPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionProductInventoryPage,
  })),
);
const DistributionBatchesPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionBatchesPage })),
);
const DistributionExpiryPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionExpiryPage })),
);
const DistributionStockLedgerPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionStockLedgerPage,
  })),
);
const DistributionStockTransfersPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionStockTransfersPage,
  })),
);
const DistributionStockAdjustmentsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionStockAdjustmentsPage,
  })),
);
const DistributionStockCountPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionStockCountPage })),
);
const DistributionInventoryReportsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionInventoryReportsPage,
  })),
);
const DistributionSuppliersPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionSuppliersPage,
  })),
);
const DistributionPurchaseDashboardPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionPurchaseDashboardPage,
  })),
);
const DistributionPurchaseRequisitionsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionPurchaseRequisitionsPage,
  })),
);
const DistributionPurchaseOrdersPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionPurchaseOrdersPage,
  })),
);
const DistributionPurchaseGrnPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionPurchaseGrnPage,
  })),
);
const DistributionPurchaseReturnsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionPurchaseReturnsPage,
  })),
);
const DistributionPurchaseInvoicesPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionPurchaseInvoicesPage,
  })),
);
const DistributionPurchaseStatementPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionPurchaseStatementPage,
  })),
);
const DistributionStaffPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionStaffPage })),
);
const DistributionPsWindowPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionPsWindowPage })),
);
const DistributionReportCenterPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionReportCenterPage,
  })),
);
const DistributionInvoicesPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionInvoicesPage,
  })),
);
const DistributionAgingPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionAgingPage,
  })),
);
const DistributionMastersHubPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionMastersHubPage,
  })),
);
const DistributionProductMastersPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionProductMastersPage,
  })),
);
const DistributionSalesForcePage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionSalesForcePage,
  })),
);
const DistributionImportPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionImportPage,
  })),
);
const DistributionAdminPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionAdminPage,
  })),
);
const DistributionAuditPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionAuditPage,
  })),
);
const DistributionRegistersPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionRegistersPage,
  })),
);
const DistributionFieldForceDashboardPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionFieldForceDashboardPage,
  })),
);
const DistributionVisitsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionVisitsPage })),
);
const DistributionPjpPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionPjpPage })),
);
const DistributionTargetsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionTargetsPage })),
);
const DistributionFieldPerformancePage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionFieldPerformancePage,
  })),
);
const DistributionRoutePlanPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({ default: m.DistributionRoutePlanPage })),
);
const DistributionSalesmanDetailPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionSalesmanDetailPage,
  })),
);
const DistributionFinanceDashboardPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionFinanceDashboardPage,
  })),
);
const DistributionCustomerLedgerPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionCustomerLedgerPage,
  })),
);
const DistributionSupplierLedgerPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionSupplierLedgerPage,
  })),
);
const DistributionGeneralLedgerPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionGeneralLedgerPage,
  })),
);
const DistributionFinanceReconciliationPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionFinanceReconciliationPage,
  })),
);
const DistributionFinancialPeriodsPage = lazy(() =>
  import("../distribution/pages/DistributionPages").then((m) => ({
    default: m.DistributionFinancialPeriodsPage,
  })),
);

/** Medical Distribution routes. Rendered in distribution or suite editions. */
export function distributionRoutes(): JSX.Element {
  return (
    <>
      <Route path="distribution" element={<Navigate to="/pops/distribution/ps" replace />} />
      <Route path="distribution/ps" element={<DistributionPsWindowPage />} />
      <Route path="distribution/reports" element={<DistributionReportCenterPage />} />
      <Route path="distribution/invoices" element={<DistributionInvoicesPage />} />
      <Route path="distribution/aging" element={<DistributionAgingPage />} />
      <Route path="distribution/modules" element={<DistributionModulesPage />} />
      <Route path="distribution/orders" element={<DistributionOrdersPage />} />
      <Route path="distribution/trade-customers" element={<DistributionTradeCustomersPage />} />
      <Route path="distribution/trade-customers/:id" element={<DistributionTradeCustomerDetailPage />} />
      <Route path="distribution/wholesale-returns" element={<DistributionWholesaleReturnsPage />} />
      <Route path="distribution/delivery" element={<DistributionDeliveryDashboardPage />} />
      <Route path="distribution/deliveries" element={<DistributionDeliveriesPage />} />
      <Route path="distribution/dispatch" element={<DistributionDispatchPage />} />
      <Route path="distribution/collection" element={<DistributionCollectionsDashboardPage />} />
      <Route path="distribution/collections" element={<DistributionCollectionsPage />} />
      <Route path="distribution/recovery" element={<DistributionRecoveryPage />} />
      <Route path="distribution/assignments" element={<DistributionAssignmentsPage />} />
      <Route path="distribution/field-force" element={<DistributionFieldForceDashboardPage />} />
      <Route path="distribution/visits" element={<DistributionVisitsPage />} />
      <Route path="distribution/pjp" element={<DistributionPjpPage />} />
      <Route path="distribution/targets" element={<DistributionTargetsPage />} />
      <Route path="distribution/field-performance" element={<DistributionFieldPerformancePage />} />
      <Route path="distribution/route-plan" element={<DistributionRoutePlanPage />} />
      <Route path="distribution/sales-force/:employeeId" element={<DistributionSalesmanDetailPage />} />
      <Route path="distribution/geo" element={<DistributionGeoPage />} />
      <Route path="distribution/pricing" element={<DistributionPricingPage />} />
      <Route path="distribution/medicines" element={<DistributionMedicinesPage />} />
      <Route path="distribution/medicines/:id" element={<DistributionMedicineDetailPage />} />
      <Route path="distribution/companies" element={<DistributionCompaniesPage />} />
      <Route path="distribution/warehouses" element={<DistributionWarehousesPage />} />
      <Route path="distribution/inventory" element={<DistributionInventoryDashboardPage />} />
      <Route path="distribution/stock" element={<DistributionStockPage />} />
      <Route path="distribution/inventory/product/:medicineId" element={<DistributionProductInventoryPage />} />
      <Route path="distribution/batches" element={<DistributionBatchesPage />} />
      <Route path="distribution/expiry" element={<DistributionExpiryPage />} />
      <Route path="distribution/stock-ledger" element={<DistributionStockLedgerPage />} />
      <Route path="distribution/stock-transfers" element={<DistributionStockTransfersPage />} />
      <Route path="distribution/stock-adjustments" element={<DistributionStockAdjustmentsPage />} />
      <Route path="distribution/stock-count" element={<DistributionStockCountPage />} />
      <Route path="distribution/inventory-reports" element={<DistributionInventoryReportsPage />} />
      <Route path="distribution/suppliers" element={<DistributionSuppliersPage />} />
      <Route path="distribution/purchase" element={<DistributionPurchaseDashboardPage />} />
      <Route path="distribution/purchase-requisitions" element={<DistributionPurchaseRequisitionsPage />} />
      <Route path="distribution/purchase-orders" element={<DistributionPurchaseOrdersPage />} />
      <Route path="distribution/purchase-grn" element={<DistributionPurchaseGrnPage />} />
      <Route path="distribution/purchase-returns" element={<DistributionPurchaseReturnsPage />} />
      <Route path="distribution/purchase-invoices" element={<DistributionPurchaseInvoicesPage />} />
      {/* Legacy restaurant history — kept for bookmarks; removed from Dist nav. */}
      <Route path="distribution/purchase-statement" element={<DistributionPurchaseStatementPage />} />
      <Route path="distribution/staff" element={<DistributionStaffPage />} />
      <Route path="distribution/masters" element={<DistributionMastersHubPage />} />
      <Route path="distribution/product-masters" element={<DistributionProductMastersPage />} />
      <Route path="distribution/sales-force" element={<DistributionSalesForcePage />} />
      <Route path="distribution/import" element={<DistributionImportPage />} />
      <Route path="distribution/admin" element={<DistributionAdminPage />} />
      <Route path="distribution/audit" element={<DistributionAuditPage />} />
      <Route path="distribution/registers" element={<DistributionRegistersPage />} />
      <Route path="distribution/finance" element={<DistributionFinanceDashboardPage />} />
      <Route path="distribution/finance/gl" element={<DistributionGeneralLedgerPage />} />
      <Route path="distribution/finance/customer-ledger" element={<DistributionCustomerLedgerPage />} />
      <Route path="distribution/finance/supplier-ledger" element={<DistributionSupplierLedgerPage />} />
      <Route path="distribution/finance/reconciliation" element={<DistributionFinanceReconciliationPage />} />
      <Route path="distribution/finance/periods" element={<DistributionFinancialPeriodsPage />} />
    </>
  );
}
