import type { Response } from 'express'
import type { PrismRepository, Identity } from '../../lib/db/repositories/prismRepository.js'
import type { CrossAppClients, Availability } from '../clients/contracts.js'
import type { AppConfig } from '../config.js'
import { chatModel, decodeImageDataUrl, readJsonBounded, runImageModel } from '../providers/providerService.js'

type ChatRole = 'system' | 'user' | 'assistant' | 'tool'
export interface ChatMessage {
  role: ChatRole
  content: string | null | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
  tool_calls?: ToolCall[]
  tool_call_id?: string
}
interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
interface ToolAccumulator { id: string; name: string; arguments: string }

export const SYSTEM_PROMPT = [
  "You are Prism's built-in AI assistant. Prism is the private AI workbench extracted from the household portfolio.",
  'Its features include AI Assistant, Prompt Library, AI Test Lab, AI Image Test Lab, and a browser-only Data Converter.',
  'Household data belongs to Hearth, study summaries belong to Lantern, infrastructure status belongs to Watchtower, and media belongs to Marquee.',
  '',
  'You have tools — use them instead of guessing:',
  '- search_hearth: search Hearth technical and household knowledge through its authenticated contract.',
  "- query_app_data: query the user's prompts locally or household/study data through the owning app contract.",
  '- query_network and query_cameras: query Watchtower status through its authenticated contract.',
  '- query_garden: query Hearth garden data through its authenticated contract.',
  '- search_media: search Marquee media. Never claim a playlist or collection was changed; Prism requires a separate prepare/confirm/commit flow.',
  "- generate_image: create or edit an image. Attached photos are passed as vision blocks and the first is the image-edit source.",
  'When a user attaches a photo, inspect the vision content directly and answer questions about it.',
  'If a contract is disabled or unavailable, say so explicitly. Never invent success-shaped data.',
  '',
  'Format responses in Markdown: **bold** for emphasis, bullet lists, and headings where helpful. Be concise and friendly.',
].join('\n')

