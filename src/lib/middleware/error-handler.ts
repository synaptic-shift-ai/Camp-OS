/**
 * Global Error Handler for Middleware
 *
 * CAM-132: Middleware Architecture Hardening
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * CRITICAL: Prevents middleware crashes from bringing down the entire application.
 * Provides graceful degradation when unexpected errors occur.
 *
 * Design Principles:
 * - Never crash - always return a safe response
 * - Log all errors with correlation ID for debugging
 * - Provide user-friendly error messages
 * - Alert on critical errors
 *
 * Following CLAUDE.md:
 * - C-4: Small, composable, testable functions
 * - C-6: Use import type for type-only imports
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { SessionId } from './types'
import { createLogger } from './logger'
import { createSessionId } from './types'

/**
 * Error response configuration
 *
 * Defines how to respond to different error types
 */
type ErrorResponseConfig = {
  readonly statusCode: number
  readonly message: string
  readonly redirectTo?: string
}

/**
 * Get error response configuration based on error type
 *
 * Determines appropriate status code and message for different error categories
 *
 * @param error - Error object
 * @returns Error response configuration
 */
function getErrorResponseConfig(error: Error): ErrorResponseConfig {
  // Environment variable missing - configuration error
  if (error.message.includes('Missing Supabase environment variables')) {
    return {
      statusCode: 503,
      message: 'Service temporarily unavailable. Please try again later.',
    }
  }

  // Database/network errors
  if (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('timeout') ||
    error.message.includes('network')
  ) {
    return {
      statusCode: 503,
      message: 'Service temporarily unavailable. Please try again later.',
    }
  }

  // Generic error - don't expose internal details
  return {
    statusCode: 500,
    message: 'An unexpected error occurred. Please try again.',
  }
}

/**
 * Wrap middleware execution with error handling
 *
 * Catches any errors thrown during middleware execution and returns
 * a safe error response instead of crashing.
 *
 * @param handler - Middleware handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandler(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Generate session ID for error tracking
    const sessionId: SessionId = createSessionId(
      `err-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )

    const logger = createLogger(sessionId, 'middleware-error-handler')

    try {
      // Execute the middleware handler
      return await handler(request)
    } catch (error) {
      // Error occurred - log and return safe response
      const err = error instanceof Error ? error : new Error(String(error))

      const pathname = request.nextUrl?.pathname || 'unknown'

      logger.critical('Unhandled middleware error', err, {
        pathname,
        method: request.method,
        userAgent: request.headers?.get('user-agent') || 'unknown',
      })

      // If an unexpected error happens while accessing any dashboard route,
      // fail safe by sending the user into the onboarding flow instead of
      // surfacing a JSON error page.
      if (pathname.startsWith('/dashboard') && request.nextUrl) {
        const url = new URL('/onboarding', request.nextUrl.origin)
        return NextResponse.redirect(url)
      }

      // Get error response configuration
      const config = getErrorResponseConfig(err)

      // If redirect specified, redirect
      if (config.redirectTo && request.nextUrl) {
        const url = new URL(config.redirectTo, request.nextUrl.origin)
        return NextResponse.redirect(url)
      }

      // Return JSON error response
      return NextResponse.json(
        {
          error: config.message,
          sessionId, // Include for debugging
          timestamp: new Date().toISOString(),
        },
        { status: config.statusCode }
      )
    }
  }
}

/**
 * Safe environment variable getter
 *
 * Throws a descriptive error if environment variable is missing.
 * This allows the error handler to catch and handle gracefully.
 *
 * @param key - Environment variable key
 * @param description - Human-readable description for error message
 * @returns Environment variable value
 * @throws Error if variable is missing
 */
export function getRequiredEnv(key: string, description: string): string {
  const value = process.env[key]

  if (!value) {
    throw new Error(
      `Missing Supabase environment variables: ${description} (${key}) is not set. ` +
        `Please check your .env file and ensure all required variables are configured.`
    )
  }

  return value
}

/**
 * Type guard for Error objects
 *
 * Safely determines if a value is an Error instance
 *
 * @param error - Value to check
 * @returns True if Error, false otherwise
 */
export function isError(error: unknown): error is Error {
  return (
    error instanceof Error ||
    (typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as any).message === 'string')
  )
}
