import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'
import { MsalProvider } from '@azure/msal-react'
import type { PropsWithChildren } from 'react'
import { AuthBoundary } from '../auth/AuthBoundary'
import { getMsal } from '../auth/msal'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6346db', dark: '#4930b5', contrastText: '#fff' },
    background: { default: '#f3f4f8', paper: '#fff' },
    text: { primary: '#171824', secondary: '#5d6074' },
    divider: '#dfe1ea',
    error: { main: '#b4233e' },
    success: { main: '#16845b' },
    warning: { main: '#a65f00' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    h1: { fontSize: '1.8rem', fontWeight: 720, letterSpacing: '-0.03em' },
    h2: { fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em' },
    button: { textTransform: 'none', fontWeight: 680 },
  },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 40, boxShadow: 'none' } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
})

export function AppProviders({ children }: PropsWithChildren) {
  return <MsalProvider instance={getMsal()}><ThemeProvider theme={theme}><CssBaseline /><AuthBoundary>{children}</AuthBoundary></ThemeProvider></MsalProvider>
}