export const CHAT_TOOLS = [
  { type: 'function', function: { name: 'search_hearth', description: "Search Hearth's technical and household knowledge through its authenticated service contract.", parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'query_app_data', description: 'Look up live app-owned data. Areas: recipes, inventory, maintenance, home_items, warranties, maintenance_costs, pool, pool_insights, yard, exam_scores, prompts. Prompt results are paginated.', parameters: { type: 'object', properties: { area: { type: 'string', enum: ['recipes','inventory','maintenance','home_items','warranties','maintenance_costs','pool','pool_insights','yard','exam_scores','prompts'] }, query: { type: 'string' }, page: { type: 'integer', minimum: 1, maximum: 100 } }, required: ['area'] } } },
  { type: 'function', function: { name: 'query_network', description: 'Look up current network and WAN status through Watchtower.', parameters: { type: 'object', properties: { query: { type: 'string' } } } } },
  { type: 'function', function: { name: 'query_cameras', description: 'Look up camera, Protect sensor, and NVR status through Watchtower.', parameters: { type: 'object', properties: { query: { type: 'string' } } } } },
  { type: 'function', function: { name: 'query_garden', description: 'Look up garden profile, plantings, tasks, harvests, and shopping through Hearth.', parameters: { type: 'object', properties: { query: { type: 'string' } } } } },
  { type: 'function', function: { name: 'search_media', description: 'Search Marquee media without exposing Plex credentials or mutating data.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'generate_image', description: 'Generate an image or edit the first attached image.', parameters: { type: 'object', properties: { prompt: { type: 'string' }, size: { type: 'string', enum: ['1024x1024','1024x1536','1536x1024'] } }, required: ['prompt'] } } },
] as const

function availabilityText<T>(label: string, result: Availability<T>): string {
  return result.state === 'available' ? `${label}:\n${JSON.stringify(result.data)}` : `${label} is ${result.state}: ${result.reason}`
}

export async function executeChatTool(options: {
  name: string
  args: Record<string, unknown>
  sourceImage: string | null
  clients: CrossAppClients
  repository: PrismRepository
  identity: Identity
  config: AppConfig
  signal: AbortSignal
}): Promise<{ resultText: string; image?: string }> {
  const query = String(options.args.query || '').slice(0, 500)
  switch (options.name) {
    case 'search_hearth':
      return { resultText: availabilityText('Hearth search', await options.clients.hearth.read(`/api/contracts/v1/search?q=${encodeURIComponent(query)}`, options.signal)) }
    case 'query_app_data': {
      const area = String(options.args.area || '')
      if (area === 'prompts') {
        const requestedPage = Number(options.args.page)
        const page = Number.isSafeInteger(requestedPage) ? Math.min(100, Math.max(1, requestedPage)) : 1
        const pageSize = 5
        const rows = await options.repository.listPrompts(options.identity, {
          search: query,
          sort: 'updated_at',
          order: 'desc',
          limit: String(pageSize),
          offset: String((page - 1) * pageSize),
        })
        const items = rows.map(row => {
          const value = row as Record<string, unknown>
          return {
            id: value.id,
            title: String(value.title || '').slice(0, 50),
            category: String(value.category || '').slice(0, 20),
            tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 2).map(tag => tag.slice(0, 20)) : [],
            model: value.model === null ? null : String(value.model || '').slice(0, 30),
            is_favorite: value.is_favorite,
            usage_count: value.usage_count,
            body: String(value.body || '').slice(0, 150),
          }
        })
        const resultText = `Prism prompts:\n${JSON.stringify({ page, nextPage: items.length === pageSize && page < 100 ? page + 1 : null, items })}`
        if (Buffer.byteLength(resultText, 'utf8') > 16_000) throw new Error('Prompt tool result exceeded the configured limit')
        return { resultText }
      }
      if (area === 'exam_scores') return { resultText: availabilityText('Lantern study summaries', await options.clients.lantern.read(`/api/contracts/v1/study/summaries?q=${encodeURIComponent(query)}`, options.signal)) }
      return { resultText: availabilityText(`Hearth ${area}`, await options.clients.hearth.read(`/api/contracts/v1/household/query?area=${encodeURIComponent(area)}&q=${encodeURIComponent(query)}`, options.signal)) }
    }
    case 'query_network':
      return { resultText: availabilityText('Watchtower network status', await options.clients.watchtower.read(`/api/contracts/v1/status?domain=network&q=${encodeURIComponent(query)}`, options.signal)) }
    case 'query_cameras':
      return { resultText: availabilityText('Watchtower Protect status', await options.clients.watchtower.read(`/api/contracts/v1/status?domain=protect&q=${encodeURIComponent(query)}`, options.signal)) }
    case 'query_garden':
      return { resultText: availabilityText('Hearth garden', await options.clients.hearth.read(`/api/contracts/v1/household/query?area=garden&q=${encodeURIComponent(query)}`, options.signal)) }
    case 'search_media':
      return { resultText: availabilityText('Marquee media search', await options.clients.marquee.search(query, options.signal)) }
    case 'generate_image': {
      const result = await runImageModel('gpt-image-2', {
        prompt: String(options.args.prompt || ''),
        size: String(options.args.size || '1024x1024'),
        sourceImage: options.sourceImage,
      }, options.config, options.signal)
      return {
        resultText: `Image ${result.mode === 'edit' ? 'edited from the attached photo' : 'generated'} successfully and displayed. Briefly describe it without a link or Markdown image.`,
        image: String(result.image),
      }
    }
    default:
      return { resultText: `Unknown tool: ${options.name}` }
  }
}

export function prepareMessages(input: unknown, images: unknown, config: AppConfig): { messages: ChatMessage[]; sourceImage: string | null } {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw Object.assign(new Error('A bounded messages array is required'), { code: 'INVALID_PROMPT' })
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
  for (const raw of input) {
    const value = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
    if (!['user', 'assistant'].includes(String(value.role)) || typeof value.content !== 'string' || value.content.length > config.limits.maxPromptChars * 2) {
      throw Object.assign(new Error('Invalid chat message'), { code: 'INVALID_PROMPT' })
    }
    messages.push({ role: value.role as 'user' | 'assistant', content: value.content })
  }
  const attached = Array.isArray(images) ? images.filter((item): item is string => typeof item === 'string').slice(0, 4) : []
  for (const image of attached) decodeImageDataUrl(image, config.limits.maxImageBytes)
  if (attached.length) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'user') {
        const text = String(messages[index]?.content || '')
        messages[index]!.content = [{ type: 'text', text }, ...attached.map(url => ({ type: 'image_url' as const, image_url: { url } }))]
        break
      }
    }
  }
  return { messages, sourceImage: attached[0] || null }
}

export async function runChatCompletion(input: unknown, images: unknown, config: AppConfig, signal: AbortSignal): Promise<Record<string, unknown>> {
  const model = chatModel()
  if (!model.endpoint || !model.apiKey) throw Object.assign(new Error('Chat model is not configured'), { code: 'PROVIDER_UNAVAILABLE' })
  const prepared = prepareMessages(input, images, config)
  const response = await fetch(`${model.endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` },
    body: JSON.stringify({ model: model.deployment, messages: prepared.messages, max_completion_tokens: config.limits.maxOutputTokens }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(config.limits.providerTimeoutMs)]),
  })
  if (!response.ok) throw new Error(`Chat provider request failed (${response.status})`)
  return readJsonBounded(response, config.limits.maxProviderResponseBytes)
}

