# Sale Pricing Rules — Phase 5

**Date:** 2026-09-11  
**Authority:** `SalesPricingService.resolvePrice` / `quoteCart`  
**File:** `backend-system/api/src/pharmacy/sales/sales-pricing.service.ts`  
**Status:** Derived from source. Not runtime-verified — see `SALE_TESTING.md`.

`PharmacyErpService.createDistOrder` uses the same service for line prices when the client omits `unitPricePkr`. There is one pricing engine for Dist Sale Window quote, validate, and book.

---

## 1. Inputs

| Input | Role |
| --- | --- |
| `organizationId` | Tenant scope |
| `medicineId` | Product |
| `tradeCustomerId` (optional) | Loads customer for list matching + default `priceLevel` |
| `priceLevel` (optional) | Defaults to `customer.priceLevel`, else `"retail"` |
| `qty` | Defaults to 1; used for price-list `minQty` band selection |

Qty is `Math.max(1, Math.round(opts.qty ?? 1))`.

---

## 2. Exact resolve hierarchy

Walk stops at the **first** hit.

### A. Price lists (when a trade customer is loaded)

For each step, `tryList` loads **active** `pharmacy_price_lists` matching the extra predicate, then for each list (iteration order = query order) looks up an item where:

- `priceListId` + `medicineId` match  
- `minQty <= qty`  
- highest `minQty` wins (`orderBy desc(minQty) limit 1`)

| Order | Predicate | `source` label returned |
| --- | --- | --- |
| 1 | `tradeCustomerId = customer.id` | `customer_price_list` |
| 2 | `areaId = customer.areaId` (only if `areaId` set) | `area_price_list` |
| 3 | `customerType = customer.customerType` (only if set) | `customer_type_price_list` |

### B. Price-level list (always attempted after customer-specific lists, or when no customer)

| Order | Predicate | `source` |
| --- | --- | --- |
| 4 | `priceLevel = resolved priceLevel` | `price_level_list` |

### C. Medicine master fallbacks

| Order | Condition | `source` | Price field |
| --- | --- | --- |
| 5 | `priceLevel === "wholesale"` and `wholesalePricePkr > 0` | `medicine_wholesale` | `wholesalePricePkr` |
| 6 | `priceLevel === "dealer"` and `dealerPricePkr > 0` | `medicine_dealer` | `dealerPricePkr` |
| 7 | `wholesalePricePkr > 0` and (`priceLevel === "wholesale"` **or** `customerType === "Wholesaler"`) | `medicine_wholesale` | `wholesalePricePkr` |
| 8 | `dealerPricePkr > 0` and (`priceLevel === "dealer"` **or** `customerType === "Dealer"`) | `medicine_dealer` | `dealerPricePkr` |
| 9 | else | `retail_selling_price` | `sellingPricePkr` |

Steps 5–6 and 7–8 can overlap for wholesale/dealer levels; the earlier return wins.

`priceListId` is the matching list id for list sources, otherwise `null`.

---

## 3. Cart quote (`quoteCart`)

For each line:

1. If `line.unitPricePkr != null` → use rounded override; **`priceSource` / `source` = `"override"`**; `priceListId = null`.  
2. Else → `resolvePrice(..., { tradeCustomerId, priceLevel: customer.priceLevel, qty })`.  
3. Scheme detail from `resolveSchemeDetail` (see `SALE_SCHEME_RULES.md`).  
4. `freeQuantity = round(line.freeQuantity ?? scheme.freeQuantity)`.  
5. `discountPkr = round(line.discountPkr ?? 0)`.  
6. `lineTotalPkr = paidQty * unitPricePkr - discount` (**free units are not charged**).  
7. Document discount/tax: `netPkr = subtotal - discountPkr + taxPkr`.

Returned line fields include `paidQty`, `unitPricePkr`, `priceSource`, `priceListId`, `freeQuantity`, `schemeLabel`, `discountPkr`, `lineTotalPkr`.

---

## 4. Override rules

| Rule | Behaviour in code |
| --- | --- |
| Client sends `unitPricePkr` on quote/book line | Treated as final price; source `"override"` on quote |
| `priceOverrideReason` on `createPharmacyDistOrderSchema` | Optional string in contract; **not read or stored** by `createDistOrder` / `quoteCart` |
| Permission gate on override | **None** in pricing service — any caller who can book may send a price |
| `minSalePricePkr` | Not enforced on Dist create/quote |

Credit override is separate (`SalesCreditService`) and **does** require a reason — do not confuse with price override.

---

## 5. Price source labels (canonical strings)

These are the exact `source` / `priceSource` strings emitted by the server:

| Label | Meaning |
| --- | --- |
| `customer_price_list` | Active list scoped to this trade customer |
| `area_price_list` | Active list scoped to customer area |
| `customer_type_price_list` | Active list scoped to customer type |
| `price_level_list` | Active list for resolved price level |
| `medicine_wholesale` | Medicine `wholesalePricePkr` |
| `medicine_dealer` | Medicine `dealerPricePkr` |
| `retail_selling_price` | Medicine `sellingPricePkr` |
| `override` | Client-supplied `unitPricePkr` on quote |

UI may also show a transient `"catalog"` source before enrichment completes (`DistributionOrdersPage` add path).

---

## 6. What pricing does not do

- Does not check stock or credit.  
- Does not apply schemes to the charged amount (schemes only add free qty).  
- Does not implement slab/value schemes beyond buy-X-get-Y free qty (scheme doc).  
- Does not call accounting.

---

*Single engine: never reimplement this hierarchy in React.*
