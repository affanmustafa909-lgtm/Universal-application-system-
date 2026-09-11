# Phase 4 — Inventory, Batch, Expiry, FEFO: Final Report

**Date:** 2026-09-11
**Status:** Code-complete in both repositories, type-checked, and built. **Not deployed. Not tested.** The backend type check passes and the launcher production build succeeds; no behavioural test has been run, no endpoint has served a live request, and no performance figure has been measured. §10 states exactly what was verified and §11 states what was not.
**Scope:** Pharmaceutical distribution inventory — one authoritative stock model, batch and expiry control, FEFO allocation, stock ledger, transfers, adjustments, counts, valuation, reservations, and the Dist-native screens over them.
**Supporting documents:** `INVENTORY_AUDIT.md` (pre-implementation audit), `INVENTORY_ARCHITECTURE.md`, `INVENTORY_API.md`, `INVENTORY_BUSINESS_RULES.md`, `INVENTORY_TESTING.md`, `INVENTORY_PERFORMANCE.md`. Phase 3 is reported in `PHASE_3_REPORT.md`.

---

## 1. Summary

Phase 4 replaced an inventory implementation that consisted of one 406-line stock engine and a handful of load-all read endpoints with a complete inventory control layer: eleven services under `api/src/pharmacy/inventory/`, a hardened stock engine, 46 new HTTP routes under `/v1/pharmacy/inventory/*`, six new tables and a workflow schema on two previously dead ones, 35 new indexes, ten new permission identifiers, and ten Dist-native screens. Stock is now modelled as Branch → Warehouse → Product → Batch → State, with the batch row as the single source of truth for quantity, `pharmacy_medicines.currentStock` demoted to a maintained cache, and `pharmacy_stock_movements` promoted to an append-only ledger that records the unit cost and running balance of every movement. Overselling is closed by `SELECT … FOR UPDATE` on FEFO candidates and on every bucket write; double-posting is closed by a unique idempotency key per organisation; and expired stock is excluded from allocation instead of being dispensed first. The existing engine was kept and hardened rather than replaced, the retail pharmacy edition's endpoints were left working, and no historical ledger row was rewritten.

Its true status is narrow and should not be overstated: **code-complete, type-checked, built — not deployed, not tested.** The backend `tsc --noEmit` exits 0 and the launcher `vite build` succeeds. That is the whole of the verification. The integration suite that would prove the stock arithmetic, the locking and the idempotency has been written and has never been executed, because there is no API and no database available in this environment to execute it against. Every behavioural claim in this report and in the five inventory documents is derived by reading source code.

---

## 2. The audit that preceded it

No code was changed before `INVENTORY_AUDIT.md` was written. The audit found a system whose single-funnel design was sound and whose behaviour was not. Six findings mattered enough to define the phase.

**FEFO was dispensing expired stock.** `deductFefo` selected candidate batches with `quantity > 0` and ordered them by `expiryDate ASC`. There was no expiry predicate. Expired batches therefore sorted *first* and were allocated *first* — the oldest, most expired stock in the warehouse was the stock the system preferred to ship. In a pharmaceutical distribution business this is the most serious defect in the list, and it was not a corner case: it was the normal path for any product with an expired batch on hand. The same query also ignored `batches.status`, so a batch marked blocked, quarantined or recalled was picked like any other.

**Purchase returns were mislabelled as sales.** The engine hard-coded `movementType: "sale_out"` on every deduction (`engine:191` and `:229` before the change), so returning stock to a supplier, invoicing a wholesale order and selling over the counter were all written to the ledger as the same movement type. Only `referenceType` distinguished them. Any movement report grouped by type counted supplier returns as sales.

**`reservedQuantity` was never written.** The column existed on `pharmacy_medicine_batches` and nothing wrote it. The `stock_reserved` order status set a timestamp and held no stock at all, so the same physical units could be promised to several orders and every one of them would read as fulfillable until the first invoice consumed the stock. Worse, the availability calculation never subtracted reserved quantity, so if any future code had started populating the column, the result would have been silent overselling rather than a visible error.

**No row locking existed anywhere.** A search for `FOR UPDATE` across `api/src/pharmacy` returned nothing. Two concurrent sales could both read `currentStock`, both pass the `currentStock >= qty` check, and both write a decremented batch quantity — last writer wins, one sale's deduction lost, stock oversold with no record of how.

**NULL-warehouse batches counted as available in every warehouse.** `batches.warehouse_id` is a bare `uuid` with no foreign key, and every pre-warehouse batch row has it `NULL`. The FEFO predicate was `(warehouse_id = $wh OR warehouse_id IS NULL)`, so a legacy batch was a candidate in *every* warehouse of the branch simultaneously — warehouse isolation was nominal.

**And the supporting cast:** stock transfers were dead schema with no service, no API and no UI, while the Dist nav's "Stock Transfer" link pointed at the restaurant ingredient transfer screen; there was no stock adjustment capability at all, so shrinkage, damage and write-off could not be recorded; movements were write-only with no read API; `currentStock` was writable outside the engine by `createMedicine` and `updateMedicine`, so it could drift from the batch rows in either direction; opening stock was a side effect of medicine creation that wrote no ledger row; GRN had no idempotency guard, so a retried POST double-received stock; and there was no valuation service, with four different report sites computing stock value from three different columns.

---

## 3. Services created

Eleven services under `api/src/pharmacy/inventory/`, plus the pre-existing engine which was hardened rather than replaced. All are registered in `api/src/pharmacy/pharmacy.module.ts`. **Nothing outside these files computes or mutates stock.**

