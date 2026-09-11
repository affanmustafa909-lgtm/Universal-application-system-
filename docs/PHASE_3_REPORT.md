# Phase 3 — Masters: Final Report

**Date:** 2026-09-11
**Status:** Code-complete in the repository and type-checked. **Never deployed, never smoke-tested against a running API, never measured.** The Phase 3 schema has not been applied to any live database. See §4, §12 and §13 — those three sections are the ones that matter before anyone treats Phase 3 as finished.
**Scope:** Medical Distribution master data — reference masters, medicine master depth, paginated master lists, masters hub, data-quality reporting, CSV import.
**Sources:** `api/src/pharmacy/pharmacy-masters.service.ts`, `pharmacy-masters.controller.ts`, `pharmacy-erp.controller.ts`, `api/scripts/ensure-schema.mjs`, `packages/database-pg/src/schema/pharmacy.ts` and `pharmacy-erp.ts`, `packages/contracts/src/pharmacy.ts` and `users.ts`, `scripts/phase3-masters-smoke.mjs`, and the launcher `distribution/` pages, `spec/nav.ts` and `routes/distributionRoutes.tsx`.

---

## 1. Masters implemented

Six new reference masters were built from nothing. Each is an organisation-scoped coded table with list / create / update / status routes, a unique `(organization_id, code)` index, and an audit-log write on every mutation.

| Master | Table | Distinct columns beyond `code` / `name` / `status` / `notes` | Service methods |
| --- | --- | --- | --- |
| Generic | `pharmacy_generics` | `description` | `listGenerics`, `createGeneric`, `updateGeneric`, `setGenericStatus` |
| Brand | `pharmacy_brands` | `company_id` → `pharmacy_companies(id)` `ON DELETE SET NULL` | `listBrands`, `createBrand`, `updateBrand`, `setBrandStatus` |
| Category | `pharmacy_categories` | `parent_id` (self-reference, **not** an FK constraint) | `listCategories`, `createCategory`, `updateCategory`, `setCategoryStatus` |
| Dosage Form | `pharmacy_dosage_forms` | — | `listDosageForms`, `createDosageForm`, `updateDosageForm`, `setDosageFormStatus` |
| Unit | `pharmacy_units` | `base_unit` | `listUnits`, `createUnit`, `updateUnit`, `setUnitStatus` |
| Tax Profile | `pharmacy_tax_profiles` | `rate_pct integer`, `tax_type text` default `percentage` | `listTaxProfiles`, `createTaxProfile`, `updateTaxProfile`, `setTaxProfileStatus` |

The generic list/create/update behaviour is shared: `listCodedMaster`, `createCodedMaster` and `updateCodedMaster` (`pharmacy-masters.service.ts:1551`, `:1576`, `:1611`) implement pagination, `code`/`name` ILIKE search, status normalisation, uniqueness checks and audit writes once for all six.

These masters closed six of the eight `MISSING` rows in `PHASE_3_MASTER_AUDIT.md`. The two still missing are **Strength** (still the free-text `dosage_strength` column on the medicine) and **Pack Size** (still the inline `tabletsPerStrip` / `stripsPerBox` columns).

### Front end

| Screen | File | Route |
| --- | --- | --- |
| Masters hub | `distribution/pages/DistributionMastersHubPage.tsx` | `distribution/masters` |
| Product masters (all six reference masters in one screen) | `distribution/pages/DistributionProductMastersPage.tsx` | mounted from the hub |
| Medicines list | `distribution/pages/DistributionMedicinesPage.tsx` | `distribution/medicines` |
| Medicine detail | `distribution/pages/DistributionMedicineDetailPage.tsx` | `distribution/medicines/:id` |
| Companies | `distribution/pages/DistributionCompaniesPage.tsx` | `distribution/companies` |
| Trade customers | `distribution/pages/DistributionTradeCustomersPage.tsx` | `distribution/trade-customers` |
| Sales force | `distribution/pages/DistributionSalesForcePage.tsx` | `distribution/sales-force` |
| Pricing (lists, items, schemes) | `distribution/pages/DistributionPricingPage.tsx` | `distribution/pricing` |
| CSV import | `distribution/pages/DistributionImportPage.tsx` | `distribution/import` |

---

## 2. Masters reused / refactored

Nothing was replaced. Every master below already existed and was deepened in place.

