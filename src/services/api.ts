import { accessToken } from '../auth/msal'

export interface ApiErrorBody { code?: string; error?: string; message?: string }

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: ApiErrorBody) {
    super(body.message || body.error || `Request failed (${status})`)
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken()
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `Request failed (${response.status})` })) as ApiErrorBody
    throw new ApiError(response.status, body)
  }
  return response.json() as Promise<T>
}

export async function apiHeaders(): Promise<Record<string, string>> {
  const token = await accessToken()
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

export async function apiBlob(path: string): Promise<string> {
  const response = await fetch(path, { headers: await apiHeaders() })
  if (!response.ok) throw new ApiError(response.status, { error: 'Image could not be loaded' })
  return URL.createObjectURL(await response.blob())
}
