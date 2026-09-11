# Inventory API — Phase 4

**Date:** 2026-09-11
**Controller:** `backend-system/api/src/pharmacy/inventory/inventory.controller.ts` (`PharmacyInventoryController`, 500 lines)
**Client:** `Universal-application-system-/apps/launcher/src/pharmacy/api/pharmacy-inventory.ts`
**Status:** Implemented and type-checked. Not deployed at the time of writing, so none of these routes are live in production yet.

---

## 1. Controller-wide behaviour

Every route in this family is declared on `@Controller("v1/pharmacy")` and inherits:

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard, SystemTypeGuard)
@RequireSystemType("pharmacy", "distribution")
```

so the caller must hold a valid access token and the organisation must be a pharmacy or distribution system. Permission checks use **OR semantics**: holding any one identifier in a route's list grants access. The new `inventory.*` identifiers are always listed alongside the pre-existing `pharmacy.inventory.*` / `pharmacy.view` / `pops.*` ones, so current roles keep working without being re-granted. No second permission system was introduced.

`organizationId` is taken from the JWT (`user.organizationId`) on every route and is never read from the query string. `branchCode` is resolved to a branch id inside the services by `StockAvailabilityService.resolveBranch`, which scopes the lookup to the caller's organisation, so a guessed branch code cannot reach another tenant. Any `warehouseId` is validated against the resolved branch by `resolveWarehouse` before it is used in a query; an unknown or foreign warehouse returns `404`, not an empty result set.

`branchCode` is required on effectively every route (the controller defaults it to `""` and `resolveBranch` rejects an empty value with `400`). The single exception is `GET inventory/settings`, where omitting `branchCode` returns the organisation-level policy.

### Pagination and search

All list endpoints are paginated and searched **server-side**. There is no load-all endpoint in this family. Query parameters are always `page` (1-based) and `pageSize`, and every response carries `{ items, page, pageSize, total, totalPages }`.

| Endpoint group | Default `pageSize` | Maximum `pageSize` | Clamp source |
| --- | --- | --- | --- |
| Stock, batches, expiry, valuation report, reorder, slow-moving, aging, reconcile | 25 | **100** | `normalizePage` (`batch-stock.service.ts:30`) |
| Ledger (`inventory/ledger`) | 50 | **200** | `listMovements` (`stock-ledger.service.ts:202-203`) |
| Transfers, adjustments, counts, count lines | 25 | **100** | per-service `normalizePage` |

Out-of-range input is clamped, not rejected: `page` is floored at 1 and `pageSize` at 1, and anything above the cap is reduced to the cap. An invalid enum value (`sort`, `stockState`, `status`) *is* rejected with `400` and the message lists the accepted values.

### Error conventions

| Status | Raised when |
| --- | --- |
| `400` | Missing `branchCode`, invalid enum, invalid quantity, missing adjustment reason, a document with no lines, a count scope over 5000 lines, insufficient stock under the `block` policy. |
| `401` / `403` | No token, tampered token, missing permission, wrong system type. |
| `404` | Unknown branch code, warehouse not in the branch, medicine/batch/document not visible to this organisation and branch. |
| `409` | Illegal document transition (re-approving a posted adjustment, re-dispatching a transfer, re-posting a count), or a document number that could not be allocated uniquely after five attempts. |

---

## 2. Dashboard and stock

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/dashboard` | Whole-branch inventory command view. |
| `GET` | `/v1/pharmacy/inventory/stock` | Stock by product, paginated, with filter-wide totals. |
| `GET` | `/v1/pharmacy/inventory/stock/:medicineId` | One product: numbers, per-warehouse split, batches, movements, purchase and sales history. |

**Permissions (all three):** `inventory.view`, `pharmacy.inventory.view`, `pharmacy.view`, `pops.read`.

### `GET inventory/dashboard`

Query: `branchCode` (required), `warehouseId`.

