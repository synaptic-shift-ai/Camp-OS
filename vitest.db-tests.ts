/**
 * Tests that require a live Supabase connection.
 *
 * These seed and tear down real rows rather than mocking the client, so they
 * cannot run in CI, which has no database. They are excluded from the default
 * suite (vitest.config.ts) and are the entire contents of the database suite
 * (vitest.config.db.ts), which `npm run test:db` runs.
 *
 * One list, imported by both configs, so the two cannot drift.
 *
 * All six cover `src/lib/booking/`, which CLAUDE.md marks legacy and scheduled
 * for deletion (R-1). They should be retired with it rather than extended; new
 * pricing coverage belongs in the pure, always-running tests alongside
 * `lib/config/rate-periods.test.ts` and `lib/booking/pricing.blocks.test.ts`.
 */
export const DB_INTEGRATION_TESTS = [
  'src/lib/booking/actions.test.ts',
  'src/lib/booking/availability.test.ts',
  'src/lib/booking/availability-check.test.ts',
  'src/lib/booking/guest.test.ts',
  'src/lib/booking/pricing.test.ts',
  'src/lib/booking/reservation.test.ts',
] as const
