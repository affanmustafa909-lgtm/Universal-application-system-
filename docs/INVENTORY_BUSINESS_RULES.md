# Inventory Business Rules — Phase 4

**Date:** 2026-09-11
**Source:** `backend-system/api/src/pharmacy/inventory/*`, `pharmacy-stock.engine.ts`, `pharmacy-erp.service.ts`, `pharmacy.service.ts`
**Status:** Implemented and type-checked. Not deployed. None of the rules below have been exercised against a live database — see `INVENTORY_TESTING.md`.

This document states what the system does, not what it should do. Where the code is ambiguous or a documented option has no distinct implementation, that is said plainly rather than papered over.

---

## 1. FEFO allocation

`FefoService` (`fefo.service.ts`) is the only place that decides which batch a unit comes out of.

**Ordering.** Candidates are ordered `expiryDate ASC, createdAt ASC`. Expiry first — First Expiry, First Out — with the creation timestamp as a deterministic tie-break so two batches with the same expiry always allocate in the same order rather than in whatever order the planner returns. A batch with no expiry date sorts last, because `NULL` sorts last under `ASC` in PostgreSQL; unexpiring stock is therefore used only after dated stock.

**Candidate set.** A batch is a candidate when it belongs to the medicine, has `quantity > 0`, and sits in the requested warehouse *or* has no warehouse at all (`warehouse_id IS NULL` — see §11). Candidates are read with `SELECT … FOR UPDATE` whenever the caller is posting, so two concurrent sales cannot both plan against the same units.

**Exclusions.** A candidate that is visible but unusable is not silently dropped; it is returned in `excluded[]` with a reason, so the operator can see that stock exists and why it was not offered.

| Condition | Reason string | Overridable |
| --- | --- | --- |
| `status !== "active"` (`blocked`, `quarantine`, `recalled`) | `batch on hold (<status>)` | No |
| `expiryDate < today` and expired stock is not allowed | `expired` | Only by the `allowExpired` flag, which is driven by `blockExpiredSale` |

The hold check runs before the expiry check, so a batch that is both blocked and expired reports the hold.

**Preferred batch.** When the caller names a `preferredBatchId` and the branch allows FEFO override (`allowFefoOverride`, default `true`), that batch is allocated first, up to whatever it can cover, and the remainder falls through to normal FEFO order. It is *preference*, not exclusivity: an operator who picks a batch holding 10 units for a line of 40 gets 10 from that batch and 30 from the FEFO sequence, not an error. A preferred batch that is itself excluded is reported as `selected batch expired` or `selected batch on hold` and the whole line falls back to FEFO.

**Result.** `plan()` returns `{ requested, allocated, shortfall, allocations[], excluded[] }`. It never throws on a shortfall — deciding what to do about a shortfall is the caller's job under the negative-stock policy (§3). This is what makes the same planner usable for both a read-only availability quote and a posting deduction.

---

## 2. Expiry

**Derived status.** `BatchStockService` computes a single `derivedStatus` per batch with a strict priority: `expired → hold → depleted → near_expiry → active`. Expiry outranks everything because an expired batch must never read as merely "on hold" on a screen that someone scans quickly. `near_expiry` uses the branch's `nearExpiryDays` (default 90).

This priority is for display. The `status` **filter** on the batch list applies independent predicates, so filtering for `hold` still returns batches that are also expired.

**Expired stock is never automatically destroyed, moved or zeroed.** Nothing in the codebase reduces a quantity because a date passed. Expired units stay in the `quantity` (available) column and in the physical count; they are excluded from *allocation* by FEFO and reported separately as `expiredQty` and in the `expired` expiry bucket. Removing them from stock requires an explicit `expiry` adjustment, which moves the units to the `blocked` bucket and writes a ledger row naming the user who did it. Silent shrinkage is not acceptable in a pharmaceutical operation: expired stock is a regulated disposal event with a paper trail, not a background job.

A consequence worth stating: **`availableQty` includes expired units.** See `INVENTORY_ARCHITECTURE.md` §2. Any screen that shows "available" alongside "expired" is showing overlapping numbers, and the code does not pretend otherwise.

**Sale blocking.** `blockExpiredSale` (default `true`) is what sets `allowExpired: false` on the FEFO plan. With it off, expired batches become ordinary candidates and are allocated in expiry order like any other stock.

---

## 3. Negative stock policy

Configured per branch as `negativeStockPolicy` ∈ `block | warn | allow`, default **`block`**.

