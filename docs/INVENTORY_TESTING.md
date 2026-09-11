# Inventory Testing — Phase 4

**Date:** 2026-09-11
**Suite:** `backend-system/scripts/phase4-inventory-tests.mjs` (1271 lines)
**Report artefact:** `docs/PHASE_4_TEST_RESULTS.json` — **does not exist yet**, because it is only written by a run.

---

## 1. Status: the suite has NOT been run

**The test suite described in this document has been written and type-checked. It has not been executed. There are no test results. Nothing in Phase 4 has been verified against a running system.**

Do not read any statement in this document, or in the other four Phase 4 documents, as evidence that the behaviour it describes was observed. Every behavioural claim in this documentation set is derived by reading the source, not by running it.

### Why it has not run

The suite is an integration suite by design: it authenticates against a real API, posts real documents and reads the numbers back. Nothing is mocked, because mocking a stock engine tests the mock. That design means it needs a running API with a real PostgreSQL database, and none of the three available routes to one is currently open:

| Route | Blocker |
| --- | --- |
| Local API | No API process is running locally. |
| Local PostgreSQL | No local PostgreSQL instance, and Docker is not installed, so one cannot be started. |
| Production (Railway) | The Railway CLI is not authenticated from this environment, so the Phase 3/4 changes cannot be deployed. Production is still running an older build that does not have these routes or the Phase 4 tables. |

Pointing the suite at the current production URL would not produce a meaningful result. Every Phase 4 route would return `404`, and the run would report a wall of failures that reflect the deployment state rather than the code.

### What has to happen to get results

1. **Deploy the API.** Deployment is what applies the schema: the boot DDL block in `api/scripts/ensure-schema.mjs:942-1118` runs on start-up and creates the Phase 3/4 tables, columns and indexes idempotently. Until the API boots against the target database, the tables do not exist.
2. **Confirm the schema landed.** Check the boot log for the ensure-schema block and confirm `pharmacy_stock_transfers`, `pharmacy_stock_adjustments`, `pharmacy_stock_counts`, `pharmacy_stock_count_lines` and `pharmacy_inventory_settings` are present.
3. **Run the suite** against the deployed API:

```powershell
cd "d:\My POS SYSTEMS REPOS\backend-system"
$env:API_BASE = "https://backend-system-production-28a3.up.railway.app"
$env:DIST_EMAIL = "admin.distribution@pops.demo"
$env:DIST_PASSWORD = "<password>"
$env:BRANCH_CODE = "DIST-HQ"
node scripts/phase4-inventory-tests.mjs
```

4. **Read `docs/PHASE_4_TEST_RESULTS.json`**, which the run writes into this `docs` folder, and reconcile any failure against the rules in `INVENTORY_BUSINESS_RULES.md` before treating either the code or the documentation as settled.

The process exits non-zero if any assertion fails, so it can be wired into CI as-is.

---

## 2. What was verified

Build and type checks **were** run. These are the only Phase 4 verifications that actually happened.

| Check | Command | Result |
| --- | --- | --- |
| Backend type check | `npx tsc --noEmit -p api/tsconfig.json` | Exit code 0. No errors. |
| Launcher production build | `npx vite build` from `apps/launcher` | Succeeded. |
| Launcher type check | `npx tsc --noEmit` from `apps/launcher` | 3 errors, all in `src/pages/distribution/DistributionGeoPage.tsx`, all pre-existing and unrelated to Phase 4. No error in any inventory file. |

A clean type check means the code compiles and the contracts line up across the API, the contracts package and the launcher. It says nothing about whether the SQL is correct, whether the locking holds under contention, or whether the arithmetic balances. Those are exactly what the untested suite exists to answer.

---

## 3. Environment and conventions

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_BASE` (or `API_URL`) | `http://127.0.0.1:3000` | API root. Trailing slash stripped. |
| `DIST_EMAIL` | `admin.distribution@pops.demo` | Login. |
| `DIST_PASSWORD` | `SEED_USER_PASSWORD` from `backend-system/.env`, else `Owner@12345` | Login. |
| `BRANCH_CODE` | `DIST-HQ` | Branch under test. |

