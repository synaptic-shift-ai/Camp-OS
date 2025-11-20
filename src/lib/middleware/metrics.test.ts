/**
 * Metrics Collection Tests
 *
 * CAM-132: Middleware Architecture Hardening
 *
 * Tests metrics collection for middleware observability.
 *
 * Following CLAUDE.md T-9: Use dynamic generation, not hardcoded values
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  setCollector,
  getCollector,
  resetCollector,
  recordRequest,
  recordDuration,
  recordRedirect,
  recordRedirectLoopDetected,
  recordRedirectLoopPrevented,
  recordError,
  recordUserState,
  startTimer,
  withMetrics,
  METRICS,
  type MetricsCollector,
} from './metrics'

describe('Metrics', () => {
  let collector: any

  beforeEach(() => {
    // Reset to default in-memory collector before each test
    resetCollector()
    collector = getCollector()
    // Clear any existing metrics
    if (collector.clear) {
      collector.clear()
    }
  })

  describe('recordRequest', () => {
    it('should increment request total counter', () => {
      recordRequest('auth-middleware', '/dashboard')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: METRICS.MIDDLEWARE_REQUEST_TOTAL,
        type: 'counter',
        value: 1,
        tags: {
          middleware: 'auth-middleware',
          route: '/dashboard',
        },
      })
    })

    it('should record multiple requests independently', () => {
      recordRequest('auth-middleware', '/dashboard')
      recordRequest('subscription-middleware', '/onboarding')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(2)
      expect(metrics[0]?.tags.middleware).toBe('auth-middleware')
      expect(metrics[1]?.tags.middleware).toBe('subscription-middleware')
    })
  })

  describe('recordDuration', () => {
    it('should record successful middleware duration', () => {
      recordDuration('auth-middleware', 150, 'success')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: METRICS.MIDDLEWARE_REQUEST_DURATION_MS,
        type: 'histogram',
        value: 150,
        tags: {
          middleware: 'auth-middleware',
          status: 'success',
        },
      })
    })

    it('should record redirect duration separately', () => {
      recordDuration('auth-middleware', 100, 'redirect')

      const metrics = collector.getMetrics()
      expect(metrics[0]?.tags.status).toBe('redirect')
    })

    it('should record failure duration separately', () => {
      recordDuration('subscription-middleware', 200, 'failure')

      const metrics = collector.getMetrics()
      expect(metrics[0]?.tags.status).toBe('failure')
    })
  })

  describe('recordRedirect', () => {
    it('should increment redirect counter with target', () => {
      recordRedirect('auth-middleware', '/login')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: METRICS.MIDDLEWARE_REDIRECT_TOTAL,
        type: 'counter',
        value: 1,
        tags: {
          middleware: 'auth-middleware',
          redirect_target: '/login',
        },
      })
    })
  })

  describe('recordRedirectLoopDetected', () => {
    it('should increment loop detection counter', () => {
      recordRedirectLoopDetected('onboarding-middleware', '/dashboard')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: METRICS.MIDDLEWARE_REDIRECT_LOOP_DETECTED,
        type: 'counter',
        value: 1,
        tags: {
          middleware: 'onboarding-middleware',
          route: '/dashboard',
        },
      })
    })
  })

  describe('recordRedirectLoopPrevented', () => {
    it('should increment loop prevention counter', () => {
      recordRedirectLoopPrevented('onboarding-middleware', '/dashboard')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: METRICS.MIDDLEWARE_REDIRECT_LOOP_PREVENTED,
        type: 'counter',
        value: 1,
        tags: {
          middleware: 'onboarding-middleware',
          route: '/dashboard',
        },
      })
    })
  })

  describe('recordError', () => {
    it('should increment error counter', () => {
      recordError('auth-middleware', 'database_connection')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: METRICS.MIDDLEWARE_ERROR_TOTAL,
        type: 'counter',
        value: 1,
        tags: {
          middleware: 'auth-middleware',
          error_type: 'database_connection',
        },
      })
    })

    it('should increment critical error counter when critical=true', () => {
      recordError('auth-middleware', 'configuration', true)

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(2)
      expect(metrics[0]?.name).toBe(METRICS.MIDDLEWARE_ERROR_TOTAL)
      expect(metrics[1]?.name).toBe(METRICS.MIDDLEWARE_ERROR_CRITICAL)
    })

    it('should NOT increment critical counter when critical=false', () => {
      recordError('auth-middleware', 'validation', false)

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]?.name).toBe(METRICS.MIDDLEWARE_ERROR_TOTAL)
    })
  })

  describe('recordUserState', () => {
    it('should record user state distribution', () => {
      recordUserState('authenticated')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: METRICS.USER_STATE_DISTRIBUTION,
        type: 'counter',
        value: 1,
        tags: {
          user_state: 'authenticated',
        },
      })
    })

    it('should handle different user states', () => {
      recordUserState('anonymous')
      recordUserState('email_verified')
      recordUserState('has_subscription')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(3)
      expect(metrics[0]?.tags.user_state).toBe('anonymous')
      expect(metrics[1]?.tags.user_state).toBe('email_verified')
      expect(metrics[2]?.tags.user_state).toBe('has_subscription')
    })

    it('should not record if userState is undefined', () => {
      recordUserState(undefined)

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(0)
    })
  })

  describe('startTimer', () => {
    it('should measure elapsed time', async () => {
      const timer = startTimer()

      // Wait a short time
      await new Promise((resolve) => setTimeout(resolve, 10))

      const duration = timer.end()

      // Should be at least 10ms
      expect(duration).toBeGreaterThanOrEqual(10)
      // Should be less than 100ms (generous upper bound)
      expect(duration).toBeLessThan(100)
    })

    it('should return independent timers', async () => {
      const timer1 = startTimer()
      await new Promise((resolve) => setTimeout(resolve, 10))
      const timer2 = startTimer()
      await new Promise((resolve) => setTimeout(resolve, 10))

      const duration1 = timer1.end()
      const duration2 = timer2.end()

      // Timer1 should be longer (started earlier)
      expect(duration1).toBeGreaterThan(duration2)
    })
  })

  describe('withMetrics', () => {
    it('should measure function execution time on success', async () => {
      const fn = async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return x * 2
      }

      const wrapped = withMetrics('test-middleware', fn)
      const result = await wrapped(5)

      expect(result).toBe(10)

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: METRICS.MIDDLEWARE_REQUEST_DURATION_MS,
        type: 'histogram',
        tags: {
          middleware: 'test-middleware',
          status: 'success',
        },
      })
      expect(metrics[0]?.value).toBeGreaterThanOrEqual(10)
    })

    it('should record failure status on error', async () => {
      const fn = async () => {
        throw new Error('Test error')
      }

      const wrapped = withMetrics('test-middleware', fn)

      await expect(wrapped()).rejects.toThrow('Test error')

      const metrics = collector.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]?.tags.status).toBe('failure')
    })

    it('should detect redirect responses', async () => {
      const fn = async () => {
        return new Response(null, { status: 307 })
      }

      const wrapped = withMetrics('test-middleware', fn)
      await wrapped()

      const metrics = collector.getMetrics()
      expect(metrics[0]?.tags.status).toBe('redirect')
    })

    it('should detect redirect from object with status', async () => {
      const fn = async () => {
        return { status: 302, headers: new Headers() }
      }

      const wrapped = withMetrics('test-middleware', fn)
      await wrapped()

      const metrics = collector.getMetrics()
      expect(metrics[0]?.tags.status).toBe('redirect')
    })
  })

  describe('collector replacement', () => {
    it('should allow setting custom collector', () => {
      const customCollector: MetricsCollector = {
        increment: () => {},
        decrement: () => {},
        gauge: () => {},
        histogram: () => {},
        timing: () => {},
        flush: async () => {},
      }

      setCollector(customCollector)

      const current = getCollector()
      expect(current).toBe(customCollector)
    })
  })

  describe('metric names', () => {
    it('should have consistent naming convention', () => {
      // All metrics should start with 'middleware.'
      Object.values(METRICS).forEach((metricName) => {
        expect(metricName).toMatch(/^middleware\./)
      })
    })

    it('should have descriptive names', () => {
      // Check a few key metrics exist
      expect(METRICS.MIDDLEWARE_REQUEST_TOTAL).toBe(
        'middleware.request.total'
      )
      expect(METRICS.MIDDLEWARE_REDIRECT_LOOP_DETECTED).toBe(
        'middleware.redirect_loop.detected'
      )
      expect(METRICS.AUTH_VERIFICATION_TOTAL).toBe(
        'middleware.auth.verification.total'
      )
    })
  })

  describe('auto-flush', () => {
    it('should auto-flush after 100 metrics', () => {
      // Record 101 metrics
      for (let i = 0; i < 101; i++) {
        recordRequest('test-middleware', '/test')
      }

      const metrics = collector.getMetrics()
      // Should have flushed at 100, so only 1 left
      expect(metrics.length).toBeLessThan(101)
    })
  })
})
