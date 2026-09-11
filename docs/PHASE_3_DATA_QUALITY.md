# Phase 3 — Data Quality

**Date:** 2026-09-11  
**Source:** Master audit + `/v1/pharmacy/masters/data-quality` endpoint

---

## Known structural risks (pre-normalization)

| Issue | Risk | Phase 3 response |
|-------|------|------------------|
| Free-text `manufacturer` vs `companyId` | Duplicate company names ("Getz" / "GETZ Pharma") | Prefer `companyId`; keep free-text for BC; quality report flags missing company |
| Free-text generic/brand/category | Cannot report by true master | New tables + medicine FKs; migrate gradually |
| No unique SKU/barcode indexes | Duplicate products | Service-level duplicate checks; non-unique index only (safe) |
| Load-all lists | Timeout at scale | Paged `/masters/*` + Dist UI |
| Timestamp document codes | Collisions | Deferred to Phase 11/12 series engine |
| Dual Territory models | Confused geo | Keep both; Dist Geo is canonical hierarchy |

---

## Data quality API checks

`GET /v1/pharmacy/masters/data-quality?branchCode=`

Reports counts for:

- Medicines without company  
- Medicines without price (wholesale & selling = 0)  
- Medicines without unit link / unit text  
- Customers without route  
- Customers without salesman  
- Duplicate barcode candidates (sample)  
- Medicines linked to inactive companies  

**Policy:** Do **not** auto-merge or invent values. Hub alerts are actionable only.

---

## Recommended cleanup (manual / future migration)

1. Map free-text manufacturers → `pharmacy_companies` rows; set `companyId`  
2. Seed generics/brands from distinct medicine free-text values (review before bulk)  
3. Assign dosage forms from `category` enum where 1:1  
4. Enforce unique `(org, branch, sku)` after duplicate cleanup  

---

## Do not

- Auto-merge production rows named similarly  
- Reset databases  
- Drop free-text columns until all Dist screens use FKs
