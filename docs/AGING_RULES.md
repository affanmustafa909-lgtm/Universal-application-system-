# Aging Rules — Phase 7

**Date:** 2026-09-11  
**Status:** `AgingService` implements day buckets. Aging page must use this API (not amount-risk thresholds).

## Due date

```
dueDate = invoiceDate + creditDays
```

If `creditDays` is null/0, treat dueDate = invoiceDate (or document default 0 days).

## Buckets (from today)

| Bucket | Rule |
| --- | --- |
| current | dueDate >= today (not overdue) |
| d1_30 | overdue 1–30 days |
| d31_60 | 31–60 |
| d61_90 | 61–90 |
| d91_120 | 91–120 |
| d120_plus | 121+ |

Only **positive** overdue days enter overdue buckets.

## API

- `GET /v1/pharmacy/collections/aging?branchCode=&page=&bucket=`  
- `GET /v1/pharmacy/collections/dashboard` includes overdue / due-today aggregates  
- Legacy `GET .../dashboard/recovery` also uses day buckets on invoiceDate — Dist Aging page must align

## Do not

- Calculate aging in React from raw customer outstanding alone  
- Use amount thresholds (≤0 / &lt;50k / ≥50k) as “aging”  
- Map `?focus=overdue` to an amount “watch” bucket
