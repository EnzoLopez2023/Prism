export type Availability<T> =
  | { state: 'available'; data: T }
  | { state: 'disabled'; reason: string }
  | { state: 'unavailable'; reason: string; retryable: boolean; outcome?: 'crash-ambiguous' }

export interface MarqueeMediaItem {
  id: string
  title: string
  year: number | null
  mediaType: string
  libraryId: string
  libraryName: string
  artworkRef: string | null
  durationMs: number | null
  summary: string | null
}

export interface MediaSearchContract {
  schema: 'marquee.media-search.v1'
  items: MarqueeMediaItem[]
}

export interface MutationPreview {
  schema: 'marquee.mutation-intent.v1'
  intentId: string
  confirmationPhrase: string
  expiresAt: string
  preview: { title: string; media: MarqueeMediaItem[] }
}

export interface MutationResult {
  schema: 'marquee.mutation-result.v1'
  intentId: string
  state: 'success' | 'failed' | 'crash-ambiguous'
  result: {
    message: string
    externalId?: string | null
  }
}

export interface OwnedAppContract {
  schema: string
  generatedAt: string
  [key: string]: unknown
}

export interface HearthSearchItem {
  area: string
  title: string
  text: string
  score?: number
}

export interface HearthHouseholdItem {
  id: string | number
  title: string
  summary: string
  updatedAt: string | null
}

export interface LanternStudySummary {
  id: string
  title: string
  summary: string
  updatedAt: string
  mode: string | null
  score: number | null
}

export interface WatchtowerComponent {
  name: string
  status: 'healthy' | 'degraded' | 'unavailable'
  summary: string
  observedAt: string
}

export interface CrossAppClients {
  hearth: TypedContractClient<OwnedAppContract>
  lantern: TypedContractClient<OwnedAppContract>
  watchtower: TypedContractClient<OwnedAppContract>
  marquee: MarqueeClient
}

export interface TypedContractClient<T> { read(path: string, signal?: AbortSignal): Promise<Availability<T>> }

export interface MarqueeClient {
  search(query: string, signal?: AbortSignal): Promise<Availability<MediaSearchContract>>
  prepare(kind: 'playlists' | 'collections', input: object, signal?: AbortSignal): Promise<Availability<MutationPreview>>
  commit(kind: 'playlists' | 'collections', intentId: string, confirmationPhrase: string, signal?: AbortSignal): Promise<Availability<MutationResult>>
}
