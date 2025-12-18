/**
 * ConsoleLogger Tests
 *
 * Tests for the ConsoleLogger implementation.
 */

import { describe, test, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { ConsoleLogger } from '../ConsoleLogger'
import type { LogLevel } from '../ILogger'

describe('ConsoleLogger', () => {
  let consoleSpy: {
    log: MockInstance
    warn: MockInstance
    error: MockInstance
  }

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('log level filtering', () => {
    test('should log messages at or above the configured level', () => {
      const logger = new ConsoleLogger({ level: 'info', pretty: false })

      logger.debug('debug message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      // debug should not be logged (below info level)
      expect(consoleSpy.log).toHaveBeenCalledTimes(1)
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1)
      expect(consoleSpy.error).toHaveBeenCalledTimes(1)
    })

    test('should log all messages when level is debug', () => {
      const logger = new ConsoleLogger({ level: 'debug', pretty: false })

      logger.debug('debug message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      expect(consoleSpy.log).toHaveBeenCalledTimes(2) // debug + info
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1)
      expect(consoleSpy.error).toHaveBeenCalledTimes(1)
    })

    test('should only log errors when level is error', () => {
      const logger = new ConsoleLogger({ level: 'error', pretty: false })

      logger.debug('debug message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      expect(consoleSpy.log).not.toHaveBeenCalled()
      expect(consoleSpy.warn).not.toHaveBeenCalled()
      expect(consoleSpy.error).toHaveBeenCalledTimes(1)
    })
  })

  describe('setLevel', () => {
    test('should change the log level dynamically', () => {
      const logger = new ConsoleLogger({ level: 'error', pretty: false })

      logger.info('should not log')
      expect(consoleSpy.log).not.toHaveBeenCalled()

      logger.setLevel('info')

      logger.info('should log now')
      expect(consoleSpy.log).toHaveBeenCalledTimes(1)
    })
  })

  describe('getLevel', () => {
    test('should return the current log level', () => {
      const logger = new ConsoleLogger({ level: 'warn' })

      expect(logger.getLevel()).toBe('warn')

      logger.setLevel('debug')
      expect(logger.getLevel()).toBe('debug')
    })
  })

  describe('context', () => {
    test('should include context in log output', () => {
      const logger = new ConsoleLogger({ level: 'info', pretty: false })

      logger.info('test message', { userId: 'user-123', action: 'login' })

      expect(consoleSpy.log).toHaveBeenCalledTimes(1)
      const loggedJson = JSON.parse(consoleSpy.log.mock.calls[0]?.[0] as string)

      expect(loggedJson).toMatchObject({
        level: 'info',
        message: 'test message',
        userId: 'user-123',
        action: 'login',
      })
      expect(loggedJson.timestamp).toBeDefined()
    })
  })

  describe('child', () => {
    test('should create a child logger with inherited context', () => {
      const parentLogger = new ConsoleLogger({
        level: 'info',
        context: { service: 'api' },
        pretty: false,
      })

      const childLogger = parentLogger.child({ requestId: 'req-456' })
      childLogger.info('child message')

      expect(consoleSpy.log).toHaveBeenCalledTimes(1)
      const loggedJson = JSON.parse(consoleSpy.log.mock.calls[0]?.[0] as string)

      expect(loggedJson).toMatchObject({
        level: 'info',
        message: 'child message',
        service: 'api',
        requestId: 'req-456',
      })
    })

    test('should not affect parent logger context', () => {
      const parentLogger = new ConsoleLogger({
        level: 'info',
        context: { service: 'api' },
        pretty: false,
      })

      parentLogger.child({ requestId: 'req-456' })
      parentLogger.info('parent message')

      const loggedJson = JSON.parse(consoleSpy.log.mock.calls[0]?.[0] as string)

      expect(loggedJson.requestId).toBeUndefined()
      expect(loggedJson.service).toBe('api')
    })

    test('should inherit log level from parent', () => {
      const parentLogger = new ConsoleLogger({ level: 'warn', pretty: false })
      const childLogger = parentLogger.child({ component: 'auth' })

      childLogger.info('should not log')
      expect(consoleSpy.log).not.toHaveBeenCalled()

      childLogger.warn('should log')
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1)
    })
  })

  describe('JSON output (production mode)', () => {
    test('should output valid JSON in production mode', () => {
      const logger = new ConsoleLogger({ level: 'info', pretty: false })

      logger.info('test message', { key: 'value' })

      const output = consoleSpy.log.mock.calls[0]?.[0] as string
      expect(() => JSON.parse(output)).not.toThrow()
    })

    test('should include timestamp in ISO format', () => {
      const logger = new ConsoleLogger({ level: 'info', pretty: false })

      const beforeLog = new Date()
      logger.info('test message')
      const afterLog = new Date()

      const loggedJson = JSON.parse(consoleSpy.log.mock.calls[0]?.[0] as string)
      const loggedTime = new Date(loggedJson.timestamp)

      expect(loggedTime.getTime()).toBeGreaterThanOrEqual(beforeLog.getTime())
      expect(loggedTime.getTime()).toBeLessThanOrEqual(afterLog.getTime())
    })
  })

  describe('log method routing', () => {
    const testCases: Array<{
      level: LogLevel
      method: 'log' | 'warn' | 'error'
    }> = [
      { level: 'debug', method: 'log' },
      { level: 'info', method: 'log' },
      { level: 'warn', method: 'warn' },
      { level: 'error', method: 'error' },
    ]

    test.each(testCases)(
      'should route $level to console.$method',
      ({ level, method }) => {
        const logger = new ConsoleLogger({ level: 'debug', pretty: false })

        logger[level]('test message')

        expect(consoleSpy[method]).toHaveBeenCalledTimes(1)
      }
    )
  })

  describe('default configuration', () => {
    test('should default to info level', () => {
      const logger = new ConsoleLogger()
      expect(logger.getLevel()).toBe('info')
    })
  })
})
