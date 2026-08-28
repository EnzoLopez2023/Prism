import type { AppConfig } from '../config.js'

export interface TextModelDefinition {
  id: string
  label: string
  provider: string
  transport: 'openai-chat' | 'openai-responses' | 'anthropic'
  endpoint?: string
  apiKey?: string
  deployment: string
}

export interface ChatModelConfig {
  endpoint?: string
  apiKey?: string
  deployment: string
}

export interface ProviderResult {
  model: string
  content: string
  durationMs: number
  usage?: { inputTokens?: number; outputTokens?: number }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function endpoint(value: string | undefined): string | undefined {
  return value?.replace(/\/$/, '') || undefined
}

export function lmStudioEndpoint(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const configured = env.LMSTUDIO_ENDPOINT?.trim()
  if (!configured) return undefined
  try {
    const url = new URL(configured)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol === 'https:' || (url.protocol === 'http:' && (loopback || env.LMSTUDIO_ALLOW_INSECURE_HTTP === 'true'))) {
      return url.toString().replace(/\/$/, '')
    }
  } catch {
    return undefined
  }
  return undefined
}

export function chatModel(env: NodeJS.ProcessEnv = process.env): ChatModelConfig {
  return {
    endpoint: endpoint(env.CHAT_OPENAI_ENDPOINT || env.VIBE_OPENAI_ENDPOINT),
    apiKey: env.CHAT_OPENAI_API_KEY || env.VIBE_OPENAI_API_KEY,
    deployment: env.CHAT_OPENAI_DEPLOYMENT || env.VIBE_OPENAI_DEPLOYMENT || 'gpt-5.4',
  }
}

