# Phase 9 — Finance Final Report

**Date:** 2026-09-12  
**Status:** Partially completed — **code-complete in repo**. **NOT deployed. Suite NOT run.**  
**Rule:** Do not claim complete until tested against a live API (same deploy gate as Phases 4–8).

Supporting docs: `FINANCE_AUDIT.md`.  
Suite: `backend-system/scripts/phase9-finance-tests.mjs` → writes `docs/PHASE_9_TEST_RESULTS.json` **only when executed**.

---

## 1. Status

| Status | Meaning |
| --- | --- |
| **Partially completed** | Dist finance views + Dist posting hooks + journal reverse + periods + reconciliation written on the **existing** `/v1/accounting` engine |
| Completed | Blocked on deploy + suite green + E2E commercial→GL |
| Blocked | No local Postgres; Railway unauthenticated from authoring env |

Phase 9 is **not** complete because screens exist.

---

## 2. What was reused (do not duplicate)

| Engine | Location |
| --- | --- |
| Chart of accounts | `pops_accounts` + `DEFAULT_CHART` |
| Journals | `AccountingHooksService.postEntry` |
| Expenses / cash / bank / tax / TB / P&L / BS | `/v1/accounting/*` |
| Dist customer outstanding | `pharmacy_trade_customers.outstandingPkr` + Phase 7 collections |
| Dist GRN AP | existing `recordPurchaseFromPharmacyGrn` (invoice does **not** post AP again) |
| Integer PKR | unchanged |

---

## 3. What was added

| Item | Notes |
| --- | --- |
| Dist wholesale invoice JV | `recordDistWholesaleInvoice` → 4111 + 1301 (no longer 4110) |
| Dist collection JV | `recordDistCollection` after CollectionService.create |
| Advance allocate JV | Dr 2302 Cr 1301 |
| Cheque pending / clear / bounce | 1302 cheques receivable; bounce reverses collection JV |
| Wholesale return JV | Dr 4111 Cr 1301 |
| Purchase return JV | Dr 2101 Cr 1201 |
| Journal reverse | New reversing entry; original stays posted |
| Unique source+sourceRef | Partial unique index + app-level idempotency |
| Inactive account / period close | Rejected on post |
| Paginated GL | `GET /v1/accounting/ledger` |
| Dist finance APIs | `/v1/pharmacy/finance/*` |
| Dist UI | Dashboard, GL, customer/supplier ledger, reconciliation, periods |

---

## 4. Dist UI

| Page | Route |
| --- | --- |
| Finance dashboard | `distribution/finance` |
| General ledger | `distribution/finance/gl` |
| Customer ledger | `distribution/finance/customer-ledger` |
| Supplier ledger | `distribution/finance/supplier-ledger` |
| Reconciliation | `distribution/finance/reconciliation` |
| Periods | `distribution/finance/periods` |
| Existing cash/bank/expenses/journal/CoA/tax/reports | `/pops/accounting/*` (unchanged engine) |

---

## 5. Known gaps (honest)

| Gap | Status |
| --- | --- |
| Journal + commercial document not one DB transaction | **PARTIAL** — hook runs after commit; errors logged; journal is idempotent |
| Full parent/child CoA UI | Schema has `parentAccountId`; seed chart stays flat by type/subtype |
| Bank statement import | Basic match/unmatch only |
| Dist supplier payments | Still via existing accounting vendor payment / cash — not a second payment engine |
| COGS on Dist invoices | Not invented; gross profit KPI is **N/A** until costing posts |
| Restaurant AR invoices | Remain separate from trade customers |
| Suite / security / 100k ledger perf | **NOT RUN** |
| Frontend/backend tests in CI | **NOT RUN** |

---

## 6. Definition of done (from the brief)

Unchecked items remain because they require a live API:

- [x] Chart of Accounts works (existing + missing codes seeded)
- [x] Journal double-entry validation (server)
- [x] Journal reverse (new entry)
- [x] Dist sales / collection / return / purchase-return hooks
- [x] Duplicate source protection (unique + lookup)
- [x] Customer / supplier ledger views (authoritative balances unchanged)
- [x] Paginated GL
- [x] Periods + close block
- [x] Dist finance dashboard + reconciliation (show diffs, no auto-fix)
- [ ] Suite run against deployed API
- [ ] Period / sales / collection / purchase / expense / return E2E on live data
- [ ] Large-ledger performance measured
- [ ] Security / IDOR pass

**PHASE 9 — NOT COMPLETE.**
