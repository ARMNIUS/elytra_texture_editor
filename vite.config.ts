import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // three.js alone is ~500 kB; the per-module split keeps the app shell small.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Keep the 3D stack in its own long-lived chunk instead of one 800 kB bundle.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('three') || id.includes('skinview3d')) return 'three'
          if (id.includes('react') || id.includes('scheduler')) return 'react'
          return undefined
        },
      },
    },
  },
})