| Service | File | Owns |
| --- | --- | --- |
| `PharmacyStockEngine` | `pharmacy-stock.engine.ts` (kept, hardened) | The only code that mutates batch quantities: `deductFefo`, `restoreBatch`, `receiveBatch`, `moveBetweenStates`, `reserve`, `releaseReservations`, `applyBatchDelta`, `recomputeMedicineStock`, `ensureDefaultWarehouse` |
| `InventorySettingsService` | `inventory-settings.service.ts` | Policy resolution — branch row, then organisation row, then audited defaults — and validation of all thirteen policy fields |
| `StockLedgerService` | `stock-ledger.service.ts` | Ledger append, the `hasPosted` idempotency probe, movement-type normalisation and legacy alias expansion, the paginated movement register and its totals |
| `FefoService` | `fefo.service.ts` | Candidate selection, expiry and hold exclusion with reasons, allocation planning, row locking |
| `StockAvailabilityService` | `stock-availability.service.ts` | The single definition of every stock number, branch and warehouse resolution, `checkAvailability` — the Phase 5 endpoint |
| `BatchStockService` | `batch-stock.service.ts` | Batch register, batch detail with traceability, derived batch status, manual hold and release, expiry buckets; also the shared `normalizePage` / `pageResult` helpers |
| `InventoryService` | `inventory.service.ts` | Stock-by-product list and totals, product inventory detail, the inventory dashboard, reorder suggestions, slow-moving, stock aging, reconciliation, data-quality checks |
| `InventoryValuationService` | `inventory-valuation.service.ts` | The costing fallback chain and all four valuation reads |
| `StockTransferService` | `stock-transfer.service.ts` | Transfer documents and the full state machine, including cross-branch SKU matching |
| `StockAdjustmentService` | `stock-adjustment.service.ts` | Adjustment documents, type semantics, approval policy, posting to stock, and `createPostedAdjustmentWithin` for the count path |
| `StockCountService` | `stock-count.service.ts` | Count sheet generation, recording, variance posting via adjustments, cancellation |
| `InventoryNumberingService` | `inventory-numbering.service.ts` | `TRF` / `ADJ` / `CNT` document numbers with unique-violation retry |

Dependency direction is one-way. Settings, ledger and FEFO depend on nothing else in the family; availability depends on FEFO and settings; the engine depends on FEFO, ledger and settings; the document services depend on the engine and availability; `InventoryService` composes the read services. `StockCountService` depends on `StockAdjustmentService` and never on the engine — **a count cannot change stock except by producing an adjustment document.**

---

## 4. Database changes

Every change is additive. Applied at boot by the idempotent DDL block in `api/scripts/ensure-schema.mjs:942-1118` and mirrored in the Drizzle schema in both repositories.

### New tables (6)

| Table | Purpose |
| --- | --- |
| `pharmacy_stock_reservations` | One row per held allocation: `medicine_id`, `batch_id`, `quantity`, `status` (`active` / `released` / `consumed`), `reference_type`, `reference_id`, `expires_at`, `released_at` |
| `pharmacy_inventory_settings` | Per-branch policy; the row with `branch_id IS NULL` is the organisation default |
| `pharmacy_stock_adjustments` | Adjustment document headers |
| `pharmacy_stock_adjustment_lines` | Adjustment lines: **signed** quantity, target `stock_state`, frozen `unit_cost_pkr` / `value_pkr` |
| `pharmacy_stock_counts` | Count sheet headers |
| `pharmacy_stock_count_lines` | Count lines: `system_quantity`, nullable `counted_quantity`, `variance_quantity`, and a `counted` boolean so an uncounted line is never read as a counted zero |

`pharmacy_stock_transfers` and `pharmacy_stock_transfer_lines` are **not** in this list: they already existed as dead schema and were given a workflow instead of being recreated.

### New columns on `pharmacy_medicine_batches` (5)

| Column | Type |
| --- | --- |
| `quarantine_quantity` | `integer NOT NULL DEFAULT 0` |
| `blocked_quantity` | `integer NOT NULL DEFAULT 0` |
| `supplier_id` | `uuid` (no FK — avoids an import cycle) |
| `grn_id` | `uuid` (no FK) |
| `hold_reason` | `text` |

`reserved_quantity` and `damaged_quantity` already existed and were never written before Phase 4; they are now live buckets.

### New columns on `pharmacy_stock_movements` (5)

| Column | Type |
| --- | --- |
| `stock_state` | `text NOT NULL DEFAULT 'available'` |
| `unit_cost_pkr` | `integer NOT NULL DEFAULT 0` |
| `value_pkr` | `integer NOT NULL DEFAULT 0` |
| `idempotency_key` | `text` |
| `reverses_movement_id` | `uuid` |

### New columns on `pharmacy_stock_transfers` (14) and `pharmacy_stock_transfer_lines` (6)

Header: `to_branch_id`, `transfer_date`, `reason`, `submitted_by_user_id`, `approved_by_user_id`, `dispatched_by_user_id`, `received_by_user_id`, `cancelled_by_user_id`, `submitted_at`, `approved_at`, `dispatched_at`, `received_at`, `cancelled_at`, `cancel_reason`.
Lines: `received_quantity`, `batch_number`, `expiry_date`, `unit_cost_pkr`, `destination_batch_id`, `notes`.

### Every new index, by name (35)

