import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>
  </React.StrictMode>,
)