| Master | State before Phase 3 | What Phase 3 changed | Where |
| --- | --- | --- | --- |
| Medicine | Rich schema, thin UI, load-all list, free-text manufacturer | Six new reference-master id columns, six inventory/stock config columns, paginated `masters/medicines` search, detail endpoint with joins, soft status change instead of hard delete | `pharmacy-masters.service.ts:1173`, `:1211`, `:1297`, `:1398` |
| Company | Create + list only, no update | `listCompaniesPaged`, `updateCompany`, `setCompanyStatus`; the existing `GET companies` switches to the paged path only when `page`/`pageSize`/`q`/`status` is supplied, so old callers are unaffected | `pharmacy-erp.controller.ts:59-89` |
| Warehouse | Minimal create | `listWarehousesPaged`, `updateWarehouse`, `setWarehouseStatus`, same opt-in pagination | `pharmacy-erp.controller.ts:102-133` |
| Trade customer | Create + list + ledger, no update | `listTradeCustomersPaged`, `updateTradeCustomer`, `setTradeCustomerStatus`, same opt-in pagination | `pharmacy-erp.controller.ts:276-312` |
| Sales force | API existed; the Dist UI used HR Employees | `updateSalesForce`, `setSalesForceStatus` plus a Dist-native screen | `pharmacy-masters.controller.ts:265-279` |
| Price list | Shell create, empty items | `updatePriceList`, `listPriceListItems`, `upsertPriceListItems` | `pharmacy-masters.controller.ts:283-303` |
| Scheme | Buy X Get Y create, dates unused | `updateScheme` plus a `priority` column on `pharmacy_schemes` | `pharmacy-masters.controller.ts:305-309` |
| Supplier | Shared `pops_suppliers`, restaurant UI | **Unchanged.** Still POPS-shared; still not Dist-native. | — |
| Branch | POPS multi-branch | **Unchanged.** | — |
| Territory / Route / PJP | Dual territory models, geo CRUD | **Unchanged** by Phase 3. | — |
| Document series | Timestamp stub numbering | **Unchanged.** Deferred; Phase 4 introduced a real numbering service for `TRF`/`ADJ`/`CNT` only. | — |

The opt-in pagination pattern is worth stating plainly, because it is the reason Phase 3 could add paging without a breaking change: `GET /v1/pharmacy/companies`, `/warehouses` and `/trade-customers` return the old unpaginated array unless a paging or filter parameter is present, in which case they return `{ items, page, pageSize, total, totalPages }`. A caller that has never sent `page` sees no difference.

---

## 3. New database models

### New tables (6)

`pharmacy_generics`, `pharmacy_brands`, `pharmacy_categories`, `pharmacy_dosage_forms`, `pharmacy_units`, `pharmacy_tax_profiles`.

All six share: `id uuid PK default gen_random_uuid()`, `organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `code text NOT NULL`, `name text NOT NULL`, `status text NOT NULL DEFAULT 'active'`, `notes text`, `created_at timestamptz NOT NULL DEFAULT now()`.

### New columns on existing tables (13)

| Table | Column | Type | Purpose |
| --- | --- | --- | --- |
| `pharmacy_medicines` | `generic_id` | `uuid` | Link to `pharmacy_generics` |
| `pharmacy_medicines` | `brand_id` | `uuid` | Link to `pharmacy_brands` |
| `pharmacy_medicines` | `category_id` | `uuid` | Link to `pharmacy_categories` |
| `pharmacy_medicines` | `dosage_form_id` | `uuid` | Link to `pharmacy_dosage_forms` |
| `pharmacy_medicines` | `unit_id` | `uuid` | Link to `pharmacy_units` |
| `pharmacy_medicines` | `tax_profile_id` | `uuid` | Link to `pharmacy_tax_profiles` |
| `pharmacy_medicines` | `min_stock` | `integer NOT NULL DEFAULT 0` | Min/max stock planning |
| `pharmacy_medicines` | `max_stock` | `integer NOT NULL DEFAULT 0` | Min/max stock planning |
| `pharmacy_medicines` | `batch_tracking_enabled` | `boolean NOT NULL DEFAULT true` | Inventory config flag |
| `pharmacy_medicines` | `expiry_tracking_enabled` | `boolean NOT NULL DEFAULT true` | Inventory config flag |
| `pharmacy_medicines` | `fefo_enabled` | `boolean NOT NULL DEFAULT true` | Inventory config flag |
| `pharmacy_medicines` | `restricted_sale` | `boolean NOT NULL DEFAULT false` | Controlled/restricted product flag |
| `pharmacy_schemes` | `priority` | `integer NOT NULL DEFAULT 0` | Scheme precedence |

Every change is additive: no column was dropped, no type narrowed, no data deleted. The free-text `manufacturer`, `generic_name`, `brand_name` and `category` columns on `pharmacy_medicines` were deliberately **kept** so that no existing screen or report breaks while the FK columns fill up.

The three flags `batch_tracking_enabled`, `expiry_tracking_enabled` and `fefo_enabled` were stored by Phase 3 but not enforced by any code path at the time; that is recorded as weakness 8 in `INVENTORY_AUDIT.md`.

---

## 4. Migrations performed

**This is the most important finding in this report.**

### What actually happened

The project applies schema with `pnpm db:push` (drizzle-kit) rather than migration folders, and the API also self-applies a critical subset at boot through `api/scripts/ensure-schema.mjs`. Phase 3 added its tables and columns to the Drizzle schema in both mirrors — `backend-system/packages/database-pg/src/schema/pharmacy-erp.ts` and the matching file under `Universal-application-system-/packages/database-pg` — and then **stopped there**.

**Phase 3 had no deploy mechanism wired.** The DDL was never added to `api/scripts/ensure-schema.mjs`, which meant:

- Deploying the API did not create `pharmacy_generics`, `pharmacy_brands`, `pharmacy_categories`, `pharmacy_dosage_forms`, `pharmacy_units` or `pharmacy_tax_profiles`.
- Deploying the API did not add `generic_id` … `restricted_sale` to `pharmacy_medicines`, nor `priority` to `pharmacy_schemes`.
- Every Phase 3 route would have failed at the first query against a missing relation, on a database where nobody had run `pnpm db:push` by hand.
- `PHASE_3_TESTING.md` and `ERP_IMPLEMENTATION_PLAN.md` both carried a manual "`db:push` required" checklist item, which is exactly the kind of step that does not happen.

### How it was discovered

During Phase 4, while wiring the Phase 4 inventory DDL into the boot script, the Phase 4 work found that the script had no Phase 3 block to append to. The Phase 3 tables that Phase 4 depends on — in particular `pharmacy_medicines.min_stock`, `max_stock`, `batch_tracking_enabled`, `expiry_tracking_enabled` and `fefo_enabled`, all of which the Phase 4 availability, reorder and adjustment services read — would not have existed on a deployed database.

### What was done about it

The Phase 3 DDL is now present in `api/scripts/ensure-schema.mjs` at lines **857–941**, immediately before the Phase 4 block at lines **942–1118**. It is written as idempotent statements (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`), so a deploy self-applies it and a redeploy is a no-op.

