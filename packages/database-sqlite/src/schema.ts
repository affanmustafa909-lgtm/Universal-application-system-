import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const installedModules = sqliteTable("installed_modules", {
  slug: text("slug").primaryKey(),
  version: text("version").notNull(),
  remoteEntryUrl: text("remote_entry_url").notNull(),
  manifestJson: text("manifest_json").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  installedAt: text("installed_at").notNull(),
});

/** Durable outbox — survives restart. Not an in-memory array. */
export const outbox = sqliteTable("outbox", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: text("next_retry_at"),
  createdAt: text("created_at").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  operation: text("operation"),
  userId: text("user_id"),
  deviceId: text("device_id"),
  idempotencyKey: text("idempotency_key"),
  errorMessage: text("error_message"),
  updatedAt: text("updated_at"),
});

export const settingsKv = sqliteTable("settings_kv", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const syncCursors = sqliteTable("sync_cursors", {
  scope: text("scope").primaryKey(),
  cursor: text("cursor").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Previously authenticated users on this device. Password verifier only — never the raw password. */
export const offlineIdentities = sqliteTable("offline_identities", {
  email: text("email").primaryKey(),
  organizationId: text("organization_id").notNull(),
  userId: text("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  verifierSaltHex: text("verifier_salt_hex").notNull(),
  verifierHashHex: text("verifier_hash_hex").notNull(),
  claimsJson: text("claims_json").notNull(),
  lastAccessToken: text("last_access_token"),
  lastRefreshToken: text("last_refresh_token"),
  lastOnlineAt: text("last_online_at").notNull(),
  offlineExpiresAt: text("offline_expires_at").notNull(),
  status: text("status").notNull().default("active"),
  updatedAt: text("updated_at").notNull(),
});

export const syncFiles = sqliteTable("sync_files", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  localPath: text("local_path"),
  cloudObjectKey: text("cloud_object_key"),
  checksum: text("checksum"),
  syncStatus: text("sync_status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const syncConflicts = sqliteTable("sync_conflicts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  localJson: text("local_json").notNull(),
  remoteJson: text("remote_json").notNull(),
  strategy: text("strategy").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const syncHistory = sqliteTable("sync_history", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  kind: text("kind").notNull(),
  uploaded: integer("uploaded").notNull().default(0),
  downloaded: integer("downloaded").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  conflicts: integer("conflicts").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});

/** Cached cloud documents for local-first reads. Not a second business engine. */
export const localDocuments = sqliteTable("local_documents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  domain: text("domain").notNull(),
  entityType: text("entity_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  deletedAt: text("deleted_at"),
  serverUpdatedAt: text("server_updated_at"),
  syncStatus: text("sync_status").notNull().default("synced"),
  updatedAt: text("updated_at").notNull(),
});