**Test data isolation.** A run derives `RUN_ID` from the last eight digits of the current epoch millisecond and prefixes every SKU with `P4TEST-<RUN_ID>`. Two dedicated warehouses, `P4-TEST` ("Phase 4 Test Warehouse") and `P4-TEST-B`, are created on first run and reused after that. Batch numbers are similarly suffixed (`B-EARLY-<RUN_ID>`, `B-CONC-<RUN_ID>`, …).

**The suite never deletes anything.** Not test data, not real data. It only creates. Running it against production leaves a permanent, identifiable residue: two warehouses and a set of `P4TEST-` products with stock, adjustments, transfers and counts against them. That is a deliberate trade — a suite with delete logic aimed at a production database is a worse risk than some labelled clutter — but it means **running this against production is a decision, not a routine**, and the residue has to be cleaned up by hand or tolerated.

**Harness.** `check(name, condition, detail, expected, actual)` records a pass or fail and prints it immediately, so a run that dies part-way still shows what passed. An exception anywhere in the sequence is caught at the top level and recorded as a single failed `Suite execution` result rather than losing the report.

---

## 4. Test inventory

Twelve groups, run in order, roughly 87 assertions when every conditional path is reached. Each group's stock expectations depend on data created earlier in the same group, not across groups, so a failure in one group does not cascade false failures into the next.

### 4.1 Security and input validation (9 assertions)

Runs first, before any data is created, on the principle that a system that leaks is not worth performance-testing.

| Assertion | What it proves |
| --- | --- |
| Unauthenticated request is rejected | `GET inventory/stock` with no token returns 401 or 403, not data. |
| Tampered JWT is rejected | The last six characters of a valid token are replaced; the request must still be refused. Proves the signature is checked, not just the shape. |
| Unauthorised `warehouseId` is refused (no data leak) | An all-zero UUID returns 404 or 400. Proves `resolveWarehouse` validates ownership rather than filtering on an id it was handed. |
| Unknown `branchCode` is refused | `NOT-A-BRANCH` returns 404 or 400 and does not silently fall back to the default branch. |
| SQL injection in `q` is neutralised | `'; DROP TABLE pharmacy_medicines; --` returns 200 and is treated as a search string. |
| Medicines table intact after injection attempt | A follow-up list still returns 200 — the payload did not execute. |
| Absurd pagination is clamped, not fatal | `page=-5&pageSize=99999` returns 200 with `pageSize <= 200`. |
| Invalid date range does not 500 | `from=not-a-date&to=13-13-2026` must stay below 500. The ledger service validates both boundaries and throws `400` with the expected format named. |
| Unknown medicine id returns 404 | A clean 404, not a crash or an empty 200. |

### 4.2 Stock arithmetic and FEFO (10 assertions)

Receives three batches **deliberately out of expiry order**, so that "oldest purchase" and "earliest expiry" give different answers and a first-in-first-out implementation would fail visibly: `B-LATE` (400 days, 50 units) first, then `B-EARLY` (60 days, 30 units), then `B-MID` (200 days, 20 units).

| Assertion | Expectation |
| --- | --- |
| First / second / third receive posts | Each GRN returns 2xx. |
| Available equals sum of received batches | 50 + 30 + 20 = 100. |
| Physical equals available when nothing is reserved or damaged | 100. |
| Reserved / damaged / quarantine / blocked all start at zero | All four buckets are 0. |
| Availability endpoint responds | 200. |
| Allocation is fulfillable | A request for 40 against 100 is fulfillable. |
| **First allocation is the earliest-expiry batch, not the earliest purchase** | `allocations[0].batchNumber === "B-EARLY-<runId>"`. This is the central FEFO assertion. |
| Allocation splits across batches in expiry order | Exactly two allocations: `B-EARLY: 30` then `B-MID: 10`. `B-LATE` is untouched. |

This group returns its medicine and warehouse for reuse by the ledger and performance groups.

### 4.3 Expiry (7 assertions)

Receives an already-expired batch (`B-EXP`, expiry −30 days, 40 units) alongside a valid one (`B-OK`, +300 days, 10 units).

