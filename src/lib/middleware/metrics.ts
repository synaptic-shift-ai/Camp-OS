/**
 * Metrics Collection for Middleware
 *
 * CAM-132: Middleware Architecture Hardening
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * CRITICAL: Provides real-time visibility into middleware performance
 * and health metrics for production monitoring.
 *
 * Design Principles:
 * - Low overhead - minimal performance impact
 * - Non-blocking - metrics don't slow down requests
 * - Type-safe - all metric names and tags are typed
 * - Extensible - easy to add new monitoring services
 *
 * Following CLAUDE.md:
 * - C-4: Small, composable, testable functions
 * - C-6: Use import type for type-only imports
 */

/**
 * Metric types supported by the system
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer'

/**
 * Metric tags for filtering and grouping
 */
export type MetricTags = {
  readonly middleware?: string
  readonly route?: string
  readonly status?: 'success' | 'failure' | 'redirect' | 'loop_detected'
  readonly user_state?:
    | 'anonymous'
    | 'authenticated'
    | 'email_verified'
    | 'has_subscription'
    | 'onboarding_complete'
  readonly error_type?: string
  readonly redirect_target?: string
}

/**
 * Metric value with metadata
 */
type MetricValue = {
  readonly name: string
  readonly type: MetricType
  readonly value: number
  readonly tags: MetricTags
  readonly timestamp: number
}

/**
 * Metrics collector interface
 *
 * Implement this interface to integrate with monitoring services
 * like DataDog, Prometheus, CloudWatch, etc.
 */
export interface MetricsCollector {
  increment(name: string, tags?: MetricTags): void
  decrement(name: string, tags?: MetricTags): void
  gauge(name: string, value: number, tags?: MetricTags): void
  histogram(name: string, value: number, tags?: MetricTags): void
  timing(name: string, milliseconds: number, tags?: MetricTags): void
  flush(): Promise<void>
}

/**
 * In-memory metrics collector
 *
 * Stores metrics in memory for development and testing.
 * In production, use DataDogCollector, PrometheusCollector, etc.
 */
class InMemoryCollector implements MetricsCollector {
  private metrics: MetricValue[] = []

  increment(name: string, tags: MetricTags = {}): void {
    this.record('counter', name, 1, tags)
  }

  decrement(name: string, tags: MetricTags = {}): void {
    this.record('counter', name, -1, tags)
  }

  gauge(name: string, value: number, tags: MetricTags = {}): void {
    this.record('gauge', name, value, tags)
  }

  histogram(name: string, value: number, tags: MetricTags = {}): void {
    this.record('histogram', name, value, tags)
  }

  timing(name: string, milliseconds: number, tags: MetricTags = {}): void {
    this.record('timer', name, milliseconds, tags)
  }

  async flush(): Promise<void> {
    // In production, this would send metrics to monitoring service
    if (process.env.NODE_ENV === 'development') {
      console.log('[Metrics] Collected:', this.metrics.length)
    }
    this.metrics = []
  }

  private record(
    type: MetricType,
    name: string,
    value: number,
    tags: MetricTags
  ): void {
    this.metrics.push({
      name,
      type,
      value,
      tags,
      timestamp: Date.now(),
    })

    // Auto-flush every 100 metrics to prevent memory buildup
    if (this.metrics.length >= 100) {
      void this.flush()
    }
  }

  // Testing helper - get collected metrics
  getMetrics(): readonly MetricValue[] {
    return [...this.metrics]
  }

  // Testing helper - clear all metrics
  clear(): void {
    this.metrics = []
  }
}

/**
 * Global metrics collector instance
 *
 * Use this singleton for all metric collection.
 * Can be swapped with production collector via setCollector().
 */
let collector: MetricsCollector = new InMemoryCollector()

