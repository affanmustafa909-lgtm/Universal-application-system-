# FINAL ERP STATUS

**Date:** 2026-09-12  
**Production readiness:** **NOT READY**  
**Phase label:** Combined Phases 10 + 11 + 12 plus leftover 0–9 gaps. **Do not mark COMPLETE.**

Supporting docs: `FINAL_PHASE_AUDIT.md`, Phase 2–9 reports.  
Suite: `backend-system/scripts/phase10-final-tests.mjs` → `docs/FINAL_PHASE_TEST_RESULTS.json` **only when executed**. That file is **absent** — the suite was **not run**.

---

## Completed / Partially completed / Blocked

| Status | Meaning |
| --- | --- |
| **Completed (code in repo)** | Feature exists and calls real APIs / engines. **Not production-verified.** |
| **Partially completed** | Real subset shipped; specified remainder missing or unverified |
| **Blocked** | Cannot finish or verify in this environment (no local Postgres, Railway CLI unauthorized, no XLSX library, no background worker) |

---

## 1. Modules completed

Code exists for these Dist modules. All remain **unverified against a deployed API**.

| Module | Status |
| --- | --- |
| Company / branch / warehouse | Partial — platform + Dist masters |
| Products / medicines | Code-complete (paged, import CSV, deactivate not hard-delete) |
| Suppliers / customers / companies | Code-complete masters + CSV import |
| Purchase / GRN / purchase invoice / PRN | Code-complete (Phase 6) |
| Batches / inventory / FEFO / ledger | Code-complete (Phase 4) |
| Transfers / adjustments / counts | Code-complete; **multi-item add** added this phase |
| Sale window / schemes / credit | Code-complete (Phase 5) |
| Invoice / sales return | Code-complete lists; invoice print is A4 summary (not full line reprint) |
| Delivery / POD | Code-complete (Phase 7) |
| Collection / recovery / aging | Code-complete (Phase 7) |
| Field force / PJP / visits / targets | Code-complete (Phase 8) |
| Finance / GL / ledgers / periods | Code-complete hooks + Dist views (Phase 9). Gross profit still N/A until Dist COGS is reliable |
| Report Center | Partial — live queries + dedicated screens; not every requested report ID is a unique query |
| Registers hub | Wired to **live lists** (not a second dataset) |
| Import / export jobs | CSV framework (see §3–4) |
| Administration hub | Hub + existing users/roles/printers/notifications |
| Audit log | List API + Dist page |
| Notifications | Existing platform center — not a new Dist engine |
| Global search | Existing `/v1/pharmacy/lookup` in Dist shell |

---

## 2. Remaining gaps

- **No deployed verification.** Suites for Phases 4–10 were not executed here.
- **XLSX not implemented.** Backend has no spreadsheet library. Templates and jobs are CSV. Excel users must Save As CSV.
- **No background export/import worker.** Exports above 10_000 rows are **rejected**. Imports above 2_000 rows are **rejected**.
- **Invoice print** does not load posted invoice lines — prints header + total.
- **Bulk selection** is on medicines + invoices only. Not every Dist table.
- **Multi-select filters** (company + warehouse + …) are not system-wide.
- **Import modules missing:** salesmen, territories, routes, PJP, price lists, schemes, warehouses, opening AR/AP, CoA, expenses.
- **Central document series admin UI** not built; numbering remains per-module sequences.
- **Invoices list** still fetches the branch set and filters in the browser.
- **Accounting hooks** after commercial commit (Phase 9) — journal is idempotent, not in the same DB transaction as the sale.
- **No fake AI** — forecasting is not implemented (correct).
- **Backup/restore** is the existing platform sync screen — **not newly tested**.

---

## 3. Import system

One service: `DistIoService` + `/v1/pharmacy/io`.

