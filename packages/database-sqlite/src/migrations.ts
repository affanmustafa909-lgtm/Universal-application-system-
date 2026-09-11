/** Bootstrap DDL for WASM SQLite (no drizzle-kit migrate runner in the shell). */
export const SQLITE_BOOTSTRAP_DDL = `
CREATE TABLE IF NOT EXISTS installed_modules (
  slug TEXT PRIMARY KEY NOT NULL,
  version TEXT NOT NULL,
  remote_entry_url TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  installed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  scope TEXT PRIMARY KEY NOT NULL,
  cursor TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

/** Additive v2+ statements. Each is applied independently so existing DBs upgrade safely. */
export const SQLITE_MIGRATIONS = [
  `ALTER TABLE outbox ADD COLUMN entity_type TEXT`,
  `ALTER TABLE outbox ADD COLUMN entity_id TEXT`,
  `ALTER TABLE outbox ADD COLUMN operation TEXT`,
  `ALTER TABLE outbox ADD COLUMN user_id TEXT`,
  `ALTER TABLE outbox ADD COLUMN device_id TEXT`,
  `ALTER TABLE outbox ADD COLUMN idempotency_key TEXT`,
  `ALTER TABLE outbox ADD COLUMN error_message TEXT`,
  `ALTER TABLE outbox ADD COLUMN updated_at TEXT`,
  `CREATE TABLE IF NOT EXISTS offline_identities (
    email TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    verifier_salt_hex TEXT NOT NULL,
    verifier_hash_hex TEXT NOT NULL,
    claims_json TEXT NOT NULL,
    last_access_token TEXT,
    last_refresh_token TEXT,
    last_online_at TEXT NOT NULL,
    offline_expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_files (
    id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    local_path TEXT,
    cloud_object_key TEXT,
    checksum TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_conflicts (
    id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    local_json TEXT NOT NULL,
    remote_json TEXT NOT NULL,
    strategy TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    resolved_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sync_history (
    id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    uploaded INTEGER NOT NULL DEFAULT 0,
    downloaded INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    conflicts INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS local_documents (
    id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    deleted_at TEXT,
    server_updated_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS outbox_status_retry_idx ON outbox (status, next_retry_at)`,
  `CREATE INDEX IF NOT EXISTS local_documents_org_type_idx ON local_documents (organization_id, entity_type)`,
];
