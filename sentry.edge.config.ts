import * as Sentry from '@sentry/nextjs'

// Only initialize if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring - lower sample rate for edge
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

  // Capture 100% of errors
  sampleRate: 1.0,

  // Environment
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',

  beforeSend(event) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_ENABLED) {
      return null
    }

    // Tag edge runtime errors
    event.tags = {
      ...event.tags,
      'server.runtime': 'edge',
    }

    return event
  },
  })
}
