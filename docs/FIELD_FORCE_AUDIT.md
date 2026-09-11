# Field Force Audit — Phase 8 (pre-implementation)

**Date:** 2026-09-12  
**Rule:** Inspect first. Do not duplicate geography, customers, sales pricing, collections, or restaurant delivery.

---

## Verdict

Field Force today is a **thin CRUD + dashboard widget layer**, not an operating system.

- Salesman = `pops_employees` + optional `pharmacy_sales_force_profiles`
- Territory/route = existing Geography (do **not** create a second geo tree)
- Customer already has `salesmanEmployeeId`, `territoryId`, `routeId`
- Assignments / visits / targets exist as **logs**, not as PJP → planned visit → outcome
- PS Window Field Force KPIs count **assignments vs completed visits**, not generated PJP instances
- PJP is a **weekday integer on the route**, not a versioned journey plan

Restaurant `/v1/delivery` / `pops_riders` must stay separate.

---

## Checklist

| Area | Status | Notes |
| --- | --- | --- |
| Employee / User as salesman identity | **IMPLEMENTED** | `pops_employees.userId` — reuse; no second login |
| Sales force profile | **PARTIAL** | Role + territory/city/area/status only. No manager, branch, primary route, visit/sales targets, working days |
| Salesman statuses | **PARTIAL** | Profile `active`; employee `active \| on_leave \| terminated`. No suspended |
| Salesman detail / progressive tabs | **MISSING** | Sales Force page is master CRUD |
| Geography (province→route) | **IMPLEMENTED** | `DistributionGeoPage` + Erp geo APIs |
| Legacy `pharmacy_territories` vs `pharmacy_geo_territories` | **DUPLICATED** | Two territory tables. Customers FKs point at **legacy** `pharmacy_territories`. Geo beat is `pharmacy_geo_territories`. Do not add a third |
| Route master | **PARTIAL** | Area + optional geoTerritory + `pjpDayOfWeek` + `sequenceNo` (route-in-area, not customer sequence) |
| Route customer sequence | **MISSING** | Customers have one `routeId`; no stop order / preferred day / frequency |
| Customer assignment | **PARTIAL** | Fields exist on trade customer; no assignment audit |
| Customer visit timeline | **MISSING** | Detail has ledger, not visits |
| Assignments | **PARTIAL / INCORRECT for PJP** | Daily task rows; list is unpaginated; emerald CRUD on Dist |
| Visits | **PARTIAL / BROKEN lifecycle** | Insert-only, default `completed`. No planned/started/missed/reschedule, no visit number, no GPS, no outcome enum |
| PJP template + versioning | **MISSING** | Only `routes.pjp_day_of_week` |
| Daily PJP generation / idempotency | **MISSING** | |
| Today's visits / mobile workflow | **MISSING** | |
| Order from visit | **MISSING** | Visit can store `orderId` but UI never links Sale Window |
| Collection from visit | **MISSING** | Visit can store `collectionId`; Phase 7 collections unused from field UI |
| Targets | **PARTIAL** | Create unused on Dist UI; list N+1 actuals; no territory/route/visit targets; no versioning; zero-target not defined |
| Achievement % | **INCORRECT / MISSING** | Reports compute raw ratios; Dist assignment page shows actuals only |
| Salesman / territory / route performance | **PARTIAL** | Dashboard rankings exist; no dedicated FF pages |
| Customer coverage / productivity | **PARTIAL** | Report `visit-coverage` / `unvisited-customers` load then filter in Node |
| PS Window FF widgets | **PARTIAL** | Real SQL but assignment-based; links dump to `/assignments` |
| Reports | **PARTIAL** | Field category live; PJP adherence uses weekday-on-route heuristic |
| Search (Ctrl+K) | **PARTIAL** | Territory/route via lookup; no visit/PJP modules |
| Permissions | **PARTIAL** | Single `distribution.field` |
| Branch isolation | **PARTIAL** | Assignments optional branch; visits have **no** branchId |
| Audit | **MISSING** | No assignment/PJP/visit/target audit trail |
| Notifications | **MISSING** | Do not invent a second notification bus |
| Offline queue | **MISSING** | Use idempotency + retry only |
| GPS | **MISSING** | Do not fabricate coordinates |
| Indexes | **PARTIAL** | visits(org,visitedAt); assignments(org,date); targets(org,employee,period). Missing planned_date / salesman / customer visit indexes |
| List APIs | **SLOW** | `listAssignments` / `listVisits` / `listTargets` / `listSalesForce` load all org rows |
| Restaurant riders | **DO NOT MERGE** | Separate system |

---

## Schema inventory (keep / extend)

| Table | Role |
| --- | --- |
| `pops_employees` | Salesman identity |
| `pharmacy_sales_force_profiles` | Field profile — **extend** |
| `pharmacy_territories` | Customer/salesman territory FK (legacy sales region) |
| `pharmacy_geo_territories` | Beat under area — Geography only |
| `pharmacy_routes` | Route master — **extend** salesman/branch |
| `pharmacy_trade_customers` | Assignment FKs already present |
| `pharmacy_assignments` | Keep as optional daily brief; PJP generates **visits** |
| `pharmacy_visits` | Operational visit — **harden** |
| `pharmacy_targets` | **Extend** scope + visit target + version |

**Add (no parallel masters):**

- `pharmacy_route_customers` — sequence / preferred day / frequency
- `pharmacy_salesman_routes` — extra routes
- `pharmacy_pjps` + `pharmacy_pjp_lines` — versioned journey plan
- Visit columns: number, planned date/seq, status machine, outcome, follow-up, PJP ref, GPS, idempotency

---

## API inventory (today)

| Method | Path | What it does |
| --- | --- | --- |
| GET/POST | `/v1/pharmacy/sales-force` | Profile CRUD |
| PATCH/POST | `/v1/pharmacy/sales-force/:id` / `status` | Masters |
| GET/POST | `/v1/pharmacy/distribution/assignments` | Unpaginated list / create |
| GET/POST | `/v1/pharmacy/distribution/visits` | Unpaginated list / create completed |
| GET/POST | `/v1/pharmacy/distribution/targets` | List (N+1 actuals) / create |
| GET | `/v1/pharmacy/distribution/dashboard/field-force` | Assignment planned vs visit completed |
| GET | geo + employees picker | Masters |

New Phase 8 APIs go under `/v1/pharmacy/field-force/*`. Legacy endpoints stay for fallback.

---

## Recommendation

1. **Reuse** employees, sales-force profiles, geo, customers, Sale Window, Phase 7 collections, PS Window widget slot.  
2. **Do not** create `field_salesmen` or a second territory tree.  
3. **Promote visits** to the planned/actual document.  
4. **PJP** is a new versioned template that *generates* visits.  
5. **Honest status after code:** code-complete / unverified until deploy + suite (same gate as Phases 4–7).
