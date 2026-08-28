import { randomUUID, createHash } from 'node:crypto'
import type { ArtifactStore } from '../../artifacts/artifactStore.js'
import type { SqliteDatabase } from '../connection.js'

export interface Identity { tenantId: string; oid: string; displayName?: string }
export interface ConversationMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  images?: string[]
}

interface PromptInput {
  title: string
  body: string
  category?: string
  tags?: string[]
  model?: string | null
  notes?: string | null
  isFavorite?: boolean
}

function parseDataUrl(value: string): { bytes: Buffer; contentType: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(value)
  if (!match) return null
  return {
    contentType: match[1] || 'image/png',
    bytes: match[2] ? Buffer.from(match[3] || '', 'base64') : Buffer.from(decodeURIComponent(match[3] || ''), 'utf8'),
  }
}

export class PrismRepository {
  constructor(private readonly db: SqliteDatabase, private readonly artifacts: ArtifactStore) {}

  async touchIdentity(identity: Identity, bootstrapAdminOid?: string): Promise<void> {
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO app_identities(tenant_id, oid, display_name) VALUES (?, ?, ?)
        ON CONFLICT(tenant_id, oid) DO UPDATE SET display_name=excluded.display_name, last_seen_at=datetime('now')
      `).run(identity.tenantId, identity.oid, identity.displayName || null)
      this.db.prepare('INSERT OR IGNORE INTO app_role_grants(tenant_id, oid, role) VALUES (?, ?, ?)').run(identity.tenantId, identity.oid, 'member')
      if (identity.oid === bootstrapAdminOid) {
        this.db.prepare('INSERT OR IGNORE INTO app_role_grants(tenant_id, oid, role) VALUES (?, ?, ?)').run(identity.tenantId, identity.oid, 'admin')
      }
    })()
  }

  async roles(identity: Identity): Promise<string[]> {
    return (this.db.prepare('SELECT role FROM app_role_grants WHERE tenant_id=? AND oid=?').all(identity.tenantId, identity.oid) as { role: string }[]).map(row => row.role)
  }

  async audit(identity: Identity | null, action: string, resourceType: string, resourceId: string | null, outcome: 'success' | 'failure' | 'denied', detail: object = {}): Promise<void> {
    this.db.prepare('INSERT INTO app_audit_log(tenant_id, oid, action, resource_type, resource_id, outcome, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      identity?.tenantId || null, identity?.oid || null, action, resourceType, resourceId, outcome, JSON.stringify(detail),
    )
  }

  async listConversations(identity: Identity) {
    return this.db.prepare(`
      SELECT id,title,created_at,updated_at,message_count,last_message_preview
      FROM conversations
      WHERE (owner_tenant_id=? AND owner_oid=?) OR owner_oid IS NULL
      ORDER BY updated_at DESC
    `).all(identity.tenantId, identity.oid)
  }

  async createConversation(identity: Identity, title: string) {
    const result = this.db.prepare('INSERT INTO conversations(owner_tenant_id, owner_oid, title) VALUES (?, ?, ?)').run(identity.tenantId, identity.oid, title)
    return this.db.prepare('SELECT id,title,created_at,updated_at,message_count,last_message_preview FROM conversations WHERE id=?').get(result.lastInsertRowid)
  }

  async getConversation(identity: Identity, id: number) {
    const conversation = this.db.prepare(`
      SELECT id,title,created_at,updated_at,message_count FROM conversations
      WHERE id=? AND ((owner_tenant_id=? AND owner_oid=?) OR owner_oid IS NULL)
    `).get(id, identity.tenantId, identity.oid)
    if (!conversation) return null
    const messages = (this.db.prepare('SELECT message_id AS id,type,content,timestamp FROM conversation_messages WHERE conversation_id=? ORDER BY timestamp,id').all(id) as ConversationMessage[])
    const images = this.db.prepare('SELECT id,message_id FROM conversation_images WHERE conversation_id=? ORDER BY message_id,position,id').all(id) as { id: number; message_id: string }[]
    const byMessage = new Map<string, string[]>()
    for (const image of images) byMessage.set(image.message_id, [...(byMessage.get(image.message_id) || []), `/api/conversation-images/${image.id}`])
    return { conversation, messages: messages.map(message => ({ ...message, images: byMessage.get(message.id) || undefined })) }
  }

  private ownsConversation(identity: Identity, id: number): boolean {
    return Boolean(this.db.prepare('SELECT 1 FROM conversations WHERE id=? AND owner_tenant_id=? AND owner_oid=?').get(id, identity.tenantId, identity.oid))
  }

  async addMessage(identity: Identity, conversationId: number, message: ConversationMessage, maxImageBytes: number): Promise<boolean> {
    if (!this.ownsConversation(identity, conversationId)) return false
    if (this.db.prepare('SELECT 1 FROM artifact_deletion_queue WHERE conversation_id=? LIMIT 1').get(conversationId)) {
      throw new Error('Conversation deletion is pending')
    }
    const pending: { objectKey: string; parsed: NonNullable<ReturnType<typeof parseDataUrl>>; position: number }[] = []
    for (const [position, image] of (message.images || []).entries()) {
      const parsed = parseDataUrl(image)
      if (!parsed) continue
      if (parsed.bytes.length > maxImageBytes) throw new Error('Image exceeds configured size limit')
      pending.push({ objectKey: `conversations/${conversationId}/${message.id}/${position}-${randomUUID()}`, parsed, position })
    }
    const stored: Array<{ item: (typeof pending)[number]; artifact: Awaited<ReturnType<ArtifactStore['put']>> }> = []
    try {
      for (const item of pending) stored.push({ item, artifact: await this.artifacts.put({ objectKey: item.objectKey, ...item.parsed }) })
      this.db.transaction(() => {
        if (this.db.prepare('SELECT 1 FROM artifact_deletion_queue WHERE conversation_id=? LIMIT 1').get(conversationId)) {
          throw new Error('Conversation deletion is pending')
        }
        this.db.prepare('INSERT INTO conversation_messages(conversation_id,message_id,type,content,timestamp) VALUES (?,?,?,?,?)').run(
          conversationId, message.id, message.type, message.content, message.timestamp,
        )
        const insert = this.db.prepare('INSERT INTO conversation_images(conversation_id,message_id,position,object_key,sha256,file_type,file_size) VALUES (?,?,?,?,?,?,?)')
        for (const entry of stored) insert.run(conversationId, message.id, entry.item.position, entry.artifact.objectKey, entry.artifact.sha256, entry.artifact.contentType, entry.artifact.bytes)
        const count = (this.db.prepare('SELECT COUNT(*) AS count FROM conversation_messages WHERE conversation_id=?').get(conversationId) as { count: number }).count
        const preview = message.content.length > 100 ? `${message.content.slice(0, 100)}…` : message.content
        this.db.prepare("UPDATE conversations SET message_count=?,last_message_preview=?,updated_at=datetime('now') WHERE id=?").run(count, preview, conversationId)
      })()
      return true
    } catch (error) {
      await Promise.allSettled(stored.map(entry => this.artifacts.delete(entry.artifact.objectKey)))
      throw error
    }
  }

  async deleteConversation(identity: Identity, id: number): Promise<boolean> {
    if (!this.ownsConversation(identity, id)) return false
    const keys = this.db.prepare('SELECT object_key FROM conversation_images WHERE conversation_id=?').all(id) as { object_key: string }[]
    this.db.transaction(() => {
      const insert = this.db.prepare('INSERT OR IGNORE INTO artifact_deletion_queue(conversation_id,object_key) VALUES (?,?)')
      for (const key of keys) insert.run(id, key.object_key)
    })()
    await this.completeConversationDeletion(id)
    return true
  }

  private async completeConversationDeletion(conversationId: number): Promise<void> {
    this.db.prepare(`
      INSERT OR IGNORE INTO artifact_deletion_queue(conversation_id,object_key)
      SELECT conversation_id,object_key FROM conversation_images WHERE conversation_id=?
    `).run(conversationId)
    const pending = this.db.prepare('SELECT id,object_key FROM artifact_deletion_queue WHERE conversation_id=? ORDER BY id').all(conversationId) as { id: number; object_key: string }[]
    for (const item of pending) {
      try {
        await this.artifacts.delete(item.object_key)
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : 'Artifact deletion failed'
        this.db.prepare('UPDATE artifact_deletion_queue SET attempts=attempts+1,last_error=? WHERE id=?').run(message, item.id)
        throw new Error(`Conversation artifact cleanup failed: ${message}`)
      }
    }
    const result = this.db.prepare('DELETE FROM conversations WHERE id=?').run(conversationId)
    if (!result.changes) throw new Error('Conversation disappeared during artifact cleanup')
  }

  async resumePendingConversationDeletions(): Promise<{ completed: number; failed: number }> {
    const rows = this.db.prepare('SELECT DISTINCT conversation_id FROM artifact_deletion_queue ORDER BY conversation_id').all() as { conversation_id: number }[]
    let completed = 0
    let failed = 0
    for (const row of rows) {
      try { await this.completeConversationDeletion(row.conversation_id); completed += 1 }
      catch { failed += 1 }
    }
    return { completed, failed }
  }

  async getImage(identity: Identity, id: number) {
    const row = this.db.prepare(`
      SELECT i.object_key,i.file_type FROM conversation_images i JOIN conversations c ON c.id=i.conversation_id
      WHERE i.id=? AND ((c.owner_tenant_id=? AND c.owner_oid=?) OR c.owner_oid IS NULL)
    `).get(id, identity.tenantId, identity.oid) as { object_key: string; file_type: string } | undefined
    return row ? this.artifacts.get(row.object_key, row.file_type) : null
  }

  async listPrompts(identity: Identity, query: Record<string, string | undefined>) {
    const clauses = ['((owner_tenant_id=? AND owner_oid=?) OR owner_oid IS NULL)']
    const params: unknown[] = [identity.tenantId, identity.oid]
    if (query.search) {
      clauses.push('(title LIKE ? OR body LIKE ? OR notes LIKE ? OR tags LIKE ?)')
      params.push(...Array(4).fill(`%${query.search}%`))
    }
    if (query.category) { clauses.push('category=?'); params.push(query.category) }
    if (query.model) { clauses.push('model=?'); params.push(query.model) }
    if (query.favorite === '1') clauses.push('is_favorite=1')
    const sort = ['created_at', 'updated_at', 'title', 'usage_count'].includes(query.sort || '') ? query.sort : 'created_at'
    const order = query.order === 'asc' ? 'ASC' : 'DESC'
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 100))
    const offset = Math.min(10_000, Math.max(0, Number(query.offset) || 0))
    const rows = this.db.prepare(`SELECT id,title,body,category,tags,model,notes,is_favorite,usage_count,created_at,updated_at FROM prompts WHERE ${clauses.join(' AND ')} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[]
    return rows.map(row => ({ ...row, tags: JSON.parse(String(row.tags || '[]')) }))
  }

