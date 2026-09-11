# Phase 2 — Pharmacy / distribution dashboard indexes

Secondary indexes for dashboard and list-query performance. Defined in both schema mirrors:

- `packages/database-pg/src/schema/pharmacy-erp.ts`
- `packages/database-pg/src/schema/pharmacy.ts`
- (mirrored under `backend-system/packages/database-pg/src/schema/`)

| Index name | Columns | Purpose |
|---|---|---|
| `pharmacy_dist_orders_org_branch_created_idx` | organizationId, branchId, createdAt | Branch order lists / recent activity |
| `pharmacy_dist_orders_org_status_idx` | organizationId, status | Status filters and pipeline counts |
| `pharmacy_dist_orders_org_salesman_created_idx` | organizationId, salesmanEmployeeId, createdAt | Salesman performance / order history |
| `pharmacy_dist_invoices_org_branch_created_idx` | organizationId, branchId, createdAt | Branch invoice lists |
| `pharmacy_dist_invoices_org_invoice_date_idx` | organizationId, invoiceDate | Date-range invoice / revenue queries |
| `pharmacy_dist_invoices_org_customer_idx` | organizationId, tradeCustomerId | Customer AR / invoice lookup |
| `pharmacy_collections_org_branch_created_idx` | organizationId, branchId, createdAt | Collection dashboards by branch |
| `pharmacy_deliveries_org_branch_status_idx` | organizationId, branchId, status | Delivery status boards |
| `pharmacy_wholesale_returns_org_branch_created_idx` | organizationId, branchId, createdAt | Returns lists by branch |
| `pharmacy_medicine_batches_medicine_expiry_idx` | medicineId, expiryDate | FEFO / expiry per medicine |
| `pharmacy_medicine_batches_expiry_qty_idx` | expiryDate, quantity | Near-expiry stock scans |
| `pharmacy_medicines_org_branch_status_idx` | organizationId, branchId, status | Active catalog by branch |
| `pharmacy_medicines_org_company_idx` | organizationId, companyId | Company catalog filters |
| `pharmacy_trade_customers_org_branch_idx` | organizationId, branchId | Customer lists by branch |
| `pharmacy_trade_customers_org_outstanding_idx` | organizationId, outstandingPkr | Outstanding / AR ranking |
| `pharmacy_visits_org_visited_idx` | organizationId, visitedAt | Visit timeline / field reports |
| `pharmacy_assignments_org_date_idx` | organizationId, assignmentDate | Daily assignment boards |
| `pharmacy_targets_org_employee_period_idx` | organizationId, employeeId, periodStart, periodEnd | Target vs actual by employee/period |
