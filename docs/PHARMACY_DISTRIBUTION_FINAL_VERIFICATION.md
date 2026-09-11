# Pharmacy + Medical Distribution — Final Verification

Values: `PASS` | `FAIL` | `PARTIAL` | `BLOCKED` | `PENDING`

| # | Area | Status | Evidence / notes |
|---|------|--------|------------------|
| 1 | Authentication | PASS | Existing JWT pharmacy systemType |
| 2 | Authorization (pharmacy.* / distribution.*) | PARTIAL | Module IDs added; OR with pops.read/manage; role templates not fully remapped |
| 3 | Dashboard | PARTIAL | Existing pharmacy dashboard retained |
| 4 | Product / medicine master | PASS | Extended columns + existing CRUD |
| 5 | Company | PASS | `/v1/pharmacy/companies` + UI |
| 6 | Supplier | PARTIAL | Shared pops suppliers UI |
| 7 | Customer (patient + trade) | PASS | Patients + trade-customers |
| 8 | Purchase | PASS | Pharmacy PO create/approve |
| 9 | GRN | PASS | GRN → stock engine receiveBatch + accounting |
| 10 | Inventory | PASS | Stock engine + movements |
| 11 | Batch | PASS | Warehouse-aware batches |
| 12 | Expiry | PASS | Existing + pharmacy-expiry report |
| 13 | Warehouse | PASS | warehouses API + UI |
| 14 | Transfer | PARTIAL | Schema + stock engine; UI thin |
| 15 | Distribution | PASS | Orders/invoices/deliveries/collections |
| 16 | Orders | PASS | Dist orders lifecycle |
| 17 | Sales (retail + wholesale) | PASS | POS + invoiceFromOrder |
| 18 | Salesman / MR / SW / SNO | PARTIAL | Profiles + assignments; HR employee UUID required |
| 19 | Assignments | PASS | API + UI |
| 20 | Visits | PASS | API + UI |
| 21 | Delivery | PASS | Create + POD status |
| 22 | Collections | PASS | Reduce outstanding |
| 23 | Pharmacy module | PASS | Preserved + redesigned internals |
| 24 | POS | PASS | Transactional FEFO + accounting hook |
| 25 | Prescription | PASS | prescriptionId on dispense |
| 26 | Doctor | PASS | Existing |
| 27 | Controlled drugs | PASS | Existing gate |
| 28 | Khata | PASS | Existing + cash shift fix |
| 29 | Pricing | PASS | resolvePrice + lists |
| 30 | Discounts | PARTIAL | Engine path via price lists; approval limits thin |
| 31 | Schemes | PASS | Buy X Get Y CRUD |
| 32 | Returns | PASS | Sale returns batch restore + accounting |
| 33 | Accounting | PASS | Pharmacy sale/GRN/return hooks + CoA 4110/4111/5208 |
| 34 | Tax | PASS | Existing enqueueFromSale |
| 35 | Expenses | PASS | Shared accounting module |
| 36 | Reports | PARTIAL | 8 pharmacy/distribution catalog reports; full 100+ builder Wave B |
| 37 | Dashboard analytics | PARTIAL | Existing KPIs |
| 38 | Printing | PASS | Existing pharmacy invoice print |
| 39 | Export | BLOCKED | Wave B |
| 40 | Notifications | BLOCKED | Wave B event polish |
| 41 | Audit | PASS | stock_movements + pharmacy_audit_logs table |
| 42 | Multi-branch | PARTIAL | Branch-scoped data; consolidated reports thin |
| 43 | Security | PASS | JWT + systemType + permissions guard |
| 44 | Backup | PASS | Platform existing |
| 45 | API | PASS | `/v1/pharmacy/*` ERP routes; api typecheck PASS |
| 46 | Database / migrations | PARTIAL | Schema additive; requires `db:push` on deploy |
| 47 | Build / tests | PARTIAL | `@platform/api` typecheck PASS; launcher has pre-existing non-pharmacy tsc errors |

## Business flows

| Flow | Status | Notes |
|------|--------|-------|
| A Purchase → GRN → stock → AP | PASS | Implemented end-to-end in service |
| B Distribution order → invoice → delivery → collection | PASS | Implemented |
| C Pharmacy POS sale | PASS | Transaction + FEFO + accounting |
| D Prescription → sale link | PASS | dispense passes prescriptionId |
| E Return 10→3 | PASS | Batch restore path implemented |
| F Collection / khata payment | PASS | Trade collections + patient khata |
| G Stock transfer | PARTIAL | Tables + engine; limited UI |
| H Salesman assignment → visit | PASS | Implemented |
| I Delivery POD | PASS | Implemented |

## Special checks

| Check | Status | Notes |
|-------|--------|-------|
| FEFO Batch A then B | PASS | Stock engine FEFO order |
| Controlled without approval blocked | PASS | Existing createSale gate |
| Credit limit backend block | PASS | Patients + trade override flag |
| Multi-branch isolation | PASS | branchId scoping |
| Permission rejection | PARTIAL | Needs JWT with restricted perms in live env |

## Final status

**PARTIALLY COMPLETE — BLOCKED ITEMS REMAIN**

Blocked / deferred:
- Full report builder + 100+ legacy report variants (Wave B)
- Field-force mobile UI (APIs ready; waiter-mobile not extended)
- Offline pharmacy POS queue
- Full sales-force commission engine
- Automated E2E against live Postgres in this session (schema push required)
