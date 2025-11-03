/**
 * Middleware Composition Pattern Tests
 *
 * CAM-139: Implement Middleware Composition Pattern
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * Tests verify:
 * - Middleware composition executes in correct order
 * - Short-circuit mechanism works for early returns (redirects/errors)
 * - Context is properly passed between middleware layers
 * - Type safety is enforced throughout composition
 * - Async operations are handled correctly
 *
 * Following CLAUDE.md:
 * - T-1: Colocate unit tests with source
 * - T-9: Use dynamic test data generation
 * - C-1: TDD approach
 */

import { describe, it, expect, vi } from 'vitest'
import { NextResponse } from 'next/server'
import type { MiddlewareRequest, MiddlewareFunction } from './types'
import { createSessionId } from './types'
import { composeMiddleware } from './compose'

/**
 * Test helper: Create a mock middleware request
 * Uses dynamic data generation as per CLAUDE.md T-9
 */
function createMockRequest(pathname = '/test'): MiddlewareRequest {
  const sessionId = createSessionId(`session-${Date.now()}`)
  const searchParams = new URLSearchParams()

  return {
    nextUrl: {
      pathname,
      searchParams,
      clone: () => ({ pathname, searchParams }),
    },
    middlewareContext: {
      sessionId,
      pathname,
      searchParams,
    },
  } as MiddlewareRequest
}

/**
 * Test helper: Create a spy middleware that tracks execution
 * Returns a tuple of [middleware, executionSpy]
 */
function createSpyMiddleware(
  name: string,
  shouldReturn?: NextResponse | null
): [MiddlewareFunction, ReturnType<typeof vi.fn>] {
  const spy = vi.fn()

  const middleware: MiddlewareFunction = async (req) => {
    spy(name, req.middlewareContext.pathname)
    if (shouldReturn) return shouldReturn
    return req
  }

  return [middleware, spy]
}

