import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: true,
    // Exclude E2E tests (run with Playwright) and legacy integration tests (require real DB)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',                            // E2E tests run via npm run test:e2e
      'src/lib/booking/actions.test.ts',         // Legacy - requires real Supabase
      'src/lib/booking/availability.test.ts',    // Legacy - requires real Supabase
      'src/lib/booking/availability-check.test.ts', // Legacy - requires real Supabase
      'src/lib/booking/guest.test.ts',           // Legacy - requires real Supabase
      'src/lib/booking/pricing.test.ts',         // Legacy - requires real Supabase
      'src/lib/booking/reservation.test.ts',     // Legacy - requires real Supabase
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
