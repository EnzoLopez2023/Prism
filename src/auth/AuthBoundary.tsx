import LockOutlined from '@mui/icons-material/LockOutlined'
import { Box, Button, Paper, Typography } from '@mui/material'
import { useIsAuthenticated } from '@azure/msal-react'
import { useSyncExternalStore, type PropsWithChildren } from 'react'
import { authRecovery, beginInteractiveReauth, entraConfigured } from './msal'

export function AuthBoundary({ children }: PropsWithChildren) {
  const authenticated = useIsAuthenticated()
  const recovery = useSyncExternalStore(authRecovery.subscribe, authRecovery.getSnapshot, authRecovery.getSnapshot)
  if (!entraConfigured || (authenticated && recovery.status === 'ready')) return children
  const needsRecovery = authenticated && recovery.status !== 'ready'
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: '#202130' }}>
      <Paper sx={{ width: 'min(440px, 100%)', p: 4 }}>
        <Box className="brand-mark" sx={{ mb: 3 }} aria-hidden="true"><span /><span /><span /></Box>
        <Typography variant="h1">{needsRecovery ? 'Refresh your Prism session' : 'Sign in to Prism'}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{needsRecovery ? recovery.message : 'Your conversations, prompts, provider access, and confirmed media actions stay inside your Prism identity boundary.'}</Typography>
        <Button fullWidth variant="contained" startIcon={<LockOutlined />} disabled={recovery.status === 'authenticating'} onClick={() => void beginInteractiveReauth()}>
          {recovery.status === 'authenticating' ? 'Opening Microsoft…' : 'Continue with Microsoft'}
        </Button>
      </Paper>
    </Box>
  )
}
