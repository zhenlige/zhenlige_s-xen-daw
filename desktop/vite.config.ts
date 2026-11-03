import { defineConfig } from 'vite'
import { cpSync } from 'node:fs'

export default defineConfig({
  base: './',
  plugins: [{
    name: 'copy-original-instruments',
    closeBundle() {
      cpSync('sound', 'dist/sound', { recursive: true })
      cpSync('start-local.cmd', 'dist/start-local.cmd')
      cpSync('东方旧作音色预制.jidaw', 'dist/东方旧作音色预制.jidaw')
    }
  }],
  build: {
    target: 'chrome136',
    outDir: 'dist',
    emptyOutDir: true
  }
})
