import { Navigate, Route } from "react-router-dom";
import { lazy } from "react";

// Pharmacy — rendered only in pharmacy or suite editions.
const PharmacyDashboardPage = lazy(() =>
  import("../pharmacy/pages/PharmacyDashboardPage").then((m) => ({ default: m.PharmacyDashboardPage })),
);
const MedicinesPage = lazy(() =>
  import("../pharmacy/pages/MedicinesPage").then((m) => ({ default: m.MedicinesPage })),
);
const PharmacyRackMapPage = lazy(() =>
  import("../pharmacy/pages/PharmacyRackMapPage").then((m) => ({ default: m.PharmacyRackMapPage })),
);
const PharmacyInventoryPage = lazy(() =>
  import("../pharmacy/pages/PharmacyInventoryPage").then((m) => ({ default: m.PharmacyInventoryPage })),
);
const PharmacyExpiryPage = lazy(() =>
  import("../pharmacy/pages/PharmacyExpiryPage").then((m) => ({ default: m.PharmacyExpiryPage })),
);
const PharmacyPosPage = lazy(() =>
  import("../pharmacy/pages/PharmacyPosPage").then((m) => ({ default: m.PharmacyPosPage })),
);
const PrescriptionsPage = lazy(() =>
  import("../pharmacy/pages/PrescriptionsPage").then((m) => ({ default: m.PrescriptionsPage })),
);
const PharmacyCustomersPage = lazy(() =>
  import("../pharmacy/pages/PharmacyCustomersPage").then((m) => ({ default: m.PharmacyCustomersPage })),
);
const PharmacyDoctorsPage = lazy(() =>
  import("../pharmacy/pages/PharmacyDoctorsPage").then((m) => ({ default: m.PharmacyDoctorsPage })),
);
const PharmacyFinancePage = lazy(() =>
  import("../pharmacy/pages/PharmacyFinancePage").then((m) => ({ default: m.PharmacyFinancePage })),
);
const PharmacyReportsPage = lazy(() =>
  import("../pharmacy/pages/PharmacyReportsPage").then((m) => ({ default: m.PharmacyReportsPage })),
);
const PharmacyStaffPanelPage = lazy(() =>
  import("../pharmacy/pages/PharmacyStaffPanelPage").then((m) => ({ default: m.PharmacyStaffPanelPage })),
);
const PharmacyAdminPanelPage = lazy(() =>
  import("../pharmacy/pages/PharmacyAdminPanelPage").then((m) => ({ default: m.PharmacyAdminPanelPage })),
);
const PharmacyStaffPage = lazy(() =>
  import("../pharmacy/pages/PharmacyStaffPage").then((m) => ({ default: m.PharmacyStaffPage })),
);
const PharmacyPurchaseStatementPage = lazy(() =>
  import("../pharmacy/pages/PharmacyFeaturePages").then((m) => ({ default: m.PharmacyPurchaseStatementPage })),
);
const PharmacySupplierPaymentsPage = lazy(() =>
  import("../pharmacy/pages/PharmacyFeaturePages").then((m) => ({ default: m.PharmacySupplierPaymentsPage })),
);
const PharmacySalesManagementPage = lazy(() =>
  import("../pharmacy/pages/PharmacyFeaturePages").then((m) => ({ default: m.PharmacySalesManagementPage })),
);
const PharmacySalesStatementPage = lazy(() =>
  import("../pharmacy/pages/PharmacyFeaturePages").then((m) => ({ default: m.PharmacySalesStatementPage })),
);
const PharmacySalesMonthPage = lazy(() =>
  import("../pharmacy/pages/PharmacyFeaturePages").then((m) => ({ default: m.PharmacySalesMonthPage })),
);
const PharmacyProfitLossPage = lazy(() =>
  import("../pharmacy/pages/PharmacyFeaturePages").then((m) => ({ default: m.PharmacyProfitLossPage })),
);
const PharmacyExpiredProductsPage = lazy(() =>
  import("../pharmacy/pages/PharmacyFeaturePages").then((m) => ({ default: m.PharmacyExpiredProductsPage })),
);
const PharmacyControlledDrugsPage = lazy(() =>
  import("../pharmacy/pages/PharmacyExtendedPages").then((m) => ({ default: m.PharmacyControlledDrugsPage })),
);
const PharmacyKhataPage = lazy(() =>
  import("../pharmacy/pages/PharmacyExtendedPages").then((m) => ({ default: m.PharmacyKhataPage })),
);
const PharmacyRefillRemindersPage = lazy(() =>
  import("../pharmacy/pages/PharmacyExtendedPages").then((m) => ({ default: m.PharmacyRefillRemindersPage })),
);
const PharmacyShiftPage = lazy(() =>
  import("../pharmacy/pages/PharmacyExtendedPages").then((m) => ({ default: m.PharmacyShiftPage })),
);
const PharmacyTaxCompliancePage = lazy(() =>
  import("../pharmacy/pages/PharmacyExtendedPages").then((m) => ({ default: m.PharmacyTaxCompliancePage })),
);
const PharmacyCompaniesPage = lazy(() =>
  import("../pharmacy/pages/PharmacyErpPages").then((m) => ({ default: m.PharmacyCompaniesPage })),
);
const PharmacyWarehousesPage = lazy(() =>
  import("../pharmacy/pages/PharmacyErpPages").then((m) => ({ default: m.PharmacyWarehousesPage })),
);
const PharmacySaleReturnsPage = lazy(() =>
  import("../pharmacy/pages/PharmacyErpPages").then((m) => ({ default: m.PharmacySaleReturnsPage })),
);
const PharmacyModulesPage = lazy(() =>
  import("../pharmacy/pages/PharmacyModulesPage").then((m) => ({ default: m.PharmacyModulesPage })),
);
const PharmacyCodeLookupPage = lazy(() =>
  import("../pharmacy/pages/PharmacyCodeLookupPage").then((m) => ({ default: m.PharmacyCodeLookupPage })),
);

