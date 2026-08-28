import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser'
import { InteractiveReauthCoordinator } from './interactiveReauth'

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID as string | undefined
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined
export const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE as string | undefined
export const entraConfigured = Boolean(tenantId && clientId && apiScope)

export const msal = new PublicClientApplication({
  auth: {
    clientId: clientId || '00000000-0000-4000-8000-000000000000',
    authority: `https://login.microsoftonline.com/${tenantId || 'organizations'}`,
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
})

let initialized: Promise<void> | null = null
export const authRecovery = new InteractiveReauthCoordinator()
export function initializeMsal() {
  initialized ||= msal.initialize()
  return initialized
}

export async function accessToken(): Promise<string | null> {
  if (!entraConfigured) return null
  await initializeMsal()
  const account = msal.getActiveAccount() || msal.getAllAccounts()[0]
  if (!account) return null
  try {
    const result = await msal.acquireTokenSilent({ account, scopes: [apiScope!] })
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
  if (!entraConfigured) return Promise.resolve()
  return authRecovery.run(() => msal.acquireTokenRedirect({ scopes: [apiScope!], prompt: 'select_account' }))
}
