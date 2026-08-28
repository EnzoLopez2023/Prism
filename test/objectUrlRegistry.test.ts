import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ObjectUrlRegistry, resolveProtectedMessageImages } from '../src/features/chat/objectUrlRegistry.js'

test('conversation object URLs are revoked on replacement and unmount cleanup', async () => {
  const revoked: string[] = []
  const registry = new ObjectUrlRegistry(url => revoked.push(url))
  const first = await resolveProtectedMessageImages([{ images: ['/api/conversation-images/1'] }], async () => 'blob:first', registry)
  registry.replace(first.objectUrls)
  const second = await resolveProtectedMessageImages([{ images: ['/api/conversation-images/2', 'data:image/png;base64,AA=='] }], async () => 'blob:second', registry)
  registry.replace(second.objectUrls)
  assert.deepEqual(revoked, ['blob:first'])
  registry.clear()
  assert.deepEqual(revoked, ['blob:first', 'blob:second'])
})

test('partially loaded object URLs are revoked when conversation image loading fails', async () => {
  const revoked: string[] = []
  const registry = new ObjectUrlRegistry(url => revoked.push(url))
  let call = 0
  await assert.rejects(resolveProtectedMessageImages(
    [{ images: ['/api/conversation-images/1', '/api/conversation-images/2'] }],
    async () => { call += 1; if (call === 2) throw new Error('load failed'); return 'blob:partial' },
    registry,
  ), /load failed/)
  assert.deepEqual(revoked, ['blob:partial'])
})