| Index | Table | Columns | Unique |
| --- | --- | --- | --- |
| `pharmacy_medicine_batches_medicine_expiry_idx` | `pharmacy_medicine_batches` | `(medicine_id, expiry_date)` | |
| `pharmacy_medicine_batches_expiry_qty_idx` | `pharmacy_medicine_batches` | `(expiry_date, quantity)` | |
| `pharmacy_medicine_batches_medicine_wh_expiry_idx` | `pharmacy_medicine_batches` | `(medicine_id, warehouse_id, expiry_date)` | |
| `pharmacy_medicine_batches_wh_qty_idx` | `pharmacy_medicine_batches` | `(warehouse_id, quantity)` | |
| `pharmacy_medicine_batches_medicine_batchno_idx` | `pharmacy_medicine_batches` | `(medicine_id, batch_number)` | |
| `pharmacy_stock_movements_org_branch_created_idx` | `pharmacy_stock_movements` | `(organization_id, branch_id, created_at)` | |
| `pharmacy_stock_movements_medicine_created_idx` | `pharmacy_stock_movements` | `(medicine_id, created_at)` | |
| `pharmacy_stock_movements_wh_created_idx` | `pharmacy_stock_movements` | `(warehouse_id, created_at)` | |
| `pharmacy_stock_movements_batch_created_idx` | `pharmacy_stock_movements` | `(batch_id, created_at)` | |
| `pharmacy_stock_movements_reference_idx` | `pharmacy_stock_movements` | `(reference_type, reference_id)` | |
| `pharmacy_stock_movements_type_created_idx` | `pharmacy_stock_movements` | `(movement_type, created_at)` | |
| `pharmacy_stock_movements_idem_uq` | `pharmacy_stock_movements` | `(organization_id, idempotency_key)` | **UNIQUE** |
| `pharmacy_warehouses_org_branch_status_idx` | `pharmacy_warehouses` | `(organization_id, branch_id, status)` | |
| `pharmacy_stock_reservations_med_status_idx` | `pharmacy_stock_reservations` | `(medicine_id, status)` | |
| `pharmacy_stock_reservations_batch_status_idx` | `pharmacy_stock_reservations` | `(batch_id, status)` | |
| `pharmacy_stock_reservations_ref_idx` | `pharmacy_stock_reservations` | `(reference_type, reference_id)` | |
| `pharmacy_stock_reservations_org_branch_status_idx` | `pharmacy_stock_reservations` | `(organization_id, branch_id, status)` | |
| `pharmacy_inventory_settings_org_branch_uq` | `pharmacy_inventory_settings` | `(organization_id, branch_id)` | **UNIQUE** |
| `pharmacy_stock_transfers_org_number_uq` | `pharmacy_stock_transfers` | `(organization_id, transfer_number)` | **UNIQUE** |
| `pharmacy_stock_transfers_org_branch_status_idx` | `pharmacy_stock_transfers` | `(organization_id, branch_id, status)` | |
| `pharmacy_stock_transfers_org_created_idx` | `pharmacy_stock_transfers` | `(organization_id, created_at)` | |
| `pharmacy_stock_transfers_from_wh_idx` | `pharmacy_stock_transfers` | `(from_warehouse_id, status)` | |
| `pharmacy_stock_transfers_to_wh_idx` | `pharmacy_stock_transfers` | `(to_warehouse_id, status)` | |
| `pharmacy_stock_transfer_lines_transfer_idx` | `pharmacy_stock_transfer_lines` | `(transfer_id)` | |
| `pharmacy_stock_transfer_lines_medicine_idx` | `pharmacy_stock_transfer_lines` | `(medicine_id)` | |
| `pharmacy_stock_adjustments_org_number_uq` | `pharmacy_stock_adjustments` | `(organization_id, adjustment_number)` | **UNIQUE** |
| `pharmacy_stock_adjustments_org_branch_status_idx` | `pharmacy_stock_adjustments` | `(organization_id, branch_id, status)` | |
| `pharmacy_stock_adjustments_org_created_idx` | `pharmacy_stock_adjustments` | `(organization_id, created_at)` | |
| `pharmacy_stock_adjustment_lines_adj_idx` | `pharmacy_stock_adjustment_lines` | `(adjustment_id)` | |
| `pharmacy_stock_adjustment_lines_medicine_idx` | `pharmacy_stock_adjustment_lines` | `(medicine_id)` | |
| `pharmacy_stock_counts_org_number_uq` | `pharmacy_stock_counts` | `(organization_id, count_number)` | **UNIQUE** |
| `pharmacy_stock_counts_org_branch_status_idx` | `pharmacy_stock_counts` | `(organization_id, branch_id, status)` | |
| `pharmacy_stock_counts_org_created_idx` | `pharmacy_stock_counts` | `(organization_id, created_at)` | |
| `pharmacy_stock_count_lines_count_idx` | `pharmacy_stock_count_lines` | `(count_id)` | |
| `pharmacy_stock_count_lines_medicine_idx` | `pharmacy_stock_count_lines` | `(medicine_id)` | |

The three `pharmacy_medicines` indexes from Phase 3 are re-asserted by the same boot block, giving 38 inventory-relevant indexes in total. Five are unique: four enforce document-number and settings uniqueness, one enforces idempotency. `pharmacy_stock_movements_idem_uq` is the only index whose absence would cause data loss rather than slowness — PostgreSQL treats NULL keys as distinct, so unkeyed movements are unconstrained while keyed postings can land exactly once.

### What was not done

**No column was dropped. No type was narrowed. No cascade was made destructive. No data was deleted or rewritten.** Historical `movementType` values (`grn_in`, `sale_out`, `return_in`, …) are preserved exactly as stored and read through a normalisation map. New foreign keys use `ON DELETE SET NULL` or `ON DELETE RESTRICT`; the only `CASCADE`s are document-header-to-own-lines and organisation-to-own-rows, which are the existing convention throughout the schema.

---

## 5. API endpoints

**46 routes** across 12 groups, all under `/v1/pharmacy/inventory/*` on `PharmacyInventoryController`.

| Group | Routes |
| --- | --- |
| Dashboard and stock | 3 |
| Availability | 2 |
| Batches and expiry | 5 |
| Ledger | 3 |
| Valuation | 4 |
| Planning reports (reorder, slow-moving, aging) | 3 |
| Integrity tools (reconcile, data quality) | 2 |
| Settings | 2 |
| Transfers | 9 |
| Adjustments | 7 |
| Counts | 6 |

Controller-wide: `JwtAuthGuard`, `PermissionsGuard`, `SystemTypeGuard` with `@RequireSystemType("pharmacy", "distribution")`. `organizationId` always comes from the JWT and never from the query string. `branchCode` is resolved to a branch id inside the services, scoped to the caller's organisation; any `warehouseId` is validated against that branch before it reaches a query, so an unknown or foreign warehouse returns `404` rather than an empty result. Every list endpoint is paginated and searched server-side — **there is no load-all endpoint in this family** — with `pageSize` clamped at 100 (200 for the ledger).

