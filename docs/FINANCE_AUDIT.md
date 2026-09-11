# Finance Audit — Phase 9 (pre-implementation)

**Date:** 2026-09-12  
**Rule:** One journal engine. Do not create a second CoA, tax, AR, or AP system.

---

## Verdict

Accounting **already exists** as a shared restaurant/pharmacy module:

- CoA (`pops_accounts` + `DEFAULT_CHART`)
- Double-entry journals (`pops_journal_entries` / `pops_journal_lines`) via `AccountingHooksService.postEntry`
- Cash sessions, bank accounts/txns, expenses, vendor bills/payments, restaurant AR invoices
- Reports: TB, P&L, BS, cash flow, GL (limit 200)
- Dist nav already deep-links to `/pops/accounting/*`

Phase 9 must **connect Dist commercial documents** to this engine and add Dist-facing ledgers / control checks. It must **not** rebuild Finance as a parallel app.

---

## Checklist

| Area | Status | Notes |
| --- | --- | --- |
| Chart of accounts | **IMPLEMENTED** | Seeded per branch; types asset/liability/income/expense/equity. No parent hierarchy |
| Account codes 1101–5208 | **IMPLEMENTED** | Includes 4110 Pharmacy Sales, 4111 Wholesale Sales (unused by Dist post today) |
| Inactive accounts | **PARTIAL** | `active` flag exists; postEntry does not reject inactive |
| Journal create + balance check | **IMPLEMENTED** | Manual JV + hook post; unbalanced skipped/rejected |
| Posted immutable / reverse | **MISSING** | Status has `void` but no reverse API; posted JVs editable only by new entry |
| Duplicate source posting | **PARTIAL** | Hooks check `(source, sourceRef)` in app; **no unique index** |
| Dist wholesale invoice JV | **PARTIAL / INCORRECT** | WINV calls `recordSaleFromPharmacySale` → account **4110** not **4111**; errors swallowed |
| Pharmacy retail sale JV | **IMPLEMENTED** | |
| Dist collection → cash/AR | **MISSING** | Phase 7 collection updates outstanding, **no journal** |
| GRN → inventory/AP | **IMPLEMENTED** | `recordPurchaseFromPharmacyGrn`; invoice post does not double AP |
| Purchase return AP reverse | **MISSING** | Explicit TODO in `purchase-return.service.ts` |
| Wholesale return JV | **MISSING** | Stock restored; no AR/revenue reverse |
| Customer ledger (trade) | **PARTIAL** | `/trade-customers/:id/ledger` operational; Dist UI underuses it |
| Supplier ledger | **PARTIAL** | Vendor bills + payments exist; no Dist supplier statement page |
| AR aging | **IMPLEMENTED** | Phase 7 collections aging — authoritative outstanding is trade customer |
| Restaurant AR invoices | **DUPLICATED conceptually** | `pops_customer_invoices` is restaurant AR, not Dist trade customers. Keep separate |
| Cash / bank / expenses / tax | **IMPLEMENTED** | Existing accounting pages |
| Bank reconciliation | **MISSING** | Book vs statement not modeled |
| Financial periods / close | **MISSING** | |
| Trial balance / P&L / BS | **IMPLEMENTED** | Server-side; P&L hidden until activity |
| GL pagination | **SLOW** | `listJournal` limit 100; GL report flattens 200 rows |
| Finance Dist dashboard | **PARTIAL** | Accounting dashboard exists; Dist uses it via nav only |
| Permissions | **PARTIAL** | `pops.accounting.manage` / `pops.read` only |
| Audit | **PARTIAL** | `pops_accounting_audit_logs` on some actions |
| Integer PKR | **IMPLEMENTED** | No float money |
| Restaurant POS hooks | **DO NOT MERGE** | `recordSaleFromBill` stays restaurant |

---

## Authoritative balances

| Balance | Source of truth |
| --- | --- |
| Dist customer outstanding | `pharmacy_trade_customers.outstandingPkr` + invoice `amountDuePkr` (Phase 7) |
| Dist supplier AP (pharma GRN) | Journal 2101 + GRN; vendor bills for restaurant purchases |
| Cash / bank GL | Journal 1101 / 1102 |
| Inventory GL | Journal 1201 + Phase 4 stock valuation (do not recompute in Finance) |

Reconciliation must **show** mismatches, not silently fix them.

---

## Recommendation

1. Keep `/v1/accounting` as the only journal engine.  
2. Add Dist hooks: wholesale invoice (4111), collection, wholesale return, purchase-return reverse.  
3. Dist pages: finance dashboard, customer ledger, supplier ledger, GL (paginated), reconciliation — wrapping existing APIs.  
4. Add journal reverse + period close + unique `(org, source, sourceRef)`.  
5. Honest status: code-complete / unverified until deploy + suite.