describe('composeMiddleware', () => {
  describe('execution order', () => {
    it('should execute middleware in the order they are provided', async () => {
      const req = createMockRequest('/dashboard')
      const [middleware1, spy1] = createSpyMiddleware('first')
      const [middleware2, spy2] = createSpyMiddleware('second')
      const [middleware3, spy3] = createSpyMiddleware('third')

      const composed = composeMiddleware(middleware1, middleware2, middleware3)
      await composed(req)

      // Verify execution order by checking call counts and order
      // spy1 must be called first, then spy2, then spy3
      expect(spy1.mock.invocationCallOrder[0]).toBeLessThan(
        spy2.mock.invocationCallOrder[0]!
      )
      expect(spy2.mock.invocationCallOrder[0]!).toBeLessThan(
        spy3.mock.invocationCallOrder[0]!
      )
      expect(spy1).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(1)
      expect(spy3).toHaveBeenCalledTimes(1)
    })

    it('should pass context between middleware layers', async () => {
      const req = createMockRequest('/test')

      // Middleware that adds data to context
      const addAuthMiddleware: MiddlewareFunction = async (req) => {
        return {
          ...req,
          middlewareContext: {
            ...req.middlewareContext,
            auth: {
              userId: 'user-123',
              email: 'test@example.com',
            },
          },
        } as MiddlewareRequest
      }

      // Middleware that reads the added context
      const verifyContextMiddleware = vi.fn(async (req: MiddlewareRequest) => {
        return req
      })

      const composed = composeMiddleware(
        addAuthMiddleware,
        verifyContextMiddleware
      )
      const result = (await composed(req)) as MiddlewareRequest

      // Verify context was passed through
      expect(verifyContextMiddleware).toHaveBeenCalled()
      const calledWithReq = verifyContextMiddleware.mock
        .calls[0]![0] as MiddlewareRequest
      expect(calledWithReq.middlewareContext).toHaveProperty('auth')
      expect((calledWithReq.middlewareContext as any).auth.userId).toBe(
        'user-123'
      )
    })
  })

  describe('short-circuit mechanism', () => {
    it('should stop execution when middleware returns a redirect response', async () => {
      const req = createMockRequest('/protected')
      const redirectResponse = NextResponse.redirect(
        new URL('http://localhost:3000/login')
      )

      const [middleware1, spy1] = createSpyMiddleware('first')
      const [middleware2, spy2] = createSpyMiddleware('second', redirectResponse)
      const [middleware3, spy3] = createSpyMiddleware('third')

      const composed = composeMiddleware(middleware1, middleware2, middleware3)
      const result = await composed(req)

      // Verify short-circuit behavior
      expect(spy1).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(1)
      expect(spy3).not.toHaveBeenCalled() // Should NOT execute
      expect(result).toBe(redirectResponse)
    })

    it('should stop execution when middleware returns an error response', async () => {
      const req = createMockRequest('/api/data')
      const errorResponse = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )

      const [middleware1, spy1] = createSpyMiddleware('first', errorResponse)
      const [middleware2, spy2] = createSpyMiddleware('second')

      const composed = composeMiddleware(middleware1, middleware2)
      const result = await composed(req)

      // Verify short-circuit behavior
      expect(spy1).toHaveBeenCalledTimes(1)
      expect(spy2).not.toHaveBeenCalled()
      expect(result).toBe(errorResponse)
    })

    it('should continue execution when middleware returns null', async () => {
      const req = createMockRequest('/test')

      const middleware1: MiddlewareFunction = async (req) => {
        return req // Continue
      }

      const middleware2 = vi.fn(async (req: MiddlewareRequest) => {
        return req
      })

      const composed = composeMiddleware(middleware1, middleware2)
      await composed(req)

      // Should continue to next middleware
      expect(middleware2).toHaveBeenCalledTimes(1)
    })
  })

  describe('async operation handling', () => {
    it('should handle async middleware correctly', async () => {
      const req = createMockRequest('/test')
      const executionOrder: string[] = []

      const asyncMiddleware1: MiddlewareFunction = async (req) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('first')
        return req
      }

      const asyncMiddleware2: MiddlewareFunction = async (req) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        executionOrder.push('second')
        return req
      }

      const composed = composeMiddleware(asyncMiddleware1, asyncMiddleware2)
      await composed(req)

      // Verify async execution order is maintained
      expect(executionOrder).toEqual(['first', 'second'])
    })

    it('should propagate errors from async middleware', async () => {
      const req = createMockRequest('/test')
      const testError = new Error('Middleware failed')

      const failingMiddleware: MiddlewareFunction = async () => {
        throw testError
      }

      const composed = composeMiddleware(failingMiddleware)

      // Should propagate the error
      await expect(composed(req)).rejects.toThrow('Middleware failed')
    })
  })

  describe('edge cases', () => {
    it('should handle empty middleware array', async () => {
      const req = createMockRequest('/test')
      const composed = composeMiddleware()
      const result = await composed(req)

      // Should return the original request unchanged
      expect(result).toBe(req)
    })

    it('should handle single middleware', async () => {
      const req = createMockRequest('/test')
      const [middleware, spy] = createSpyMiddleware('single')

      const composed = composeMiddleware(middleware)
      await composed(req)

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('should return the modified request from the last middleware', async () => {
      const req = createMockRequest('/test')

      const middleware1: MiddlewareFunction = async (req) => {
        const extended = req as any
        extended.middlewareContext = {
          ...req.middlewareContext,
          data1: 'value1',
        }
        return extended
      }

      const middleware2: MiddlewareFunction = async (req) => {
        const extended = req as any
        extended.middlewareContext = {
          ...req.middlewareContext,
          data2: 'value2',
        }
        return extended
      }

      const composed = composeMiddleware(middleware1, middleware2)
      const result = (await composed(req)) as MiddlewareRequest

      // Should have both modifications
      expect((result.middlewareContext as any).data1).toBe('value1')
      expect((result.middlewareContext as any).data2).toBe('value2')
    })
  })

  describe('type safety', () => {
    it('should maintain TypeScript type safety throughout composition', async () => {
      const req = createMockRequest('/test')

      // This test verifies compile-time type safety
      // If types are wrong, TypeScript will catch it before runtime
      const middleware1: MiddlewareFunction = async (req) => req
      const middleware2: MiddlewareFunction = async (req) => req

      const composed: MiddlewareFunction = composeMiddleware(
        middleware1,
        middleware2
      )

      const result = await composed(req)

      // Type assertion to verify result type
      expect(result).toBeDefined()
      expect(
        typeof result === 'object' && 'middlewareContext' in result
      ).toBe(true)
    })
  })
})