| Statement class | Count in the Phase 3 block |
| --- | --- |
| `CREATE TABLE IF NOT EXISTS` | 6 |
| `ALTER TABLE … ADD COLUMN IF NOT EXISTS` | 13 |
| `CREATE UNIQUE INDEX IF NOT EXISTS` | 6 |
| `CREATE INDEX IF NOT EXISTS` | 4 |

Git confirms the sequencing: the whole 263-line addition to `ensure-schema.mjs` — Phase 3 block *and* Phase 4 block together — is a single uncommitted change against a file whose most recent commit predates Phase 3 entirely. The Phase 3 DDL was therefore written during Phase 4, not during Phase 3.

### Migration status, stated plainly

| Target | Phase 3 schema applied? |
| --- | --- |
| Production (Railway) | **No.** Production is running an older build. |
| Any staging database | **No.** None exists in this environment. |
| Local PostgreSQL | **No.** There is no local PostgreSQL instance and Docker is not installed. |

No migration has been performed anywhere. What exists is a mechanism that will perform it on the next deploy.

---

## 5. API endpoints added

**36 new routes** on `PharmacyMastersController` (`api/src/pharmacy/pharmacy-masters.controller.ts`), all under `@Controller("v1/pharmacy")` and all behind `JwtAuthGuard`, `PermissionsGuard` and `SystemTypeGuard` with `@RequireSystemType("pharmacy", "distribution")`.

| Group | Routes | Paths |
| --- | --- | --- |
| Overview | 1 | `GET masters/overview` |
| Data quality | 1 | `GET masters/data-quality` |
| Generics | 4 | `GET masters/generics`, `POST masters/generics`, `PATCH masters/generics/:id`, `POST masters/generics/:id/status` |
| Brands | 4 | `…/masters/brands` (same four shapes) |
| Categories | 4 | `…/masters/categories` |
| Dosage forms | 4 | `…/masters/dosage-forms` |
| Units | 4 | `…/masters/units` |
| Tax profiles | 4 | `…/masters/tax-profiles` |
| Medicines | 4 | `GET masters/medicines`, `GET masters/medicines/:id`, `PATCH masters/medicines/:id`, `POST masters/medicines/:id/status` |
| Sales force | 2 | `PATCH sales-force/:id`, `POST sales-force/:id/status` |
| Pricing | 4 | `PATCH pricing/lists/:id`, `GET pricing/lists/:id/items`, `POST pricing/lists/:id/items`, `PATCH pricing/schemes/:id` |

A further **6 routes** were added to the existing `PharmacyErpController`:

| Route | Purpose |
| --- | --- |
| `PATCH /v1/pharmacy/companies/:id` | Company update |
| `POST /v1/pharmacy/companies/:id/status` | Company activate / deactivate |
| `PATCH /v1/pharmacy/warehouses/:id` | Warehouse update |
| `POST /v1/pharmacy/warehouses/:id/status` | Warehouse activate / deactivate |
| `PATCH /v1/pharmacy/trade-customers/:id` | Trade customer update |
| `POST /v1/pharmacy/trade-customers/:id/status` | Trade customer activate / deactivate |

Plus three existing `GET` routes (`companies`, `warehouses`, `trade-customers`) that gained the opt-in paged branch described in §2.

**Pagination.** Every `masters/*` list route accepts `page`, `pageSize`, `q`, `status`, `sort` and the relevant foreign filter (`companyId`, `genericId`, `parentId`, `branchCode`) and returns `{ items, page, pageSize, total, totalPages }`. `pageSize` is clamped by `normalizePage` rather than rejected.

---

## 6. Relationships established

| From | To | Enforcement |
| --- | --- | --- |
| `pharmacy_brands.company_id` | `pharmacy_companies.id` | **Real database FK**, `ON DELETE SET NULL`, declared in both the Drizzle schema (`pharmacy-erp.ts:64`) and the boot DDL |
| `pharmacy_medicines.generic_id` | `pharmacy_generics.id` | **Service-level only** |
| `pharmacy_medicines.brand_id` | `pharmacy_brands.id` | **Service-level only** |
| `pharmacy_medicines.category_id` | `pharmacy_categories.id` | **Service-level only** |
| `pharmacy_medicines.dosage_form_id` | `pharmacy_dosage_forms.id` | **Service-level only** |
| `pharmacy_medicines.unit_id` | `pharmacy_units.id` | **Service-level only** |
| `pharmacy_medicines.tax_profile_id` | `pharmacy_tax_profiles.id` | **Service-level only** |
| `pharmacy_categories.parent_id` | `pharmacy_categories.id` | **Service-level only** (self-reference) |
| `pharmacy_medicines.company_id` | `pharmacy_companies.id` | Pre-existing, unchanged |

The distinction matters and the other Phase 3 documents blur it. `PHASE_3_MASTER_AUDIT.md` and `ERP_IMPLEMENTATION_PLAN.md` both say "Medicine FKs", but in the delivered code the six medicine reference columns are declared as bare `uuid(...)` in `packages/database-pg/src/schema/pharmacy.ts:25-30` with no `.references()` clause, and the boot DDL adds them as bare `ALTER TABLE pharmacy_medicines ADD COLUMN IF NOT EXISTS generic_id uuid` with no `REFERENCES` clause. The same is true of `pharmacy_categories.parent_id`.

This was almost certainly deliberate — adding a `NOT VALID`-free FK constraint to a populated production table is a lock risk, and a nullable dangling id is recoverable — but the consequence must be stated: **the database will not stop a medicine from pointing at a deleted or foreign-organisation generic.** Only the service layer checks. Any future bulk load that writes these columns directly bypasses that check.

The medicine detail endpoint (`getMedicineDetail`, `pharmacy-masters.service.ts:1211`) resolves and returns the joined master names, so the UI shows resolved relationships even though the constraint is not in the database.

---

## 7. Indexes added

Ten indexes, all created by the Phase 3 block of `api/scripts/ensure-schema.mjs` and mirrored in the Drizzle schema.

| Index name | Table | Columns | Kind |
| --- | --- | --- | --- |
| `pharmacy_generics_org_code_uidx` | `pharmacy_generics` | `(organization_id, code)` | UNIQUE |
| `pharmacy_brands_org_code_uidx` | `pharmacy_brands` | `(organization_id, code)` | UNIQUE |
| `pharmacy_categories_org_code_uidx` | `pharmacy_categories` | `(organization_id, code)` | UNIQUE |
| `pharmacy_dosage_forms_org_code_uidx` | `pharmacy_dosage_forms` | `(organization_id, code)` | UNIQUE |
| `pharmacy_units_org_code_uidx` | `pharmacy_units` | `(organization_id, code)` | UNIQUE |
| `pharmacy_tax_profiles_org_code_uidx` | `pharmacy_tax_profiles` | `(organization_id, code)` | UNIQUE |
| `pharmacy_categories_org_parent_idx` | `pharmacy_categories` | `(organization_id, parent_id)` | secondary |
| `pharmacy_medicines_org_branch_status_idx` | `pharmacy_medicines` | `(organization_id, branch_id, status)` | secondary |
| `pharmacy_medicines_org_company_idx` | `pharmacy_medicines` | `(organization_id, company_id)` | secondary |
| `pharmacy_medicines_org_branch_sku_idx` | `pharmacy_medicines` | `(organization_id, branch_id, sku)` | secondary |

