# Phase 2 — Testing Report

**Date:** 2026-09-11  
**Scope:** Medical Distribution PS Window command center hardening

---

## 1. Gap checklist (pre-hardening)

| Area | Status before | Status after |
|------|---------------|--------------|
| Sales KPIs (cash/credit/net/AOV/orders/invoices) | PARTIAL + metric INCORRECT | Implemented (invoice-unified) |
| Collections KPIs + achievement | PARTIAL | Implemented |
| Profitability (gated on costing) | PARTIAL | Implemented (hide if coverage &lt; 70%) |
| Stock health segments | PARTIAL | Implemented |
| Operations (held/GRN/approvals/failed DLV) | PARTIAL | Implemented |
| Field force planned/missed | PARTIAL | Implemented |
| KPI comparisons | PARTIAL / INCORRECT | Implemented (`pct` null-safe) |
| Dashboard filters + presets | MISSING | Implemented |
| URL filter state | MISSING | Implemented |
| Sales trend aggregated series | MISSING | Implemented |
| Top products COGS/margin | PARTIAL | Implemented |
| Top customers returns/collections | PARTIAL | Implemented |
| Salesman target / N/A achievement | PARTIAL | Implemented |
| Action center CRITICAL/WARNING/INFO | PARTIAL | Implemented |
| Aging + customer counts | PARTIAL | Implemented |
| Delivery status breakdown | MISSING | Implemented |
| Independent widget load/error | PARTIAL | Implemented |
| Indexes | MISSING | Documented (18) — push required |
| Automated tests | PARTIAL | Perf/security smoke script added |

---

## 2. Test artifacts

| Script | Purpose |
|--------|---------|
| `backend-system/scripts/phase2-dashboard-perf.mjs` | Latency + unauthorized + bad warehouse probes; writes `PHASE_2_PERFORMANCE.md` |
| `backend-system/scripts/distribution-lifecycle-e2e.mjs` | Existing full order-to-cash lifecycle (still valid) |

### How to run

```bash
# API must be running; credentials from seed / env
cd backend-system
node scripts/phase2-dashboard-perf.mjs

# Optional
API_BASE=https://backend-system-production-28a3.up.railway.app BRANCH_CODE=DIST-HQ node scripts/phase2-dashboard-perf.mjs
```

Apply indexes:

```bash
cd Universal-application-system-
pnpm db:push
```

---

## 3. Manual / E2E checklist

| # | Case | Expected |
|---|------|----------|
| 1 | Open PS Window | Shell + filters render; widgets load independently |
| 2 | Change preset Today → Last 30 | URL updates; all widgets refetch same filters |
| 3 | Invalid a KPI | Lands on module with focus/filter |
| 4 | Action center item | Navigates to filtered list |
| 5 | Profit with no cost data | Hidden + reason, not fake GP |
| 6 | Salesman target 0 | Achievement **N/A** (not Infinity) |
| 7 | Kill one API (devtools block) | That widget errors with Retry; others stay |
| 8 | Empty period | Empty states, not mock rows |
| 9 | No JWT | 401/403 on dashboard routes |
| 10 | Invalid warehouse UUID | 400 Bad Request |
| 11 | Complete sale then refresh | Sales/orders/invoices move |
| 12 | Collection then refresh | Collections up, outstanding down |
| 13 | Return then refresh | Returns up, net down |
| 14 | Phase 1 global search Ctrl+K | Still works |

---

## 4. Permissions

Dashboard routes require **OR** of: `distribution.orders` | `pharmacy.view` | `pops.read`  
Warehouse filter validates org (+ branch) ownership on the server.

**Known limitation:** Fine-grained “salesman may only see self” is not yet enforced via JWT claims on every dashboard filter — salesmanId is accepted as a filter for managers; tighten in Phase 11 RBAC if field roles need hard isolation.

---

## 5. Build validation

| Check | Result |
|-------|--------|
| Backend `tsc --noEmit` | Pass (after dashboard service) |
| Frontend Dist PS files | Rewritten; run launcher typecheck in CI |
| Production build | Run `pnpm build:web` / installer before release |

---

## 6. Known limitations

1. Indexes must be **pushed** to the live DB (`db:push`) before claiming DB-level speedups.  
2. Large-dataset synthetic load (50k–100k rows) was **not** generated in this pass — measure on staging after seed.  
3. Chart is CSS bars (no heavy chart library) — intentional for performance.  
4. Territory/route filters on some widgets depend on customer/delivery/assignment linkage; sparse master data → empty subsets.  
5. Full automated Playwright E2E for every widget is not in-repo yet — use perf script + lifecycle e2e + manual checklist.
