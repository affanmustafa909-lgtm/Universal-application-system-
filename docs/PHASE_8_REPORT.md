# Phase 8 — Field Force Final Report

**Date:** 2026-09-12  
**Status:** Partially completed — **code-complete in repo**. **NOT deployed. Suite NOT run.**  
**Rule:** Do not claim complete until tested against a live API (same deploy gate as Phases 4–7).

Supporting docs: `FIELD_FORCE_AUDIT.md`, `FIELD_FORCE_WORKFLOW.md`.  
Suite: `backend-system/scripts/phase8-field-force-tests.mjs` → writes `docs/PHASE_8_TEST_RESULTS.json` **only when executed**.

---

## 1. Status

| Status | Meaning |
| --- | --- |
| **Partially completed** | Field-force module + Dist UI + schema + docs + suite written |
| Completed | Blocked on deploy + suite green + mobile E2E |
| Blocked | No local Postgres; Railway unauthenticated from authoring env |

---

## 2. Dist UI

| Page | Route |
| --- | --- |
| Field Force dashboard | `distribution/field-force` |
| Salesmen | `distribution/sales-force` |
| Salesman detail (lazy tabs) | `distribution/sales-force/:employeeId` |
| Route plan | `distribution/route-plan` |
| PJP | `distribution/pjp` |
| Visits (today + history) | `distribution/visits` |
| Targets | `distribution/targets` |
| Performance | `distribution/field-performance` |
| Legacy assignments | `distribution/assignments` |
| Geography (unchanged) | `distribution/geo` |

Client: `pharmacy-field-force.ts` (new routes + 404 fallback).  
PS Window visit KPIs now prefer generated `pharmacy_visits.planned_date` when present.

---

## 3. Backend

| Area | Detail |
| --- | --- |
| Controller | `/v1/pharmacy/field-force/*` |
| Services | numbering, salesman, route plan, PJP, visit, target, dashboard |
| Module | Registered in `pharmacy.module.ts` |
| Reuse | Employees, geo, trade customers, Sale Window, Phase 7 collections |
| Not created | Second geography, second pricing, second collection engine, restaurant riders |

---

## 4. Database (ensure-schema Phase 8)

Additive: salesman profile columns; route salesman/branch; visit lifecycle columns + unique plan/idempotency; target scope/version; `pharmacy_salesman_routes`, `pharmacy_route_customers`, `pharmacy_pjps`, `pharmacy_pjp_lines`, `pharmacy_field_force_audits`.

---

## 5. Tests

| Item | Status |
| --- | --- |
| `phase8-field-force-tests.mjs` | Written; **not run** |
| `PHASE_8_TEST_RESULTS.json` | Absent until suite runs |
| Mobile / large-data | Not run |

---

## 6. Honest remaining

1. Deploy + ensure-schema Phase 8  
2. `node scripts/phase8-field-force-tests.mjs`  
3. Manual: salesman → route sequence → PJP → generate → start → Sale Window order → Phase 7 collection → complete → target % → PS Window  

Until then: **code-complete / unverified**. **PHASE 8 is not COMPLETE.**
