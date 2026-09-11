# Sale Window Testing — Phase 5

**Date:** 2026-09-11  
**Suite:** `backend-system/scripts/phase5-sale-window-tests.mjs`  
**Report artefact:** `docs/PHASE_5_TEST_RESULTS.json` — **does not exist yet**, because it is only written by a run.

---

## 1. Status: the suite has NOT been run

**The test suite described in this document has been written from the Phase 5 source. It has not been executed. There are no test results. Nothing in Phase 5 has been verified against a running system.**

Do not read any statement in the Sale Window docs as evidence that the behaviour was observed live. Claims are from reading the code.

### Why it has not run

Same blockers as Phase 4 (`INVENTORY_TESTING.md` §1):

| Route | Blocker |
| --- | --- |
| Local API | No API process running locally. |
| Local PostgreSQL | No local Postgres; Docker not installed. |
| Production (Railway) | CLI not authenticated from this environment; Phase 5 DDL/routes not on the live older build. |

Pointing the suite at current production would yield 404s on `/v1/pharmacy/sales/*` and would not validate the new code.

### What has to happen to get results

1. **Deploy the API** so `ensure-schema.mjs` applies Phase 5 dist-order columns (`idempotency_key`, credit override audit columns, unique index) and Nest serves `SalesController`.  
2. Prefer also deploying/running Phase 4 first — Sale Window validate/book depend on availability / FEFO.  
3. **Run:**

```powershell
cd "d:\My POS SYSTEMS REPOS\backend-system"
$env:API_BASE = "https://backend-system-production-28a3.up.railway.app"
$env:DIST_EMAIL = "admin.distribution@pops.demo"
$env:DIST_PASSWORD = "<password>"
$env:BRANCH_CODE = "DIST-HQ"
node scripts/phase5-sale-window-tests.mjs
```

4. Read `docs/PHASE_5_TEST_RESULTS.json` and reconcile failures against `SALE_*` docs before treating behaviour as settled.

Exit code is non-zero if any hard assertion fails. Soft timings never flip a pass to fail by themselves.

---

## 2. Environment and conventions

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_BASE` / `API_URL` | `http://127.0.0.1:3000` | API root |
| `DIST_EMAIL` | `admin.distribution@pops.demo` | Login |
| `DIST_PASSWORD` | `SEED_USER_PASSWORD` from `.env`, else `Owner@12345` | Login |
| `BRANCH_CODE` | `DIST-HQ` | Branch under test |

**Test data.** `RUN_ID` from last eight digits of epoch ms. SKUs / codes prefixed `P5TEST-<RUN_ID>`. Dedicated warehouse `P5-TEST` created if missing. Suite **never deletes** existing or test data (same honesty trade-off as Phase 4).

**Harness.** `check(name, condition, …)` records pass/fail immediately. Top-level catch records `Suite execution` failure so a mid-run crash still writes a report when possible.

---

## 3. Test inventory (every test in the script)

### 3.1 Security

| Test | Expectation |
| --- | --- |
| Unauthenticated `GET /v1/pharmacy/sales/products/search` | 401 or 403 |
| Invalid / tampered JWT on same route | 401 or 403 |

### 3.2 Product search — lean payload

| Test | Expectation |
| --- | --- |
| Authenticated search with `q` + `branchCode` | 200, `items` array |
| Lean shape | Items are objects without huge unused fields (script flags known heavy keys such as long description blobs if present); required lean keys present (`id`, `name`, `sku` or equivalent) |
| Soft timing | Duration recorded as `product-search` — not a hard fail |

### 3.3 Customer search

| Test | Expectation |
| --- | --- |
| `GET /sales/customers/search?q=…` | 200 with `items` (may be empty if no match; script uses disposable or known customer name fragment) |

### 3.4 Barcode lookup

| Test | Expectation |
| --- | --- |
| Create/use medicine with known barcode `P5TEST-…` | `GET /sales/products/barcode` returns that medicine in `items` |

### 3.5 Pricing quote + scheme free qty

| Test | Expectation |
| --- | --- |
| `POST /sales/pricing/quote` for a line | 200; line has `unitPricePkr` and `priceSource` |
| If scheme creatable (`POST /pricing/schemes` or existing) buy X get Y | Quote `freeQuantity` matches `floor(qty/buy)*free` for that scheme when it wins priority |

If scheme create is forbidden by permissions/API shape, the script records a **skipped** detail and still passes quote price resolution.

### 3.6 Validate — insufficient stock

| Test | Expectation |
| --- | --- |
| Validate a qty far above available (or medicine with zero stock) | `valid: false` with an error `code === "INSUFFICIENT_STOCK"` (structured, not a bare 500) |

### 3.7 Credit limit + override reason

| Test | Expectation |
| --- | --- |
| Customer with low/zero available credit vs large quote | Validate/book without override → blocked (`CREDIT_LIMIT` or 400 message) |
| Override `true` without reason | 400 / credit service rejection requiring reason |
| Override `true` with reason | Allowed path (validate valid or book succeeds) when stock also ok |

### 3.8 Book idempotency

| Test | Expectation |
| --- | --- |
| Same `idempotencyKey` booked twice | Same order id / order number; only one DO row for that key |

### 3.9 Double book with different keys

| Test | Expectation |
| --- | --- |
| Two books, different keys, same cart shape | Two distinct order ids (documented expected behaviour: not idempotent across keys) |

### 3.10 Availability FEFO order

| Test | Expectation |
| --- | --- |
| Receive two batches out of expiry order via GRN into `P5-TEST` | `GET/POST inventory/availability` allocations ordered earliest expiry first (same FEFO contract as Phase 4) |

### 3.11 Book → invoice stock deduction

| Test | Expectation |
| --- | --- |
| When stock available | Book → approve → invoice; available qty decreases by paid + free; order status `invoiced` |
| If stock/setup insufficient | Script records skip/fail with honest detail — does not invent success |

### 3.12 Soft performance

| Probe | Hard assert? |
| --- | --- |
| product-search, barcode-lookup, customer-search, pricing-quote, validate, availability, book | **No** — timings written to JSON only |

---

## 4. What was verified without a run

| Check | Status |
| --- | --- |
| Suite authored against live route/service names | Yes (from controller + ERP + contracts) |
| Typecheck / deploy / suite execution | **Not claimed** |

---

## 5. Related docs

| Doc | Role |
| --- | --- |
| `SALE_WINDOW_ARCHITECTURE.md` | Lifecycle and services |
| `SALE_WORKFLOW.md` | Operator + keyboard |
| `SALE_PRICING_RULES.md` | Price hierarchy |
| `SALE_SCHEME_RULES.md` | Free qty / FEFO stock need |
| `SALE_PERFORMANCE.md` | Targets + optimizations |
| `SALE_WINDOW_AUDIT.md` | Pre-implementation baseline |

---

*Honesty clause: until `PHASE_5_TEST_RESULTS.json` exists from a successful or partial run, Phase 5 remains code-complete / unverified.*
