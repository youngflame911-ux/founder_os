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
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((e) => {
    console.error(e)
    ;(window as unknown as { __fosFail?: (m: string) => void }).__fosFail?.(String(e?.message ?? e))
  })
