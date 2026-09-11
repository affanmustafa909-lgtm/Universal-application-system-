# Sale Window Architecture — Phase 5

**Date:** 2026-09-11  
**Scope:** Pharmaceutical distribution Sale Window — search, quote, validate, book, invoice  
**Status:** Code complete in both repos. **Not deployed.** The automated test suite has not been executed — see `SALE_TESTING.md`.  
**Source of truth:** the files listed in §10. Every statement below is traceable to one of them. Anything not verified from code is marked *unverified*.

This document supersedes the “recommended architecture” section of `SALE_WINDOW_AUDIT.md` wherever the two differ. Section §11 lists delivered-vs-audit divergences.

---

## 1. One Sale Window. No second sales system.

The Dist Sale Window is still **one screen** and **one booking pipeline**:

| Piece | Location | Role |
| --- | --- | --- |
| Primary UI | `apps/launcher/src/distribution/pages/DistributionOrdersPage.tsx` | Nav **Sale Window** → `/pops/distribution/orders` |
| FE hooks | `apps/launcher/src/distribution/sales/*` | Cart, product/customer search, keyboard map |
| FE API client | `apps/launcher/src/pharmacy/api/pharmacy-sales.ts` | `/v1/pharmacy/sales/*` with 404 fallbacks |
| Phase 5 APIs | `api/src/pharmacy/sales/sales.controller.ts` | Search, quote, validate, held, book wrapper |
| Booking authority | `PharmacyErpService.createDistOrder` | Creates `DO-*` (`draft` or `booked`) |
| Invoice authority | `PharmacyErpService.invoiceFromOrder` | Creates `WINV-*`, FEFO deduct, outstanding |
| Stock / FEFO | Phase 4 `StockAvailabilityService` + `PharmacyStockEngine.deductFefo` | Sale Window never recomputes FEFO |

**Explicit non-goals (unchanged):** do not replace retail `POST /v1/pharmacy/sales`; do not invent a parallel invoice table; do not fork posting out of `PharmacyErpService`.

---

## 2. Lifecycle: search → quote → validate → book → invoice

```
Customer (server search)
    ↓
Product / barcode (lean server search + availableQty)
    ↓
Local cart (qty, free, price source, FEFO allocations preview)
    ↓  POST /v1/pharmacy/sales/pricing/quote
Quote (resolvePrice + schemes per line)
    ↓  POST /v1/pharmacy/sales/validate
Validate (customer, products, quote, credit, availability paid+free)
    ↓  POST /v1/pharmacy/sales/book  (or POST /distribution/orders)
Book → pharmacy_dist_orders status=booked (idempotent when key set)
    ↓  approve / pipeline advance
    ↓  POST /distribution/orders/:id/invoice
Invoice → WINV-* + deductFefo(qty+free) + outstanding += total
```

| Stage | Who owns it | Stock effect |
| --- | --- | --- |
| Search / barcode | `SalesSearchService` | Read-only `getAvailability` for lean `availableQty` |
| Quote | `SalesPricingService.quoteCart` | None |
| Validate | `SalesValidationService` | Read-only `checkAvailability` for **paid + free** |
| Book (`submit:true`) | `createDistOrder` | Re-checks availability unless `skipStockCheck`; **does not reserve or deduct** |
| Hold (`submit:false`) | `createDistOrder` → `draft` | No stock check |
| Invoice | `invoiceFromOrder` | Release reservations → `deductFefo(quantity + freeQuantity)` |

FEFO is Phase 4 only: the Sale Window calls availability for a plan; invoice posts through the engine. React never sorts batches by expiry.

---

## 3. Services map

### Backend (`api/src/pharmacy/sales/` + ERP)