| Value | Behaviour in the engine |
| --- | --- |
| `block` | A deduction that cannot be fully covered throws `400` with the shortfall named, and nothing is written. |
| `warn` | The deduction proceeds and the available bucket goes negative. The shortfall is additionally raised as a server-log warning naming the product, quantity, document, and warehouse. |
| `allow` | The deduction proceeds and the available bucket goes negative, recorded in the ledger only. No log warning. |

Both non-blocking policies record the shortfall in the ledger, so stock going negative is never invisible. The difference is only in how loudly it is announced: `warn` additionally emits a `PharmacyStockEngine` warning through the Nest logger (`pharmacy-stock.engine.ts`), which is what an operator or log alert would pick up. Neither policy returns a structured warning to the HTTP caller, so a UI cannot currently render a per-line "sold into negative stock" badge — that would need a `warnings[]` on the posting response and is not implemented.

**The shortfall mechanism.** When stock is allowed to go negative, the uncovered quantity is posted as an extra ledger row against the **FEFO-nearest batch that was actually allocated**, with the idempotency key suffix `#short` and a note naming the policy that permitted it. If the FEFO plan produced no allocations at all — that is, the product has no batch with any stock in this warehouse — the deduction is rejected with a `400` even under `warn` and `allow`, because there is no batch to attribute the movement to. In practice this means negative stock is reachable only for a product that is partially short, never for one with nothing on hand.

---

## 4. Adjustment semantics

Line quantities are always entered as a **positive magnitude**. The document type decides the direction and the destination bucket, so the operator chooses an intent ("damage") rather than a sign.

| Type | Target bucket | Direction on available | Batch required | Meaning |
| --- | --- | --- | --- | --- |
| `increase` | `available` | +1 | No* | Stock found, or a correction upward. |
| `decrease` | `available` | −1 | No | Stock missing, or a correction downward. |
| `write_off` | `available` | −1 | No | Stock written off the books entirely. |
| `damage` | `damaged` | −1 | **Yes** | Physically present but unsellable. |
| `expiry` | `blocked` | −1 | **Yes** | Expired units taken out of circulation. |
| `quarantine` | `quarantine` | −1 | **Yes** | Held pending a decision (recall, inspection). |
| `release` | `available` | +1 | **Yes** | Quarantined units returned to sale. |

\* `increase` does not require a batch at the type level, but a batch-tracked medicine (`batchTrackingEnabled`) rejects a batch-less increase line with the message "*is batch tracked: select the batch the stock is being added to*". Untracked products may be increased without one.

The stored line `quantity` is **signed** by `direction`, so a report can sum line quantities across mixed documents without knowing the type. If a caller passes a `stockState` that disagrees with the type's target, the request is rejected rather than honoured — the type is authoritative.

The three `−1` types that name a non-available bucket (`damage`, `expiry`, `quarantine`) are **reclassifications**, not disposals: `moveBetweenStates` decrements `quantity` and increments the target column in the same transaction and writes two ledger legs. Physical stock is unchanged; only its saleability changed. `write_off` and `decrease` genuinely remove units.

**Reason.** Mandatory and non-blank on every adjustment, enforced with the message "*A reason is required: stock is never adjusted without one*". Also mandatory on `reject` and on a count cancellation.

**Approval.** An adjustment needs approval when the branch has `requireAdjustmentApproval: true` (the default) *and* its absolute value exceeds a positive `adjustmentApprovalThreshold`. With the default threshold of `0`, every adjustment needs approval. Setting `requireAdjustmentApproval: false` posts everything on submit. Approval and posting are the same action — `approve` posts to stock — so there is no approved-but-unposted limbo where the numbers on screen disagree with reality.

**States.** `draft → pending_approval → posted`, with `rejected` as the terminal non-posted state. There is no cancel and no un-post. A posted adjustment is corrected by posting an opposing adjustment, which leaves both documents in the ledger.

---

## 5. Transfers

State machine (`stock-transfer.service.ts`):

```
draft ──submit──▶ submitted ──approve──▶ approved ──dispatch──▶ dispatched ──receive──▶ received / completed
  │                   │                     │
  └────────────── cancel ───────────────────┘
```

**Cancellation is only possible before dispatch.** Once stock has physically left the source warehouse, the document cannot be cancelled — it can only be received, including received short. Allowing a cancel after dispatch would leave units deducted from source with nothing recording where they went.

**Stock moves exactly twice.** Nothing happens to stock on create, submit or approve; those are paperwork states. `dispatch` deducts from the source warehouse via FEFO (`TRANSFER_OUT`), and `receive` adds to the destination (`TRANSFER_IN`). Between those two events the units are in transit and belong to neither warehouse — which is correct, and means branch totals will not sum to organisation totals while a transfer is on the road.

