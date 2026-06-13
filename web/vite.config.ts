import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    react({
      babel: {
        // React Compiler — auto-memoizes components/hooks. target '18' uses the
        // react-compiler-runtime polyfill since this app is on React 18.
        plugins: [['babel-plugin-react-compiler', { target: '18' }]],
      },
    }),
    tailwindcss(),
  ],
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