**The full route list, with every query parameter, response shape, permission list and error code, is in `INVENTORY_API.md`.** The front-end client is 1:1 with it: `apps/launcher/src/pharmacy/api/pharmacy-inventory.ts` exposes `inventoryApi`, `batchesApi`, `ledgerApi`, `valuationApi`, `inventorySettingsApi`, `transfersApi`, `adjustmentsApi` and `countsApi`.

Pre-existing routes were not modified except where a behaviour change was unavoidable; `INVENTORY_API.md` §13 lists them and `INVENTORY_BUSINESS_RULES.md` §13 lists the seven user-visible behaviour changes.

---

## 6. Frontend delivered

Ten Dist-native screens, built on the existing Dist design system (`distribution/ui/DistUi.tsx` and `distribution/components/`), mounted in `apps/launcher/src/routes/distributionRoutes.tsx`.

| Screen | Component | Route |
| --- | --- | --- |
| Inventory dashboard | `DistributionInventoryDashboardPage.tsx` | `distribution/inventory` |
| Stock by product | `DistributionStockPage.tsx` | `distribution/stock` |
| Product inventory detail | `DistributionProductInventoryPage.tsx` | `distribution/inventory/product/:medicineId` |
| Batch register | `DistributionBatchesPage.tsx` | `distribution/batches` |
| Expiry and near expiry | `DistributionExpiryPage.tsx` | `distribution/expiry` |
| Stock ledger | `DistributionStockLedgerPage.tsx` | `distribution/stock-ledger` |
| Stock transfers | `DistributionStockTransfersPage.tsx` | `distribution/stock-transfers` |
| Stock adjustments | `DistributionStockAdjustmentsPage.tsx` | `distribution/stock-adjustments` |
| Stock count | `DistributionStockCountPage.tsx` | `distribution/stock-count` |
| Inventory reports | `DistributionInventoryReportsPage.tsx` | `distribution/inventory-reports` |

`distribution/inventory` and `distribution/expiry` previously re-exported the **shared pharmacy** `PharmacyInventoryPage` and `PharmacyExpiryPage`, which loaded the entire medicine catalogue and the entire batch table respectively and filtered in React. Both routes now point at Dist-native, server-paginated screens. The shared pharmacy pages are untouched and the retail edition still uses them.

**Shared components.** `distribution/components/DistInventoryShared.tsx` was added for the primitives the ten screens have in common, alongside the existing `DistPagination`, `DistMasterDrawer`, `DistDrawerField` and `DistWidgetSection`. Seven of the inventory screens use the shared `exportRowsToCsv` helper, so a filtered inventory view can be exported without a server-side export job.

**The nav change.** `distribution/spec/nav.ts` previously routed the Inventory group's "Stock Transfer" item to `multi-branch/transfers` — the **restaurant ingredient transfer screen**, whose columns are `ingredientName`, `qty` and `unit` and whose data comes from `fetchTransferIngredients`. It was not a pharmaceutical screen in any sense. The item now points at `distribution/stock-transfers`, and the comment in `nav.ts:37` records why. The Inventory group now lists: Inventory Dashboard, Stock by Product, Batches, Expiry & Near Expiry, Stock Ledger, Stock Transfers, Stock Adjustments, Stock Count, Inventory Reports, Products / Medicines, Warehouses. The restaurant multi-branch screens are untouched and still reachable at their own routes.

**Report Center integration.** `distribution/spec/reports.ts` gained eleven entries in a new `Inventory` category: `inv-stock`, `inv-batches`, `inv-expiry`, `inv-ledger`, `inv-valuation`, `inv-reorder`, `inv-slow-moving`, `inv-aging`, `inv-transfers`, `inv-adjustments`, `inv-reconcile`. These carry a `to` deep link rather than a report-id query, because each one already has a dedicated screen with batch-level filters — the catalogue navigates to the screen instead of re-implementing the query behind a generic report runner. The five pre-existing Phase 2 `Stock` category reports (`stock-near-expiry`, `stock-by-warehouse`, `slow-moving`, `batch-trace`, `company-stock`) were left exactly as they were.

---

## 7. Integration with existing documents

Phase 4 did not create a parallel document flow. Every existing document that moves stock now moves it through the hardened engine, with a correct movement type and an idempotency key.

| Document | Path | Movement type | Idempotency key | Notes |
| --- | --- | --- | --- | --- |
| GRN | `POST /v1/pharmacy/grns` → `createGrn` → `receiveBatch` | `GRN` | `grn-doc:<caller key>` at document level, `grn:<grnId>:<lineIndex>` per line | The document key is the one path that **returns the prior document** instead of erroring: if `hasPosted` finds the key, the transaction looks up the movement's `referenceId` and returns the GRN that already received the stock. Without a caller-supplied `idempotencyKey` the behaviour is exactly as before Phase 4. |
| Distribution invoice | `POST /distribution/orders/:id/invoice` → `releaseReservations` then `deductFefo` | `SALE` | `dist-invoice:<invoiceId>:<lineIndex>` | Now releases the order's reservations as `released` **before** deducting, so the invoice's own FEFO pass can see the units it is about to consume. The ledger shows a release followed by a sale instead of one unexplained deduction. |
| Sale return | `POST /v1/pharmacy/sales/returns` → `restoreBatch` | `SALES_RETURN` | `sale-return:<returnId>:<lineIndex>` | |
| Purchase return | `POST /v1/pharmacy/purchase-returns` → `deductFefo` | **`PURCHASE_RETURN`** | `purchase-return:<returnId>:<lineIndex>` | Was written as `sale_out`. Historical rows are unchanged; a report spanning the deployment date shows both. |
| Wholesale return | `POST /distribution/wholesale-returns` → `restoreBatch` when a `batchId` is given, otherwise `receiveBatch` into a synthetic `WRN-` batch | `SALES_RETURN` | `wholesale-return:<returnId>:<lineIndex>` | The two paths are mutually exclusive branches of one `if`, so the shared key cannot collide within a transaction. |
| Opening stock | `createMedicine` → `receiveBatch` | `OPENING_STOCK` | `opening:<medicineId>` | Was a direct batch insert with no ledger row and a NULL warehouse. Now goes through the engine, writes a movement, uses batch number `OPEN-<sku>`, and attaches to the branch default warehouse. Products created before this change keep their NULL-warehouse, ledger-less opening batches. |
| Order reservation | `advanceDistOrderStatus` → `stock_reserved` → `reserve` | `RESERVATION` | — (guarded by the order-status transition and row locks) | Was a timestamp with no inventory effect. Now moves quantity from `quantity` into `reserved_quantity`, inserts a reservation row and writes a ledger movement, all in one transaction. Any shortfall fails the transition with a `400` naming the product; an order that already holds a reservation returns `409`. Cancelling a reserved order releases as `released` and returns the units. |
| Adjustment posting | `StockAdjustmentService` | `ADJUSTMENT_IN` / `ADJUSTMENT_OUT` / `DAMAGE` / `EXPIRY` | `adjustment:<adjustmentId>:<lineId>` | |
| Transfer dispatch / receive | `StockTransferService` | `TRANSFER_OUT` / `TRANSFER_IN` | `transfer:<transferId>:dispatch:<lineId>`, `transfer:<transferId>:receive:<lineId>` and `…:<runningTotal>` on a top-up | |

