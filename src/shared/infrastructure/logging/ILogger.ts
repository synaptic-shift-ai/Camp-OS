/**
 * ILogger Interface
 *
 * Defines the contract for logging throughout the application.
 * Supports structured logging with context and log levels.
 *
 * @example
 * ```typescript
 * const logger = getLogger()
 *
 * // Basic logging
 * logger.info('User logged in', { userId: '123' })
 *
 * // Create child logger with context
 * const requestLogger = logger.child({ requestId: 'req-abc' })
 * requestLogger.debug('Processing request')
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

export interface ILogger {
  /**
   * Log at debug level - detailed information for debugging
   */
  debug(message: string, context?: LogContext): void

  /**
   * Log at info level - general operational information
   */
  info(message: string, context?: LogContext): void

  /**
   * Log at warn level - potentially harmful situations
   */
  warn(message: string, context?: LogContext): void

  /**
   * Log at error level - error events that might still allow the app to continue
   */
  error(message: string, context?: LogContext): void

  /**
   * Create a child logger with additional context
   * All logs from the child will include the parent's context
   */
  child(context: LogContext): ILogger

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void

  /**
   * Get the current log level
   */
  getLevel(): LogLevel
}
