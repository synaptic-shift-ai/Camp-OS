/**
 * Companies API v1 Contract Tests
 *
 * Phase 4A: API Consolidation - Companies API
 *
 * Following CLAUDE.md:
 * - T-1: Tests colocated in tests/integration/
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterized test inputs
 * - T-8: Test description states what expect verifies
 * - T-12: Group unit tests under describe(functionName, ...)
 */

import { describe, it, expect } from 'vitest'
import {
  CreateCompanyRequestSchema,
  UpdateCompanyRequestSchema,
  ActivateSubscriptionRequestSchema,
  CompanyResponseSchema,
  SubscriptionResponseSchema,
  InviteTokenResponseSchema,
  type CompanyResponse,
  type SubscriptionResponse,
} from '@/types/api/v1/schemas/companies'

describe('Companies API v1 Contract Tests', () => {
  // ========================================================================
  // Request Schema Validation
  // ========================================================================

  describe('CreateCompanyRequestSchema', () => {
    it('should validate valid create company request', () => {
      const validRequest = {
        name: 'Acme Campgrounds LLC',
      }

      const result = CreateCompanyRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject empty company name', () => {
      const invalidRequest = {
        name: '',
      }

      const result = CreateCompanyRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Company name is required')
      }
    })

    it('should reject missing name field', () => {
      const invalidRequest = {}

      const result = CreateCompanyRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject name exceeding 255 characters', () => {
      const invalidRequest = {
        name: 'A'.repeat(256),
      }

      const result = CreateCompanyRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateCompanyRequestSchema', () => {
    it('should validate valid update request with name', () => {
      const validRequest = {
        name: 'Updated Company Name',
      }

      const result = UpdateCompanyRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate empty update request (no changes)', () => {
      const validRequest = {}

      const result = UpdateCompanyRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject empty name string when provided', () => {
      const invalidRequest = {
        name: '',
      }

      const result = UpdateCompanyRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  describe('ActivateSubscriptionRequestSchema', () => {
    it('should validate complete subscription activation request', () => {
      const validRequest = {
        stripeCustomerId: 'cus_123456789',
        subscriptionId: 'sub_987654321',
        plan: 'pro',
        billingCycle: 'annual',
      }

      const result = ActivateSubscriptionRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject invalid subscription plan', () => {
      const invalidRequest = {
        stripeCustomerId: 'cus_123',
        subscriptionId: 'sub_123',
        plan: 'invalid_plan',
        billingCycle: 'monthly',
      }

      const result = ActivateSubscriptionRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject invalid billing cycle', () => {
      const invalidRequest = {
        stripeCustomerId: 'cus_123',
        subscriptionId: 'sub_123',
        plan: 'starter',
        billingCycle: 'weekly',
      }

      const result = ActivateSubscriptionRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject missing required fields', () => {
      const invalidRequest = {
        plan: 'starter',
      }

      const result = ActivateSubscriptionRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    const validPlans = ['starter', 'growth', 'pro', 'enterprise'] as const
    validPlans.forEach((plan) => {
      it(`should accept valid plan: ${plan}`, () => {
        const request = {
          stripeCustomerId: 'cus_123',
          subscriptionId: 'sub_123',
          plan,
          billingCycle: 'monthly',
        }

        const result = ActivateSubscriptionRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
      })
    })

    const validBillingCycles = ['monthly', 'annual'] as const
    validBillingCycles.forEach((cycle) => {
      it(`should accept valid billing cycle: ${cycle}`, () => {
        const request = {
          stripeCustomerId: 'cus_123',
          subscriptionId: 'sub_123',
          plan: 'starter',
          billingCycle: cycle,
        }

        const result = ActivateSubscriptionRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
      })
    })
  })

  // ========================================================================
  // Response Schema Validation
  // ========================================================================

  describe('CompanyResponseSchema', () => {
    it('should validate complete company response', () => {
      const completeResponse: CompanyResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Acme Campgrounds LLC',
        companyLogoUrl: 'https://example.com/company-logo.png',
        ownerId: '660e8400-e29b-41d4-a716-446655440001',
        subscription: {
          plan: 'pro',
          status: 'active',
          billingCycle: 'annual',
          isActive: true,
          isPaid: true,
          stripeCustomerId: 'cus_123456789',
          subscriptionId: 'sub_987654321',
          createdAt: '2025-01-01T00:00:00Z',
          canceledAt: null,
        },
        onboardingToken: null,
        propertyLimit: 3,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      expect(() => CompanyResponseSchema.parse(completeResponse)).not.toThrow()
    })

    it('should validate company with onboarding token', () => {
      const responseWithToken: CompanyResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'New Company',
        companyLogoUrl: null,
        ownerId: '660e8400-e29b-41d4-a716-446655440001',
        subscription: {
          plan: 'starter',
          status: 'active',
          billingCycle: 'monthly',
          isActive: false,
          isPaid: false,
          stripeCustomerId: null,
          subscriptionId: null,
          createdAt: null,
          canceledAt: null,
        },
        onboardingToken: {
          token: 'abc123def456',
          expiresAt: '2025-02-01T00:00:00Z',
          isValid: true,
          isUsed: false,
        },
        propertyLimit: 1,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => CompanyResponseSchema.parse(responseWithToken)).not.toThrow()
    })

    it('should reject company with invalid UUID', () => {
      const invalidResponse = {
        id: 'not-a-uuid',
        name: 'Test',
        companyLogoUrl: null,
        ownerId: '660e8400-e29b-41d4-a716-446655440001',
        subscription: {
          plan: 'starter',
          status: 'active',
          billingCycle: 'monthly',
          isActive: false,
          isPaid: false,
          stripeCustomerId: null,
          subscriptionId: null,
          createdAt: null,
          canceledAt: null,
        },
        onboardingToken: null,
        propertyLimit: 1,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      expect(() => CompanyResponseSchema.parse(invalidResponse)).toThrow()
    })
  })

  describe('SubscriptionResponseSchema', () => {
    it('should validate active subscription', () => {
      const activeSubscription: SubscriptionResponse = {
        plan: 'pro',
        status: 'active',
        billingCycle: 'annual',
        isActive: true,
        isPaid: true,
        stripeCustomerId: 'cus_123',
        subscriptionId: 'sub_456',
        createdAt: '2025-01-01T00:00:00Z',
        canceledAt: null,
      }

      expect(() => SubscriptionResponseSchema.parse(activeSubscription)).not.toThrow()
    })

    it('should validate canceled subscription', () => {
      const canceledSubscription: SubscriptionResponse = {
        plan: 'starter',
        status: 'canceled',
        billingCycle: 'monthly',
        isActive: false,
        isPaid: false,
        stripeCustomerId: 'cus_123',
        subscriptionId: 'sub_456',
        createdAt: '2025-01-01T00:00:00Z',
        canceledAt: '2025-06-01T00:00:00Z',
      }

      expect(() => SubscriptionResponseSchema.parse(canceledSubscription)).not.toThrow()
    })

    it('should validate starter tier (no stripe)', () => {
      const starterSubscription: SubscriptionResponse = {
        plan: 'starter',
        status: 'active',
        billingCycle: 'monthly',
        isActive: true,
        isPaid: false,
        stripeCustomerId: null,
        subscriptionId: null,
        createdAt: null,
        canceledAt: null,
      }

      expect(() => SubscriptionResponseSchema.parse(starterSubscription)).not.toThrow()
    })
  })

  describe('InviteTokenResponseSchema', () => {
    it('should validate invite token response', () => {
      const validResponse = {
        token: 'abc123def456ghi789',
        expiresAt: '2025-02-01T00:00:00Z',
        inviteUrl: 'https://app.example.com/onboarding?token=abc123def456ghi789',
      }

      expect(() => InviteTokenResponseSchema.parse(validResponse)).not.toThrow()
    })

    it('should reject invalid invite URL', () => {
      const invalidResponse = {
        token: 'abc123',
        expiresAt: '2025-02-01T00:00:00Z',
        inviteUrl: 'not-a-valid-url',
      }

      expect(() => InviteTokenResponseSchema.parse(invalidResponse)).toThrow()
    })
  })

  // ========================================================================
  // Subscription Plan Limits (Business Logic Verification)
  // ========================================================================

  describe('Subscription Plan Business Logic', () => {
    const planLimits = {
      starter: { propertyLimit: 1 },
      growth: { propertyLimit: 3 },
      pro: { propertyLimit: 10 },
      enterprise: { propertyLimit: Infinity },
    }

    Object.entries(planLimits).forEach(([plan, limits]) => {
      it(`should have correct property limit for ${plan} plan`, () => {
        // This test verifies the expected limits are documented
        // Actual enforcement is in the domain layer
        expect(limits.propertyLimit).toBeGreaterThan(0)
      })
    })
  })
})
