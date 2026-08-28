import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { ArtifactStore } from '../artifacts/artifactStore.js'
import { FilesystemArtifactStore } from '../artifacts/filesystemArtifactStore.js'
import { openDatabase } from '../db/connection.js'
import { migrate } from '../db/migrations.js'
import { canonicalProductHash, canonicalTableHash } from './canonicalHash.js'
import { acquireExclusiveClaim } from '../concurrency/exclusiveClaim.js'

export const TABLES = ['conversations', 'conversation_messages', 'conversation_images', 'prompts'] as const
type LegacyTable = typeof TABLES[number]

export interface LegacySourceEvidence {
  commit: string
  tree: string
  version: string
  build: number
  imageDigest: string
  databaseBytes: number
  databaseSha256: string
  productHash: string
  tables: Record<LegacyTable, string>
}

export const SOURCE: LegacySourceEvidence = {
  commit: 'f0b05fc1dbf53e8aa26c215d8e858894a2793871',
  tree: '62cbd35861c511f7c17187c875d19ee6e353b80d',
  version: '2.13.2',
  build: 172,
  imageDigest: 'sha256:dc4df7e0f966be5b0608e71643d316cc5eba7590b8e56cec482583ab69443140',
  databaseBytes: 950_947_840,
  databaseSha256: 'dc9fb47d269b339a3dcae37279dc3116f37a0635728a2d2b2ac2c511811a5807',
  productHash: 'c4ba6259e918219898a6608d7932040600864662e03b47ad5400558bb790ba8d',
  tables: {
    conversations: '145e677743ab5dfac4dd20d91fd79d1eff5ab75be75a8bbde398d712859810ee',
    conversation_messages: 'd8474084cdcb540e8bc0eb55a92ff7bf917a91ac45e7a26994cbb0853472612e',
    conversation_images: '730a2619d05edb6d9ae23ad7dab7d172d8a5777f4dc40a3e4e35e4e60f751405',
    prompts: 'a97555772c716ecac547dc2952e6981246cc2be85267300057eff50dee0657ee',
  },
} as const

export function fileSha256(filename: string): string {
  const hash = createHash('sha256')
  const fd = fs.openSync(filename, 'r')
  const buffer = Buffer.allocUnsafe(4 * 1024 * 1024)
  try {
    while (true) {
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, null)
      if (!bytes) break
      hash.update(buffer.subarray(0, bytes))
    }
  } finally { fs.closeSync(fd) }
  return hash.digest('hex')
}

export function verifySource(sourcePath: string, evidence: LegacySourceEvidence = SOURCE) {
  const stats = fs.statSync(sourcePath)
  if (stats.size !== evidence.databaseBytes) throw new Error(`Source byte size mismatch: ${stats.size}`)
  const sha256 = fileSha256(sourcePath)
  if (sha256 !== evidence.databaseSha256) throw new Error(`Source SHA-256 mismatch: ${sha256}`)
  const source = openDatabase(sourcePath, true)
  source.pragma('query_only = ON')
  const tables = TABLES.map(table => canonicalTableHash(source, table))
  for (const table of tables) {
    const expected = evidence.tables[table.name as LegacyTable]
    if (table.canonicalSha256 !== expected) throw new Error(`Canonical source hash mismatch for ${table.name}`)
  }
  const productHash = canonicalProductHash('Prism', tables)
  if (productHash !== evidence.productHash) throw new Error(`Canonical Prism source hash mismatch: ${productHash}`)
  return { source, tables, productHash, sha256, bytes: stats.size }
}

const number = (value: unknown) => Number(value)

