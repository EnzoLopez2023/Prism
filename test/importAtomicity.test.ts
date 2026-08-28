import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { ArtifactStore } from '../lib/artifacts/artifactStore.js'
import { openDatabase } from '../lib/db/connection.js'
import { canonicalProductHash, canonicalTableHash } from '../lib/migration/canonicalHash.js'
import { fileSha256, importLegacy, TABLES, type LegacySourceEvidence } from '../lib/migration/prismLegacy.js'

test('legacy import stages artifacts before one atomic database commit and cleans failures', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-import-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const sourcePath = path.join(root, 'source.db')
  const targetPath = path.join(root, 'target.db')
  const source = openDatabase(sourcePath)
  source.exec(`
    CREATE TABLE conversations(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,message_count INTEGER,last_message_preview TEXT);
    CREATE TABLE conversation_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,conversation_id INTEGER NOT NULL,message_id TEXT NOT NULL UNIQUE,type TEXT NOT NULL,content TEXT NOT NULL,timestamp TEXT NOT NULL);
    CREATE TABLE conversation_images(id INTEGER PRIMARY KEY AUTOINCREMENT,conversation_id INTEGER NOT NULL,message_id TEXT NOT NULL,position INTEGER NOT NULL,file_data BLOB NOT NULL,file_type TEXT NOT NULL,file_size INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE prompts(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT NOT NULL,category TEXT NOT NULL,tags TEXT NOT NULL,model TEXT,notes TEXT,is_favorite INTEGER NOT NULL,usage_count INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    INSERT INTO conversations VALUES(1,'Test','2026-01-01','2026-01-01',1,'hello');
    INSERT INTO conversation_messages VALUES(1,1,'m1','user','hello','2026-01-01');
    INSERT INTO conversation_images VALUES(1,1,'m1',0,X'01','image/png',1,'2026-01-01'),(2,1,'m1',1,X'02','image/png',1,'2026-01-01');
    INSERT INTO prompts VALUES(1,'Prompt','Body','General','[]',NULL,NULL,0,0,'2026-01-01','2026-01-01');
  `)
  source.close()
  const oracle = openDatabase(sourcePath, true)
  const hashes = TABLES.map(table => canonicalTableHash(oracle, table))
  oracle.close()
  const evidence: LegacySourceEvidence = {
    commit: 'fixture', tree: 'fixture', version: 'fixture', build: 1, imageDigest: 'fixture',
    databaseBytes: fs.statSync(sourcePath).size, databaseSha256: fileSha256(sourcePath),
    productHash: canonicalProductHash('Prism', hashes),
    tables: Object.fromEntries(hashes.map(hash => [hash.name, hash.canonicalSha256])) as LegacySourceEvidence['tables'],
  }
  const stored: string[] = []
  const deleted: string[] = []
  const artifacts: ArtifactStore = {
    async put(input) {
      if (stored.length === 1) throw new Error('synthetic artifact failure')
      stored.push(input.objectKey)
      return { objectKey: input.objectKey, sha256: '01', bytes: input.bytes.length, contentType: input.contentType, created: true }
    },
    async get() { throw new Error('not used') },
    async delete(key) { deleted.push(key) },
  }
  await assert.rejects(importLegacy({ sourcePath, targetPath, artifactRoot: path.join(root, 'artifacts'), artifactStore: artifacts, evidence }), /synthetic artifact failure/)
  assert.deepEqual(deleted, stored)
  const target = openDatabase(targetPath, true)
  for (const table of [...TABLES, 'import_runs']) {
    assert.equal((target.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count, 0)
  }
  target.close()

  const artifactRoot = path.join(root, 'retry-artifacts')
  const firstBytes = Buffer.from([1])
  const firstHash = createHash('sha256').update(firstBytes).digest('hex')
  const interruptedKey = `legacy/conversation-images/1-${firstHash}`
  fs.mkdirSync(path.dirname(path.join(artifactRoot, interruptedKey)), { recursive: true })
  fs.writeFileSync(path.join(artifactRoot, interruptedKey), firstBytes)
  const retried = await importLegacy({ sourcePath, targetPath, artifactRoot, evidence })
  assert.equal(retried.artifactCount, 2)
  const adoptedTarget = openDatabase(targetPath, true)
  assert.equal((adoptedTarget.prepare('SELECT COUNT(*) AS count FROM conversation_images').get() as { count: number }).count, 2)
  adoptedTarget.close()

  const concurrentTarget = path.join(root, 'concurrent.db')
  const concurrentArtifacts = path.join(root, 'concurrent-artifacts')
  const concurrent = await Promise.allSettled([
    importLegacy({ sourcePath, targetPath: concurrentTarget, artifactRoot: concurrentArtifacts, evidence }),
    importLegacy({ sourcePath, targetPath: concurrentTarget, artifactRoot: concurrentArtifacts, evidence }),
  ])
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(concurrent.filter(result => result.status === 'rejected').length, 1)
  const concurrentDatabase = openDatabase(concurrentTarget, true)
  assert.equal((concurrentDatabase.prepare('SELECT COUNT(*) AS count FROM conversation_images').get() as { count: number }).count, 2)
  concurrentDatabase.close()
  assert.equal(fs.readdirSync(path.join(concurrentArtifacts, 'legacy/conversation-images')).length, 2)
})
