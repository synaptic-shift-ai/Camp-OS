import * as Sentry from '@sentry/nextjs'
import type { NextRequest } from 'next/server'

/**
 * Add Sentry context for an API request
 */
export function addSentryContext(request: NextRequest, additionalContext?: Record<string, any>) {
  Sentry.setContext('request', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    ...additionalContext,
  })
}

/**
 * Add tenant context to Sentry for multi-tenant debugging
 */
export function addTenantContext(propertyId: string, userId?: string) {
  Sentry.setTag('property_id', propertyId)
  if (userId) {
    Sentry.setUser({ id: userId })
  }
}

/**
 * Track a custom operation in Sentry
 */
export function trackOperation(operationName: string, data?: Record<string, any>) {
  const transaction = Sentry.startInactiveSpan({
    name: operationName,
    op: 'operation',
  })

  if (data) {
    Sentry.setContext('operation_data', data)
  }

  return {
    finish: (status: 'success' | 'error' = 'success') => {
      if (transaction) {
        transaction.end()
      }
      const breadcrumb: any = {
        category: 'operation',
        message: operationName,
        level: status === 'success' ? 'info' : 'error',
      }

      // Only add data if it exists
      if (data) {
        breadcrumb.data = data
      }

      Sentry.addBreadcrumb(breadcrumb)
    },
  }
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error,
  context?: {
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
    tags?: Record<string, string>
    extra?: Record<string, any>
  }
) {
  if (context?.tags) {
    Sentry.setTags(context.tags)
  }

  if (context?.extra) {
    Sentry.setContext('additional_info', context.extra)
  }

  Sentry.captureException(error, {
    level: context?.level || 'error',
  })
}
