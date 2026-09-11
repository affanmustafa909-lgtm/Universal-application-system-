# Sale Scheme Rules — Phase 5

**Date:** 2026-09-11  
**Authority:** `SalesPricingService.resolveSchemeDetail` / `resolveSchemeFreeQty`  
**File:** `backend-system/api/src/pharmacy/sales/sales-pricing.service.ts`  
**Status:** Derived from source. Not runtime-verified — see `SALE_TESTING.md`.

---

## 1. Scheme type implemented

Only **buy X get Y** arithmetic is coded:

```
multiples = floor(paidQty / scheme.buyQty)
free = multiples * scheme.freeQty
```

Requires `buyQty > 0` and truthy `freeQty`. Other scheme shapes in masters are ignored by this resolver.

---

## 2. Eligibility filters

Active org schemes (`status = "active"`) are loaded, then each candidate must pass:

| Filter | Rule |
| --- | --- |
| Start date | Skip if `startDate > today` (`YYYY-MM-DD`) |
| End date | Skip if `endDate < today` |
| Medicine | If `scheme.medicineId` set, must equal the line medicine |
| Company | If `scheme.companyId` set, medicine must have matching `companyId` (schemes with company but medicine without company are skipped) |
| Buy / free | `buyQty` and `freeQty` required as above |
| Multiples | `floor(qty / buyQty) >= 1` |

Paid qty is `Math.max(0, Math.round(buyQty))`. Qty ≤ 0 → zero free, no scheme.

---

## 3. Conflict policy (deterministic)

When multiple schemes match:

1. Sort by **`priority` ASC** (lower number = higher priority). Missing priority treated as `0`.  
2. If priorities equal, take the scheme with the **maximum free quantity**.  
3. First element after sort wins.

This replaces the pre-Phase-5 “max free only, ignore priority” behaviour called out in `SALE_WINDOW_AUDIT.md`.

Returned detail: `{ freeQuantity, schemeId, schemeLabel, priority }` (`schemeLabel` = `pharmacy_schemes.name`).

---

## 4. Free qty vs paid qty

| Concept | Definition in code |
| --- | --- |
| **Paid qty** | Line `quantity` / cart `qty` — the units charged (`lineTotal = paidQty * unitPrice - discount`) |
| **Free qty** | Scheme (or client-supplied `freeQuantity`) — **not** included in line total |
| **Physical / stock need** | **`paidQty + freeQuantity`** |

Where stock need is applied:

| Path | Uses paid + free? |
| --- | --- |
| `SalesValidationService.validate` → availability | **Yes** — `quantity: l.paidQty + l.freeQuantity` |
| `createDistOrder` stock gate (`submit && !skipStockCheck`) | **Yes** — `l.quantity + l.freeQuantity` |
| `invoiceFromOrder` → `deductFefo` | **Yes** — `line.quantity + line.freeQuantity` |
| UI `enrichLine` availability call | **No** — passes paid `qty` only (*gap*) |

Free units are stored on `pharmacy_dist_order_lines.free_quantity` and copied to invoice lines; FEFO deducts the sum once.

---

## 5. Client override of free qty

On quote and book:

```
freeQuantity = round(line.freeQuantity ?? scheme.freeQuantity)
```

If the client sends `freeQuantity`, that value is used even if it differs from the scheme calculation. There is no separate permission check on free-qty override in the pricing service.

Quote `schemeSummary` still attributes the **resolved scheme id/label** when `scheme.schemeId` is set and free qty &gt; 0, including when free was client-supplied.

---

## 6. UI display

Sale Window cart shows free qty and scheme name after quote enrichment (`schemeName` / `schemeLabel`). Operators should treat server validate/book as authoritative if the enrich preview used paid-only stock.

---

*Schemes never change unit price; they only grant free units that still consume physical stock.*
