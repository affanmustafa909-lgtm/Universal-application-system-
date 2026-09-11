# SALE WINDOW AUDIT — Phase 5 Pre-Implementation

**Date:** 2026-09-11  
**Scope:** Pharmaceutical distribution Sale Window — booking, pricing, schemes, credit, FEFO, hold, print  
**Rule applied:** audit before changing anything. No Sale Window code was modified before this document.  
**Related:** Phase 4 inventory (`INVENTORY_*`), Phase 3 masters, existing Dist UI.

---

## 1. Existing Sale Window architecture

The live distribution Sale Window is **one screen**, not a separate sales subsystem.

| Piece | Location | Role |
| --- | --- | --- |
| Primary UI | `apps/launcher/src/distribution/pages/DistributionOrdersPage.tsx` | Nav label **Sale Window** → `/pops/distribution/orders` |
| Nav | `distribution/spec/nav.ts` | `distribution/orders` → “Sale Window” |
| Booking API | `POST /v1/pharmacy/distribution/orders` | Creates dist order (`draft` or `booked`) |
| Invoice API | `POST /v1/pharmacy/distribution/orders/:id/invoice` | Creates `WINV-*`, deducts FEFO stock, raises outstanding |
| Price resolve | `GET /v1/pharmacy/pricing/resolve` | Single-SKU price for a trade customer |
| Stock (Phase 4) | `GET|POST /v1/pharmacy/inventory/availability` | Read-only FEFO plan — **not called by Sale Window today** |
| Print | `distribution/lib/printDistOrder.ts` → `printDistBookingSlip` | Booking slip; reprint paths often print totals only |

**Separate and out of scope for Dist Sale Window evolution (must not be merged blindly):**

| Screen | Path | Why separate |
| --- | --- | --- |
| Pharmacy retail POS | `pharmacy/pages/PharmacyPosPage.tsx` → `/pops/pharmacy/pos` | Patient + strip/box units + `POST /v1/pharmacy/sales`; `@RequireSystemType("pharmacy")` only |
| Legacy form | `PharmacyErpPages.tsx` → `PharmacyDistOrdersPage` | Orphaned; pharmacy route redirects to Sale Window |
| Invoices register | `DistributionInvoicesPage.tsx` | Post-booking register |
| Wholesale returns | `PharmacyWholesaleReturnsPage` | Thin single-line form |
| Pricing masters | `DistributionPricingPage.tsx` | Price lists + schemes master data |

**Architectural rule for Phase 5:** evolve `DistributionOrdersPage` + the distribution order/invoice/pricing services in place. **Do not create a second sales system. Do not replace `POST /sales` retail POS. Do not invent a parallel invoice table.**

---

## 2. Existing frontend components

### 2.1 Sale Window shell (`DistributionOrdersPage.tsx`)

Conceptual layout today:

```
[ Customer bar / Book / Hold / Orders ]
[ Product tiles (client-filtered) ]  |  [ Cart aside ]
[ Qty modal ]  [ Customer modal ]  [ Orders modal ]
```

| Concern | Current behaviour |
| --- | --- |
| Customer | Modal; load-all trade customers; client filter |
| Product search | Load-all medicines after customer selected; 350ms debounce; client filter; **cap 48 tiles** |
| Barcode | `useBarcodeScanner` + `lookupPharmacyBarcode`; fallback local match; requires customer first |
| Cart | `{ medicineId, name, sku?, qty, unitPricePkr }` — **no batch, free qty, discount, tax, scheme** |
| Qty | Modal with ±; Enter adds |
| Price | Tile shows wholesale/selling; on add calls `resolvePharmacyPrice` with **hardcoded `qty: "10"`** |
| Scheme | **Invisible in UI**; free qty applied only on server at create |
| Credit | Due / Limit shown; checkbox override to book if over limit |
| Hold | **One** `localStorage` key `dist-sales-hold-v1` (customerId + cart) — not server draft |
| Book | `createPharmacyDistOrder` with `submit: true` |
| Book & print | Same + `printDistBookingSlip` with cart lines |
| Pipeline | Orders modal (F8): approve / reserve / invoice / print |
| Shortcuts | F2 customer, F3 product search, F4 book, F8 orders, Esc closes modals |

