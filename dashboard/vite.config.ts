import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => {
  // GitHub Pages build: normal output to docs/sprint/
  if (mode === 'ghpages') {
    return {
      plugins: [react()],
      base: '/',
      build: {
        outDir: '../docs/sprint',
        emptyOutDir: false, // Don't delete JSON data files
      },
    }
  }

  // Default: single file build for standalone use
  return {
    plugins: [react(), viteSingleFile()],
    build: {
      outDir: '../docs/templates/built',
      emptyOutDir: true,
    },
  }
})