Response (`InventoryDashboard`): `totals` (the eleven stock numbers for the branch), `counts` (`skuCount`, `batchCount`, `warehouseCount`, `lowStockCount`, `outOfStockCount`, `negativeStockCount`, `expiredBatchCount`, `nearExpiryBatchCount`, `holdBatchCount`, `activeReservationCount`, `pendingTransferCount`, `pendingAdjustmentCount`), `valuation` (the valuation summary), `expiry` (the bucket result), `topValueProducts` (top 10 valuation rows), `recentMovements` (10 ledger rows).

`pendingTransferCount` counts transfers in `submitted`, `approved` or `dispatched`; `pendingAdjustmentCount` counts adjustments in `pending_approval`. Both are wrapped so that a database where the Phase 4 tables do not exist yet reports zero instead of failing the screen.

### `GET inventory/stock`

Query: `branchCode` (required), `warehouseId`, `companyId`, `q`, `stockState`, `sort`, `page`, `pageSize`.

- `q` matches `name`, `sku`, `genericName` or `barcode` (ILIKE, parameterised).
- `stockState` ∈ `all | ok | low | out | negative | near_expiry | expired | has_hold`. Applied as a `HAVING` clause because it is an aggregate condition.
- `sort` ∈ `name_asc | qty_asc | qty_desc | value_desc | expiry_asc`.

Response: `PageResult<StockRow> & { totals }`. Each `StockRow` carries `medicineId`, `sku`, `name`, `unit`, `companyId`, `companyName`, `rackLocation`, all of `physicalQty` / `availableQty` / `reservedQty` / `damagedQty` / `quarantineQty` / `blockedQty` / `expiredQty` / `nearExpiryQty`, `batchCount`, `valuePkr`, `reorderLevel`, `minStock`, `maxStock`, `stockState`, `earliestExpiry`. `totals` is computed over the whole filter (not just the page) from the same grouped rows, so the footer can never disagree with the list: `skuCount`, `availableQty`, `physicalQty`, `valuePkr`, `lowCount`, `outCount`, `nearExpiryQty`, `expiredQty`.

### `GET inventory/stock/:medicineId`

Query: `branchCode` (required), `warehouseId`.

Response: `medicine` (id, sku, name, unit, companyName, reorderLevel, minStock, maxStock, `batchTrackingEnabled`, `expiryTrackingEnabled`, `fefoEnabled`, rack/shelf/aisle), `stock` (the eleven numbers), `byWarehouse[]` (NULL-warehouse rows surface as `Unassigned (legacy)`), `batches[]` (first 100, expiry ascending), `recentMovements[]` (25), `purchaseHistory[]` (last 10 GRN lines), `salesHistory[]` (last 10 distribution invoice lines). Unknown id → `404`.

---

