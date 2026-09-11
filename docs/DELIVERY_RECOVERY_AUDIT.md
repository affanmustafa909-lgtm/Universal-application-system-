# DELIVERY & RECOVERY AUDIT — Phase 7 Pre-Implementation

**Date:** 2026-09-11  
**Scope:** Order-to-cash ops — delivery, dispatch, POD, collections, aging, recovery, customer ledger  
**Rule:** audit before changing behaviour. Evolve existing Dist delivery/collections — do not create a second order, AR, or restaurant delivery system.  
**Related:** Phase 5 Sale Window, Phase 4 inventory, Phase 6 purchase (separate AP stack).

---

## 1. Current architecture

```
Dist order (DO-*) ──advance──► picking → packed → ready → dispatched → delivered
        │
        └──invoice──► WINV-* ──► trade_customer.outstandingPkr += total
                              │
pharmacy_deliveries (DLV-*) ◄─┘ optional FKs (order/invoice/customer) — often manual
        │
        └── POD patch (usually only "delivered")

pharmacy_collections (COL-*) ──► outstandingPkr -= amount
        └── optional single invoiceId → amountPaid / amountDue
```

| Layer | Table | Role today |
| --- | --- | --- |
| Order pipeline | `pharmacy_dist_orders` | Status machine + pick/pack/dispatch **timestamps** |
| Invoice / AR | `pharmacy_dist_invoices` | `amountPaidPkr`, `amountDuePkr`, `outstanding` on customer |
| Delivery ticket | `pharmacy_deliveries` | Thin POD row; `riderName` text; no driver FK |
| Collection | `pharmacy_collections` | One amount; optional **one** invoice |
| Geography | routes / territories | Exists — not fleet |
| Restaurant riders | `pops_riders` / `/v1/delivery` | **Out of scope** — do not merge |

**Architectural rule for Phase 7:** deepen `pharmacy_deliveries` + `pharmacy_collections` + Dist UI; sync with order `advance` and invoices; keep Sale Window as booking source. **Do not invent parallel invoices or restaurant POD.**

---

## 2. Frontend

### Nav today

| Group | Items | Gap |
| --- | --- | --- |
| Deliveries | Single “Deliveries / POD” | No dashboard, dispatch board, picking, packing, drivers |
| Collections | Collections + Aging / Recovery | Aging is amount-risk, not day buckets; no recovery queue |
| Customers | Trade customers, Outstanding/Aging, Collections | Detail underuses ledger API |

### Screens

| Screen | File | Verdict |
| --- | --- | --- |
| Deliveries | `PharmacyErpPages` `PharmacyDeliveriesPage` | Real create + Mark delivered only; load-all; emerald chrome |
| Collections | same file | Cash-only; no invoice multi-allocate; load-all |
| Aging | `DistributionAgingPage` | Real outstanding; **wrong buckets** (amount thresholds) |
| Trade customer detail | Dist masters | Ledger API called; invoices/collections/aging **not rendered** |
| PS Window | `DistributionPsWindowPage` | Real day-bucket recovery + delivery widgets — reuse aggregates |
| Orders | `DistributionOrdersPage` | Pick/Pack/Dispatch as status buttons — not workstations |
| Geo | `DistributionGeoPage` | Routes exist |
| Report Center | pending-deliveries, delivery-status, pod-exceptions, dlv/col registers, outstanding-aging | Live; aging report is amount list |

### Missing vs Phase 7 brief

Delivery dashboard · picking · packing · dispatch board · full POD outcomes + signature · multi-invoice allocation · cheques · day-based Aging page · recovery queue · promise-to-pay · drivers/vehicles masters.

---

## 3. Backend endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST/PATCH | `/v1/pharmacy/distribution/deliveries` | Unpaged; weak validation |
| GET/POST | `/v1/pharmacy/distribution/collections` | Single optional `invoiceId` |
| POST | `/v1/pharmacy/distribution/orders/:id/advance` | Pick/pack/dispatch/delivered |
| GET | `/v1/pharmacy/trade-customers/:id/ledger` | Invoices+collections+coarse aging |
| GET | `/v1/pharmacy/distribution/dashboard/recovery` | **Day buckets** on invoiceDate |
| GET | `/v1/pharmacy/distribution/dashboard/deliveries` | Delivery KPIs |

