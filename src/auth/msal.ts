import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser'
import { InteractiveReauthCoordinator } from './interactiveReauth'

interface RuntimeConfig {
  entraConfigured: string
  tenantId?: string
  clientId?: string
  apiScope?: string
}

let runtimeConfig: RuntimeConfig | null = null

async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  if (runtimeConfig) return runtimeConfig
  // Fallback: allow build-time env vars for local dev, but prefer runtime endpoint
  try {
    const res = await fetch('/api/config')
    if (!res.ok) throw new Error(`/api/config returned ${res.status}`)
    runtimeConfig = await res.json() as RuntimeConfig
  } catch {
    // In dev with Vite proxy, /api/config is served by the Express server.
    // If it fails, fall back to build-time VITE_ env vars for backward compat.
    runtimeConfig = {
      entraConfigured: String(Boolean(
        import.meta.env.VITE_ENTRA_TENANT_ID &&
        import.meta.env.VITE_ENTRA_CLIENT_ID &&
        import.meta.env.VITE_ENTRA_API_SCOPE
      )),
      tenantId: import.meta.env.VITE_ENTRA_TENANT_ID as string | undefined,
      clientId: import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined,
      apiScope: import.meta.env.VITE_ENTRA_API_SCOPE as string | undefined,
    }
  }
  return runtimeConfig
}

// Eagerly start the config fetch
const configPromise = fetchRuntimeConfig()

export function getRuntimeConfig(): RuntimeConfig | null { return runtimeConfig }

// MSAL instance is created lazily after config is loaded
let msalInstance: PublicClientApplication | null = null
export function getMsal(): PublicClientApplication {
  if (!msalInstance) throw new Error('MSAL not initialized; call initializeMsal() first')
  return msalInstance
}

export let entraConfigured = false
export let apiScope: string | undefined

export const authRecovery = new InteractiveReauthCoordinator()

let initialized: Promise<void> | null = null
export function initializeMsal() {
  initialized ||= (async () => {
    const cfg = await configPromise
    const tenantId = cfg.tenantId
    const clientId = cfg.clientId
    apiScope = cfg.apiScope
    entraConfigured = cfg.entraConfigured === 'true'

    msalInstance = new PublicClientApplication({
      auth: {
        clientId: clientId || '00000000-0000-4000-8000-000000000000',
        authority: `https://login.microsoftonline.com/${tenantId || 'organizations'}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    })
    await msalInstance.initialize()
  })()
  return initialized
}

export async function accessToken(): Promise<string | null> {
  if (!entraConfigured || !msalInstance) return null
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0]
  if (!account) return null
  try {
    const result = await msalInstance.acquireTokenSilent({ account, scopes: [apiScope!] })
    authRecovery.ready()
    return result.accessToken
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError ||
        (typeof error === 'object' && error && 'errorCode' in error && String(error.errorCode).includes('interaction_required'))) {
      authRecovery.require()
      throw new Error('Microsoft reauthentication is required')
    }
    throw error
  }
}

export function beginInteractiveReauth(): Promise<void> {
  if (!entraConfigured || !msalInstance) return Promise.resolve()
  return authRecovery.run(() => msalInstance!.acquireTokenRedirect({ scopes: [apiScope!], prompt: 'select_account' }))
}
