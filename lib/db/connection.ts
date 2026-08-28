import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export type SqliteDatabase = Database.Database

export function openDatabase(filename: string, readonly = false): SqliteDatabase {
  if (!readonly) fs.mkdirSync(path.dirname(filename), { recursive: true })
  const db = new Database(filename, { readonly, fileMustExist: readonly })
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  if (!readonly) db.pragma('journal_mode = DELETE')
  return db
}
