# INVENTORY AUDIT — Phase 4 Pre-Implementation

**Date:** 2026-09-11
**Scope:** Pharmaceutical distribution inventory, stock, batch, expiry, FEFO, stock control
**Rule applied:** audit before changing anything. No code was modified before this document.

---

## 1. Current architecture

Stock lives in a **dual-layer model**.

| Layer | Table / column | Role today |
| --- | --- | --- |
| Product | `pharmacy_medicines.currentStock` | Denormalised total. Read by UI, availability checks, dashboards, reorder reports. |
| Batch | `pharmacy_medicine_batches.quantity` | Operationally authoritative per-batch quantity. Mutated by the stock engine. |

Every genuine stock mutation is funnelled through one component:

`api/src/pharmacy/pharmacy-stock.engine.ts` (`PharmacyStockEngine`, 406 lines)

| Method | Lines | Behaviour |
| --- | --- | --- |
| `ensureDefaultWarehouse` | 23–69 | Get or create the branch `MAIN` warehouse. |
| `recomputeMedicineStock` | 71–84 | `currentStock = SUM(batch.quantity)` for the medicine. |
| `logMovement` (private) | 86–117 | The **only** insert site for `pharmacy_stock_movements`. |
| `deductFefo` | 123–245 | FEFO deduct, movement log, recompute. |
| `restoreBatch` | 247–319 | Return quantity to a batch, or synthesise `RESTORE-xxxxxx`. |
| `receiveBatch` | 321–405 | GRN-style receive: merge on batch number or insert. |

This single-funnel design is the strongest part of the existing implementation and Phase 4 preserves it rather than replacing it.

---

## 2. Existing models

### `pharmacy_medicines` (`packages/database-pg/src/schema/pharmacy.ts:12–70`)

Relevant columns: `currentStock`, `reorderLevel`, `suggestedReorderQty`, `minStock`, `maxStock`, `preferredWarehouseId`, `rackLocation`, `shelfLocation`, `aisleLocation`, `tabletsPerStrip`, `stripsPerBox`, `batchTrackingEnabled`, `expiryTrackingEnabled`, `fefoEnabled`, `purchasePricePkr`, `costPricePkr`.

Indexes: `(org, branch, status)`, `(org, companyId)`, `(org, branch, sku)`.

### `pharmacy_medicine_batches` (`pharmacy.ts:72–93`)

`medicineId` (FK cascade), `warehouseId` (**bare uuid, no FK**), `batchNumber`, `manufacturingDate`, `expiryDate`, `quantity`, `reservedQuantity`, `damagedQuantity`, `freeQuantity`, `purchaseRatePkr`, `saleRatePkr`, `status`.

Indexes: `(medicineId, expiryDate)`, `(expiryDate, quantity)`.

### `pharmacy_stock_movements` (`pharmacy-erp.ts:327–348`)

`organizationId`, `branchId`, `warehouseId` (FK), `medicineId` (FK restrict), `batchId` (FK set null), `movementType`, `quantityDelta`, `quantityAfter`, `referenceType`, `referenceId`, `notes`, `createdByUserId`, `createdAt`.

**No indexes at all.**

### `pharmacy_stock_transfers` / `pharmacy_stock_transfer_lines` (`pharmacy-erp.ts:350–382`)

Header has `transferNumber`, `fromWarehouseId`, `toWarehouseId`, `status` default `draft`, `completedAt`. Lines have `medicineId`, `batchId`, `quantity`.

**Schema-only. Zero references anywhere in `api/src`. No HTTP API, no service, no UI.**

### `pharmacy_warehouses` (`pharmacy-erp.ts:134–151`)

Branch-scoped, `code`, `name`, `isDefault`, `status`. **No indexes.**

---

## 3. Existing endpoints

All under `@Controller("v1/pharmacy")`.

| Method | Path | Stock relevance |
| --- | --- | --- |
| GET | `/medicines` | Returns `currentStock`. **Load-all, no pagination.** |
| GET | `/medicines/:medicineId/batches` | Per-medicine batches. No UI consumer. |
| GET | `/batches` | All branch batches. **Load-all.** |
| GET | `/medicines/barcode/:barcode` | Barcode lookup. |
| GET | `/reports/expired-products` | Expiry report. |
| GET | `/reports/reorder-suggestions` | Low-stock list. |
| GET/POST | `/warehouses` | Warehouse master. |
| GET/POST | `/grns` | Stock IN. |
| POST | `/sales` | Stock OUT (retail). |
| GET/POST | `/sales/returns` | Stock IN. |
| GET/POST | `/purchase-returns` | Stock OUT. |
| POST | `/distribution/orders/:id/invoice` | Stock OUT (wholesale). |
| GET/POST | `/distribution/wholesale-returns` | Stock IN. |
| GET | `/distribution/dashboard/stock-health` | Stock KPIs (Phase 2). |
| GET | `/distribution/reports/:reportId` | `stock-near-expiry`, `stock-by-warehouse`, `slow-moving`, `batch-trace`, `company-stock`. |
| GET/PATCH | `/masters/medicines/:id` | Inventory config flags (Phase 3). No stock operations. |

