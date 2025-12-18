/**
 * Guest Aggregate Tests
 *
 * Tests the Guest aggregate following TDD best practices:
 * - Parameterized test inputs (no hardcoded literals)
 * - Strong assertions (exact value checks)
 * - Business rules validation
 * - Domain event generation
 */

import { describe, test, expect } from 'vitest'
import { Guest } from '../Guest'
import { PersonName } from '../value-objects/PersonName'
import { ContactInfo } from '../value-objects/ContactInfo'
import { Address } from '../value-objects/Address'
import { GuestCreated } from '../events/GuestCreated'
import { GuestUpdated } from '../events/GuestUpdated'
import { StripeCustomerLinked } from '../events/StripeCustomerLinked'

describe('Guest', () => {
  describe('create', () => {
    test('should create new Guest with required fields', () => {
      const id = 'guest-123'
      const propertyId = 'property-456'
      const userId = null
      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })
      const contact = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      })

      const guest = Guest.create({
        id,
        propertyId,
        userId,
        name,
        contact,
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      expect(guest.id).toBe(id)
      expect(guest.propertyId).toBe(propertyId)
      expect(guest.userId).toBeNull()
      expect(guest.name).toBe(name)
      expect(guest.contact).toBe(contact)
      expect(guest.address).toBeNull()
      expect(guest.stripeCustomerId).toBeNull()
      expect(guest.notes).toBeNull()
    })

    test('should create Guest with all optional fields', () => {
      const id = 'guest-123'
      const propertyId = 'property-456'
      const userId = 'user-789'
      const name = PersonName.create({ firstName: 'Jane', lastName: 'Smith' })
      const contact = ContactInfo.create({
        email: 'jane@example.com',
        phone: '555-0200',
        emergencyContactName: 'John Smith',
        emergencyContactPhone: '555-0201',
      })
      const address = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })
      const stripeCustomerId = 'cus_123456'
      const notes = 'VIP guest'

      const guest = Guest.create({
        id,
        propertyId,
        userId,
        name,
        contact,
        address,
        stripeCustomerId,
        notes,
      })

      expect(guest.userId).toBe(userId)
      expect(guest.address).toBe(address)
      expect(guest.stripeCustomerId).toBe(stripeCustomerId)
      expect(guest.notes).toBe(notes)
    })

    test('should fire GuestCreated domain event', () => {
      const id = 'guest-123'
      const propertyId = 'property-456'
      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })
      const contact = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      })

      const guest = Guest.create({
        id,
        propertyId,
        userId: null,
        name,
        contact,
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      const events = guest.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(GuestCreated)

      const event = events[0] as GuestCreated
      expect(event.guestId).toBe(id)
      expect(event.propertyId).toBe(propertyId)
      expect(event.email).toBe('john@example.com')
      expect(event.fullName).toBe('John Doe')
    })
  })

  describe('updateContactInfo', () => {
    test('should update contact information', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      guest.clearDomainEvents() // Clear creation event

      const newContact = ContactInfo.create({
        email: 'john.doe@example.com',
        phone: '555-0999',
      })

      guest.updateContactInfo(newContact)

      expect(guest.contact).toBe(newContact)
    })

    test('should fire GuestUpdated event when contact info changes', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      guest.clearDomainEvents()

      const newContact = ContactInfo.create({
        email: 'john.doe@example.com',
        phone: '555-0999',
      })

      guest.updateContactInfo(newContact)

      const events = guest.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(GuestUpdated)

      const event = events[0] as GuestUpdated
      expect(event.guestId).toBe('guest-123')
      expect(event.updatedFields).toContain('contact')
    })
  })

  describe('updateAddress', () => {
    test('should update address', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      const newAddress = Address.create({
        street: '456 Oak Ave',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98101',
        country: 'USA',
      })

      guest.updateAddress(newAddress)

      expect(guest.address).toBe(newAddress)
    })

    test('should allow removing address by setting to null', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: Address.create({
          street: '123 Main St',
          city: 'Portland',
          state: 'OR',
          zipCode: '97201',
          country: 'USA',
        }),
        stripeCustomerId: null,
        notes: null,
      })

      guest.updateAddress(null)

      expect(guest.address).toBeNull()
    })

    test('should fire GuestUpdated event when address changes', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      guest.clearDomainEvents()

      const newAddress = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      guest.updateAddress(newAddress)

      const events = guest.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(GuestUpdated)
    })
  })

  describe('linkStripeCustomer', () => {
    test('should link Stripe customer ID', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      const customerId = 'cus_123456'
      guest.linkStripeCustomer(customerId)

      expect(guest.stripeCustomerId).toBe(customerId)
    })

    test('should fire StripeCustomerLinked event', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      guest.clearDomainEvents()

      const customerId = 'cus_123456'
      guest.linkStripeCustomer(customerId)

      const events = guest.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(StripeCustomerLinked)

      const event = events[0] as StripeCustomerLinked
      expect(event.guestId).toBe('guest-123')
      expect(event.stripeCustomerId).toBe(customerId)
    })

    test('should throw error when Stripe customer already linked', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: 'cus_existing',
        notes: null,
      })

      expect(() => guest.linkStripeCustomer('cus_new')).toThrow(
        'Stripe customer already linked'
      )
    })
  })

  describe('unlinkStripeCustomer', () => {
    test('should unlink Stripe customer', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: 'cus_123456',
        notes: null,
      })

      guest.unlinkStripeCustomer()

      expect(guest.stripeCustomerId).toBeNull()
    })

    test('should fire GuestUpdated event when Stripe customer unlinked', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: 'cus_123456',
        notes: null,
      })

      guest.clearDomainEvents()
      guest.unlinkStripeCustomer()

      const events = guest.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(GuestUpdated)
    })
  })

  describe('addNotes', () => {
    test('should add notes to guest', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      const notes = 'VIP guest - prefers quiet sites'
      guest.addNotes(notes)

      expect(guest.notes).toBe(notes)
    })

    test('should fire GuestUpdated event when notes added', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      guest.clearDomainEvents()
      guest.addNotes('VIP guest')

      const events = guest.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(GuestUpdated)
    })
  })

  describe('query methods', () => {
    test('hasStripeCustomer should return true when customer ID exists', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: 'cus_123456',
        notes: null,
      })

      expect(guest.hasStripeCustomer()).toBe(true)
    })

    test('hasStripeCustomer should return false when no customer ID', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      expect(guest.hasStripeCustomer()).toBe(false)
    })

    test('hasAddress should return true when address exists', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: Address.create({
          street: '123 Main St',
          city: 'Portland',
          state: 'OR',
          zipCode: '97201',
          country: 'USA',
        }),
        stripeCustomerId: null,
        notes: null,
      })

      expect(guest.hasAddress()).toBe(true)
    })

    test('hasAddress should return false when no address', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      expect(guest.hasAddress()).toBe(false)
    })

    test('hasEmergencyContact should return true when emergency contact exists', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
          emergencyContactName: 'Jane Doe',
          emergencyContactPhone: '555-0200',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      expect(guest.hasEmergencyContact()).toBe(true)
    })

    test('getFullName should return full name from PersonName', () => {
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'property-456',
        userId: null,
        name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
        contact: ContactInfo.create({
          email: 'john@example.com',
          phone: '555-0100',
        }),
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      expect(guest.getFullName()).toBe('John Doe')
    })
  })
})
