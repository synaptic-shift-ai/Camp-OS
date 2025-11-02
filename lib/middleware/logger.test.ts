/**
 * Structured Logger Tests
 *
 * CAM-132: Middleware Architecture Hardening
 *
 * Tests structured logging with correlation IDs for observability.
 *
 * Following CLAUDE.md T-9: Use dynamic generation, not hardcoded values
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  StructuredLogger,
  createLogger,
  parseLogEntry,
  type LogEntry,
  type LogContext,
} from './logger'
import { createSessionId, createUserId, createCompanyId } from './types'

describe('StructuredLogger', () => {
  let consoleInfoSpy: any
  let consoleWarnSpy: any
  let consoleErrorSpy: any
  let consoleDebugSpy: any

  beforeEach(() => {
    // Spy on console methods to capture log output
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console methods
    consoleInfoSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    consoleDebugSpy.mockRestore()
  })

  describe('info', () => {
    it('should log info message with correlation ID', () => {
      const sessionId = createSessionId('test-session-123')
      const logger = createLogger(sessionId, 'test-service')

      logger.info('Test message')

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
      const logJson = consoleInfoSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry).toBeTruthy()
      expect(entry?.level).toBe('info')
      expect(entry?.message).toBe('Test message')
      expect(entry?.context.correlation_id).toBe(sessionId)
      expect(entry?.metadata.service).toBe('test-service')
    })

    it('should include additional data in log entry', () => {
      const sessionId = createSessionId('test-session-456')
      const logger = createLogger(sessionId, 'auth-middleware')

      logger.info('User authenticated', {
        userId: 'user-123',
        email: 'test@example.com',
      })

      const logJson = consoleInfoSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry?.data).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
      })
    })

    it('should include timestamp in ISO format', () => {
      const sessionId = createSessionId('test-session-789')
      const logger = createLogger(sessionId, 'test-service')

      logger.info('Test message')

      const logJson = consoleInfoSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry?.timestamp).toBeTruthy()
      expect(entry?.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      )
      // Verify it's a valid date
      const parsedDate = new Date(entry?.timestamp || '')
      expect(parsedDate.getTime()).toBeGreaterThan(0)
    })
  })

  describe('warn', () => {
    it('should log warning with correlation ID', () => {
      const sessionId = createSessionId('test-warn-123')
      const logger = createLogger(sessionId, 'test-service')

      logger.warn('Warning message', { reason: 'test' })

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
      const logJson = consoleWarnSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry?.level).toBe('warn')
      expect(entry?.message).toBe('Warning message')
      expect(entry?.data?.reason).toBe('test')
    })
  })

  describe('error', () => {
    it('should log error with stack trace', () => {
      const sessionId = createSessionId('test-error-123')
      const logger = createLogger(sessionId, 'test-service')
      const error = new Error('Test error')

      logger.error('Error occurred', error)

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      const logJson = consoleErrorSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry?.level).toBe('error')
      expect(entry?.error?.message).toBe('Test error')
      expect(entry?.error?.stack).toBeTruthy()
      expect(entry?.error?.stack).toContain('Test error')
    })

    it('should include additional data with error', () => {
      const sessionId = createSessionId('test-error-456')
      const logger = createLogger(sessionId, 'test-service')
      const error = new Error('Auth failed')

      logger.error('Authentication error', error, { attemptCount: 3 })

      const logJson = consoleErrorSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry?.data?.attemptCount).toBe(3)
      expect(entry?.error?.message).toBe('Auth failed')
    })
  })

  describe('critical', () => {
    it('should log critical error', () => {
      const sessionId = createSessionId('test-critical-123')
      const logger = createLogger(sessionId, 'test-service')
      const error = new Error('Critical failure')

      logger.critical('System failure', error, { severity: 'high' })

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      const logJson = consoleErrorSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry?.level).toBe('critical')
      expect(entry?.message).toBe('System failure')
      expect(entry?.error?.message).toBe('Critical failure')
      expect(entry?.data?.severity).toBe('high')
    })
  })

  describe('child', () => {
    it('should create child logger with additional context', () => {
      const sessionId = createSessionId('test-child-123')
      const parentLogger = createLogger(sessionId, 'parent-service')

      const userId = createUserId('user-456')
      const childLogger = parentLogger.child({ user_id: userId })

      childLogger.info('Child log message')

      const logJson = consoleInfoSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry?.context.correlation_id).toBe(sessionId)
      expect(entry?.context.user_id).toBe(userId)
      expect(entry?.metadata.service).toBe('parent-service')
    })

    it('should propagate context through multiple child loggers', () => {
      const sessionId = createSessionId('test-chain-123')
      const logger1 = createLogger(sessionId, 'middleware')

      const userId = createUserId('user-789')
      const logger2 = logger1.child({ user_id: userId })

      const companyId = createCompanyId('company-123')
      const logger3 = logger2.child({ company_id: companyId })

      logger3.info('Fully contextualized log')

      const logJson = consoleInfoSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry?.context).toEqual({
        correlation_id: sessionId,
        user_id: userId,
        company_id: companyId,
      })
    })
  })

  describe('debug', () => {
    it('should only log debug in development environment', () => {
      vi.stubEnv('NODE_ENV', 'development')

      const sessionId = createSessionId('test-debug-123')
      const logger = createLogger(sessionId, 'test-service')

      logger.debug('Debug message')

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1)

      vi.unstubAllEnvs()
    })

    it('should NOT log debug in production environment', () => {
      vi.stubEnv('NODE_ENV', 'production')

      const sessionId = createSessionId('test-debug-456')
      const logger = createLogger(sessionId, 'test-service')

      logger.debug('Debug message')

      expect(consoleDebugSpy).not.toHaveBeenCalled()

      vi.unstubAllEnvs()
    })
  })

  describe('metadata', () => {
    it('should include environment in metadata', () => {
      vi.stubEnv('NODE_ENV', 'staging')

      const sessionId = createSessionId('test-meta-123')
      const logger = createLogger(sessionId, 'test-service')

      logger.info('Test message')

      const logJson = consoleInfoSpy.mock.calls[0]![0] as string
      const entry = parseLogEntry(logJson)

      expect(entry?.metadata.environment).toBe('staging')

      vi.unstubAllEnvs()
    })
  })
})

describe('parseLogEntry', () => {
  it('should parse valid log entry JSON', () => {
    const validJson = JSON.stringify({
      timestamp: '2025-11-01T12:00:00.000Z',
      level: 'info',
      message: 'Test',
      context: { correlation_id: 'session-123' },
      metadata: { service: 'test', environment: 'test', version: '1.0.0' },
    })

    const entry = parseLogEntry(validJson)

    expect(entry).toBeTruthy()
    expect(entry?.level).toBe('info')
    expect(entry?.message).toBe('Test')
  })

  it('should return null for invalid JSON', () => {
    const invalidJson = 'not valid json'

    const entry = parseLogEntry(invalidJson)

    expect(entry).toBeNull()
  })

  it('should return null for JSON missing required fields', () => {
    const incompleteJson = JSON.stringify({
      timestamp: '2025-11-01T12:00:00.000Z',
      // Missing level, message, context
    })

    const entry = parseLogEntry(incompleteJson)

    expect(entry).toBeNull()
  })
})