export async function importLegacy(options: { sourcePath: string; targetPath: string; artifactRoot: string; artifactStore?: ArtifactStore; evidence?: LegacySourceEvidence }) {
  if (path.resolve(options.sourcePath) === path.resolve(options.targetPath)) throw new Error('Source and target must be different files')
  const evidence = options.evidence || SOURCE
  const claim = acquireExclusiveClaim(`${path.resolve(options.targetPath)}.operation.claim`, 'Prism legacy import')
  const artifacts = options.artifactStore || new FilesystemArtifactStore(options.artifactRoot)
  const lineage = JSON.stringify({ sourceApp: 'Hearth', sourceCommit: evidence.commit, sourceDatabaseSha256: evidence.databaseSha256 })
  const createdKeys: string[] = []
  let verified: ReturnType<typeof verifySource> | null = null
  let target: ReturnType<typeof openDatabase> | null = null
  try {
    verified = verifySource(options.sourcePath, evidence)
    target = openDatabase(options.targetPath)
    migrate(target)
    target.defaultSafeIntegers(true)
    const count = (target.prepare(`SELECT
      (SELECT COUNT(*) FROM conversations)+(SELECT COUNT(*) FROM conversation_messages)+
      (SELECT COUNT(*) FROM conversation_images)+(SELECT COUNT(*) FROM prompts) AS count`).get() as { count: bigint }).count
    if (count !== 0n) throw new Error('Target domain tables must be empty')
    const images = verified.source.prepare('SELECT * FROM conversation_images ORDER BY id').all() as Record<string, unknown>[]
    const stagedImages: Array<{ row: Record<string, unknown>; objectKey: string; sha256: string }> = []
    for (const row of images) {
      const bytes = row.file_data as Buffer
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      const objectKey = `legacy/conversation-images/${number(row.id)}-${sha256}`
      const artifact = await artifacts.put({ objectKey, bytes, contentType: String(row.file_type), replaceMismatched: true })
      if (artifact.created) createdKeys.push(objectKey)
      stagedImages.push({ row, objectKey, sha256: artifact.sha256 })
    }
    const activeTarget = target
    const activeVerified = verified
    activeTarget.transaction(() => {
      const run = activeTarget.prepare('INSERT INTO import_runs(source_sha256,source_bytes,source_commit) VALUES (?,?,?)').run(evidence.databaseSha256, evidence.databaseBytes, evidence.commit)
      const conversations = activeVerified.source.prepare('SELECT * FROM conversations ORDER BY id').all() as Record<string, unknown>[]
      const insertConversation = activeTarget.prepare(`INSERT INTO conversations(id,title,created_at,updated_at,message_count,last_message_preview,legacy_source_id,source_lineage_json) VALUES (?,?,?,?,?,?,?,?)`)
      for (const row of conversations) insertConversation.run(row.id, row.title, row.created_at, row.updated_at, row.message_count, row.last_message_preview, row.id, lineage)
      const messages = activeVerified.source.prepare('SELECT * FROM conversation_messages ORDER BY id').all() as Record<string, unknown>[]
      const insertMessage = activeTarget.prepare('INSERT INTO conversation_messages(id,conversation_id,message_id,type,content,timestamp,legacy_source_id) VALUES (?,?,?,?,?,?,?)')
      for (const row of messages) insertMessage.run(row.id, row.conversation_id, row.message_id, row.type, row.content, row.timestamp, row.id)
      const prompts = activeVerified.source.prepare('SELECT * FROM prompts ORDER BY id').all() as Record<string, unknown>[]
      const insertPrompt = activeTarget.prepare(`INSERT INTO prompts(id,title,body,category,tags,model,notes,is_favorite,usage_count,created_at,updated_at,legacy_source_id,source_lineage_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      for (const row of prompts) insertPrompt.run(row.id, row.title, row.body, row.category, row.tags, row.model, row.notes, row.is_favorite, row.usage_count, row.created_at, row.updated_at, row.id, lineage)
      const insertImage = activeTarget.prepare(`INSERT INTO conversation_images(id,conversation_id,message_id,position,object_key,sha256,file_type,file_size,created_at,legacy_source_id) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      for (const staged of stagedImages) {
        const row = staged.row
        insertImage.run(row.id, row.conversation_id, row.message_id, row.position, staged.objectKey, staged.sha256, row.file_type, row.file_size, row.created_at, row.id)
      }
      const relationships = activeTarget.pragma('foreign_key_check') as unknown[]
      if (relationships.length) throw new Error(`Target has ${relationships.length} foreign-key violations`)
      const counts = Object.fromEntries(TABLES.map(table => [table, Number((activeTarget.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: bigint }).count)]))
      activeTarget.prepare("UPDATE import_runs SET completed_at=datetime('now'),result_json=? WHERE id=?").run(JSON.stringify({ status: 'complete', counts }), run.lastInsertRowid)
    })()
    return { sourceHash: activeVerified.productHash, counts: Object.fromEntries(activeVerified.tables.map(table => [table.name, table.rowCount])), artifactCount: images.length }
  } catch (error) {
    for (const key of createdKeys) {
      const referenced = target?.open && target.prepare('SELECT 1 FROM conversation_images WHERE object_key=?').get(key)
      if (!referenced) {
        try { await artifacts.delete(key) } catch { /* The exclusive claim prevents another import from adopting this object. */ }
      }
    }
    throw error
  } finally {
    if (target?.open) target.close()
    if (verified?.source.open) verified.source.close()
    claim.release()
  }
}
