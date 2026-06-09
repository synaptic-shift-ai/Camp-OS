/**
 * Company Aggregate Tests
 *
 * Tests the Company aggregate following TDD best practices:
 * - Parameterized test inputs (no hardcoded literals)
 * - Strong assertions (exact value checks)
 * - Business rules validation
 * - Domain event generation
 */

import { describe, test, expect } from 'vitest'
import { Company } from '../Company'
import { SubscriptionPlan } from '../value-objects/SubscriptionPlan'
import { SubscriptionStatus } from '../value-objects/SubscriptionStatus'
import { BillingCycle } from '../value-objects/BillingCycle'
import { CompanyCreatedEvent } from '../events/CompanyCreatedEvent'
import { CompanyUpdatedEvent } from '../events/CompanyUpdatedEvent'
import { SubscriptionActivatedEvent } from '../events/SubscriptionActivatedEvent'
import { SubscriptionCanceledEvent } from '../events/SubscriptionCanceledEvent'
import { SubscriptionPlanChangedEvent } from '../events/SubscriptionPlanChangedEvent'
import { InviteGeneratedEvent } from '../events/InviteGeneratedEvent'

describe('Company', () => {
  describe('create', () => {
    test('should create new Company with required fields', () => {
      const id = 'company-123'
      const name = 'Test Campground'
      const ownerId = 'user-456'

      const company = Company.create({ id, name, ownerId })

      expect(company.id).toBe(id)
      expect(company.name.value).toBe(name)
      expect(company.ownerId).toBe(ownerId)
      expect(company.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE)
      expect(company.subscriptionPlan).toBe(SubscriptionPlan.STARTER)
      expect(company.billingCycle).toBe(BillingCycle.MONTHLY)
      expect(company.stripeCustomerId).toBeNull()
      expect(company.subscriptionId).toBeNull()
      expect(company.onboardingToken).toBeNull()
    })

    test('should create Company with custom plan', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Premium Campground',
        ownerId: 'user-456',
        plan: SubscriptionPlan.GROWTH,
      })

      expect(company.subscriptionPlan).toBe(SubscriptionPlan.GROWTH)
    })

    test('should fire CompanyCreatedEvent', () => {
      const id = 'company-123'
      const name = 'Test Campground'
      const ownerId = 'user-456'

      const company = Company.create({ id, name, ownerId })

      const events = company.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(CompanyCreatedEvent)

      const event = events[0] as CompanyCreatedEvent
      expect(event.companyId).toBe(id)
      expect(event.name).toBe(name)
      expect(event.ownerId).toBe(ownerId)
      expect(event.subscriptionPlan).toBe('starter')
    })

    test('should throw error for invalid company name', () => {
      expect(() =>
        Company.create({
          id: 'company-123',
          name: 'A', // Too short
          ownerId: 'user-456',
        })
      ).toThrow('Company name must be at least 2 characters')
    })
  })

  describe('updateName', () => {
    test('should update company name', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Old Name',
        ownerId: 'user-456',
      })

      company.clearDomainEvents()
      company.updateName('New Campground Name')

      expect(company.name.value).toBe('New Campground Name')
    })

    test('should fire CompanyUpdatedEvent when name changes', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Old Name',
        ownerId: 'user-456',
      })

      company.clearDomainEvents()
      company.updateName('New Name')

      const events = company.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(CompanyUpdatedEvent)

      const event = events[0] as CompanyUpdatedEvent
      expect(event.companyId).toBe('company-123')
      expect(event.updatedFields).toContain('name')
    })
  })

  describe('activateSubscription', () => {
    test('should activate subscription with all fields', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)
      company.clearDomainEvents()

      const stripeCustomerId = 'cus_test123'
      const subscriptionId = 'sub_test456'

      company.activateSubscription(
        stripeCustomerId,
        subscriptionId,
        SubscriptionPlan.PRO,
        BillingCycle.ANNUAL
      )

      expect(company.stripeCustomerId).toBe(stripeCustomerId)
      expect(company.subscriptionId).toBe(subscriptionId)
      expect(company.subscriptionPlan).toBe(SubscriptionPlan.PRO)
      expect(company.billingCycle).toBe(BillingCycle.ANNUAL)
      expect(company.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE)
      expect(company.subscriptionCreatedAt).toBeInstanceOf(Date)
      expect(company.subscriptionCanceledAt).toBeNull()
    })

    test('should fire SubscriptionActivatedEvent', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)
      company.clearDomainEvents()

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      const events = company.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(SubscriptionActivatedEvent)

      const event = events[0] as SubscriptionActivatedEvent
      expect(event.companyId).toBe('company-123')
      expect(event.plan).toBe('starter')
      expect(event.billingCycle).toBe('monthly')
      expect(event.subscriptionId).toBe('sub_test456')
      expect(event.stripeCustomerId).toBe('cus_test123')
    })

    test('should throw error if subscription already active', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      expect(() =>
        company.activateSubscription(
          'cus_new',
          'sub_new',
          SubscriptionPlan.PRO,
          BillingCycle.ANNUAL
        )
      ).toThrow('Subscription is already active')
    })
  })

  describe('cancelSubscription', () => {
    test('should cancel active subscription', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      company.clearDomainEvents()
      company.cancelSubscription('Moving to competitor')

      expect(company.subscriptionStatus).toBe(SubscriptionStatus.CANCELED)
      expect(company.subscriptionCanceledAt).toBeInstanceOf(Date)
    })

    test('should fire SubscriptionCanceledEvent', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      company.clearDomainEvents()
      const reason = 'Cost reduction'
      company.cancelSubscription(reason)

      const events = company.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(SubscriptionCanceledEvent)

      const event = events[0] as SubscriptionCanceledEvent
      expect(event.companyId).toBe('company-123')
      expect(event.subscriptionId).toBe('sub_test456')
      expect(event.reason).toBe(reason)
    })

    test('should cancel active subscription (create defaults to ACTIVE)', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      // Active status is usable, so should be cancellable
      company.cancelSubscription()

      expect(company.subscriptionStatus).toBe(SubscriptionStatus.CANCELED)
    })

    test('should throw error if no active subscription', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      // Cancel once
      company.cancelSubscription()

      // Try to cancel again
      expect(() => company.cancelSubscription()).toThrow(
        'No active subscription to cancel'
      )
    })
  })

  describe('changePlan', () => {
    test('should change plan for active subscription', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      company.clearDomainEvents()
      company.changePlan(SubscriptionPlan.GROWTH)

      expect(company.subscriptionPlan).toBe(SubscriptionPlan.GROWTH)
    })

    test('should change plan and billing cycle together', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      company.changePlan(SubscriptionPlan.GROWTH, BillingCycle.ANNUAL)

      expect(company.subscriptionPlan).toBe(SubscriptionPlan.GROWTH)
      expect(company.billingCycle).toBe(BillingCycle.ANNUAL)
    })

    test('should fire SubscriptionPlanChangedEvent with upgrade flag', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      company.clearDomainEvents()
      company.changePlan(SubscriptionPlan.GROWTH)

      const events = company.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(SubscriptionPlanChangedEvent)

      const event = events[0] as SubscriptionPlanChangedEvent
      expect(event.companyId).toBe('company-123')
      expect(event.previousPlan).toBe('starter')
      expect(event.newPlan).toBe('growth')
      expect(event.isUpgrade).toBe(true)
    })

    test('should detect downgrade correctly', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.GROWTH,
        BillingCycle.MONTHLY
      )

      company.clearDomainEvents()
      company.changePlan(SubscriptionPlan.STARTER)

      const events = company.getDomainEvents()
      const event = events[0] as SubscriptionPlanChangedEvent
      expect(event.isUpgrade).toBe(false)
    })

    test('should throw error if changing to same plan', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      expect(() => company.changePlan(SubscriptionPlan.STARTER)).toThrow(
        'Already on this plan'
      )
    })

    test('should throw error without active subscription', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.cancelSubscription()

      expect(() => company.changePlan(SubscriptionPlan.GROWTH)).toThrow(
        'Cannot change plan without active subscription'
      )
    })
  })

  describe('generateInviteToken', () => {
    test('should generate invite token', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      company.clearDomainEvents()
      const token = company.generateInviteToken()

      expect(token).not.toBeNull()
      expect(token.value).toHaveLength(32)
      expect(token.isValid).toBe(true)
      expect(token.isUsed).toBe(false)
      expect(company.onboardingToken).toBe(token)
    })

    test('should fire InviteGeneratedEvent', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      company.clearDomainEvents()
      const token = company.generateInviteToken()

      const events = company.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(InviteGeneratedEvent)

      const event = events[0] as InviteGeneratedEvent
      expect(event.companyId).toBe('company-123')
      expect(event.token).toBe(token.value)
    })
  })

  describe('useInviteToken', () => {
    test('should mark invite token as used', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      company.generateInviteToken()
      company.useInviteToken()

      expect(company.onboardingToken!.isUsed).toBe(true)
      expect(company.onboardingToken!.isValid).toBe(false)
    })

    test('should throw error if no invite token exists', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      expect(() => company.useInviteToken()).toThrow('No invite token exists')
    })

    test('should throw error if token already used', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      company.generateInviteToken()
      company.useInviteToken()

      expect(() => company.useInviteToken()).toThrow(
        'Invite token has already been used'
      )
    })
  })

  describe('canAddProperty', () => {
    test('should return true when under property limit', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      // Starter plan has limit of 1
      expect(company.canAddProperty(0)).toBe(true)
    })

    test('should return false when at property limit', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      // Starter plan has limit of 1
      expect(company.canAddProperty(1)).toBe(false)
    })

    test('should allow more properties on higher plans', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.GROWTH,
        BillingCycle.MONTHLY
      )

      // Growth plan has limit of 3
      expect(company.canAddProperty(2)).toBe(true)
      expect(company.canAddProperty(3)).toBe(false)
    })
  })

  describe('query methods', () => {
    test('hasActiveSubscription returns true for active (default)', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      expect(company.hasActiveSubscription).toBe(true)
    })

    test('hasActiveSubscription returns true for activated subscription', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      expect(company.hasActiveSubscription).toBe(true)
    })

    test('hasActiveSubscription returns false for canceled', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      company.cancelSubscription()

      expect(company.hasActiveSubscription).toBe(false)
    })

    test('isPaid returns true for active subscription', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      // Default is ACTIVE + STARTER, both paid
      expect(company.isPaid).toBe(true)
    })

    test('isPaid returns true for activated paid subscription', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })
      company.updateSubscriptionStatus(SubscriptionStatus.TRIAL)

      company.activateSubscription(
        'cus_test123',
        'sub_test456',
        SubscriptionPlan.STARTER,
        BillingCycle.MONTHLY
      )

      expect(company.isPaid).toBe(true)
    })

    test('isPaid returns false for canceled subscription', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      company.cancelSubscription()

      expect(company.isPaid).toBe(false)
    })
  })

  describe('toPersistence', () => {
    test('should convert to database format with DB-compatible defaults', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      const persistence = company.toPersistence()

      expect(persistence.id).toBe('company-123')
      expect(persistence.name).toBe('Test Campground')
      expect(persistence.owner_id).toBe('user-456')
      expect(persistence.subscription_status).toBe('active')
      expect(persistence.subscription_plan).toBe('starter')
      expect(persistence.billing_cycle).toBe('monthly')
      expect(persistence.stripe_customer_id).toBeNull()
      expect(persistence.subscription_id).toBeNull()
      expect(persistence.onboarding_token).toBeNull()
      expect(persistence.created_at).toBeDefined()
      expect(persistence.updated_at).toBeDefined()
    })

    test('should include onboarding token when present', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      company.generateInviteToken()
      const persistence = company.toPersistence()

      expect(persistence.onboarding_token).toHaveLength(32)
      expect(persistence.onboarding_token_expires_at).toBeDefined()
      expect(persistence.onboarding_token_used_at).toBeNull()
    })

    test('should persist canceled status as DB-compatible value', () => {
      const company = Company.create({
        id: 'company-123',
        name: 'Test Campground',
        ownerId: 'user-456',
      })

      company.cancelSubscription()
      const persistence = company.toPersistence()

      expect(persistence.subscription_status).toBe('canceled')
    })
  })
})