/**
 * Set the metrics collector implementation
 *
 * Use this to integrate with production monitoring services:
 * - DataDog: setCollector(new DataDogCollector())
 * - Prometheus: setCollector(new PrometheusCollector())
 * - CloudWatch: setCollector(new CloudWatchCollector())
 *
 * @param newCollector - Metrics collector implementation
 */
export function setCollector(newCollector: MetricsCollector): void {
  collector = newCollector
}

/**
 * Get current metrics collector (for testing)
 */
export function getCollector(): MetricsCollector {
  return collector
}

/**
 * Reset metrics collector to default InMemoryCollector (for testing)
 */
export function resetCollector(): void {
  collector = new InMemoryCollector()
}

/**
 * Middleware-specific metric names
 *
 * Centralized metric names for consistency and discoverability.
 */
export const METRICS = {
  // Request metrics
  MIDDLEWARE_REQUEST_TOTAL: 'middleware.request.total',
  MIDDLEWARE_REQUEST_DURATION_MS: 'middleware.request.duration_ms',

  // Redirect metrics
  MIDDLEWARE_REDIRECT_TOTAL: 'middleware.redirect.total',
  MIDDLEWARE_REDIRECT_LOOP_DETECTED: 'middleware.redirect_loop.detected',
  MIDDLEWARE_REDIRECT_LOOP_PREVENTED: 'middleware.redirect_loop.prevented',

  // Authentication metrics
  AUTH_VERIFICATION_TOTAL: 'middleware.auth.verification.total',
  AUTH_VERIFICATION_DURATION_MS: 'middleware.auth.verification.duration_ms',
  AUTH_UNAUTHENTICATED_TOTAL: 'middleware.auth.unauthenticated.total',
  AUTH_AUTHENTICATED_TOTAL: 'middleware.auth.authenticated.total',

  // Email verification metrics
  EMAIL_VERIFICATION_TOTAL: 'middleware.email.verification.total',
  EMAIL_UNVERIFIED_TOTAL: 'middleware.email.unverified.total',
  EMAIL_VERIFIED_TOTAL: 'middleware.email.verified.total',

  // Subscription metrics
  SUBSCRIPTION_CHECK_TOTAL: 'middleware.subscription.check.total',
  SUBSCRIPTION_CHECK_DURATION_MS: 'middleware.subscription.check.duration_ms',
  SUBSCRIPTION_ACTIVE_TOTAL: 'middleware.subscription.active.total',
  SUBSCRIPTION_INACTIVE_TOTAL: 'middleware.subscription.inactive.total',

  // Onboarding metrics
  ONBOARDING_CHECK_TOTAL: 'middleware.onboarding.check.total',
  ONBOARDING_CHECK_DURATION_MS: 'middleware.onboarding.check.duration_ms',
  ONBOARDING_COMPLETE_TOTAL: 'middleware.onboarding.complete.total',
  ONBOARDING_INCOMPLETE_TOTAL: 'middleware.onboarding.incomplete.total',
  ONBOARDING_WIZARD_ACCESS_TOTAL: 'middleware.onboarding.wizard_access.total',

  // Error metrics
  MIDDLEWARE_ERROR_TOTAL: 'middleware.error.total',
  MIDDLEWARE_ERROR_CRITICAL: 'middleware.error.critical',

  // User state distribution
  USER_STATE_DISTRIBUTION: 'middleware.user_state.distribution',
} as const

/**
 * Helper: Record middleware request
 *
 * Call at the start of middleware execution.
 *
 * @param middleware - Middleware name
 * @param route - Request route
 */
export function recordRequest(middleware: string, route: string): void {
  collector.increment(METRICS.MIDDLEWARE_REQUEST_TOTAL, {
    middleware,
    route,
  })
}

/**
 * Helper: Record middleware duration
 *
 * Call at the end of middleware execution with elapsed time.
 *
 * @param middleware - Middleware name
 * @param durationMs - Execution duration in milliseconds
 * @param status - Execution status
 */
