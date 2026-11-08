/**
 * Guard for the database integration suite.
 *
 * The tests in that suite create a service-role client and seed real rows. With
 * no credentials they fail with opaque connection errors, so fail fast here with
 * an actionable message instead.
 */

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

const missing = REQUIRED_ENV.filter((key) => !process.env[key])

if (missing.length > 0) {
  throw new Error(
    [
      `Cannot run the database integration suite: ${missing.join(' and ')} not set.`,
      '',
      'These tests insert and delete real rows, so point them at a non-production',
      'Supabase project:',
      '',
      '  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:db',
      '',
      'The default suite (npm run test:run) needs no database and excludes them.',
    ].join('\n'),
  )
}
