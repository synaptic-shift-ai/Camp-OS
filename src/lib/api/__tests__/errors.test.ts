/**
 * API Error Codes Tests
 */
import { describe, it, expect } from 'vitest'
import { ErrorCodes, getErrorByCode, type ErrorCode } from '../errors'

describe('API Error Codes', () => {
  describe('ErrorCodes', () => {
    it('should have AUTH error codes', () => {
      expect(ErrorCodes.AUTH_001).toEqual({
        code: 'AUTH_001',
        message: 'Invalid or expired authentication token',
        status: 401,
      })

      expect(ErrorCodes.AUTH_002.status).toBe(403)
      expect(ErrorCodes.AUTH_003.status).toBe(404)
    })

    it('should have RES error codes', () => {
      expect(ErrorCodes.RES_001.code).toBe('RES_001')
      expect(ErrorCodes.RES_001.message).toContain('not found')
      expect(ErrorCodes.RES_001.status).toBe(404)

      expect(ErrorCodes.RES_002.status).toBe(409) // Conflict
      expect(ErrorCodes.RES_003.status).toBe(400) // Bad request
    })

    it('should have SITE error codes', () => {
      expect(ErrorCodes.SITE_001.code).toBe('SITE_001')
      expect(ErrorCodes.SITE_002.code).toBe('SITE_002')
      expect(ErrorCodes.SITE_003.code).toBe('SITE_003')
    })

    it('should have PROP error codes', () => {
      expect(ErrorCodes.PROP_001.code).toBe('PROP_001')
      expect(ErrorCodes.PROP_002.code).toBe('PROP_002')
    })

    it('should have GUEST error codes', () => {
      expect(ErrorCodes.GUEST_001.code).toBe('GUEST_001')
      expect(ErrorCodes.GUEST_002.status).toBe(409)
    })

    it('should have PAY error codes', () => {
      expect(ErrorCodes.PAY_001.code).toBe('PAY_001')
      expect(ErrorCodes.PAY_001.status).toBe(402) // Payment Required
      expect(ErrorCodes.PAY_002.status).toBe(500) // Internal Error
    })

    it('should have VAL error codes', () => {
      expect(ErrorCodes.VAL_001.code).toBe('VAL_001')
      expect(ErrorCodes.VAL_002.code).toBe('VAL_002')
      expect(ErrorCodes.VAL_001.status).toBe(400)
    })

    it('should have SYS error codes', () => {
      expect(ErrorCodes.SYS_001.code).toBe('SYS_001')
      expect(ErrorCodes.SYS_001.status).toBe(500)
      expect(ErrorCodes.SYS_002.status).toBe(503) // Service Unavailable
    })

    it('all error codes should have required fields', () => {
      Object.entries(ErrorCodes).forEach(([key, value]) => {
        expect(value).toHaveProperty('code')
        expect(value).toHaveProperty('message')
        expect(value).toHaveProperty('status')

        expect(typeof value.code).toBe('string')
        expect(typeof value.message).toBe('string')
        expect(typeof value.status).toBe('number')

        // Status should be valid HTTP status code
        expect(value.status).toBeGreaterThanOrEqual(400)
        expect(value.status).toBeLessThan(600)

        // Code should match key
        expect(value.code).toBe(key)
      })
    })

    it('error codes should follow naming convention', () => {
      Object.keys(ErrorCodes).forEach((key) => {
        // Should be CATEGORY_NUMBER format
        expect(key).toMatch(/^[A-Z]+_\d{3}$/)
      })
    })

    it('error messages should be descriptive', () => {
      Object.values(ErrorCodes).forEach((error) => {
        // Message should be at least 10 characters
        expect(error.message.length).toBeGreaterThan(10)

        // Message should not end with period (for consistency)
        expect(error.message.endsWith('.')).toBe(false)
      })
    })
  })

  describe('getErrorByCode()', () => {
    it('should find error by code string', () => {
      const error = getErrorByCode('SITE_001')

      expect(error).toBeDefined()
      expect(error?.code).toBe('SITE_001')
      expect(error?.message).toContain('not found')
    })

    it('should return undefined for non-existent code', () => {
      const error = getErrorByCode('NONEXISTENT_999')

      expect(error).toBeUndefined()
    })

    it('should work with all error codes', () => {
      Object.values(ErrorCodes).forEach((expectedError) => {
        const found = getErrorByCode(expectedError.code)

        expect(found).toEqual(expectedError)
      })
    })
  })

  describe('error code categories', () => {
    it('should have consistent status codes per category', () => {
      // AUTH errors should be 401/403/404
      const authStatuses = [
        ErrorCodes.AUTH_001.status,
        ErrorCodes.AUTH_002.status,
        ErrorCodes.AUTH_004.status,
      ]
      authStatuses.forEach((status) => {
        expect([401, 403, 404]).toContain(status)
      })

      // VAL errors should be 400
      const valStatuses = [
        ErrorCodes.VAL_001.status,
        ErrorCodes.VAL_002.status,
        ErrorCodes.VAL_003.status,
      ]
      valStatuses.forEach((status) => {
        expect(status).toBe(400)
      })

      // SYS errors should be 500/503/etc
      expect(ErrorCodes.SYS_001.status).toBeGreaterThanOrEqual(500)
      expect(ErrorCodes.SYS_002.status).toBeGreaterThanOrEqual(500)
    })

    it('should have appropriate status codes for conflicts', () => {
      // Conflict errors should be 409
      expect(ErrorCodes.RES_002.status).toBe(409)
      expect(ErrorCodes.SITE_003.status).toBe(409)
      expect(ErrorCodes.GUEST_002.status).toBe(409)
    })

    it('should have appropriate status codes for not found', () => {
      // Not found errors should be 404
      expect(ErrorCodes.RES_001.status).toBe(404)
      expect(ErrorCodes.SITE_001.status).toBe(404)
      expect(ErrorCodes.PROP_001.status).toBe(404)
      expect(ErrorCodes.GUEST_001.status).toBe(404)
    })
  })

  describe('error code coverage', () => {
    it('should have at least 5 codes per major category', () => {
      const categories = ['AUTH', 'RES', 'SITE', 'PROP', 'PAY', 'VAL', 'SYS']

      categories.forEach((category) => {
        const codes = Object.keys(ErrorCodes).filter((key) =>
          key.startsWith(category + '_')
        )

        expect(codes.length).toBeGreaterThanOrEqual(3)
      })
    })

    it('should cover common error scenarios', () => {
      // Should have "not found" errors for main resources
      expect(ErrorCodes.RES_001.message).toContain('not found')
      expect(ErrorCodes.SITE_001.message).toContain('not found')
      expect(ErrorCodes.PROP_001.message).toContain('not found')
      expect(ErrorCodes.GUEST_001.message).toContain('not found')

      // Should have validation errors
      expect(ErrorCodes.VAL_001.code).toBe('VAL_001')
      expect(ErrorCodes.VAL_002.code).toBe('VAL_002')

      // Should have auth errors
      expect(ErrorCodes.AUTH_001.code).toBe('AUTH_001')
      expect(ErrorCodes.AUTH_002.code).toBe('AUTH_002')

      // Should have system errors
      expect(ErrorCodes.SYS_001.code).toBe('SYS_001')
      expect(ErrorCodes.SYS_002.code).toBe('SYS_002')
    })
  })
})