**Where the key is withheld, and why.** A single logical deduction can span several batches, and each allocation writes its own ledger row. Where the number of allocations cannot be predicted in advance — the transfer dispatch path and the adjustment `decrease` / `write_off` path — the caller probes whether the chosen batch alone covers the line and only passes a key when it does. Otherwise it withholds the key and relies on the `SELECT … FOR UPDATE` header status guard, which raises `409` on a retried transition rather than posting twice.

`AccountingHooksService` and its `(source, sourceRef)` idempotency were not touched.

---

## 8. Bugs found and fixed during Phase 4

**FEFO was dispensing expired stock.** The candidate query filtered on `quantity > 0` only and ordered by expiry ascending, so expired batches sorted first and were allocated first. `FefoService` now excludes them under `blockExpiredSale` (default `true`) and returns them in `excluded[]` with the reason `expired`, so the operator sees that the stock exists and why it was not offered. The hold check runs before the expiry check, so a batch that is both blocked and expired reports the hold.

**Purchase returns were mislabelled `sale_out` in the ledger.** Every deduction hard-coded the sale movement type. `DEDUCT_TYPE_BY_REFERENCE` and `RESTORE_TYPE_BY_REFERENCE` in the engine now derive the canonical type from `referenceType`, so a purchase return is written as `PURCHASE_RETURN`, a transfer leg as `TRANSFER_OUT` / `TRANSFER_IN`, an adjustment as `ADJUSTMENT_OUT` / `ADJUSTMENT_IN`, and so on. Existing rows were not rewritten; they are normalised on read.

**A multi-batch idempotency key would have collided with itself and aborted the transaction.** This one was introduced by Phase 4's own idempotency work and caught before it shipped. `deductFefo` writes one ledger row per allocation. With a bare caller-supplied key, the second allocation of the same deduction would have violated the new unique `(organization_id, idempotency_key)` index, and because it is a unique-constraint violation inside a transaction, the *entire* posting would have rolled back — a two-batch sale would have failed where a one-batch sale succeeded. The key is now suffixed per allocation, `` `${input.idempotencyKey}#${index}` ``, and the shortfall row written under a permissive negative-stock policy uses the distinct suffix `#short`. The suffix is deterministic: a genuine retry replays the same allocation order against the same batch set and produces the same keys, which the index correctly rejects.

**The `@platform/database-pg` dist build was stale.** The API resolves the database package through its compiled `dist/`, not its `src/`. The new batch state columns, the ledger columns and the five new tables existed in the TypeScript schema but not in the build output, so the schema the running process would have used did not match the schema the code was written against. The backend package was rebuilt; `dist/schema/pharmacy.js` now carries `quarantine_quantity` and `blocked_quantity`. This is the class of defect a type check cannot catch, because the type check reads `src`.

**The test suite was creating medicines with zero prices.** `scripts/phase4-inventory-tests.mjs` posted `purchasePricePkr`, `costPricePkr` and `sellingPricePkr` to `POST /v1/pharmacy/medicines`, but the contract — `createMedicineSchema` in `packages/contracts/src/pharmacy.ts:417-436` — declares `purchasePrice`, `costPrice` and `sellingPrice` without the `Pkr` suffix. Zod strips unknown keys, so every price defaulted to zero and every valuation, unit-cost and captured-cost assertion in the suite would have been measuring nothing while reporting PASS. The suite now posts the contract's field names.

**The ledger returned a raw 500 on an unparseable date.** `GET inventory/ledger?from=not-a-date` built `new Date("not-a-dateT00:00:00.000Z")`, produced an `Invalid Date`, and handed it to the driver. Both boundaries now go through a `boundary()` helper that rejects an unparseable value with `400 Invalid \`from\` date "not-a-date". Expected YYYY-MM-DD.` This satisfies both the Phase 2 requirement that invalid date ranges be handled rather than crash, and the Phase 4 constraint against exposing raw database errors.

**`negativeStockPolicy: "warn"` was indistinguishable from `allow`.** The policy documents three values, but the engine only treated `block` specially — `warn` and `allow` took the same branch, so a branch configured to warn produced no warning anywhere. The engine now emits a Nest logger warning on the `warn` path naming the product, SKU, shortfall quantity, unit, reference type, reference id and warehouse. This is a partial fix and is listed as such in §12: the warning reaches the server log, not the HTTP caller, so a UI still cannot render a per-line "sold into negative stock" badge.

---

## 9. Compliance with the Phase 4 constraints

