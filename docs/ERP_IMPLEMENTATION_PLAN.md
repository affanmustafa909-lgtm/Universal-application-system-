# Medical Distribution ERP — Implementation Plan

**Based on:** `docs/ERP_AUDIT.md`  
**Rule:** Phase-by-phase; no dependency skipping; never mark complete if only visual.

---

## Guiding principles

1. **Evolve, don’t rewrite** — keep working Dist Sales window, geo, APIs, accounting hooks  
2. **One design system** — Dist cyan primitives; stop emerald bleed on Dist routes  
3. **Real workflows only** — every primary button posts to a real API  
4. **Speed first** — pagination, indexes, debounced search, optimistic cart before feature bloat  
5. **Shared backend** — pharmacy + distribution remain on `/v1/pharmacy` with system-type guards  

---

## Phase 0 — Audit (DONE)

- [x] Full frontend / backend / schema / performance / UX audit  
- [x] `docs/ERP_AUDIT.md`  
- [x] `docs/ERP_IMPLEMENTATION_PLAN.md`  

**Exit:** Team can navigate gaps without guessing.

---

## Phase 1 — Design system, navigation, global search, states

**Goal:** Enterprise chrome that every later module reuses.

| Work | Detail |
|------|--------|
| Dist design tokens / primitives | Page shell, breadcrumb, buttons, inputs, empty/error/loading |
| Navigation IA | Target MAIN NAV groups; **only links that already work** |
| Modules hub | Mirror IA |
| Global search | Debounced `/v1/pharmacy/lookup` in Dist shell (Ctrl/Cmd+K); remap paths to Dist routes |
| Adopt shell on PS + Modules | Prove pattern |

**Exit:** Consistent Dist chrome; searchable documents; no dead nav links.

**Out of scope:** New fake register pages; full dashboard rebuild (Phase 2).

---

## Phase 2 — PS Window / executive dashboard

**Status:** Hardened in repo (2026-09-11) — **deploy + db:push required for production verification**

- [x] Gap audit vs command-center scope  
- [x] Modular `/v1/pharmacy/distribution/dashboard/*` APIs (11)  
- [x] Invoice-unified sales + null-safe comparisons  
- [x] Profit gated on costing coverage (≥70%)  
- [x] Filters: date presets, warehouse, company, salesman, territory, route + URL state  
- [x] Sales trend aggregated points  
- [x] Top products/customers/companies/salesmen (target N/A-safe)  
- [x] Action center CRITICAL/WARNING/INFO  
- [x] Stock health, recovery aging + customer counts, delivery status, field force  
- [x] Independent widget loading / error isolation  
- [x] Schema indexes documented (18)  
- [x] Perf/smoke script + `PHASE_2_PERFORMANCE.md` / `PHASE_2_TESTING.md`  
- [ ] Production deploy of new routes verified green  
- [ ] `db:push` indexes applied on live DB  
- [ ] Post-deploy perf re-measure + large-dataset test  

**Exit:** Command center is real, filtered, and measured — not only visually present.  

---

## Phase 3 — Masters

**Status:** Foundation implemented in repo (2026-09-11) — **db:push + API deploy required**

- [x] `docs/PHASE_3_MASTER_AUDIT.md`  
- [x] Reference masters: Generic, Brand, Category, Dosage Form, Unit, Tax Profile  
- [x] Medicine master links + inventory flags + paged search/detail/status  
      (`generic_id`, `brand_id`, `category_id`, `dosage_form_id`, `unit_id`, `tax_profile_id` are
      plain uuid columns validated in the service layer, **not** database foreign keys — see
      `PHASE_3_REPORT.md` §6)  
- [x] Company / Warehouse / Trade Customer pagination + PATCH + status  
- [x] Sales-force Dist UI; Pricing items + scheme dates  
- [x] Masters hub + data quality endpoint  
- [x] CSV import scaffold  
- [x] Audit log writes on master mutations  
- [x] Dist nav Masters IA  
- [ ] Live `db:push` on production  
- [ ] Smoke green against deployed API  
- [ ] Supplier Dist-native depth (still POPS shared)  
- [ ] Document series engine (deferred)  

