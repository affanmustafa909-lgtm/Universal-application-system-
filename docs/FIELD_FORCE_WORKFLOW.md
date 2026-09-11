# Field Force Workflow

Identity is `pops_employees` + `pharmacy_sales_force_profiles`. Geography stays on the existing Province→Route tree. Customers keep `salesmanEmployeeId` / `territoryId` / `routeId`.

```
Salesman → Territory → Route (sequence) → Customer
        → PJP (versioned) → Generate visits (idempotent)
        → Start → Order (Sale Window) / Collection (Phase 7)
        → Complete → Targets / Achievement → PS Window
```

## Salesman

- Create employee first (no second login).
- Upsert field profile: territory, primary route, extra routes, daily/monthly targets, working days, status `active|inactive|suspended|on_leave`.
- Inactive/suspended cannot receive a new PJP.

## Route sequence

`pharmacy_route_customers` stores stop order. Up/down in Dist persists `sequenceNo`. Duplicate customer on the same route is rejected.

## PJP

Template + lines. Revising supersedes the old version (`status=superseded`) and creates `version+1` with `previousPjpId`. Historical visits keep the generating `pjpId` + `pjpVersion`.

Frequencies: daily, weekly, biweekly, monthly. Only the current planning date is generated — no infinite future rows.

## Visits

`planned → started → completed` or `planned → missed|cancelled` or `planned → rescheduled` (original kept, new planned row).

Complete requires outcome. Follow-up requires a date. Order/collection IDs must exist in the Dist sales/collections tables.

## Achievement

`pct = actual / target × 100` rounded to 2 decimals. Target `0` → `null` (UI **N/A**). Never Infinity.

## Permissions

`field.view|manage|pjp|visit|target` OR `distribution.field`. Salesmen can only start/complete their own visits (employee linked via `pops_employees.userId`).
