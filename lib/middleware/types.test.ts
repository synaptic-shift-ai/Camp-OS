/**
 * Type Guard Tests for Middleware Types
 *
 * CAM-135: Core Middleware Types
 * Tests runtime validation of middleware context types
 */

import { describe, test, expect } from 'vitest'
import {
  isAuthContext,
  isTenantContext,
  isWizardContext,
  isMiddlewareContext,
  createUserId,
  createCompanyId,
  createPropertyId,
  createSessionId,
  type AuthContext,
  type TenantContext,
  type WizardContext,
  type MiddlewareContext,
} from './types'

describe('Type Guards', () => {
  describe('isAuthContext', () => {
    test('validates correct auth context', () => {
      const validAuth = {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        emailConfirmedAt: '2025-01-01T00:00:00Z',
        userMetadata: { user_type: 'buyer' as const },
      }

      expect(isAuthContext(validAuth)).toBe(true)
    })

    test('rejects invalid auth context - missing userId', () => {
      const invalidAuth = {
        email: 'test@example.com',
        emailVerified: true,
        emailConfirmedAt: '2025-01-01T00:00:00Z',
        userMetadata: {},
      }

      expect(isAuthContext(invalidAuth)).toBe(false)
    })

    test('rejects invalid auth context - wrong type for emailVerified', () => {
      const invalidAuth = {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: 'yes', // Should be boolean
        emailConfirmedAt: '2025-01-01T00:00:00Z',
        userMetadata: {},
      }

      expect(isAuthContext(invalidAuth)).toBe(false)
    })

    test('accepts null emailConfirmedAt', () => {
      const validAuth = {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        emailConfirmedAt: null,
        userMetadata: {},
      }

      expect(isAuthContext(validAuth)).toBe(true)
    })
  })

  describe('isTenantContext', () => {
    test('validates correct tenant context', () => {
      const validTenant = {
        companyId: 'company-123',
        subscriptionStatus: 'active' as const,
        subscriptionPlan: 'growth',
        stripeCustomerId: 'cus_123',
      }

      expect(isTenantContext(validTenant)).toBe(true)
    })

    test('accepts all valid subscription statuses', () => {
      const statuses = ['active', 'canceled', 'past_due'] as const

      statuses.forEach((status) => {
        const tenant = {
          companyId: 'company-123',
          subscriptionStatus: status,
        }
        expect(isTenantContext(tenant)).toBe(true)
      })
    })

    test('rejects invalid subscription status', () => {
      const invalidTenant = {
        companyId: 'company-123',
        subscriptionStatus: 'invalid_status',
      }

      expect(isTenantContext(invalidTenant)).toBe(false)
    })

    test('rejects missing companyId', () => {
      const invalidTenant = {
        subscriptionStatus: 'active',
      }

      expect(isTenantContext(invalidTenant)).toBe(false)
    })
  })

  describe('isWizardContext', () => {
    test('validates correct wizard context', () => {
      const validWizard = {
        inWizard: true,
        wizardQueryParam: 'true',
      }

      expect(isWizardContext(validWizard)).toBe(true)
    })

    test('rejects when inWizard is not true', () => {
      const invalidWizard = {
        inWizard: false,
        wizardQueryParam: 'true',
      }

      expect(isWizardContext(invalidWizard)).toBe(false)
    })

    test('rejects missing wizardQueryParam', () => {
      const invalidWizard = {
        inWizard: true,
      }

      expect(isWizardContext(invalidWizard)).toBe(false)
    })
  })

  describe('isMiddlewareContext', () => {
    test('validates minimal valid context', () => {
      const validContext: MiddlewareContext = {
        sessionId: createSessionId('session-123'),
        pathname: '/dashboard',
        searchParams: new URLSearchParams(),
      }

      expect(isMiddlewareContext(validContext)).toBe(true)
    })

    test('validates context with all optional fields', () => {
      const fullContext: MiddlewareContext = {
        sessionId: createSessionId('session-123'),
        pathname: '/dashboard',
        searchParams: new URLSearchParams('wizard=true'),
        auth: {
          userId: createUserId('user-123'),
          email: 'test@example.com',
          emailVerified: true,
          emailConfirmedAt: '2025-01-01T00:00:00Z',
          userMetadata: {},
        } as AuthContext,
        tenant: {
          companyId: createCompanyId('company-123'),
          subscriptionStatus: 'active',
        } as TenantContext,
        wizard: {
          inWizard: true,
          wizardQueryParam: 'true',
        } as WizardContext,
      }

      expect(isMiddlewareContext(fullContext)).toBe(true)
    })

    test('rejects invalid auth in context', () => {
      const invalidContext = {
        sessionId: 'session-123',
        pathname: '/dashboard',
        searchParams: new URLSearchParams(),
        auth: {
          // Missing required fields
          email: 'test@example.com',
        },
      }

      expect(isMiddlewareContext(invalidContext)).toBe(false)
    })

    test('rejects invalid tenant in context', () => {
      const invalidContext = {
        sessionId: 'session-123',
        pathname: '/dashboard',
        searchParams: new URLSearchParams(),
        tenant: {
          // Invalid subscription status
          companyId: 'company-123',
          subscriptionStatus: 'invalid',
        },
      }

      expect(isMiddlewareContext(invalidContext)).toBe(false)
    })
  })
})

describe('Branded ID Constructors', () => {
  test('createUserId creates branded type', () => {
    const userId = createUserId('user-123')
    expect(userId).toBe('user-123')
    // Type system ensures this is UserId, not string
  })

  test('createCompanyId creates branded type', () => {
    const companyId = createCompanyId('company-123')
    expect(companyId).toBe('company-123')
  })

  test('createPropertyId creates branded type', () => {
    const propertyId = createPropertyId('property-123')
    expect(propertyId).toBe('property-123')
  })

  test('createSessionId creates branded type', () => {
    const sessionId = createSessionId('session-123')
    expect(sessionId).toBe('session-123')
  })
})

describe('Type Safety Guarantees', () => {
  test('branded types prevent accidental mixing', () => {
    const userId = createUserId('123')
    const companyId = createCompanyId('123')
    const propertyId = createPropertyId('123')

    // At runtime, these are all "123"
    expect(userId).toBe('123')
    expect(companyId).toBe('123')
    expect(propertyId).toBe('123')

    // But TypeScript prevents this at compile time:
    // const mixup: UserId = companyId  // TypeScript error!
    // const confusion: PropertyId = userId  // TypeScript error!

    // This test documents the compile-time safety
    // The actual prevention happens at type-check time
  })
})
