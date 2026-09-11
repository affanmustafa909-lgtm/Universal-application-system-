# Supplier Performance — Phase 6

**Date:** 2026-09-11  
**Source:** `SupplierPerformanceService.performance` (`GET /v1/pharmacy/purchase/suppliers/:id/performance`).  
**Honesty:** Formulas below are exactly what the service computes. **No composite “score”, star rating, or invented weights.** Rates are `null` when the denominator is zero (not forced to 0 or 100%).

Related: `PURCHASE_WORKFLOW.md`, Dist Suppliers page performance tab.

---

## 1. Scope

- Supplier master: shared `pops_suppliers` (no pharmacy-only supplier table).
- Optional `branchCode` filters PO / GRN / return aggregates to that branch.
- Search: `GET /v1/pharmacy/purchase/suppliers/search?q=&branchCode=` → id, name, phone, email, paymentTerms, **active** (schema has `active`, not `code`/`status`).

Summary (separate endpoint): `GET …/suppliers/:id/summary` → supplier row + PO `orderCount` + sum of PO `totalPkr` (`PurchaseOrderService.supplierSummary`).

---

## 2. Metrics returned

| Field | Definition in code |
| --- | --- |
| `orderCount` | `count(*)` of `pharmacy_purchase_orders` for supplier (+ branch) |
| `receivedCount` | `count(*)` of `pharmacy_grns` for supplier |
| `returnCount` | `count(*)` of `pharmacy_purchase_returns` for supplier |
| `purchaseTotalPkr` | `sum(pharmacy_grns.total_pkr)` |
| `returnTotalPkr` | `sum(pharmacy_purchase_returns.total_pkr)` |
| `onTimeRate` | see §3 — or `null` |
| `fillRate` | see §3 — or `null` |
| `returnRate` | see §3 — or `null` |
| `formulas` | echo strings for UI (same text as below) |

Also: `supplierId`, `supplierName`.

---

## 3. Rate formulas (authoritative)

### onTimeRate

```
onTimeRate = onTime / withExpected
```

- Join GRNs to their PO (`pharmacy_grns.purchase_order_id`).
- Only GRNs whose PO has **non-null** `expected_date`.
- `onTime` = count where `grn.received_date <= po.expected_date`.
- `withExpected` = count of those GRNs in the join filter.
- If `withExpected === 0` → **`null`**.

### fillRate

```
fillRate = min(1, sum(receivedQty) / sum(quantity + freeQuantity))
```

- Across all PO **lines** for the supplier’s POs (branch filter on PO).
- Denominator: sum of line ordered qty including free.
- Numerator: sum of line `received_qty`.
- Capped at 1. If ordered sum is 0 → **`null`**.

### returnRate

```
returnRate = returnTotalPkr / purchaseTotalPkr
```

- Money ratio: return document totals over GRN totals (not unit qty).
- If `purchaseTotalPkr === 0` → **`null`**.

---

## 4. What this is not

- Not a weighted “performance score”.
- Not SLA tiers or colour bands in the API.
- Does not invent on-time when `expectedDate` was never set.
- Does not use restaurant/store supplier tables.

---

## 5. Permissions

`purchase.view` | `purchase.supplier` | `purchase.reports` | `pharmacy.purchase.view` | `pops.read`.

---

## 6. Verification

Live numbers are only trustworthy after deploy + a suite that creates PO/GRN/return fixtures and asserts the three rates. `phase6-purchase-tests.mjs` can call the endpoint; until run, treat UI values as unverified.