**Availability is checked at create and again at dispatch.** The create-time check aggregates requested quantity per medicine across all lines, so ten lines of 10 against 50 in stock fails at creation rather than at dispatch. The dispatch-time check is the binding one, executed under row locks.

**Dispatch snapshot.** Dispatch records the batches actually allocated onto the transfer lines, so the receiving end knows which batch numbers and expiry dates to expect. When a line resolves to a single batch, the idempotency key is stamped on the ledger row; when it spans several, the key is omitted and the `FOR UPDATE` status guard on the header is what prevents a double dispatch.

**Cross-branch destination matching.** For a transfer to another branch, the destination medicine is resolved **by SKU** in the destination branch. SKU is the only identifier that means the same thing in both branches; medicine ids are per-branch rows. A SKU with no counterpart in the destination fails the transfer rather than creating a product silently.

**Partial receipt and shortage.** `receivedQuantity` on a receive call is the **running total** for the line, not an increment, so retrying a receive with the same numbers is harmless. `shortage = quantity − receivedQuantity`. A transfer where every line is fully received becomes `completed`; one with any shortage becomes `received`. A shortage does **not** auto-create an adjustment or write the missing units back to the source — the units are genuinely gone and reconciling them is a deliberate act with its own document and reason.

---

## 6. Stock counts

**Sheet generation.** Creating a count snapshots current stock into count lines. Only batches with `quantity > 0` are included: a count sheet listing every zero-stock SKU in the catalogue is unusable on a warehouse floor. The consequence is that a count cannot discover stock for a batch the system believes is empty; finding unrecorded stock is an `increase` adjustment.

**Scope.** A `full` count covers the warehouse. A `cycle` count accepts a scope of `companyId`, `categoryId`, `medicineIds[]` or `rackLocation`. Scope is ignored for a full count.

**5000-line cap.** A scope resolving to more than `MAX_COUNT_LINES = 5000` lines is refused with a message asking for a narrower scope. The cap protects the sheet from being generated, transmitted and paginated at a size nobody can physically count in a session, and protects the posting transaction from touching an unbounded number of batches at once.

**Status.** A new count is created as `counting`, not `draft` — the sheet exists, so the count has begun. Quantities may be recorded while the count is `draft`, `counting` or `review`.

**Uncounted lines are excluded from posting.** A line with no recorded count is treated as *not counted*, never as *counted zero*. This is the single most important rule in the count feature: the opposite interpretation would zero out every batch an operator did not reach. The detail response reports `countedLines`, `uncountedLines` and `varianceLines` separately so the state of the count is never in doubt.

**Posting.** `post` converts variances into stock adjustments — shortages into a `decrease` document and overages into an `increase` document, so up to two adjustments may be created from one count. They are created already posted, inside the same transaction as the count status change, so a count can never be marked posted while its adjustments are not. The response returns the higher-value document as `adjustmentId`. A count with no variance posts cleanly and creates nothing.

Once posted, a count is terminal. Cancellation is available on any non-posted count and requires a reason.

---

## 7. Reservations

A reservation is a real hold on stock, not a note. `reserve()` moves the quantity out of `quantity` into `reserved_quantity` on the batch rows, inserts a `pharmacy_stock_reservations` row, and writes a `RESERVATION` ledger movement. Reserved units are therefore invisible to a subsequent FEFO plan and cannot be sold twice.

Releasing has two distinct outcomes, and the difference matters:

| Mode | Effect |
| --- | --- |
| `released` | The units return to `quantity` (available). Used when a hold is abandoned, and immediately before invoicing so the invoice's own FEFO deduction can see the stock it is about to consume. |
| `consumed` | The units leave `reserved_quantity` and do **not** return to available. Used when the reserved stock has actually gone out. |

Reservations may carry an `expiresAt`. Nothing currently expires them automatically; stale active reservations are reported by `GET inventory/data-quality` under `stale_active_reservations` at `info` severity. Automatic expiry is **not implemented** — do not assume a held order releases itself.

---

## 8. Costing

Cost is resolved per batch through a fixed fallback chain, using `nullif(column, 0)` at each step so that a stored zero is treated as "no cost recorded" rather than as free stock:

1. `batches.purchase_rate_pkr` → `costSource: "batch"`
2. `medicines.cost_price_pkr` → `costSource: "product_cost"`
3. `medicines.purchase_price_pkr` → `costSource: "product_purchase"`
4. `0` → `costSource: "none"`

Under the `product_cost_price` costing method the first two steps are swapped, so the product's cost price wins over the batch rate.

