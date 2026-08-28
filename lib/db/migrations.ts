import type { SqliteDatabase } from './connection.js'

const migration1 = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE app_identities (
  tenant_id TEXT NOT NULL,
  oid TEXT NOT NULL,
  display_name TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, oid)
);
CREATE TABLE app_role_grants (
  tenant_id TEXT NOT NULL,
  oid TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member','admin')),
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  granted_by_tenant_id TEXT,
  granted_by_oid TEXT,
  PRIMARY KEY (tenant_id, oid, role),
  FOREIGN KEY (tenant_id, oid) REFERENCES app_identities(tenant_id, oid) ON DELETE CASCADE
);
CREATE TABLE app_settings (
  tenant_id TEXT NOT NULL,
  oid TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, oid),
  FOREIGN KEY (tenant_id, oid) REFERENCES app_identities(tenant_id, oid) ON DELETE CASCADE
);
CREATE TABLE app_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT,
  oid TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','failure','denied')),
  detail_json TEXT NOT NULL DEFAULT '{}',
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  legacy_source_id INTEGER
);
CREATE TRIGGER app_audit_no_update BEFORE UPDATE ON app_audit_log BEGIN SELECT RAISE(ABORT, 'audit rows are immutable'); END;
CREATE TRIGGER app_audit_no_delete BEFORE DELETE ON app_audit_log BEGIN SELECT RAISE(ABORT, 'audit rows are immutable'); END;

CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_tenant_id TEXT,
  owner_oid TEXT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_preview TEXT,
  legacy_source_id INTEGER UNIQUE,
  source_lineage_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_conversations_owner_updated ON conversations(owner_tenant_id, owner_oid, updated_at DESC);
CREATE TABLE conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('user','assistant')),
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  legacy_source_id INTEGER UNIQUE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(conversation_id, timestamp, id);
CREATE TABLE conversation_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  legacy_source_id INTEGER UNIQUE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX idx_conversation_images_message ON conversation_images(conversation_id, message_id, position);
CREATE TABLE prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_tenant_id TEXT,
  owner_oid TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  tags TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  notes TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  legacy_source_id INTEGER UNIQUE,
  source_lineage_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_prompts_owner_category ON prompts(owner_tenant_id, owner_oid, category);
CREATE TRIGGER prompts_updated_at AFTER UPDATE ON prompts
BEGIN UPDATE prompts SET updated_at = datetime('now') WHERE id = OLD.id; END;
CREATE TABLE import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_sha256 TEXT NOT NULL,
  source_bytes INTEGER NOT NULL,
  source_commit TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  result_json TEXT
);
`

const migration2 = `
CREATE TABLE artifact_deletion_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  object_key TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(conversation_id, object_key),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX idx_artifact_deletion_queue_conversation ON artifact_deletion_queue(conversation_id, id);
`

export function migrate(db: SqliteDatabase): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')))")
  const current = (db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get() as { version: number }).version
  if (current < 1) {
    db.transaction(() => {
      db.exec(migration1)
      db.prepare('INSERT INTO schema_migrations(version, name) VALUES (1, ?)').run('initial-prism-authority')
    })()
  }
  if (current < 2) {
    db.transaction(() => {
      db.exec(migration2)
      db.prepare('INSERT INTO schema_migrations(version, name) VALUES (2, ?)').run('durable-artifact-deletion')
    })()
  }
}
