import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'  // ← This import must be at the top
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
