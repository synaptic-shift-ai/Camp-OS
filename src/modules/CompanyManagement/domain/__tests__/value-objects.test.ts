/**
 * Value Objects Tests
 *
 * Tests for CompanyManagement value objects.
 */

import { describe, test, expect } from 'vitest'
import { CompanyName } from '../value-objects/CompanyName'
import { SubscriptionPlan } from '../value-objects/SubscriptionPlan'
import { SubscriptionStatus } from '../value-objects/SubscriptionStatus'
import { BillingCycle } from '../value-objects/BillingCycle'
import { OnboardingToken } from '../value-objects/OnboardingToken'

describe('CompanyName', () => {
  test('should create valid company name', () => {
    const name = CompanyName.create('Test Campground')
    expect(name.value).toBe('Test Campground')
  })

  test('should trim whitespace', () => {
    const name = CompanyName.create('  Trimmed Name  ')
    expect(name.value).toBe('Trimmed Name')
  })

  test('should throw for name too short', () => {
    expect(() => CompanyName.create('A')).toThrow(
      'Company name must be at least 2 characters'
    )
  })

  test('should throw for name too long', () => {
    const longName = 'A'.repeat(101)
    expect(() => CompanyName.create(longName)).toThrow(
      'Company name must be at most 100 characters'
    )
  })

  test('should be equal for same value', () => {
    const name1 = CompanyName.create('Same Name')
    const name2 = CompanyName.create('Same Name')
    expect(name1.equals(name2)).toBe(true)
  })

  test('toString returns value', () => {
    const name = CompanyName.create('Test')
    expect(name.toString()).toBe('Test')
  })
})

describe('SubscriptionPlan', () => {
  test('should have static instances', () => {
    expect(SubscriptionPlan.FREE.value).toBe('free')
    expect(SubscriptionPlan.STARTER.value).toBe('starter')
    expect(SubscriptionPlan.PROFESSIONAL.value).toBe('professional')
    expect(SubscriptionPlan.ENTERPRISE.value).toBe('enterprise')
  })

  test('fromString should return correct instance', () => {
    expect(SubscriptionPlan.fromString('free')).toBe(SubscriptionPlan.FREE)
    expect(SubscriptionPlan.fromString('starter')).toBe(SubscriptionPlan.STARTER)
    expect(SubscriptionPlan.fromString('PROFESSIONAL')).toBe(SubscriptionPlan.PROFESSIONAL)
  })

  test('fromString should default to FREE for null', () => {
    expect(SubscriptionPlan.fromString(null)).toBe(SubscriptionPlan.FREE)
  })

  test('fromString should throw for invalid plan', () => {
    expect(() => SubscriptionPlan.fromString('invalid')).toThrow(
      'Invalid subscription plan: invalid'
    )
  })

  test('isPaid returns correct value', () => {
    expect(SubscriptionPlan.FREE.isPaid).toBe(false)
    expect(SubscriptionPlan.STARTER.isPaid).toBe(true)
    expect(SubscriptionPlan.PROFESSIONAL.isPaid).toBe(true)
    expect(SubscriptionPlan.ENTERPRISE.isPaid).toBe(true)
  })

  test('canUpgradeTo works correctly', () => {
    expect(SubscriptionPlan.FREE.canUpgradeTo(SubscriptionPlan.STARTER)).toBe(true)
    expect(SubscriptionPlan.STARTER.canUpgradeTo(SubscriptionPlan.PROFESSIONAL)).toBe(true)
    expect(SubscriptionPlan.PROFESSIONAL.canUpgradeTo(SubscriptionPlan.STARTER)).toBe(false)
    expect(SubscriptionPlan.STARTER.canUpgradeTo(SubscriptionPlan.STARTER)).toBe(false)
  })

  test('canDowngradeTo works correctly', () => {
    expect(SubscriptionPlan.PROFESSIONAL.canDowngradeTo(SubscriptionPlan.STARTER)).toBe(true)
    expect(SubscriptionPlan.STARTER.canDowngradeTo(SubscriptionPlan.FREE)).toBe(true)
    expect(SubscriptionPlan.STARTER.canDowngradeTo(SubscriptionPlan.PROFESSIONAL)).toBe(false)
  })

  test('propertyLimit returns correct values', () => {
    expect(SubscriptionPlan.FREE.propertyLimit).toBe(1)
    expect(SubscriptionPlan.STARTER.propertyLimit).toBe(1)
    expect(SubscriptionPlan.PROFESSIONAL.propertyLimit).toBe(3)
    expect(SubscriptionPlan.ENTERPRISE.propertyLimit).toBe(Infinity)
  })
})