Every valuation response reports `batchesMissingCost` and `fallbackUsedCount` and carries a plain-English `note` naming the basis and the fallback count. A valuation figure is never presented without saying how much of it rests on a fallback.

**The costing basis was not silently changed.** The default remains `batch_purchase_rate`, which is what the system used before Phase 4. Phase 4 added the ability to *choose* `product_cost_price` and the obligation to *report* which source each row used. Existing valuations do not move as a result of deploying this.

Cost on a ledger row is captured **at the time of the movement** and is never recomputed. Re-pricing a product does not retroactively change what last month's issues were worth.

---

## 9. Reorder formulas

Selected per branch by `reorderFormula`, default `reorder_level`. All three are described in `inventory.service.ts:927-1044`, and the response echoes the exact formula string so a report is never ambiguous about the arithmetic behind it.

| Formula | Suggest when | Suggested quantity |
| --- | --- | --- |
| `reorder_level` (default) | `availableQty <= reorderLevel` | `max(suggestedReorderQty, reorderLevel × 2 − availableQty, 0)` |
| `min_max` | `availableQty <= minStock` | `max(maxStock − availableQty, 0)` |
| `avg_consumption` | `ceil(avgDailySales × coverDays) − availableQty > 0` | `max(ceil(avgDailySales × coverDays) − availableQty, 0)` |

`coverDays = reorderLeadTimeDays + reorderSafetyDays` (default 7 + 7 = 14). `avgDailySales` is outbound units over the lookback window divided by the window length, rounded to four decimals, and is `0` when there were no sales.

**`daysOfCover` is `null` when `avgDailySales` is zero — never `Infinity`.** Dividing by zero consumption does not mean the stock lasts forever; it means cover is unknown. The row's reason says so directly: "*No recorded sales in the last N days, so days of cover cannot be calculated*". A UI that renders `∞` next to a dead SKU teaches people to ignore the column.

**Urgency.** `critical` when `availableQty <= 0`; `high` when `daysOfCover` is known and is at or below the lead time; otherwise `normal`. A product with no sales history is never `high`, because there is no evidence it will run out.

Only `active` medicines are considered.

---

## 10. Document numbering

`InventoryNumberingService` issues `TRF-<year>-<00001>`, `ADJ-<year>-<00001>` and `CNT-<year>-<00001>`. The year is **UTC**, so a document created at 23:00 local on 31 December belongs to the same year for every branch in the organisation. Sequences are per organisation, per document type, per year, with a five-digit zero-padded counter.

Numbers are allocated inside the creating transaction against a unique index. On a duplicate-key collision the allocation is retried up to five times before failing with `409`; with concurrent creation the loser re-reads the high-water mark and takes the next number. This trades a rare retry for a guarantee that two documents never share a number — a duplicate document number in an audited stock system is worse than a failed request.

---

## 11. Legacy compatibility

Phase 4 did not migrate historical data. It reads it.

**NULL-warehouse batches.** Batches created before warehouses existed have `warehouse_id IS NULL`. Every warehouse-scoped query is written as `(warehouse_id = $wh OR warehouse_id IS NULL)`, so legacy stock is visible and sellable from every warehouse in the branch rather than disappearing the day warehouse filtering shipped. These rows are surfaced as `Unassigned (legacy)` in warehouse groupings and counted by the `batch_missing_warehouse` data-quality check so they can be assigned deliberately.

**Legacy movement types.** Pre-Phase-4 rows carry lower-case types such as `sale_out` and `purchase_in`. `normalizeMovementType` maps them onto the canonical upper-case set through `LEGACY_TYPE_MAP`, and a filter on a canonical type is expanded to include its aliases, so a ledger search for `SALE` returns the full history rather than only the rows written since deployment. The raw stored value is also returned as `rawMovementType`, so nothing is hidden.

**Ledger drift on legacy data is expected.** Opening stock before Phase 4 was written directly to batch rows without a ledger movement, so the ledger net for an old product will not equal its batch sum. `GET inventory/reconcile` reports this as `ledgerDrift` with a note explaining the cause, rather than flagging historical data as corrupt.

---

## 12. Permissions

Ten new identifiers were added in `packages/contracts/src/users.ts`. Every route lists them **alongside** the pre-existing permissions with OR semantics, so no existing role loses access and no migration of role assignments is required.

