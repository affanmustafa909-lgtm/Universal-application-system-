# Pharmacy + Medical Distribution — Gap Report

Updated after Wave A implementation.

## Existing (preserved)

- Pharmacy login, branch, POS UX, barcode, units, payments, print, Rx UI, controlled, refill, khata, shifts UI, tax enqueue, core reports pages

## Fixed in Wave A

- Sale atomicity (DB transaction)
- FEFO via PharmacyStockEngine + stock movements
- Rx↔sale `prescriptionId` on dispense
- Shift cash from Cash portions of paymentsJson
- Accounting hooks for pharmacy sale / GRN / return
- Sale returns with batch restore
- Pharmacy PO → GRN → batch stock (not restaurant ingredients)
- Companies, warehouses, geo, trade customers
- Distribution orders / invoice / delivery / collections / assignments / visits
- Pricing lists + schemes + resolvePrice
- Granular permission IDs (OR with legacy pops.*)
- Pharmacy report catalog entries (8)

## Remaining gaps

| Item | Status |
|------|--------|
| Full report builder / 100+ reports | Wave B |
| Field mobile UI | BLOCKED (API ready) |
| Offline POS | BLOCKED (online-only) |
| Transfer UI polish | PARTIAL |
| Role template remap (pharmacist≠accountant) | PARTIAL |
| Live db:push + E2E on production DB | Ops step |

## Canonical rules (unchanged)

- systemType remains `pharmacy`
- No medicines→ingredients mapping
- One accounting engine