| Assertion | Expectation |
| --- | --- |
| Expired units are reported separately | `expiredQty === 40`. |
| Expired stock is excluded from available | `availableQty === 10`. |
| Expired stock is still counted as physically present | `physicalQty === 50`. Nothing was destroyed. |
| **Expired batch is never allocated** | No allocation references `B-EXP`. This is the pre-Phase-4 bug the change was made to fix. |
| Request beyond unexpired stock is reported short with a reason | A request for 20 gives `fulfillable: false`, `shortfall: 10`, and a non-empty `reason`. |
| Bucket endpoint responds | 200. |
| Expired bucket is separate and non-empty | `expired.quantity >= 40`. |

Note the interaction with `INVENTORY_ARCHITECTURE.md` §2: `availableQty` from `GET inventory/stock/:id` excludes expired units, while the raw `quantity` column that FEFO reads does not. The suite asserts the reported figure.

### 4.4 Negative stock policy (4 assertions)

| Assertion | Expectation |
| --- | --- |
| Policy defaults to block | `GET inventory/settings` returns `negativeStockPolicy: "block"`. |
| Over-request is reported as not fulfillable | 500 requested against 5 in stock gives `shortfall: 495`. |
| Decrease beyond available is refused under block policy | A `decrease` of 500 must fail at create, submit or approve — the suite walks all three stages and passes if any of them refuses, so it is not coupled to *where* the guard sits. |
| Available never went below zero | `availableQty >= 0` afterwards. |

### 4.5 Adjustments (11 assertions)

Uses a `damage` adjustment of 10 against a batch of 100, because damage is the type where the important property is non-obvious.

| Assertion | Expectation |
| --- | --- |
| Test batch is listed | The batch register returns the batch just received. Gates the rest of the group. |
| A missing reason is refused | An empty `reason` returns 4xx. |
| Damage document created / submit accepted / approval posts | Each step returns 2xx. The approval step is skipped when submit already posted the document, so the group works under either approval setting. |
| Final status is posted | `status === "posted"`. |
| Damage reduces available by the adjusted quantity | `available` drops by exactly 10. |
| Damage increases the damaged bucket | `damaged` rises by exactly 10. |
| **Damage leaves physical stock unchanged (reclassified, not destroyed)** | `physicalQty` is identical before and after. This is the assertion that distinguishes a reclassification from a write-off. |
| Re-approving a posted document is refused | 4xx / 409. |
| Replay did not change stock | `availableQty` after the refused replay equals the value before it. Proves the refusal happened before any stock write, not after a partial one. |

### 4.6 Transfers (13 assertions)

Moves 25 units of a 60-unit batch from `P4-TEST` to `P4-TEST-B`.

| Assertion | Expectation |
| --- | --- |
| Source equal to destination is refused | 4xx. |
| Created as draft / initial status is draft | 2xx and `status === "draft"`. |
| **Dispatch before approval is refused** | 4xx. The state machine cannot be skipped. |
| Submit accepted / approve accepted / dispatch accepted | Each 2xx. |
| Dispatch removes stock from the source warehouse | Source available drops by exactly 25. |
| Re-dispatch is refused | 4xx / 409. |
| Re-dispatch did not double-deduct | Source available unchanged after the refusal. |
| Receive accepted | 2xx. |
| Receive adds stock at the destination warehouse | Destination available rises by exactly 25. |
| **Branch-wide quantity is conserved** | `sourceBefore + destBefore === sourceAfter + destAfter`. Moving stock between warehouses must create and destroy nothing. |

### 4.7 Stock count (7 assertions)

Counts 75 against a system quantity of 80 — a shortage of 5.

| Assertion | Expectation |
| --- | --- |
| Sheet created | 2xx. |
| Sheet snapshots the system quantity | `systemQuantity === 80`. |
| Counted quantity recorded | 2xx. |
| Posted | 2xx. |
| Posting produced an adjustment document | `adjustmentId` is present — the variance became a document, not a silent write. |
| **System stock now matches the counted quantity** | `availableQty === 75`. |
| Re-posting is refused | 4xx / 409. |

The group handles both response shapes for the line sheet (`lines.items` or a bare `lines` array) and records an explicit failure rather than throwing if no line id comes back.

### 4.8 Idempotency (4 assertions)

Posts the same GRN twice with the same `idempotencyKey`.