**Not exposed anywhere:** stock movement/ledger read, stock transfers, stock adjustments, stock counts, reservations, valuation, availability/allocation preview, reconciliation.

---

## 4. Existing screens

Routes are mounted under `/pops/`.

| Route | Component | Origin | Reality |
| --- | --- | --- | --- |
| `distribution/inventory` | `pharmacy/pages/PharmacyInventoryPage.tsx` re-exported as `DistributionInventoryPage` | **Shared pharmacy**, Pops chrome | Loads **all** medicines, client-side filters via `?focus=`. Action links point back to `/pops/pharmacy/*`. |
| `distribution/expiry` | `pharmacy/pages/PharmacyExpiryPage.tsx` | **Shared pharmacy** | Loads **all** batches, client-side `?focus=` filter. |
| `distribution/medicines` + `/:id` | Dist-native (Phase 3) | Dist | Master data only. Shows `currentStock` but no batch or movement view. |
| `distribution/warehouses` | Dist-native (Phase 3) | Dist | Master only, no quantities. |
| `distribution/purchase-orders` | `pharmacy/pages/PharmacyErpPages.tsx` | Shared pharmacy ERP | PO + inline GRN with batch/expiry. Load-all medicines. |
| `multi-branch/transfers`, `multi-branch/receive` | `pops/pages/modules/multi-branch/*` | **Restaurant ingredients** | Uses `fetchTransferIngredients`; columns `ingredientName`, `qty`, `unit`. **Not pharmaceutical.** The Dist nav "Stock Transfer" item currently points here — wrong system. |
| `pops/inventory/*` | Restaurant inventory module | Restaurant | Separate ingredient world, correctly out of scope. |

Design system available for new pages: `distribution/ui/DistUi.tsx` (`DistPageShell`, `DistDataTable`, `DistPanel`, `DistKpiCard`, `DistStatusBadge`, `DistEmptyState`, `DistErrorBanner`, `DistLoadingBlock`, `DistButton/Input/Select`, `exportRowsToCsv`) plus `distribution/components/` (`DistPagination`, `DistMasterDrawer`, `DistDrawerField`, `DistWidgetSection`).

---

## 5. Existing stock calculation

### Increase

`POST /v1/pharmacy/grns` → `PharmacyErpService.createGrn` (`pharmacy-erp.service.ts:885–998`), inside `db.transaction`:
resolve warehouse → insert GRN header `posted` → per line `stock.receiveBatch` (merge on `medicineId + batchNumber + (warehouse or NULL)`) → movement `grn_in` → recompute → insert GRN lines → update PO received qty.

Non-document IN paths: `createMedicine` opening stock inserts a batch directly with **no movement row** (`pharmacy.service.ts:1241–1256`); `restoreBatch` with no `batchId` synthesises a batch; wholesale return with no `batchId` calls `receiveBatch` with a synthetic batch number.

### Decrease

Retail sale (`pharmacy.service.ts:2144–2370`): pre-check `med.currentStock >= qty` → per line `deductFefo` with `referenceType: "sale"`.

Distribution invoice (`pharmacy-erp.service.ts:1443–1533`): per order line `deductFefo` for `quantity + freeQuantity`, `referenceType: "dist_invoice"`. **No stock check or reservation at order creation** — deduction happens only at invoice time.

Purchase return (`pharmacy-erp.service.ts:1223–1236`): `deductFefo` with `preferredBatchId`.

### FEFO logic as it stands

```
deductFefo:
  1. medicine exists? currentStock >= qty? else BadRequest
  2. warehouse = input.warehouseId ?? default
  3. if preferredBatchId: take the ENTIRE qty from that one batch (no split)
  4. else: SELECT batches WHERE quantity > 0
             AND (warehouseId = X OR warehouseId IS NULL)
           ORDER BY expiryDate ASC
     take min(batch.quantity, remaining) per batch
  5. remaining > 0 -> BadRequest
  6. recomputeMedicineStock
```

### Costing / valuation

There is **no valuation service**. Values are computed ad hoc in reports with inconsistent bases:

| Context | Formula | File |
| --- | --- | --- |
| Retail dashboard stock value | `SUM(currentStock * purchasePricePkr)` | `pharmacy.service.ts:646` |
| Distribution dashboard stock value | `SUM(currentStock * costPricePkr)` | `pharmacy-dashboard.service.ts:1462` |
| Expiry loss estimate (retail) | `purchasePricePkr * batch.quantity` | `pharmacy.service.ts:2721` |
| Expiry value (distribution) | `batch.quantity * batch.purchaseRatePkr` | `pharmacy-dashboard.service.ts:1476` |

Effective costing model: **batch-level last purchase rate** (`purchaseRatePkr` set on receive), with product-level `costPricePkr` / `purchasePricePkr` used for aggregates. FEFO drives physical picking but not COGS. Phase 4 does not change this — it standardises on batch `purchaseRatePkr` with documented fallback and records the audit finding.

---

## 6. Existing weaknesses

1. **FEFO dispenses expired stock.** The batch query filters only `quantity > 0`; `expiryDate < today` batches sort first and are picked first. This is the single most serious defect found.
2. **FEFO ignores batch `status`.** A batch marked non-active is still picked.
3. **`movementType` is always `sale_out` on every deduct** (`engine:191,229`), so purchase returns and distribution invoices are mislabelled in the ledger. Only `referenceType` distinguishes intent.
4. **`pharmacy_stock_transfers` is dead schema.** No transfer capability exists for medicines; the nav points at restaurant ingredient transfers.
5. **No stock adjustment capability.** Shrinkage, damage, and write-off cannot be recorded.
6. **`reservedQuantity` is never written.** The `stock_reserved` order status sets a timestamp only (`advanceDistOrderStatus:2366–2406`) and holds no stock, so the same units can be promised to several orders.
7. **`damagedQuantity` is never read or written.** No quarantine or blocked concept exists at all.
8. **`fefoEnabled`, `batchTrackingEnabled`, `expiryTrackingEnabled` are stored but never enforced.**
9. **`currentStock` can desync from batches.** `createMedicine` and `updateMedicine` write `currentStock` directly outside the engine; opening stock writes no movement row.
10. **Movements are write-only.** No read API, so the audit trail is unusable by operators.
11. **No opening stock document.** Opening quantities are a side effect of medicine creation.
12. **No stock count / cycle count.**
13. **No reorder engine** beyond a flat `currentStock <= reorderLevel` report.
14. **No preferred-batch split.** `preferredBatchId` must satisfy the whole line or the sale fails.

---

## 7. Data integrity risks

| Risk | Evidence | Consequence |
| --- | --- | --- |
| No row locking anywhere | zero `FOR UPDATE` in `api/src/pharmacy` | Two concurrent sales can both pass the `currentStock` check and oversell a hot batch. Last-writer-wins on batch quantity. |
| `batches.warehouseId` has no FK and legacy rows are NULL | `pharmacy.ts:77`, `ensure-schema.mjs:411` | A NULL-warehouse batch is counted as available in **every** warehouse (`engine:208`), breaking warehouse isolation. |
| GRN has no idempotency guard | `pharmacy-erp.service.ts:885–998` | A retried POST double-receives stock. |
| Distribution invoice guarded by order status only | `pharmacy-erp.service.ts:1445–1455` | Weaker than a true idempotency key. |
| No `CHECK (quantity >= 0)` | schema | Direct SQL or a future code path can drive a batch negative. |
| `currentStock` writable outside the engine | `pharmacy.service.ts:1345` | Availability lies in both directions: phantom stock (oversell attempts that fail late) or hidden stock (sales blocked while batches exist). |
| Accounting hooks run outside the stock transaction | GRN `986–994` | Stock can commit while the journal fails; hooks are idempotent by `(source, sourceRef)` so re-posting is safe, but drift is possible. |
| `reservedQuantity` exists but unused | `pharmacy.ts:83` | If any future code populates it, nothing subtracts it from available — silent oversell. |

---

## 8. Migration requirements

The project applies schema with `pnpm db:push` (drizzle-kit), not migration folders, and the schema is **mirrored in both repos** (`backend-system/packages/database-pg` and `Universal-application-system-/packages/database-pg`) — both must be edited identically.

Required and all **additive**:

- New nullable / defaulted columns on `pharmacy_medicine_batches` (blocked, quarantine quantities; supplier and cost metadata; derived-status support).
- New nullable / defaulted columns on `pharmacy_stock_movements` (unit cost, value, idempotency key, running-balance support).
- Workflow columns on `pharmacy_stock_transfers` and `pharmacy_stock_transfer_lines`.
- New tables: adjustments (+lines), stock counts (+lines), reservations, inventory settings.
- Indexes on `pharmacy_stock_movements`, `pharmacy_medicine_batches`, `pharmacy_warehouses`, `pharmacy_stock_transfers`.

No column drops, no type narrowing, no destructive cascade changes, no data deletion. Historical `movementType` values (`grn_in`, `sale_out`, `return_in`) are **preserved and read through a normalisation map**; they are never rewritten.

---

## 9. Performance problems

| Problem | Location | Impact |
| --- | --- | --- |
| `GET /medicines` returns every medicine | `pharmacy.service.ts` | The inventory screen loads the whole catalogue, then filters in React. |
| `GET /batches` returns every batch | `pharmacy.service.ts` | The expiry screen loads all batches for all products. |
| `pharmacy_stock_movements` has no index | schema | Any ledger query becomes a full table scan; it is the fastest-growing table in the system. |
| `recomputeMedicineStock` runs a `SUM` over all batches of a medicine on every single line of every document | `engine:71–84` | Acceptable today, but unindexed on `(medicineId, warehouseId)`. |
| Valuation recomputed per report with different formulas | multiple | Inconsistent numbers and repeated full scans. |
| No `(medicineId, warehouseId)` index on batches | schema | FEFO batch selection scans by medicine only. |

---

## 10. Recommended final architecture

> This section was written **before** implementation and records the recommendation.
> Where the delivered code differs, `INVENTORY_ARCHITECTURE.md` is authoritative and
> the differences are called out inline below.

**One authoritative model, batch-level, warehouse-scoped, ledger-backed.**

```
Branch → Warehouse → Product → Batch → State
```

- **Batch quantity by state is the source of truth.** States are kept in separate columns and never merged: `AVAILABLE`, `RESERVED`, `DAMAGED`, `QUARANTINE`, `BLOCKED`, `EXPIRED` (expired is derived from `expiryDate`, not stored as a quantity).
- **`pharmacy_medicines.currentStock` is demoted to a cache** maintained by the engine. It stays for backward compatibility with existing screens and reports, and a reconciliation tool reports drift instead of silently repairing it. *As built it caches `SUM(batches.quantity)` — the available bucket alone, not available + reserved — so no existing screen's numbers change.*
- **One definition of the three numbers, computed in one service** (`StockAvailabilityService`) so no screen can disagree. As built:
  - `physical = quantity + reserved + damaged + quarantine + blocked`
  - `reserved = SUM(batches.reserved_quantity)`; the reservation table is the audit trail, written in the same transaction, not the source of the number
  - `available = SUM(quantity) WHERE status = 'active' AND expiryDate >= current_date`
  - **`available` is therefore not `physical` minus the other buckets.** Expired and on-hold units stay in `quantity`, so they sit inside `physical` and outside `available`, and no subtraction identity holds between the two. Every screen must read both numbers rather than deriving one from the other.
- **`pharmacy_stock_movements` becomes the authoritative append-only ledger.** Canonical movement types; history is never edited. *As built, corrections are made with an opposing adjustment document. The `reverses_movement_id` column and `REVERSAL` type exist in the schema and are returned by the read API, but no code path writes them yet.*
- **`PharmacyStockEngine` is kept and hardened**, not replaced: row locking, expired/blocked/quarantine exclusion, correct movement types, negative-stock policy, idempotency keys, cost capture.
- **Centralised services** under `api/src/pharmacy/inventory/`: settings, ledger, availability, FEFO, batch, transfer, adjustment, count, valuation, numbering, and a general `InventoryService`. *Reorder and reconciliation did not become separate services; both are methods on `InventoryService`.*
- **A single `/v1/pharmacy/inventory/*` API family**, all paginated and server-side searched, all permission-checked server-side with branch/warehouse scoping.
- **Dist-native UI** replacing the shared pharmacy inventory/expiry screens, built on the existing Dist design system.
- **Phase 5 contract:** the Sale Window never computes inventory itself. It calls availability and FEFO allocation APIs and receives allocations.

---

## 11. What Phase 4 deliberately does not change

- The pharmacy (retail) edition keeps working against the same APIs.
- `AccountingHooksService` posting and its `(source, sourceRef)` idempotency are untouched.
- The costing basis is **not** silently changed; it is documented and standardised on batch `purchaseRatePkr` with an explicit fallback chain.
- Restaurant/store inventory modules are out of scope.
- Historical ledger rows and their legacy `movementType` values are preserved.
