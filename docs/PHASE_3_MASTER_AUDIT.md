# Phase 3 — Master Data Audit

**Date:** 2026-09-11  
**Scope:** Medical Distribution masters (frontend Dist + Pharmacy shared + Nest `/v1/pharmacy`)

---

## Status matrix

| Master | Status | Notes |
|--------|--------|-------|
| Medicine | **PARTIAL → NEEDS REFACTOR** | Rich schema; thin UI; load-all; hard delete; free-text manufacturer |
| Generic | **MISSING** | Free-text `generic_name` only |
| Brand | **MISSING** | Free-text `brand_name` only |
| Company | **PARTIAL** | Create+list; no update; unused schema fields |
| Category | **PARTIAL** | Hardcoded enum / free text — not a master table |
| Dosage Form | **MISSING** | Overlaps with category/presentation |
| Strength | **MISSING** | Free-text `dosage_strength` |
| Unit | **MISSING** | Free-text `unit` |
| Pack Size | **PARTIAL** | Inline `tabletsPerStrip` / `stripsPerBox` |
| Supplier | **PARTIAL** | Shared `pops_suppliers`; Dist reuses restaurant UI |
| Customer (trade) | **PARTIAL** | Create+list+ledger; no update; load-all |
| Warehouse | **PARTIAL** | Minimal create |
| Branch | **COMPLETE** | POPS multi-branch |
| Price List | **PARTIAL** | Shell create; empty items |
| Tax (pharma profile) | **MISSING** | `tax_pct` on medicine only |
| Scheme | **PARTIAL** | Buy X Get Y create; dates unused |
| Salesman / sales-force | **BROKEN** | API exists; Dist UI uses HR Employees |
| Territory | **DUPLICATED** | Legacy `pharmacy_territories` + `pharmacy_geo_territories` |
| Route | **PARTIAL** | Geo CRUD; includes `pjpDayOfWeek` |
| PJP | **PARTIAL** | Attribute on route — not a calendar master |
| Document series | **BROKEN** | Prefix catalog; timestamp stub numbering |

---

## Cross-cutting defects (Phase 0 confirmed)

1. **Load-all** list APIs — no `page` / `pageSize` / `total`  
2. **No update/deactivate** on most ERP masters  
3. **`pharmacy_audit_logs` unused** (no writes)  
4. **No CSV/Excel import**  
5. **No unique indexes** on org+code / barcode  
6. Free-text vs FK dual paths (manufacturer vs companyId)  

---

## Phase 3 implementation priority

| Wave | Work |
|------|------|
| A | Reference masters: Generic, Brand, Category, Dosage Form, Unit, Tax Profile |
| B | Medicine master links + paginated search + detail/drawer + soft deactivate |
| C | Company / Warehouse / Trade Customer update + credit summary |
| D | Sales-force Dist UI; Price list items; Scheme dates |
| E | Masters hub + data quality report + import scaffold |
| F | Audit writes + unique codes + docs/tests |

**Out of scope (Phase 4+):** FEFO stock engine depth, transfers, expiry actions, full PJP calendar.

---

## File map

| Area | Path |
|------|------|
| Medicine schema | `packages/database-pg/src/schema/pharmacy.ts` |
| ERP masters schema | `…/pharmacy-erp.ts` |
| Controllers | `api/src/pharmacy/pharmacy*.controller.ts` |
| Dist nav | `apps/launcher/src/distribution/spec/nav.ts` |
| Thin ERP pages | `apps/launcher/src/pharmacy/pages/PharmacyErpPages.tsx` |
| Medicines UI | `apps/launcher/src/pharmacy/pages/MedicinesPage.tsx` |
