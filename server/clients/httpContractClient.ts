import type {
  Availability, MarqueeClient, MarqueeMediaItem, MediaSearchContract, MutationPreview,
  MutationResult, OwnedAppContract, TypedContractClient, HearthSearchItem,
  HearthHouseholdItem, LanternStudySummary, WatchtowerComponent,
} from './contracts.js'
import type { WorkloadTokenProvider } from './workloadToken.js'

type Validator<T> = (value: unknown) => value is T
const MAX_CONTRACT_BYTES = 2 * 1024 * 1024

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > MAX_CONTRACT_BYTES) throw new Error('Contract response exceeds byte limit')
  if (!response.body) return response.json()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_CONTRACT_BYTES) {
      await reader.cancel()
      throw new Error('Contract response exceeds byte limit')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isMediaItem(value: unknown): value is MarqueeMediaItem {
  const item = record(value)
  return Boolean(item &&
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    (typeof item.year === 'number' || item.year === null) &&
    typeof item.mediaType === 'string' &&
    typeof item.libraryId === 'string' &&
    typeof item.libraryName === 'string' &&
    isStringOrNull(item.artworkRef) &&
    (typeof item.durationMs === 'number' || item.durationMs === null) &&
    isStringOrNull(item.summary))
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isBoundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function isHearthSearchItem(value: unknown): value is HearthSearchItem {
  const item = record(value)
  return Boolean(item && typeof item.area === 'string' && typeof item.title === 'string' && typeof item.text === 'string' && (item.score === undefined || typeof item.score === 'number'))
}

function isHearthHouseholdItem(value: unknown): value is HearthHouseholdItem {
  const item = record(value)
  return Boolean(item && (typeof item.id === 'string' || typeof item.id === 'number') && typeof item.title === 'string' && typeof item.summary === 'string' && (item.updatedAt === null || isIsoDate(item.updatedAt)))
}

function isLanternStudySummary(value: unknown): value is LanternStudySummary {
  const item = record(value)
  return Boolean(item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.summary === 'string' &&
    isIsoDate(item.updatedAt) && (item.mode === null || typeof item.mode === 'string') && (item.score === null || typeof item.score === 'number'))
}

function isWatchtowerComponent(value: unknown): value is WatchtowerComponent {
  const item = record(value)
  return Boolean(item && typeof item.name === 'string' && ['healthy', 'degraded', 'unavailable'].includes(String(item.status)) &&
    typeof item.summary === 'string' && isIsoDate(item.observedAt))
}

export const validateMediaSearch: Validator<MediaSearchContract> = (value: unknown): value is MediaSearchContract => {
  const item = record(value)
  return Boolean(item?.schema === 'marquee.media-search.v1' && Array.isArray(item.items) && item.items.length <= 50 && item.items.every(isMediaItem))
}

export const validateMutationPreview: Validator<MutationPreview> = (value: unknown): value is MutationPreview => {
  const item = record(value)
  const preview = record(item?.preview)
  return Boolean(item?.schema === 'marquee.mutation-intent.v1' &&
    isBoundedText(item.intentId, 200) &&
    isBoundedText(item.confirmationPhrase, 500) &&
    typeof item.expiresAt === 'string' && Number.isFinite(Date.parse(item.expiresAt)) &&
    preview && typeof preview.title === 'string' &&
    Array.isArray(preview.media) && preview.media.length <= 50 && preview.media.every(isMediaItem))
}

export const validateMutationResult: Validator<MutationResult> = (value: unknown): value is MutationResult => {
  const item = record(value)
  const result = record(item?.result)
  return Boolean(item?.schema === 'marquee.mutation-result.v1' &&
    isBoundedText(item.intentId, 200) &&
    ['success', 'failed', 'crash-ambiguous'].includes(String(item.state)) &&
    result && isBoundedText(result.message, 2_000) &&
    (result.externalId === undefined || result.externalId === null || typeof result.externalId === 'string'))
}

const appSchemas = {
  hearth: new Set(['hearth.status.v1', 'hearth.search.v1', 'hearth.household-query.v1']),
  lantern: new Set(['lantern.status.v1', 'lantern.study-summaries.v1']),
  watchtower: new Set(['watchtower.status.v1']),
} as const

export function ownedAppValidator(app: keyof typeof appSchemas): Validator<OwnedAppContract> {
  return (value: unknown): value is OwnedAppContract => {
    const item = record(value)
    if (!item || typeof item.schema !== 'string' || !appSchemas[app].has(item.schema as never) || typeof item.generatedAt !== 'string' || !Number.isFinite(Date.parse(item.generatedAt))) return false
    if (item.schema === 'hearth.search.v1') return Array.isArray(item.results) && item.results.length <= 50 && item.results.every(isHearthSearchItem)
    if (item.schema === 'hearth.household-query.v1') return typeof item.area === 'string' && Array.isArray(item.items) && item.items.length <= 100 && item.items.every(isHearthHouseholdItem)
    if (item.schema === 'lantern.study-summaries.v1') return Array.isArray(item.summaries) && item.summaries.length <= 50 && item.summaries.every(isLanternStudySummary)
    if (!['healthy', 'degraded', 'unavailable'].includes(String(item.status))) return false
    if (item.schema === 'watchtower.status.v1') return Array.isArray(item.components) && item.components.length <= 100 && item.components.every(isWatchtowerComponent)
    return item.components === undefined || (Array.isArray(item.components) && item.components.length <= 100 && item.components.every(isWatchtowerComponent))
  }
}

async function boundedFetch<T>(
  baseUrl: string | undefined,
  audience: string | undefined,
  tokenProvider: WorkloadTokenProvider,
  path: string,
  init: RequestInit,
  validator: Validator<T>,
  failureMode: 'read' | 'mutation',
  signal?: AbortSignal,
): Promise<Availability<T>> {
  if (!baseUrl || !audience) return { state: 'disabled', reason: 'Contract endpoint is not configured' }
  const timeout = AbortSignal.timeout(10_000)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  let dispatched = false
  try {
    const requestUrl = new URL(path, baseUrl)
    const token = await tokenProvider.getToken(audience, combined)
    const pendingResponse = fetch(requestUrl, {
      ...init,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      signal: combined,
    })
    dispatched = true
    const response = await pendingResponse
    if (!response.ok) {
      if (failureMode === 'mutation' && response.status >= 500) {
        return { state: 'unavailable', reason: `Marquee commit returned ${response.status} after dispatch; the outcome is crash-ambiguous and must not be retried`, retryable: false, outcome: 'crash-ambiguous' }
      }
      return { state: 'unavailable', reason: `Upstream contract returned ${response.status}`, retryable: response.status >= 500 }
    }
    const value = await readBoundedJson(response)
    if (!validator(value)) return { state: 'unavailable', reason: 'Upstream returned an invalid contract', retryable: false }
    return { state: 'available', data: value }
  } catch (error) {
    if (failureMode === 'mutation' && dispatched) {
      return { state: 'unavailable', reason: 'Marquee commit transport was lost after dispatch; the outcome is crash-ambiguous and must not be retried', retryable: false, outcome: 'crash-ambiguous' }
    }
    const reason = error instanceof Error && error.message.includes('byte limit')
      ? 'Upstream contract exceeded the response limit'
      : error instanceof Error && error.name === 'TimeoutError' ? 'Upstream contract timed out' : 'Upstream contract is unavailable'
    return { state: 'unavailable', reason, retryable: !reason.includes('limit') }
  }
}

export class HttpContractClient<T> implements TypedContractClient<T> {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly audience: string | undefined,
    private readonly tokens: WorkloadTokenProvider,
    private readonly validator: Validator<T>,
  ) {}
  read(path: string, signal?: AbortSignal) { return boundedFetch(this.baseUrl, this.audience, this.tokens, path, { method: 'GET' }, this.validator, 'read', signal) }
}

export class HttpMarqueeClient implements MarqueeClient {
  constructor(private readonly baseUrl: string | undefined, private readonly audience: string | undefined, private readonly tokens: WorkloadTokenProvider) {}
  search(query: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: query, limit: '25' })
    return boundedFetch(this.baseUrl, this.audience, this.tokens, `/api/contracts/v1/media/search?${params}`, { method: 'GET' }, validateMediaSearch, 'read', signal)
  }
  prepare(kind: 'playlists' | 'collections', input: object, signal?: AbortSignal) {
    return boundedFetch(this.baseUrl, this.audience, this.tokens, `/api/contracts/v1/${kind}/prepare`, { method: 'POST', body: JSON.stringify(input) }, validateMutationPreview, 'read', signal)
  }
  commit(kind: 'playlists' | 'collections', intentId: string, confirmationPhrase: string, signal?: AbortSignal) {
    return boundedFetch(this.baseUrl, this.audience, this.tokens, `/api/contracts/v1/${kind}/commit`, { method: 'POST', body: JSON.stringify({ intentId, confirmationPhrase }) }, validateMutationResult, 'mutation', signal)
  }
}