## 3. Availability — the Phase 5 integration point

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/availability` | Single-line availability and allocation. |
| `POST` | `/v1/pharmacy/inventory/availability` | Full-cart availability and allocation. |

**Permissions (both):** `inventory.view`, `pharmacy.inventory.view`, `pharmacy.view`, `pops.read`.

Both forms call the same service method, `StockAvailabilityService.checkAvailability`. This is the endpoint the Sale Window calls instead of computing stock itself: it answers "can I sell this, and from which batches" in one round trip.

**GET query:** `branchCode` (required), `warehouseId`, `medicineId`, `quantity` (defaults to 1), `batchId`.

**POST body:**

```json
{
  "branchCode": "DIST-HQ",
  "warehouseId": "8f1d…",
  "lines": [{ "medicineId": "b21c…", "quantity": 40, "batchId": null }]
}
```

At least one line is required (`400` otherwise) and **at most 200 lines** are accepted per request (`400` above that). Lines without a `medicineId` are dropped before the check.

**Response** — identical for both forms:

| Field | Meaning |
| --- | --- |
| `branch` | `{ id, code, name }` of the resolved branch. |
| `warehouse` | `{ id, code, name }` or `null` when the request was branch-wide. |
| `policy` | `{ negativeStockPolicy, blockExpiredSale }` — echoed so the caller can label its own behaviour honestly. |
| `fulfillable` | `true` only when every line is fulfillable. Single go / no-go flag for the till. |
| `lines[]` | `medicineId`, `sku`, `name`, `requestedQty`, `availableQty`, `reservedQty`, `fulfillable`, `shortfall`, `allocations[]`, `excluded[]`, `reason`. |

`allocations[]` entries are `{ batchId, batchNumber, expiryDate, warehouseId, quantity, unitCostPkr, overridden }`, already in FEFO order and already filtered for expiry and holds under the branch policy. `excluded[]` entries are `{ batchId, batchNumber, quantity, reason }` and explain why visible stock was not offered (`expired`, `batch on hold (blocked)`, `selected batch expired`, …). `reason` is a display-ready sentence on a short line, `null` when the line is fulfillable. A medicine that does not exist in the branch comes back as a line with `fulfillable: false` and `reason: "Medicine not found in this branch"` rather than failing the whole request.

**This check does not lock rows and does not hold stock.** It is a quotation. The posting path re-plans under `SELECT … FOR UPDATE`, so a cart that quoted as fulfillable can still be refused at post time if another till got there first. A caller that needs a guaranteed hold must reserve the stock (currently exposed only through the distribution order `stock_reserved` transition, not through this API family).

---

## 4. Batches and expiry

| Method | Path | Purpose | Permissions |
| --- | --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/batches` | Batch register, paginated. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.batch.manage`, `pharmacy.view`, `pops.read` |
| `GET` | `/v1/pharmacy/inventory/batches/:batchId` | Batch detail with movements, reservations and traceability. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.batch.manage`, `pharmacy.view`, `pops.read` |
| `POST` | `/v1/pharmacy/inventory/batches/:batchId/hold` | Set or clear a manual hold flag. | `inventory.manage`, `pharmacy.batch.manage`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `GET` | `/v1/pharmacy/inventory/expiry/buckets` | Configurable expiry ageing buckets plus the expired bucket. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.view`, `pops.read` |
| `GET` | `/v1/pharmacy/inventory/expiry/batches` | Batches inside one bucket, paginated. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.view`, `pops.read` |

### `GET inventory/batches`

Query: `branchCode` (required), `warehouseId`, `medicineId`, `companyId`, `q`, `status`, `expiringInDays`, `sort`, `page`, `pageSize`.

- `q` matches medicine name, medicine SKU or batch number.
- `status` ∈ `active | hold | expired | near_expiry | zero | all` (default `all`). These are **independent predicates**, not the priority-ordered `derivedStatus`: filtering by `expired` returns every expired batch even when it is also on hold.
- `expiringInDays` must be a non-negative whole number; it restricts to `current_date … current_date + N`.
- `sort` ∈ `expiry_asc | expiry_desc | qty_desc | medicine_asc | created_desc` (default `expiry_asc`).

Each `BatchRow`: `id`, `medicineId`, `medicineName`, `medicineSku`, `companyName`, `batchNumber`, `manufacturingDate`, `expiryDate`, `warehouseId`, `warehouseName`, `quantity`, `reservedQuantity`, `damagedQuantity`, `quarantineQuantity`, `blockedQuantity`, `physicalQty`, `purchaseRatePkr`, `saleRatePkr`, `valuePkr`, `status`, `holdReason`, `derivedStatus`, `daysToExpiry`, `createdAt`.

### `GET inventory/batches/:batchId`

Query: `branchCode` (required). Visibility is enforced by an inner join to `pharmacy_medicines` on the caller's organisation and branch, so a batch id from another tenant returns `404`.

Response: the `BatchRow` fields plus `movements[]` (up to 50 ledger rows for this batch), `reservations[]` (active holds: `referenceType`, `referenceId`, `quantity`, `status`, `expiresAt`, `createdAt`), and `traceability` = `{ supplierId, supplierName, grnId, grnNumber, receivedAt, soldToCustomers[] }`. `soldToCustomers[]` lists up to 100 distribution invoice lines that carried this batch id — the recall-preparation view.

### `POST inventory/batches/:batchId/hold`

Body: `{ branchCode, status, reason? }`. `status` ∈ `active | blocked | quarantine | recalled`; anything else is `400`. Setting `active` clears `holdReason`.

**This flags the batch only.** No quantity moves; moving units between buckets is an adjustment's job, and doing it here would change stock without a document. The before/after status is written to `pharmacy_audit_logs` under action `batch.hold`. Response is the refreshed `BatchRow`.