### 2.2 What already works

- Cart always visible (aside) — matches Phase 5 “no cart modal” intent.
- Book / Book & print / Hold exist as real actions (not fake buttons).
- Credit override is explicit (checkbox), not silent.
- Server creates real `DO-*` orders; invoice creates real `WINV-*` and moves stock.
- Barcode wedge scanner is wired.
- Keyboard shortcuts exist (incomplete vs Phase 5 target set).

### 2.3 What is slow or duplicated

| Issue | Evidence |
| --- | --- |
| Load-all medicines | `fetchPharmacyMedicines` → `GET /medicines` full branch catalog |
| Load-all customers | `fetchPharmacyTradeCustomers` full list into modal |
| Client-side filter | React filter over entire catalog; UI shows only 48 |
| Price preview qty wrong | Resolve always uses qty 10 |
| Stock not pre-validated | Cart uses `currentStock` on tiles if at all; never calls Phase 4 availability |
| Hold not multi / not shared | Single localStorage slot; other devices/users cannot resume |
| Print reprint thin | Orders/invoices reprint often one synthetic total line |
| Retail POS parallel | Separate load-all + cart — do not conflate |

---

## 3. Existing API endpoints (sales-relevant)

### Distribution booking (authoritative for Sale Window)

| Method | Path | Role |
| --- | --- | --- |
| GET | `/v1/pharmacy/distribution/orders` | List orders |
| POST | `/v1/pharmacy/distribution/orders` | Create draft/booked order |
| POST | `/v1/pharmacy/distribution/orders/:id/approve` | Credit re-check + approve |
| POST | `/v1/pharmacy/distribution/orders/:id/invoice` | Post invoice + FEFO deduct + outstanding |
| POST | `/v1/pharmacy/distribution/orders/:id/advance` | Pipeline + real reservations (Phase 4) |
| GET | `/v1/pharmacy/distribution/invoices` | Invoice register |

### Pricing / schemes

| Method | Path | Role |
| --- | --- | --- |
| GET | `/v1/pharmacy/pricing/resolve` | Single medicine + customer → price + source |
| GET/POST | `/v1/pharmacy/pricing/lists` (+ items) | Price list masters |
| GET/POST | `/v1/pharmacy/pricing/schemes` | Scheme masters |

### Product / barcode

| Method | Path | Role / risk |
| --- | --- | --- |
| GET | `/v1/pharmacy/medicines` | **Load-all** — Sale Window uses this |
| GET | `/v1/pharmacy/medicines/match?q=` | Scores in memory after load-all — **unused by Sale Window** |
| GET | `/v1/pharmacy/medicines/barcode/:code` | Exact barcode; then may reload list |
| GET | `/v1/pharmacy/medicines` (paged masters) | Exists on masters controller — **unused by Sale Window** |

### Inventory (Phase 4 — Sale Window must use)

| Method | Path | Role |
| --- | --- | --- |
| GET/POST | `/v1/pharmacy/inventory/availability` | FEFO allocations; fulfillable; shortfall — **not used by Sale Window yet** |

### Retail POS (do not break; do not use for Dist Sale Window)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/v1/pharmacy/sales` | Pharmacy-only; selling price; no schemes/lists |
| GET | `/v1/pharmacy/sales` | Last ~200 sales |
| POST | `/v1/pharmacy/sales/returns` | Retail returns |

### Missing for Phase 5 (not present)

| Capability | Status |
| --- | --- |
| `POST /v1/pharmacy/sales/validate` (or dist equivalent) | Missing |
| Cart-level pricing quote (`productIds[]`) | Missing — only single-SKU resolve |
| Scheme preview on cart | Missing |
| Server-backed multi hold / draft list API for Sale Window | Dist `draft` status exists but UI uses localStorage |
| Document-level idempotency on order create / invoice | Weak / missing |
| Dedicated `sales.*` permission catalogue | Missing (uses `distribution.orders` + inventory) |