| Assertion | Expectation |
| --- | --- |
| Keyed GRN posts | 2xx. |
| Retrying the same keyed GRN is accepted | 2xx, not an error. A retry after a network timeout must not look like a failure to the caller. |
| **Retry returns the original GRN** | The second response carries the same `id` as the first. |
| **Retry did not double-receive stock** | `availableQty` is unchanged by the second call. |

### 4.9 Concurrency (2 assertions)

Fires **ten parallel `decrease` adjustments of 10 units each against exactly 100 units** via `Promise.all`, each one walking create → submit → approve independently.

| Assertion | Expectation |
| --- | --- |
| Parallel deductions never drive stock negative | `availableQty >= 0`. |
| **Stock math reconciles with the number of successful deductions** | `availableQty === 100 − (successes × 10)`. |

The second assertion is the real one. It does not require a particular number of successes — under `block` all ten may legitimately succeed, since 10 × 10 = 100 exactly — but it requires that the surviving stock figure is exactly consistent with how many posted. A lost update, a double-apply, or a partially-applied transaction all break this equality. This is the only test in the suite that can catch a row-locking defect, and it is untested.

### 4.10 Returns (3 assertions)

| Assertion | Expectation |
| --- | --- |
| Purchase return posts | 2xx. |
| Purchase return reduces stock | Available drops by exactly 15. |
| **Purchase return is recorded as `PURCHASE_RETURN`, not `SALE`** | The ledger filtered on `PURCHASE_RETURN` contains at least one row for this medicine. This is a direct regression test for the pre-Phase-4 mislabelling. |

### 4.11 Ledger and end-to-end reconciliation (8 assertions)

Runs against the medicine built in §4.2, which was created entirely within this run and therefore has a complete ledger from its first unit.

| Assertion | Expectation |
| --- | --- |
| Register responds | 200. |
| Every receipt wrote a movement row | At least three `GRN` rows for three receipts. |
| Movement rows carry a running balance and a captured cost | Every row has a numeric `quantityAfter`, and at least one has `unitCostPkr > 0`. |
| Totals endpoint responds | 200. |
| **E2E reconciliation: ledger net movement equals physical stock on hand** | `totals.netQuantity === stock.physicalQty`. |
| Reconciliation tool responds | 200. |
| A medicine created this run shows no cache drift | Either absent from the drift list or `cacheDrift === 0`. |
| Data quality tool responds with real checks | A non-empty array of checks. |

**Why the E2E reconciliation test is the most important test in the suite.** Every other test verifies one operation. This one verifies that the whole set of operations is mutually consistent. The medicine it checks has been through three receipts and whatever else the earlier groups did to it; the ledger is an independent append-only record written by a different code path from the batch quantity columns. If the sum of every recorded movement equals the physical quantity on the batch rows, then no operation in the run wrote stock without recording it, recorded a movement without writing stock, or recorded the wrong sign or magnitude. If it fails, the ledger and the stock have diverged and the inventory system cannot be trusted regardless of how many other tests pass.

This test only works because the medicine is new. On legacy data the same equality is expected to fail for the reasons in `INVENTORY_BUSINESS_RULES.md` §11, which is why the reconciliation endpoint reports ledger drift with an explanatory note rather than as an error.

### 4.12 Performance probes (9 assertions)

Each endpoint is called three times, the timings are sorted, and the **median** is compared against a budget. Median of three discards a single cold-start outlier without hiding a genuinely slow endpoint. Budgets are documented in `INVENTORY_PERFORMANCE.md`; the suite asserts `status === 200 && median <= budget`.

| Probe | Budget |
| --- | --- |
| `stock-list` (`inventory/stock`, pageSize 25) | 500 ms |
| `product-lookup` (`inventory/stock/:id`) | 300 ms |
| `availability` (`inventory/availability`) | 300 ms |
| `batch-list` (`inventory/batches`, pageSize 25) | 300 ms |
| `dashboard` | 1000 ms |
| `ledger` (pageSize 50) | 500 ms |
| `expiry-buckets` | 500 ms |
| `valuation-summary` | 1000 ms |
| `reorder` (pageSize 25) | 1000 ms |

Every request the harness makes with a `label` is also appended to `requestTimings` in the JSON report, so the report carries raw observations as well as the pass/fail verdicts.

---

## 5. The report artefact