| Permission | Grants |
| --- | --- |
| `inventory.view` | Read access to every inventory screen and report. |
| `inventory.manage` | Batch hold / release flagging. |
| `inventory.transfer` | Create, edit, submit, dispatch, receive and cancel transfers. |
| `inventory.transfer.approve` | Approve a submitted transfer. |
| `inventory.adjust` | Create, edit and submit adjustments. |
| `inventory.adjust.approve` | Approve (and thereby post) or reject an adjustment. |
| `inventory.count` | Create, record and cancel counts. |
| `inventory.count.post` | Post a count's variances to stock. |
| `inventory.valuation` | Inventory valuation figures. |
| `inventory.settings` | Change inventory policy. |

The approve permissions are deliberately separate from the create permissions so that segregation of duties is expressible: a storekeeper can raise an adjustment but not approve their own. **The code does not prevent the same user from doing both** when they hold both permissions — that is a role-assignment decision, not an engine check. If four-eyes enforcement is required, it needs to be added.

Legacy identifiers accepted on these routes: `pharmacy.inventory.view`, `pharmacy.inventory.manage`, `pharmacy.batch.manage`, `pharmacy.report.view`, `pharmacy.purchase.view`, `pharmacy.view`, `pops.inventory.manage`, `pops.read`.

---

## 13. Behaviour changes existing users will notice

These are the changes to **existing** workflows. Everything else in Phase 4 is additive. This list is complete as far as the code shows.

**1. Purchase returns are now logged as `PURCHASE_RETURN`, not as a sale.** Previously a return to supplier was written to the ledger with the sale-out movement type, which made it indistinguishable from a sale in movement reports and inflated sales-derived figures. It is now its own type. Historical rows are unchanged, so a report spanning the deployment date will show both. Any saved report or export that filtered on the sale type to capture returns will no longer pick them up.

**2. FEFO no longer dispenses expired stock.** With the default `blockExpiredSale: true`, an expired batch is excluded from allocation and reported in `excluded[]`. A sale that previously would have gone through on expired stock now either pulls from a later batch or fails with a shortfall. Branches that need the old behaviour can set `blockExpiredSale: false`, but the default changed.

**3. `stock_reserved` on a distribution order now really holds stock, and can fail.** Advancing an order to `stock_reserved` was previously a status change with no inventory effect. It now calls `reserve()`, which moves quantity into `reserved_quantity`. Any shortfall on any line fails the transition with a `400` naming the product, and an order that already holds a reservation returns `409` rather than reserving twice. Operators who used the status as a workflow marker will now hit real stock constraints at that step.

**4. Cancelling a reserved order returns the stock.** Previously reserved status carried no stock, so cancellation had nothing to undo and stock simply stayed where it was. Cancellation now releases the reservation as `released`, returning the units to available. This is the correct behaviour but it changes what the available figure does when orders are cancelled.

**5. Editing a medicine can no longer overwrite `currentStock`.** `updateMedicine` now accepts a `currentStock` value only when it already equals `SUM(batches.quantity)`; a differing value is rejected. `currentStock` is a cache of the batch rows, and letting a form overwrite it created drift that no ledger could explain. Stock is changed with an adjustment. Any integration or bulk-edit tool that set stock through the medicine endpoint will now be refused.

**6. Opening stock writes a ledger movement and attaches to the default warehouse.** Creating a medicine with an opening quantity now goes through `receiveBatch` with movement type `OPENING_STOCK`, reference key `opening:<id>` and batch number `OPEN-<sku>`, and the batch is attached to the branch's default warehouse instead of being created with a NULL warehouse. Opening stock is therefore visible in the ledger and in per-warehouse reports, and it reconciles. Products created before this change keep their NULL-warehouse, ledger-less opening batches.

**7. Invoicing a reserved order releases before it deducts.** The invoice path now releases the order's reservations as `released` and then runs its own FEFO deduction. The net stock effect is the same as before for an unreserved order; for a reserved one it is the difference between double-counting and not. The ledger now shows a release followed by a sale rather than a single unexplained deduction.

---

## 14. Rules that are configured but not enforced

Stated explicitly so nobody relies on them:

| Item | Status |
| --- | --- |
| `negativeStockPolicy: "warn"` | Emits a server-log warning and a ledger note, but returns no structured warning to the HTTP caller, so no UI can surface it per line. |
| Negative stock with zero on hand | Rejected with `400` under every policy, because there is no batch to attribute the movement to. |
| Reservation `expiresAt` | Stored, reported as stale, but never acted on. Nothing releases an expired reservation. |
| Ledger reversal (`reverses_movement_id`, `REVERSAL` type) | The column and the movement type exist and are read back into ledger rows, but no code path writes them. Corrections are made with opposing adjustments. **Unverified as a working feature.** |
| Four-eyes on adjustments | Not enforced in code; depends on role assignment. |
| Automatic expiry write-off | Deliberately absent. Requires a manual `expiry` adjustment. |
