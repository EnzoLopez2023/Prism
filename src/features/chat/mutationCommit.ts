export interface MutationResultData {
  schema: 'marquee.mutation-result.v1'
  intentId: string
  state: 'success' | 'failed' | 'crash-ambiguous'
  result: {
    message: string
    externalId?: string | null
  }
}

type CommitEnvelope =
  | { state: 'available'; data: MutationResultData }
  | { state: 'disabled'; reason: string }
  | { state: 'unavailable'; reason: string; retryable: boolean; outcome?: 'crash-ambiguous' }

export interface CommitDecision {
  state: 'success' | 'failed' | 'crash-ambiguous' | 'unavailable' | 'invalid'
  message: string
  clearPreview: boolean
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function parseEnvelope(value: unknown): CommitEnvelope | null {
  const envelope = record(value)
  if (!envelope) return null
  if (envelope.state === 'disabled') return typeof envelope.reason === 'string' ? { state: 'disabled', reason: envelope.reason } : null
  if (envelope.state === 'unavailable') return typeof envelope.reason === 'string'
    ? { state: 'unavailable', reason: envelope.reason, retryable: Boolean(envelope.retryable), ...(envelope.outcome === 'crash-ambiguous' ? { outcome: 'crash-ambiguous' as const } : {}) }
    : null
  if (envelope.state !== 'available') return null
  const data = record(envelope.data)
  const result = record(data?.result)
  const state = data?.state
  const externalId = result?.externalId
  if (!data || data.schema !== 'marquee.mutation-result.v1' || !boundedText(data.intentId, 200) ||
      !(state === 'success' || state === 'failed' || state === 'crash-ambiguous') || !result ||
      !boundedText(result.message, 2_000) ||
      !(externalId === undefined || externalId === null || typeof externalId === 'string')) return null
  return {
    state: 'available',
    data: {
      schema: 'marquee.mutation-result.v1',
      intentId: data.intentId,
      state,
      result: { message: result.message, ...(externalId !== undefined ? { externalId } : {}) },
    },
  }
}

export async function commitMediaMutation(
  input: { kind: 'playlists' | 'collections'; intentId: string; confirmationPhrase: string },
  request: <T>(path: string, init: RequestInit) => Promise<T>,
): Promise<CommitDecision> {
  const raw = await request<unknown>(`/api/media/${input.kind}/commit`, {
    method: 'POST',
    body: JSON.stringify({ intentId: input.intentId, confirmationPhrase: input.confirmationPhrase }),
  })
  const envelope = parseEnvelope(raw)
  if (!envelope) return { state: 'invalid', message: 'Marquee returned an invalid mutation result. Keep this preview and contact an operator.', clearPreview: false }
  if (envelope.state !== 'available') {
    return envelope.state === 'unavailable' && envelope.outcome === 'crash-ambiguous'
      ? { state: 'crash-ambiguous', message: `${envelope.reason} Keep this preview for operator reconciliation.`, clearPreview: false }
      : { state: 'unavailable', message: `${envelope.reason} Keep this preview; do not assume the mutation completed.`, clearPreview: false }
  }
  if (envelope.data.intentId !== input.intentId) return { state: 'invalid', message: 'Marquee returned a different intent ID. Keep this preview and do not retry.', clearPreview: false }
  if (envelope.data.state === 'success') return { state: 'success', message: envelope.data.result.message, clearPreview: true }
  if (envelope.data.state === 'crash-ambiguous') return { state: 'crash-ambiguous', message: `${envelope.data.result.message} The external outcome is unknown; do not retry until an operator reconciles it.`, clearPreview: false }
  return { state: 'failed', message: `${envelope.data.result.message} The preview is retained for review.`, clearPreview: false }
}
