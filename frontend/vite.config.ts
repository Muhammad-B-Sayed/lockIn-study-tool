import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[/\\]node_modules[/\\](?:react|react-dom|scheduler|react-router|react-router-dom|@tanstack[/\\](?:react-query|query-core))[/\\]/.test(id)) {
            return 'vendor'
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
