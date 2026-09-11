# Final phase — pre-implementation audit (Phases 10–12 + leftover 0–9)

**Date:** 2026-09-12  
**Rule:** Inspect first. `docs/ERP_AUDIT.md` (2026-09-11) is **stale** for Phases 1–9. This file is the audit used for the final combined phase.

---

## Already existed (do not rebuild)

| Area | What exists |
| --- | --- |
| Sale window | Dist orders, FEFO, schemes, credit, hold/book |
| Inventory | Stock engine, batches, ledger, transfers, adjustments, counts |
| Purchase | PR → PO → GRN → invoice → return |
| Delivery / POD / collections / recovery | Dist pages + APIs |
| Field force | Salesman / PJP / visits / targets |
| Finance | Shared `/v1/accounting` + Dist hooks (Phase 9) |
| Reports catalog | `distribution/spec/reports.ts` + `fetchDistributionReport` |
| Print | `printDistOrder.ts` + pops `printTicket` (booking slip). Restaurant/kitchen print is separate — do not merge |
| Permissions | `RequirePermissions` (OR). Backend must keep enforcing |
| Numbering | Per-module max-seq + unique + retry (inventory / purchase / delivery / field force) |
| Audit writes | `pharmacy_audit_logs` on masters/inventory |
| Notifications / users / printers | Platform `/pops/*` screens |

## Broken / incomplete / mocked before this phase

| Finding | Detail |
| --- | --- |
| Import | `DistributionImportPage` was **frontend-only CSV**, medicines+customers, 50-row cap, one-by-one `create*`. No template-from-schema. **No backend import service.** |
| Export | Client `exportRowsToCsv` of current page only |
| XLSX | **No exceljs/xlsx in backend.** CSV is the honest format. Do not fake XLSX. |
| Large export jobs | No worker process. Must not pretend background jobs exist. |
| DistDataTable | No row selection / bulk bar |
| Inventory add | Adjustments/transfers added **one product at a time** |
| Admin / audit / registers | Pages not wired (or missing). Audit table had **no list API** |
| Invoice print | Used booking/thermal slip, not an A4 document |
| Tests / deploy | Phases 4–9 suites **not run**. No local Postgres / Railway CLI in authoring env |

## Duplicates to avoid

- Second ledger / tax / AR / AP / stock engine
- Second RBAC catalogue
- Per-module import wizards
- Fake dashboard / report numbers
- Kitchen print for Dist documents

## Performance / security notes (pre-change)

- Several Dist lists still load a full branch set then filter in the browser (invoices is one).
- `RequirePermissions` is OR — frontend chips are not authority.
- Import must not execute uploaded files; JSON rows after client parse is safer than storing executables.
- Exports must stay permission-scoped on the server.
