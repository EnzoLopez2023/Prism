import { createHash } from 'node:crypto'
import type { SqliteDatabase } from '../db/connection.js'

export interface ColumnInfo { name: string; type: string }
export interface TableHash { name: string; rowCount: number; canonicalSha256: string }

function writeLength(hash: ReturnType<typeof createHash>, length: number) {
  const encoded = Buffer.alloc(8)
  encoded.writeBigUInt64BE(BigInt(length))
  hash.update(encoded)
}

export function writeValue(hash: ReturnType<typeof createHash>, value: unknown) {
  if (value === null) { hash.update('N'); writeLength(hash, 0); return }
  if (Buffer.isBuffer(value)) { hash.update('B'); writeLength(hash, value.length); hash.update(value); return }
  if (typeof value === 'bigint') {
    const encoded = Buffer.from(value.toString(10)); hash.update('I'); writeLength(hash, encoded.length); hash.update(encoded); return
  }
  if (typeof value === 'number') {
    const text = Number.isNaN(value) ? 'NaN' : Object.is(value, -0) ? '-0' : value === Infinity ? 'Infinity' : value === -Infinity ? '-Infinity' : value.toString()
    const encoded = Buffer.from(text); hash.update('F'); writeLength(hash, encoded.length); hash.update(encoded); return
  }
  if (typeof value === 'string') {
    const encoded = Buffer.from(value); hash.update('T'); writeLength(hash, encoded.length); hash.update(encoded); return
  }
  throw new TypeError(`Unsupported SQLite value type: ${typeof value}`)
}

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`

export function canonicalTableHash(database: SqliteDatabase, table: string): TableHash {
  database.defaultSafeIntegers(true)
  const columns = (database.prepare(`PRAGMA table_info(${quote(table)})`).all() as { cid: bigint; name: string; type: string; pk: bigint }[])
    .sort((left, right) => Number(left.cid - right.cid))
  if (!columns.length) throw new Error(`Missing source table ${table}`)
  const primaryKey = columns.filter(column => Number(column.pk) > 0).sort((left, right) => Number(left.pk - right.pk))
  const hash = createHash('sha256')
  hash.update('hearth.sqlite-table-canonical.v1\0')
  writeValue(hash, table)
  writeValue(hash, columns.length)
  for (const column of columns) { writeValue(hash, column.name); writeValue(hash, column.type || '') }
  let rowCount = 0
  const order = primaryKey.length ? primaryKey.map(column => quote(column.name)).join(',') : 'rowid'
  const statement = database.prepare(`SELECT ${columns.map(column => quote(column.name)).join(',')} FROM ${quote(table)} ORDER BY ${order}`)
  for (const row of statement.iterate() as Iterable<Record<string, unknown>>) {
    hash.update('R')
    for (const column of columns) writeValue(hash, row[column.name])
    rowCount += 1
  }
  return { name: table, rowCount, canonicalSha256: hash.digest('hex') }
}

export function canonicalProductHash(product: string, tables: TableHash[]): string {
  const hash = createHash('sha256')
  hash.update('hearth.sqlite-product-canonical.v1\0')
  writeValue(hash, product)
  for (const table of [...tables].sort((a, b) => a.name.localeCompare(b.name))) {
    writeValue(hash, table.name); writeValue(hash, table.canonicalSha256); writeValue(hash, table.rowCount)
  }
  return hash.digest('hex')
}
