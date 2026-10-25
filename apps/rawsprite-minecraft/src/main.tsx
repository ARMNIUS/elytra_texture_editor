import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '@rawsprite/editor-app'
import MinecraftPreview from '@rawsprite/plugin-minecraft/MinecraftPreview'
import { ContextMenuProvider } from '@rawsprite/editor-ui/ContextMenu'
import '@rawsprite/editor-ui/styles.css'
import '@rawsprite/editor-ui/model-preview.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ContextMenuProvider>
      <App mode="minecraft" previewComponent={MinecraftPreview} />
    </ContextMenuProvider>
  </React.StrictMode>,
)