export function textModels(env: NodeJS.ProcessEnv = process.env): TextModelDefinition[] {
  return [
    { id: 'codex', label: 'GPT-5.3 Codex', provider: 'Azure AI Foundry', transport: 'openai-responses', endpoint: endpoint(env.CODEX_OPENAI_ENDPOINT || env.PRO_OPENAI_ENDPOINT), apiKey: env.CODEX_OPENAI_API_KEY || env.PRO_OPENAI_API_KEY || env.VIBE_OPENAI_API_KEY, deployment: env.CODEX_OPENAI_DEPLOYMENT || 'gpt-5.3-codex' },
    { id: 'gpt54', label: 'GPT-5.4', provider: 'Azure AI Foundry', transport: 'openai-chat', endpoint: endpoint(env.VIBE_OPENAI_ENDPOINT), apiKey: env.VIBE_OPENAI_API_KEY, deployment: env.VIBE_OPENAI_DEPLOYMENT || 'gpt-5.4' },
    { id: 'gpt54pro', label: 'GPT-5.4 Pro', provider: 'Azure AI Foundry', transport: 'openai-responses', endpoint: endpoint(env.PRO_OPENAI_ENDPOINT), apiKey: env.PRO_OPENAI_API_KEY || env.VIBE_OPENAI_API_KEY, deployment: env.PRO_OPENAI_DEPLOYMENT || 'gpt-5.4-pro' },
    { id: 'haiku', label: 'Claude Haiku 4.5', provider: 'Anthropic', transport: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', apiKey: env.ANTHROPIC_API_KEY, deployment: 'claude-haiku-4-5-20251001' },
    { id: 'sonnet', label: 'Claude Sonnet 4.6', provider: 'Anthropic', transport: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', apiKey: env.ANTHROPIC_API_KEY, deployment: 'claude-sonnet-4-6' },
    { id: 'lmstudio', label: 'Local model', provider: 'LM Studio', transport: 'openai-chat', endpoint: lmStudioEndpoint(env), apiKey: 'not-required', deployment: env.LMSTUDIO_MODEL || 'google/gemma-4-e4b' },
  ]
}

export function judgeModel(env: NodeJS.ProcessEnv = process.env): TextModelDefinition {
  return { id: 'opus-judge', label: 'Claude Opus 4.8', provider: 'Anthropic', transport: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', apiKey: env.ANTHROPIC_API_KEY, deployment: 'claude-opus-4-8' }
}

function providerError(message: string, code = 'PROVIDER_ERROR') {
  return Object.assign(new Error(message), { code })
}

export async function readJsonBounded(response: Response, maxBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > maxBytes) throw providerError('Provider response exceeds the configured limit', 'PROVIDER_RESPONSE_LIMIT')
  const reader = response.body?.getReader()
  if (!reader) return record(await response.json())
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      await reader.cancel()
      throw providerError('Provider response exceeds the configured limit', 'PROVIDER_RESPONSE_LIMIT')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return record(JSON.parse(new TextDecoder().decode(bytes))) }
  catch { throw providerError('Provider returned invalid JSON') }
}

export async function runTextModel(model: TextModelDefinition, prompt: string, config: AppConfig, parentSignal?: AbortSignal): Promise<ProviderResult> {
  if (!model.endpoint || !model.apiKey) throw providerError(`${model.label} is not configured`, 'PROVIDER_UNAVAILABLE')
  if (!prompt.trim() || prompt.length > config.limits.maxPromptChars) throw providerError('Prompt is empty or exceeds the configured limit', 'INVALID_PROMPT')
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(config.limits.providerTimeoutMs)]) : AbortSignal.timeout(config.limits.providerTimeoutMs)
  const started = performance.now()
  let response: Response
  if (model.transport === 'anthropic') {
    response = await fetch(model.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': model.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model.deployment, max_tokens: model.id === 'haiku' ? 1024 : 1500, messages: [{ role: 'user', content: prompt }] }),
      signal,
    })
  } else if (model.transport === 'openai-responses') {
    response = await fetch(`${model.endpoint}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` },
      body: JSON.stringify({ model: model.deployment, input: prompt, max_output_tokens: config.limits.maxOutputTokens }),
      signal,
    })
  } else {
    const isLmStudio = model.id === 'lmstudio'
    const url = `${model.endpoint}/chat/completions`
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(isLmStudio ? {} : { Authorization: `Bearer ${model.apiKey}` }) },
      body: JSON.stringify({
        model: model.deployment,
        messages: [{ role: 'user', content: prompt }],
        ...(model.id === 'gpt54' ? { store: true, max_completion_tokens: config.limits.maxOutputTokens } : {}),
        ...(isLmStudio ? { temperature: 0.2, max_tokens: 2000 } : {}),
      }),
      signal,
    })
  }
  if (!response.ok) throw providerError(`Provider request failed (${response.status})`)
  const data = await readJsonBounded(response, config.limits.maxProviderResponseBytes)
  const usage = record(data.usage)
  const anthropicContent = list(data.content).map(record).find(item => item.type === 'text')
  const responseOutput = list(data.output).map(record).find(item => item.type === 'message')
  const outputText = list(responseOutput?.content).map(record).find(item => item.type === 'output_text')
  const choiceMessage = record(record(list(data.choices)[0]).message)
  const content = model.transport === 'anthropic'
    ? String(anthropicContent?.text || '')
    : model.transport === 'openai-responses'
      ? String(outputText?.text || '')
      : String(choiceMessage.content || '')
  return {
    model: String(data.model || model.deployment),
    content,
    durationMs: Math.round(performance.now() - started),
    usage: {
      inputTokens: Number(usage.input_tokens ?? usage.prompt_tokens) || undefined,
      outputTokens: Number(usage.output_tokens ?? usage.completion_tokens) || undefined,
    },
  }
}

export interface ImageInput { prompt: string; size?: string; sourceImage?: string | null }

export function decodeImageDataUrl(value: string, maxBytes: number): { mime: string; bytes: Buffer } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value)
  if (!match) throw providerError('Source image must be a base64 image data URL', 'INVALID_IMAGE')
  if (Math.ceil((match[2]?.length || 0) * 3 / 4) > maxBytes + 2) throw providerError('Source image exceeds the configured limit', 'INVALID_IMAGE')
  const bytes = Buffer.from(match[2]!, 'base64')
  if (!bytes.length || bytes.length > maxBytes) throw providerError('Source image is empty or exceeds the configured limit', 'INVALID_IMAGE')
  return { mime: match[1]!, bytes }
}

