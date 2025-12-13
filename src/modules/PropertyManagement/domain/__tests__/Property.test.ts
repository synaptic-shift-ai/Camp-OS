/**
 * Property Aggregate Tests
 *
 * Following CLAUDE.md best practices:
 * - T-1: Tests colocated with source
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterized test inputs
 * - T-8: Test description states what expect verifies
 * - T-12: Group tests under describe(functionName)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Property } from '../Property'
import { PropertySettings } from '../PropertySettings'
import { PropertyType } from '../PropertyType'
import { PropertyStatus, canAcceptBookings } from '../PropertyStatus'
import { OnboardingStatus, isOnboardingComplete } from '../OnboardingStatus'
import { StripeConnectInfo } from '../StripeConnectInfo'
import {
  PropertyCreatedEvent,
  PropertyUpdatedEvent,
  OnboardingCompletedEvent,
  StripeConnectedEvent,
  PropertyStatusChangedEvent,
} from '../events'

describe('Property', () => {
  const validPropertyId = 'prop-123'
  const validCompanyId = 'company-456'
  const validOwnerId = 'owner-789'
  const validName = 'Mountain View Campground'
  const validSlug = 'mountain-view'

  describe('create', () => {
    it('should create a new property with valid inputs', () => {
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )

      expect(property.id).toBe(validPropertyId)
      expect(property.companyId).toBe(validCompanyId)
      expect(property.ownerId).toBe(validOwnerId)
      expect(property.name).toBe(validName)
      expect(property.slug).toBe(validSlug)
      expect(property.status).toBe(PropertyStatus.DRAFT)
      expect(property.onboardingStatus).toBe(OnboardingStatus.NOT_STARTED)
      expect(property.isOnboardingComplete()).toBe(false)
    })

    it('should emit PropertyCreatedEvent on creation', () => {
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )

      const events = property.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(PropertyCreatedEvent)

      const event = events[0] as PropertyCreatedEvent
      expect(event.propertyId).toBe(validPropertyId)
      expect(event.companyId).toBe(validCompanyId)
      expect(event.name).toBe(validName)
      expect(event.slug).toBe(validSlug)
    })

    it('should trim and lowercase slug', () => {
      const inputSlug = '  Mountain-View  '
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        inputSlug
      )

      expect(property.slug).toBe('mountain-view')
    })

    it('should trim property name', () => {
      const inputName = '  Mountain View Campground  '
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        inputName,
        validSlug
      )

      expect(property.name).toBe(validName)
    })

    it('should throw if company ID is missing', () => {
      expect(() =>
        Property.create(validPropertyId, '', validOwnerId, validName, validSlug)
      ).toThrow('Company ID is required')
    })

    it('should throw if name is empty', () => {
      expect(() =>
        Property.create(validPropertyId, validCompanyId, validOwnerId, '', validSlug)
      ).toThrow('Property name is required')
    })

    it('should throw if slug is empty', () => {
      expect(() =>
        Property.create(validPropertyId, validCompanyId, validOwnerId, validName, '')
      ).toThrow('Property slug is required')
    })

    it('should throw if slug contains invalid characters', () => {
      const invalidSlug = 'Mountain View!'

      expect(() =>
        Property.create(validPropertyId, validCompanyId, validOwnerId, validName, invalidSlug)
      ).toThrow('Property slug must be URL-safe')
    })

    it('should convert uppercase letters to lowercase in slug', () => {
      const mixedCaseSlug = 'MountainView'

      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        mixedCaseSlug
      )

      expect(property.slug).toBe('mountainview')
    })

    it('should accept valid slug with hyphens and numbers', () => {
      const validSlugWithNumbers = 'camp-123-abc'

      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlugWithNumbers
      )

      expect(property.slug).toBe(validSlugWithNumbers)
    })

    it('should throw if email format is invalid', () => {
      expect(() =>
        Property.create(validPropertyId, validCompanyId, validOwnerId, validName, validSlug, {
          email: 'invalid-email',
        })
      ).toThrow('Invalid email format')
    })

    it('should accept optional fields', () => {
      const description = 'Beautiful mountain campground'
      const propertyType = PropertyType.CAMPGROUND
      const email = 'info@mountainview.com'
      const phone = '555-1234'

      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug,
        {
          description,
          propertyType,
          email,
          phone,
          address: '123 Mountain Rd',
          city: 'Boulder',
          state: 'CO',
          zipCode: '80301',
          country: 'USA',
        }
      )

      expect(property.description).toBe(description)
      expect(property.propertyType).toBe(propertyType)
      expect(property.email).toBe(email)
      expect(property.phone).toBe(phone)
      expect(property.address).toBe('123 Mountain Rd')
      expect(property.city).toBe('Boulder')
      expect(property.state).toBe('CO')
      expect(property.zipCode).toBe('80301')
      expect(property.country).toBe('USA')
    })

    it('should initialize with default settings when not provided', () => {
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )

      expect(property.settings).toBeInstanceOf(PropertySettings)
      expect(property.settings.checkInTime).toBe('14:00')
      expect(property.settings.checkOutTime).toBe('11:00')
    })
  })

  describe('updateDetails', () => {
    let property: Property

    beforeEach(() => {
      property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.clearDomainEvents()
    })

    it('should update property name', () => {
      const newName = 'Updated Campground Name'
      property.updateDetails({ name: newName })

      expect(property.name).toBe(newName)
    })

    it('should update description', () => {
      const newDescription = 'New description text'
      property.updateDetails({ description: newDescription })

      expect(property.description).toBe(newDescription)
    })

    it('should update property type', () => {
      const newType = PropertyType.GLAMPING
      property.updateDetails({ propertyType: newType })

      expect(property.propertyType).toBe(newType)
    })

    it('should update email', () => {
      const newEmail = 'updated@example.com'
      property.updateDetails({ email: newEmail })

      expect(property.email).toBe(newEmail)
    })

    it('should throw if new name is empty', () => {
      expect(() => property.updateDetails({ name: '' })).toThrow('Property name is required')
    })

    it('should throw if new email is invalid', () => {
      expect(() => property.updateDetails({ email: 'not-an-email' })).toThrow(
        'Invalid email format'
      )
    })

    it('should emit PropertyUpdatedEvent', () => {
      property.updateDetails({ name: 'Updated Name' })

      const events = property.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(PropertyUpdatedEvent)
    })
  })

  describe('updateLocation', () => {
    let property: Property

    beforeEach(() => {
      property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.clearDomainEvents()
    })

    it('should update complete location', () => {
      const location = {
        address: '456 New Street',
        city: 'Denver',
        state: 'CO',
        zipCode: '80202',
        country: 'USA',
      }

      property.updateLocation(location)

      expect(property.address).toBe(location.address)
      expect(property.city).toBe(location.city)
      expect(property.state).toBe(location.state)
      expect(property.zipCode).toBe(location.zipCode)
      expect(property.country).toBe(location.country)
    })

    it('should update partial location', () => {
      property.updateLocation({ city: 'Boulder' })

      expect(property.city).toBe('Boulder')
      expect(property.address).toBeNull()
    })

    it('should emit PropertyUpdatedEvent', () => {
      property.updateLocation({ city: 'Boulder' })

      const events = property.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(PropertyUpdatedEvent)
    })
  })

  describe('updateSettings', () => {
    let property: Property

    beforeEach(() => {
      property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.clearDomainEvents()
    })

    it('should update property settings', () => {
      const newSettings = PropertySettings.create({
        checkInTime: '15:00',
        checkOutTime: '10:00',
        minStayNights: 2,
      })

      property.updateSettings(newSettings)

      expect(property.settings).toBe(newSettings)
      expect(property.settings.checkInTime).toBe('15:00')
      expect(property.settings.minStayNights).toBe(2)
    })

    it('should emit PropertyUpdatedEvent', () => {
      const newSettings = PropertySettings.default()
      property.updateSettings(newSettings)

      const events = property.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(PropertyUpdatedEvent)
    })
  })

  describe('connectStripe', () => {
    let property: Property

    beforeEach(() => {
      property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.clearDomainEvents()
    })

    it('should connect Stripe account', () => {
      const stripeAccountId = 'acct_123456'

      property.connectStripe(stripeAccountId)

      expect(property.stripeConnectInfo.accountId).toBe(stripeAccountId)
      expect(property.stripeConnectInfo.isConnected()).toBe(true)
      expect(property.stripeConnectInfo.connectedAt).toBeInstanceOf(Date)
    })

    it('should throw if Stripe account ID is empty', () => {
      expect(() => property.connectStripe('')).toThrow('Stripe account ID is required')
    })

    it('should emit StripeConnectedEvent', () => {
      const stripeAccountId = 'acct_123456'

      property.connectStripe(stripeAccountId)

      const events = property.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(StripeConnectedEvent)

      const event = events[0] as StripeConnectedEvent
      expect(event.propertyId).toBe(validPropertyId)
      expect(event.stripeAccountId).toBe(stripeAccountId)
    })
  })

  describe('completeOnboarding', () => {
    let property: Property

    beforeEach(() => {
      property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.connectStripe('acct_123')
      property.clearDomainEvents()
    })

    it('should complete onboarding', () => {
      property.completeOnboarding()

      expect(property.isOnboardingComplete()).toBe(true)
      expect(property.onboardingStatus).toBe(OnboardingStatus.COMPLETED)
      expect(property.onboardingCompletedAt).toBeInstanceOf(Date)
    })

    it('should activate property when onboarding is complete', () => {
      expect(property.status).toBe(PropertyStatus.DRAFT)

      property.completeOnboarding()

      expect(property.status).toBe(PropertyStatus.ACTIVE)
    })

    it('should emit OnboardingCompletedEvent', () => {
      property.completeOnboarding()

      const events = property.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(OnboardingCompletedEvent)

      const event = events[0] as OnboardingCompletedEvent
      expect(event.propertyId).toBe(validPropertyId)
      expect(event.completedAt).toBeInstanceOf(Date)
    })

    it('should be idempotent when already complete', () => {
      property.completeOnboarding()
      property.clearDomainEvents()

      property.completeOnboarding()

      const events = property.getDomainEvents()
      expect(events).toHaveLength(0) // No new events
    })

    it('should throw if completing onboarding without Stripe Connect', () => {
      const newProperty = Property.create(
        'prop-new',
        validCompanyId,
        validOwnerId,
        'New Property',
        'new-property'
      )

      expect(() => newProperty.completeOnboarding()).toThrow(
        'Cannot complete onboarding without Stripe Connect'
      )
    })
  })

  describe('changeStatus', () => {
    let property: Property

    beforeEach(() => {
      property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.connectStripe('acct_123')
      property.completeOnboarding()
      property.clearDomainEvents()
    })

    it('should change status from ACTIVE to INACTIVE', () => {
      expect(property.status).toBe(PropertyStatus.ACTIVE)

      property.changeStatus(PropertyStatus.INACTIVE)

      expect(property.status).toBe(PropertyStatus.INACTIVE)
    })

    it('should emit PropertyStatusChangedEvent', () => {
      property.changeStatus(PropertyStatus.INACTIVE)

      const events = property.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(PropertyStatusChangedEvent)

      const event = events[0] as PropertyStatusChangedEvent
      expect(event.oldStatus).toBe(PropertyStatus.ACTIVE)
      expect(event.newStatus).toBe(PropertyStatus.INACTIVE)
    })

    it('should be idempotent when status unchanged', () => {
      property.changeStatus(PropertyStatus.ACTIVE)

      const events = property.getDomainEvents()
      expect(events).toHaveLength(0) // No events
    })

    it('should throw if activating before onboarding complete', () => {
      const newProperty = Property.create(
        'prop-new',
        validCompanyId,
        validOwnerId,
        'New Property',
        'new-property'
      )

      expect(() => newProperty.changeStatus(PropertyStatus.ACTIVE)).toThrow(
        'Cannot activate property before completing onboarding'
      )
    })
  })

  describe('activate', () => {
    let property: Property

    beforeEach(() => {
      property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.connectStripe('acct_123')
      property.completeOnboarding()
      property.changeStatus(PropertyStatus.INACTIVE)
      property.clearDomainEvents()
    })

    it('should activate property', () => {
      property.activate()

      expect(property.status).toBe(PropertyStatus.ACTIVE)
    })
  })

  describe('deactivate', () => {
    let property: Property

    beforeEach(() => {
      property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.connectStripe('acct_123')
      property.completeOnboarding()
      property.clearDomainEvents()
    })

    it('should deactivate property', () => {
      expect(property.status).toBe(PropertyStatus.ACTIVE)

      property.deactivate()

      expect(property.status).toBe(PropertyStatus.INACTIVE)
    })
  })

  describe('canAcceptBookings', () => {
    it('should return true when property is active, onboarded, and Stripe connected', () => {
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.connectStripe('acct_123')
      property.completeOnboarding()

      expect(property.canAcceptBookings()).toBe(true)
    })

    it('should return false when property is inactive', () => {
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.connectStripe('acct_123')
      property.completeOnboarding()
      property.deactivate()

      expect(property.canAcceptBookings()).toBe(false)
    })

    it('should return false when onboarding not complete', () => {
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )

      expect(property.canAcceptBookings()).toBe(false)
    })

    it('should return false when Stripe not connected', () => {
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )

      expect(property.canAcceptBookings()).toBe(false)
    })
  })

  describe('toPersistence', () => {
    it('should convert property to database format', () => {
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug,
        {
          description: 'Test description',
          email: 'test@example.com',
        }
      )

      const persistence = property.toPersistence()

      expect(persistence.id).toBe(validPropertyId)
      expect(persistence.company_id).toBe(validCompanyId)
      expect(persistence.owner_id).toBe(validOwnerId)
      expect(persistence.name).toBe(validName)
      expect(persistence.slug).toBe(validSlug)
      expect(persistence.description).toBe('Test description')
      expect(persistence.email).toBe('test@example.com')
      expect(persistence.onboarding_completed).toBe(false)
      expect(persistence.status).toBe(PropertyStatus.DRAFT)
      expect(persistence.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(persistence.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should set onboarding_completed to true when onboarding is complete', () => {
      const property = Property.create(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug
      )
      property.connectStripe('acct_123')
      property.completeOnboarding()

      const persistence = property.toPersistence()

      expect(persistence.onboarding_completed).toBe(true)
      expect(persistence.onboarding_completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(persistence.stripe_account_id).toBe('acct_123')
      expect(persistence.stripe_connected_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('fromPersistence', () => {
    it('should reconstitute property from database row', () => {
      const createdAt = new Date('2025-01-01T00:00:00Z')
      const updatedAt = new Date('2025-01-02T00:00:00Z')
      const settings = PropertySettings.default()

      const property = Property.fromPersistence(
        validPropertyId,
        validCompanyId,
        validOwnerId,
        validName,
        validSlug,
        'Test description',
        PropertyType.CAMPGROUND,
        PropertyStatus.ACTIVE,
        '123 Main St',
        'Boulder',
        'CO',
        '80301',
        'USA',
        '555-1234',
        'test@example.com',
        'mountain-view',
        'mountain-view-booking',
        'https://example.com/hero.jpg', // heroImageUrl
        settings,
        ['wifi', 'showers'],
        'Check in at the office', // checkInInstructions
        'Leave keys in drop box', // checkOutInstructions
        'No loud music after 10pm', // houseRules
        true, // onboarding_completed
        new Date('2025-01-01T12:00:00Z'),
        'acct_123',
        new Date('2025-01-01T10:00:00Z'),
        createdAt,
        updatedAt
      )

      expect(property.id).toBe(validPropertyId)
      expect(property.companyId).toBe(validCompanyId)
      expect(property.name).toBe(validName)
      expect(property.status).toBe(PropertyStatus.ACTIVE)
      expect(property.isOnboardingComplete()).toBe(true)
      expect(property.onboardingStatus).toBe(OnboardingStatus.COMPLETED)
      expect(property.stripeConnectInfo.accountId).toBe('acct_123')
      expect(property.stripeConnectInfo.isConnected()).toBe(true)
      expect(property.createdAt).toBe(createdAt)
      expect(property.updatedAt).toBe(updatedAt)
    })
  })
})
