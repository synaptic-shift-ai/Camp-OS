/**
 * Redirect Loop Detection
 *
 * CAM-132: Middleware Architecture Hardening
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * CRITICAL: This prevents infinite redirect loops that broke the conversion
 * pipeline during the Oct 30, 2025 investor demo.
 *
 * Design:
 * - Circuit breaker pattern - tracks redirect counts
 * - Cookie-based state management - survives redirects
 * - Time-based reset - prevents false positives
 * - Observability - logs and alerts on loop detection
 *
 * Following CLAUDE.md:
 * - C-4: Small, composable, testable functions
 * - C-6: Use import type for type-only imports
 */

import type { NextRequest, NextResponse } from 'next/server'

/**
 * Redirect Loop Detector
 *
 * Acts as a circuit breaker to detect and prevent infinite redirect loops.
 * Uses cookies to track redirect counts across requests.
 *
 * Thresholds:
 * - MAX_REDIRECTS: 3 redirects allowed before circuit breaks
 * - RESET_AFTER_MS: 5000ms (5 seconds) - resets count if no redirects
 *
 * Cookie Strategy:
 * - Short-lived cookies (10s max age)
 * - HttpOnly for security
 * - SameSite=lax for CSRF protection
 *
 * CRITICAL: This is a safety net. If it triggers, there is a middleware bug.
 */
export class RedirectLoopDetector {
  private static readonly MAX_REDIRECTS = 3
  private static readonly COOKIE_NAME = 'mw_redirect_count'
  private static readonly COOKIE_TIME_NAME = 'mw_redirect_time'
  private static readonly RESET_AFTER_MS = 5000
  private static readonly COOKIE_MAX_AGE = 10 // seconds

  /**
   * Check if a redirect should be allowed
   *
   * Returns false if loop detected (circuit breaker trips)
   * Returns true if redirect is safe to proceed
   *
   * @param request - Current request
   * @param targetPath - Path being redirected to
   * @returns True if redirect is allowed, false if loop detected
   */
  static check(request: NextRequest, targetPath: string): boolean {
    const count = this.getRedirectCount(request)
    const lastRedirect = this.getLastRedirectTime(request)

    // Reset counter if last redirect was >5s ago
    const now = Date.now()
    if (lastRedirect && now - lastRedirect > this.RESET_AFTER_MS) {
      // Stale count, safe to proceed
      return true
    }

    // Check if we've exceeded the limit
    if (count >= this.MAX_REDIRECTS) {
      // CIRCUIT BREAKER: Too many redirects
      this.alertRedirectLoop(request, targetPath, count)
      return false // Block redirect
    }

    return true // Allow redirect
  }

  /**
   * Increment the redirect counter
   *
   * Call this after creating a redirect response
   * Updates cookies to track the redirect count
   *
   * @param response - Redirect response to update
   */
  static incrementCount(response: NextResponse): void {
    const currentCount = this.getRedirectCountFromResponse(response)
    const newCount = currentCount + 1

    response.cookies.set(this.COOKIE_NAME, String(newCount), {
      maxAge: this.COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })

    response.cookies.set(this.COOKIE_TIME_NAME, String(Date.now()), {
      maxAge: this.COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  }

  /**
   * Reset the redirect counter
   *
   * Call this when a request successfully completes without redirecting
   * Clears the tracking cookies
   *
   * @param response - Response to update
   */
  static resetCount(response: NextResponse): void {
    response.cookies.delete(this.COOKIE_NAME)
    response.cookies.delete(this.COOKIE_TIME_NAME)
  }

  /**
   * Get current redirect count from request cookies
   */
  private static getRedirectCount(request: NextRequest): number {
    const cookie = request.cookies.get(this.COOKIE_NAME)
    return cookie?.value ? parseInt(cookie.value, 10) : 0
  }

  /**
   * Get redirect count from response cookies (for incrementing)
   */
  private static getRedirectCountFromResponse(response: NextResponse): number {
    const cookie = response.cookies.get(this.COOKIE_NAME)
    return cookie?.value ? parseInt(cookie.value, 10) : 0
  }

  /**
   * Get last redirect timestamp from request cookies
   */
  private static getLastRedirectTime(request: NextRequest): number | null {
    const cookie = request.cookies.get(this.COOKIE_TIME_NAME)
    return cookie?.value ? parseInt(cookie.value, 10) : null
  }

  /**
   * Alert on redirect loop detection
   *
   * CRITICAL: This indicates a middleware bug. Users are stuck.
   *
   * Actions:
   * 1. Log prominently to console (for immediate debugging)
   * 2. (Future) Send to monitoring service (Sentry, DataDog)
   * 3. (Future) Page on-call engineer for immediate response
   *
   * @param request - Current request
   * @param targetPath - Path that would have been redirected to
   * @param count - Number of redirects detected
   */
  private static alertRedirectLoop(
    request: NextRequest,
    targetPath: string,
    count: number
  ): void {
    const pathname = request.nextUrl.pathname
    const search = request.nextUrl.search
    const userAgent = request.headers.get('user-agent')
    const timestamp = new Date().toISOString()

    // Prominent console logging for immediate visibility
    console.error('========================================')
    console.error('🚨 CRITICAL: REDIRECT LOOP DETECTED 🚨')
    console.error('========================================')
    console.error('This indicates a middleware configuration bug.')
    console.error('User is stuck and cannot proceed.')
    console.error('')
    console.error('Details:')
    console.error(`  Current Path: ${pathname}${search}`)
    console.error(`  Target Path:  ${targetPath}`)
    console.error(`  Redirect Count: ${count}`)
    console.error(`  Timestamp: ${timestamp}`)
    console.error(`  User-Agent: ${userAgent || 'unknown'}`)
    console.error('')
    console.error('Action Required:')
    console.error('  1. Check middleware logic in lib/middleware/')
    console.error('  2. Review wizard exception handling')
    console.error('  3. Check for infinite auth/onboarding loops')
    console.error('========================================')

    // TODO: Send to monitoring service
    // this.sendToSentry({ pathname, targetPath, count, timestamp })

    // TODO: Alert on-call engineer
    // this.pageOnCall({ pathname, targetPath, count, timestamp })
  }

  /**
   * Get diagnostic information for debugging
   *
   * Useful for manual debugging or testing
   *
   * @param request - Request to inspect
   * @returns Diagnostic information
   */
  static getDiagnostics(request: NextRequest): {
    count: number
    lastRedirect: number | null
    isStale: boolean
    wouldBlock: boolean
  } {
    const count = this.getRedirectCount(request)
    const lastRedirect = this.getLastRedirectTime(request)
    const now = Date.now()
    const isStale =
      lastRedirect !== null && now - lastRedirect > this.RESET_AFTER_MS
    const wouldBlock = count >= this.MAX_REDIRECTS && !isStale

    return {
      count,
      lastRedirect,
      isStale,
      wouldBlock,
    }
  }
}