---

## 4. Database flow

```
Trade customer
    ↓ POST /distribution/orders
pharmacy_dist_orders (DO-*) + pharmacy_dist_order_lines
    (price resolved, free qty from scheme, credit check)
    ↓ approve (optional)
    ↓ advance → stock_reserved (Phase 4 reservations)
    ↓ POST .../invoice
pharmacy_dist_invoices (WINV-*) + lines
    → release reservations → deductFefo(qty + freeQty)
    → pharmacy_stock_movements (SALE)
    → trade_customer.outstandingPkr += total
```

| Table | Sale Window relevance |
| --- | --- |
| `pharmacy_dist_orders` / `_lines` | Draft/booked cart persistence candidate |
| `pharmacy_dist_invoices` / `_lines` | Posted wholesale invoice |
| `pharmacy_price_lists` / `_items` | Price hierarchy |
| `pharmacy_schemes` | Buy X Get Y (`priority` column exists, **unused in calc**) |
| `pharmacy_trade_customers` | `creditLimitPkr`, `creditDays`, `outstandingPkr`, `priceLevel` |
| `pharmacy_stock_reservations` | Used on `stock_reserved`, not at Book |
| `pharmacy_sales` | **Retail only** — not Dist Sale Window |

**Numbering:** `nextRef("DO"|"WINV")` = prefix + `Date.now()` slice — collision risk under concurrency; inventory docs already have safer numbering (Phase 4).

**Constraints:** no unique index on dist order/invoice numbers by org (unlike inventory transfer numbers).

---

## 5. Product lookup performance

| Path | Behaviour | Verdict |
| --- | --- | --- |
| Sale Window medicines | Full catalog download | **Primary bottleneck** |
| `medicines/match` | Full catalog then score top 12 | Still load-all |
| Masters paged medicines | Server `q` + pagination | Exists — Sale Window should switch to this or a sales-specific lean endpoint |
| Barcode | Exact match then list reload | Acceptable if stop reloading full list |
| Phase 3 medicine indexes | org+branch+sku, status, company | Helpful; barcode/name ILIKE may still need review |

**Phase 5 requirement:** server-side debounced search, minimal payload, AbortController, no “download 50k → filter in React”.

---

## 6. Cart architecture

| Aspect | Today | Gap vs Phase 5 |
| --- | --- | --- |
| Visibility | Always-on aside | OK |
| Line fields | id, name, qty, unit price | Missing batch, expiry, free, discount, scheme, tax, net |
| Local edit | Yes | OK — keep local; server validates on book |
| Persistence | localStorage hold (1) | Need multi hold + clear draft vs posted distinction |
| Stock check | None on qty change | Must call availability API |
| Multi-batch | Not represented | FEFO can split at invoice; UI must show allocations |

---

## 7. Batch logic

| Layer | Behaviour |
| --- | --- |
| Sale Window UI | **No batch picker** |
| Order create | No batch id stored on lines |
| Invoice | `deductFefo` with Phase 4 engine (expiry ASC, skip expired/hold, FOR UPDATE) |
| Retail POS | Explicit batch pick — different product |

**Phase 5:** Sale Window must call availability → show FEFO allocations → optional manual override with permission + audit. Do **not** reimplement FEFO in React.

---

## 8. Pricing logic

`resolvePrice` (`pharmacy-erp.service.ts`) documented hierarchy:

1. Customer-specific price list (`tradeCustomerId`)
2. Area price list (`customer.areaId`)
3. Customer-type price list
4. Price-level list (`priceLevel` / customer.priceLevel / `"retail"`)
5. Medicine `wholesalePricePkr` / `dealerPricePkr` by level
6. Fallback `sellingPricePkr`

