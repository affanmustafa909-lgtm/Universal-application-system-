# Sale Window Workflow — Phase 5

**Date:** 2026-09-11  
**Primary UI:** `apps/launcher/src/distribution/pages/DistributionOrdersPage.tsx`  
**Shortcuts:** `apps/launcher/src/distribution/sales/useSaleShortcuts.ts`  
**Status:** Derived from current code. Not operator-UAT’d against a deployed build — see `SALE_TESTING.md`.

---

## 1. Operator flow (happy path)

1. **Open Sale Window** (`/pops/distribution/orders`). If no customer is selected, the customer panel opens automatically.
2. **Select customer (F2)** — type in the customer search (250ms debounce → `GET /sales/customers/search`). Pick a trade customer. Credit Due / Limit appear in the header.
3. **Focus product search (F4)** — type name / SKU / barcode fragment (250ms debounce → `GET /sales/products/search`). Or scan a barcode wedge → `GET /sales/products/barcode`.
4. **Add to cart** — selecting a hit adds a line; the page then enriches the line with `checkSaleAvailability` + `quoteSalePricing` (price source, free qty, FEFO allocations preview).
5. **Adjust qty** — qty changes are debounced and re-enrich stock + quote. Free qty and scheme label come from the quote.
6. **Credit** — if projected outstanding (outstanding + cart net) exceeds limit, Book is blocked until **Credit override** is checked **and** a non-empty reason is entered.
7. **Validate + Book (F9)** — client calls `validateSale` then `bookSale` with one `idempotencyKey` (`crypto.randomUUID()`). On success the cart clears and local hold is removed.
8. **Book & print (F10)** — same book path, then `printDistBookingSlip` with cart lines. Print failure leaves the order booked and shows an error.
9. **Invoice** — not on the Book button. Use the Orders modal (F7): approve / advance pipeline, then invoice. Stock deducts only at invoice.

---

## 2. Keyboard map (`useSaleShortcuts`)

| Key | Handler | Behaviour |
| --- | --- | --- |
| **F2** | `onCustomerFocus` | Open customer panel; focus customer search |
| **F4** | `onProductFocus` | Close customer panel; focus + select product search |
| **F7** | `onOrders` | Open Orders modal (pipeline / approve / invoice) |
| **F8** | `onHold` | Hold current cart (server draft + local backup) |
| **F9** | `onBook` | Validate + book (no print) |
| **F10** | `onBookAndPrint` | Validate + book + print slip |
| **Ctrl+N** / **Cmd+N** | `onNewSale` | Clear cart + customer; open customer panel (prevents browser/Tauri new-window default) |
| **Escape** | `onEscape` | Close orders modal and held panel; if customer selected, also close customer panel |
| **Delete** | `onDeleteLine` | Remove selected cart line — **skipped when focus is in INPUT / TEXTAREA / SELECT / contenteditable** |

All listed function keys call `preventDefault()`. Delete only prevents default when not typing.

On-screen hint string matches this map:

> F2 customer · F4 search · F8 hold · F9 book · F10 print · Ctrl+N new · F7 orders

*(Pre-Phase-5 audit listed F3/F4 differently; the live map above is authoritative.)*

---

## 3. Focus rules

| Rule | Implementation |
| --- | --- |
| No customer → customer panel open | `useEffect`: `if (!customer) setCustomerPanel(true)` |
| After customer select | Product search focused/selected (~40ms timeout) |
| After add / barcode / resume hold | Product search re-focused so the operator can keep typing |
| New sale (Ctrl+N) | Customer search focused |
| Delete while typing in search/qty | Ignored (does not remove cart lines) |
| Product search disabled until customer | Placeholder: “Select customer first (F2)” |

Default warehouse: first `isDefault` warehouse for the branch, else first listed warehouse.

---

## 4. Hold / resume

### Hold (F8)

1. Requires branch, customer, and at least one cart line.  
2. Writes `localStorage["dist-sales-hold-v1"]` = `{ customer, warehouseId, salesmanEmployeeId, cart, at }`.  
3. Calls `bookSale` with `submit: false` and a fresh idempotency key → server `draft` order.  
4. Clears cart on success; notice shows held order number.  
5. On server failure: notice **“Server hold failed — local backup saved”**; local payload remains.

### Resume

| Path | Action |
| --- | --- |
| **Held panel → server draft** | `resumeHeld(order)` sets customer + warehouse; maps `order.lines` into cart if present |
| **Restore local hold** | Reads `dist-sales-hold-v1` and replaces cart |

Server held list is `GET /v1/pharmacy/sales/held?branchCode=…`. Cancel uses `DELETE /sales/held/:orderId` (draft → `cancelled` only).

**Operational note:** `listHeldDistOrders` returns headers without lines. Resume from the held list may therefore restore customer without line detail unless the API payload is later enriched — local restore is the reliable full-cart path today.

---

## 5. Book & print

### Book path (`bookOrder`)

1. Guard: customer, non-empty cart, not already booking, credit not blocked.  
2. Build body with `submit: true`, override fields, lines (`quantity`, optional `freeQuantity`, `unitPricePkr`, `discountPkr`).  
3. `validateSale(body)` — any error-severity issue aborts; cart kept.  
4. `bookSale(body)` — prefers `POST /sales/book` (server validates again then `createDistOrder`); on route 404 falls back to `POST /distribution/orders`.  
5. Success: notice, clear cart, clear override, remove local hold, invalidate order queries.  
6. Failure: error message; **cart retained**.

### Book & print

Same as Book, then `printDistBookingSlip` with branch, order number, customer name, cart lines, and total. Print errors do not un-book.

### What Book does **not** do

- Does not deduct stock.  
- Does not create `WINV-*`.  
- Does not move status past `booked` (hold creates `draft`).

---

## 6. Orders modal (post-book pipeline)

Opened with **F7**. Supports filtering, credit-override-only filter, approve / advance / invoice / print against existing distribution order APIs. Invoice requires an invoiceable status (see `SALE_WINDOW_ARCHITECTURE.md` §5).

---

## 7. Cart line enrichment (background)

After add or qty change, `enrichLine`:

- `POST` Phase 4 availability for the **paid qty only** (see contradiction note in `SALE_SCHEME_RULES.md` / testing report).  
- `POST /sales/pricing/quote` for unit price, `priceSource`, free qty, scheme label.  

Cart aside always remains visible (no cart modal).

---

*Workflow text matches the launcher sources cited above; do not treat as a measured UX study.*