| Constraint | How it was honoured |
| --- | --- |
| Do not create duplicate inventory systems | One model, one engine, one availability definition. `PharmacyStockEngine` was kept and hardened, not replaced; `applyBatchDelta` is the only writer of batch quantities and `StockLedgerService.append` the only writer of movements. The restaurant ingredient inventory is a separate domain and was left alone. |
| Do not replace working business logic unnecessarily | GRN, sale, invoice, sale return, purchase return and wholesale return keep their existing service methods and transaction shapes; what changed inside them is the movement type, an optional idempotency key, and a reservation release on the invoice path. Pricing, schemes, credit checks and accounting hooks were not touched. |
| Do not introduce fake or static inventory data | Every screen reads a live endpoint. There are no seeded demo quantities, no placeholder rows and no hardcoded stock numbers anywhere in the ten new pages. Empty states render as empty, not as sample data. |
| Do not break existing Sales / Purchase / Returns / Delivery / Collection / Reports / PS Window | No existing route was removed or renamed. `GET /v1/pharmacy/medicines` and `GET /v1/pharmacy/batches` still return their full load-all payloads for their existing callers. The Phase 2 `stock-health` widget and the five `Stock` category reports are unchanged. Seven behaviour changes were unavoidable and are enumerated in `INVENTORY_BUSINESS_RULES.md` §13 rather than left to be discovered. *This constraint is satisfied on code reading only; no regression test has been run.* |
| Do not automatically destroy or adjust expired stock | Nothing in the codebase reduces a quantity because a date passed. Expired units stay in `quantity` and in the physical count; they are excluded from *allocation* and reported separately as `expiredQty` and in the `expired` bucket. Removing them requires an explicit `expiry` adjustment, which moves them to the `blocked` bucket and writes a ledger row naming the user. |
| Do not change costing silently | The default costing basis is still `batch_purchase_rate` — what the system used before. Phase 4 added the *option* of `product_cost_price` and the *obligation* to report which source each row used: every valuation response carries `costSource` per row plus `batchesMissingCost`, `fallbackUsedCount` and a plain-English `note`. Existing valuations do not move as a result of deploying this. |
| Do not use destructive cascading | No cascade was changed to a destructive one. New references use `ON DELETE SET NULL` (batch, warehouse, user) or `ON DELETE RESTRICT` (medicine, warehouse on a document header). The only `CASCADE`s are document-header-to-own-lines and organisation-to-own-rows, matching the existing convention. |
| Never modify historical ledger entries casually | `pharmacy_stock_movements` has no `update` and no `delete` anywhere in `api/src`. Legacy lower-case movement types are never rewritten; they are mapped on read and returned alongside the raw stored value as `rawMovementType`. Corrections are opposing adjustment documents, which leave both documents in the ledger. |
| Never silently modify stock | Every quantity change writes a ledger row carrying the user, the reference document, the unit cost and the resulting balance. A reclassification writes two legs. A stock count cannot touch stock except by generating an adjustment document. Nothing in the system changes a quantity without a document behind it. |
| Do not directly overwrite stock balances | `updateMedicine` now accepts a `currentStock` value only when it already equals `SUM(batches.quantity)`; a differing value is rejected. `currentStock` is a cache recomputed by the engine from the batch rows, never assigned from a form. |
| Reuse the existing permission architecture — no second RBAC | Ten `inventory.*` identifiers were added to the same catalogue in `packages/contracts/src/users.ts` and enforced by the same `PermissionsGuard` with the same OR semantics. Every route lists the new identifiers **alongside** the pre-existing `pharmacy.inventory.*`, `pharmacy.batch.manage`, `pharmacy.report.view`, `pharmacy.view`, `pops.inventory.manage` and `pops.read` ones, so no existing role loses access and no role assignment had to be migrated. No second permission system, no route-local access checks. |
| Do not expose raw database errors | Service errors are Nest HTTP exceptions with operator-readable messages. The invalid-date 500 described in §8 was the one remaining raw-error path found and it is now a `400` naming the expected format. Unknown ids return `404`, illegal transitions `409`, validation failures `400` with the accepted values listed. |
| Do not aggressively cache stock availability | There is no cache. `checkAvailability` reads the batch rows at request time, every time. The only cached number in the system is `pharmacy_medicines.currentStock`, which is explicitly demoted to a backward-compatibility cache, is never used to decide whether a sale can proceed, and has a reconciliation report that surfaces its drift instead of hiding it. |
| Do not leak stock across branches | `organizationId` comes from the JWT on every route. `branchCode` is resolved within that organisation, `warehouseId` is validated against the resolved branch, and batch visibility is enforced by an inner join to `pharmacy_medicines` on organisation and branch — so a batch id from another tenant returns `404`, not an empty row. Cross-branch transfers resolve the destination product by SKU within the destination branch and fail if there is no counterpart. *The single known dilution is the legacy NULL-warehouse batch, which is visible across warehouses **within** a branch; it is reported by the `batch_missing_warehouse` data-quality check and surfaced as `Unassigned (legacy)` rather than hidden.* |
| Do not silently repair discrepancies | `GET inventory/reconcile` and `GET inventory/data-quality` are read-only and repair nothing. The reconcile response explains that a non-zero `ledgerDrift` is expected on legacy data rather than flagging it as corruption. Fixing a drift is a stock adjustment with a mandatory reason and an audit trail. |
| Do not delete old data blindly | Nothing was deleted. No migration rewrote a row. The NULL-warehouse batches, the legacy movement types and the pre-Phase-4 ledger-less opening batches are all read in place, with their consequences documented. |
| Do not overbuild | Reorder and reconciliation did not become separate services; they are methods on `InventoryService`. The eleven new Report Center entries deep-link to existing screens instead of duplicating their queries behind a generic report runner. Ledger reversal was left as schema plus a read path rather than a half-built posting flow, and is declared unimplemented in §12 rather than claimed. Deliberately not built: automatic expiry write-off, a reservation sweeper, four-eyes enforcement, and a materialised valuation cache. |

---

## 10. Verification actually performed

