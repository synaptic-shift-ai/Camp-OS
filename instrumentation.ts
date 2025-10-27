export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = async (
  err: Error,
  request: {
    path: string
    method: string
    headers: Headers
  }
) => {
  // Sentry will automatically capture the error via the instrumentation
  // Additional custom logging can be added here if needed
  console.error('[Request Error]', {
    path: request.path,
    method: request.method,
    error: err.message,
  })
}