The last three overlap with the Phase 2 index set documented in `PHASE_2_INDEXES.md`; they are asserted idempotently here so that a database which never received the Phase 2 `db:push` still gets them on deploy. `pharmacy_medicines_org_branch_sku_idx` is **not unique** — `PHASE_3_DATA_QUALITY.md` explains why (duplicate cleanup has to come first), and it is still the right call.

No unique index was added on `barcode`. Duplicate barcodes are detected and reported, not prevented (§10).

---

## 8. Import/export capabilities

### Import

One screen, `distribution/pages/DistributionImportPage.tsx`, mounted at `distribution/import`. It is **entirely client-side**: there is no server-side import endpoint, no staging table and no bulk API.

| Property | Value |
| --- | --- |
| Entities | `medicines`, `customers` (trade customers) |
| Parser | Hand-written CSV splitter in the page (`parseCsv`), handles quoted fields and doubled quotes, strips a UTF-8 BOM |
| Row cap | **50 data rows per file** — `lines.slice(1, 51)`. The UI labels this. |
| Column mapping | Auto-mapped by exact / whitespace-stripped / label match, then operator-editable per field |
| Preview | First 10 mapped rows in a table before anything is posted |
| Validation | Required-field check per row (`sku`+`name` for medicines, `code`+`name` for customers) before the request is made |
| Posting | **Sequential, one HTTP POST per row**, to the existing `POST /v1/pharmacy/medicines` and `POST /v1/pharmacy/trade-customers` endpoints — not a bulk route |
| Failure handling | Per-row, non-fatal: failures are collected with the CSV line number and the server message, and the run continues |
| Result | `{ ok, failed[] }` rendered as a summary with a scrollable failure list |
| Idempotency | **None.** Re-running the same file re-posts every row. |
| Rollback | **None.** There is no transaction across rows. |

Medicine import always posts `currentStock: 0`; opening stock is not importable through this screen.

### Export

**There is no Phase 3 export.** The shared `exportRowsToCsv` helper lives in `distribution/ui/DistUi.tsx` and is used by the invoices, aging and report-centre screens, and later by the Phase 4 inventory screens — but none of the Phase 3 master screens (Medicines, Companies, Trade Customers, Product Masters, Sales Force, Pricing) call it. Exporting a master list is not possible from the UI.

---

## 9. Permission changes

**Phase 3 added no new permission identifiers.** Every route reuses the existing catalogue in `packages/contracts/src/users.ts` with the platform's OR semantics, so no role had to be re-granted anything.

| Route class | Accepted identifiers |
| --- | --- |
| All `masters/*` reads (`overview`, `data-quality`, six reference lists, medicines list/detail) | `distribution.masters`, `pharmacy.view`, `pops.read` |
| All `masters/*` writes (create / update / status on the six masters and on medicines) | `distribution.masters`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| Company / trade-customer update + status | `distribution.masters`, `pharmacy.inventory.manage`, `pops.inventory.manage` |
| Warehouse update + status | `pharmacy.inventory.manage`, `pops.inventory.manage` — note there is **no** `distribution.masters` on these two |
| Sales force update + status | `distribution.field`, `distribution.masters`, `pops.inventory.manage` |
| Pricing list update / items read / items write / scheme update | `distribution.pricing`, `pops.inventory.manage`; the items **read** also accepts `pharmacy.view` and `pops.read` |

The warehouse asymmetry is real, not a typo in this report: a user holding only `distribution.masters` can edit companies and trade customers but not warehouses. Whether that is intended is **unverified**; nothing in the Phase 3 documents explains it.

The ten `inventory.*` identifiers were added in Phase 4, not here — see `PHASE_4_REPORT.md` §3 and `INVENTORY_BUSINESS_RULES.md` §12.

### Audit

`pharmacy_audit_logs` was an unused table before Phase 3 (defect 3 in `PHASE_3_MASTER_AUDIT.md`). `PharmacyMastersService` now writes to it: there are **25 audit write sites** in the service, covering create, update and status changes across the six reference masters, medicines, companies, warehouses, trade customers, sales force, price lists and schemes. Each row records organisation, user, action, entity type, entity id and the old/new value JSON.

---

## 10. Data quality issues found

Phase 3 did not repair data. It built the instrument that reports it and left every decision to an operator — `PHASE_3_DATA_QUALITY.md` states the policy: no auto-merge, no invented values, no database resets.

### Structural issues found and how Phase 3 responded

