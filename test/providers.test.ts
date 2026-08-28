import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { AppConfig } from '../server/config.js'
import { chatModel, judgeModel, lmStudioEndpoint, runImageModel, runTextModel, textModels } from '../server/providers/providerService.js'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }
afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
})

const config: AppConfig = {
  port: 0, environment: 'test', dbPath: ':memory:', artifactRoot: '', auth: { mode: 'development' },
  limits: { jsonBytes: 50 * 1024 * 1024, providerTimeoutMs: 5_000, maxPromptChars: 32_000, maxOutputTokens: 8_192, maxImageBytes: 32, maxProviderResponseBytes: 1_000_000 },
}

function jsonResponse(value: object) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

test('frozen Foundry text contracts use project-base suffixes, bearer auth, and exact payloads', async () => {
  process.env.VIBE_OPENAI_ENDPOINT = 'https://foundry.example/openai/v1/'
  process.env.VIBE_OPENAI_API_KEY = 'vibe-secret'
  process.env.PRO_OPENAI_ENDPOINT = 'https://foundry.example/openai/v1/'
  process.env.PRO_OPENAI_API_KEY = 'pro-secret'
  const calls: Array<{ url: string; init: RequestInit }> = []
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init })
    return calls.length === 1
      ? jsonResponse({ model: 'gpt-5.4', choices: [{ message: { content: 'chat' } }], usage: {} })
      : jsonResponse({ model: 'gpt-5.4-pro', output: [{ type: 'message', content: [{ type: 'output_text', text: 'pro' }] }], usage: {} })
  }
  const models = textModels()
  await runTextModel(models.find(model => model.id === 'gpt54')!, 'hello', config)
  await runTextModel(models.find(model => model.id === 'gpt54pro')!, 'hello', config)
  assert.equal(calls[0]?.url, 'https://foundry.example/openai/v1/chat/completions')
  assert.equal(new Headers(calls[0]?.init.headers).get('authorization'), 'Bearer vibe-secret')
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { model: 'gpt-5.4', messages: [{ role: 'user', content: 'hello' }], store: true, max_completion_tokens: 8192 })
  assert.equal(calls[1]?.url, 'https://foundry.example/openai/v1/responses')
  assert.equal(new Headers(calls[1]?.init.headers).get('authorization'), 'Bearer pro-secret')
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), { model: 'gpt-5.4-pro', input: 'hello', max_output_tokens: 8192 })
})

test('chat configuration preserves CHAT_OPENAI fallback precedence', () => {
  assert.deepEqual(chatModel({ VIBE_OPENAI_ENDPOINT: 'https://vibe/', VIBE_OPENAI_API_KEY: 'v', VIBE_OPENAI_DEPLOYMENT: 'vibe-model' }), {
    endpoint: 'https://vibe', apiKey: 'v', deployment: 'vibe-model',
  })
  assert.deepEqual(chatModel({ CHAT_OPENAI_ENDPOINT: 'https://chat/', CHAT_OPENAI_API_KEY: 'c', CHAT_OPENAI_DEPLOYMENT: 'chat-model', VIBE_OPENAI_ENDPOINT: 'https://vibe', VIBE_OPENAI_API_KEY: 'v' }), {
    endpoint: 'https://chat', apiKey: 'c', deployment: 'chat-model',
  })
})

test('Opus 4.8 judge and LM Studio preserve frozen model and request contracts', async () => {
  process.env.ANTHROPIC_API_KEY = 'anthropic-secret'
  process.env.LMSTUDIO_ENDPOINT = 'https://lmstudio.example/v1/'
  const calls: Array<{ url: string; init: RequestInit }> = []
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init })
    return calls.length === 1
      ? jsonResponse({ model: 'claude-opus-4-8', content: [{ type: 'text', text: 'judged' }], usage: {} })
      : jsonResponse({ model: 'gemma', choices: [{ message: { content: 'local' } }], usage: {} })
  }
  await runTextModel(judgeModel(), 'judge this', config)
  await runTextModel(textModels().find(model => model.id === 'lmstudio')!, 'local prompt', config)
  assert.equal(JSON.parse(String(calls[0]?.init.body)).model, 'claude-opus-4-8')
  assert.equal(calls[1]?.url, 'https://lmstudio.example/v1/chat/completions')
  assert.equal(new Headers(calls[1]?.init.headers).has('authorization'), false)
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), {
    model: 'google/gemma-4-e4b',
    messages: [{ role: 'user', content: 'local prompt' }],
    temperature: 0.2,
    max_tokens: 2000,
  })

})

test('LM Studio has no implicit endpoint and missing configuration makes no request', async () => {
  delete process.env.LMSTUDIO_ENDPOINT
  let requests = 0
  globalThis.fetch = async () => { requests += 1; return jsonResponse({}) }
  const model = textModels().find(item => item.id === 'lmstudio')!
  assert.equal(model.endpoint, undefined)
  await assert.rejects(runTextModel(model, 'private prompt', config), /not configured/)
  assert.equal(requests, 0)
})

