import * as Sentry from '@sentry/nextjs'

// Only initialize if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring - sample 10% in production, disabled in development
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,

  // Capture 100% of errors
  sampleRate: 1.0,

  // Environment
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',

  // Disable noisy debug logs
  debug: false,

  beforeSend(event, _hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_ENABLED) {
      return null
    }

    // Add context for server-side errors
    if (event.request) {
      event.tags = {
        ...event.tags,
        'server.runtime': 'nodejs',
      }
    }

    return event
  },

  // Track critical operations
  integrations: [
    Sentry.httpIntegration(),
  ],
  })
}