Three checks were run. All three are **build checks**. None of them executes a single line of business logic.

| Check | Command | Result |
| --- | --- | --- |
| Backend type check | `npx tsc --noEmit -p api/tsconfig.json` from `backend-system` | **Exit code 0.** No errors. |
| Launcher production build | `npx vite build` from `Universal-application-system-/apps/launcher` | **Succeeded.** |
| Launcher type check | `npx tsc --noEmit` from `apps/launcher` | **3 errors, all in `src/pages/distribution/DistributionGeoPage.tsx`**, all pre-existing and unrelated to Phase 4. No error in any inventory file. |

What a clean type check proves: the code compiles, and the contracts line up across the API, the `@platform/contracts` package and the launcher — a response field the front end reads is a field the back end declares.

What it does not prove, and this is the whole of the gap: it says nothing about whether the SQL is correct, whether the row locking holds under contention, whether the stock arithmetic balances, whether the idempotency index actually prevents a double-post, or whether any of the 46 routes returns what this report says it returns. Those are exactly the questions the unexecuted suite exists to answer.

Note also that the type check reads `src`, which is why the stale `dist` build in §8 was invisible to it.

---

## 11. What has NOT been verified

**The test suite has never run. There are no test results. Nothing in Phase 4 has been observed working.**

`backend-system/scripts/phase4-inventory-tests.mjs` (1271 lines, 74 `check(...)` call sites, roughly 87 assertions once conditional paths are counted) exists and has never been executed. Its report artefact, `docs/PHASE_4_TEST_RESULTS.json`, **is absent from this repository, and that absence is the authoritative signal that no run has happened.** If you are reading this and the file exists, trust the file over this section.

The suite is an integration suite by design — it authenticates against a real API, posts real documents and reads the numbers back, because mocking a stock engine tests the mock. That design is why it cannot run here.

### The blockers

| Route to a running system | Blocker |
| --- | --- |
| Local API | No API process is running locally. |
| Local PostgreSQL | No local PostgreSQL instance, and Docker is not installed, so one cannot be started. |
| Production (Railway) | The Railway CLI is not authenticated from this environment, so the Phase 3/4 changes cannot be deployed. |
| Production, as it stands | Production is serving an older build that has neither these routes nor the Phase 4 tables. |

Pointing the suite at the current production URL would not produce a meaningful result: every Phase 4 route would return `404` and the run would report a wall of failures describing the deployment state rather than the code.

### What must happen

1. **Deploy the API.** The deploy is what applies the schema — the boot DDL in `api/scripts/ensure-schema.mjs` runs on start-up and creates the Phase 3 and Phase 4 tables, columns and indexes idempotently. Until the API boots against the target database, the tables do not exist.
2. **Confirm the schema landed.** Check the boot log for the ensure-schema block and confirm `pharmacy_stock_reservations`, `pharmacy_inventory_settings`, `pharmacy_stock_adjustments`, `pharmacy_stock_adjustment_lines`, `pharmacy_stock_counts` and `pharmacy_stock_count_lines` exist, and that `pharmacy_stock_movements_idem_uq` was created — if the DDL failed part-way, idempotency silently stops working while everything else appears to function.
3. **Run the suite** with `API_BASE` and credentials set:

```powershell
cd "d:\My POS SYSTEMS REPOS\backend-system"
$env:API_BASE = "https://backend-system-production-28a3.up.railway.app"
$env:DIST_EMAIL = "admin.distribution@pops.demo"
$env:DIST_PASSWORD = "<password>"
$env:BRANCH_CODE = "DIST-HQ"
node scripts/phase4-inventory-tests.mjs
```

4. **Read `PHASE_4_TEST_RESULTS.json`** and triage. Treat a failure of the end-to-end reconciliation assertion (ledger net movement must equal physical stock on hand) or either concurrency assertion as **blocking** — those two indicate the stock model itself does not hold. Everything else is fixable in place.
5. Only then copy the measured medians into `INVENTORY_PERFORMANCE.md` §2, alongside the row counts of `pharmacy_medicines`, `pharmacy_medicine_batches` and `pharmacy_stock_movements` at the time. A latency figure without a row count is not a measurement.

One caution before step 3: **the suite only creates and never deletes.** A run against production leaves two permanent warehouses (`P4-TEST`, `P4-TEST-B`) and a set of `P4TEST-` products with stock, adjustments, transfers and counts against them. Prefer a staging or demo branch. `INVENTORY_TESTING.md` §3 explains the trade-off.

Coverage gaps that will remain even after a green run are listed in `INVENTORY_TESTING.md` §7: no UI end-to-end tests, no scale test, no RBAC scoping test, no multi-tenant isolation test, no `warn` / `allow` policy test, no reservation lifecycle test, no partial-receipt transfer test, no cross-branch transfer test.

---

## 12. Known limitations and deferred items