### `GET inventory/expiry/buckets`

Query: `branchCode` (required), `warehouseId`, `companyId`.

Response: `buckets[]` of `{ label, fromDays, toDays, batchCount, quantity, valuePkr }` built from the configured `expiryBuckets` (default `[30,60,90,180]` → `0-30 days`, `31-60 days`, `61-90 days`, `91-180 days`, `>180 days` with `toDays: null`), plus a separate `expired` object and `totalNearExpiryValuePkr` measured over `nearExpiryDays`.

### `GET inventory/expiry/batches`

Query: `branchCode` (required), `warehouseId`, `bucket`, `includeExpired`, `page`, `pageSize`.

`bucket` accepts `"expired"`, a bucket label, or the bucket's upper day count as a string; anything else is `400` with the list of valid labels. With no `bucket` the endpoint returns everything expiring within `nearExpiryDays`, and `includeExpired=true` additionally lets already-expired batches through. Only batches with `physicalQty > 0` are listed.

---

## 5. Stock ledger

| Method | Path | Purpose | Permissions |
| --- | --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/movement-types` | The canonical movement-type list, for filter dropdowns. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.view`, `pops.read` |
| `GET` | `/v1/pharmacy/inventory/ledger` | Stock movement register, paginated. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.report.view`, `pops.read` |
| `GET` | `/v1/pharmacy/inventory/ledger/totals` | In / out / net totals for the same filter set. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.report.view`, `pops.read` |

`movement-types` takes no parameters and returns `{ types: [...] }` with the 16 canonical types.

`ledger` query: `branchCode` (required), `warehouseId`, `medicineId`, `batchId`, `movementType`, `referenceType`, `referenceId`, `from` (`YYYY-MM-DD`, inclusive from 00:00:00Z), `to` (inclusive to 23:59:59.999Z), `q`, `page`, `pageSize` (max 200). `q` matches medicine name, medicine SKU, batch number or `referenceId`.

A `movementType` filter is expanded to include every legacy alias that normalises onto the same canonical type, so filtering for `SALE` also returns pre-Phase-4 `sale_out` history.

Each row: `id`, `createdAt`, `movementType` (canonical), `rawMovementType` (as stored), `direction` (`in` / `out` / `none`, derived from the sign of `quantityDelta`), `stockState`, `quantityDelta`, `quantityAfter`, `unitCostPkr`, `valuePkr`, `referenceType`, `referenceId`, `notes`, `reversesMovementId`, `medicineId`, `medicineName`, `medicineSku`, `batchId`, `batchNumber`, `expiryDate`, `warehouseId`, `warehouseName`, `userName`. Ordered by `createdAt` descending.

`ledger/totals` takes the same filters minus pagination and returns `{ quantityIn, quantityOut, netQuantity, valueInPkr, valueOutPkr, rows }`.

---

