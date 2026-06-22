import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App'
import { initNative } from './native'
import '@fontsource/ibm-plex-mono/300.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/300-italic.css'
import '@fontsource/ibm-plex-mono/400-italic.css'
import './styles/global.css'

initNative()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Оффлайн только в проде: в dev service worker мешает hot reload.
// В нативном приложении SW не нужен — файлы и так локальные.
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* нет SW — приложение просто работает онлайн */
    })
  })
}
