import {
  IonContent,
  IonIcon,
  IonMenu,
  IonMenuButton,
  IonMenuToggle,
  IonSplitPane,
} from '@ionic/react'
import { useMsal } from '@azure/msal-react'
import {
  albumsOutline,
  chatbubbleEllipsesOutline,
  codeSlashOutline,
  gitCompareOutline,
  imageOutline,
  logOutOutline,
} from 'ionicons/icons'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { entraConfigured } from '../auth/msal'

const ChatPage = lazy(() => import('../features/chat/ChatPage'))
const ModelLabPage = lazy(() => import('../features/model-lab/ModelLabPage'))
const ImageLabPage = lazy(() => import('../features/image-lab/ImageLabPage'))
const PromptLibraryPage = lazy(() => import('../features/prompts/PromptLibraryPage'))
const ConverterPage = lazy(() => import('../features/converter/ConverterPage'))

const nav = [
  ['/chat', 'Assistant', chatbubbleEllipsesOutline],
  ['/ai-test', 'Model lab', gitCompareOutline],
  ['/ai-image-test', 'Image lab', imageOutline],
  ['/prompt-library', 'Prompts', albumsOutline],
  ['/converter', 'Converter', codeSlashOutline],
] as const

type BuildState =
  | { status: 'loading' }
  | { status: 'ready'; number: string }
  | { status: 'error' }

function readBuildNumber(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null
  const build = (value as Record<string, unknown>).build
  if (typeof build === 'number' && Number.isFinite(build)) return String(build)
  if (typeof build === 'string' && build.trim()) return build.trim()
  return null
}

function useBuildNumber(): BuildState {
  const [state, setState] = useState<BuildState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch('/version.json', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`/version.json returned ${response.status}`)
        const number = readBuildNumber(await response.json() as unknown)
        if (!number) throw new Error('/version.json did not include a build number')
        setState({ status: 'ready', number })
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('prism_build_identity_unavailable', error)
        setState({ status: 'error' })
      }
    })()
    return () => controller.abort()
  }, [])

  return state
}

function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (parts[0]?.slice(0, 2) || '?').toUpperCase()
}

function SidebarFooter() {
  const { accounts, instance } = useMsal()
  const account = instance.getActiveAccount() ?? accounts[0]
  const displayName = account?.name?.trim()
    || account?.username?.trim()
    || (entraConfigured ? 'Signed in' : 'Local developer')
  const username = account?.username?.trim()
  const accountDetail = username && username !== displayName
    ? username
    : entraConfigured ? 'Microsoft account' : 'Development session'
  const build = useBuildNumber()
  const logoutTitle = entraConfigured
    ? 'End this Prism session'
    : 'No session to end in local development'

  const logOut = useCallback(() => {
    void instance.logoutRedirect({
      account: account ?? undefined,
      postLogoutRedirectUri: window.location.origin,
    })
  }, [account, instance])

  return (
    <div className="rail-footer">
      <div className="rail-account">
        <span className="rail-avatar" aria-hidden="true">{initialsOf(displayName)}</span>
        <div className="rail-account-copy">
          <strong>{displayName}</strong>
          <span title={accountDetail}>{accountDetail}</span>
        </div>
      </div>
      <span className={`rail-build${build.status === 'error' ? ' error' : ''}`} aria-live="polite">
        {build.status === 'ready' ? `Build ${build.number}` : build.status === 'error' ? 'Build unavailable' : 'Build loading…'}
      </span>
      <button
        type="button"
        className="rail-logout"
        disabled={!entraConfigured}
        onClick={logOut}
        title={logoutTitle}
      >
        <IonIcon icon={logOutOutline} />
        <span>Log out</span>
      </button>
    </div>
  )
}

export function App() {
  return (
    <IonSplitPane contentId="prism-main" when="(min-width: 761px)" className="app-frame">
      <IonMenu contentId="prism-main" menuId="prism-navigation" type="overlay" className="app-menu">
        <IonContent className="app-rail">
          <div className="rail-inner">
            <div className="brand-lockup">
              <img className="brand-icon" src="/apple-touch-icon.png" alt="" />
              <div><strong className="brand-name">Prism</strong><span className="brand-note">AI workbench</span></div>
            </div>
            <nav aria-label="Primary navigation">
              <div className="rail-nav">
                {nav.map(([to, label, icon]) => (
                  <IonMenuToggle autoHide={false} key={to}>
                    <NavLink
                      to={to}
                      className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}
                    >
                      <IonIcon icon={icon} /><span>{label}</span>
                    </NavLink>
                  </IonMenuToggle>
                ))}
              </div>
            </nav>
            <SidebarFooter />
          </div>
        </IonContent>
      </IonMenu>
      <main id="prism-main" className="app-main">
        <IonMenuButton className="mobile-menu-trigger" menu="prism-navigation" />
        <Suspense fallback={<div className="route-loading" role="status">Preparing workspace…</div>}>
          <Routes>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/ai-test" element={<ModelLabPage />} />
            <Route path="/ai-image-test" element={<ImageLabPage />} />
            <Route path="/prompt-library" element={<PromptLibraryPage />} />
            <Route path="/converter" element={<ConverterPage />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </Suspense>
      </main>
    </IonSplitPane>
  )
}
