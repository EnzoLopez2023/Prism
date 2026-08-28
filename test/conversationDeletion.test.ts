import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import type { ArtifactStore } from '../lib/artifacts/artifactStore.js'
import { openDatabase } from '../lib/db/connection.js'
import { migrate } from '../lib/db/migrations.js'
import { PrismRepository } from '../lib/db/repositories/prismRepository.js'

test('conversation deletion fails closed and durable cleanup resumes after artifact failure', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-delete-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const objects = new Map<string, Buffer>()
  let failDeletion = false
  const artifacts: ArtifactStore = {
    async put(input) {
      objects.set(input.objectKey, input.bytes)
      return { objectKey: input.objectKey, bytes: input.bytes.length, contentType: input.contentType, sha256: createHash('sha256').update(input.bytes).digest('hex'), created: true }
    },
    async get(key, contentType) { return { bytes: objects.get(key)!, contentType } },
    async delete(key) {
      if (failDeletion) throw new Error('storage offline')
      objects.delete(key)
    },
  }
  const db = openDatabase(path.join(root, 'prism.db'))
  migrate(db)
  t.after(() => db.close())
  const repository = new PrismRepository(db, artifacts)
  const identity = { tenantId: '00000000-0000-4000-8000-000000000001', oid: '00000000-0000-4000-8000-000000000002' }
  const conversation = await repository.createConversation(identity, 'Delete safely') as { id: number }
  await repository.addMessage(identity, conversation.id, { id: 'm1', type: 'user', content: 'image', timestamp: '2026-01-01', images: [`data:image/png;base64,${Buffer.from('private').toString('base64')}`] }, 100)
  failDeletion = true
  await assert.rejects(repository.deleteConversation(identity, conversation.id), /cleanup failed/)
  assert.ok(await repository.getConversation(identity, conversation.id))
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM artifact_deletion_queue').get() as { count: number }).count, 1)
  await assert.rejects(repository.addMessage(identity, conversation.id, { id: 'm2', type: 'user', content: 'new image', timestamp: '2026-01-02', images: [`data:image/png;base64,${Buffer.from('new-private').toString('base64')}`] }, 100), /deletion is pending/)
  assert.equal(objects.size, 1)
  failDeletion = false
  assert.deepEqual(await repository.resumePendingConversationDeletions(), { completed: 1, failed: 0 })
  assert.equal(await repository.getConversation(identity, conversation.id), null)
  assert.equal(objects.size, 0)
})