| Issue | Phase 3 response |
| --- | --- |
| Free-text `manufacturer` coexisting with `company_id` | Prefer `company_id`; keep the free-text column; report medicines with no company |
| Free-text generic / brand / category with no master behind them | New master tables and nullable id columns; migration left to an operator |
| No unique SKU or barcode index | Service-level duplicate checks and a duplicate-barcode report; **non-unique** SKU index only, because enforcing uniqueness before cleanup would break inserts |
| Load-all list endpoints | Server-side paged `masters/*` routes plus Dist UI paging |
| Timestamp-based document codes | Not addressed; explicitly deferred |
| Two territory models (`pharmacy_territories`, `pharmacy_geo_territories`) | Both kept; Dist Geo declared canonical |

### The data-quality endpoint, as built

`GET /v1/pharmacy/masters/data-quality?branchCode=` (`getMasterDataQuality`, `pharmacy-masters.service.ts:1473`) returns seven fields:

| Field | Query |
| --- | --- |
| `medicinesWithoutCompany` | `company_id IS NULL` |
| `medicinesWithoutPrice` | `wholesale_price_pkr = 0 AND selling_price_pkr = 0` |
| `medicinesWithoutUnit` | `unit_id IS NULL` |
| `customersWithoutRoute` | `route_id IS NULL` |
| `customersWithoutSalesman` | `salesman_employee_id IS NULL` |
| `duplicateBarcodeCandidates` | `GROUP BY barcode HAVING count(*) > 1`, top 20 by count, blank and null barcodes excluded |
| `inactiveCompanyLinkedMedicines` | inner join to `pharmacy_companies` where `status = 'inactive'` |

`branchCode` is optional; without it the counts are organisation-wide.

Two honest corrections against `PHASE_3_DATA_QUALITY.md`, which describes the endpoint slightly more generously than the code delivers:

- The document lists "Medicines without unit link / unit text". The code checks `unit_id IS NULL` only. A medicine with a populated free-text `unit` and no `unit_id` is still counted as missing — which is arguably the right behaviour for a normalisation report, but it is not what the sentence says.
- The document says the report returns "sample" ids for duplicate barcodes. The endpoint returns `{ barcode, count }` pairs and no ids, so the operator gets the barcode to search on but not a direct link to the offending rows.

`GET /v1/pharmacy/masters/overview` returns simple row counts for companies, generics, brands, categories, dosage forms, units, tax profiles, medicines, warehouses and trade customers — the hub's header numbers.

**No data-quality run has ever been executed**, because the endpoint has never been reachable (§4, §12). Every issue above is a structural finding from reading the schema and the code, not a count from a live database.

---

## 11. Tests created

One script: `backend-system/scripts/phase3-masters-smoke.mjs` (269 lines, currently untracked in git).

It is an integration smoke test, not a unit suite. It logs in against a real API, creates a linked master chain and reads it back, writing `scripts/phase3-masters-smoke-<stamp>.json` and exiting non-zero on any failure.

| # | Step | What it proves |
| --- | --- | --- |
| 1 | `login` | Credentials work; token obtained |
| 2 | `unauthorized masters blocked` | `GET masters/overview` with no token returns 401/403. A 404 is explicitly reported as "masters routes not deployed" |
| 3 | `masters overview` | Hub counts respond |
| 4 | `data quality` | Quality endpoint responds |
| 5 | `create company` | Company create |
| 6 | `create generic` | Generic create |
| 7 | `reject duplicate generic code` | The unique `(organization_id, code)` rule is enforced |
| 8 | `create brand` | Brand create with `companyId` |
| 9–11 | `create category` / `dosage form` / `unit` | Remaining reference masters |
| 12 | `create tax profile` | Tax profile with `ratePct` |
| 13 | `create medicine … then patch FKs` | Medicine create followed by `PATCH masters/medicines/:id` setting all six reference ids and two inventory flags |
| 14 | `paged medicine search` | `GET masters/medicines?q=&page=1&pageSize=10` returns the new row |
| 15 | `medicine detail joins` | `GET masters/medicines/:id` resolves |
| 16 | `deactivate medicine` | Status change is soft, not a delete |

Environment: `API_BASE` (default `http://127.0.0.1:3000`), `DIST_EMAIL` (default `admin.distribution@pops.demo`), `DIST_PASSWORD` (falls back to `SEED_USER_PASSWORD` in `backend-system/.env`, then `Owner@12345`), `BRANCH_CODE` (default `DIST-HQ`).

The negative cases listed in `PHASE_3_TESTING.md` — invalid `companyId` on a brand, unauthorised `PATCH`, `pageSize > 100` clamping, empty medicine name — are **not** in the script. They are a manual checklist. The only negative case automated is the duplicate generic code.

There is no Playwright or other UI test for any Phase 3 screen.

---

## 12. Tests passed

