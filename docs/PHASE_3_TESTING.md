# Phase 3 — Testing

**Date:** 2026-09-11

---

## Artifacts

| Item | Location |
|------|----------|
| Master audit | `docs/PHASE_3_MASTER_AUDIT.md` |
| Data quality notes | `docs/PHASE_3_DATA_QUALITY.md` |
| Smoke script | `backend-system/scripts/phase3-masters-smoke.mjs` |
| Backend service | `api/src/pharmacy/pharmacy-masters.service.ts` |
| Dist UI | `apps/launcher/src/distribution/pages/Distribution*Master*`, Medicines, Import |

---

## How to run smoke

```bash
cd backend-system
# API must be running with Phase 3 code deployed + schema pushed
node scripts/phase3-masters-smoke.mjs

API_BASE=http://127.0.0.1:3000 BRANCH_CODE=DIST-HQ node scripts/phase3-masters-smoke.mjs
```

Requires: login, branch, permissions for `distribution.masters` / `pharmacy.manage`.

Schema apply:

```bash
cd Universal-application-system-
pnpm db:push
```

---

## Manual E2E master chain

1. Create Generic, Brand (with company), Category, Dosage Form, Unit, Tax Profile  
2. Create Medicine with FKs + prices + inventory flags  
3. Search medicine by name/sku (paged)  
4. Open drawer → View Full detail  
5. Deactivate medicine → status inactive; list filter  
6. Create/update Trade Customer with credit + route  
7. Create Price List item for medicine  
8. Create Scheme with date range  
9. Assign Sales Force profile  
10. Open Masters hub — overview counts + quality alerts  
11. CSV import preview with deliberate bad row — must show failure  
12. Confirm Phase 2 PS Window still loads  

---

## Negative cases

| Case | Expected |
|------|----------|
| Duplicate generic code | 400 |
| Invalid companyId on brand | 400 |
| Unauthorized PATCH | 401/403 |
| pageSize > 100 | clamped |
| Empty medicine name | 400 |
| Deactivate referenced medicine | soft status (not hard delete) |

---

## Known gaps (honest)

- Full Playwright suite not added  
- Supplier remains POPS shared UI (not Dist-native depth)  
- Document series still timestamp stub  
- Sales/purchase history tabs on medicine detail are stubs until Phase 4/5  
- Production must **deploy API + db:push** before smoke passes on Railway
