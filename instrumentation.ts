export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }

  // Automation Engine — activate persistent event bus + subscriber
  // IMPORTANT: Only initialize in Node.js runtime.
  // Edge Runtime doesn't support crypto/nodemailer which are used
  // by the email sender (emailit.ts) loaded transitively via
  // action-registry → send_email handler. Without this guard,
  // the Edge Runtime crashes and automations never initialize.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.ENABLE_PERSISTENT_EVENT_BUS === 'true') {
    const { initializeAutomations } = await import('@/lib/automations/init')
    const { registerAutomationSubscriber } = await import('@/lib/automations/subscriber')
    initializeAutomations()
    registerAutomationSubscriber()
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