**None. The Phase 3 smoke script has never been executed.**

There are no results, no report JSON in `backend-system/scripts/` from a Phase 3 run, and no assertion in this repository that has been observed to pass against a running system. Every behavioural statement in the Phase 3 documents — including this one — is derived by reading source code.

### Why it has not run

| Route to a running API | Blocker |
| --- | --- |
| Local API | No API process running locally |
| Local PostgreSQL | No local PostgreSQL instance; Docker is not installed, so one cannot be started |
| Production (Railway) | Railway CLI unauthenticated from this environment; production is serving an older build without the Phase 3 routes |

Pointing the script at production today would fail at step 2 by design — the script itself treats a 404 on `masters/overview` as "masters routes not deployed", which is precisely the current state.

### A defect in the script itself, found by reading it

`phase3-masters-smoke.mjs:200-210` posts `wholesalePricePkr: 100` and `sellingPricePkr: 120` to `POST /v1/pharmacy/medicines`. The contract for that route, `createMedicineSchema` (`packages/contracts/src/pharmacy.ts:417-436`), declares `wholesalePrice`, `sellingPrice`, `purchasePrice` and `costPrice` — without the `Pkr` suffix. Zod strips unknown keys, so **the test medicine would be created with all prices at zero.**

The script never asserts on price, so it would still report PASS. The consequence is narrower than the identical defect found in the Phase 4 suite (`PHASE_4_REPORT.md` §8), where zero prices would have silently hollowed out the valuation assertions — but it is the same bug, it is still present in the Phase 3 script, and it should be fixed before the first run so that the smoke chain leaves usable data behind.

### What has to happen to get a result

1. Deploy the API, which is now what applies the Phase 3 DDL (§4). Confirm the ensure-schema block ran in the boot log and that `pharmacy_generics`, `pharmacy_brands`, `pharmacy_categories`, `pharmacy_dosage_forms`, `pharmacy_units` and `pharmacy_tax_profiles` exist.
2. Fix the price field names in the script.
3. Run it:

```powershell
cd "d:\My POS SYSTEMS REPOS\backend-system"
$env:API_BASE = "https://backend-system-production-28a3.up.railway.app"
$env:BRANCH_CODE = "DIST-HQ"
node scripts/phase3-masters-smoke.mjs
```

4. Work through the manual E2E chain and the negative cases in `PHASE_3_TESTING.md`, which the script does not cover.

Note that the script, like the Phase 4 suite, only creates and never deletes. Running it against production leaves permanent `GEN-`, `BR-`, `CAT-`, `DF-`, `UN-`, `TAX-`, `COM-` and `MED-` rows behind.

---

## 13. Performance measurements

**No performance measurement of Phase 3 exists. Not one number.**

There is no Phase 3 performance script — `PHASE_2_PERFORMANCE.md` exists because `scripts/phase2-dashboard-perf.mjs` was written and run against a live URL; Phase 3 has no equivalent. The smoke script records pass/fail only and does not time anything.

No latency figure for any `masters/*` endpoint appears in any document, and none should be invented. The blockers are the same three as §12.

What can be stated without measuring, because it is visible in the code:

| Change | Expected effect | Measured? |
| --- | --- | --- |
| `masters/*` list routes are paginated and searched in SQL | Response size bounded by `pageSize` instead of catalogue size | No |
| Opt-in paging on `companies` / `warehouses` / `trade-customers` | Only helps callers that pass `page`; the default path is still load-all | No |
| `pharmacy_medicines_org_branch_sku_idx`, `…_org_branch_status_idx`, `…_org_company_idx` | SKU lookup and branch catalogue filters served by index | No — and the indexes do not exist on any live database yet |
| `GET /v1/pharmacy/medicines` (legacy) | **Unchanged.** Still returns the entire catalogue. The Dist Sales window and several shared pharmacy screens still use it. | No |

The last row is the honest headline: Phase 3 added fast paths, it did not remove the slow ones. Phase 4 superseded the load-all inventory reads (`INVENTORY_PERFORMANCE.md` §4) but the medicines catalogue endpoint is still load-all for its remaining callers.

Once a deploy has happened, the `EXPLAIN ANALYZE` discipline in `INVENTORY_PERFORMANCE.md` §7 should be applied to the paged `masters/medicines` query before any speed claim is made.

---

## 14. Known limitations

