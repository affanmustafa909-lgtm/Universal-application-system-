# Inventory Performance — Phase 4

**Date:** 2026-09-11
**Status:** Code-complete, deploy-pending. **No performance measurement has been taken.**

---

## 1. Nothing here has been measured

**Every number in the "measured" column of this document reads "not yet measured — deploy required". That is literal, not a placeholder for a figure someone forgot to fill in.**

The Phase 4 endpoints are not deployed. The local environment has no running API and no local PostgreSQL instance (Docker is not installed), and the Railway CLI is not authenticated, so the code cannot be deployed from here. Production is still serving an older build in which these routes return 404. There has been no opportunity to time anything.

No latency figure appears anywhere in this document that was not observed. The targets below are design budgets that the test suite will assert against; they are statements of intent, not results. See `INVENTORY_TESTING.md` §1.

---

## 2. Targets

These budgets are encoded in `backend-system/scripts/phase4-inventory-tests.mjs:1148-1158`. The suite calls each endpoint three times, sorts the three timings and compares the **median** against the budget, so one cold-start outlier does not fail a run and a consistently slow endpoint is not hidden by one fast sample.

| Endpoint | Probe label | Target | Measured |
| --- | --- | --- | --- |
| `GET /v1/pharmacy/inventory/stock/:medicineId` | `product-lookup` | < 300 ms | not yet measured — deploy required |
| `GET /v1/pharmacy/inventory/availability` | `availability` | < 300 ms | not yet measured — deploy required |
| `GET /v1/pharmacy/inventory/batches` (pageSize 25) | `batch-list` | < 300 ms | not yet measured — deploy required |
| `GET /v1/pharmacy/inventory/stock` (pageSize 25) | `stock-list` | < 500 ms | not yet measured — deploy required |
| `GET /v1/pharmacy/inventory/ledger` (pageSize 50) | `ledger` | < 500 ms | not yet measured — deploy required |
| `GET /v1/pharmacy/inventory/expiry/buckets` | `expiry-buckets` | < 500 ms | not yet measured — deploy required |
| `GET /v1/pharmacy/inventory/dashboard` | `dashboard` | < 1000 ms | not yet measured — deploy required |
| `GET /v1/pharmacy/inventory/valuation/summary` | `valuation-summary` | < 1000 ms | not yet measured — deploy required |
| `GET /v1/pharmacy/inventory/reorder` (pageSize 25) | `reorder` | < 1000 ms | not yet measured — deploy required |

The four headline targets from the specification — product lookup, availability, paginated list and batch lookup — are the first four rows. The remaining five have looser budgets because they aggregate across the whole branch rather than serving a single row or page: the dashboard issues roughly a dozen counts plus a valuation and an expiry bucketing in one request, and valuation and reorder both scan every batch in scope.

**The budgets are not load-test targets.** A suite run exercises a branch containing the handful of products the suite itself created. Meeting these budgets on that data proves the query plans are not pathological; it does not predict behaviour at production volume. See §5.

---

## 3. Indexes

Every index below is created by the idempotent boot DDL in `api/scripts/ensure-schema.mjs` and mirrored in the Drizzle schema (`packages/database-pg/src/schema/pharmacy.ts`, `pharmacy-erp.ts`). `CREATE INDEX IF NOT EXISTS` means a redeploy is safe and a database that already has an index is left alone.

### 3.1 Batches — `pharmacy_medicine_batches`

The hottest table in the system: every FEFO plan, every availability check and every stock figure reads it.

| Index | Columns | Why it exists / queries served |
| --- | --- | --- |
| `pharmacy_medicine_batches_medicine_expiry_idx` | `(medicine_id, expiry_date)` | The FEFO candidate query, which filters by medicine and orders by expiry ascending. This is the single most important index in Phase 4: without it, every allocation sorts the medicine's batches at query time. Also serves the branch-wide `earliestExpiry` in the stock list. |
| `pharmacy_medicine_batches_medicine_wh_expiry_idx` | `(medicine_id, warehouse_id, expiry_date)` | The warehouse-scoped variant of the same query — FEFO and availability when a `warehouseId` is supplied, which is the normal case for a till or a dispatch. Lets the planner satisfy the filter and the ordering from one index. |
| `pharmacy_medicine_batches_expiry_qty_idx` | `(expiry_date, quantity)` | Expiry bucketing and the near-expiry and expired reports, which range-scan on expiry date across the branch and discard zero-quantity rows. Serves `GET inventory/expiry/buckets` and `GET inventory/expiry/batches`. |
| `pharmacy_medicine_batches_wh_qty_idx` | `(warehouse_id, quantity)` | Per-warehouse rollups: valuation by warehouse, the warehouse split on the product page, warehouse-scoped stock totals, and the stock-aging report. |
| `pharmacy_medicine_batches_medicine_batchno_idx` | `(medicine_id, batch_number)` | `receiveBatch` merge-on-receipt, which looks a batch up by medicine plus batch number on every GRN line before deciding whether to create or merge. Also serves batch-number search in the batch register. |