export function recordDuration(
  middleware: string,
  durationMs: number,
  status: 'success' | 'failure' | 'redirect'
): void {
  collector.histogram(METRICS.MIDDLEWARE_REQUEST_DURATION_MS, durationMs, {
    middleware,
    status,
  })
}

/**
 * Helper: Record redirect
 *
 * Call when middleware redirects a request.
 *
 * @param middleware - Middleware that initiated redirect
 * @param target - Redirect target path
 */
export function recordRedirect(middleware: string, target: string): void {
  collector.increment(METRICS.MIDDLEWARE_REDIRECT_TOTAL, {
    middleware,
    redirect_target: target,
  })
}

/**
 * Helper: Record redirect loop detection
 *
 * Call when circuit breaker detects a redirect loop.
 *
 * @param middleware - Middleware where loop was detected
 * @param route - Route where loop occurred
 */
export function recordRedirectLoopDetected(
  middleware: string,
  route: string
): void {
  collector.increment(METRICS.MIDDLEWARE_REDIRECT_LOOP_DETECTED, {
    middleware,
    route,
  })
}

/**
 * Helper: Record redirect loop prevented
 *
 * Call when circuit breaker prevents a redirect loop.
 *
 * @param middleware - Middleware where loop was prevented
 * @param route - Route where loop was prevented
 */
export function recordRedirectLoopPrevented(
  middleware: string,
  route: string
): void {
  collector.increment(METRICS.MIDDLEWARE_REDIRECT_LOOP_PREVENTED, {
    middleware,
    route,
  })
}

/**
 * Helper: Record error
 *
 * Call when middleware encounters an error.
 *
 * @param middleware - Middleware where error occurred
 * @param errorType - Type of error (e.g., 'configuration', 'network', 'database')
 * @param critical - Whether error is critical
 */
export function recordError(
  middleware: string,
  errorType: string,
  critical: boolean = false
): void {
  collector.increment(METRICS.MIDDLEWARE_ERROR_TOTAL, {
    middleware,
    error_type: errorType,
  })

  if (critical) {
    collector.increment(METRICS.MIDDLEWARE_ERROR_CRITICAL, {
      middleware,
      error_type: errorType,
    })
  }
}

/**
 * Helper: Record user state distribution
 *
 * Call to track which user states are most common.
 *
 * @param userState - Current user state
 */
export function recordUserState(
  userState: MetricTags['user_state']
): void {
  if (!userState) return

  collector.increment(METRICS.USER_STATE_DISTRIBUTION, {
    user_state: userState,
  })
}

/**
 * Timer helper for measuring execution time
 *
 * Usage:
 * ```typescript
 * const timer = startTimer()
 * await someOperation()
 * const duration = timer.end()
 * recordDuration('auth-middleware', duration, 'success')
 * ```
 */
export function startTimer(): {
  end: () => number
} {
  const startTime = Date.now()

  return {
    end: () => Date.now() - startTime,
  }
}

/**
 * Decorator: Measure middleware execution time
 *
 * Wraps a middleware function to automatically record execution time.
 *
 * @param middleware - Middleware name
 * @param fn - Middleware function to measure
 * @returns Wrapped function with timing
 */
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  middleware: string,
  fn: T
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const timer = startTimer()
    let status: 'success' | 'failure' | 'redirect' = 'success'

    try {
      const result = await fn(...args)

      // Detect redirect from result
      if (
        result instanceof Response ||
        (typeof result === 'object' &&
          result !== null &&
          'status' in result &&
          (result.status === 301 ||
            result.status === 302 ||
            result.status === 307 ||
            result.status === 308))
      ) {
        status = 'redirect'
      }

      return result
    } catch (error) {
      status = 'failure'
      throw error
    } finally {
      const duration = timer.end()
      recordDuration(middleware, duration, status)
    }
  }) as T
}

/**
 * Flush all metrics to monitoring service
 *
 * Call this periodically or on shutdown to ensure metrics are sent.
 */
export async function flushMetrics(): Promise<void> {
  await collector.flush()
}