1. **Nothing is deployed and nothing is tested.** §4, §12 and §13. This outranks everything else on this list.
2. **The six medicine reference links are not database foreign keys.** Only `pharmacy_brands.company_id` is enforced by the database. §6.
3. **Strength and Pack Size never became masters.** `dosage_strength` is still free text; `tabletsPerStrip` / `stripsPerBox` are still inline columns.
4. **Supplier is still POPS-shared.** The Dist edition still uses the restaurant supplier UI. Carried forward to Phase 6 / Phase 11.
5. **Document series is still a timestamp stub.** `nextRef` remains collision-prone for orders, invoices, GRNs and deliveries. Phase 4 introduced a real allocator for `TRF` / `ADJ` / `CNT` only; every other document type is untouched. Deferred to Phase 12.
6. **Free-text and FK columns coexist indefinitely.** Reports written against `manufacturer`, `generic_name`, `brand_name` or `category` will disagree with reports written against the id columns until someone migrates the data. There is no migration tool — `PHASE_3_DATA_QUALITY.md` describes the cleanup as manual.
7. **CSV import is capped at 50 rows, client-side, non-transactional and non-idempotent.** §8. It is a scaffold, not an import engine. Phase 11 owns the real wizard.
8. **No master export.** §8.
9. **No unique constraint on barcode or on `(organization_id, branch_id, sku)`.** Duplicates are reported, not prevented. §7, §10.
10. **The data-quality endpoint reports counts, not actionable row ids** (except duplicate barcodes, which return the barcode value). An operator has to go and search.
11. **Automated negative-case coverage is one test.** The rest of `PHASE_3_TESTING.md`'s negative matrix is a manual checklist.
12. **Medicine detail sales/purchase history tabs were stubs** at the end of Phase 3. Phase 4's `GET /v1/pharmacy/inventory/stock/:medicineId` now returns real `purchaseHistory` and `salesHistory` arrays, but wiring the Phase 3 medicine detail screen to them is **unverified** — the Phase 4 product inventory page at `distribution/inventory/product/:medicineId` is a separate screen.
13. **The warehouse update/status routes omit `distribution.masters`.** §9. Possibly intentional, undocumented either way.
14. **`batch_tracking_enabled`, `expiry_tracking_enabled` and `fefo_enabled` were stored but not enforced by Phase 3.** Phase 4 began enforcing `batch_tracking_enabled` on adjustment lines; `fefo_enabled` and `expiry_tracking_enabled` remain stored-but-unenforced as far as the code shows.

---

## 15. Phase 4 recommendation

Phase 3's exit criterion was "connected, validated, searchable, paginated masters — ready for Phase 4 inventory depth", and on the code that is met: the medicine master now carries the stock-control configuration (`min_stock`, `max_stock`, `batch_tracking_enabled`, `expiry_tracking_enabled`, `fefo_enabled`) that an inventory engine needs, and warehouses and companies are addressable with real update and status routes.

The recommendation made at the end of Phase 3 was to build inventory depth next: a single authoritative stock model with batches, expiry, FEFO, transfers, adjustments and counts, replacing the shared pharmacy inventory and expiry screens with Dist-native ones.

**Phase 4 has since been implemented.** It is documented in full in **`PHASE_4_REPORT.md`**, with supporting detail in `INVENTORY_AUDIT.md`, `INVENTORY_ARCHITECTURE.md`, `INVENTORY_API.md`, `INVENTORY_BUSINESS_RULES.md`, `INVENTORY_TESTING.md` and `INVENTORY_PERFORMANCE.md`.

Three things Phase 4 did that bear directly on Phase 3:

1. **It fixed Phase 3's deploy gap.** The Phase 3 DDL now sits in `api/scripts/ensure-schema.mjs` immediately above Phase 4's. One deploy applies both. §4.
2. **It consumes the Phase 3 configuration columns.** `min_stock` and `max_stock` drive the `min_max` reorder formula and the `low` stock state; `batch_tracking_enabled` gates batch-less adjustment increases. Phase 3's flags stopped being decorative.
3. **It inherited Phase 3's untested status rather than clearing it.** Phase 4 is also code-complete, type-checked and undeployed. The two phases now share one blocker and one unblocking action.

### What to do next, in order

1. **Deploy the API.** This applies the Phase 3 and Phase 4 DDL in one boot. Nothing else on this list is possible first.
2. Confirm in the boot log that the ensure-schema block ran, and verify the six Phase 3 tables and the thirteen new columns exist.
3. Fix the price field names in `phase3-masters-smoke.mjs` (§12), then run it.
4. Run `node scripts/phase4-inventory-tests.mjs` (`PHASE_4_REPORT.md` §11).
5. Walk the manual Phase 3 E2E chain and negative cases in `PHASE_3_TESTING.md`.
6. Only then update `ERP_IMPLEMENTATION_PLAN.md`, which currently carries unticked deploy and smoke boxes for both Phase 2 and Phase 3, and replace §12 and §13 of this report with real results.

Until step 1 happens, Phase 3 and Phase 4 are both **code-complete and unverified**, and neither should be described any other way.
