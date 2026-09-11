# Medical Distribution ERP — Codebase Audit

**Date:** 2026-09-11  
**Superseded for current status:** this snapshot predates Phases 1–9 and the final combined phase. Use `docs/FINAL_PHASE_AUDIT.md` + `docs/FINAL_PHASE_REPORT.md` + the Phase 2–9 reports. Do not treat sections below as a missing-feature list.

**Scope:** `Universal-application-system-` (frontend) + `backend-system` (Nest API)  
**Edition:** Medical Distribution (`HAS_DISTRIBUTION`) sharing pharmacy data APIs

---

## 1. Executive verdict

The distribution product is a **real, API-connected wholesale ERP shell** — not a mock. Core booking (Sales window), geography, PS Window KPIs, invoices, aging, and report center are Dist-owned. Most inventory/purchase/ops screens are **shared pharmacy CRUD** with thin forms.

It does **not** yet feel like a full commercial pharmaceutical distribution OS: navigation is incomplete vs the target IA, many workflows are single-line CRUD, lists lack pagination, search loads full catalogs, aging is amount-based (not day buckets), and POD/schemes/registers are partial.

**Strategy:** evolve in place — deepen modules, fix performance, unify design — **do not rewrite**.

---

## 2. Architecture snapshot

```
apps/launcher (Vite + React + Tauri)
  distribution/     → Dist UX (cyan), routes under /pops/distribution/*
  pharmacy/         → Shared stock/masters APIs + many re-exported pages
  pops/             → Shell, sidebar, accounting, auth, printing
        │
        ▼ authFetch + JWT
backend-system/api (NestJS 11 + Express)
  /v1/pharmacy/*    → retail + distribution ERP (SystemType: pharmacy | distribution)
  /v1/accounting/*  → ledgers, cash, bank, P&L
        │
        ▼ Drizzle ORM
PostgreSQL (Railway / local) — packages/database-pg
```

Local SQLite (`database-sqlite`) is **sync outbox / install metadata only** — not the product database.

---

## 3. Frontend structure

| Area | Path | Notes |
|------|------|-------|
| Dist pages | `apps/launcher/src/distribution/pages/` | PS, Orders, Geo, Invoices, Aging, Reports + barrel re-exports |
| Dist UI | `apps/launcher/src/distribution/ui/DistUi.tsx` | Badge, filter bar, table, KPI, panel |
| Dist nav | `apps/launcher/src/distribution/spec/nav.ts` | Grouped sidebar |
| Dist API | `distribution/api/distribution.ts` | Re-exports `pharmacy-erp` |
| Routes | `routes/distributionRoutes.tsx` | Lazy-loaded |
| Shell | `pops/layouts/PopsShell.tsx` | Sidebar + header |

### Module maturity

| Module | Maturity | Reality |
|--------|----------|---------|
| Sales window | **High** | Customer, search/scan, cart, hold, credit override, status, print |
| Geography | **High** | Province → Route hierarchy CRUD |
| PS Window | **High (code) / deploy-pending (prod)** | Modular dashboard APIs, URL filters, independent widgets; Railway still on older `ps-window` until deploy |
| Invoices / Aging | **Medium** | Lists + CSV; aging = outstanding amount buckets |
| Report center | **Medium–High (FE)** | ~40 live report IDs; depends on backend handlers |
| Inventory / expiry | **Medium** | Shared pharmacy; Dist routes only |
| Purchase PO/GRN | **Low–Medium** | API real; UI single-line |
| Delivery / POD | **Low–Medium** | Create + mark delivered (no partial/refuse/signature) |
| Collections | **Low–Medium** | Cash amount + list |
| Field force | **Medium** | Assignments + visits; target create unused |
| Pricing / schemes | **Low–Medium** | Shells + resolve used in booking |
| Finance | **Shared** | Accounting hub (platform), not Dist-specific UX |
| Fake pages | **None** | Thin UX ≠ placeholder tiles |

---

## 4. Backend / database

| Concern | Finding |
|---------|---------|
| Stack | NestJS, Drizzle, PostgreSQL, Zod contracts, Passport JWT |
| Controllers | `pharmacy.controller.ts` + `pharmacy-erp.controller.ts` under `/v1/pharmacy` |
| Stock engine | FEFO deduct in `pharmacy-stock.engine.ts` |
| Pricing | `resolvePrice` + `resolveSchemeFreeQty` (buy_x_get_y) |
| Accounting | `AccountingHooksService` posts GRN / dist invoice / returns |
| Document numbers | Timestamp-based `nextRef` — **not collision-safe** |
| Indexes | **Almost none** on pharmacy/dist tables |
| Pagination | **None** — hard `.limit(200–8000)` |
| Cache | No Redis for domain data |
| Realtime | Printing SSE only; no domain websockets |
| Transfers | Schema exists; **no pharmacy HTTP API** for stock transfers |