export async function runImageModel(id: string, input: ImageInput, config: AppConfig, parentSignal?: AbortSignal): Promise<Record<string, unknown>> {
  if (!input.prompt.trim() || input.prompt.length > config.limits.maxPromptChars) throw providerError('Prompt is empty or exceeds the configured limit', 'INVALID_PROMPT')
  const size = input.size || '1024x1024'
  if (!['1024x1024', '1024x1536', '1536x1024'].includes(size)) throw providerError('Image size is not supported', 'INVALID_IMAGE')
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(config.limits.providerTimeoutMs)]) : AbortSignal.timeout(config.limits.providerTimeoutMs)
  const started = performance.now()
  let response: Response
  let deployment = id
  if (id === 'mai-image-2e') {
    const endpointValue = endpoint(process.env.MAI_IMAGE_ENDPOINT)
    const apiKey = process.env.MAI_IMAGE_API_KEY
    deployment = process.env.MAI_IMAGE_DEPLOYMENT || 'MAI-Image-2e'
    if (!endpointValue || !apiKey) throw providerError(`${id} is not configured`, 'PROVIDER_UNAVAILABLE')
    const [requestedWidth, requestedHeight] = size.split('x').map(Number)
    let width = Number.isFinite(requestedWidth) ? requestedWidth! : 1024
    let height = Number.isFinite(requestedHeight) ? requestedHeight! : 1024
    if (width * height > 1_048_576) {
      const scale = Math.sqrt(1_048_576 / (width * height))
      width = Math.max(2, Math.floor(width * scale / 2) * 2)
      height = Math.max(2, Math.floor(height * scale / 2) * 2)
    }
    response = await fetch(`${endpointValue}/mai/v1/images/generations?api-version=${process.env.MAI_IMAGE_API_VERSION || 'preview'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({ model: deployment, prompt: input.prompt, width, height, n: 1 }),
      signal,
    })
  } else {
    const endpointValue = endpoint(process.env.GPT_IMAGE_ENDPOINT)
    const apiKey = process.env.GPT_IMAGE_API_KEY
    if (!endpointValue || !apiKey) throw providerError(`${id} is not configured`, 'PROVIDER_UNAVAILABLE')
    const apiVersion = process.env.GPT_IMAGE_API_VERSION || '2025-04-01-preview'
    if (input.sourceImage) {
      const source = decodeImageDataUrl(input.sourceImage, config.limits.maxImageBytes)
      const extension = source.mime === 'image/jpeg' ? 'jpg' : source.mime === 'image/webp' ? 'webp' : source.mime === 'image/gif' ? 'gif' : 'png'
      const form = new FormData()
      form.append('image', new Blob([new Uint8Array(source.bytes)], { type: source.mime }), `source.${extension}`)
      form.append('prompt', input.prompt)
      form.append('size', size)
      form.append('n', '1')
      response = await fetch(`${endpointValue}/openai/deployments/${id}/images/edits?api-version=${apiVersion}`, { method: 'POST', headers: { 'api-key': apiKey }, body: form, signal })
    } else {
      response = await fetch(`${endpointValue}/openai/deployments/${id}/images/generations?api-version=${apiVersion}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({ prompt: input.prompt, size, n: 1 }),
        signal,
      })
    }
  }
  if (!response.ok) throw providerError(`Image provider request failed (${response.status})`)
  const data = await readJsonBounded(response, config.limits.maxProviderResponseBytes)
  const firstData = record(list(data.data)[0])
  const b64 = firstData.b64_json ?? firstData.image ?? data.b64_json
  if (typeof b64 !== 'string' || Buffer.byteLength(b64, 'base64') > config.limits.maxImageBytes) throw providerError('Provider returned no image or exceeded the output limit', 'PROVIDER_RESPONSE_LIMIT')
  return { model: data.model || deployment, image: `data:image/png;base64,${b64}`, durationMs: Math.round(performance.now() - started), mode: input.sourceImage && id !== 'mai-image-2e' ? 'edit' : 'generate' }
}
