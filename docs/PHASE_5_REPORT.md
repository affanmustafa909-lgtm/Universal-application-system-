# Phase 5 — Sale Window Final Report

**Date:** 2026-09-11  
**Status:** Partially completed — **code-complete, type-checked (backend). Not deployed. Behavioural tests not run.**  
**Rule:** Do not claim complete until tested against a live API (same deploy gate as Phase 4).

Supporting docs: `SALE_WINDOW_AUDIT.md`, `SALE_WINDOW_ARCHITECTURE.md`, `SALE_WORKFLOW.md`, `SALE_PRICING_RULES.md`, `SALE_SCHEME_RULES.md`, `SALE_PERFORMANCE.md`, `SALE_TESTING.md`.

---

## 1. Phase 5 Status

| Status | Meaning |
| --- | --- |
| **Partially completed** | Sale Window evolved in place; sales APIs added; docs + suite written |
| Completed | Blocked on deploy + `phase5-sale-window-tests.mjs` green |
| Blocked | Railway unauthorized / no local DB — cannot measure or run E2E |

---

## 2. Sale Window Changes

Evolved **`DistributionOrdersPage.tsx`** (route unchanged: `/pops/distribution/orders`):

- Dense Dist layout: header (customer, salesman, warehouse, credit chips) + server product search + always-visible cart
- Server-side customer and product search (AbortController via TanStack Query / debounce)
- Barcode wedge → lookup → add
- FEFO allocations via Phase 4 `inventory/availability` (paid + free physical qty)
- Cart shows free qty, scheme label, price source, batch allocation summary, stock shortfall
- Credit override requires **reason** (no silent bypass)
- Hold → server draft + localStorage emergency backup; Held panel for server drafts
- Book / Book & Print with client lock + `idempotencyKey`
- Book failure **keeps cart**
- Keyboard: F2/F4/F7/F8/F9/F10, Ctrl+N, Esc, Delete, arrows/Enter
- Orders pipeline (approve/invoice) retained as secondary panel
- Retail `PharmacyPosPage` untouched

New client/hooks: `pharmacy-sales.ts`, `distribution/sales/useSale*.ts`

---

## 3. Backend Changes

| Area | Detail |
| --- | --- |
| APIs | `/v1/pharmacy/sales/products/search`, `.../barcode`, `customers/search`, `pricing/quote`, `validate`, `held`, `DELETE held/:id`, `book` |
| Services | `SalesSearchService`, `SalesPricingService`, `SalesCreditService`, `SalesValidationService` |
| Posting | Still `createDistOrder` — **no second invoice system** |
| Validation | Structured codes (CREDIT_LIMIT, INSUFFICIENT_STOCK, …) |
| Schemes | Priority ASC, then max free tie-break |
| Credit | Override requires non-empty reason; audited on order columns |
| Idempotency | `pharmacy_dist_orders.idempotency_key` unique per org |
| Invoice | `FOR UPDATE` on order before WINV create |
| Stock on submit | Availability gate for paid+free unless `skipStockCheck` |
| Permissions | `sales.*` catalogue (+ `distribution.orders` OR for compat) |

---

## 4. Database Changes

Additive only (also in `ensure-schema.mjs`):

- `pharmacy_dist_orders.idempotency_key` + unique `(organization_id, idempotency_key)`
- `credit_override_reason`, `credit_override_by_user_id`, `credit_override_at` (as implemented)

No destructive migrations. No retail `pharmacy_sales` rewrite.

---

## 5. Sales Rules (summary)

| Rule | Behaviour |
| --- | --- |
| Pricing | Customer list → area → customer type → price level → wholesale/dealer → selling |
| Schemes | buy_x_get_y; priority column ASC; free tracked separately; stock consumes paid+free |
| Credit | Block when outstanding+sale > limit unless override+reason |
| FEFO | Phase 4 only — Sale Window does not reimplement |
| Tax | Uses existing order tax fields; not hard-coded in UI |

---

## 6. Testing

| Layer | Status |
| --- | --- |
| Backend `tsc --noEmit` | Pass |
| Suite `scripts/phase5-sale-window-tests.mjs` | Written — **not executed** |
| Results artefact | `PHASE_5_TEST_RESULTS.json` absent (= not run) |
| Concurrency / idempotency / scheme / credit / FEFO | Covered in suite design; unverified live |

---

## 7. Performance

Targets documented in `SALE_PERFORMANCE.md`. **Measured: not yet — deploy required.**

Main win already coded: Sale Window no longer primary-paths on load-all `GET /medicines`.

---

## 8. Known Issues

1. Held list headers may lack line detail for perfect resume (resume may need getDistOrder).  
2. `priceOverrideReason` in schema but price override audit path incomplete.  
3. Invoice still requires approve/pipeline before WINV (by design of existing statuses).  
4. Reprint of historical orders/invoices can still be totals-only.  
5. Manual FEFO/batch override UI + permission gate not fully polished.  
6. Live performance and E2E not measured.  
7. Phase 4 + Phase 5 schema both need API deploy via `ensure-schema.mjs` boot DDL.

---

## 9. Phase 6 Readiness

Ready to proceed on **purchase** once Sale Window is deployed and the Phase 5 suite is green.

Must address before trusting production booking:

- Deploy backend (Phase 3/4/5 DDL on boot)  
- Run `phase5-sale-window-tests.mjs`  
- Confirm credit override audit rows and idempotent book under load  

Retail POS and existing Dist invoices remain intact by design.
