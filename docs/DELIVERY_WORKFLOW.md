# Delivery Workflow — Phase 7

**Date:** 2026-09-11  
**Status:** Implemented in repo. Not deployed. Not behaviourally tested.  
**Source:** `backend-system/api/src/pharmacy/delivery/*`, Dist delivery pages

## Lifecycle (delivery ticket)

```
pending / ready
  → assign driver/vehicle/route
  → dispatched
  → out_for_delivery
  → delivered | partial | failed | refused | cancelled
```

Warehouse pick/pack/ready still live on **dist order** `advance` (Sale Window / orders pipeline). The delivery ticket is the **field POD** document linked to invoice/order.

## Create

Prefer `POST /v1/pharmacy/delivery/orders` with `invoiceId` (or orderId). Copies customer; creates lines from invoice lines when present. Idempotency key supported.

## Dispatch

`POST .../dispatch` with `{ ids: uuid[] }` — bulk. Sets `dispatchedAt`, syncs order `deliveryStatus`.

## POD

`POST .../orders/:id/pod`

| Outcome | Requires |
| --- | --- |
| delivered | receiverName (default) |
| partial | line delivered/returned qtys + notes |
| failed | failedReason |
| refused | refusalReason |

Does **not** rewrite invoice quantities. Stock returns use existing wholesale return path when needed.

## Numbering

`DeliveryNumberingService`: `DLV-YYYY-#####` with unique-index retry (replaces Date.now for new creates).

## Permissions

`delivery.view` | `delivery.manage` | `delivery.dispatch` | `delivery.pod` OR `distribution.deliveries`
