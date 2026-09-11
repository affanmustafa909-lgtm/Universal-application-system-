# Phase 2 — Dashboard Performance

**Measured:** 2026-09-11T09:16:51.199Z  
**API under test:** `https://backend-system-production-28a3.up.railway.app`  
**Branch:** `DIST-HQ`  
**Runs per endpoint:** 3

## Deploy gate (critical)

New modular routes are implemented in the local repo but **not yet deployed** to Railway at measurement time.

| Route | Production status | Avg latency observed |
|-------|-------------------|----------------------|
| `GET /v1/pharmacy/distribution/ps-window` (legacy) | **200 OK** | **511 ms** (single sample) |
| `GET /v1/pharmacy/distribution/ps-window/widgets` | **404** | n/a |
| `GET /v1/pharmacy/distribution/dashboard/*` (11 routes) | **404** | ~280–390 ms network RTT to 404 body |

**Action required:** Deploy `backend-system` (including `pharmacy-dashboard.service.ts` + controller routes) and run `pnpm db:push` for Phase 2 indexes, then re-run:

```bash
cd backend-system
API_BASE=https://backend-system-production-28a3.up.railway.app node scripts/phase2-dashboard-perf.mjs
```

Until then, treat dashboard UI as **code-complete / deploy-pending**.

---

## Request architecture (after hardening — local code)

| Metric | Value |
|--------|-------|
| Modular endpoints | 11 |
| Typical PS Window mount | 11 independent aggregate GETs |
| Full-table load to browser | **No** — server `SUM`/`COUNT`/`GROUP BY` only |
| Legacy fat endpoints kept | `ps-window`, `ps-window/widgets` (BC) |

### Before vs after

| | Before hardening | After (this branch) |
|--|------------------|---------------------|
| Shell | 1× `ps-window` (~13 SQL in parallel) | `dashboard/summary` |
| Widgets | 1× all-or-nothing `widgets` | 10 focused endpoints |
| Filters | branch only | preset + WH/company/salesman/territory/route + URL state |
| Sales basis | Mixed invoice vs order (**incorrect comparisons**) | Invoice-unified |
| Indexes | Almost none | 18 secondary indexes in schema (`PHASE_2_INDEXES.md`) |
| Widget failure isolation | One fail blanks rankings | Per-widget Retry |

---

## Production probe results (pre-deploy)

Raw JSON: `backend-system/scripts/phase2-perf-report.json`

| Endpoint | OK | Avg ms | Max ms | Notes |
|----------|----|--------|--------|-------|
| `/dashboard/summary` | no HTTP 404 | 291 | 300 | Not deployed |
| `/dashboard/sales-trend` | no HTTP 404 | 392 | 472 | Not deployed |
| `/dashboard/top-products` | no HTTP 404 | 281 | 292 | Not deployed |
| `/dashboard/top-customers` | no HTTP 404 | 285 | 299 | Not deployed |
| `/dashboard/company-performance` | no HTTP 404 | 289 | 308 | Not deployed |
| `/dashboard/salesmen` | no HTTP 404 | 278 | 286 | Not deployed |
| `/dashboard/action-center` | no HTTP 404 | 286 | 293 | Not deployed |
| `/dashboard/stock-health` | no HTTP 404 | 290 | 309 | Not deployed |
| `/dashboard/recovery` | no HTTP 404 | 344 | 398 | Not deployed |
| `/dashboard/deliveries` | no HTTP 404 | 310 | 361 | Not deployed |
| `/dashboard/field-force` | no HTTP 404 | 292 | 298 | Not deployed |
| Parallel storm (11×) | n/a | **1526 ms** | | Mostly parallel 404 RTT |

### Legacy baseline (still live)

| Endpoint | Status | Time |
|----------|--------|------|
| `/distribution/ps-window?branchCode=DIST-HQ` | 200 | **511 ms** |

Unauthorized probe against missing routes returned **404** (route absent), not 401 — re-verify **after deploy**.

Invalid warehouse UUID was rejected by local logic when routes exist; production 404 masked auth tests.

---

## Targets (post-deploy acceptance)

| Endpoint class | Target |
|----------------|--------|
| `summary` | &lt; 300 ms warm where practical |
| Rank/trend widgets | &lt; 500 ms warm |
| Parallel mount (11) | Prefer &lt; 1.5 s on staging dataset |
| Payload | Aggregates only — no raw transaction arrays |

---

## Indexes

See `docs/PHASE_2_INDEXES.md`. Must be applied with `pnpm db:push` (or equivalent) on the target database before claiming DB-level speedups.
