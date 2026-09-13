/** Distribution pages — Dist Phase-1/2/3/4/5/6/7 + shared pharmacy ERP components. */
export {
  PharmacyAssignmentsPage as DistributionAssignmentsPage,
  PharmacyWholesaleReturnsPage as DistributionWholesaleReturnsPage,
} from "../../pharmacy/pages/PharmacyErpPages";

export { DistributionGeoPage } from "./DistributionGeoPage";
export { DistributionOrdersPage } from "./DistributionOrdersPage";
export { DistributionPsWindowPage } from "./DistributionPsWindowPage";
export { DistributionReportCenterPage } from "./DistributionReportCenterPage";
export { DistributionInvoicesPage } from "./DistributionInvoicesPage";
export { DistributionAgingPage } from "./DistributionAgingPage";
export { DistributionMastersHubPage } from "./DistributionMastersHubPage";
export { DistributionProductMastersPage } from "./DistributionProductMastersPage";
export { DistributionMedicinesPage } from "./DistributionMedicinesPage";
export { DistributionMedicineDetailPage } from "./DistributionMedicineDetailPage";
export { DistributionTradeCustomersPage, DistributionTradeCustomerDetailPage } from "./DistributionTradeCustomersPage";
export { DistributionCompaniesPage, DistributionWarehousesPage } from "./DistributionCompaniesPage";
export { DistributionSalesForcePage } from "./DistributionSalesForcePage";
export { DistributionPricingPage } from "./DistributionPricingPage";
export { DistributionImportPage } from "./DistributionImportPage";
export { DistributionAdminPage } from "./DistributionAdminPage";
export { DistributionAuditPage } from "./DistributionAuditPage";
export { DistributionRegistersPage } from "./DistributionRegistersPage";

/** Phase-4 inventory — Dist-native, replaces the shared pharmacy inventory/expiry screens. */
export { DistributionInventoryDashboardPage } from "./DistributionInventoryDashboardPage";
export { DistributionStockPage } from "./DistributionStockPage";
export { DistributionProductInventoryPage } from "./DistributionProductInventoryPage";
export { DistributionBatchesPage } from "./DistributionBatchesPage";
export { DistributionExpiryPage } from "./DistributionExpiryPage";
export { DistributionStockLedgerPage } from "./DistributionStockLedgerPage";
export { DistributionStockTransfersPage } from "./DistributionStockTransfersPage";
export { DistributionStockAdjustmentsPage } from "./DistributionStockAdjustmentsPage";
export { DistributionStockCountPage } from "./DistributionStockCountPage";
export { DistributionInventoryReportsPage } from "./DistributionInventoryReportsPage";

/** Phase-6 pharmaceutical procurement — Dist-native. */
export { DistributionPurchaseDashboardPage } from "./DistributionPurchaseDashboardPage";
export { DistributionPurchaseRequisitionsPage } from "./DistributionPurchaseRequisitionsPage";
export { DistributionPurchaseOrdersPage } from "./DistributionPurchaseOrdersPage";
export { DistributionPurchaseGrnPage } from "./DistributionPurchaseGrnPage";
export { DistributionPurchaseReturnsPage } from "./DistributionPurchaseReturnsPage";
export { DistributionPurchaseInvoicesPage } from "./DistributionPurchaseInvoicesPage";
export { DistributionSuppliersPage } from "./DistributionSuppliersPage";

/** Phase-7 delivery / collections / aging / recovery — Dist-native. */
export { DistributionDeliveryDashboardPage } from "./DistributionDeliveryDashboardPage";
export { DistributionDeliveriesPage } from "./DistributionDeliveriesPage";
export { DistributionDispatchPage } from "./DistributionDispatchPage";
export { DistributionCollectionsDashboardPage } from "./DistributionCollectionsDashboardPage";
export { DistributionCollectionsPage } from "./DistributionCollectionsPage";
export { DistributionRecoveryPage } from "./DistributionRecoveryPage";

/** Phase-8 field force — Dist-native. */
export { DistributionFieldForceDashboardPage } from "./DistributionFieldForceDashboardPage";
export { DistributionVisitsPage } from "./DistributionVisitsPage";
export { DistributionPjpPage } from "./DistributionPjpPage";
export { DistributionTargetsPage } from "./DistributionTargetsPage";
export { DistributionFieldPerformancePage } from "./DistributionFieldPerformancePage";
export { DistributionRoutePlanPage } from "./DistributionRoutePlanPage";
export { DistributionSalesmanDetailPage } from "./DistributionSalesmanDetailPage";

/** Phase-9 finance — Dist-facing views over the shared accounting engine. */
export { DistributionFinanceDashboardPage } from "./DistributionFinanceDashboardPage";
export { DistributionCashSessionPage } from "./DistributionCashSessionPage";
export { DistributionCustomerLedgerPage } from "./DistributionCustomerLedgerPage";
export { DistributionSupplierLedgerPage } from "./DistributionSupplierLedgerPage";
export { DistributionGeneralLedgerPage } from "./DistributionGeneralLedgerPage";
export { DistributionFinanceReconciliationPage } from "./DistributionFinanceReconciliationPage";
export { DistributionFinancialPeriodsPage } from "./DistributionFinancialPeriodsPage";

export { PharmacyStaffPage as DistributionStaffPage } from "../../pharmacy/pages/PharmacyStaffPage";
/** Legacy restaurant purchase history — kept for redirect compatibility; removed from Dist nav. */
export { PharmacyPurchaseStatementPage as DistributionPurchaseStatementPage } from "../../pharmacy/pages/PharmacyFeaturePages";