| Service | File | Owns |
| --- | --- | --- |
| `SalesSearchService` | `sales-search.service.ts` | Lean product search, barcode/SKU lookup, trade-customer search |
| `SalesPricingService` | `sales-pricing.service.ts` | `resolvePrice`, `resolveSchemeDetail` / free qty, `quoteCart` |
| `SalesCreditService` | `sales-credit.service.ts` | Credit limit evaluate; override requires non-empty reason |
| `SalesValidationService` | `sales-validation.service.ts` | Aggregate validate: customer, products, quote, credit, stock |
| `SalesController` | `sales.controller.ts` | HTTP surface under `/v1/pharmacy/sales` |
| `PharmacyErpService` | `pharmacy-erp.service.ts` | `createDistOrder`, held list/cancel, approve, invoice, advance |
| Phase 4 availability / FEFO | `inventory/*` | Sole stock arithmetic and allocation authority |

Dependency rule: sales services inject pricing / credit / availability / Drizzle. They **do not** inject `PharmacyErpService` (avoids cycles). The controller injects ERP only for held + book.

### Frontend

| Module | Owns |
| --- | --- |
| `DistributionOrdersPage.tsx` | Shell: customer bar, search, cart aside, hold/book/print, orders modal |
| `useSaleCart` | Local cart lines + totals |
| `useSaleProductSearch` | 250ms debounce; server search; barcode handler |
| `useSaleCustomerSearch` | 250ms debounce; server customer search |
| `useSaleShortcuts` | F2 / F4 / F7–F10 / Ctrl+N / Esc / Delete |
| `pharmacy-sales.ts` | API client + capability fallbacks when routes 404 |

---

## 4. HTTP surface (Phase 5)

| Method | Path | Permission (any of) | Behaviour |
| --- | --- | --- | --- |
| GET | `/v1/pharmacy/sales/products/search` | `sales.view`, `distribution.orders`, `pharmacy.view`, `pops.read` | Lean ILIKE search + `availableQty` |
| GET | `/v1/pharmacy/sales/products/barcode` | same | Exact barcode / alternate / SKU |
| GET | `/v1/pharmacy/sales/customers/search` | same | Active trade customers |
| POST | `/v1/pharmacy/sales/pricing/quote` | `sales.view`, `distribution.orders`, `distribution.pricing`, `pops.read` | Multi-line quote |
| POST | `/v1/pharmacy/sales/validate` | `sales.book`, `distribution.orders`, `pops.inventory.manage` | Structured errors / warnings |
| GET | `/v1/pharmacy/sales/held` | `sales.hold`, `sales.resume`, `distribution.orders` | `status=draft` orders |
| DELETE | `/v1/pharmacy/sales/held/:orderId` | `sales.hold`, `distribution.orders` | Soft-cancel draft → `cancelled` |
| POST | `/v1/pharmacy/sales/book` | `sales.book`, `distribution.orders`, `pops.inventory.manage` | Validate then `createDistOrder(submit:true)` |

Booking also remains available as `POST /v1/pharmacy/distribution/orders` with the same `createPharmacyDistOrderSchema` (including `idempotencyKey`, `creditOverrideReason`).

System types: controller requires `pharmacy` **or** `distribution`.

---

## 5. Idempotency and concurrency

### Book (`createDistOrder`)

1. If `idempotencyKey` is present, look up existing org+key and return that order.  
2. Inside the insert transaction, re-check the key before insert.  
3. Schema unique index `pharmacy_dist_orders_org_idem_uq` on `(organization_id, idempotency_key)` (NULL keys unconstrained).

Columns added in ensure-schema Phase 5 block (`ensure-schema.mjs` ~1120–1126):

- `idempotency_key`
- `credit_override_reason`
- `credit_override_by_user_id`
- `credit_override_at`

The UI generates `crypto.randomUUID()` once per Book click and sends it on both validate and book bodies.

### Invoice (`invoiceFromOrder`)

- Selects the order row with **`FOR UPDATE`** inside a transaction before status checks.  
- Already-invoiced → `"Order is already invoiced"`.  
- Per-line stock movements use `idempotencyKey: dist-invoice:${invoice.id}:${lineIndex}`.

