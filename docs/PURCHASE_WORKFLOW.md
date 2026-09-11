# Purchase Workflow — Phase 6

**Date:** 2026-09-11  
**Source of truth:** `backend-system/api/src/pharmacy/purchase/*.ts`, `purchase.controller.ts`, Dist pages under `apps/launcher/src/distribution/pages/DistributionPurchase*`, client `pharmacy-purchase.ts`.  
**Honesty:** Derived by reading code. **Not verified** against a running API. No measured latencies.

Supporting: `PURCHASE_AUDIT.md`, `GRN_WORKFLOW.md`, `SUPPLIER_PERFORMANCE.md`, `PHASE_6_REPORT.md`.  
Suite (not run): `backend-system/scripts/phase6-purchase-tests.mjs`.

---

## 1. End-to-end path

```
Requisition (draft)
  → submit → submitted
  → approve → approved
  → convert (+ supplierId) → draft PO  (+ requisition → converted | partially_converted)
PO (draft)
  → submit → submitted
  → approve → approved
  → send → sent
  → confirm → supplier_confirmed
  → GRN (partial) → PO partial
  → GRN (remainder) → PO received
  → Invoice from GRN (draft → post)   [documentary; AP already at GRN]
  → Purchase return → stock OUT (FEFO)  [no AP reverse yet]
```

Legacy thin routes still exist:

| Legacy | Delegate |
| --- | --- |
| `POST /v1/pharmacy/purchase-orders` | `PurchaseOrderService.create` |
| `POST /v1/pharmacy/purchase-orders/:id/approve` | `PurchaseOrderService.approve` |
| `POST /v1/pharmacy/grns` | `PurchaseGrnService.create` with **`skipPoStatusCheck` default `true`** |
| `POST /v1/pharmacy/purchase-returns` | `PurchaseReturnService.create` |

Dist UI prefers `/v1/pharmacy/purchase/*` (`PurchaseController`). Nest module **registers** controller + all purchase providers in `pharmacy.module.ts`.

---

## 2. Dist UI (Purchases group)

From `distribution/spec/nav.ts` + routes:

| Nav label | Path | Page |
| --- | --- | --- |
| Purchase Dashboard | `distribution/purchase` | `DistributionPurchaseDashboardPage` |
| Requisitions | `distribution/purchase-requisitions` | `DistributionPurchaseRequisitionsPage` |
| Purchase Orders | `distribution/purchase-orders` | `DistributionPurchaseOrdersPage` |
| GRN | `distribution/purchase-grn` | `DistributionPurchaseGrnPage` |
| Purchase Returns | `distribution/purchase-returns` | `DistributionPurchaseReturnsPage` |
| Purchase Invoices | `distribution/purchase-invoices` | `DistributionPurchaseInvoicesPage` |
| Suppliers | `distribution/suppliers` | Performance tab uses purchase supplier APIs |
| Purchase Reports | `distribution/reports?category=Purchase` | Reports hub |
| Purchase Accounting | `accounting/purchases` | Accounting deep-link |

Legacy / wrong-domain: `distribution/purchase-statement` still present — reads `pops_*` purchase domain (known gap; replace/deprecate).

Client: `pharmacy/api/pharmacy-purchase.ts` — new routes with 404 fallback to legacy ERP helpers.

---

## 3. Requisition status machine

Statuses written by `PurchaseRequisitionService`:

| Status | How entered | Allowed next |
| --- | --- | --- |
| `draft` | `create` / `fromReorder` / `updateDraft` | submit, approve (draft allowed), reject, cancel |
| `submitted` | `submit` from draft | approve, reject, cancel |
| `approved` | `approve` from draft or submitted | convert, cancel |
| `rejected` | `reject` (reason required) | terminal for happy path |
| `cancelled` | `cancel` (not if already converted/cancelled) | terminal |
| `partially_converted` | convert left remaining qty | convert again, cancel |
| `converted` | convert exhausted all lines | terminal for convert |

**Convert rules** (`convertToPo`):

- Status must be `approved` or `partially_converted`.
- Body **`supplierId` required** (`purchaseRequisitionConvertSchema`) — not optional header preferredSupplier alone.
- Lines with `requestedQty - convertedQty > 0` become PO lines; `unitCostPkr` from `lastPurchasePricePkr` or `0`.
- Creates a **draft** PO via `PurchaseOrderService.create`, then bumps line `convertedQty` and sets requisition status.

**fromReorder:** calls Phase 4 `InventoryService.reorderSuggestions` — no duplicate reorder math. Optional `medicineIds` filter. Body field is `medicineIds` (not `items`).

