import { and, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { PlatformSqliteDb } from "@platform/database-sqlite";
import { outbox as outboxTable } from "@platform/database-sqlite";

export type OutboxEnqueueInput = {
  organizationId: string;
  payload: unknown;
  entityType?: string;
  entityId?: string;
  operation?: string;
  userId?: string;
  deviceId?: string;
  idempotencyKey?: string;
};

export async function enqueueOutbox(db: PlatformSqliteDb, input: OutboxEnqueueInput): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(outboxTable).values({
    id,
    organizationId: input.organizationId,
    payloadJson: JSON.stringify(input.payload),
    status: "pending",
    attempts: 0,
    nextRetryAt: null,
    createdAt: now,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    operation: input.operation ?? null,
    userId: input.userId ?? null,
    deviceId: input.deviceId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    errorMessage: null,
    updatedAt: now,
  });
  return id;
}

export async function listPendingOutbox(
  db: PlatformSqliteDb,
  limit = 50,
): Promise<
  {
    id: string;
    organizationId: string;
    payloadJson: string;
    attempts: number;
    entityType: string | null;
    entityId: string | null;
  }[]
> {
  const now = new Date().toISOString();
  return db
    .select({
      id: outboxTable.id,
      organizationId: outboxTable.organizationId,
      payloadJson: outboxTable.payloadJson,
      attempts: outboxTable.attempts,
      entityType: outboxTable.entityType,
      entityId: outboxTable.entityId,
    })
    .from(outboxTable)
    .where(
      and(
        or(eq(outboxTable.status, "pending"), eq(outboxTable.status, "failed")),
        or(isNull(outboxTable.nextRetryAt), lte(outboxTable.nextRetryAt, now)),
      ),
    )
    .limit(limit);
}

export async function countOutboxByStatus(db: PlatformSqliteDb): Promise<{
  pending: number;
  failed: number;
  conflict: number;
  synced: number;
}> {
  const rows = await db
    .select({
      status: outboxTable.status,
      n: sql<number>`count(*)`,
    })
    .from(outboxTable)
    .groupBy(outboxTable.status);
  const out = { pending: 0, failed: 0, conflict: 0, synced: 0 };
  for (const row of rows) {
    if (row.status === "pending") out.pending = Number(row.n);
    else if (row.status === "failed") out.failed = Number(row.n);
    else if (row.status === "conflict") out.conflict = Number(row.n);
    else if (row.status === "completed" || row.status === "synced") out.synced = Number(row.n);
  }
  return out;
}

export async function markOutboxCompleted(db: PlatformSqliteDb, id: string): Promise<void> {
  await db
    .update(outboxTable)
    .set({ status: "completed", errorMessage: null, updatedAt: new Date().toISOString() })
    .where(eq(outboxTable.id, id));
}

export async function markOutboxConflict(db: PlatformSqliteDb, id: string, message: string): Promise<void> {
  await db
    .update(outboxTable)
    .set({ status: "conflict", errorMessage: message, updatedAt: new Date().toISOString() })
    .where(eq(outboxTable.id, id));
}

export async function markOutboxFailed(
  db: PlatformSqliteDb,
  id: string,
  attempts: number,
  nextRetryAtIso: string,
  errorMessage?: string,
): Promise<void> {
  const terminal = attempts >= 8;
  await db
    .update(outboxTable)
    .set({
      status: terminal ? "failed" : "pending",
      attempts,
      nextRetryAt: nextRetryAtIso,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(outboxTable.id, id));
}

export async function listRecentOutboxErrors(db: PlatformSqliteDb, limit = 25) {
  return db
    .select()
    .from(outboxTable)
    .where(or(eq(outboxTable.status, "failed"), eq(outboxTable.status, "conflict")))
    .orderBy(desc(outboxTable.updatedAt))
    .limit(limit);
}
