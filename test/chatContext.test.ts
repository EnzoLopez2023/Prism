import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boundedChatContext } from '../src/features/chat/chatContext.js'

test('model context compacts long persisted transcripts while retaining recent turns', () => {
  const persisted = Array.from({ length: 130 }, (_, index) => ({
    type: index % 2 ? 'assistant' as const : 'user' as const,
    content: `message-${index}`,
  }))
  const context = boundedChatContext(persisted)
  assert.equal(context.length, 80)
  assert.match(context[0]!.content, /51 earlier persisted messages/)
  assert.equal(context.at(-1)?.content, 'message-129')
  assert.equal(persisted.length, 130)
})
