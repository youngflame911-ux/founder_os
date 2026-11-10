import './polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'gantt-task-react/dist/index.css'
import './index.css'
import App from './App'
import { initStore } from './store/useAppStore'

initStore()
  .then(() => {
    const root = document.getElementById('root')!
    root.innerHTML = ''
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    ;(window as unknown as { __fosBooted?: boolean }).__fosBooted = true
    // Офлайн-кэш только в сборке для хостинга (GitHub Pages): приложение открывается без интернета
    if (import.meta.env.VITE_PWA === '1' && 'serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[pwa] офлайн-кэш не подключён', err))
    }
  })
  .catch((e) => {
    console.error(e)
    ;(window as unknown as { __fosFail?: (m: string) => void }).__fosFail?.(String(e?.message ?? e))
  })
