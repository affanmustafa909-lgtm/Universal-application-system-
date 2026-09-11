# Phase 6 — Purchase Final Report

**Date:** 2026-09-11  
**Status:** Partially completed — **code-complete in repo, Nest module registered, Dist purchase pages present. NOT deployed. Tests NOT run.**  
**Rule:** Do not claim complete until tested against a live API (same deploy gate as Phases 4–5).

Supporting docs: `PURCHASE_AUDIT.md`, `PURCHASE_WORKFLOW.md`, `GRN_WORKFLOW.md`, `SUPPLIER_PERFORMANCE.md`.  
Suite: `backend-system/scripts/phase6-purchase-tests.mjs` → writes `docs/PHASE_6_TEST_RESULTS.json` **only when executed**.

---

## 1. Phase 6 Status

| Status | Meaning |
| --- | --- |
| **Partially completed** | Purchase services + controller + Dist UI + docs + suite written; module wired |
| Completed | Blocked on deploy + `phase6-purchase-tests.mjs` green |
| Blocked | Same environment limits as Phase 4/5 (no local Postgres/Docker; Railway not authenticated from authoring env) |

Earlier audit noted registration as a blocker; **current `pharmacy.module.ts` registers `PurchaseController` and all eight purchase providers** and Erp injects PO/GRN/return services as thin delegates.

---

## 2. Purchase Window Changes (Dist pages)

| Page | Route |
| --- | --- |
| `DistributionPurchaseDashboardPage` | `distribution/purchase` |
| `DistributionPurchaseRequisitionsPage` | `distribution/purchase-requisitions` |
| `DistributionPurchaseOrdersPage` | `distribution/purchase-orders` |
| `DistributionPurchaseGrnPage` | `distribution/purchase-grn` |
| `DistributionPurchaseInvoicesPage` | `distribution/purchase-invoices` |
| `DistributionPurchaseReturnsPage` | `distribution/purchase-returns` |
| Suppliers (performance tab) | `distribution/suppliers` |

Nav: Purchases group in `distribution/spec/nav.ts`.  
Client: `pharmacy/api/pharmacy-purchase.ts` (new `/purchase/*` with legacy 404 fallback).  
Hooks: `distribution/purchase/usePurchaseCart.ts`, `usePurchaseProductSearch.ts`.

---

## 3. Backend Changes

| Area | Detail |
| --- | --- |
| Controller | `PurchaseController` → `/v1/pharmacy/purchase/*` |
| Services | `PurchaseNumberingService`, `PurchaseRequisitionService`, `PurchaseOrderService`, `PurchaseGrnService`, `PurchaseInvoiceService`, `PurchaseReturnService`, `PurchaseDashboardService`, `SupplierPerformanceService` |
| Module | Registered in `pharmacy.module.ts` (controllers + providers; PO/GRN/req exported) |
| Erp delegates | `createPurchaseOrder` / `approvePurchaseOrder` / list → `PurchaseOrderService`; `createGrn` → `PurchaseGrnService` with **legacy `skipPoStatusCheck` default true**; purchase returns → `PurchaseReturnService` |
| Stock | GRN → `receiveBatch`; return → `deductFefo` (Phase 4 only) |
| Accounting | GRN still posts JV via `recordPurchaseFromPharmacyGrn`; invoice post does not double AP; return does not reverse AP |

---

## 4. Database Changes

Additive in `ensure-schema.mjs` Phase 6 block (~1128+):

- Tables: `pharmacy_purchase_requisitions` + lines; `pharmacy_purchase_invoices` + lines
- PO columns: warehouse, requisition, buyer, payment terms, confirmation/revision/idempotency/timestamps
- GRN: idempotency_key, received_by; GRN lines: purchase_order_line_id
- Unique org+number (and org+idempotency) indexes; status/date indexes
- Return org+number unique index

No destructive migrations. No separate pharmacy_suppliers table (uses `pops_suppliers`).

---

## 5. Purchase Rules (summary)

| Rule | Behaviour |
| --- | --- |
| Requisition | draft → submit → approve → convert (needs **supplierId**) |
| PO | draft → submit → approve → send → confirm; GRN sets partial/received |
| GRN | expiry required; expired blocked; near-expiry warn/block; over-receive blocked; price variance 10%/25%; Phase 4 receiveBatch; idempotent |
| Invoice | documentary 3-way; post flips status only |
| Return | stock OUT FEFO; no AP reverse |
| Numbering | `REQ|PO|GRN|PINV|PRN-YYYY-#####` with conflict retry |
| Performance | onTimeRate / fillRate / returnRate only — no invented score |

Full detail: `PURCHASE_WORKFLOW.md`, `GRN_WORKFLOW.md`, `SUPPLIER_PERFORMANCE.md`.

---

## 6. Testing

| Layer | Status |
| --- | --- |
| Suite `scripts/phase6-purchase-tests.mjs` | Written — **NOT RUN** |
| Results artefact | `PHASE_6_TEST_RESULTS.json` **absent** (= not run) |
| Soft timings | Recorded by script only when executed; **never** a hard fail by budget |

Do not treat any purchase doc claim as live-observed behaviour until the suite is green against a deployed API with Phase 6 DDL applied.

---

## 7. Performance

**Not measured.** No p50/p95 claims. Soft probes in the suite (supplier search, dashboard, GRN post) exist for later capture only.

---

## 8. Known Issues

1. **AP reverse on purchase return missing** — intentional gap until a shared accounting hook exists.  
2. **Legacy purchase-statement** (`distribution/purchase-statement`) still wrong domain (`pops_*`).  
3. **Role templates** may lack granular `purchase.*` (admin `*` / legacy manage still work).  
4. **Convert requires `supplierId`** in body (`purchaseRequisitionConvertSchema`) — FE must not omit it.  
5. Over-receive override flags accepted but **not honoured**.  
6. Legacy `/v1/pharmacy/grns` defaults `skipPoStatusCheck: true`.  
7. FE/BE contract mismatches from audit (dashboard shape mitigated by `normalizeDashboard`; from-reorder path/body; PO filter `status=pending` not a real status) — validate in Dist before go-live.  
8. Deploy + suite required before production trust.

---

## 9. Phase 7 readiness

Phase 7 (Delivery / POD / Collections / Recovery) can proceed in parallel on delivery code, but **procurement should not be treated as production-ready** until:

1. API deploy (Phase 6 ensure-schema block on boot),  
2. `phase6-purchase-tests.mjs` green,  
3. Dist smoke of requisition → PO → GRN → invoice → return,  
4. Role grants for non-admin Dist buyers.

Phase 4 inventory remains a hard dependency for GRN/return stock correctness.