**Exit:** Connected, validated, searchable, paginated masters — ready for Phase 4 inventory depth.  

---

## Phase 4 — Inventory / batch / expiry / FEFO

**Status:** Implemented in repo (2026-09-11) — **API deploy required, test suite not yet run**

- [x] `docs/INVENTORY_AUDIT.md` (pre-implementation audit)  
- [x] One authoritative stock model: Branch → Warehouse → Product → Batch → State  
- [x] Stock states kept separate: available / reserved / damaged / quarantine / blocked, expired derived  
- [x] `StockAvailabilityService` as the single definition of physical / available / reserved  
- [x] Append-only stock ledger with canonical movement types + legacy alias map  
- [x] Real FEFO (`FefoService`) — expiry order, expired and on-hold batches excluded, partial preferred-batch cover  
- [x] Row locking (`FOR UPDATE`) on FEFO candidates and batch deltas — overselling closed  
- [x] Idempotency keys on GRN / invoice / returns, unique-indexed per organization  
- [x] Real reservations wired to the `stock_reserved` order status  
- [x] Stock transfers: Draft → Submitted → Approved → Dispatched → Received → Completed  
- [x] Stock adjustments with approval workflow; stock counts posting variances as adjustments  
- [x] Opening stock through the ledger instead of a direct batch insert  
- [x] Valuation, reorder, slow-moving, aging, reconciliation (read-only), data quality  
- [x] `/v1/pharmacy/inventory/*` API family, paginated and server-side searched  
- [x] 10 Dist-native inventory screens + Report Center deep links  
- [x] `inventory.*` permissions on the existing RBAC  
- [x] Phase 3 + Phase 4 DDL added to `api/scripts/ensure-schema.mjs` (self-applying on boot)  
- [x] Five docs: architecture, API, business rules, testing, performance  
- [x] `scripts/phase4-inventory-tests.mjs` written (security, stock math, FEFO, expiry, negative stock, adjustments, transfers, counts, idempotency, concurrency, returns, E2E reconciliation, performance)  
- [ ] **API deploy so the boot DDL applies the Phase 3/4 schema**  
- [ ] **Run the test suite and publish `docs/PHASE_4_TEST_RESULTS.json`**  
- [ ] Measure performance against the targets in `INVENTORY_PERFORMANCE.md`  
- [ ] Ledger reversal posting (`reverses_movement_id` is schema-only; corrections use opposing adjustments)  
- [ ] Structured negative-stock warning on the posting response (currently server-log only)  
- [ ] Reservation expiry sweeper (`expiresAt` is stored and reported, never acted on)  
- [ ] Barcode scan wiring on the new inventory screens  

**Exit:** Deployed, suite green, measured. Until then Phase 4 is code-complete but unverified.  

---

## Phase 5 — Sale Window (critical)

**Status: code-complete — deploy + test required.** Sources: `api/src/pharmacy/sales/*`, evolved `DistributionOrdersPage` + `distribution/sales/*`, contracts (`idempotencyKey`, `creditOverrideReason`), ensure-schema Phase 5 dist-order columns. Docs: `SALE_WINDOW_ARCHITECTURE.md`, `SALE_WORKFLOW.md`, `SALE_PRICING_RULES.md`, `SALE_SCHEME_RULES.md`, `SALE_PERFORMANCE.md`, `SALE_TESTING.md`. Suite: `backend-system/scripts/phase5-sale-window-tests.mjs` (**written, not run** — same deploy blockers as Phase 4).

