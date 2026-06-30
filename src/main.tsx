import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log('%c 이슈트래커 v1.4.4 ', 'background:#0ea5e9;color:#fff;font-weight:bold;border-radius:4px;padding:2px 6px;')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
