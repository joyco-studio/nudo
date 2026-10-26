import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Mirrors the `@` alias in vite.config.ts so units that import shared code resolve in tests.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'jsdom',
  },
})
