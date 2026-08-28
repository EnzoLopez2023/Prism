import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { openDatabase } from '../db/connection.js'
import { SOURCE, TABLES, verifySource } from './prismLegacy.js'

const columns: Record<string, string[]> = {
  conversations: ['id','title','created_at','updated_at','message_count','last_message_preview'],
  conversation_messages: ['id','conversation_id','message_id','type','content','timestamp'],
  conversation_images: ['id','conversation_id','message_id','position','file_data','file_type','file_size','created_at'],
  prompts: ['id','title','body','category','tags','model','notes','is_favorite','usage_count','created_at','updated_at'],
}
function comparable(value: unknown): string {
  if (value === null) return 'null'
  if (Buffer.isBuffer(value)) return `blob:${createHash('sha256').update(value).digest('hex')}:${value.length}`
  return `${typeof value}:${String(value)}`
}
function rowHash(row: Record<string, unknown>, names: string[]) {
  const hash = createHash('sha256')
  for (const name of names) hash.update(`${name}\0${comparable(row[name])}\0`)
  return hash.digest('hex')
}

export function reconcileLegacy(options: { sourcePath: string; targetPath: string; artifactRoot: string }) {
  const verified = verifySource(options.sourcePath)
  const target = openDatabase(options.targetPath, true)
  target.defaultSafeIntegers(true)
  const differences: string[] = []
  const report: Record<string, unknown> = {}
  for (const table of TABLES) {
    const sourceRows = verified.source.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Record<string, unknown>[]
    const targetRows = target.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Record<string, unknown>[]
    const targetByLegacy = new Map(targetRows.map(row => [String(row.legacy_source_id), row]))
    let matched = 0
    for (const sourceRow of sourceRows) {
      const targetRow = targetByLegacy.get(String(sourceRow.id))
      if (!targetRow) { differences.push(`${table}: missing legacy id ${String(sourceRow.id)}`); continue }
      const projected = { ...targetRow }
      if (table === 'conversation_images') {
        const objectPath = path.join(options.artifactRoot, String(targetRow.object_key))
        if (!fs.existsSync(objectPath)) { differences.push(`${table}: missing artifact ${String(targetRow.object_key)}`); continue }
        const bytes = fs.readFileSync(objectPath)
        projected.file_data = bytes
        if (bytes.length !== Number(targetRow.file_size)) differences.push(`${table}: artifact size mismatch for ${String(sourceRow.id)}`)
        if (createHash('sha256').update(bytes).digest('hex') !== String(targetRow.sha256)) differences.push(`${table}: artifact hash mismatch for ${String(sourceRow.id)}`)
      }
      if (rowHash(sourceRow, columns[table]!) !== rowHash(projected, columns[table]!)) differences.push(`${table}: field hash mismatch for ${String(sourceRow.id)}`)
      else matched += 1
    }
    if (sourceRows.length !== targetRows.length) differences.push(`${table}: count ${sourceRows.length} != ${targetRows.length}`)
    report[table] = { source: sourceRows.length, target: targetRows.length, matched }
  }
  const foreignKeys = target.pragma('foreign_key_check') as unknown[]
  if (foreignKeys.length) differences.push(`foreign keys: ${foreignKeys.length} violations`)
  const sequences = Object.fromEntries(TABLES.filter(table => table !== 'conversation_images' || true).map(table => {
    const maximum = Number((target.prepare(`SELECT COALESCE(MAX(id),0) AS id FROM ${table}`).get() as { id: bigint }).id)
    const sequence = Number((target.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(table) as { seq: bigint } | undefined)?.seq || 0)
    if (sequence < maximum) differences.push(`${table}: sequence ${sequence} below max ${maximum}`)
    return [table, { maximum, sequence }]
  }))
  target.close(); verified.source.close()
  return { contract: 'prism.legacy-reconciliation.v1', sourceProductHash: SOURCE.productHash, report, sequences, foreignKeyViolations: foreignKeys.length, differences, ok: differences.length === 0 }
}