### 3.2 Stock ledger — `pharmacy_stock_movements`

| Index | Columns | Why it exists / queries served |
| --- | --- | --- |
| `pharmacy_stock_movements_org_branch_created_idx` | `(organization_id, branch_id, created_at)` | The default ledger register view and the dashboard's recent-movements panel: tenant-scoped, branch-scoped, newest first. |
| `pharmacy_stock_movements_medicine_created_idx` | `(medicine_id, created_at)` | Per-product movement history on the product inventory page, and the ledger filtered by medicine. Also serves the reorder report's outbound-consumption subquery, which sums sales per medicine over a date window. |
| `pharmacy_stock_movements_wh_created_idx` | `(warehouse_id, created_at)` | Warehouse-filtered ledger views. |
| `pharmacy_stock_movements_batch_created_idx` | `(batch_id, created_at)` | The movement list on the batch detail page and batch traceability. |
| `pharmacy_stock_movements_reference_idx` | `(reference_type, reference_id)` | Document drill-through — "show me every movement this GRN / invoice / adjustment caused" — and the `hasPosted` replay guard, which asks whether a document has already written movements. |
| `pharmacy_stock_movements_type_created_idx` | `(movement_type, created_at)` | Movement-type filtering, including the alias expansion that turns a canonical type into its legacy equivalents. Serves the slow-moving report, which looks for the most recent outbound movement per product. |
| `pharmacy_stock_movements_idem_uq` | **UNIQUE** `(organization_id, idempotency_key)` | Correctness, not speed, and the one index whose absence would cause data loss rather than slowness. It is what makes a retried posting impossible to double-apply. NULL keys are unconstrained in PostgreSQL, so unkeyed movements are unaffected. |

### 3.3 Reservations — `pharmacy_stock_reservations`

| Index | Columns | Why it exists / queries served |
| --- | --- | --- |
| `pharmacy_stock_reservations_med_status_idx` | `(medicine_id, status)` | Active-reservation lookups per product. |
| `pharmacy_stock_reservations_batch_status_idx` | `(batch_id, status)` | The reservation list on the batch detail page, and release-by-batch. |
| `pharmacy_stock_reservations_ref_idx` | `(reference_type, reference_id)` | Releasing or consuming every reservation an order holds — the hot path when a reserved order is invoiced or cancelled. |
| `pharmacy_stock_reservations_org_branch_status_idx` | `(organization_id, branch_id, status)` | The dashboard's active-reservation count and the `stale_active_reservations` data-quality check. |

### 3.4 Products and warehouses

| Index | Columns | Why it exists / queries served |
| --- | --- | --- |
| `pharmacy_medicines_org_branch_status_idx` | `(organization_id, branch_id, status)` | Every branch-scoped product list. The reorder report filters to `active` products, so this covers its driving table. |
| `pharmacy_medicines_org_branch_sku_idx` | `(organization_id, branch_id, sku)` | SKU lookup, including cross-branch destination matching on a transfer, which resolves the destination medicine by SKU. |
| `pharmacy_medicines_org_company_idx` | `(organization_id, company_id)` | Company filtering on the stock list, batch register and valuation-by-company. |
| `pharmacy_warehouses_org_branch_status_idx` | `(organization_id, branch_id, status)` | Warehouse resolution, which runs on virtually every inventory request as the security boundary. |

### 3.5 Documents

