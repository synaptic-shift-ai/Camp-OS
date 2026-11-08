import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { DB_INTEGRATION_TESTS } from './vitest.db-tests'

/**
 * Database integration suite — `npm run test:db`.
 *
 * Runs only the tests that need a live Supabase connection. Point it at a
 * non-production project: these tests insert and delete real rows.
 *
 * Required environment: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * vitest.db-setup.ts fails fast with that message if either is missing, rather
 * than letting the tests report confusing connection errors.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts', './vitest.db-setup.ts'],
    css: true,
    include: [...DB_INTEGRATION_TESTS],
    // These share a database, so parallel files would race on seeded rows.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
