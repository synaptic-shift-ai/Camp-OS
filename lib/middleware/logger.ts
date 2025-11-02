/**
 * Structured Logging for Middleware
 *
 * CAM-132: Middleware Architecture Hardening
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * CRITICAL: Structured logging with correlation IDs enables:
 * - End-to-end request tracing across middleware chain
 * - Debugging production incidents
 * - Performance monitoring and optimization
 * - User journey analysis
 *
 * Design Principles:
 * - Every log entry includes correlation ID (sessionId)
 * - Structured JSON format for machine parsing
 * - Separation of log levels (debug, info, warn, error, critical)
 * - Context propagation throughout request lifecycle
 *
 * Following CLAUDE.md:
 * - C-4: Small, composable, testable functions
 * - C-6: Use import type for type-only imports
 */

import type { SessionId, UserId, CompanyId } from './types'

/**
 * Log context for correlation and filtering
 *
 * Required:
 * - correlation_id: Unique identifier for request (sessionId)
 *
 * Optional (accumulated through middleware chain):
 * - user_id: Authenticated user
 * - company_id: Resolved tenant
 * - request_id: External request tracking (e.g., from load balancer)
 */
export type LogContext = {
  readonly correlation_id: SessionId
  readonly user_id?: UserId
  readonly company_id?: CompanyId
  readonly request_id?: string
}

/**
 * Log levels following standard severity levels
 *
 * debug: Detailed diagnostic information (development only)
 * info: General informational messages about system operation
 * warn: Warning messages for potentially harmful situations
 * error: Error events that might still allow app to continue
 * critical: Critical errors that require immediate attention
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

/**
 * Structured log entry
 *
 * All log entries follow this format for consistent parsing
 * and analysis in monitoring systems.
 */
export type LogEntry = {
  readonly timestamp: string
  readonly level: LogLevel
  readonly message: string
  readonly context: LogContext
  readonly data?: Record<string, unknown>
  readonly error?: {
    readonly message: string
    readonly stack?: string
    readonly code?: string
  }
  readonly metadata: {
    readonly service: string
    readonly environment: string
    readonly version: string
  }
}

/**
 * Structured Logger
 *
 * Provides type-safe structured logging with correlation IDs.
 * All logs from a single request share the same correlation ID.
 *
 * Usage:
 * ```typescript
 * const logger = createLogger(sessionId, 'auth-middleware')
 * logger.info('User authenticated', { userId, email })
 * logger.error('Auth failed', new Error('Invalid token'), { attemptCount })
 * ```
 */
export class StructuredLogger {
  constructor(
    private service: string,
    private context: LogContext
  ) {}

  /**
   * Log debug information (development only)
   *
   * Use for detailed diagnostic information that aids in debugging.
   * These logs should be disabled in production.
   *
   * @param message - Human-readable message
   * @param data - Additional structured data
   */
  debug(message: string, data?: Record<string, unknown>): void {
    // Only log debug in development
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, data)
    }
  }

  /**
   * Log informational message
   *
   * Use for general informational messages about normal system operation.
   *
   * @param message - Human-readable message
   * @param data - Additional structured data
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data)
  }

  /**
   * Log warning
   *
   * Use for potentially harmful situations that don't prevent operation
   * but should be investigated.
   *
   * @param message - Human-readable message
   * @param data - Additional structured data
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data)
  }

  /**
   * Log error
   *
   * Use for error events that might still allow the application to continue.
   * The error object is captured for stack traces.
   *
   * @param message - Human-readable message
   * @param error - Error object
   * @param data - Additional structured data
   */
  error(message: string, error: Error, data?: Record<string, unknown>): void {
    this.log('error', message, data, error)
  }

  /**
   * Log critical error
   *
   * Use for critical errors that require immediate attention.
   * These trigger alerts to on-call engineers.
   *
   * @param message - Human-readable message
   * @param error - Error object
   * @param data - Additional structured data
   */
  critical(
    message: string,
    error: Error,
    data?: Record<string, unknown>
  ): void {
    this.log('critical', message, data, error)
    // TODO: Alert on-call engineer
    // this.alertOnCall(message, error, data)
  }

  /**
   * Create child logger with additional context
   *
   * Useful for propagating context through middleware chain.
   *
   * @param additionalContext - Additional context to merge
   * @returns New logger with merged context
   */
  child(additionalContext: Partial<LogContext>): StructuredLogger {
    return new StructuredLogger(this.service, {
      ...this.context,
      ...additionalContext,
    })
  }

  /**
   * Internal logging implementation
   *
   * Creates structured log entry and outputs as JSON.
   * In production, this would send to monitoring service.
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...(data ? { data } : {}),
      ...(error
        ? {
            error: {
              message: error.message,
              ...(error.stack ? { stack: error.stack } : {}),
              ...((error as any).code ? { code: (error as any).code } : {}),
            },
          }
        : {}),
      metadata: {
        service: this.service,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || 'unknown',
      },
    }

    // Output as JSON for structured parsing
    // In production, this would go to monitoring service (Sentry, DataDog, etc.)
    const output = JSON.stringify(entry)

    // Route to appropriate console method based on level
    switch (level) {
      case 'debug':
        console.debug(output)
        break
      case 'info':
        console.info(output)
        break
      case 'warn':
        console.warn(output)
        break
      case 'error':
      case 'critical':
        console.error(output)
        break
    }

    // Send critical errors to monitoring service
    if (level === 'error' || level === 'critical') {
      this.sendToMonitoring(entry)
    }
  }

  /**
   * Send log entry to monitoring service
   *
   * TODO: Integrate with monitoring service (Sentry, DataDog, etc.)
   *
   * @param entry - Log entry to send
   */
  private sendToMonitoring(entry: LogEntry): void {
    // TODO: Implement monitoring integration
    // Example: Sentry.captureException(entry)
  }
}

/**
 * Factory function to create a logger instance
 *
 * Use this to create loggers in middleware with consistent context.
 *
 * @param correlationId - Session ID for request correlation
 * @param service - Service name (e.g., 'auth-middleware', 'tenant-middleware')
 * @returns Configured StructuredLogger instance
 */
export function createLogger(
  correlationId: SessionId,
  service: string
): StructuredLogger {
  return new StructuredLogger(service, {
    correlation_id: correlationId,
  })
}

/**
 * Utility: Parse structured log entry from JSON string
 *
 * Useful for log analysis and testing.
 *
 * @param json - JSON string from console output
 * @returns Parsed log entry
 */
export function parseLogEntry(json: string): LogEntry | null {
  try {
    const parsed = JSON.parse(json)
    // Validate structure
    if (
      !parsed.timestamp ||
      !parsed.level ||
      !parsed.message ||
      !parsed.context?.correlation_id
    ) {
      return null
    }
    return parsed as LogEntry
  } catch {
    return null
  }
}
