import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { createApp } from '../server/app.js'
import type { CrossAppClients } from '../server/clients/contracts.js'
import type { AppConfig } from '../server/config.js'
import { testRepository } from './helpers.js'

const unavailable = async () => ({ state: 'disabled' as const, reason: 'not configured' })
const clients: CrossAppClients = {
  hearth: { read: unavailable }, lantern: { read: unavailable }, watchtower: { read: unavailable },
  marquee: { search: unavailable, prepare: unavailable, commit: unavailable },
}
function config(mode: 'development' | 'entra'): AppConfig {
  return {
    port: 0, environment: 'test', dbPath: ':memory:', artifactRoot: '',
    auth: mode === 'entra' ? { mode, tenantId: '00000000-0000-4000-8000-000000000001', audience: 'api://prism' } : { mode },
    limits: { jsonBytes: 2_000_000, providerTimeoutMs: 100, maxPromptChars: 32_000, maxOutputTokens: 100, maxImageBytes: 1_000_000, maxProviderResponseBytes: 1_000_000 },
  }
}
async function serve(mode: 'development' | 'entra', appClients: CrossAppClients = clients) {
  const fixture = testRepository()
  const server = createServer(createApp(config(mode), fixture.repository, appClients)).listen(0)
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No test address')
  return { fixture, server, base: `http://127.0.0.1:${address.port}` }
}

test('liveness is unauthenticated while data routes require tokens in Entra mode', async t => {
  const app = await serve('entra')
  t.after(() => { app.server.close(); app.fixture.close() })
  assert.equal((await fetch(`${app.base}/api/live`)).status, 200)
  const response = await fetch(`${app.base}/api/conversations`)
  assert.equal(response.status, 401)
  assert.equal((await response.json() as { code: string }).code, 'AUTH_REQUIRED')
})

test('conversation and prompt routes persist through repository contracts', async t => {
  const app = await serve('development')
  t.after(() => { app.server.close(); app.fixture.close() })
  const create = await fetch(`${app.base}/api/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Route test' }) })
  assert.equal(create.status, 201)
  const conversation = (await create.json() as { conversation: { id: number } }).conversation
  const message = await fetch(`${app.base}/api/conversations/${conversation.id}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { id: 'route-message', type: 'user', content: 'hello', timestamp: new Date().toISOString() } }) })
  assert.equal(message.status, 201)
  const prompt = await fetch(`${app.base}/api/prompts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Saved', body: 'Be precise', tags: ['test'] }) })
  assert.equal(prompt.status, 201)
  const listed = await fetch(`${app.base}/api/prompts`)
  assert.equal((await listed.json() as unknown[]).length, 1)
})

test('analysis route is registered before the dynamic model route', async t => {
  const app = await serve('development')
  t.after(() => { app.server.close(); app.fixture.close() })
  const response = await fetch(`${app.base}/api/ai-test/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Compare', responses: { model: { content: 'Answer' } } }),
  })

  assert.equal(response.status, 503)
  assert.equal((await response.json() as { code: string }).code, 'PROVIDER_UNAVAILABLE')
})

test('Marquee commit audit reflects inner failed outcome instead of available transport', async t => {
  const failedClients: CrossAppClients = {
    ...clients,
    marquee: {
      search: unavailable,
      prepare: unavailable,
      commit: async (_kind, intentId) => ({
        state: 'available',
        data: { schema: 'marquee.mutation-result.v1', intentId, state: 'failed', result: { message: 'Plex rejected the write' } },
      }),
    },
  }
  const app = await serve('development', failedClients)
  t.after(() => { app.server.close(); app.fixture.close() })
  const response = await fetch(`${app.base}/api/media/playlists/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId: 'intent-1', confirmationPhrase: 'CONFIRM intent-1' }),
  })

  assert.equal(response.status, 200)
  const audit = app.fixture.db.prepare("SELECT outcome,detail_json FROM app_audit_log WHERE resource_type='marquee.playlists'").get() as { outcome: string; detail_json: string }
  assert.equal(audit.outcome, 'failure')
  assert.deepEqual(JSON.parse(audit.detail_json), { mutationState: 'failed' })
})

test('Marquee commit rejects mismatched returned intent before success response or audit', async t => {
  const mismatchClients: CrossAppClients = {
    ...clients,
    marquee: {
      search: unavailable,
      prepare: unavailable,
      commit: async () => ({
        state: 'available',
        data: { schema: 'marquee.mutation-result.v1', intentId: 'different-intent', state: 'success', result: { message: 'Created wrong intent' } },
      }),
    },
  }
  const app = await serve('development', mismatchClients)
  t.after(() => { app.server.close(); app.fixture.close() })
  const response = await fetch(`${app.base}/api/media/playlists/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId: 'intent-1', confirmationPhrase: 'CONFIRM intent-1' }),
  })

  const body = await response.json() as { state: string; retryable: boolean; reason: string }
  assert.equal(body.state, 'unavailable')
  assert.equal(body.retryable, false)
  assert.match(body.reason, /mismatched intent/)
  const audit = app.fixture.db.prepare("SELECT outcome,detail_json FROM app_audit_log WHERE resource_type='marquee.playlists'").get() as { outcome: string; detail_json: string }
  assert.equal(audit.outcome, 'failure')
  assert.deepEqual(JSON.parse(audit.detail_json), { mutationState: 'intent-mismatch-ambiguous' })
})

test('Marquee crash-ambiguous transport outcome is audited as failure', async t => {
  const ambiguousClients: CrossAppClients = {
    ...clients,
    marquee: {
      search: unavailable,
      prepare: unavailable,
      commit: async () => ({
        state: 'unavailable',
        reason: 'transport lost after dispatch',
        retryable: false,
        outcome: 'crash-ambiguous',
      }),
    },
  }
  const app = await serve('development', ambiguousClients)
  t.after(() => { app.server.close(); app.fixture.close() })
  await fetch(`${app.base}/api/media/playlists/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId: 'intent-1', confirmationPhrase: 'CONFIRM intent-1' }),
  })
  const audit = app.fixture.db.prepare("SELECT outcome,detail_json FROM app_audit_log WHERE resource_type='marquee.playlists'").get() as { outcome: string; detail_json: string }
  assert.equal(audit.outcome, 'failure')
  assert.deepEqual(JSON.parse(audit.detail_json), { mutationState: 'crash-ambiguous' })
})
