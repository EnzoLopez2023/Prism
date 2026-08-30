import {
  IonBadge,
  IonContent,
  IonIcon,
  IonList,
  IonMenu,
  IonMenuButton,
  IonMenuToggle,
  IonSplitPane,
} from '@ionic/react'
import {
  albumsOutline,
  chatbubbleEllipsesOutline,
  codeSlashOutline,
  gitCompareOutline,
  imageOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons'
import { lazy, Suspense } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

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

export function App() {
  return (
    <IonSplitPane contentId="prism-main" when="(min-width: 761px)" className="app-frame">
      <IonMenu contentId="prism-main" menuId="prism-navigation" type="overlay" className="app-menu">
        <IonContent className="app-rail" scrollY={false}>
          <div className="rail-inner">
            <div className="brand-lockup">
              <img className="brand-icon" src="/apple-touch-icon.png" alt="" />
              <div><strong className="brand-name">Prism</strong><span className="brand-note">AI workbench</span></div>
            </div>
            <nav aria-label="Primary navigation">
              <IonList className="rail-nav">
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
              </IonList>
            </nav>
            <IonBadge className="authority-chip">
              <IonIcon icon={shieldCheckmarkOutline} />
              <span>Local authority</span>
            </IonBadge>
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
