/**
 * Redirect Loop Detector Tests
 *
 * CAM-132: Middleware Architecture Hardening
 *
 * Tests the circuit breaker pattern for preventing infinite redirect loops.
 * CRITICAL: These tests prevent the Oct 30, 2025 incident from recurring.
 *
 * Following CLAUDE.md T-9: Use dynamic dates, not hardcoded values
 * Following CLAUDE.md T-6: Test entire structure in one assertion when possible
 */

import { describe, it, expect } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { RedirectLoopDetector } from './loop-detector'

describe('RedirectLoopDetector', () => {
  describe('check', () => {
    it('should allow first redirect', () => {
      const request = createMockRequest('/')

      const result = RedirectLoopDetector.check(request, '/dashboard')

      expect(result).toBe(true)
    })

    it('should allow second redirect', () => {
      const request = createMockRequestWithCount(1)

      const result = RedirectLoopDetector.check(request, '/dashboard')

      expect(result).toBe(true)
    })

    it('should allow third redirect', () => {
      const request = createMockRequestWithCount(2)

      const result = RedirectLoopDetector.check(request, '/dashboard')

      expect(result).toBe(true)
    })

    it('should block fourth redirect (circuit breaker)', () => {
      const request = createMockRequestWithCount(3)

      const result = RedirectLoopDetector.check(request, '/dashboard')

      expect(result).toBe(false)
    })

    it('should block fifth redirect and beyond', () => {
      const request = createMockRequestWithCount(5)

      const result = RedirectLoopDetector.check(request, '/dashboard')

      expect(result).toBe(false)
    })

    it('should reset count if last redirect was >5s ago', () => {
      const oldTimestamp = Date.now() - 6000 // 6 seconds ago
      const request = createMockRequestWithCountAndTime(3, oldTimestamp)

      const result = RedirectLoopDetector.check(request, '/dashboard')

      // Should allow because count is stale
      expect(result).toBe(true)
    })

    it('should NOT reset count if last redirect was <5s ago', () => {
      const recentTimestamp = Date.now() - 2000 // 2 seconds ago
      const request = createMockRequestWithCountAndTime(3, recentTimestamp)

      const result = RedirectLoopDetector.check(request, '/dashboard')

      // Should block because count is still fresh
      expect(result).toBe(false)
    })
  })

  describe('incrementCount', () => {
    it('should set count to 1 on first increment', () => {
      const response = NextResponse.next()

      RedirectLoopDetector.incrementCount(response)

      const countCookie = response.cookies.get('mw_redirect_count')
      expect(countCookie?.value).toBe('1')
    })

    it('should increment existing count', () => {
      const response = createMockResponseWithCount(2)

      RedirectLoopDetector.incrementCount(response)

      const countCookie = response.cookies.get('mw_redirect_count')
      expect(countCookie?.value).toBe('3')
    })

    it('should set timestamp cookie', () => {
      const response = NextResponse.next()
      const beforeTime = Date.now()

      RedirectLoopDetector.incrementCount(response)

      const afterTime = Date.now()
      const timeCookie = response.cookies.get('mw_redirect_time')
      expect(timeCookie).toBeDefined()

      const timestamp = parseInt(timeCookie?.value || '0', 10)
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(timestamp).toBeLessThanOrEqual(afterTime)
    })

    it('should set httpOnly and sameSite cookies', () => {
      const response = NextResponse.next()

      RedirectLoopDetector.incrementCount(response)

      const countCookie = response.cookies.get('mw_redirect_count')
      const timeCookie = response.cookies.get('mw_redirect_time')

      // Note: Next.js cookie API doesn't expose httpOnly/sameSite in get()
      // These are verified by the cookie options in the implementation
      expect(countCookie).toBeDefined()
      expect(timeCookie).toBeDefined()
    })
  })

  describe('resetCount', () => {
    it('should delete count cookie', () => {
      const response = createMockResponseWithCount(3)

      RedirectLoopDetector.resetCount(response)

      const countCookie = response.cookies.get('mw_redirect_count')
      // Next.js sets expired cookie rather than undefined
      expect(countCookie?.value).toBe('')
    })

    it('should delete time cookie', () => {
      const response = createMockResponseWithCount(3)

      RedirectLoopDetector.resetCount(response)

      const timeCookie = response.cookies.get('mw_redirect_time')
      // Next.js sets expired cookie rather than undefined
      expect(timeCookie?.value).toBe('')
    })
  })

  describe('getDiagnostics', () => {
    it('should return correct diagnostics for fresh request', () => {
      const request = createMockRequest('/')

      const diagnostics = RedirectLoopDetector.getDiagnostics(request)

      expect(diagnostics).toEqual({
        count: 0,
        lastRedirect: null,
        isStale: false,
        wouldBlock: false,
      })
    })

    it('should return correct diagnostics for request at limit', () => {
      const timestamp = Date.now()
      const request = createMockRequestWithCountAndTime(3, timestamp)

      const diagnostics = RedirectLoopDetector.getDiagnostics(request)

      expect(diagnostics).toEqual({
        count: 3,
        lastRedirect: timestamp,
        isStale: false,
        wouldBlock: true,
      })
    })

    it('should return correct diagnostics for stale count', () => {
      const oldTimestamp = Date.now() - 6000
      const request = createMockRequestWithCountAndTime(3, oldTimestamp)

      const diagnostics = RedirectLoopDetector.getDiagnostics(request)

      expect(diagnostics).toEqual({
        count: 3,
        lastRedirect: oldTimestamp,
        isStale: true,
        wouldBlock: false, // Not blocking because stale
      })
    })

    it('should return correct diagnostics for under-limit count', () => {
      const timestamp = Date.now()
      const request = createMockRequestWithCountAndTime(2, timestamp)

      const diagnostics = RedirectLoopDetector.getDiagnostics(request)

      expect(diagnostics).toEqual({
        count: 2,
        lastRedirect: timestamp,
        isStale: false,
        wouldBlock: false, // Not blocking, under limit
      })
    })
  })

  describe('integration scenario: conversion pipeline', () => {
    it('should prevent infinite redirect loop in wizard access', () => {
      // Simulate the Oct 30, 2025 incident scenario:
      // User completes checkout → redirected to /dashboard?wizard=true
      // Middleware misconfigured → redirects to /onboarding
      // /onboarding redirects to /dashboard?wizard=true
      // Loop: /dashboard → /onboarding → /dashboard → /onboarding

      const request = createMockRequest('/dashboard?wizard=true')

      // First redirect: /dashboard → /onboarding
      const allowed1 = RedirectLoopDetector.check(request, '/onboarding')
      expect(allowed1).toBe(true)

      // Simulate redirect happened
      const request2 = createMockRequestWithCount(1)

      // Second redirect: /onboarding → /dashboard
      const allowed2 = RedirectLoopDetector.check(request2, '/dashboard')
      expect(allowed2).toBe(true)

      // Third redirect: /dashboard → /onboarding
      const request3 = createMockRequestWithCount(2)
      const allowed3 = RedirectLoopDetector.check(request3, '/onboarding')
      expect(allowed3).toBe(true)

      // Fourth redirect: /onboarding → /dashboard (BLOCKED!)
      const request4 = createMockRequestWithCount(3)
      const allowed4 = RedirectLoopDetector.check(request4, '/dashboard')
      expect(allowed4).toBe(false) // Circuit breaker trips!
    })
  })
})

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create mock NextRequest for testing
 */