### Key tables

- Products/batches: `pharmacy_medicines`, `pharmacy_medicine_batches`
- Stock: `pharmacy_warehouses`, `pharmacy_stock_movements`, transfers (schema-only)
- Wholesale: `pharmacy_dist_orders/lines`, `pharmacy_dist_invoices/lines`
- Purchase: `pharmacy_purchase_orders`, `pharmacy_grns`, returns
- Trade: `pharmacy_trade_customers`, collections, deliveries, visits, targets
- Geo: provinces → … → routes (+ legacy territories)
- Pricing: `pharmacy_price_lists`, `pharmacy_schemes`

---

## 5. Auth / permissions

- JWT + membership `permissions[]` (OR semantics) + `SystemTypeGuard` (`pharmacy` \| `distribution`)
- Dist permission keys exist in contracts (`distribution.orders`, `.deliveries`, `.collections`, `.field`, `.pricing`, `.masters`)
- Frontend role labels are coarse (admin/manager/cashier/accountant/hr) — not full RBAC matrix UX
- **Must keep enforcing permissions on backend** for all new endpoints

---

## 6. Performance audit (critical)

### Observed / code-evident issues

1. **Load-all lists** — medicines, customers, orders, invoices, deliveries, batches (no server pagination)
2. **Client-side filtering** after full fetch (invoices, aging, reports `q`)
3. **Sales window** fetches full medicine catalog when customer selected (UI shows ≤48)
4. **Invoices** loads all invoices + all customers for name join
5. **`lookupByCode`** scans up to hundreds of rows per table in memory
6. **Price resolve** N+1 over price lists
7. **Reports** pull 5k–8k rows then aggregate in Node
8. **`useInvalidatePharmacy()`** without keys can invalidate all pharmacy+distribution queries
9. Missing DB indexes on org/branch/sku/barcode/expiry/document numbers
10. Broad invalidation → unnecessary refetches (perceived 5–10s waits)

### Targets (product requirement)

| Interaction | Target |
|-------------|--------|
| UI feedback | &lt; 100ms perceived |
| Normal API | &lt; 300ms where practical |
| Search | &lt; 300ms |
| Add line to sale | Instant local update |
| Dashboard | Shell first + lazy widgets |
| Reports | Server pagination / async export |

---

## 7. UX / design audit

| Strength | Gap |
|----------|-----|
| Cyan Dist accent vs pharmacy emerald | Re-exported pages still use emerald inputs |
| DistStatusBadge / DistDataTable | No shared Dist page shell, empty/error skeletons |
| Sales window is keyboard-aware in parts | Full F2–F10 map incomplete |
| Grouped nav exists | Not aligned to target MAIN NAVIGATION IA |
| No global Dist search in shell | Lookup API exists but unused in Dist chrome |
| Dense tables starting | No column visibility, bulk actions, sticky first column |

---

## 8. End-to-end flow gaps (acceptance)

Target chain: Company → Medicine → Supplier → WH → PO → GRN → Batch → Customer → Credit → Price → Scheme → Salesman → Territory/Route → Sale (FEFO + scheme + credit) → Invoice → Stock ↓ → Ledger → Delivery → POD → Collection → Reports → Audit

| Step | Status |
|------|--------|
| Masters create | Partial (thin forms) |
| PO → GRN → stock ↑ | Works via API; UI thin |
| FEFO on sale | Engine present |
| Scheme auto free qty | Present (buy X get Y) |
| Credit check / override | Present on Dist sales window |
| Dist invoice + stock ↓ | Present |
| Customer ledger | API/partial UI |
| Delivery lifecycle | Minimal statuses |
| Full POD | Missing |
| Day-based aging | Missing |
| Audit trail UI | Platform-level only / incomplete Dist |
| Import Excel | Missing |

---

## 9. Related docs (staleness)

| Doc | Note |
|-----|------|
| `PHARMACY_DISTRIBUTION_REQUIREMENT_MATRIX.md` | Many `MISSING` — stale vs current code |
| `PHARMACY_DISTRIBUTION_GAP_REPORT.md` | Useful remaining gaps (mobile field, offline, report builder) |
| `PHARMACY_DISTRIBUTION_FINAL_VERIFICATION.md` | Mostly PASS; reports/mobile/offline PARTIAL |
| **This file** | Canonical audit going forward |

---

## 10. Non-negotiables for implementation

1. Do not break `/v1/pharmacy/*` contracts used by pharmacy edition  
2. Do not duplicate modules (one medicines master, Dist-branded routes OK)  
3. No fake buttons / placeholder “complete” pages  
4. Prefer extend Dist UI + deepen shared APIs  
5. Performance work must accompany feature depth  
6. Every Dist page: title, breadcrumb, primary action, loading/empty/error
