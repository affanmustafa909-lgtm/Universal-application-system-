# POD Workflow — Phase 7

**Date:** 2026-09-11  
**Status:** Code-complete in API; Dist UI in progress. Not live-tested.

## Outcomes

| Status | Meaning |
| --- | --- |
| delivered | Full delivery confirmed |
| partial | Some qty delivered; remainder pending/returned on lines |
| failed | Attempt failed; re-attempt / recovery |
| refused | Customer refused; refusalReason required |

## Evidence

- `receiverName` — required for delivered (server default)
- `podNotes`, `failedReason`, `refusalReason`
- `signatureRef` / `photoRef` — schema columns for future media; UI may use text receiver only initially

## Rules

1. Never mark delivered without configured evidence (receiverName).  
2. Never silently change WINV line quantities.  
3. Sync `pharmacy_dist_orders.deliveryStatus` when POD completes.  
4. Idempotency key on POD post prevents double completion.  
5. `collectedPkr` on delivery is informational — **AR posts only via collections**.

## API

`POST /v1/pharmacy/delivery/orders/:id/pod` body: `pharmacyDeliveryPodSchema`