| Gap | Detail |
| --- | --- |
| N+1 | Lists then items queried per list/medicine |
| Cart quote | No multi-product endpoint |
| Sale Window | Resolve on add with wrong qty; tile price can disagree |
| Overrides | Client can send `unitPricePkr` — server accepts; **no permission/reason/audit** for override |
| `minSalePricePkr` | Stored; not enforced on dist create |
| Retail POS | Ignores lists/schemes entirely (by design for now) |

**Phase 5 rule:** one server pricing engine; frontend displays source; never diverge per component.

---

## 9. Scheme logic

`resolveSchemeFreeQty`:

- Loads all active org schemes; date window; medicine or company match
- `buy_x_get_y`: `floor(qty / buyQty) * freeQty`
- Takes **max** free across matches — **`priority` column ignored**
- Applied at order create only; free qty deducted with paid qty at invoice

| Gap | Detail |
| --- | --- |
| UI | Operator cannot see Free / scheme name |
| Conflict policy | Max free ≠ documented priority hierarchy |
| Types | Only buy_x_get_y effectively; slabs/value schemes not coded |
| Preview | No “what free qty if qty=20” API for cart |

**Phase 5:** document and implement a single priority; show Free + scheme label on lines; validate server-side on book.

---

## 10. Credit logic

| Check | When | Behaviour |
| --- | --- | --- |
| Create order | If `!creditOverride` and limit > 0 | Block if outstanding + total > limit |
| Approve | Same | Re-check |
| Invoice | — | Adds to outstanding; **no re-check** |
| UI | Checkbox override | No reason / permission / audit fields |
| `creditDays` | Stored | **Not used** to block overdue |
| Ledger | `overdueBlocked` ≈ outstanding ≥ limit | Not aging-based |

Configurable ALLOW / WARN / BLOCK policies: **not implemented** — only hard block + boolean override.

---

## 11. Invoice posting

`invoiceFromOrder`:

1. Guard status ∈ invoiceable set  
2. Create WINV header + lines  
3. Release reservations  
4. `deductFefo` per line for `quantity + freeQuantity` with per-line idempotency keys  
5. Increase trade customer outstanding  
6. Order → `invoiced`

| Risk | Detail |
| --- | --- |
| Concurrent double invoice | No `FOR UPDATE` on order row before status flip |
| Document idempotency | Per-line keys only |
| Payment | Forced Credit; amountDue = total |
| Stock shortfall | FEFO throws; transaction should roll back if wrapped — verify atomicity in Phase 5 |

---

## 12. Print logic

| Action | Quality |
| --- | --- |
| Book & print (from cart) | Full cart lines via `printDistBookingSlip` |
| Orders modal Print | Often **one synthetic total line** |
| Invoice register Print | Same thin slip |
| Pharmacy POS print | Full lines + batch — separate stack |

Reuse existing print ticket / printer routing; do not invent a second print architecture. Fix line-item reprint as part of Phase 5 polish.

---

## 13. Hold logic

| Kind | Exists? | Notes |
| --- | --- | --- |
| Browser localStorage hold | Yes | Single key; device-local |
| Dist order `status: draft` | Yes (API) | Sale Window does not list/resume drafts as Held Sales panel |
| Retail park/hold | No | |

**Phase 5:** Held Sales panel should prefer **server drafts** (multi, permissioned delete) while optionally keeping local emergency persistence for network loss.

---

## 14. Performance bottlenecks (ranked)

1. Full medicine catalog download on Sale Window open (after customer).  
2. Full trade customer list for modal.  
3. `resolvePrice` / `resolveSchemeFreeQty` per line on book (N schemes + N lists).  
4. `medicines/match` and barcode paths that still load-all.  
5. Invoice register / sales list N+1 (secondary to Sale Window typing).  
6. Cart does not debounce availability checks (would become a problem once wired).

Targets (Phase 5 brief): product/barcode/stock &lt;300ms; validate &lt;500ms; post &lt;1s where practical — **not yet measured for this screen**.

