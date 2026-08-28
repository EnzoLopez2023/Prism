import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import LibraryBooksOutlined from '@mui/icons-material/LibraryBooksOutlined'
import TransformOutlined from '@mui/icons-material/TransformOutlined'
import { Box, Chip, Typography } from '@mui/material'
import { lazy, Suspense } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

const ChatPage = lazy(() => import('../features/chat/ChatPage'))
const ModelLabPage = lazy(() => import('../features/model-lab/ModelLabPage'))
const ImageLabPage = lazy(() => import('../features/image-lab/ImageLabPage'))
const PromptLibraryPage = lazy(() => import('../features/prompts/PromptLibraryPage'))
const ConverterPage = lazy(() => import('../features/converter/ConverterPage'))

const nav = [
  ['/chat', 'Assistant', ChatBubbleOutline],
  ['/ai-test', 'Model lab', AutoAwesomeOutlined],
  ['/ai-image-test', 'Image lab', ImageOutlined],
  ['/prompt-library', 'Prompts', LibraryBooksOutlined],
  ['/converter', 'Converter', TransformOutlined],
] as const

export function App() {
  return (
    <Box className="app-frame">
      <Box component="aside" className="app-rail">
        <Box className="brand-lockup">
          <Box className="brand-mark" aria-hidden="true"><span /><span /><span /></Box>
          <Box><Typography className="brand-name">Prism</Typography><Typography className="brand-note">AI workbench</Typography></Box>
        </Box>
        <Box component="nav" aria-label="Primary navigation" className="rail-nav">
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}>
              <Icon fontSize="small" /><span>{label}</span>
            </NavLink>
          ))}
        </Box>
        <Chip size="small" label="Local authority" className="authority-chip" />
      </Box>
      <Box component="main" className="app-main">
        <Suspense fallback={<Box className="route-loading" role="status">Preparing workspace…</Box>}>
          <Routes>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/ai-test" element={<ModelLabPage />} />
            <Route path="/ai-image-test" element={<ImageLabPage />} />
            <Route path="/prompt-library" element={<PromptLibraryPage />} />
            <Route path="/converter" element={<ConverterPage />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </Suspense>
      </Box>
    </Box>
  )
}
