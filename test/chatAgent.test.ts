import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { AppConfig } from '../server/config.js'
import { executeChatTool, prepareMessages, streamChatAgent, SYSTEM_PROMPT } from '../server/chat/agent.js'
import type { CrossAppClients } from '../server/clients/contracts.js'
import { testRepository } from './helpers.js'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }
afterEach(() => { globalThis.fetch = originalFetch; Object.assign(process.env, originalEnv) })
const config: AppConfig = {
  port: 0, environment: 'test', dbPath: ':memory:', artifactRoot: '', auth: { mode: 'development' },
  limits: { jsonBytes: 50_000_000, providerTimeoutMs: 5_000, maxPromptChars: 32_000, maxOutputTokens: 8_192, maxImageBytes: 1_000_000, maxProviderResponseBytes: 1_000_000 },
}

test('chat injects the frozen system contract and attaches bounded vision blocks', () => {
  const image = `data:image/png;base64,${Buffer.from('image').toString('base64')}`
  const prepared = prepareMessages([{ role: 'user', content: 'What is this?' }], [image], config)
  assert.equal(prepared.messages[0]?.role, 'system')
  assert.equal(prepared.messages[0]?.content, SYSTEM_PROMPT)
  assert.deepEqual(prepared.messages[1]?.content, [
    { type: 'text', text: 'What is this?' },
    { type: 'image_url', image_url: { url: image } },
  ])
  assert.equal(prepared.sourceImage, image)
})

test('streaming chat executes a bounded domain tool round and feeds structured tool output back', async t => {
  process.env.CHAT_OPENAI_ENDPOINT = 'https://chat.example/openai/v1'
  process.env.CHAT_OPENAI_API_KEY = 'secret'
  const fixture = testRepository()
  t.after(() => fixture.close())
  const identity = { tenantId: '00000000-0000-4000-8000-000000000001', oid: '00000000-0000-4000-8000-000000000002' }
  const disabled = async () => ({ state: 'disabled' as const, reason: 'not configured' })
  const clients: CrossAppClients = {
    hearth: { read: disabled }, lantern: { read: disabled }, watchtower: { read: disabled },
    marquee: {
      search: async query => ({ state: 'available', data: { schema: 'marquee.media-search.v1', items: [{ id: 'm1', title: query, year: 2024, mediaType: 'movie', libraryId: 'l1', libraryName: 'Movies', artworkRef: null, durationMs: null, summary: null }] } }),
      prepare: disabled, commit: disabled,
    },
  }
  const requestBodies: Record<string, unknown>[] = []
  let call = 0
  globalThis.fetch = async (_input, init = {}) => {
    requestBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
    call += 1
    const payload = call === 1
      ? { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'search_media', arguments: '{"query":"Dune"}' } }] }, finish_reason: 'tool_calls' }] }
      : { choices: [{ delta: { content: 'Found Dune.' }, finish_reason: 'stop' }] }
    return new Response(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`, { status: 200 })
  }
  const writes: string[] = []
  const res = { write(value: string) { writes.push(value); return true } } as unknown as import('express').Response
  await streamChatAgent({ input: [{ role: 'user', content: 'Find Dune' }], images: [], config, clients, repository: fixture.repository, identity, res, signal: new AbortController().signal })
  assert.equal(call, 2)
  assert.equal(requestBodies[0]?.model, 'gpt-5.4')
  assert.equal(requestBodies[0]?.max_completion_tokens, 8192)
  assert.ok(Array.isArray(requestBodies[0]?.tools))
  const secondMessages = requestBodies[1]?.messages as { role: string; content?: string }[]
  assert.equal(secondMessages.at(-1)?.role, 'tool')
  assert.match(secondMessages.at(-1)?.content || '', /marquee\.media-search\.v1/)
  assert.match(writes.join(''), /search_media.*running/)
  assert.match(writes.join(''), /Found Dune/)
})

test('local prompt tool is paginated, field-truncated, and byte bounded', async t => {
  const fixture = testRepository()
  t.after(() => fixture.close())
  const identity = { tenantId: '00000000-0000-4000-8000-000000000001', oid: '00000000-0000-4000-8000-000000000002' }
  for (let index = 0; index < 8; index += 1) {
    await fixture.repository.savePrompt(identity, null, {
      title: `Prompt ${index} ${'題'.repeat(200)}`,
      body: '文'.repeat(10_000),
      category: 'Category'.repeat(20),
      tags: Array(30).fill('tag'.repeat(100)),
      model: 'model'.repeat(50),
    })
  }
  const disabled = async () => ({ state: 'disabled' as const, reason: 'not configured' })
  const clients: CrossAppClients = {
    hearth: { read: disabled }, lantern: { read: disabled }, watchtower: { read: disabled },
    marquee: { search: disabled, prepare: disabled, commit: disabled },
  }
  const first = await executeChatTool({ name: 'query_app_data', args: { area: 'prompts', page: 1 }, sourceImage: null, clients, repository: fixture.repository, identity, config, signal: new AbortController().signal })
  assert.ok(Buffer.byteLength(first.resultText, 'utf8') <= 16_000)
  const firstPage = JSON.parse(first.resultText.split('\n').slice(1).join('\n')) as { page: number; nextPage: number; items: unknown[] }
  assert.equal(firstPage.items.length, 5)
  assert.equal(firstPage.nextPage, 2)
  const second = await executeChatTool({ name: 'query_app_data', args: { area: 'prompts', page: 2 }, sourceImage: null, clients, repository: fixture.repository, identity, config, signal: new AbortController().signal })
  const secondPage = JSON.parse(second.resultText.split('\n').slice(1).join('\n')) as { items: unknown[] }
  assert.equal(secondPage.items.length, 3)
})