---

## 15. Existing bugs / correctness gaps

1. **Stock not validated before book** — shortage discovered at invoice/FEFO, not at qty entry.  
2. **Price resolve uses qty 10** — wrong scheme/price preview.  
3. **Scheme free qty invisible** — operator books blind.  
4. **Scheme `priority` unused** — conflict rule is “max free”.  
5. **Credit override unaudited** — no reason, permission id, or audit row.  
6. **`creditDays` unused** — overdue policy not enforced.  
7. **Hold is single localStorage** — not operational multi-hold.  
8. **No client or server idempotency on Book click** — double-click can create two DOs.  
9. **Invoice concurrent race** — possible double WINV before status flip.  
10. **Weak numbering** — timestamp slices.  
11. **Reprint missing lines** — operators get totals-only slips.  
12. **Warehouse not selectable** — deduction uses default warehouse; Phase 4 availability is warehouse-scoped.  
13. **Salesman not first-class on Sale Window UI** — may exist on order fields; verify and surface.  
14. **Retail `POST /sales` permission = `pops.read`** — separate hardening (do not block Dist work).

---

## 16. Recommended final architecture

**One Sale Window. One booking pipeline. Inventory stays authoritative.**

```
Sale Window (evolved DistributionOrdersPage)
  ├─ server product search (lean payload, AbortController)
  ├─ server customer search
  ├─ barcode → add / disambiguate
  ├─ local cart (rich lines) + optional local draft backup
  ├─ POST availability (Phase 4) on qty / warehouse change
  ├─ GET/POST sales pricing quote (batch) — wraps resolvePrice + schemes
  ├─ POST sales/validate — structured errors
  ├─ POST distribution/orders (idempotent) — Book
  ├─ server drafts → Held Sales panel
  └─ invoice / Book&Print via existing invoice + print stack
```

### Services to add or centralise (backend)

| Service | Owns |
| --- | --- |
| Keep `PharmacyErpService` order/invoice | Do not fork posting |
| `SalesPricingService` (or extract from erp) | Cart quote + price source + override rules |
| `SalesSchemeService` | Deterministic free qty + priority |
| `SalesCreditService` | ALLOW/WARN/BLOCK + override audit |
| `SalesValidationService` | Aggregate validate endpoint |
| Phase 4 `StockAvailabilityService` / `FefoService` | Only stock/FEFO authority |

### Frontend

- Evolve `DistributionOrdersPage` into a dense Dist-design-system Sale Window (header / search / cart / totals).  
- Extract hooks: `useSaleCart`, `useSaleSearch`, `useSaleShortcuts` — avoid a second page.  
- Do **not** port restaurant POS chrome; keep Dist cyan system.

### Explicit non-goals this phase

- Rewriting retail Pharmacy POS.  
- New microservices.  
- Offline-first posting (preserve cart + warn only unless existing sync guarantees apply).  
- Silently changing costing / register math.

---

## 17. What Phase 5 will reuse vs change

| Asset | Decision |
| --- | --- |
| `DistributionOrdersPage` | **Reuse & evolve** (primary Sale Window) |
| `POST /distribution/orders` + invoice | **Reuse** — harden idempotency, validate, warehouse, audit |
| `resolvePrice` / schemes | **Reuse** — extract, document priority, cart quote API |
| Phase 4 availability | **Wire** — mandatory for qty/batch UI |
| `printDistBookingSlip` | **Reuse** — fix line-item reprint |
| localStorage hold | **Supplement** with server drafts; do not rely on it alone |
| `PharmacyPosPage` | **Leave intact** |
| Load-all `GET /medicines` for Sale Window | **Replace** with server search |

---

## 18. Phase 5 definition of done (from brief — tracking)

Will be checked off only when implemented **and tested**. Until deploy + suite run: status remains code-complete / unverified.

---

*End of pre-implementation audit. Implementation must not create a duplicate sales system.*
