/**
 * API Response Utilities Tests
 */
import { describe, it, expect } from 'vitest'
import { success, error, deprecated, paginated, isErrorResponse } from '../response'
import { NextRequest } from 'next/server'

describe('API Response Utilities', () => {
  describe('success()', () => {
    it('should create success response with data', async () => {
      const data = { site: { id: '123', name: 'Site A' } }
      const response = success(data)

      expect(response.status).toBe(200)

      const json = await response.json()
      expect(json.success).toBe(true)
      expect(json.data).toEqual(data)
      expect(json.meta).toHaveProperty('timestamp')
      expect(json.meta).toHaveProperty('version')
      expect(json.meta).toHaveProperty('requestId')
    })

    it('should include request ID from header if provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'x-request-id': 'req-123' },
      })

      const response = success({ test: 'data' }, request)
      const json = await response.json()

      expect(json.meta.requestId).toBe('req-123')
      expect(response.headers.get('X-Request-ID')).toBe('req-123')
    })

    it('should generate request ID if not provided', async () => {
      const response = success({ test: 'data' })
      const json = await response.json()

      expect(json.meta.requestId).toMatch(/^[a-f0-9-]{36}$/) // UUID format
    })

    it('should include pagination metadata if provided', async () => {
      const pagination = {
        page: 2,
        limit: 25,
        total: 100,
        totalPages: 4,
      }

      const response = success({ items: [] }, undefined, pagination)
      const json = await response.json()

      expect(json.meta.pagination).toEqual(pagination)
    })

    it('should set API version header', () => {
      const response = success({ test: 'data' }, undefined, undefined, '2.0')

      expect(response.headers.get('X-API-Version')).toBe('2.0')
    })

    it('should use default version 1.0', async () => {
      const response = success({ test: 'data' })
      const json = await response.json()

      expect(json.meta.version).toBe('1.0')
      expect(response.headers.get('X-API-Version')).toBe('1.0')
    })
  })

  describe('error()', () => {
    it('should create error response with code and message', async () => {
      const response = error('SITE_001', 'Site not found', 404)

      expect(response.status).toBe(404)

      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('SITE_001')
      expect(json.error.message).toBe('Site not found')
      expect(json.meta).toHaveProperty('timestamp')
      expect(json.meta).toHaveProperty('requestId')
    })

    it('should include error details if provided', async () => {
      const details = { field: 'name', reason: 'Required field missing' }
      const response = error('VAL_002', 'Validation failed', 400, undefined, details)

      const json = await response.json()
      expect(json.error.details).toEqual(details)
    })

    it('should respect custom status codes', () => {
      const response = error('PAY_001', 'Payment failed', 402)
      expect(response.status).toBe(402)
    })

    it('should set appropriate headers', () => {
      const response = error('SYS_001', 'Internal error', 500)

      expect(response.headers.get('X-API-Version')).toBe('1.0')
      expect(response.headers.get('X-Request-ID')).toBeTruthy()
    })
  })

  describe('deprecated()', () => {
    it('should add deprecation headers', async () => {
      const baseResponse = success({ test: 'data' })
      const response = deprecated(
        baseResponse,
        '2025-06-01',
        '/api/v1/new-endpoint'
      )

      expect(response.headers.get('Deprecation')).toBe('true')
      expect(response.headers.get('Sunset')).toBe('2025-06-01')
      expect(response.headers.get('Link')).toContain('/api/v1/new-endpoint')
      expect(response.headers.get('Warning')).toContain('2025-06-01')
    })

    it('should preserve original response body', async () => {
      const data = { site: { id: '123' } }
      const baseResponse = success(data)
      const response = deprecated(baseResponse, '2025-06-01', '/api/v1/sites')

      const json = await response.json()
      expect(json.data).toEqual(data)
    })
  })

  describe('paginated()', () => {
    it('should create paginated response', async () => {
      const items = { sites: [{ id: '1' }, { id: '2' }] }
      const response = paginated(items, 1, 25, 100)

      const json = await response.json()

      expect(json.success).toBe(true)
      expect(json.data).toEqual(items)
      expect(json.meta.pagination).toEqual({
        page: 1,
        limit: 25,
        total: 100,
        totalPages: 4,
      })
    })

    it('should calculate total pages correctly', async () => {
      const response1 = paginated({ items: [] }, 1, 25, 100)
      const json1 = await response1.json()
      expect(json1.meta.pagination.totalPages).toBe(4)

      const response2 = paginated({ items: [] }, 1, 25, 99)
      const json2 = await response2.json()
      expect(json2.meta.pagination.totalPages).toBe(4)

      const response3 = paginated({ items: [] }, 1, 25, 101)
      const json3 = await response3.json()
      expect(json3.meta.pagination.totalPages).toBe(5)
    })

    it('should handle empty results', async () => {
      const response = paginated({ items: [] }, 1, 25, 0)
      const json = await response.json()

      expect(json.meta.pagination.total).toBe(0)
      expect(json.meta.pagination.totalPages).toBe(0)
    })
  })

  describe('isErrorResponse()', () => {
    it('should return true for error responses', async () => {
      const response = error('TEST_001', 'Test error', 400)
      const json = await response.json()

      expect(isErrorResponse(json)).toBe(true)
    })

    it('should return false for success responses', async () => {
      const response = success({ test: 'data' })
      const json = await response.json()

      expect(isErrorResponse(json)).toBe(false)
    })
  })

  describe('response format compliance', () => {
    it('success responses should match standard envelope', async () => {
      const response = success({ test: 'value' })
      const json = await response.json()

      // Required fields
      expect(json).toHaveProperty('success', true)
      expect(json).toHaveProperty('data')
      expect(json).toHaveProperty('meta')

      // Meta fields
      expect(json.meta).toHaveProperty('timestamp')
      expect(json.meta).toHaveProperty('version')
      expect(json.meta).toHaveProperty('requestId')

      // Timestamp should be ISO 8601
      expect(json.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('error responses should match standard envelope', async () => {
      const response = error('TEST_001', 'Test', 400)
      const json = await response.json()

      // Required fields
      expect(json).toHaveProperty('success', false)
      expect(json).toHaveProperty('error')
      expect(json).toHaveProperty('meta')

      // Error fields
      expect(json.error).toHaveProperty('code')
      expect(json.error).toHaveProperty('message')

      // Meta fields (no pagination in error responses)
      expect(json.meta).toHaveProperty('timestamp')
      expect(json.meta).toHaveProperty('version')
      expect(json.meta).toHaveProperty('requestId')
      expect(json.meta).not.toHaveProperty('pagination')
    })
  })
})
