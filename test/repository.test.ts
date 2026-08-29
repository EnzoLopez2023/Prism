import assert from 'node:assert/strict'
import { test } from 'node:test'
import { testRepository } from './helpers.js'

const owner = { tenantId: '00000000-0000-4000-8000-000000000001', oid: '00000000-0000-4000-8000-000000000002' }
const other = { tenantId: owner.tenantId, oid: '00000000-0000-4000-8000-000000000003' }

test('SQLite authority uses DELETE journal and enforces ownership', async t => {
  const fixture = testRepository()
  t.after(() => fixture.close())
  assert.equal(fixture.db.pragma('journal_mode', { simple: true }), 'delete')
  assert.equal(fixture.db.pragma('foreign_keys', { simple: true }), 1)
  await fixture.repository.touchIdentity(owner, owner.oid)
  assert.deepEqual((await fixture.repository.roles(owner)).sort(), ['admin', 'member'])
  const conversation = await fixture.repository.createConversation(owner, 'Private work') as { id: number }
  assert.equal(await fixture.repository.getConversation(other, conversation.id), null)
  assert.equal(await fixture.repository.addMessage(owner, conversation.id, {
    id: 'message-1',
    type: 'user',
    content: 'hello',
    timestamp: '2026-08-28T12:00:00.000Z',
    images: ['data:image/png;base64,aGVsbG8='],
  }, 1024), true)
  const loaded = await fixture.repository.getConversation(owner, conversation.id)
  assert.equal(loaded?.messages.length, 1)
  assert.match(loaded?.messages[0]?.images?.[0] || '', /^\/api\/conversation-images\//)
  assert.equal(fixture.db.prepare("SELECT name FROM pragma_table_info('conversation_images') WHERE name='file_data'").get(), undefined)
})

test('audit rows are immutable', async t => {
  const fixture = testRepository()
  t.after(() => fixture.close())
  await fixture.repository.audit(owner, 'test', 'resource', '1', 'success')
  assert.throws(() => fixture.db.prepare('DELETE FROM app_audit_log').run(), /immutable/)
})

test('legacy prompts are searchable and reusable but remain read-only', async t => {
  const fixture = testRepository()
  t.after(() => fixture.close())
  fixture.db.prepare(`
    INSERT INTO prompts(title,body,category,tags,model,notes,is_favorite,usage_count,legacy_source_id)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run('Imported image prompt', 'Draw a quiet room', 'Image Gen', '["cinematic"]', 'gpt-image-2', 'Legacy note', 1, 0, 40)

  const listed = await fixture.repository.listPrompts(other, { search: 'Image Gen', sort: 'title', order: 'asc' }) as Array<Record<string, unknown>>
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.is_read_only, 1)
  assert.deepEqual(listed[0]?.tags, ['cinematic'])
  assert.equal(await fixture.repository.usePrompt(other, Number(listed[0]?.id)), true)
  assert.equal(await fixture.repository.savePrompt(other, Number(listed[0]?.id), {
    title: 'Changed', body: 'Changed', category: 'General',
  }), null)
  assert.equal(await fixture.repository.deletePrompt(other, Number(listed[0]?.id)), false)
})
