import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../internal/editor/lexical'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.tsx'),
      output: {
        entryFileNames: 'editor.js',
        assetFileNames: 'editor.[ext]',
        inlineDynamicImports: true,
        format: 'iife',
        name: 'MindbaseLexicalEditor',
      },
    },
    cssCodeSplit: false,
    sourcemap: false,
    minify: 'esbuild',
  },
})