- [x] Server-side lean product / customer / barcode search (no Sale Window load-all catalog)  
- [x] Cart quote + validate + book wrapper (`/v1/pharmacy/sales/*`)  
- [x] Scheme priority ASC + max-free tie-break; stock need = paid + free on validate/book/invoice  
- [x] Credit override requires reason + audit columns on DO  
- [x] Book idempotency key + unique index; invoice `FOR UPDATE`  
- [x] Keyboard map F2 / F4 / F7–F10 / Ctrl+N (see `SALE_WORKFLOW.md`)  
- [x] Server held drafts + localStorage emergency hold  
- [ ] Deploy API (Phase 5 DDL + routes)  
- [ ] Run `phase5-sale-window-tests.mjs` → `docs/PHASE_5_TEST_RESULTS.json`  
- [ ] Measure search / validate / book against `SALE_PERFORMANCE.md` targets  
- [ ] Held-list line payload for full resume; UI availability enrich includes free qty  
- [ ] Enforce/store `priceOverrideReason` if price override remains allowed  

**Exit:** Deployed, suite green, measured. Until then Phase 5 is code-complete but unverified.

---

## Phase 6 — Purchase

**Status in repo: code-complete.** Nest `PurchaseController` + eight purchase services registered in `pharmacy.module.ts`. Dist Purchases pages present (`distribution/purchase*`). Legacy `/purchase-orders` + `/grns` + `/purchase-returns` thin-delegate to Phase 6 services. Docs: `PURCHASE_WORKFLOW.md`, `GRN_WORKFLOW.md`, `SUPPLIER_PERFORMANCE.md`, `PHASE_6_REPORT.md`. Suite: `backend-system/scripts/phase6-purchase-tests.mjs`.

- Multi-line PO, approval, send/confirm, GRN batch entry (expiry / variance / partial / idempotency), documentary purchase invoice, returns (stock OUT)  
- Supplier performance rates from real PO/GRN/return docs (no invented scores)  
- Reorder suggestions → requisition `from-reorder` → convert to PO  
- GRN still posts JV AP via existing accounting hook; invoice post does not double AP; return AP reverse still missing  

**Still required:** deploy API (ensure-schema Phase 6 DDL) + run suite + Dist E2E. Until then: **code-complete / unverified** — see `PHASE_6_REPORT.md`.

---

## Phase 7 — Delivery / POD / Collections / Recovery

**Status:** Partially completed (2026-09-12) — **code-complete in repo**; NOT deployed; suite NOT run. See `PHASE_7_REPORT.md`.

- [x] `docs/DELIVERY_RECOVERY_AUDIT.md` + workflow docs (`DELIVERY_WORKFLOW`, `POD_WORKFLOW`, `COLLECTION_WORKFLOW`, `AGING_RULES`)  
- [x] Schema: drivers, vehicles, delivery lines, collection allocations, promises, hardened deliveries/collections + ensure-schema  
- [x] Delivery + Collections controllers/services registered in `pharmacy.module.ts`  
- [x] Dist Delivery Dashboard, Deliveries/POD, Dispatch, Collections Dashboard, multi-invoice Collections, Recovery  
- [x] Day-bucket Aging page (replaces amount-risk buckets); `?focus=overdue` fixed  
- [x] Collection AR split-brain guard (allocations required or `advance=true`)  
- [x] Suite script `backend-system/scripts/phase7-delivery-collections-tests.mjs` (not executed)  
- [ ] Deploy + suite green + Dist E2E sale→POD→collection→ledger  

**Still required:** deploy API (ensure-schema Phase 7 DDL) + run suite. Until then: **code-complete / unverified**.  

---

## Phase 8 — Field force / PJP

**Status:** Partially completed (2026-09-12) — **code-complete in repo**; NOT deployed; suite NOT run. See `PHASE_8_REPORT.md`.