| Item | Status |
| --- | --- |
| **Ledger reversal posting** | Schema-only. `reverses_movement_id` and the `REVERSAL` movement type exist and are read back by the ledger API, but **no code path writes them.** Corrections today are opposing stock adjustments, which leave both documents in the ledger. Unverified as a working feature. |
| **Reservation `expiresAt` is never swept** | Stored, and reported by `GET inventory/data-quality` under `stale_active_reservations` at `info` severity — but nothing releases an expired reservation. A held order does not release itself. |
| **No structured negative-stock warning to the HTTP caller** | Under `warn`, the shortfall reaches the server log and the ledger note. The posting response carries no `warnings[]`, so no UI can render a per-line "sold into negative stock" badge. |
| **Barcode scanning is not wired on the new screens** | The barcode lookup endpoint exists and is unchanged; none of the ten inventory screens listens for a scan. |
| **No Playwright or other UI end-to-end suite** | The ten screens are verified by a production build and a type check. No screen has been rendered against live data. |
| **No large-dataset performance test** | Nothing exercises 100,000 rows. The nine performance probes run against the handful of products the suite creates, so a passing run describes a nearly empty table. |
| **Salesman self-scoping RBAC deferred to Phase 11** | `inventory.*` grants are branch-scoped, not row-scoped. A user with `inventory.view` sees the whole branch. Field-role isolation was deferred at Phase 2 and remains deferred. |
| **Supplier is still POPS-shared** | Unchanged since Phase 3. Batch traceability stores `supplier_id` and resolves a supplier name, but the supplier master itself is still the shared restaurant UI. |
| Four-eyes on adjustments | Not enforced in code. The approve permissions are separate from the create permissions so segregation of duties is *expressible*, but a user holding both can approve their own document. |
| Automatic expiry write-off | Deliberately absent. Requires a manual `expiry` adjustment with a reason. |
| `pharmacy_stock_movements` growth | Append-only, one row per stock event, no partitioning, no archival, no retention policy. All six access-path indexes lead with a selective column so reads should stay bounded, but the table grows without limit. |
| `recomputeMedicineStock` runs once per document line | A fifty-line GRN runs fifty `SUM` queries over the medicine's batches. Batching the recompute to one statement per document is the obvious optimisation and has not been done. |
| Legacy NULL-warehouse batches | Counted as available in every warehouse of the branch, making per-warehouse figures approximate until they are assigned. Reported, not migrated. |

---

## 13. Phase 5 readiness

**The Sale Window must not compute inventory.** It does not read batch rows, it does not sum quantities, and it does not decide FEFO order. It asks the availability endpoint whether a cart can be fulfilled and is handed the batch allocations to use. This is the contract Phase 4 exists to provide, and it is the one integration rule Phase 5 has to follow.

**`POST /v1/pharmacy/inventory/availability`** — implemented by `StockAvailabilityService.checkAvailability`. Permissions: `inventory.view`, `pharmacy.inventory.view`, `pharmacy.view`, `pops.read`.

Request:

```json
{
  "branchCode": "DIST-HQ",
  "warehouseId": "8f1d…",
  "lines": [
    { "medicineId": "b21c…", "quantity": 40, "batchId": null },
    { "medicineId": "c77a…", "quantity": 5,  "batchId": "e903…" }
  ]
}
```

`branchCode` is required. `warehouseId` is optional and validated against the resolved branch. At least one line is required and at most 200 are accepted. `batchId` is an operator override honoured ahead of FEFO, with the remainder covered by normal FEFO order.

Response:

```json
{
  "branch":    { "id": "…", "code": "DIST-HQ", "name": "Distribution HQ" },
  "warehouse": { "id": "…", "code": "MAIN", "name": "Main Warehouse" },
  "policy":    { "negativeStockPolicy": "block", "blockExpiredSale": true },
  "fulfillable": false,
  "lines": [
    {
      "medicineId": "b21c…",
      "sku": "MED-001",
      "name": "Panadol 500mg",
      "requestedQty": 40,
      "availableQty": 100,
      "reservedQty": 0,
      "fulfillable": true,
      "shortfall": 0,
      "allocations": [
        { "batchId": "…", "batchNumber": "B-EARLY", "expiryDate": "2026-11-10",
          "warehouseId": "…", "quantity": 30, "unitCostPkr": 110, "overridden": false },
        { "batchId": "…", "batchNumber": "B-MID", "expiryDate": "2027-03-29",
          "warehouseId": "…", "quantity": 10, "unitCostPkr": 105, "overridden": false }
      ],
      "excluded": [],
      "reason": null
    },
    {
      "medicineId": "c77a…",
      "sku": "MED-009",
      "name": "Example 10mg",
      "requestedQty": 5,
      "availableQty": 0,
      "reservedQty": 0,
      "fulfillable": false,
      "shortfall": 5,
      "allocations": [],
      "excluded": [
        { "batchId": "…", "batchNumber": "B-OLD", "quantity": 12, "reason": "expired" }
      ],
      "reason": "Short by 5. Skipped: expired"
    }
  ]
}
```

`GET /v1/pharmacy/inventory/availability?branchCode=&medicineId=&quantity=&batchId=` is the same service call with a single line — convenient for a one-item scan, identical in response shape.

### What Phase 5 can rely on

- **`fulfillable` at the top level is the AND of every line** — one go / no-go flag for the till, with no client-side aggregation.
- **`allocations` is already in FEFO order and already filtered** for expiry and holds under the branch policy. The window displays and consumes them; it does not re-sort and does not re-filter.
- **`excluded` explains why visible stock was not offered** (`expired`, `batch on hold (blocked)`, `selected batch expired`), so an operator looking at a full shelf is never left guessing.
- **`reason` is a ready-to-display sentence** for a short line.
- **`policy` is echoed back**, so the UI can label its own behaviour honestly instead of assuming the default.
- **`overridden: true`** marks an allocation that honoured the caller's `batchId` ahead of FEFO order.
- **A missing product does not fail the request** — it comes back as a line with `fulfillable: false` and `reason: "Medicine not found in this branch"`.
- **Server-side product search already exists** through the paginated `GET inventory/stock` with `q` matching name, SKU, generic name or barcode, so the Sale Window does not need to download a catalogue to build its picker.
- **Costing is available per allocation** as `unitCostPkr`, so a margin display does not need a second round trip.

### What Phase 5 must not assume

**The check does not lock and does not hold stock. It is a quotation, not a reservation.** Stock can move between the quote and the posting, which is exactly why the posting path re-plans under `SELECT … FOR UPDATE`. A cart that quoted as fulfillable can still be refused at post time if another till got there first, and the Sale Window has to handle that refusal as a normal outcome rather than an error state. A window that needs a guaranteed hold must reserve — currently exposed only through the distribution order `stock_reserved` transition, not through this API family.

And the standing caveat: **this contract has never been exercised against a running system.** The shapes above are read from the service and the controller, and they type-check against the launcher client, but no request has been made. Phase 5 should begin by deploying and running the Phase 4 suite (§11), so that it builds on a verified contract rather than a compiled one.
