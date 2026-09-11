# GRN Workflow — Phase 6

**Date:** 2026-09-11  
**Source:** `PurchaseGrnService`, `PurchaseOrderService.refreshReceiveStatus` / `assertReceivable`, Phase 4 `PharmacyStockEngine.receiveBatch`, legacy `PharmacyErpService.createGrn`.  
**Honesty:** Code-derived only. Suite not run. No invented timings.

See also: `PURCHASE_WORKFLOW.md`, `INVENTORY_ARCHITECTURE.md` (Phase 4 stock engine).

---

## 1. Entry points

| Route | Behaviour |
| --- | --- |
| `POST /v1/pharmacy/purchase/grns` | Dist path. `skipPoStatusCheck` only if body sets `true` (default false). |
| `POST /v1/pharmacy/grns` | Legacy. Erp **defaults `skipPoStatusCheck: true`** so callers can post without an approved PO. |

Both call the same `PurchaseGrnService.create`.

Permissions on Dist create: `purchase.grn` **or** `purchase.grn.post` (plus legacy manage ORs).

---

## 2. Batch capture (required fields)

Every line must include:

- `medicineId`, `batchNumber`, `expiryDate` (required — missing expiry → 400)
- `quantity` (≥ 1), optional `freeQuantity`
- `unitCostPkr`
- optional `purchaseOrderLineId` (else match PO line by `medicineId`)
- optional `manufacturingDate`

Header: `branchCode`, optional `warehouseId` (else default warehouse), optional `purchaseOrderId` / `supplierId`, `receivedDate`, `notes`, `idempotencyKey`, variance/over-receive flags.

Stock is **never** updated from React — only via `receiveBatch` inside the GRN transaction.

---

## 3. Expiry / near-expiry

Computed as calendar days from local midnight to `expiryDate`:

| Condition | Behaviour |
| --- | --- |
| `days < 0` | **Hard block** — `Expired stock blocked: batch …` |
| `0 ≤ days < nearExpiryDays` | Warning string; **hard block** only if `blockNearExpiry: true` |
| otherwise | OK |

`nearExpiryDays` comes from Phase 4 `InventorySettingsService.getSettings` for the branch.

---

## 4. Over-receive

Against a linked PO:

- Ordered line qty = `quantity + freeQuantity`.
- Pending = ordered − `receivedQty` (enriched as `pendingQty` on getById).
- Receive total on GRN line = qty + freeQty.
- If receive total **> pending** → **always 400** (`Over-receive blocked…`).

`overReceive` / `overReceiveReason` are accepted on the controller body but **currently ignored** — comment in service: reserved for later permissioned override.

---

## 5. Price variance (vs PO unit cost)

Constants in service:

- `PRICE_VARIANCE_WARN = 0.1` (10%) → warning only
- `PRICE_VARIANCE_BLOCK = 0.25` (25%) → block unless override

Variance = `|grnUnitCost − poUnitCost| / poUnitCost` when both costs `> 0`.

| Band | Result |
| --- | --- |
| ≤ 10% | silent |
| > 10% and ≤ 25% | `warnings[]` entry |
| > 25% | 400 unless `priceVarianceOverride: true` **and** non-empty `priceVarianceReason` |

---

## 6. PO status gate and `skipPoStatusCheck`

`assertReceivable`:

- Without skip: PO status must be in `{ approved, sent, supplier_confirmed, partial }`.
- With `skipPoStatusCheck: true`: status gate bypassed (legacy Erp default).

Dist purchase GRN should leave skip false so unapproved POs cannot receive.

---

## 7. Partial receive via `refreshReceiveStatus`

After each GRN posts line receipts (`receivedQty += qty + freeQty` on matched PO lines), the service calls:

```text
PurchaseOrderService.refreshReceiveStatus(tx, purchaseOrderId)
```

Logic:

- Any pending > 0 and any received > 0 → PO status **`partial`**
- No pending and some received → **`received`**
- Does not overwrite `cancelled`
- **Never** forces `received` on the first partial receipt (legacy bug fixed here)

---

## 8. Idempotency

Two layers when `idempotencyKey` is provided:

1. **Table:** unique `(organization_id, idempotency_key)` on `pharmacy_grns`. Pre-check returns prior GRN with `replayed: true` (no second stock post).
2. **Ledger:** document key `grn-doc:{idempotencyKey}` via `StockLedgerService.hasPosted` / first-line movement key; concurrent races retry on Postgres `23505`.

Without a key, each POST creates a new GRN (numbering still unique).

---

## 9. Phase 4 `receiveBatch` + transactional posting

Inside `db.transaction`:

1. Insert GRN header (`status: "posted"`, numbered via `PurchaseNumberingService`).
2. Per line: `stock.receiveBatch(…)` with `movementType: GRN`, batch/expiry, purchase rate, supplier, `grnId`.
3. Update PO line `receivedQty` when PO linked.
4. Insert `pharmacy_grn_lines` (batchId, purchaseOrderLineId, costs).
5. `refreshReceiveStatus` if PO linked.

After commit (if not replayed): `AccountingHooksService.recordPurchaseFromPharmacyGrn` (JV AP). Failures are swallowed so stock/GRN are not rolled back by optional accounting errors.

**Rule:** do not invent a second stock path; do not switch silently to vendor bills.

---

## 10. Response shape

Successful create returns GRN row + `lines` + `warnings: string[]` + `replayed: boolean`.

---

## 11. Gaps (documented only)

- Over-receive override not implemented despite flags.
- Legacy `/grns` skip-status default can still post against non-receivable POs — intentional compat; Dist should not skip.
- AP on GRN is JV-only; returns do not reverse it (`PURCHASE_WORKFLOW.md`).