- [x] `docs/FIELD_FORCE_AUDIT.md` + `FIELD_FORCE_WORKFLOW.md`  
- [x] Salesman profile extends `pops_employees` + `pharmacy_sales_force_profiles` (no second login)  
- [x] Route customer sequence + PJP versioning + idempotent daily generate  
- [x] Visit lifecycle (planned/started/completed/missed/rescheduled) + audit  
- [x] Targets + achievement (`0` → N/A); salesman/territory/route performance  
- [x] Dist dashboard / visits / PJP / targets / performance; PS Window prefers generated visits  
- [x] Suite script `backend-system/scripts/phase8-field-force-tests.mjs` (not executed)  
- [ ] Deploy + suite green + mobile E2E salesman→PJP→visit→order→collection→achievement  

**Still required:** deploy + live suite. Until then: **code-complete / unverified**. **Do not mark PHASE 8 COMPLETE.**  

---

## Phase 9 — Finance

**Status (2026-09-12): code-complete in repo / unverified.** See `FINANCE_AUDIT.md` and `PHASE_9_REPORT.md`.

- Reused `/v1/accounting` journal engine (no second ledger)  
- Dist hooks: wholesale invoice (4111), collection, WRN, purchase-return reverse  
- Dist pages: finance dashboard, GL, customer/supplier ledger, reconciliation, periods  
- Cash/bank/expenses/tax/TB/P&L/BS remain the existing accounting module  
- **Not COMPLETE** until deploy + `phase9-finance-tests.mjs` is green

---

## Phase 10 — Reports / registers / print / export

**Status (2026-09-12): partial in repo / unverified.** Combined with Phases 11–12 in the final implementation. See `FINAL_PHASE_AUDIT.md` and `FINAL_PHASE_REPORT.md`.

- [x] Report Center catalog kept live; Registers hub + Admin/Audit deep-links  
- [x] Server CSV export (medicines / customers / invoices) cap 10_000 — **no worker, no fake async job**  
- [x] A4 `printDistDocument` + existing report HTML print (booking slip remains for Sale Window)  
- [ ] XLSX / PDF server generation  
- [ ] Background export worker for 100k+ rows  
- [ ] Invoice line-item print from posted invoice lines  

---

## Phase 11 — Admin / roles / audit / import

**Status (2026-09-12): partial in repo / unverified.**

- [x] Shared `/v1/pharmacy/io` import: template → map → validate → preview → commit + job history  
- [x] Modules: medicines, customers, suppliers, companies, opening_stock (stock via ledger, not totals)  
- [x] Dist admin hub, audit list API + page, import/export jobs  
- [x] Roles remain the existing RBAC catalogue (no second engine)  
- [ ] Excel (.xlsx) parser  
- [ ] Import for every master listed in the final spec (salesmen, routes, PJP, CoA, opening balances, …)  
- [ ] Branch/warehouse access UI beyond existing platform screens  

---

## Phase 12 — Performance / security / hardening

**Status (2026-09-12): not complete.** Code hygiene only; **no measured production profile**.

- [x] Import row cap 2000; export cap 10_000 (refuse rather than load-all)  
- [x] IO + export require JWT + Dist/pharmacy system type + permissions  
- [x] Suite `backend-system/scripts/phase10-final-tests.mjs` (**not executed**)  
- [ ] Deploy + all phase suites green  
- [ ] Full E2E Company→…→Audit  
- [ ] Concurrency / idempotency live tests  
- [ ] Centralized DB document sequences  
- [ ] Pagination on every remaining load-all Dist list (invoices still client-filter a branch set)  

---

## Immediate execution order (this sprint)

1. Ship Phase 0 docs  
2. Implement Phase 1 code  
3. Smoke: Dist nav, PS page shell, global search hit → navigate  
4. Next chat/sprint: Phase 2 dashboard APIs + UI  

---

## Definition of done (any module)

UI + API + DB + validation + permissions + loading/empty/error + search/filter/pagination where applicable + print where applicable + related modules update + critical tests.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Breaking pharmacy edition | Shared APIs; Dist-only UI; regression on pharmacy POS |
| Scope explosion | Strict phase gates; no orphan pages |
| Slow search after more data | Server `q` + indexes in Phase 4/5/12 early slices |
| Timestamp doc numbers collide | Phase 12 sequences; unique constraints |