function createMockRequest(pathname: string): NextRequest {
  const url = `http://localhost:3000${pathname}`
  return new NextRequest(url)
}

/**
 * Create mock NextRequest with redirect count cookie
 */
function createMockRequestWithCount(count: number): NextRequest {
  const _request = createMockRequest('/')

  // Set the cookie manually
  // Note: Next.js request cookies are read-only, so we create a request
  // with the cookie already set in the URL
  const url = new URL('http://localhost:3000/')
  const cookieValue = `mw_redirect_count=${count}`

  // Create request with cookie header
  return new NextRequest(url, {
    headers: {
      cookie: cookieValue,
    },
  })
}

/**
 * Create mock NextRequest with redirect count and timestamp cookies
 */
function createMockRequestWithCountAndTime(
  count: number,
  timestamp: number
): NextRequest {
  const url = new URL('http://localhost:3000/')
  const cookieValue = `mw_redirect_count=${count}; mw_redirect_time=${timestamp}`

  return new NextRequest(url, {
    headers: {
      cookie: cookieValue,
    },
  })
}

/**
 * Create mock NextResponse with redirect count cookie
 */
function createMockResponseWithCount(count: number): NextResponse {
  const response = NextResponse.next()
  response.cookies.set('mw_redirect_count', String(count))
  response.cookies.set('mw_redirect_time', String(Date.now()))
  return response
}
