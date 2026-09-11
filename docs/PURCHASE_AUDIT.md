# PURCHASE AUDIT — Phase 6 Pre-Implementation / Scaffold Assessment

**Date:** 2026-09-11 (updated after scaffold inventory)  
**Scope:** Pharmaceutical distribution procurement — suppliers, requisitions, PO, approval, GRN, batch/expiry, invoices, payables, returns, performance, reports  
**Rule:** audit before changing production behaviour. Evolve existing `pharmacy_purchase_*` — do not create a second purchase system.  
**Related:** Phase 4 inventory, Phase 5 Sale Window, Dist nav.

---

## 1. Current architecture

```
Live (legacy thin):
  PharmacyPurchaseOrdersPage
    → POST /v1/pharmacy/purchase-orders | /grns | /purchase-returns
    → PharmacyErpService  ──(now thin-delegates)──► Purchase*Service

Scaffold (operational only after Nest registration):
  Dist Purchase pages
    → /v1/pharmacy/purchase/*  (PurchaseController)
    → PurchaseRequisition|Order|Grn|Invoice|Return|Dashboard|Performance
```

| Layer | Tables | Role |
| --- | --- | --- |
| Supplier | `pops_suppliers` | Shared master (no pharmacy_suppliers table) |
| Requisition | `pharmacy_purchase_requisitions` + lines | Schema + service present |
| PO | `pharmacy_purchase_orders` + lines | Workflow columns + service present |
| GRN | `pharmacy_grns` + lines | Hardened service; Phase 4 `receiveBatch` |
| Invoice | `pharmacy_purchase_invoices` + lines | Documentary 3-way; JV AP still at GRN |
| Return | `pharmacy_purchase_returns` + lines | Stock OUT via FEFO |
| Stock | batches + stock_movements | Phase 4 only — never from React |

**Parallel stacks (do not merge):** restaurant `/v1/inventory` ingredient PO/GRN; store grocery requisitions.

---

## 2. Frontend

### Dist nav (target Purchases group)

| Item | Path | Status |
| --- | --- | --- |
| Purchase Dashboard | `distribution/purchase` | Page scaffolded |
| Requisitions | `distribution/purchase-requisitions` | Page scaffolded |
| Purchase Orders | `distribution/purchase-orders` | Page scaffolded (replaces thin ERP) |
| GRN | `distribution/purchase-grn` | Page scaffolded |
| Invoices | `distribution/purchase-invoices` | Page scaffolded |
| Returns | `distribution/purchase-returns` | Page scaffolded |
| Suppliers / Performance | `distribution/suppliers` | Performance tab scaffolded |
| Reorder | Inventory Reports | Phase 4 — bridge via from-reorder |
| Purchase History | `distribution/purchase-statement` | **Wrong domain** (`pops_*`) — replace/deprecate |

### Client / hooks

- `pharmacy/api/pharmacy-purchase.ts` — new routes + legacy 404 fallback  
- `distribution/purchase/usePurchaseCart.ts`, `usePurchaseProductSearch.ts`

### Gaps / mismatches (must fix when wiring)

1. Dashboard KPI shape: BE `{ kpis: [{key,label,value,to}] }` vs FE named fields.  
2. `from-reorder` path/body mismatch (`/from-reorder` vs `/requisitions/from-reorder`; `items` vs `medicineIds`).  
3. Convert requisition omits required `supplierId`.  
4. PO list filter `status=pending` not a real status.  
5. Invoice `post` / three-way match UI thin.  
6. Supplier search: schema has `active`, not `code`/`status`.

---

## 3. Backend

### Live endpoints (still mounted)

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/v1/pharmacy/purchase-orders` | Delegates when DI works |
| POST | `/v1/pharmacy/purchase-orders/:id/approve` | Delegates |
| GET/POST | `/v1/pharmacy/grns` | Delegates; optional idempotencyKey |
| GET/POST | `/v1/pharmacy/purchase-returns` | Delegates |

### Scaffold endpoints (`PurchaseController` → `/v1/pharmacy/purchase`)

Dashboard, requisitions CRUD/workflow, from-reorder, orders workflow (submit/approve/send/confirm/cancel/revise), GRNs, invoices (+ post/match), returns, suppliers search/summary/performance.

**BLOCKER:** `PurchaseController` + all 8 services **not registered** in `pharmacy.module.ts`. Until registered, Dist pages 404 and fall back to legacy; ERP constructor injections of purchase services cannot resolve.

### Services present

`PurchaseNumberingService`, `PurchaseRequisitionService`, `PurchaseOrderService`, `PurchaseGrnService`, `PurchaseInvoiceService`, `PurchaseReturnService`, `PurchaseDashboardService`, `SupplierPerformanceService`.

### Historical live bugs (scaffold GRN/PO intended to fix)

1. Any GRN forced PO `received` (never `partial`).  
2. GRN without approved/receivable PO.  
3. Over-receive allowed.  
4. No expiry / near-expiry / shelf-life gate.  
5. No price variance gate.  
6. `Date.now` numbering under unique indexes.  
7. Pharmacy GRN → JV only (no vendor bill); returns do not reverse AP.  
8. Legacy reports read `pops_purchase_orders`.

---

## 4. Database

**Present (schema + ensure-schema Phase 6 block):** requisitions, PO workflow/idempotency/confirmation/revision fields, GRN idempotency + PO line id, purchase invoices + lines, unique org+number indexes, status/date indexes.

**Absent / intentional gaps:** pharmacy-specific supplier table; automatic AP reverse on return; configurable multi-level approval matrix (role/amount thresholds beyond simple approve permission).

---

## 5. Inventory integration

GRN → `PharmacyStockEngine.receiveBatch` → ledger `GRN`.  
Return → `deductFefo` → ledger `PURCHASE_RETURN`.  
Reorder → `InventoryService.reorderSuggestions` — raise via requisition `fromReorder` / convert to PO.

**Rule:** never update stock from frontend; never duplicate FEFO/receive logic.

---

## 6. Permissions

Catalogue: `purchase.view`, `purchase.requisition`, `purchase.requisition.approve`, `purchase.order`, `purchase.order.approve`, `purchase.grn`, `purchase.grn.post`, `purchase.invoice`, `purchase.return`, `purchase.supplier`, `purchase.reports` (+ legacy `pharmacy.purchase.view|manage` OR).

Role templates beyond admin `*` still need Dist buyer/manager grants for granular ids.

---

## 7. Recommended architecture (Phase 6)

1. Register Nest purchase providers + `PurchaseController`.  
2. Keep legacy `/purchase-orders` + `/grns` as **thin delegates** to Phase 6 services.  
3. Align FE client contracts (dashboard, from-reorder, convert, performance).  
4. Add missing `PATCH orders/:id` if draft edit is required.  
5. Dist-native dense UX (cart + server search) matching Sale Window speed.  
6. Do **not** adopt restaurant or store purchase UIs for medicines.

---

## 8. Definition of done (tracking)

Operational only when: module wired, Dist E2E requisition→PO→approve→confirm→GRN→stock→invoice→return passes, partial receive correct, idempotent GRN, expiry gates, permissions enforced server-side, suite run against deployed API.

Until deploy + tests: **code-complete / unverified**.

---

*End of audit. Implementation must wire scaffold, not rewrite.*
