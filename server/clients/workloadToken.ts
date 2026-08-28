interface ManagedIdentityToken { access_token: string; expires_on: string }

export interface WorkloadTokenProvider { getToken(audience: string, signal: AbortSignal): Promise<string> }

export class AzureManagedIdentityTokenProvider implements WorkloadTokenProvider {
  async getToken(audience: string, signal: AbortSignal): Promise<string> {
    const endpoint = process.env.IDENTITY_ENDPOINT
    const header = process.env.IDENTITY_HEADER
    if (!endpoint || !header) throw new Error('Managed identity is unavailable')
    const url = new URL(endpoint)
    url.searchParams.set('api-version', '2019-08-01')
    url.searchParams.set('resource', audience)
    const response = await fetch(url, { headers: { 'X-IDENTITY-HEADER': header }, signal })
    if (!response.ok) throw new Error(`Managed identity rejected token request (${response.status})`)
    const body = await response.json() as ManagedIdentityToken
    if (!body.access_token) throw new Error('Managed identity returned no token')
    return body.access_token
  }
}

export class UnavailableTokenProvider implements WorkloadTokenProvider {
  async getToken(): Promise<string> { throw new Error('Workload identity is unavailable') }
}