| Index | Columns | Why it exists / queries served |
| --- | --- | --- |
| `pharmacy_inventory_settings_org_branch_uq` | **UNIQUE** `(organization_id, branch_id)` | Guarantees one settings row per scope and serves the policy resolution chain, which runs on every posting and every report. |
| `pharmacy_stock_transfers_org_number_uq` | **UNIQUE** `(organization_id, transfer_number)` | Enforces unique document numbers; the numbering service's retry loop depends on this constraint to detect a collision. |
| `pharmacy_stock_transfers_org_branch_status_idx` | `(organization_id, branch_id, status)` | Transfer register filtered by status, and the dashboard's pending-transfer count. |
| `pharmacy_stock_transfers_org_created_idx` | `(organization_id, created_at)` | Default newest-first ordering of the register, and date-range filters. |
| `pharmacy_stock_transfers_from_wh_idx` | `(from_warehouse_id, status)` | "Outbound transfers from this warehouse". |
| `pharmacy_stock_transfers_to_wh_idx` | `(to_warehouse_id, status)` | "Inbound transfers awaiting receipt here" — the receiving clerk's working list. |
| `pharmacy_stock_transfer_lines_transfer_idx` | `(transfer_id)` | Loading a transfer's lines on every detail view and every state transition. |
| `pharmacy_stock_transfer_lines_medicine_idx` | `(medicine_id)` | In-transit quantity per product. |
| `pharmacy_stock_adjustments_org_number_uq` | **UNIQUE** `(organization_id, adjustment_number)` | As above, for adjustments. |
| `pharmacy_stock_adjustments_org_branch_status_idx` | `(organization_id, branch_id, status)` | Adjustment register by status and the dashboard's pending-approval count. |
| `pharmacy_stock_adjustments_org_created_idx` | `(organization_id, created_at)` | Register ordering and date filters. |
| `pharmacy_stock_adjustment_lines_adj_idx` | `(adjustment_id)` | Loading lines on detail and on posting. |
| `pharmacy_stock_adjustment_lines_medicine_idx` | `(medicine_id)` | Adjustment history per product. |
| `pharmacy_stock_counts_org_number_uq` | **UNIQUE** `(organization_id, count_number)` | As above, for counts. |
| `pharmacy_stock_counts_org_branch_status_idx` | `(organization_id, branch_id, status)` | Count register by status. |
| `pharmacy_stock_counts_org_created_idx` | `(organization_id, created_at)` | Register ordering. |
| `pharmacy_stock_count_lines_count_idx` | `(count_id)` | Paginating a count sheet, which can hold up to 5000 lines — the index that keeps the sheet usable on a handheld device. |
| `pharmacy_stock_count_lines_medicine_idx` | `(medicine_id)` | Count history per product. |

Thirty-eight indexes in total, of which 35 were added by Phase 4 and the three on `pharmacy_medicines` already existed from Phase 3 and are re-asserted by the same boot block. Five are unique: four enforcing document-number and settings uniqueness, and one enforcing idempotency. The other thirty-three serve access paths.

---

## 4. The main performance win: pagination

The largest expected improvement is not from an index. It is from removing load-all endpoints from the inventory workflow.

Before Phase 4, an operator looking at stock called `GET /v1/pharmacy/medicines`, which returns the entire catalogue with `currentStock`, or `GET /v1/pharmacy/batches`, which returns every batch in the branch. Both responses grow linearly with the catalogue, and the whole payload is serialised, transferred and rendered before the first row is visible. At a few thousand products that is a multi-megabyte response for a screen showing 25 rows.

Every Phase 4 list endpoint is paginated, filtered and sorted **in SQL**:

| Old path | New path | Change |
| --- | --- | --- |
| `GET /v1/pharmacy/medicines` (all products) | `GET /v1/pharmacy/inventory/stock` | Page of 25, server-side search and stock-state filter. |
| `GET /v1/pharmacy/batches` (all batches) | `GET /v1/pharmacy/inventory/batches` | Page of 25, server-side search, status and expiry filters. |
| Client-side computation of stock states | `stockState` filter as a SQL `HAVING` clause | The filter runs where the data is, so a filtered page reads only matching rows. |
| Client-side totals over a fetched array | `totals` computed over the full filter server-side | Footer totals are correct for the whole result set without transferring it. |

Two secondary wins follow from the same change. Filter-wide totals are computed in the same aggregate pass as the page, so the footer cannot disagree with the list and does not need a second query. And the stock numbers are derived once, in `stockExpressions`, as SQL aggregate expressions evaluated by PostgreSQL rather than assembled in JavaScript from a fetched array.

The old endpoints remain for existing retail callers and are unchanged (`INVENTORY_API.md` §13).

---

## 5. Known risks

Stated because they are visible in the code, not because they have been observed.

