# Offline / Sync architecture audit

**Date:** 2026-09-12  
**Rule:** Inspect first. Do not treat the old Offline toggle or Push button as a complete platform.

---

## What existed

| Piece | Reality |
| --- | --- |
| `@platform/database-sqlite` | sql.js WASM. Tables: outbox, settings, cursors, installed_modules. **No business replica.** Bytes persisted in `localStorage["platform-sqlite-v1"]`. |
| `@platform/sync-engine` | `flushOnce` POSTs outbox to `/v1/sync/push`. **`enqueueOutbox` had zero call sites.** Comment: pull and conflicts omitted. |
| `@platform/connectivity` | `navigator.onLine` + **localStorage FIFO queues**. |
| Store / restaurant / cash / payroll | Separate localStorage queues. Flush via domain APIs, not the sync gateway. |
| Backend `/v1/sync/push` | Only `store_sale/create`. **Ignored idempotency keys.** |
| Login | Always `POST /v1/auth/login`. Session in plaintext zustand/localStorage. Expired JWT + offline **cleared the session**. |
| `main.tsx` | **Reset `platform-data-mode-v2` to cloud on every launch** — local mode could not persist. |
| Sync page pending count | Sales + POS + empty outbox. **Missed cash and payroll.** Push while offline returned zeros silently. |
| Files / devices / pull | Missing. |

## Root causes (not UI bugs)

1. UI was never local-first. Screens called the cloud API; queues were a fallback.
2. SQLite outbox was scaffolding, not the operational queue.
3. Login treated network failure as authentication failure.
4. Token refresh on cold start wiped the session when offline.
5. “Push to Cloud” was a replay of fragmented localStorage, not incremental gateway sync.
6. There was no pull, cursor, conflict table, or device registration.

## What this phase does **not** claim

- Dist/pharmacy/restaurant screens were **not** rewritten onto repositories.
- SQLite is still WASM persisted through localStorage (no Tauri `appDataDir` yet).
- Pull is a **scoped catalog slice** (org, branches, medicines, store products), not the entire ERP.
- XLSX/file blob sync is metadata-only (`sync_files` table).
- E2E offline login → work → push → pull was **not executed** in this environment.
