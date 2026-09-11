# Sale Window Performance — Phase 5

**Date:** 2026-09-11  
**Status:** Code-complete, deploy-pending. **No performance measurement has been taken.**

---

## 1. Nothing here has been measured

**Every number in the “measured” column reads “not yet measured — deploy required”. That is literal.**

The same deploy blockers as Phase 4 apply (`SALE_TESTING.md` §1 / `INVENTORY_TESTING.md` §1): no local API/Postgres in this environment, Railway CLI not authenticated, production still on an older build without Phase 5 routes. Pointing a timing probe at current production would only measure 404s.

No latency figure in this document was observed on a live system.

---

## 2. Targets (Phase 5 brief)

From `SALE_WINDOW_AUDIT.md` §14 / ERP brief — design budgets, not results:

| Operation | Probe (suite label) | Target | Measured |
| --- | --- | --- | --- |
| Product search | `product-search` | &lt; 300 ms | not yet measured — deploy required |
| Barcode lookup | `barcode-lookup` | &lt; 300 ms | not yet measured — deploy required |
| Stock / availability (cart line) | `availability` | &lt; 300 ms | not yet measured — deploy required |
| Validate cart | `validate` | &lt; 500 ms | not yet measured — deploy required |
| Book (post) | `book` | &lt; 1 s where practical | not yet measured — deploy required |
| Pricing quote | `pricing-quote` | &lt; 500 ms *(practical companion budget)* | not yet measured — deploy required |
| Customer search | `customer-search` | &lt; 300 ms *(search class)* | not yet measured — deploy required |

The Phase 5 suite (`backend-system/scripts/phase5-sale-window-tests.mjs`) **records** soft timings into `docs/PHASE_5_TEST_RESULTS.json`. It does **not** fail the run solely because a median exceeds a budget (unlike Phase 4’s hard performance assertions). Targets remain documentation + future CI policy.

---

## 3. What was optimized (code changes vs audit baseline)

| Before (audit) | After (Phase 5 code) |
| --- | --- |
| Sale Window downloaded full medicine catalog (`GET /medicines`) then filtered in React (cap 48 tiles) | `GET /v1/pharmacy/sales/products/search` — server ILIKE, page ≤ 50, lean columns only |
| Full trade-customer list into modal | `GET /v1/pharmacy/sales/customers/search` — server search, page ≤ 50 |
| Barcode path that could reload full list | `GET /v1/pharmacy/sales/products/barcode` — exact match, lean rows + availability attach |
| Price resolve on add with hardcoded qty 10 | Cart quote / enrich uses actual line qty |
| No cart-level quote / validate | `POST /sales/pricing/quote`, `POST /sales/validate` |
| Client FE debounce 350ms on load-all | 250ms debounce on server search (`useSaleProductSearch` / `useSaleCustomerSearch`) |

### Lean product payload fields

`SalesSearchService` selects only: `id`, `sku`, `name`, `genericName`, `brandName`, `companyName`, `barcode`, `unit`, `presentation`, `strength`, `wholesalePricePkr`, `sellingPricePkr`, plus attached `availableQty` / `nearExpiry`. It does **not** return full medicine row blobs (descriptions, all cost fields, etc.).

### Still not a load test

Meeting budgets on suite-created `P5TEST-*` rows only proves query plans are not pathological on tiny catalogs. Production volume is out of scope for this document until measured after deploy.

---

## 4. How to measure after deploy

```powershell
cd "d:\My POS SYSTEMS REPOS\backend-system"
$env:API_BASE = "https://<deployed-api>"
$env:DIST_EMAIL = "admin.distribution@pops.demo"
$env:DIST_PASSWORD = "<password>"
$env:BRANCH_CODE = "DIST-HQ"
node scripts/phase5-sale-window-tests.mjs
```

Read `Universal-application-system-/docs/PHASE_5_TEST_RESULTS.json` → `timings` / soft performance section. Compare medians to the table in §2. Do not paste invented numbers into this file; update the Measured column only from that artefact.

---

## 5. Residual risks (unmeasured)

- N schemes × N lines on quote/validate still loads all active org schemes per line (`resolveSchemeDetail`).  
- Price-list resolution may query multiple lists/items per line (same pattern as pre-extract `resolvePrice`).  
- UI enrich fires availability with paid qty only; validate/book re-check paid+free — extra round trips, not FEFO cost.  
- Frontend sends `limit` on product search; backend reads `pageSize` — default page size 24 applies unless `pageSize` is passed (*client/server param mismatch*).

---

*Targets are intent. Measured column stays “not yet measured — deploy required” until a real run.*
