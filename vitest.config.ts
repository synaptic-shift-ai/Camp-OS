import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { DB_INTEGRATION_TESTS } from './vitest.db-tests'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Run with Playwright: npm run test:e2e
      'tests/e2e/**',
      // Need a live Supabase connection, so they cannot run in CI. Not dead:
      // run them with npm run test:db against a non-production project. The
      // list lives in vitest.db-tests.ts, shared with vitest.config.db.ts.
      ...DB_INTEGRATION_TESTS,
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