`booked` is **not** directly invoiceable. Invoiceable statuses: `approved`, `submitted`, `stock_reserved`, `picking`, `packed`, `ready_for_dispatch`. Operators approve (or advance) first.

---

## 6. Held drafts

| Kind | Mechanism | Notes |
| --- | --- | --- |
| Server hold | `createDistOrder` with `submit: false` → `status: draft` | Listed via `GET /sales/held`; cancelled via `DELETE /sales/held/:id` |
| Local emergency | `localStorage` key `dist-sales-hold-v1` | Written on Hold; cleared on successful Book; restorable from Held panel |

Hold always writes the local backup first; if the server draft create fails, the operator still has the local cart.

`listHeldDistOrders` returns **order headers only** (no lines joined). Resume in the UI therefore may not reconstruct line detail unless the client has another fetch path — see §11.

---

## 7. Credit override audit

When `SalesCreditService.evaluate` allows an over-limit sale only because `creditOverride` + non-empty `overrideReason`:

- Order stores `creditOverride = true`
- `creditOverrideReason`, `creditOverrideByUserId`, `creditOverrideAt` populated on insert

Silent override is refused (`BadRequestException` if override true without reason).

---

## 8. Pricing and schemes (pointers)

Exact hierarchy and override rules: `SALE_PRICING_RULES.md`.  
Buy X Get Y conflict policy and physical stock = paid + free: `SALE_SCHEME_RULES.md`.

`PharmacyErpService` delegates price/scheme resolution to the same `SalesPricingService` used by quote/validate — one engine for Sale Window and book.

---

## 9. Schema / contracts

| Contract | Location |
| --- | --- |
| `createPharmacyDistOrderSchema` | `packages/contracts/src/pharmacy.ts` — includes `creditOverrideReason`, `idempotencyKey`, `skipStockCheck`, `priceOverrideReason` |
| `pharmacySalesQuoteSchema` / `pharmacySalesValidateSchema` | same file |
| Dist order columns | `packages/database-pg/src/schema/pharmacy-erp.ts` + ensure-schema Phase 5 ALTERs |

---

## 10. Source file index

| Area | Paths |
| --- | --- |
| Sales module | `backend-system/api/src/pharmacy/sales/*.ts` |
| ERP book/invoice | `backend-system/api/src/pharmacy/pharmacy-erp.service.ts` (`createDistOrder`, `invoiceFromOrder`, held helpers) |
| Contracts | `backend-system/packages/contracts/src/pharmacy.ts` |
| Schema DDL | `backend-system/api/scripts/ensure-schema.mjs` (Phase 5 block) |
| Sale Window UI | `Universal-application-system-/apps/launcher/src/distribution/pages/DistributionOrdersPage.tsx` |
| Hooks / client | `.../distribution/sales/*`, `.../pharmacy/api/pharmacy-sales.ts` |
| Pre-impl audit | `docs/SALE_WINDOW_AUDIT.md` |

---

## 11. Delivered code vs pre-implementation audit

| Audit expectation | Delivered |
| --- | --- |
| Server product / customer search | Implemented (`SalesSearchService`) |
| Cart quote + validate | Implemented |
| Wire Phase 4 availability | Validate/book use paid+free; UI enrich calls availability |
| Scheme priority | Implemented: priority ASC, then max free (`resolveSchemeDetail`) |
| Credit override reason + audit columns | Implemented on create |
| Book idempotency | Implemented + unique index |
| Invoice `FOR UPDATE` | Implemented |
| Server multi-hold | Draft list/cancel endpoints exist; hold UI dual-writes local + server |
| Do not create second sales system | Observed — retail POS untouched |
| Held list with line payload for resume | **Gap:** held list is headers only |
| `priceOverrideReason` enforced | **Gap:** schema field exists; create path accepts `unitPricePkr` without requiring/storing the reason |
| Concurrent book under same key | Unique index protects; failed insert on race may surface as error rather than return-existing (*unverified* under load) |

---

*End of architecture. Behavioural claims are from source review, not from a live run.*
