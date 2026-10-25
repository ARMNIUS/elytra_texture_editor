import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '@rawsprite/editor-app'
import ElytraViewer from '@rawsprite/plugin-minecraft/ElytraViewer'
import { ContextMenuProvider } from '@rawsprite/editor-ui/ContextMenu'
import '@rawsprite/editor-ui/styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ContextMenuProvider>
      <App mode="minecraft" previewComponent={ElytraViewer} />
    </ContextMenuProvider>
  </React.StrictMode>,
)