export async function streamChatAgent(options: {
  input: unknown
  images: unknown
  config: AppConfig
  clients: CrossAppClients
  repository: PrismRepository
  identity: Identity
  res: Response
  signal: AbortSignal
}): Promise<void> {
  const model = chatModel()
  if (!model.endpoint || !model.apiKey) throw Object.assign(new Error('Chat model is not configured'), { code: 'PROVIDER_UNAVAILABLE' })
  const prepared = prepareMessages(options.input, options.images, options.config)
  const work = prepared.messages
  const url = `${model.endpoint}/chat/completions`
  for (let round = 0; round < 5 && !options.signal.aborted; round += 1) {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` },
      body: JSON.stringify({ model: model.deployment, messages: work, tools: CHAT_TOOLS, stream: true, max_completion_tokens: options.config.limits.maxOutputTokens }),
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(options.config.limits.providerTimeoutMs)]),
    })
    if (!upstream.ok || !upstream.body) throw new Error(`Chat provider request failed (${upstream.status})`)
    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    const toolCalls: ToolAccumulator[] = []
    let buffer = ''
    let assistantText = ''
    let finishReason = ''
    let received = 0
    const drain = () => {
      const frames = buffer.split('\n\n')
      buffer = frames.pop() || ''
      for (const frame of frames) {
        const payload = frame.split('\n').find(line => line.startsWith('data:'))?.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        let parsed: Record<string, unknown>
        try { parsed = JSON.parse(payload) as Record<string, unknown> } catch { continue }
        const choice = (Array.isArray(parsed.choices) ? parsed.choices[0] : null) as Record<string, unknown> | null
        if (!choice) continue
        const delta = typeof choice.delta === 'object' && choice.delta !== null ? choice.delta as Record<string, unknown> : {}
        if (typeof delta.content === 'string' && delta.content) {
          assistantText += delta.content
          if (assistantText.length > options.config.limits.maxPromptChars * 4) throw new Error('Chat output exceeded the configured limit')
          options.res.write(`event: delta\ndata: ${JSON.stringify({ delta: delta.content })}\n\n`)
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const raw of delta.tool_calls) {
            const part = raw as Record<string, unknown>
            const index = Number(part.index || 0)
            toolCalls[index] ||= { id: '', name: '', arguments: '' }
            if (typeof part.id === 'string') toolCalls[index]!.id = part.id
            const fn = typeof part.function === 'object' && part.function !== null ? part.function as Record<string, unknown> : {}
            if (typeof fn.name === 'string') toolCalls[index]!.name += fn.name
            if (typeof fn.arguments === 'string') {
              toolCalls[index]!.arguments += fn.arguments
              if (toolCalls[index]!.arguments.length > 16_000) throw new Error('Tool arguments exceeded the configured limit')
            }
          }
        }
        if (typeof choice.finish_reason === 'string') finishReason = choice.finish_reason
      }
    }
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      received += value.length
      if (received > options.config.limits.maxProviderResponseBytes) { await reader.cancel(); throw new Error('Chat provider response exceeded the configured limit') }
      buffer += decoder.decode(value, { stream: true })
      drain()
    }
    buffer += decoder.decode()
    drain()
    const calls = toolCalls.filter(Boolean)
    if (finishReason !== 'tool_calls' || !calls.length) {
      options.res.write('event: done\ndata: {}\n\n')
      return
    }
    work.push({ role: 'assistant', content: assistantText || null, tool_calls: calls.map(call => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } })) })
    for (const call of calls) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(call.arguments || '{}') as Record<string, unknown> } catch { args = {} }
      options.res.write(`event: tool\ndata: ${JSON.stringify({ name: call.name, status: 'running' })}\n\n`)
      try {
        const result = await executeChatTool({ name: call.name, args, sourceImage: prepared.sourceImage, clients: options.clients, repository: options.repository, identity: options.identity, config: options.config, signal: options.signal })
        if (result.image) options.res.write(`event: image\ndata: ${JSON.stringify({ image: result.image, prompt: String(args.prompt || '') })}\n\n`)
        work.push({ role: 'tool', tool_call_id: call.id, content: result.resultText })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool failed'
        options.res.write(`event: tool\ndata: ${JSON.stringify({ name: call.name, status: 'error', error: message })}\n\n`)
        work.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${message}` })
      }
    }
  }
  if (!options.signal.aborted) throw new Error('Chat tool loop exceeded five rounds')
}