## 6. Valuation

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/valuation/summary` | Branch valuation with the costing basis and fallback counts. |
| `GET` | `/v1/pharmacy/inventory/valuation/by-warehouse` | Valuation grouped by warehouse (array, not paginated). |
| `GET` | `/v1/pharmacy/inventory/valuation/by-company` | Valuation grouped by manufacturer company (array, not paginated). |
| `GET` | `/v1/pharmacy/inventory/valuation/report` | Per-SKU valuation, paginated. |

**Permissions (all four):** `inventory.valuation`, `inventory.view`, `pharmacy.report.view`, `pharmacy.inventory.view`, `pops.inventory.manage`.

Query on all four: `branchCode` (required), `warehouseId`, `companyId`. `report` additionally takes `q` (name, SKU, generic name), `page`, `pageSize`.

`summary` returns `costingMethod`, `availableQty`, `physicalQty`, `availableValuePkr`, `physicalValuePkr`, `expiredValuePkr`, `damagedValuePkr`, `quarantineValuePkr`, `blockedValuePkr`, `nearExpiryValuePkr`, `batchesValued`, `batchesMissingCost`, `fallbackUsedCount`, and a plain-English `note` stating the basis and how many batches fell back — so nobody has to guess which basis a figure used.

`by-warehouse` rows: `warehouseId`, `warehouseCode`, `warehouseName` (`Unassigned (legacy)` for the NULL group), `availableQty`, `availableValuePkr`, `physicalValuePkr`, `batchCount`. `by-company` rows: `companyId`, `companyName` (`Unassigned company` when null), `availableQty`, `availableValuePkr`, `batchCount`, `skuCount`.

`report` rows: `medicineId`, `sku`, `name`, `companyName`, `unit`, `availableQty`, `physicalQty`, `unitCostPkr` (weighted average of the resolved batch costs, so unit cost × quantity reproduces the value), `availableValuePkr`, `costSource` ∈ `batch | product_cost | product_purchase | none`.

---

## 7. Planning reports

| Method | Path | Purpose | Permissions |
| --- | --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/reorder` | Reorder suggestions using the configured formula. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.purchase.view`, `pops.read` |
| `GET` | `/v1/pharmacy/inventory/slow-moving` | Stock with no outbound movement in the period. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.report.view`, `pops.read` |
| `GET` | `/v1/pharmacy/inventory/aging` | How long stock has been held, by bucket. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.report.view`, `pops.read` |

`reorder` query: `branchCode` (required), `warehouseId`, `companyId`, `page`, `pageSize`. Only `active` medicines are considered. Response is a page of rows plus a `formula` string describing the maths actually applied. Rows: `medicineId`, `sku`, `name`, `unit`, `companyName`, `availableQty`, `reorderLevel`, `minStock`, `maxStock`, `avgDailySales`, `daysOfCover` (**`null`** when there were no sales — never `Infinity`), `suggestedQty`, `urgency` (`critical` / `high` / `normal`), `reason` (a sentence explaining the suggestion).

`slow-moving` query: `branchCode` (required), `warehouseId`, `days` (whole number ≥ 1; defaults to the `slowMovingDays` setting; `400` otherwise), `page`, `pageSize`. Rows: `medicineId`, `sku`, `name`, `availableQty`, `valuePkr`, `lastMovementAt`, `daysSinceMovement`, `unitsSoldInPeriod`. A product qualifies when it has available stock and either never moved outbound or last moved outbound before the window.

`aging` query: `branchCode` (required), `warehouseId`, `page`, `pageSize`. Response: `buckets[]` (`0-30 days`, `31-60 days`, `61-90 days`, `91-180 days`, `180+ days` — fixed, not configurable) and `items` as a page of `{ batchId, medicineId, sku, name, batchNumber, expiryDate, warehouseName, quantity, physicalQty, valuePkr, receivedAt, ageDays, bucket }`. Age is measured from batch creation, oldest first.

---

## 8. Integrity tools (read-only)

| Method | Path | Purpose | Permissions |
| --- | --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/reconcile` | Drift between the stock cache, the batch rows and the ledger. | `inventory.view`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `GET` | `/v1/pharmacy/inventory/data-quality` | Ten named data-integrity checks with counts and sample ids. | `inventory.view`, `pharmacy.inventory.manage`, `pops.inventory.manage` |

Neither endpoint repairs anything. Fixing a drift is a stock adjustment with an audit trail, not a side effect of opening a report.

`reconcile` query: `branchCode` (required), `page`, `pageSize`. Response: `checkedSkus`, `discrepancyCount`, and a page of drifting products only — `medicineId`, `sku`, `name`, `cachedCurrentStock`, `batchSumQuantity`, `cacheDrift`, `ledgerNetQuantity`, `ledgerDrift`, `note`. The note explains that a non-zero `ledgerDrift` is expected on legacy data, because pre-Phase-4 opening stock was written without ledger rows and a reservation posts a single reserved-state row.

`data-quality` query: `branchCode` (required). Response is an array of `{ check, severity, count, description, sampleIds }` for: `batch_missing_warehouse`, `batch_negative_quantity` (critical), `expired_batch_with_stock`, `batch_missing_cost`, `medicine_stock_cache_drift`, `tracked_product_without_batches` (critical), `batch_expiry_before_manufacture`, `synthetic_restore_batches` (info), `stale_active_reservations` (info).

---

## 9. Settings

