import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { HttpContractClient, HttpMarqueeClient, ownedAppValidator } from '../server/clients/httpContractClient.js'
import { UnavailableTokenProvider } from '../server/clients/workloadToken.js'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('undeployed cross-app contracts return typed disabled states without fake data', async () => {
  const tokens = new UnavailableTokenProvider()
  assert.deepEqual(await new HttpContractClient(undefined, undefined, tokens, ownedAppValidator('hearth')).read('/status'), { state: 'disabled', reason: 'Contract endpoint is not configured' })
  const marquee = new HttpMarqueeClient(undefined, undefined, tokens)
  assert.deepEqual(await marquee.search('movie'), { state: 'disabled', reason: 'Contract endpoint is not configured' })
  assert.deepEqual(await marquee.prepare('playlists', {}), { state: 'disabled', reason: 'Contract endpoint is not configured' })
})

test('Marquee contract types freeze exact v1 schema identifiers', () => {
  const search = { schema: 'marquee.media-search.v1' as const, items: [] }
  const intent = { schema: 'marquee.mutation-intent.v1' as const, intentId: 'i', confirmationPhrase: 'CONFIRM', expiresAt: new Date(0).toISOString(), preview: { title: 't', media: [] } }
  assert.equal(search.schema, 'marquee.media-search.v1')
  assert.equal(intent.schema, 'marquee.mutation-intent.v1')
})

test('cross-app clients bound response bytes and reject invalid runtime schemas', async () => {
  const tokens = { async getToken() { return 'token' } }
  const marquee = new HttpMarqueeClient('https://marquee.example', 'api://marquee', tokens)
  globalThis.fetch = async () => new Response('{}', { headers: { 'content-length': String(3 * 1024 * 1024) } })
  const oversized = await marquee.search('Dune')
  assert.equal(oversized.state, 'unavailable')
  assert.match(oversized.reason, /response limit/)

  globalThis.fetch = async () => new Response(JSON.stringify({ schema: 'marquee.media-search.v1', items: [{ id: 'missing-fields' }] }))
  const invalid = await marquee.search('Dune')
  assert.deepEqual(invalid, { state: 'unavailable', reason: 'Upstream returned an invalid contract', retryable: false })

  globalThis.fetch = async () => new Response(JSON.stringify({
    schema: 'marquee.mutation-intent.v1',
    intentId: '   ',
    confirmationPhrase: '',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    preview: { title: 'Playlist', media: [] },
  }))
  const unsafePreview = await marquee.prepare('playlists', {})
  assert.equal(unsafePreview.state, 'unavailable')
})

test('owned-app contracts accept only app-specific v1 runtime shapes', async () => {
  const tokens = { async getToken() { return 'token' } }
  const hearth = new HttpContractClient('https://hearth.example', 'api://hearth', tokens, ownedAppValidator('hearth'))
  globalThis.fetch = async () => new Response(JSON.stringify({ schema: 'watchtower.status.v1', generatedAt: new Date().toISOString(), status: 'healthy' }))
  assert.equal((await hearth.read('/api/contracts/v1/status')).state, 'unavailable')
  globalThis.fetch = async () => new Response(JSON.stringify({ schema: 'hearth.search.v1', generatedAt: new Date().toISOString(), results: [] }))
  assert.equal((await hearth.read('/api/contracts/v1/search')).state, 'available')
})

test('owned-app contracts reject malformed nested Hearth, Lantern, and Watchtower elements', async () => {
  const tokens = { async getToken() { return 'token' } }
  const now = new Date().toISOString()
  const hearth = new HttpContractClient('https://hearth.example', 'api://hearth', tokens, ownedAppValidator('hearth'))
  const lantern = new HttpContractClient('https://lantern.example', 'api://lantern', tokens, ownedAppValidator('lantern'))
  const watchtower = new HttpContractClient('https://watchtower.example', 'api://watchtower', tokens, ownedAppValidator('watchtower'))
  for (const badItem of [null, 'primitive', { area: 'kb', title: 'Missing text' }]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ schema: 'hearth.search.v1', generatedAt: now, results: [badItem] }))
    assert.equal((await hearth.read('/api/contracts/v1/search')).state, 'unavailable')
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ schema: 'lantern.study-summaries.v1', generatedAt: now, summaries: [{ id: 's1', title: 'Study', summary: null, updatedAt: now, mode: null, score: null }] }))
  assert.equal((await lantern.read('/api/contracts/v1/study/summaries')).state, 'unavailable')
  globalThis.fetch = async () => new Response(JSON.stringify({ schema: 'watchtower.status.v1', generatedAt: now, status: 'healthy', components: [{ name: 'WAN', status: 'healthy', summary: 'Online', observedAt: 42 }] }))
  assert.equal((await watchtower.read('/api/contracts/v1/status')).state, 'unavailable')
})

test('Marquee commit transport loss after dispatch is nonretryable crash-ambiguous', async () => {
  const tokens = { async getToken() { return 'token' } }
  const marquee = new HttpMarqueeClient('https://marquee.example', 'api://marquee', tokens)
  globalThis.fetch = async () => { throw new TypeError('network lost') }
  assert.deepEqual(await marquee.commit('playlists', 'intent-1', 'CONFIRM intent-1'), {
    state: 'unavailable',
    reason: 'Marquee commit transport was lost after dispatch; the outcome is crash-ambiguous and must not be retried',
    retryable: false,
    outcome: 'crash-ambiguous',
  })

})

test('Marquee commit HTTP 5xx after dispatch is nonretryable crash-ambiguous', async () => {
  const tokens = { async getToken() { return 'token' } }
  const marquee = new HttpMarqueeClient('https://marquee.example', 'api://marquee', tokens)
  globalThis.fetch = async () => new Response('upstream failed', { status: 503 })
  const result = await marquee.commit('collections', 'intent-1', 'CONFIRM intent-1')
  assert.deepEqual(result, {
    state: 'unavailable',
    reason: 'Marquee commit returned 503 after dispatch; the outcome is crash-ambiguous and must not be retried',
    retryable: false,
    outcome: 'crash-ambiguous',
  })
})
