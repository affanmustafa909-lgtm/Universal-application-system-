# Phase 7 — Delivery / POD / Collections / Recovery Report

**Date:** 2026-09-12  
**Status:** Partially completed — **code-complete in repo** (backend modules + Dist UI + docs + suite). **NOT deployed. Suite NOT run.**  
**Rule:** Do not claim complete until tested against a live API (same deploy gate as Phases 4–6).

Supporting docs: `DELIVERY_RECOVERY_AUDIT.md`, `DELIVERY_WORKFLOW.md`, `POD_WORKFLOW.md`, `COLLECTION_WORKFLOW.md`, `AGING_RULES.md`.  
Suite: `backend-system/scripts/phase7-delivery-collections-tests.mjs` → writes `docs/PHASE_7_TEST_RESULTS.json` **only when executed**.

---

## 1. Phase 7 Status

| Status | Meaning |
| --- | --- |
| **Partially completed** | Delivery + collections services/controllers registered; Dist pages + nav wired; AR split-brain guard in API; day-bucket aging |
| Completed | Blocked on deploy + `phase7-delivery-collections-tests.mjs` green + Dist E2E |
| Blocked | No local Postgres/Docker; Railway not authenticated from authoring env |

---

## 2. Dist UI (Phase 7)

| Page | Route |
| --- | --- |
| Delivery dashboard | `distribution/delivery` |
| Deliveries / POD | `distribution/deliveries` |
| Dispatch board | `distribution/dispatch` |
| Collections dashboard | `distribution/collection` |
| Collections (multi-allocate) | `distribution/collections` |
| Aging (day buckets) | `distribution/aging` |
| Recovery queue | `distribution/recovery` |

Clients: `pharmacy-delivery.ts`, `pharmacy-collections-ops.ts` (alias `collectionsApi`) with Phase-7 prefer + legacy 404 fallback.  
Legacy `PharmacyErpPages` deliveries/collections are **no longer** Dist primary exports.

---

## 3. Backend

| Area | Detail |
| --- | --- |
| Controllers | `DeliveryController` → `/v1/pharmacy/delivery/*`; `CollectionsController` → `/v1/pharmacy/collections/*` |
| Delivery | numbering, drivers, vehicles, lifecycle, POD, dashboard KPIs |
| Collections | create with allocations **or** `advance=true`; allocate; cheque status; dashboard |
| Aging | `dueDate = invoiceDate + creditDays`; day buckets |
| Recovery | overdue / over-credit / bounced / broken PTP queue; promises CRUD |
| Module | Registered in `pharmacy.module.ts` |
| Erp | Legacy `createCollection` delegates to `CollectionService` |

Permissions (contracts): `delivery.*`, `collection.*`, `recovery.*` OR `distribution.deliveries|collections`.

---

## 4. Database (ensure-schema)

Additive: `pharmacy_vehicles`, `pharmacy_drivers`, delivery line + POD/idempotency/unique number columns, `pharmacy_delivery_lines`, collection cheque/unallocated/idempotency, `pharmacy_collection_allocations`, `pharmacy_promises_to_pay`. No destructive migrations.

---

## 5. Critical fixes vs audit

| Bug | Fix |
| --- | --- |
| Collection without invoice reduced outstanding, left `amountDue` open | Reject unless allocations or `advance=true` |
| Amount-risk “aging” on Dist page | Aging page uses day-bucket API |
| Dual thin emerald CRUD as Dist primary | Dist-native pages + nav |
| Restaurant `/v1/delivery` | Not merged |

---

## 6. Tests

| Item | Status |
| --- | --- |
| `phase7-delivery-collections-tests.mjs` | Written; **not run** |
| `PHASE_7_TEST_RESULTS.json` | Absent until suite runs |
| Dist E2E sale→POD→collection | Not run |

---

## 7. Honest exit criteria (remaining)

1. Deploy API so ensure-schema Phase 7 DDL applies  
2. `node scripts/phase7-delivery-collections-tests.mjs` with real `API_BASE` → green  
3. Manual Dist: create delivery → dispatch → POD → multi-invoice collection → aging/recovery refresh  

Until then: **code-complete / unverified**.