**`pharmacy_stock_movements` is the fastest-growing table in the system.** It is append-only and takes a row for every stock event: every GRN line, every sale line, every transfer leg, every adjustment line, every reservation, and two rows for every reclassification. In a busy distribution branch it will outgrow every other inventory table by an order of magnitude. There is currently **no partitioning, no archival and no retention policy**. All six access-path indexes lead with a selective column, so reads should stay bounded, but the table will grow without limit and the indexes grow with it. A retention or partitioning strategy is deferred work, not solved work.

**`recomputeMedicineStock` runs a `SUM` over all batches of a medicine, once per document line.** After every posting the engine recomputes the `current_stock` cache with `SELECT coalesce(sum(quantity), 0) FROM pharmacy_medicine_batches WHERE medicine_id = $1`. A GRN with fifty lines runs fifty of these. Each is indexed and cheap on a normal product, but the cost is linear in lines per document and in batches per product, so a large document against products with long batch histories is the realistic hot spot. It is also **not warehouse-filtered**, so the sum widens as a product accumulates batches across warehouses. Batching the recompute to one statement per document at the end of the transaction is the obvious optimisation and has not been done.

**Valuation scans every batch in scope.** `valuation/summary`, `by-warehouse`, `by-company` and `report` all aggregate over the batch table with the costing fallback chain applied per row (three `nullif` coalesces). There is no materialised valuation and no cache. This is why valuation carries the loosest budget at 1000 ms, and it is the endpoint most likely to degrade first as the batch table grows. The dashboard is exposed to the same cost because it embeds the valuation summary.

**The dashboard is a fan-out.** One request issues roughly a dozen counts plus the valuation summary plus the expiry bucketing plus a top-10 valuation query plus a recent-movements query. They are correct and individually indexed, but the endpoint's latency is the sum of its parts, and a regression in any one of them shows up here first.

**`GET inventory/reconcile` is deliberately expensive.** It compares the cache, the batch sum and the ledger net for every product in the branch. It is an operator tool with no budget assigned and should not be put on a dashboard or polled.

---

## 6. Reproducing the measurement

After deploying the API (which is what applies the boot DDL and creates the indexes above):

```powershell
cd "d:\My POS SYSTEMS REPOS\backend-system"
$env:API_BASE = "https://backend-system-production-28a3.up.railway.app"
$env:DIST_EMAIL = "admin.distribution@pops.demo"
$env:DIST_PASSWORD = "<password>"
$env:BRANCH_CODE = "DIST-HQ"
node scripts/phase4-inventory-tests.mjs
```

The run writes `docs/PHASE_4_TEST_RESULTS.json`, whose `performance` array holds `{ label, status, best, median, worst, budgetMs }` for each of the nine probes, and whose `requestTimings` array holds the raw millisecond timing of every labelled request the suite made. Copy the medians into §2 of this document, replacing the "not yet measured" text, and record the run's date, the API URL and the approximate row counts of `pharmacy_medicines`, `pharmacy_medicine_batches` and `pharmacy_stock_movements` at the time — a latency figure without a row count is not a measurement.

Note that this exercises the suite's own small dataset. To measure anything meaningful, run it against a branch with representative volume, or seed one first.

---

## 7. What to check after deploying

Before accepting the numbers, confirm the planner is actually using the indexes. Run `EXPLAIN ANALYZE` on these five, which are the queries the rest of the system's performance rests on:

1. **The FEFO candidate query** — batches for one medicine in one warehouse, ordered by expiry ascending. Expect an index scan on `pharmacy_medicine_batches_medicine_wh_expiry_idx` with no sort node. A `Sort` node here means FEFO is sorting at query time on every allocation.
2. **The stock list aggregate** — the grouped query behind `GET inventory/stock` with a `stockState` filter and its `HAVING` clause. Confirm the product filter is applied before aggregation, not after.
3. **The ledger register** — branch-scoped, newest first, page of 50. Expect a backward index scan on `pharmacy_stock_movements_org_branch_created_idx` with a `Limit` that stops early, not a full scan and sort.
4. **The valuation aggregate** — the whole-branch batch scan with the costing chain. Measure it, because this is the endpoint expected to degrade first; record the row count alongside the time so the trend is interpretable later.
5. **The reorder consumption subquery** — the per-medicine sum of outbound movements over the lookback window. Confirm it uses `pharmacy_stock_movements_medicine_created_idx` and does not re-scan the movements table per product.

Also worth checking at the same time: that `ANALYZE` has run on the new tables (a freshly created table has no statistics and the planner will guess), and that the unique index `pharmacy_stock_movements_idem_uq` exists — if the boot DDL failed part-way, idempotency silently stops working while everything still appears to function.
