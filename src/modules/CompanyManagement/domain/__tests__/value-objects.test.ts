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
    expect(SubscriptionPlan.STARTER.value).toBe('starter')
    expect(SubscriptionPlan.GROWTH.value).toBe('growth')
    expect(SubscriptionPlan.PRO.value).toBe('pro')
    expect(SubscriptionPlan.ENTERPRISE.value).toBe('enterprise')
  })

  test('fromString should return correct instance', () => {
    expect(SubscriptionPlan.fromString('starter')).toBe(SubscriptionPlan.STARTER)
    expect(SubscriptionPlan.fromString('growth')).toBe(SubscriptionPlan.GROWTH)
    expect(SubscriptionPlan.fromString('pro')).toBe(SubscriptionPlan.PRO)
    expect(SubscriptionPlan.fromString('PRO')).toBe(SubscriptionPlan.PRO)
  })

  test('fromString should default to STARTER for null', () => {
    expect(SubscriptionPlan.fromString(null).value).toBe('starter')
  })

  test('fromString should throw for invalid plan', () => {
    expect(() => SubscriptionPlan.fromString('invalid')).toThrow(
      'Invalid subscription plan: invalid'
    )
  })

  test('isPaid returns correct value', () => {
    // All persistable plans are paid
    expect(SubscriptionPlan.STARTER.isPaid).toBe(true)
    expect(SubscriptionPlan.GROWTH.isPaid).toBe(true)
    expect(SubscriptionPlan.PRO.isPaid).toBe(true)
    expect(SubscriptionPlan.ENTERPRISE.isPaid).toBe(true)
  })

  test('canUpgradeTo works correctly', () => {
    expect(SubscriptionPlan.STARTER.canUpgradeTo(SubscriptionPlan.GROWTH)).toBe(true)
    expect(SubscriptionPlan.GROWTH.canUpgradeTo(SubscriptionPlan.PRO)).toBe(true)
    expect(SubscriptionPlan.PRO.canUpgradeTo(SubscriptionPlan.STARTER)).toBe(false)
    expect(SubscriptionPlan.STARTER.canUpgradeTo(SubscriptionPlan.STARTER)).toBe(false)
  })

  test('canDowngradeTo works correctly', () => {
    expect(SubscriptionPlan.PRO.canDowngradeTo(SubscriptionPlan.GROWTH)).toBe(true)
    expect(SubscriptionPlan.GROWTH.canDowngradeTo(SubscriptionPlan.STARTER)).toBe(true)
    expect(SubscriptionPlan.STARTER.canDowngradeTo(SubscriptionPlan.PRO)).toBe(false)
  })

  test('propertyLimit returns correct values', () => {
    expect(SubscriptionPlan.STARTER.propertyLimit).toBe(1)
    expect(SubscriptionPlan.GROWTH.propertyLimit).toBe(3)
    expect(SubscriptionPlan.PRO.propertyLimit).toBe(10)
    expect(SubscriptionPlan.ENTERPRISE.propertyLimit).toBe(Infinity)
  })
})

describe('SubscriptionStatus', () => {
  test('should have static instances', () => {
    expect(SubscriptionStatus.ACTIVE.value).toBe('active')
    expect(SubscriptionStatus.CANCELED.value).toBe('canceled')
    expect(SubscriptionStatus.PAST_DUE.value).toBe('past_due')
    expect(SubscriptionStatus.UNPAID.value).toBe('unpaid')
    expect(SubscriptionStatus.INCOMPLETE.value).toBe('incomplete')
    expect(SubscriptionStatus.TRIAL.value).toBe('trial')
    expect(SubscriptionStatus.PAUSED.value).toBe('paused')
  })

  test('fromString should return correct instance', () => {
    expect(SubscriptionStatus.fromString('active')).toBe(SubscriptionStatus.ACTIVE)
    expect(SubscriptionStatus.fromString('canceled')).toBe(SubscriptionStatus.CANCELED)
    expect(SubscriptionStatus.fromString('CANCELED')).toBe(SubscriptionStatus.CANCELED)
    expect(SubscriptionStatus.fromString('unpaid')).toBe(SubscriptionStatus.UNPAID)
    expect(SubscriptionStatus.fromString('past_due')).toBe(SubscriptionStatus.PAST_DUE)
    expect(SubscriptionStatus.fromString('incomplete')).toBe(SubscriptionStatus.INCOMPLETE)
    expect(SubscriptionStatus.fromString('trial')).toBe(SubscriptionStatus.TRIAL)
    expect(SubscriptionStatus.fromString('paused')).toBe(SubscriptionStatus.PAUSED)
  })

  test('fromString should default to TRIAL for null', () => {
    expect(SubscriptionStatus.fromString(null)).toBe(SubscriptionStatus.TRIAL)
  })

  test('isUsable returns correct values', () => {
    expect(SubscriptionStatus.TRIAL.isUsable).toBe(true)
    expect(SubscriptionStatus.ACTIVE.isUsable).toBe(true)
    expect(SubscriptionStatus.PAST_DUE.isUsable).toBe(true)
    expect(SubscriptionStatus.CANCELED.isUsable).toBe(false)
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
    expect(SubscriptionStatus.CANCELED.hasBillingIssue).toBe(false)
  })

  test('isTerminated returns correct values', () => {
    expect(SubscriptionStatus.CANCELED.isTerminated).toBe(true)
    expect(SubscriptionStatus.ACTIVE.isTerminated).toBe(false)
  })

  test('isPersistable returns correct values', () => {
    expect(SubscriptionStatus.ACTIVE.isPersistable).toBe(true)
    expect(SubscriptionStatus.CANCELED.isPersistable).toBe(true)
    expect(SubscriptionStatus.PAST_DUE.isPersistable).toBe(true)
    expect(SubscriptionStatus.UNPAID.isPersistable).toBe(true)
    expect(SubscriptionStatus.INCOMPLETE.isPersistable).toBe(true)
    expect(SubscriptionStatus.TRIAL.isPersistable).toBe(false)
    expect(SubscriptionStatus.PAUSED.isPersistable).toBe(false)
  })
})

describe('BillingCycle', () => {
  test('should have static instances', () => {
    expect(BillingCycle.MONTHLY.value).toBe('monthly')
    expect(BillingCycle.ANNUAL.value).toBe('annual')
  })

  test('fromString should return correct instance', () => {
    expect(BillingCycle.fromString('monthly')).toBe(BillingCycle.MONTHLY)
    expect(BillingCycle.fromString('annual')).toBe(BillingCycle.ANNUAL)
    expect(BillingCycle.fromString('ANNUAL')).toBe(BillingCycle.ANNUAL)
  })

  test('fromString should default to MONTHLY for null', () => {
    expect(BillingCycle.fromString(null)).toBe(BillingCycle.MONTHLY)
  })

  test('isAnnual returns correct value', () => {
    expect(BillingCycle.MONTHLY.isAnnual).toBe(false)
    expect(BillingCycle.ANNUAL.isAnnual).toBe(true)
  })

  test('monthsInPeriod returns correct value', () => {
    expect(BillingCycle.MONTHLY.monthsInPeriod).toBe(1)
    expect(BillingCycle.ANNUAL.monthsInPeriod).toBe(12)
  })

  test('discountPercentage returns correct value', () => {
    expect(BillingCycle.MONTHLY.discountPercentage).toBe(0)
    expect(BillingCycle.ANNUAL.discountPercentage).toBe(17)
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
