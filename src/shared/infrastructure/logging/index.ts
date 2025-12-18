/**
 * Logging Exports
 *
 * Central export point for logging infrastructure.
 */
export type { ILogger, LogLevel, LogContext } from './ILogger'
export { ConsoleLogger } from './ConsoleLogger'

// Singleton instance for application-wide use
import { ConsoleLogger } from './ConsoleLogger'
import type { ILogger, LogLevel } from './ILogger'

let loggerInstance: ILogger | null = null

/**
 * Get the global logger instance (singleton pattern)
 */
export function getLogger(): ILogger {
  if (!loggerInstance) {
    loggerInstance = new ConsoleLogger()
  }
  return loggerInstance
}

/**
 * Set a custom logger instance (useful for testing or custom implementations)
 */
export function setLogger(logger: ILogger): void {
  loggerInstance = logger
}

/**
 * Reset the logger instance (useful for testing)
 */
export function resetLogger(): void {
  loggerInstance = null
}

/**
 * Configure the global logger level
 */
export function setLogLevel(level: LogLevel): void {
  getLogger().setLevel(level)
}