describe('SubscriptionStatus', () => {
  test('should have static instances', () => {
    expect(SubscriptionStatus.TRIAL.value).toBe('trial')
    expect(SubscriptionStatus.ACTIVE.value).toBe('active')
    expect(SubscriptionStatus.CANCELLED.value).toBe('cancelled')
    expect(SubscriptionStatus.PAST_DUE.value).toBe('past_due')
    expect(SubscriptionStatus.INCOMPLETE.value).toBe('incomplete')
    expect(SubscriptionStatus.PAUSED.value).toBe('paused')
  })

  test('fromString should return correct instance', () => {
    expect(SubscriptionStatus.fromString('active')).toBe(SubscriptionStatus.ACTIVE)
    expect(SubscriptionStatus.fromString('CANCELLED')).toBe(SubscriptionStatus.CANCELLED)
  })

  test('fromString should default to TRIAL for null', () => {
    expect(SubscriptionStatus.fromString(null)).toBe(SubscriptionStatus.TRIAL)
  })

  test('isUsable returns correct values', () => {
    expect(SubscriptionStatus.TRIAL.isUsable).toBe(true)
    expect(SubscriptionStatus.ACTIVE.isUsable).toBe(true)
    expect(SubscriptionStatus.PAST_DUE.isUsable).toBe(true)
    expect(SubscriptionStatus.CANCELLED.isUsable).toBe(false)
    expect(SubscriptionStatus.INCOMPLETE.isUsable).toBe(false)
    expect(SubscriptionStatus.PAUSED.isUsable).toBe(false)
  })

  test('canAccessPremiumFeatures returns correct values', () => {
    expect(SubscriptionStatus.ACTIVE.canAccessPremiumFeatures).toBe(true)
    expect(SubscriptionStatus.TRIAL.canAccessPremiumFeatures).toBe(false)
    expect(SubscriptionStatus.PAST_DUE.canAccessPremiumFeatures).toBe(false)
  })

  test('hasBillingIssue returns correct values', () => {
    expect(SubscriptionStatus.PAST_DUE.hasBillingIssue).toBe(true)
    expect(SubscriptionStatus.INCOMPLETE.hasBillingIssue).toBe(true)
    expect(SubscriptionStatus.ACTIVE.hasBillingIssue).toBe(false)
    expect(SubscriptionStatus.CANCELLED.hasBillingIssue).toBe(false)
  })

  test('isTerminated returns correct values', () => {
    expect(SubscriptionStatus.CANCELLED.isTerminated).toBe(true)
    expect(SubscriptionStatus.ACTIVE.isTerminated).toBe(false)
  })
})

describe('BillingCycle', () => {
  test('should have static instances', () => {
    expect(BillingCycle.MONTHLY.value).toBe('monthly')
    expect(BillingCycle.YEARLY.value).toBe('yearly')
  })

  test('fromString should return correct instance', () => {
    expect(BillingCycle.fromString('monthly')).toBe(BillingCycle.MONTHLY)
    expect(BillingCycle.fromString('YEARLY')).toBe(BillingCycle.YEARLY)
  })

  test('fromString should default to MONTHLY for null', () => {
    expect(BillingCycle.fromString(null)).toBe(BillingCycle.MONTHLY)
  })

  test('isYearly returns correct value', () => {
    expect(BillingCycle.MONTHLY.isYearly).toBe(false)
    expect(BillingCycle.YEARLY.isYearly).toBe(true)
  })

  test('monthsInPeriod returns correct value', () => {
    expect(BillingCycle.MONTHLY.monthsInPeriod).toBe(1)
    expect(BillingCycle.YEARLY.monthsInPeriod).toBe(12)
  })

  test('discountPercentage returns correct value', () => {
    expect(BillingCycle.MONTHLY.discountPercentage).toBe(0)
    expect(BillingCycle.YEARLY.discountPercentage).toBe(17)
  })
})

describe('OnboardingToken', () => {
  test('generate creates valid token', () => {
    const token = OnboardingToken.generate()
    expect(token.value).toHaveLength(32)
    expect(token.isValid).toBe(true)
    expect(token.isUsed).toBe(false)
    expect(token.isExpired).toBe(false)
  })

  test('generateWithExpiry creates token with custom expiry', () => {
    const token = OnboardingToken.generateWithExpiry(24) // 24 hours
    expect(token.value).toHaveLength(32)
    expect(token.isValid).toBe(true)
  })

  test('fromPersistence reconstitutes token', () => {
    const value = 'test-token-value-12345678901234'
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour from now
    const usedAt = null

    const token = OnboardingToken.fromPersistence(value, expiresAt, usedAt)

    expect(token.value).toBe(value)
    expect(token.expiresAt).toEqual(expiresAt)
    expect(token.usedAt).toBeNull()
    expect(token.isValid).toBe(true)
  })

  test('markAsUsed creates new token marked as used', () => {
    const token = OnboardingToken.generate()
    const usedToken = token.markAsUsed()

    expect(usedToken.isUsed).toBe(true)
    expect(usedToken.isValid).toBe(false)
    expect(usedToken.usedAt).toBeInstanceOf(Date)
  })

  test('markAsUsed throws if already used', () => {
    const token = OnboardingToken.generate()
    const usedToken = token.markAsUsed()

    expect(() => usedToken.markAsUsed()).toThrow('Token has already been used')
  })

  test('markAsUsed throws if expired', () => {
    const expiredToken = OnboardingToken.fromPersistence(
      'expired-token-12345678901234567',
      new Date(Date.now() - 1000), // 1 second ago
      null
    )

    expect(() => expiredToken.markAsUsed()).toThrow('Token has expired')
  })

  test('isExpired detects expired token', () => {
    const expiredToken = OnboardingToken.fromPersistence(
      'expired-token-12345678901234567',
      new Date(Date.now() - 1000),
      null
    )

    expect(expiredToken.isExpired).toBe(true)
    expect(expiredToken.isValid).toBe(false)
  })
})
