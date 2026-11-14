import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { hydrateDesktopStorage } from './desktopStorage'
import './index.css'

async function boot() {
  // Desktop: restore books/keys from userData before any React localStorage reads.
  await hydrateDesktopStorage()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