| Method | Path | Purpose | Permissions |
| --- | --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/settings` | Effective inventory policy. | `inventory.view`, `pharmacy.inventory.view`, `pharmacy.view`, `pops.read` |
| `PATCH` | `/v1/pharmacy/inventory/settings` | Change policy for a branch, or organisation-wide. | `inventory.settings`, `pharmacy.inventory.manage`, `pops.inventory.manage` |

`GET` query: `branchCode` (optional). With a branch code the branch row wins, then the organisation row, then the audited defaults. The response carries `source` ∈ `branch | organization | default` so the UI can say honestly where the numbers came from. It never throws — inventory must stay operable.

`PATCH` body: `branchCode` (omit to write the organisation-wide row) plus any subset of `negativeStockPolicy`, `blockExpiredSale`, `allowFefoOverride`, `adjustmentApprovalThreshold`, `requireAdjustmentApproval`, `expiryBuckets`, `nearExpiryDays`, `slowMovingDays`, `costingMethod`, `reorderFormula`, `reorderLeadTimeDays`, `reorderSafetyDays`. Enum values are validated with an explicit message; `expiryBuckets` must be a non-empty array of positive day counts and is stored sorted ascending; day counts are floored and clamped (≥ 1 for `nearExpiryDays` / `slowMovingDays`, ≥ 0 for lead and safety days). Response is the re-resolved effective settings.

---

## 10. Stock transfers

| Method | Path | Purpose | Permissions |
| --- | --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/transfers` | Transfer register, paginated. | `inventory.view`, `inventory.transfer`, `pharmacy.inventory.view`, `pops.read` |
| `GET` | `/v1/pharmacy/inventory/transfers/:id` | Transfer detail with lines. | `inventory.view`, `inventory.transfer`, `pharmacy.inventory.view`, `pops.read` |
| `POST` | `/v1/pharmacy/inventory/transfers` | Create as `draft`. | `inventory.transfer`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `PATCH` | `/v1/pharmacy/inventory/transfers/:id` | Edit a `draft`. | `inventory.transfer`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/transfers/:id/submit` | `draft` → `submitted`. | `inventory.transfer`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/transfers/:id/approve` | `submitted` → `approved`. | **`inventory.transfer.approve`**, `inventory.transfer`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/transfers/:id/dispatch` | `approved` → `dispatched`. **Deducts stock.** | `inventory.transfer`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/transfers/:id/receive` | `dispatched` → `received` / `completed`. **Adds stock.** | `inventory.transfer`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/transfers/:id/cancel` | `draft` / `submitted` / `approved` → `cancelled`. | `inventory.transfer`, `pharmacy.inventory.manage`, `pops.inventory.manage` |

`list` query: `branchCode` (required), `status`, `fromWarehouseId`, `toWarehouseId`, `q` (transfer number, reason, notes), `from`, `to`, `page`, `pageSize`.

`create` body: `{ branchCode, fromWarehouseId, toWarehouseId, toBranchId?, transferDate?, reason?, notes?, lines: [{ medicineId, batchId?, quantity, notes? }] }`. Source and destination must differ, at least one line is required, quantities must be positive whole numbers, and availability is checked per medicine (aggregated across lines) before the document is created.

`update` body: the same fields, all optional except `branchCode`. Only a `draft` may be edited.

`submit`, `approve`, `dispatch` body: `{ branchCode }`. `receive` body: `{ branchCode, lines?: [{ lineId, receivedQuantity }] }` where `receivedQuantity` is the **running total** for the line, not a delta. `cancel` body: `{ branchCode, reason }` — the reason is mandatory.

All nine return a `TransferDetail`: the header fields, `fromBranch` / `toBranch`, computed `lineCount`, `totalQuantity`, `totalReceivedQuantity`, `totalShortage`, `totalValuePkr`, every actor and timestamp, and `lines[]` with `quantity`, `receivedQuantity`, `shortage`, `unitCostPkr`, `valuePkr`, the dispatch batch snapshot and `destinationBatchId` / `destinationBatchNumber`.

---

## 11. Stock adjustments

| Method | Path | Purpose | Permissions |
| --- | --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/adjustments` | Adjustment register, paginated. | `inventory.view`, `inventory.adjust`, `pharmacy.inventory.view`, `pops.read` |
| `GET` | `/v1/pharmacy/inventory/adjustments/:id` | Adjustment detail with lines. | `inventory.view`, `inventory.adjust`, `pharmacy.inventory.view`, `pops.read` |
| `POST` | `/v1/pharmacy/inventory/adjustments` | Create as `draft`. | `inventory.adjust`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `PATCH` | `/v1/pharmacy/inventory/adjustments/:id` | Edit a `draft`. | `inventory.adjust`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/adjustments/:id/submit` | Post immediately, or move to `pending_approval`. | `inventory.adjust`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/adjustments/:id/approve` | Approve **and post** to stock. | **`inventory.adjust.approve`**, `inventory.adjust`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/adjustments/:id/reject` | `draft` / `pending_approval` → `rejected`. | **`inventory.adjust.approve`**, `inventory.adjust`, `pharmacy.inventory.manage`, `pops.inventory.manage` |

`list` query: `branchCode` (required), `status`, `adjustmentType`, `warehouseId`, `q` (adjustment number, reason, notes), `from`, `to`, `page`, `pageSize`.

`create` body: `{ branchCode, warehouseId, adjustmentType, reason, notes?, lines: [{ medicineId, batchId?, quantity, notes? }] }`. `warehouseId` is required. `reason` is mandatory and non-blank — stock is never adjusted without one. Line `quantity` is always a **positive magnitude**; the document type decides the direction and the target bucket.

`submit`, `approve` body: `{ branchCode }`. `reject` body: `{ branchCode, reason }` — mandatory. Submitting a document whose absolute value is at or below a positive `adjustmentApprovalThreshold`, or submitting in a branch with `requireAdjustmentApproval: false`, posts it straight away; otherwise it waits for approval.

Response is an `AdjustmentDetail`: header fields, `warehouseCode` / `warehouseName`, `totalQuantity` (signed), `totalValuePkr`, `lineCount`, `requiresApproval`, and `lines[]` with a **signed** `quantity`, the `stockState` the line moves, and the frozen `unitCostPkr` / `valuePkr`.

There is no cancel route for adjustments; `reject` is the terminal non-posted state.

---

## 12. Stock counts

| Method | Path | Purpose | Permissions |
| --- | --- | --- | --- |
| `GET` | `/v1/pharmacy/inventory/counts` | Count register, paginated. | `inventory.view`, `inventory.count`, `pharmacy.inventory.view`, `pops.read` |
| `GET` | `/v1/pharmacy/inventory/counts/:id` | Count detail with a paginated line sheet. | `inventory.view`, `inventory.count`, `pharmacy.inventory.view`, `pops.read` |
| `POST` | `/v1/pharmacy/inventory/counts` | Generate the count sheet (status `counting`). | `inventory.count`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/counts/:id/record` | Record counted quantities. | `inventory.count`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/counts/:id/post` | Convert variances into adjustment documents. | **`inventory.count.post`**, `inventory.count`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| `POST` | `/v1/pharmacy/inventory/counts/:id/cancel` | Cancel a non-posted count. | `inventory.count`, `pharmacy.inventory.manage`, `pops.inventory.manage` |

`list` query: `branchCode` (required), `status`, `countType`, `warehouseId`, `q` (count number, notes), `page`, `pageSize`.

`detail` query: `branchCode` (required), `onlyVariance` (`true`/`1` restricts the sheet to counted lines with a non-zero variance), `page`, `pageSize`. Response: header fields plus `countedLines`, `uncountedLines`, `varianceLines`, and `lines` as its **own** page result (`lines.items`, `lines.total`, …).

`create` body: `{ branchCode, warehouseId, countType?, notes?, scope? }`. `countType` ∈ `full | cycle` (default `cycle`); a `scope` is only honoured for a cycle count. `scope` accepts `companyId`, `categoryId`, `medicineIds[]`, `rackLocation`. A scope producing more than **5000** lines is refused with guidance to narrow it; a scope matching no stock is refused as "nothing to count".

`record` body: `{ branchCode, lines: [{ lineId, countedQuantity, notes? }] }`. `countedQuantity` must be zero or a positive whole number. Allowed while the count is `draft`, `counting` or `review`.

`post` body: `{ branchCode, reason? }`. Response is `{ count: CountDetail, adjustmentId }` where `adjustmentId` is the higher-value of the documents generated, or `null` when there was no variance.

`cancel` body: `{ branchCode, reason }` — mandatory.

---

## 13. Pre-existing endpoints that remain unchanged

These routes were already in production before Phase 4 and were **not modified**. The retail pharmacy edition keeps working against them.

| Method | Path | Note |
| --- | --- | --- |
| `GET` | `/v1/pharmacy/medicines` | Still returns the whole catalogue with `currentStock`. Load-all, no pagination. Superseded for inventory use by `inventory/stock`, but kept for existing callers. |
| `GET` | `/v1/pharmacy/medicines/:medicineId/batches` | Per-medicine batch list. |
| `GET` | `/v1/pharmacy/batches` | All branch batches, load-all. Superseded by `inventory/batches`. |
| `GET` | `/v1/pharmacy/medicines/barcode/:barcode` | Barcode lookup. |
| `POST` / `PATCH` | `/v1/pharmacy/medicines`, `/v1/pharmacy/medicines/:id` | Create and edit. Two behaviour changes were unavoidable and are documented in `INVENTORY_BUSINESS_RULES.md` §10: opening stock now posts through the engine and writes an `OPENING_STOCK` ledger row, and an edit can no longer overwrite `currentStock` to a value that disagrees with the batch rows. |
| `GET` / `POST` | `/v1/pharmacy/grns` | Goods receipt. `createGrn` now accepts an optional `idempotencyKey` in the body; without it the behaviour is exactly as before. |
| `POST` | `/v1/pharmacy/sales` | Retail sale. |
| `GET` / `POST` | `/v1/pharmacy/sales/returns` | Sale returns. |
| `GET` / `POST` | `/v1/pharmacy/purchase-returns` | Purchase returns. Now logged as `PURCHASE_RETURN` instead of `sale_out`. |
| `POST` | `/v1/pharmacy/distribution/orders/:id/invoice` | Wholesale invoice. Now releases any reservations the order held before deducting. |
| `GET` / `POST` | `/v1/pharmacy/distribution/wholesale-returns` | Wholesale returns. |
| `GET` / `POST` | `/v1/pharmacy/warehouses` | Warehouse master. |
| `GET` | `/v1/pharmacy/reports/expired-products`, `/reports/reorder-suggestions` | Legacy expiry and low-stock reports. |
| `GET` | `/v1/pharmacy/distribution/dashboard/stock-health` | Phase 2 stock KPI widget. |
| `GET` | `/v1/pharmacy/distribution/reports/:reportId` | Includes `stock-near-expiry`, `stock-by-warehouse`, `slow-moving`, `batch-trace`, `company-stock`. |
| `GET` / `PATCH` | `/v1/pharmacy/masters/medicines/:id` | Phase 3 inventory configuration flags. |

---

## 14. Route inventory

46 routes across 12 groups, all under `/v1/pharmacy/inventory/*`:

| Group | Routes |
| --- | --- |
| Dashboard and stock | 3 |
| Availability | 2 |
| Batches and expiry | 5 |
| Ledger | 3 |
| Valuation | 4 |
| Planning reports | 3 |
| Integrity tools | 2 |
| Settings | 2 |
| Transfers | 9 |
| Adjustments | 7 |
| Counts | 6 |

Front-end coverage is 1:1 through `pharmacy-inventory.ts`, which exposes `inventoryApi`, `batchesApi`, `ledgerApi`, `valuationApi`, `inventorySettingsApi`, `transfersApi`, `adjustmentsApi` and `countsApi`. Ten distribution screens consume them, mounted in `routes/distributionRoutes.tsx` at `distribution/inventory`, `distribution/stock`, `distribution/inventory/product/:medicineId`, `distribution/batches`, `distribution/expiry`, `distribution/stock-ledger`, `distribution/stock-transfers`, `distribution/stock-adjustments`, `distribution/stock-count` and `distribution/inventory-reports`.
