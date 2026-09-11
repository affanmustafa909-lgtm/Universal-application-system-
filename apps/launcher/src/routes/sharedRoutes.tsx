import { Route } from "react-router-dom";
import { lazy } from "react";

// Shared ERP routes available in every edition (restaurant, pharmacy, store, suite).
const AuthPage = lazy(() => import("../pops/pages/modules/AuthPage").then((m) => ({ default: m.AuthPage })));
const NotificationsPage = lazy(() =>
  import("../pops/pages/modules/NotificationsPage").then((m) => ({ default: m.NotificationsPage })),
);
const NotificationTemplatesPage = lazy(() =>
  import("../pops/pages/modules/notifications/NotificationTemplatesPage").then((m) => ({ default: m.NotificationTemplatesPage })),
);
const SecurityPage = lazy(() =>
  import("../pops/pages/modules/SecurityPage").then((m) => ({ default: m.SecurityPage })),
);
const SettingsPage = lazy(() =>
  import("../pops/pages/modules/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const TaxPage = lazy(() => import("../pops/pages/modules/TaxPage").then((m) => ({ default: m.TaxPage })));
const PrinterPage = lazy(() =>
  import("../pops/pages/modules/PrinterPage").then((m) => ({ default: m.PrinterPage })),
);
const ClosingPage = lazy(() =>
  import("../pops/pages/modules/ClosingPage").then((m) => ({ default: m.ClosingPage })),
);
const SyncPage = lazy(() =>
  import("../pops/pages/modules/SyncPage").then((m) => ({ default: m.SyncPage })),
);
const MultiBranchDashboardPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/MultiBranchDashboardPage").then((m) => ({
    default: m.MultiBranchDashboardPage,
  })),
);
const InterBranchTransfersPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/InterBranchTransfersPage").then((m) => ({
    default: m.InterBranchTransfersPage,
  })),
);
const BranchReceivePage = lazy(() =>
  import("../pops/pages/modules/multi-branch/BranchReceivePage").then((m) => ({
    default: m.BranchReceivePage,
  })),
);
const BranchPricingPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/BranchPricingPage").then((m) => ({
    default: m.BranchPricingPage,
  })),
);
const ConsolidatedReportsPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/ConsolidatedReportsPage").then((m) => ({
    default: m.ConsolidatedReportsPage,
  })),
);

const AccountingPage = lazy(() =>
  import("../pops/pages/modules/AccountingPage").then((m) => ({ default: m.AccountingPage })),
);
const ExpensesPage = lazy(() =>
  import("../pops/pages/modules/accounting/ExpensesPage").then((m) => ({ default: m.ExpensesPage })),
);
const PurchasesAccountingPage = lazy(() =>
  import("../pops/pages/modules/accounting/PurchasesPage").then((m) => ({ default: m.PurchasesPage })),
);
const VendorsPage = lazy(() =>
  import("../pops/pages/modules/accounting/VendorsPage").then((m) => ({ default: m.VendorsPage })),
);
const AccountingCustomersPage = lazy(() =>
  import("../pops/pages/modules/accounting/CustomersPage").then((m) => ({ default: m.CustomersPage })),
);
const CashManagementPage = lazy(() =>
  import("../pops/pages/modules/accounting/CashManagementPage").then((m) => ({ default: m.CashManagementPage })),
);
const BankAccountsPage = lazy(() =>
  import("../pops/pages/modules/accounting/BankAccountsPage").then((m) => ({ default: m.BankAccountsPage })),
);
const AccountsReceivablePage = lazy(() =>
  import("../pops/pages/modules/accounting/AccountsReceivablePage").then((m) => ({
    default: m.AccountsReceivablePage,
  })),
);
const AccountsPayablePage = lazy(() =>
  import("../pops/pages/modules/accounting/AccountsPayablePage").then((m) => ({ default: m.AccountsPayablePage })),
);
const JournalEntriesPage = lazy(() =>
  import("../pops/pages/modules/accounting/JournalEntriesPage").then((m) => ({ default: m.JournalEntriesPage })),
);
const TaxManagementPage = lazy(() =>
  import("../pops/pages/modules/accounting/TaxManagementPage").then((m) => ({ default: m.TaxManagementPage })),
);
const AccountingReportsPage = lazy(() =>
  import("../pops/pages/modules/accounting/AccountingReportsPage").then((m) => ({
    default: m.AccountingReportsPage,
  })),
);
const ChartOfAccountsPage = lazy(() =>
  import("../pops/pages/modules/accounting/ChartOfAccountsPage").then((m) => ({ default: m.ChartOfAccountsPage })),
);
const AccountingAuditLogsPage = lazy(() =>
  import("../pops/pages/modules/accounting/AccountingAuditLogsPage").then((m) => ({
    default: m.AccountingAuditLogsPage,
  })),
);
const InventoryAccountingPage = lazy(() =>
  import("../pops/pages/modules/accounting/InventoryAccountingPage").then((m) => ({
    default: m.InventoryAccountingPage,
  })),
);

/** Routes present in every edition. */
export function sharedRoutes(): JSX.Element {
  return (
    <>
      <Route path="auth" element={<AuthPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="notifications/templates" element={<NotificationTemplatesPage />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="tax" element={<TaxPage />} />
      <Route path="tax/fbr" element={<TaxPage />} />
      <Route path="tax/pra" element={<TaxPage />} />
      <Route path="tax/pra-real" element={<TaxPage />} />
      <Route path="tax/pra-fake" element={<TaxPage />} />
      <Route path="tax/invoices" element={<TaxPage />} />
      <Route path="printer" element={<PrinterPage />} />
      <Route path="closing" element={<ClosingPage />} />
      <Route path="sync" element={<SyncPage />} />
      <Route path="multi-branch" element={<MultiBranchDashboardPage />} />
      <Route path="multi-branch/transfers" element={<InterBranchTransfersPage />} />
      <Route path="multi-branch/receive" element={<BranchReceivePage />} />
      <Route path="multi-branch/pricing" element={<BranchPricingPage />} />
      <Route path="multi-branch/reports" element={<ConsolidatedReportsPage />} />
      <Route path="accounting" element={<AccountingPage />} />
      <Route path="accounting/expenses" element={<ExpensesPage />} />
      <Route path="accounting/purchases" element={<PurchasesAccountingPage />} />
      <Route path="accounting/vendors" element={<VendorsPage />} />
      <Route path="accounting/customers" element={<AccountingCustomersPage />} />
      <Route path="accounting/inventory" element={<InventoryAccountingPage />} />
      <Route path="accounting/cash" element={<CashManagementPage />} />
      <Route path="accounting/bank" element={<BankAccountsPage />} />
      <Route path="accounting/receivable" element={<AccountsReceivablePage />} />
      <Route path="accounting/payable" element={<AccountsPayablePage />} />
      <Route path="accounting/journal" element={<JournalEntriesPage />} />
      <Route path="accounting/tax" element={<TaxManagementPage />} />
      <Route path="accounting/reports" element={<AccountingReportsPage />} />
      <Route path="accounting/accounts" element={<ChartOfAccountsPage />} />
      <Route path="accounting/audit-logs" element={<AccountingAuditLogsPage />} />
    </>
  );
}