A run writes `PHASE_4_TEST_RESULTS.json` to the first writable path of `Universal-application-system-/docs/` or `backend-system/scripts/`, containing `generatedAt`, `api`, `branch`, `runId`, `summary` (`total` / `passed` / `failed`), the full `results` array with expected and actual values for every assertion, the `performance` array (`label`, `status`, `best`, `median`, `worst`, `budgetMs`), and `requestTimings`.

**This file is absent from the repository.** Its absence is the authoritative signal that no run has happened. If you are reading this document and the file exists, trust the file over this section.

---

## 6. Defects found by reading the suite, and fixed

Two problems were found by reading the suite against the API it calls, before any run. Both have been fixed; both fixes are type-checked but, like everything else here, unexercised.

**Test medicines were being created with zero prices.** The suite posted `purchasePricePkr`, `costPricePkr` and `sellingPricePkr` to `POST /v1/pharmacy/medicines`, but `createMedicineSchema` (`packages/contracts/src/pharmacy.ts:417-436`) declares `purchasePrice`, `sellingPrice` and `costPrice`. Zod strips unknown keys, so the prices fell back to their defaults of zero and every valuation and captured-cost assertion would have been measuring nothing. The suite now posts the contract's field names.

**An invalid date returned a raw 500.** The suite sends `from=not-a-date` and asserts the response stays below 500. `StockLedgerService.buildWhere` built `new Date("not-a-dateT00:00:00.000Z")`, an `Invalid Date`, and handed it to the driver. Both boundaries are now parsed through a `boundary()` helper that rejects an unparseable value with `400 Invalid \`from\` date "not-a-date". Expected YYYY-MM-DD.` This also satisfies the Phase 2 requirement that invalid date ranges be handled rather than crashing, and the Phase 4 requirement not to expose raw database errors.

---

## 7. Known gaps

What this suite does not cover, stated so the coverage is not overestimated.

| Gap | Detail |
| --- | --- |
| **No UI end-to-end tests** | There is no Playwright or equivalent suite. The ten Phase 4 screens are verified only by a successful production build and a clean type check. No screen has been rendered against live data. |
| **No scale test** | Nothing exercises 100,000 rows. Every performance probe runs against the handful of products the suite itself creates, so the numbers a run produces describe a nearly empty table and say very little about behaviour at real volume. See `INVENTORY_PERFORMANCE.md` §5. |
| **No RBAC scoping test** | The suite logs in as a distribution administrator and never as a restricted user. Salesman self-scoping is Phase 11 work and is not implemented, so there is nothing to test yet. The permission *lists* on each route are unverified at runtime; only the unauthenticated and tampered-token paths are exercised. |
| **No multi-tenant isolation test** | Cross-organisation access is enforced by `organizationId` from the JWT on every query, but the suite has only one tenant's credentials and cannot attempt a cross-tenant read. |
| **No test of `warn` / `allow` negative-stock policies** | Only the default `block` is exercised. Given that `warn` and `allow` are indistinguishable in the engine (`INVENTORY_BUSINESS_RULES.md` §3), a test would currently only confirm the ambiguity. |
| **No reservation lifecycle test** | Reserve, release-as-`released` and release-as-`consumed` are not exercised, nor is the distribution order `stock_reserved` transition — one of the seven user-visible behaviour changes. |
| **No partial-receipt transfer test** | The transfer test receives in full. Shortage handling, the running-total semantics of `receivedQuantity`, and the `received` versus `completed` distinction are untested. |
| **No cross-branch transfer test** | Both test warehouses are in the same branch, so SKU-based destination medicine resolution is untested. |
| **No cleanup** | Discussed in §3. |

---

## 8. Recommended order of work after deployment

1. Deploy, confirm the boot DDL applied, and run the suite against a **staging or demo** branch rather than a live production branch, given §3.
2. Triage failures against §6 before assuming a code defect.
3. Treat a failure of the E2E reconciliation assertion (§4.11) or either concurrency assertion (§4.9) as blocking. Everything else is fixable in place; those two indicate the stock model itself does not hold.
4. Commit `PHASE_4_TEST_RESULTS.json` and replace §1 of this document with the actual outcome.
5. Only then fill in the measured column in `INVENTORY_PERFORMANCE.md`.
