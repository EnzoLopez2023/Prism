import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initializeMsal } from './auth/msal'
import { App } from './app/App'
import { AppProviders } from './app/providers'
import './styles.css'

await initializeMsal()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders><App /></AppProviders>
    </BrowserRouter>
  </React.StrictMode>,
)