/** Pharmacy routes. Rendered only in pharmacy or suite editions. */
export function pharmacyRoutes(): JSX.Element {
  return (
    <>
      <Route path="pharmacy/dashboard" element={<PharmacyDashboardPage />} />
      <Route path="pharmacy/lookup" element={<PharmacyCodeLookupPage />} />
      <Route path="pharmacy/modules" element={<PharmacyModulesPage />} />
      <Route path="pharmacy/medicines" element={<MedicinesPage />} />
      <Route path="pharmacy/rack-map" element={<PharmacyRackMapPage />} />
      <Route path="pharmacy/inventory" element={<PharmacyInventoryPage />} />
      <Route path="pharmacy/expiry" element={<PharmacyExpiryPage />} />
      <Route path="pharmacy/pos" element={<PharmacyPosPage />} />
      <Route path="pharmacy/prescriptions" element={<PrescriptionsPage />} />
      <Route path="pharmacy/customers" element={<PharmacyCustomersPage />} />
      <Route path="pharmacy/doctors" element={<PharmacyDoctorsPage />} />
      <Route path="pharmacy/finance" element={<PharmacyFinancePage />} />
      <Route path="pharmacy/reports" element={<PharmacyReportsPage />} />
      <Route path="pharmacy/staff-panel" element={<PharmacyStaffPanelPage />} />
      <Route path="pharmacy/admin-panel" element={<PharmacyAdminPanelPage />} />
      <Route path="pharmacy/suppliers" element={<Navigate to="/pops/distribution/suppliers" replace />} />
      <Route path="pharmacy/staff" element={<PharmacyStaffPage />} />
      <Route path="pharmacy/purchase-statement" element={<PharmacyPurchaseStatementPage />} />
      <Route path="pharmacy/supplier-payments" element={<PharmacySupplierPaymentsPage />} />
      <Route path="pharmacy/sales" element={<PharmacySalesManagementPage />} />
      <Route path="pharmacy/sales-statement" element={<PharmacySalesStatementPage />} />
      <Route path="pharmacy/sales-month" element={<PharmacySalesMonthPage />} />
      <Route path="pharmacy/profit-loss" element={<PharmacyProfitLossPage />} />
      <Route path="pharmacy/expired" element={<PharmacyExpiredProductsPage />} />
      <Route path="pharmacy/khata" element={<PharmacyKhataPage />} />
      <Route path="pharmacy/shifts" element={<PharmacyShiftPage />} />
      <Route path="pharmacy/controlled-drugs" element={<PharmacyControlledDrugsPage />} />
      <Route path="pharmacy/refill-reminders" element={<PharmacyRefillRemindersPage />} />
      <Route path="pharmacy/tax-compliance" element={<PharmacyTaxCompliancePage />} />
      <Route path="pharmacy/companies" element={<PharmacyCompaniesPage />} />
      <Route path="pharmacy/warehouses" element={<PharmacyWarehousesPage />} />
      <Route path="pharmacy/purchase-orders" element={<Navigate to="/pops/distribution/purchase-orders" replace />} />
      <Route path="pharmacy/sale-returns" element={<PharmacySaleReturnsPage />} />
      {/* Legacy distribution URLs → Medical Distribution system */}
      <Route path="pharmacy/geo" element={<Navigate to="/pops/distribution/geo" replace />} />
      <Route path="pharmacy/trade-customers" element={<Navigate to="/pops/distribution/trade-customers" replace />} />
      <Route path="pharmacy/pricing" element={<Navigate to="/pops/distribution/pricing" replace />} />
      <Route path="pharmacy/distribution/orders" element={<Navigate to="/pops/distribution/orders" replace />} />
      <Route path="pharmacy/distribution/deliveries" element={<Navigate to="/pops/distribution/deliveries" replace />} />
      <Route path="pharmacy/distribution/collections" element={<Navigate to="/pops/distribution/collections" replace />} />
      <Route path="pharmacy/distribution/assignments" element={<Navigate to="/pops/distribution/assignments" replace />} />
      <Route
        path="pharmacy/distribution/wholesale-returns"
        element={<Navigate to="/pops/distribution/wholesale-returns" replace />}
      />
    </>
  );
}