  async savePrompt(identity: Identity, id: number | null, input: PromptInput) {
    const tags = JSON.stringify((input.tags || []).map(tag => tag.trim()).filter(Boolean))
    if (id === null) {
      const result = this.db.prepare(`
        INSERT INTO prompts(owner_tenant_id,owner_oid,title,body,category,tags,model,notes,is_favorite)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(identity.tenantId, identity.oid, input.title.trim(), input.body.trim(), input.category?.trim() || 'General', tags, input.model || null, input.notes || null, input.isFavorite ? 1 : 0)
      return Number(result.lastInsertRowid)
    }
    const result = this.db.prepare(`
      UPDATE prompts SET title=?,body=?,category=?,tags=?,model=?,notes=?,is_favorite=?
      WHERE id=? AND owner_tenant_id=? AND owner_oid=?
    `).run(input.title.trim(), input.body.trim(), input.category?.trim() || 'General', tags, input.model || null, input.notes || null, input.isFavorite ? 1 : 0, id, identity.tenantId, identity.oid)
    return result.changes ? id : null
  }

  async usePrompt(identity: Identity, id: number): Promise<boolean> {
    return this.db.prepare('UPDATE prompts SET usage_count=usage_count+1 WHERE id=? AND ((owner_tenant_id=? AND owner_oid=?) OR owner_oid IS NULL)').run(id, identity.tenantId, identity.oid).changes > 0
  }

  async deletePrompt(identity: Identity, id: number): Promise<boolean> {
    return this.db.prepare('DELETE FROM prompts WHERE id=? AND owner_tenant_id=? AND owner_oid=?').run(id, identity.tenantId, identity.oid).changes > 0
  }

  async settings(identity: Identity): Promise<Record<string, unknown>> {
    const row = this.db.prepare('SELECT settings_json FROM app_settings WHERE tenant_id=? AND oid=?').get(identity.tenantId, identity.oid) as { settings_json: string } | undefined
    return row ? JSON.parse(row.settings_json) : {}
  }

  async saveSettings(identity: Identity, settings: Record<string, unknown>): Promise<void> {
    this.db.prepare(`
      INSERT INTO app_settings(tenant_id,oid,settings_json) VALUES (?,?,?)
      ON CONFLICT(tenant_id,oid) DO UPDATE SET settings_json=excluded.settings_json,updated_at=datetime('now')
    `).run(identity.tenantId, identity.oid, JSON.stringify(settings))
  }

  async readiness(): Promise<{ schemaVersion: number; databaseHash: string }> {
    const schemaVersion = (this.db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number }).version
    return { schemaVersion, databaseHash: createHash('sha256').update(String(schemaVersion)).digest('hex').slice(0, 12) }
  }
}
