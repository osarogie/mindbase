import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@mindbase/editor-ui': resolve(__dirname, '../editor-ui/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Overridable so the Docker dev container can proxy to the `server` service.
      '/api': process.env.VITE_API_PROXY || 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
