import { useIsAuthenticated } from '@azure/msal-react'
import { useSyncExternalStore, type PropsWithChildren } from 'react'
import { authRecovery, beginInteractiveReauth, entraConfigured } from './msal'
import { LandingPage } from './LandingPage'

export function AuthBoundary({ children }: PropsWithChildren) {
  const authenticated = useIsAuthenticated()
  const recovery = useSyncExternalStore(authRecovery.subscribe, authRecovery.getSnapshot, authRecovery.getSnapshot)
  if (!entraConfigured || (authenticated && recovery.status === 'ready')) return children
  const needsRecovery = authenticated && recovery.status !== 'ready'
  return (
    <LandingPage
      authenticating={recovery.status === 'authenticating'}
      message={needsRecovery ? recovery.message : undefined}
      needsRecovery={needsRecovery}
      onSignIn={() => void beginInteractiveReauth()}
    />
  )
}