---

## 4. Purchase order status machine

Statuses from `PurchaseOrderService`:

| Status | Transition |
| --- | --- |
| `draft` | create (default); edit via `updateDraft` only in draft |
| `submitted` | `submit` from draft (supplierId + lines required); or create with `submit: true` |
| `approved` | `approve` from draft or submitted (supplierId required) |
| `sent` | `send` from approved only |
| `supplier_confirmed` | `confirm` from sent or approved |
| `partial` | set by `refreshReceiveStatus` after GRN when any line still pending |
| `received` | set by `refreshReceiveStatus` when all lines fully received |
| `cancelled` | `cancel` if not received/cancelled and no `receivedQty > 0` |

**Receivable for GRN** (`PO_RECEIVABLE_STATUSES`): `approved`, `sent`, `supplier_confirmed`, `partial`.

**Revise:** for non-draft/non-cancelled — creates a **new draft** PO with `parentOrderId` + bumped `revision`; original unchanged.

**Idempotency:** optional `idempotencyKey` on create — unique per org; replay returns existing PO.

---

## 5. Invoice and return (summary)

**Invoice** (`PurchaseInvoiceService`):

- `createFromGrn` → status `draft`, copies GRN lines; `accountingNote` states AP already posted at GRN.
- `post` → `posted` only (no second JV).
- `matchSummary` compares PO / GRN / invoice totals.

**Return** (`PurchaseReturnService`):

- Creates return + `PharmacyStockEngine.deductFefo` with movement `PURCHASE_RETURN`.
- **No AP reverse** (documented TODO in service).

Details for GRN posting: `GRN_WORKFLOW.md`.

---

## 6. Permissions

Controller uses `@RequirePermissions` with OR semantics (any listed id). Catalogue used:

| Area | Permission ids (plus legacy OR) |
| --- | --- |
| View / dashboard | `purchase.view`, `purchase.reports`, `pharmacy.purchase.view`, `pharmacy.view`, `pops.read` |
| Requisition write | `purchase.requisition`, `pharmacy.purchase.manage`, `pops.inventory.manage` |
| Requisition approve/reject | `purchase.requisition.approve` (+ `purchase.order.approve` on approve) |
| PO write / send / confirm | `purchase.order`, …manage |
| PO approve | `purchase.order.approve`, …manage |
| GRN | `purchase.grn`, `purchase.grn.post` on create |
| Invoice | `purchase.invoice` |
| Return | `purchase.return` |
| Suppliers | `purchase.supplier` |

**Gap:** role templates beyond admin `*` may still lack granular `purchase.*` — Dist buyer/manager must be granted explicitly. Admin `*` and legacy `pharmacy.purchase.manage` still open most write paths.

System type: `pharmacy` or `distribution` (`@RequireSystemType`).

---

## 7. Numbering (`PurchaseNumberingService`)

Same pattern as inventory numbering: max existing sequence for prefix + year, then `+1`, retry on unique conflict (up to 5).

| Kind | Prefix | Example shape |
| --- | --- | --- |
| requisition | `REQ` | `REQ-2026-00001` |
| order | `PO` | `PO-2026-00001` |
| grn | `GRN` | `GRN-2026-00001` |
| invoice | `PINV` | `PINV-2026-00001` |
| return | `PRN` | `PRN-2026-00001` |

Year = UTC full year. Unique indexes: `(organization_id, *_number)` from ensure-schema Phase 6 block.

---

## 8. Dashboard KPIs

`GET /v1/pharmacy/purchase/dashboard` returns `{ kpis: [{ key, label, value, to }] }` — not a flat named object.

Keys from `PurchaseDashboardService`: `purchase_today`, `purchase_month`, `pending_requisitions`, `pending_pos`, `pending_approvals`, `partial_pos`, `overdue_expected`, `returns_count`, `payables_estimate` (GRN totals − return totals), `low_stock` (reorder suggestions capped), `pending_confirmations`.

FE `normalizeDashboard` maps array keys → Dist named fields.

---

## 9. Documented gaps (no code change here)

1. Convert API requires **`supplierId`** in body — FE must send it (audit noted omissions).
2. Invoice post is documentary only; AP remains GRN JV.
3. Purchase return does not reverse AP.
4. `distribution/purchase-statement` wrong domain (`pops_*`).
5. No multi-level approval matrix (amount/role thresholds) — single approve permission.
6. Deploy + `phase6-purchase-tests.mjs` required before claiming verified behaviour.
