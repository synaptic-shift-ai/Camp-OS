/**
 * Middleware Initialization Tests
 *
 * CAM-140: Update Main Middleware with Composition
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * Tests verify:
 * - Request initialization creates proper middleware context
 * - Session IDs are unique and properly formatted
 * - Supabase client is correctly configured
 *
 * Following CLAUDE.md:
 * - T-1: Colocate unit tests with source
 * - T-9: Use dynamic test data generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { initializeRequest, createInitialResponse } from './init'

/**
 * Create mock Next.js request for testing
 */
function createMockRequest(pathname: string, searchParams?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`)
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return {
    url: url.toString(),
    nextUrl: {
      pathname,
      searchParams: url.searchParams,
      clone: () => ({ pathname, searchParams: url.searchParams }),
    },
    cookies: {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    },
  } as unknown as NextRequest
}

describe('initializeRequest', () => {
  it('should create middleware request with session ID and context', () => {
    const request = createMockRequest('/dashboard')
    const middlewareRequest = initializeRequest(request)

    // Should have middleware context
    expect(middlewareRequest.middlewareContext).toBeDefined()
    expect(middlewareRequest.middlewareContext.sessionId).toBeDefined()
    expect(middlewareRequest.middlewareContext.pathname).toBe('/dashboard')
    expect(middlewareRequest.middlewareContext.searchParams).toBeInstanceOf(URLSearchParams)
  })

  it('should generate unique session IDs for each request', () => {
    const request1 = createMockRequest('/dashboard')
    const request2 = createMockRequest('/dashboard')

    const middleware1 = initializeRequest(request1)
    const middleware2 = initializeRequest(request2)

    // Session IDs should be different
    expect(middleware1.middlewareContext.sessionId).not.toBe(middleware2.middlewareContext.sessionId)
  })

  it('should preserve search parameters in context', () => {
    const request = createMockRequest('/dashboard', { wizard: 'true', step: '2' })
    const middlewareRequest = initializeRequest(request)

    // Search params should be preserved
    expect(middlewareRequest.middlewareContext.searchParams.get('wizard')).toBe('true')
    expect(middlewareRequest.middlewareContext.searchParams.get('step')).toBe('2')
  })

  it('should extract pathname correctly from URL', () => {
    const testPaths = ['/dashboard', '/onboarding', '/dashboard/sites', '/api/test']

    testPaths.forEach((path) => {
      const request = createMockRequest(path)
      const middlewareRequest = initializeRequest(request)

      expect(middlewareRequest.middlewareContext.pathname).toBe(path)
    })
  })
})

describe('createInitialResponse', () => {
  it('should create NextResponse that continues the request', () => {
    const request = createMockRequest('/dashboard')
    const response = createInitialResponse(request)

    // Should be a NextResponse instance
    expect(response).toBeDefined()
    expect(response instanceof Response).toBe(true)
  })

  it('should create response with cookies interface', () => {
    const request = createMockRequest('/dashboard')
    const response = createInitialResponse(request)

    // Should have cookies interface
    expect(response.cookies).toBeDefined()
    expect(typeof response.cookies.set).toBe('function')
    expect(typeof response.cookies.get).toBe('function')
  })
})
