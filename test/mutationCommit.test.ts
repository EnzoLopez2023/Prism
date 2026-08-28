import assert from 'node:assert/strict'
import { test } from 'node:test'
import { commitMediaMutation } from '../src/features/chat/mutationCommit.js'

const result = (intentId: string, state: 'success' | 'failed' | 'crash-ambiguous', message: string) => ({
  state: 'available',
  data: {
    schema: 'marquee.mutation-result.v1',
    intentId,
    state,
    result: { message },
  },
})

async function decide(value: unknown) {
  let requestedPath = ''
  const decision = await commitMediaMutation(
    { kind: 'playlists', intentId: 'intent-1', confirmationPhrase: 'CONFIRM intent-1' },
    async <T>(path: string) => { requestedPath = path; return value as T },
  )
  assert.equal(requestedPath, '/api/media/playlists/commit')
  return decision
}

test('Marquee commit rejects a mismatched returned intent ID and retains preview', async () => {
  const decision = await decide(result('different-intent', 'success', 'Created'))
  assert.equal(decision.state, 'invalid')
  assert.equal(decision.clearPreview, false)
  assert.match(decision.message, /different intent ID/)
})

test('Marquee failed commit is displayed and retained', async () => {
  const decision = await decide(result('intent-1', 'failed', 'Plex rejected the write'))
  assert.deepEqual(decision, {
    state: 'failed',
    message: 'Plex rejected the write The preview is retained for review.',
    clearPreview: false,
  })
})

test('Marquee crash-ambiguous commit warns against retry and retains preview', async () => {
  const decision = await decide(result('intent-1', 'crash-ambiguous', 'Connection closed after dispatch'))
  assert.equal(decision.state, 'crash-ambiguous')
  assert.equal(decision.clearPreview, false)
  assert.match(decision.message, /do not retry/)
})

test('Marquee success clears preview only after complete validated matching result', async () => {
  const decision = await decide(result('intent-1', 'success', 'Playlist created'))
  assert.deepEqual(decision, { state: 'success', message: 'Playlist created', clearPreview: true })
})

test('Marquee transport ambiguity remains visible and retained for operator reconciliation', async () => {
  const decision = await decide({
    state: 'unavailable',
    reason: 'Commit transport was lost after dispatch',
    retryable: false,
    outcome: 'crash-ambiguous',
  })
  assert.equal(decision.state, 'crash-ambiguous')
  assert.equal(decision.clearPreview, false)
  assert.match(decision.message, /operator reconciliation/)
})
