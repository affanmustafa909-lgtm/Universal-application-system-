import { eq } from "drizzle-orm";
import { syncPushBatchSchema } from "@platform/contracts";
import type { PlatformSqliteDb } from "@platform/database-sqlite";
import { localDocuments, syncCursors, syncHistory } from "@platform/database-sqlite";
import {
  listPendingOutbox,
  markOutboxCompleted,
  markOutboxConflict,
  markOutboxFailed,
} from "./outbox";

export type SyncEngineOptions = {
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  organizationId?: string;
};

const DEFAULT_TIMEOUT_MS = 45_000;
export const SYNC_PROTOCOL_VERSION = 1;

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 503 || status === 502 || status === 504 || status === 429;
}

export type PushResult = {
  pushed: number;
  failed: number;
  conflicts: number;
  duplicates: number;
};

export type PullResult = {
  downloaded: number;
  conflicts: number;
  cursor: string | null;
};

/**
 * Universal sync loop: durable outbox push + scoped delta pull.
 * Business modules keep their own engines; this only moves data.
 */
export class SyncEngine {
  constructor(private readonly opts: SyncEngineOptions) {}

  private fetcher() {
    return this.opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  }

  async flushOnce(db: PlatformSqliteDb): Promise<PushResult> {
    const pending = await listPendingOutbox(db, 25);
    const summary: PushResult = { pushed: 0, failed: 0, conflicts: 0, duplicates: 0 };
    if (pending.length === 0) return summary;

    const fetchImpl = this.fetcher();
    const timeoutMs = this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    for (const row of pending) {
      const payload = JSON.parse(row.payloadJson) as unknown;
      const batch = syncPushBatchSchema.parse(payload);
      const url = `${this.opts.apiBaseUrl}/v1/sync/push`;
      const init: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.accessToken}`,
        },
        body: JSON.stringify({ ...batch, protocolVersion: SYNC_PROTOCOL_VERSION }),
      };

      let res: Response | null = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          res = await fetchWithTimeout(fetchImpl, url, init, timeoutMs);
          if (isRetryableStatus(res.status) && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
            continue;
          }
          break;
        } catch {
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
            continue;
          }
          res = null;
        }
      }

      if (res?.ok) {
        const body = (await res.json().catch(() => null)) as {
          results?: Array<{ status: string; error?: string }>;
        } | null;
        const first = body?.results?.[0];
        if (first?.status === "conflict") {
          await markOutboxConflict(db, row.id, first.error ?? "Conflict");
          summary.conflicts += 1;
          continue;
        }
        if (first?.status === "duplicate") {
          await markOutboxCompleted(db, row.id);
          summary.duplicates += 1;
          continue;
        }
        await markOutboxCompleted(db, row.id);
        summary.pushed += 1;
        continue;
      }

      const nextAttempt = row.attempts + 1;
      const backoffMs = Math.min(60_000, 250 * 2 ** Math.min(nextAttempt, 10));
      const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
      const errText = res ? `HTTP ${res.status}` : "network";
      await markOutboxFailed(db, row.id, nextAttempt, nextRetryAt, errText);
      summary.failed += 1;
    }

    return summary;
  }

  async pullOnce(db: PlatformSqliteDb, organizationId: string): Promise<PullResult> {
    const [cursorRow] = await db.select().from(syncCursors).where(eq(syncCursors.scope, "tenant")).limit(1);
    const since = cursorRow?.cursor ?? "";
    const url = new URL(`${this.opts.apiBaseUrl}/v1/sync/pull`);
    if (since) url.searchParams.set("cursor", since);
    url.searchParams.set("protocolVersion", String(SYNC_PROTOCOL_VERSION));

    const res = await fetchWithTimeout(
      this.fetcher(),
      url,
      { headers: { Authorization: `Bearer ${this.opts.accessToken}` } },
      this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    if (!res.ok) {
      throw new Error(`Pull failed (${res.status})`);
    }
    const body = (await res.json()) as {
      cursor?: string;
      changes?: Array<{
        entityType: string;
        operation: string;
        id: string;
        payload: Record<string, unknown>;
        serverUpdatedAt?: string;
      }>;
    };
    const changes = body.changes ?? [];
    let conflicts = 0;
    const now = new Date().toISOString();
    const pending = await listPendingOutbox(db, 500);
    const pendingIds = new Set(pending.map((p) => p.entityId).filter(Boolean));

    for (const change of changes) {
      if (pendingIds.has(change.id)) {
        conflicts += 1;
        continue;
      }
      await db
        .insert(localDocuments)
        .values({
          id: change.id,
          organizationId,
          domain: change.entityType.split(".")[0] ?? "core",
          entityType: change.entityType,
          payloadJson: JSON.stringify(change.payload),
          deletedAt: change.operation === "delete" ? now : null,
          serverUpdatedAt: change.serverUpdatedAt ?? now,
          syncStatus: "synced",
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: localDocuments.id,
          set: {
            payloadJson: JSON.stringify(change.payload),
            deletedAt: change.operation === "delete" ? now : null,
            serverUpdatedAt: change.serverUpdatedAt ?? now,
            syncStatus: "synced",
            updatedAt: now,
          },
        });
    }

    if (body.cursor) {
      await db
        .insert(syncCursors)
        .values({ scope: "tenant", cursor: body.cursor, updatedAt: now })
        .onConflictDoUpdate({
          target: syncCursors.scope,
          set: { cursor: body.cursor, updatedAt: now },
        });
    }

    return { downloaded: changes.length - conflicts, conflicts, cursor: body.cursor ?? null };
  }

  async recordHistory(
    db: PlatformSqliteDb,
    input: {
      organizationId: string;
      kind: string;
      uploaded: number;
      downloaded: number;
      failed: number;
      conflicts: number;
      durationMs: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    await db.insert(syncHistory).values({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      kind: input.kind,
      uploaded: input.uploaded,
      downloaded: input.downloaded,
      failed: input.failed,
      conflicts: input.conflicts,
      durationMs: input.durationMs,
      errorMessage: input.errorMessage ?? null,
      createdAt: new Date().toISOString(),
    });
  }
}