**Missing:** dedicated aging list API, recovery queue, drivers/vehicles, POD evidence, cheque register, PTP, multi-allocation, collection dashboard summary, idempotent collection/POD.

---

## 4. Database

### Present

- `pharmacy_deliveries` — status, failedReason, podNotes, collectedPkr, riderName, routeId  
- `pharmacy_collections` — amount, paymentMethod, optional invoiceId  
- Dist order pipeline timestamps  
- Invoice amountPaid / amountDue  

### Absent (additive for Phase 7)

- Delivery line items (picked/packed/delivered/returned qty)  
- Drivers / vehicles masters  
- Collection allocation lines (many invoices)  
- Cheque fields / cheque register  
- Promise-to-pay  
- POD signature/photo refs  
- Unique indexes on DLV/COL numbers  
- `dueDate` on invoices (or derive from invoiceDate + creditDays consistently)  

---

## 5. Critical correctness bugs

1. **Collection without invoiceId** reduces customer outstanding but leaves invoice `amountDue` open → ledger split-brain.  
2. **Order `paymentStatus` never updated** after collections.  
3. **Dual completion paths:** order `advance` → delivered vs delivery PATCH — not kept in sync.  
4. **`collectedPkr` on POD ≠ collection posting.**  
5. **No collection GL** — invoice posts AR; collection does not clear AR in accounting hooks.  
6. **`nextRef(Date.now)`** numbering without unique constraints.  
7. **Aging page ≠ dashboard aging** — amount risk vs day buckets; `?focus=overdue` mis-mapped.  
8. **Load-all** deliveries/collections lists.  
9. Ledger aging uses `createdAt` 3-bucket; dashboard uses `invoiceDate` day buckets — inconsistent.

---

## 6. Recommended architecture

```
Sale Window book → approve → invoice (WINV)
        ↓
Delivery order (from invoice / ready order)
        ↓ pick → pack → ready → dispatch (driver/vehicle/route)
        ↓ out for delivery → POD (delivered|partial|failed|refused)
        ↓ returns via existing wholesale return / stock engine when needed
        ↓
Collection (COL) + allocation lines → invoices + customer outstanding + (optional) GL
        ↓
Aging / Recovery queue / Customer ledger (single source of truth)
```

### Services to add (under `api/src/pharmacy/delivery/` and `collections/`)

| Service | Owns |
| --- | --- |
| `DeliveryService` | Lifecycle, dispatch, POD, sync with dist order |
| `DeliveryDashboardService` | Aggregate KPIs |
| `CollectionService` | Post + multi-invoice allocation + idempotency |
| `AgingService` | Day buckets (dueDate = invoiceDate + creditDays) |
| `RecoveryService` | Work queue from aging + credit breach |
| `DriverService` / `VehicleService` | Masters |
| Keep | Order `advance`, inventory FEFO, trade ledger, accounting hooks |

### Frontend

- Dist-native Delivery Dashboard, Dispatch, Out for Delivery, POD, Collections Dashboard, New Collection + allocation, Aging (day buckets), Recovery queue.  
- Evolve or replace thin `PharmacyDeliveriesPage` / Collections emerald CRUD.  
- Extend trade customer detail tabs: invoices, deliveries, collections, ledger, aging.

---

## 7. Permissions

Today: `distribution.deliveries`, `distribution.collections`, `distribution.orders`.

Add Phase 7 catalogue (OR with legacy):  
`delivery.view|dispatch|pod|manage`, `collection.view|create|allocate`, `recovery.view|action`, `delivery.driver`, cheque permissions as needed.

---

## 8. What Phase 7 reuses

| Asset | Decision |
| --- | --- |
| Dist order advance | Reuse for warehouse pipeline; delivery ticket for field POD |
| Dashboard recovery/deliveries APIs | Reuse aggregates; align Aging page |
| Trade customer ledger API | Extend response + Dist detail UI |
| Report Center DLV/COL | Keep; add allocation/cheque reports later |
| Geo routes | Assign on dispatch |
| Wholesale returns | Refused/damaged stock path |
| Sale Window invoices | Source of receivable |

---

## 9. Definition of done (tracking)

Complete only when: Dist dashboards live, POD outcomes work, multi-invoice allocation posts consistently, day-aging matches dashboard, recovery queue real, E2E sale→POD→collection→ledger passes, suite run against deployed API.

Until deploy + tests: **code-complete / unverified**.

---

*End of pre-implementation audit.*