test('LM Studio rejects unsafe or malformed URLs unless insecure HTTP is explicitly opted in', () => {
  assert.equal(lmStudioEndpoint({ LMSTUDIO_ENDPOINT: 'not a url' }), undefined)
  assert.equal(lmStudioEndpoint({ LMSTUDIO_ENDPOINT: 'ftp://models.example/v1' }), undefined)
  assert.equal(lmStudioEndpoint({ LMSTUDIO_ENDPOINT: 'http://models.example/v1' }), undefined)
  assert.equal(lmStudioEndpoint({ LMSTUDIO_ENDPOINT: 'http://127.0.0.1:1234/v1' }), 'http://127.0.0.1:1234/v1')
  assert.equal(lmStudioEndpoint({ LMSTUDIO_ENDPOINT: 'http://[::1]:1234/v1' }), 'http://[::1]:1234/v1')
  assert.equal(lmStudioEndpoint({ LMSTUDIO_ENDPOINT: 'https://models.example/v1/' }), 'https://models.example/v1')
  assert.equal(lmStudioEndpoint({ LMSTUDIO_ENDPOINT: 'http://models.example/v1', LMSTUDIO_ALLOW_INSECURE_HTTP: 'true' }), 'http://models.example/v1')
})

test('GPT image generation and multipart edit preserve frozen Azure contracts', async () => {
  process.env.GPT_IMAGE_ENDPOINT = 'https://images.example'
  process.env.GPT_IMAGE_API_KEY = 'image-secret'
  const calls: Array<{ url: string; init: RequestInit }> = []
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init })
    return jsonResponse({ data: [{ b64_json: Buffer.from('image').toString('base64') }] })
  }
  await runImageModel('gpt-image-2', { prompt: 'draw', size: '1024x1024' }, config)
  await runImageModel('gpt-image-2', { prompt: 'edit', size: '1024x1536', sourceImage: `data:image/jpeg;base64,${Buffer.from('source').toString('base64')}` }, config)
  assert.equal(calls[0]?.url, 'https://images.example/openai/deployments/gpt-image-2/images/generations?api-version=2025-04-01-preview')
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { prompt: 'draw', size: '1024x1024', n: 1 })
  assert.equal(calls[1]?.url, 'https://images.example/openai/deployments/gpt-image-2/images/edits?api-version=2025-04-01-preview')
  assert.ok(calls[1]?.init.body instanceof FormData)
  const form = calls[1]!.init.body as FormData
  assert.equal(form.get('prompt'), 'edit')
  assert.equal(form.get('size'), '1024x1536')
  assert.equal((form.get('image') as File).name, 'source.jpg')
})

test('MAI uses /mai/v1 and bounded width/height while source/output limits fail closed', async () => {
  process.env.MAI_IMAGE_ENDPOINT = 'https://mai.example/'
  process.env.MAI_IMAGE_API_KEY = 'mai-secret'
  process.env.GPT_IMAGE_ENDPOINT = 'https://images.example'
  process.env.GPT_IMAGE_API_KEY = 'image-secret'
  let captured: { url: string; body: Record<string, unknown> } | null = null
  globalThis.fetch = async (input, init = {}) => {
    captured = { url: String(input), body: JSON.parse(String(init.body)) as Record<string, unknown> }
    return jsonResponse({ data: [{ b64_json: Buffer.from('image').toString('base64') }] })
  }
  await runImageModel('mai-image-2e', { prompt: 'draw', size: '1024x1536' }, config)
  assert.equal(captured!.url, 'https://mai.example/mai/v1/images/generations?api-version=preview')
  assert.ok(Number(captured!.body.width) * Number(captured!.body.height) <= 1_048_576)
  captured = null
  await assert.rejects(runImageModel('mai-image-2e', { prompt: 'draw', size: '2000000x-1' }, config), /not supported/)
  assert.equal(captured, null)
  await assert.rejects(runImageModel('gpt-image-2', { prompt: 'edit', sourceImage: `data:image/png;base64,${Buffer.alloc(64).toString('base64')}` }, config), /exceeds/)
})

test('provider cancellation and response limits abort without consuming unbounded bodies', async () => {
  process.env.VIBE_OPENAI_ENDPOINT = 'https://foundry.example/openai/v1'
  process.env.VIBE_OPENAI_API_KEY = 'secret'
  const controller = new AbortController()
  globalThis.fetch = async (_input, init = {}) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
  const pending = runTextModel(textModels().find(model => model.id === 'gpt54')!, 'hello', config, controller.signal)
  controller.abort()
  await assert.rejects(pending, /Aborted/)

  globalThis.fetch = async () => new Response('{"choices":[]}', { headers: { 'content-length': '100' } })
  await assert.rejects(runTextModel(textModels().find(model => model.id === 'gpt54')!, 'hello', { ...config, limits: { ...config.limits, maxProviderResponseBytes: 10 } }), /exceeds/)
})
