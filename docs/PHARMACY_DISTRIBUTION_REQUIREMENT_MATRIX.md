# Pharmacy + Medical Distribution — Requirement Matrix

Status legend: `EXISTS` | `PARTIAL` | `MISSING` | `FIXED` | `IMPLEMENTED` | `VERIFIED` | `BLOCKED`

| ID | Requirement | Existing | Implementation | API | Database | Frontend | Test | Status | Notes |
|----|-------------|----------|----------------|-----|----------|----------|------|--------|-------|
| PH-001 | Pharmacy POS | Yes | Preserve + stock engine | `/v1/pharmacy/sales` | pharmacy_sales | PharmacyPosPage | Flow C | PARTIAL | Wave A redesign internals |
| PH-002 | FEFO batch deduct | Yes | Stock engine | sales | batches | POS | FEFO | PARTIAL | Must be transactional |
| PH-003 | Units tablet/strip/box | Yes | contracts pharmacy-units | sales | medicines | POS | unit | EXISTS | |
| PH-004 | Controlled approval | Yes | Keep + permission | sales | controlled_logs | checkout | ctrl | EXISTS | |
| PH-005 | Prescription workflow | Partial | Fix link + partial dispense | prescriptions | rx tables | PrescriptionsPage | Flow D | PARTIAL | |
| PH-006 | Shifts | Partial | Cash from paymentsJson | shifts | pharmacy_shifts | ShiftPage | shift | PARTIAL | |
| PH-007 | Khata / patients | Yes | + accounting | patients/khata | khata_entries | KhataPage | Flow F | PARTIAL | |
| PH-008 | Sale returns | Missing | Returns engine | sales/returns | sale_returns | Returns UI | Flow E | MISSING | |
| INV-001 | Warehouse master | Missing | New | warehouses | pharmacy_warehouses | Inventory nav | WH | MISSING | |
| INV-002 | Batch per warehouse | Partial | Extend batches | batches | +warehouse_id | Expiry | batch | PARTIAL | |
| INV-003 | Stock movements audit | Missing | New | movements | stock_movements | — | move | MISSING | |
| INV-004 | Stock transfer | Missing | New | transfers | stock_transfers | Transfer UI | Flow G | MISSING | |
| PUR-001 | Pharmacy PO | Missing | New | purchase-orders | pharmacy_pos | PO UI | Flow A | MISSING | |
| PUR-002 | GRN → medicine stock | Missing | New | grn | pharmacy_grns | GRN UI | Flow A | MISSING | |
| PUR-003 | Purchase return | Missing | New | purchase-returns | purchase_returns | UI | return | MISSING | |
| MD-001 | Companies | Missing | New | companies | pharmacy_companies | Companies | CRUD | MISSING | |
| MD-002 | Trade customers | Missing | New | trade-customers | trade_customers | Customers | CRUD | MISSING | |
| MD-003 | Geography | Missing | New | geo/* | territories… | Geo UI | CRUD | MISSING | |
| MD-004 | Product pricing tiers | Partial | Extend medicines | medicines | price cols | Medicines | price | PARTIAL | |
| DIST-001 | Distribution orders | Missing | New | distribution/orders | dist_orders | Orders | Flow B | MISSING | |
| DIST-002 | Wholesale invoice | Missing | New | distribution/invoices | dist_invoices | Sales | Flow B | MISSING | |
| DIST-003 | Assignments / visits | Missing | New | distribution/assignments | assignments | Assignments | Flow H | MISSING | |
| DIST-004 | Delivery / POD | Missing | New | distribution/deliveries | deliveries | Delivery | Flow I | MISSING | |
| DIST-005 | Collections | Missing | New | distribution/collections | collections | Collections | Flow F | MISSING | |
| PRC-001 | Pricing engine | Missing | New | pricing/resolve | price_lists, schemes | — | price | MISSING | |
| PRC-002 | Schemes Buy X Get Y | Missing | New | schemes | pharmacy_schemes | Schemes | scheme | MISSING | |
| ACC-001 | Sale journals | Missing | AccountingHooks | — | journal | — | Flow C | MISSING | |
| ACC-002 | Purchase journals | Missing | AccountingHooks | — | journal | — | Flow A | MISSING | |
| ACC-003 | Return journals | Missing | AccountingHooks | — | journal | — | Flow E | MISSING | |
| PERM-001 | Granular pharmacy.* | Missing | contracts users | guards | JWT | nav | perm | MISSING | |
| RPT-001 | Report catalog | Partial | Wave B | /v1/reports | — | Reports | Wave B | PARTIAL | |
| RPT-002 | Report builder | Missing | Wave B | — | — | — | Wave B | MISSING | |
| MOB-001 | Field force mobile UI | Missing | Backend first | distribution/* | — | waiter-mobile | — | BLOCKED | API-ready; UI phase later |
| OFF-001 | Offline pharmacy POS | Missing | Not in Wave A | — | — | — | — | BLOCKED | Online-only preserved |

_Update Status column as work completes._