| Item | Implementation |
| --- | --- |
| Modules | medicines, customers, suppliers, companies, opening_stock |
| Templates | `GET /templates/:module` — instruction comments, required markers, example row, CSV |
| Mapping | Client maps uploaded headers → field keys; server `assertMapping` blocks unmapped required fields |
| Validation | Row-level required, duplicate SKU/barcode/customer/company, invalid company/tax, opening-stock product/warehouse/qty/expiry |
| Preview | Totals + first 25 rows + issues |
| Errors | Row messages; client can download error CSV. Commit without `importValidOnly` **fails** if any invalid row |
| Jobs | `pharmacy_io_jobs` + `pharmacy_audit_logs` |
| Opening stock | `PharmacyStockEngine.receiveBatch` + `MOVEMENT_TYPES.OPENING_STOCK` + idempotency `io-open:{jobId}:{row}` — **does not write stock totals directly** |
| File store | Client parses CSV in the browser; server receives JSON rows (no executable upload pipeline) |

---

## 4. Export system

| Item | Implementation |
| --- | --- |
| Formats | **CSV only** (honest). No XLSX/PDF server files. |
| Scopes | Client: current page / selected (medicines, invoices). Server: medicines (optional `q`), customers, invoices for the resolved branch |
| Background jobs | **Not implemented.** Job row is written **after** a synchronous export. Cap 10_000; at cap the API throws |
| Permissions | JWT + system-type + `pops.read` / Dist masters / pharmacy.view. Branch resolved server-side |

---

## 5. Multi-select / bulk operations

| Surface | Actions | Safety |
| --- | --- | --- |
| DistDataTable | Checkbox, select page, clear | Shared primitive |
| Medicines | Export selected, deactivate selected | Confirm; **status change, not hard delete** |
| Invoices | Export selected, print selected, server export filtered | **No bulk delete** |
| Inventory add | Multi-pick products then configure lines | Adjustments + transfers |
| Everywhere else | Not yet | Do not claim global bulk |

Dangerous transactional bulk delete is **not** offered.

---

## 6. Inventory changes (this phase)

- `MedicineMultiPicker`: search, tick several SKUs, add once.
- Used on **stock adjustments** and **stock transfers**.
- Batch / FEFO / ledger / GRN receive paths are unchanged Phase 4/6 engines.
- Opening-stock import uses the stock engine.

---

## 7. Reports

Catalog in `distribution/spec/reports.ts` (Sales, Recovery, Inventory, Stock, Distribution, Field, Company, Purchase, Finance, Registers, Administration, Geography).

Live **query** reports still go through `fetchDistributionReport`. Dedicated screens (`to:`) are the inventory, finance, purchase, field, admin, and register pages.

Not every name in the original 100-point list is a unique SQL report. Where a dedicated screen already holds the truth, the catalog **links** instead of inventing a second total.

---

## 8. Registers

Hub: `/pops/distribution/registers` → Sales/DO, WINV, WRN, PO, GRN, purchase invoice, PRN, delivery/POD, collection, stock transfer/adjustment/count, batches, expiry, GL, expenses, audit.

Each register **is the live list**.

---

## 9. Printing

| Document | Path |
| --- | --- |
| Sale booking slip | Existing thermal/OS `printDistBookingSlip` |
| Invoice copy | New A4 `printDistDocument` (header + total) |
| Report / selected invoices | `printDistReportDocument` HTML table |
| Kitchen / restaurant | Unchanged pops printer — **not used for Dist docs** |

PO / GRN / DO / POD / collection receipt **dedicated A4 templates are not finished**.

Print settings remain the platform printer profiles (paper size, station). No Dist-only hardcoded letterhead.

---

## 10. Admin

| Item | Where |
| --- | --- |
| Users / roles | `/pops/auth` — existing |
| Staff | Dist staff page |
| Branches | `/pops/multi-branch` |
| Warehouses | Dist warehouses |
| Settings / security / printers / tax / notifications | existing pops routes |
| Import jobs / audit / registers | Dist hub `/pops/distribution/admin` |

