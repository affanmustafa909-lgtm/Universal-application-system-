# Universal Offline / Sync Platform — status

**Date:** 2026-09-12  
**Production readiness:** **NOT READY**  
**Rule:** Do not mark complete until offline login → offline work → reconnect → push → pull → conflict → verification is tested on a deployed API.

---

## Architecture (implemented foundation)

```
UI  →  existing modules (unchanged business engines)
        → local queues + SQLite outbox / local_documents
             → SyncEngine push/pull
                  → /v1/sync/*  →  PostgreSQL (central)
```

The UI is **not** fully repository-local-first yet. POS queues still exist. The new layer sits **under** them.

---

## Completed in repo (unverified)

| Item | Notes |
| --- | --- |
| Stop resetting data mode on every launch | `main.tsx` no longer overwrites `platform-data-mode-v2` |
| Session survives offline token refresh failure | `bootstrapSession` / `authFetch` keep claims; mark offline |
| Offline login for **previously authenticated** users | PBKDF2 verifier in SQLite `offline_identities` — **not** the raw password |
| First-time user | Offline login refused until one successful online login |
| Device id | `platform-device-id-v1` + `POST /v1/sync/register-device` |
| Durable outbox columns + history/conflicts/files/documents | SQLite v2 migrations |
| Gateway APIs | push (idempotent), pull (delta cursor), status, register-device, initialize, resolve |
| Sync Center | `/pops/sync` — Sync now / Push / Pull / connection mode / pending of **all** queues |
| Status chip | Online / Offline / Syncing / Local only / Sync error |
| Connection vs sync | Separate: internet state ≠ sync state ≠ local-only mode |
| Conflict policy table | Per-entity strategy constants; open conflicts stored locally |
| Capability matrix | Config in `offlineCapability.ts`, shown on Sync Center |

## Partial

| Item | Limitation |
| --- | --- |
| Push | Gateway handles `store_sale/create` with idempotency. Restaurant/cash/payroll still replay domain APIs. |
| Pull | Org + branches + 200 medicines + 200 store products since cursor. Not Dist inventory/sales. |
| Local-first UI | Dist/POS screens still hit live APIs when a token is valid. |
| File sync | Table exists; no blob upload worker. |
| Workspace folders | Browser/PWA cannot use OS Application Data. WASM SQLite only. |
| Encryption | Verifier is salted PBKDF2. Tokens still in localStorage + SQLite. No OS keychain. |
| Device revoke | Server status `revoked` exists; admin UI to revoke is not built. |
| Backup/restore | Not implemented. |

## Blocked / not tested

- No local Postgres / Railway in the authoring environment.
- `sync_applied_mutations` / `sync_devices` require `ensure-schema` / `db:push`.
- Suite `backend-system/scripts/sync-platform-tests.mjs` **not run**.
- Power-fail / crash / multi-device / 100k catalog tests **not run**.

## Security notes

- Raw password is **not** stored.
- Offline authorization TTL: **7 days** from last online login.
- Expired offline profile requires online sign-in.
- Fake JWT is **not** minted. Offline session reuses the last real tokens and refuses cloud calls when they cannot be refreshed.

## How to verify (when API is up)

1. Online login → confirm `offline_identities` row and device register.
2. Disconnect → close app → reopen → login with same password → enter app.
3. Create a store sale while offline → pending count includes it.
4. Reconnect → Push to Cloud → sale on server, no duplicate on second push.
5. Pull latest → branches/medicines appear in `local_documents`.
6. Edit the same customer on two devices (when that entity is on the gateway) → conflict row, not silent overwrite.

Until those pass: **NOT READY**.
