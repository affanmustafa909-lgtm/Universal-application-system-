import { desc, eq } from "drizzle-orm";
import type { PlatformSqliteDb } from "@platform/database-sqlite";
import { syncConflicts } from "@platform/database-sqlite";

export type ConflictStrategy =
  | "last_write_wins"
  | "server_wins"
  | "client_wins"
  | "manual"
  | "event_reconciliation";

export const DEFAULT_CONFLICT_POLICY: Record<string, ConflictStrategy> = {
  product: "last_write_wins",
  customer: "manual",
  supplier: "last_write_wins",
  inventory: "event_reconciliation",
  sale: "event_reconciliation",
  payment: "event_reconciliation",
  collection: "event_reconciliation",
  expense: "event_reconciliation",
  pjp: "manual",
  visit: "last_write_wins",
  branch: "server_wins",
};

export async function recordConflict(
  db: PlatformSqliteDb,
  input: {
    organizationId: string;
    entityType: string;
    entityId: string;
    local: unknown;
    remote: unknown;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(syncConflicts).values({
    id,
    organizationId: input.organizationId,
    entityType: input.entityType,
    entityId: input.entityId,
    localJson: JSON.stringify(input.local),
    remoteJson: JSON.stringify(input.remote),
    strategy: DEFAULT_CONFLICT_POLICY[input.entityType] ?? "manual",
    status: "open",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  });
  return id;
}

export async function listOpenConflicts(db: PlatformSqliteDb, organizationId: string) {
  return db
    .select()
    .from(syncConflicts)
    .where(eq(syncConflicts.organizationId, organizationId))
    .orderBy(desc(syncConflicts.createdAt));
}

export async function resolveConflict(
  db: PlatformSqliteDb,
  id: string,
  choice: "keep_local" | "keep_cloud",
): Promise<void> {
  await db
    .update(syncConflicts)
    .set({ status: choice, resolvedAt: new Date().toISOString() })
    .where(eq(syncConflicts.id, id));
}
