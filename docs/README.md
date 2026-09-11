# Documentation

| Document | Description |
| --- | --- |
| [Offline Sync Audit](./OFFLINE_SYNC_AUDIT.md) | Why offline login / Push to Cloud was incomplete |
| [Offline Sync Report](./OFFLINE_SYNC_REPORT.md) | Universal offline/sync platform status (not complete) |
| [Getting started](./getting-started.md) | First-time setup and daily dev commands |
| [Project structure](./project-structure.md) | Monorepo layout and package responsibilities |
| [ERP Audit](./ERP_AUDIT.md) | Medical Distribution ERP — full codebase / performance / UX audit |
| [ERP Implementation Plan](./ERP_IMPLEMENTATION_PLAN.md) | Phased plan to enterprise pharmaceutical distribution OS |
| [Phase 2 Performance](./PHASE_2_PERFORMANCE.md) | Measured dashboard timings + deploy gate |
| [Phase 2 Testing](./PHASE_2_TESTING.md) | Gap checklist, smoke script, manual E2E |
| [Phase 2 Indexes](./PHASE_2_INDEXES.md) | Secondary indexes for dashboard queries |
| [Phase 3 Master Audit](./PHASE_3_MASTER_AUDIT.md) | Master completeness matrix |
| [Phase 3 Data Quality](./PHASE_3_DATA_QUALITY.md) | Normalization risks + quality API |
| [Phase 3 Testing](./PHASE_3_TESTING.md) | Masters smoke + E2E checklist |
| [Phase 3 Report](./PHASE_3_REPORT.md) | Phase 3 final report (15-point) |
| [Phase 4 Report](./PHASE_4_REPORT.md) | Phase 4 final report |
| [Phase 5 Report](./PHASE_5_REPORT.md) | Phase 5 Sale Window final report |
| [Phase 6 Report](./PHASE_6_REPORT.md) | Phase 6 Purchase final report (partially completed) |
| [Phase 7 Report](./PHASE_7_REPORT.md) | Phase 7 Delivery/POD/Collections/Recovery (partially completed) |
| [Phase 8 Report](./PHASE_8_REPORT.md) | Phase 8 Field Force (partially completed) |
| [Finance Audit](./FINANCE_AUDIT.md) | Phase 9 pre-implementation accounting audit |
| [Phase 9 Report](./PHASE_9_REPORT.md) | Phase 9 Finance (partially completed) |
| [Final Phase Audit](./FINAL_PHASE_AUDIT.md) | Pre-implementation audit for Phases 10–12 + leftovers |
| [Final Phase Report](./FINAL_PHASE_REPORT.md) | Combined final-phase status (not production-ready) |
| [Field Force Audit](./FIELD_FORCE_AUDIT.md) | Phase 8 pre-implementation audit |
| [Field Force Workflow](./FIELD_FORCE_WORKFLOW.md) | Salesman → PJP → visit → order/collection → achievement |
| [Delivery Recovery Audit](./DELIVERY_RECOVERY_AUDIT.md) | Phase 7 pre-implementation audit |
| [Delivery Workflow](./DELIVERY_WORKFLOW.md) | Delivery ticket lifecycle / dispatch |
| [POD Workflow](./POD_WORKFLOW.md) | Proof-of-delivery outcomes and rules |
| [Collection Workflow](./COLLECTION_WORKFLOW.md) | Multi-invoice allocation + advance rules |
| [Aging Rules](./AGING_RULES.md) | Day-bucket aging (dueDate = invoiceDate + creditDays) |
| [Purchase Audit](./PURCHASE_AUDIT.md) | Phase 6 pre-implementation / scaffold assessment |
| [Purchase Workflow](./PURCHASE_WORKFLOW.md) | Requisition→PO→GRN→invoice→return; status machines; permissions; numbering |
| [GRN Workflow](./GRN_WORKFLOW.md) | Batch capture, expiry, over-receive, variance, partial receive, idempotency |
| [Supplier Performance](./SUPPLIER_PERFORMANCE.md) | Real onTimeRate / fillRate / returnRate formulas |
| [Inventory Audit](./INVENTORY_AUDIT.md) | Phase 4 pre-implementation audit of the old stock code |
| [Inventory Architecture](./INVENTORY_ARCHITECTURE.md) | The authoritative stock model, services, tables, indexes, locking |
| [Inventory API](./INVENTORY_API.md) | Every `/v1/pharmacy/inventory/*` route with its permissions |
| [Inventory Business Rules](./INVENTORY_BUSINESS_RULES.md) | FEFO, expiry, negative stock, transfers, counts, costing, reorder |
| [Inventory Testing](./INVENTORY_TESTING.md) | Phase 4 suite contents and what has **not** been run |
| [Inventory Performance](./INVENTORY_PERFORMANCE.md) | Targets, indexes added, and how to measure |
| [Sale Window Audit](./SALE_WINDOW_AUDIT.md) | Phase 5 pre-implementation audit |
| [Sale Window Architecture](./SALE_WINDOW_ARCHITECTURE.md) | Lifecycle, services, idempotency, held drafts |
| [Sale Workflow](./SALE_WORKFLOW.md) | Operator flow, keyboard map, hold/book/print |
| [Sale Pricing Rules](./SALE_PRICING_RULES.md) | Exact `resolvePrice` hierarchy and source labels |
| [Sale Scheme Rules](./SALE_SCHEME_RULES.md) | Buy X Get Y, priority, paid+free stock |
| [Sale Performance](./SALE_PERFORMANCE.md) | Targets; measured = deploy required; search optimizations |
| [Sale Testing](./SALE_TESTING.md) | Phase 5 suite contents and what has **not** been run |
| [Printer guide](./printer-guide.md) | Easy setup: All Printers, Print Settings (paper size), Printer by Section, My printers |

For the high-level overview, see the root [README](../README.md).
