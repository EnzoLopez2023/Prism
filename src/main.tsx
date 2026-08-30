import {
  IonApp,
  setupIonicReact,
} from '@ionic/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initializeMsal } from './auth/msal'
import { App } from './app/App'
import { AppProviders } from './app/providers'
import '@fontsource-variable/archivo/wdth.css'
import '@ionic/react/css/core.css'
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'
import './styles.css'

setupIonicReact({ mode: 'ios' })

await initializeMsal()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IonApp>
      <BrowserRouter>
        <AppProviders><App /></AppProviders>
      </BrowserRouter>
    </IonApp>
  </React.StrictMode>,
)
