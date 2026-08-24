import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { initNative } from './native'
import '@fontsource/ibm-plex-mono/300.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/300-italic.css'
import '@fontsource/ibm-plex-mono/400-italic.css'
import './styles/global.css'

initNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

// Offline only in prod: in dev the service worker interferes with hot reload.
// The native app doesn't need a SW — the files are already local.
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* no SW — the app just runs online */
    })
  })
}
