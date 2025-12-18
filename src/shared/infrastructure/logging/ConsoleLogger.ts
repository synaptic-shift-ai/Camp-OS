/**
 * ConsoleLogger Implementation
 *
 * A structured logger that outputs to the console.
 * Supports log levels, context, and child loggers.
 *
 * In development: Pretty-printed with colors
 * In production: JSON format for log aggregation
 *
 * @example
 * ```typescript
 * const logger = new ConsoleLogger({ level: 'info' })
 * logger.info('Server started', { port: 3000 })
 *
 * const requestLogger = logger.child({ requestId: 'abc-123' })
 * requestLogger.debug('Processing request') // Includes requestId
 * ```
 */

import type { ILogger, LogLevel, LogContext } from './ILogger'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

interface ConsoleLoggerOptions {
  level?: LogLevel
  context?: LogContext
  pretty?: boolean
}

export class ConsoleLogger implements ILogger {
  private level: LogLevel
  private context: LogContext
  private pretty: boolean

  constructor(options: ConsoleLoggerOptions = {}) {
    this.level = options.level ?? 'info'
    this.context = options.context ?? {}
    this.pretty = options.pretty ?? process.env.NODE_ENV !== 'production'
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context)
  }

  child(context: LogContext): ILogger {
    return new ConsoleLogger({
      level: this.level,
      context: { ...this.context, ...context },
      pretty: this.pretty,
    })
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  getLevel(): LogLevel {
    return this.level
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return
    }

    const mergedContext = { ...this.context, ...context }
    const timestamp = new Date().toISOString()

    if (this.pretty) {
      this.logPretty(level, message, mergedContext, timestamp)
    } else {
      this.logJson(level, message, mergedContext, timestamp)
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level]
  }

  private logPretty(
    level: LogLevel,
    message: string,
    context: LogContext,
    timestamp: string
  ): void {
    const colorCode = this.getColorCode(level)
    const resetCode = '\x1b[0m'
    const levelPadded = level.toUpperCase().padEnd(5)

    const contextStr =
      Object.keys(context).length > 0
        ? ` ${JSON.stringify(context)}`
        : ''

    const output = `${timestamp} ${colorCode}[${levelPadded}]${resetCode} ${message}${contextStr}`

    switch (level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      default:
        console.log(output)
    }
  }

  private logJson(
    level: LogLevel,
    message: string,
    context: LogContext,
    timestamp: string
  ): void {
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    }

    const output = JSON.stringify(logEntry)

    switch (level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      default:
        console.log(output)
    }
  }

  private getColorCode(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return '\x1b[36m' // Cyan
      case 'info':
        return '\x1b[32m' // Green
      case 'warn':
        return '\x1b[33m' // Yellow
      case 'error':
        return '\x1b[31m' // Red
      default:
        return '\x1b[0m' // Reset
    }
  }
}