Predefined Dist role **labels** exist; permissions stay on the shared catalogue. Frontend never grants access.

---

## 11. Audit

`GET /v1/pharmacy/io/audit` pages `pharmacy_audit_logs`.

Tracked in this phase: import commit, export. Masters/inventory already wrote create/update/status/stock documents.

Posted journals are **reversed**, not edited (Phase 9).

Field-level old/new UI is **not** a dedicated change-diff viewer yet — JSON payloads are stored where the writer supplied them.

---

## 12. Database

| Change | Detail |
| --- | --- |
| Model | `pharmacy_io_jobs` (`packages/database-pg` + `ensure-schema.mjs`) |
| Indexes | `(organization_id, created_at)` |
| Constraints | Org FK; no unique on file name |
| Apply | **Requires `db:push` / ensure-schema on the live database** |

Earlier phase indexes (dashboard, masters, inventory, sales) remain as documented in those reports — **not re-measured here**.

---

## 13. APIs added / used

| Method | Route |
| --- | --- |
| GET | `/v1/pharmacy/io/modules` |
| GET | `/v1/pharmacy/io/templates/:module` |
| POST | `/v1/pharmacy/io/validate` |
| POST | `/v1/pharmacy/io/commit` |
| GET | `/v1/pharmacy/io/jobs`, `/jobs/:id` |
| POST | `/v1/pharmacy/io/export` |
| GET | `/v1/pharmacy/io/audit` |

Existing Dist/accounting/inventory/sale APIs were **not** replaced.

---

## 14. Performance

**No benchmark numbers.** Nothing was profiled against a live database in this environment.

Design limits only: import ≤ 2000 rows, export ≤ 10_000 rows, audit/job pagination, medicine search page size 20 in the multi-picker.

Invoice register still load-all-for-branch.

---

## 15. Security

| Check | Status |
| --- | --- |
| IO routes behind JWT + system-type + permissions | Code present |
| Unauthenticated modules list | Suite expects 401/403 — **not run** |
| Export unknown module | 400 |
| Opening stock via ledger | Code present |
| Passwords in user APIs | Not introduced |
| File execution | CSV parsed client-side; server sees JSON |
| Stack traces to UI | Dist pages show `Error.message` |
| IDOR on jobs/audit | Queries include `organizationId` |

Not a formal penetration test.

---

## 16. Testing

| Suite | Result |
| --- | --- |
| Unit / frontend | Not run this phase |
| `phase2` … `phase9` scripts | Still **not run** (no results JSON) |
| `phase10-final-tests.mjs` | **Not run** |
| E2E Company→…→Audit | **Not run** |
| Concurrency / idempotency live | **Not run** |
| Import / export / bulk / print | Code + suite authored; **not executed** |
| Accounting / inventory reconciliation | Relies on Phase 4/9 suites — **not executed** |

---

## 17. Known issues

1. Authoring environment cannot reach Postgres or Railway.
2. Schema `pharmacy_io_jobs` will 500 until migrated.
3. CSV-only import will surprise operators expecting `.xlsx`.
4. Large exports fail closed (good) but there is no queued download.
5. Invoice A4 print is not a full tax invoice reprint.
6. Bulk actions are not global.
7. Phase 9 journals can lag the commercial document if the hook fails after commit.
8. Stale `ERP_AUDIT.md` body still describes 2026-09-11 gaps.

---

## 18. Production readiness

**NOT READY.**

Why: the product is a connected pharmaceutical distribution codebase, not a mock — but **no final suite, no deploy, no E2E, no measured performance, no XLSX, no async export worker, and incomplete print/import coverage**. Shipping this as a finished OS would be dishonest.

Next gate: deploy API + `ensure-schema` / `db:push` → run `phase4` through `phase10-final-tests.mjs` → full business flow → then reassess as **READY WITH LIMITATIONS** if only XLSX/async-export remain.
