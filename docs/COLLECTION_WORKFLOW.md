# Collection Workflow — Phase 7

**Date:** 2026-09-11  
**Status:** Backend implemented (AR consistency fix). Dist UI in progress. Not live-tested.

## Critical rule (fixes pre-Phase-7 bug)

A collection **must** either:

1. Include `allocations[]` that cover the amount (or leave explicit `unallocatedPkr` remainder), **or**  
2. Be posted as `advance: true` (holds unallocated cash **without** reducing customer outstanding until allocated).

Posting a bare amount that only reduced `outstandingPkr` while leaving invoice `amountDue` open is **rejected**.

## Flow

```
Customer + amount + method
  → allocations to open invoices (FOR UPDATE)
  → update invoice amountPaid / amountDue / status
  → decrease customer.outstandingPkr by allocated (+ advance rules)
  → optional cheque fields
  → COL-YYYY-#####
```

## Allocation

`POST /v1/pharmacy/collections` with allocations, or  
`POST /v1/pharmacy/collections/:id/allocate` for advances.

Multi-invoice example: 100k → A 60 + B 30 + C 10.

## Cheques

Fields: chequeNumber, chequeBank, chequeDate, chequeStatus  
Transitions: pending → deposited → cleared | bounced | cancelled

## Permissions

`collection.view` | `collection.create` | `collection.allocate` OR `distribution.collections`
