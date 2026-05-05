/**
 * UpdateGuestCommandHandler Tests
 *
 * Tests the UpdateGuestCommand handler with mocked repository.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { UpdateGuestCommandHandler, type UpdateGuestInput } from '../commands/UpdateGuestCommand'
import { type IGuestRepository } from '../../domain/IGuestRepository'
import { Guest } from '../../domain/Guest'
import { PersonName } from '../../domain/value-objects/PersonName'
import { ContactInfo } from '../../domain/value-objects/ContactInfo'
import { Address } from '../../domain/value-objects/Address'

describe('UpdateGuestCommandHandler', () => {
  let handler: UpdateGuestCommandHandler
  let mockRepository: IGuestRepository
  let existingGuest: Guest

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByPropertyId: vi.fn(),
      findByStripeCustomerId: vi.fn(),
      exists: vi.fn(),
      softDelete: vi.fn(),
    }

    handler = new UpdateGuestCommandHandler(mockRepository)
    existingGuest = Guest.create({
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

    handler = new UpdateGuestCommandHandler(mockRepository)
  })

  test('should throw error when guest not found', async () => {
    const input: UpdateGuestInput = {
      guestId: 'non-existent',
      email: 'new@example.com',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(null)

    await expect(handler.execute(input)).rejects.toThrow('Guest not found: non-existent')
  })

  test('should update email', async () => {
    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      email: 'newemail@example.com',
      phone: '555-0100', // Keep same phone
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    const result = await handler.execute(input)

    expect(result.contact.email).toBe('newemail@example.com')
    expect(mockRepository.save).toHaveBeenCalledWith(existingGuest)
    // (EventBus publish assertion removed — EventBus infrastructure deleted)
  })

  test('should update phone', async () => {
    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      email: 'john@example.com', // Keep same email
      phone: '555-9999',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    const result = await handler.execute(input)

    expect(result.contact.phone).toBe('555-9999')
    expect(mockRepository.save).toHaveBeenCalled()
  })

  test('should update emergency contact', async () => {
    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      email: 'john@example.com',
      phone: '555-0100',
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '555-0200',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    const result = await handler.execute(input)

    expect(result.hasEmergencyContact()).toBe(true)
    expect(result.contact.emergencyContactName).toBe('Jane Doe')
    expect(result.contact.emergencyContactPhone).toBe('555-0200')
  })

  test('should add address when none existed', async () => {
    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      address: {
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      },
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    const result = await handler.execute(input)

    expect(result.hasAddress()).toBe(true)
    expect(result.address!.street).toBe('123 Main St')
    expect(result.address!.city).toBe('Portland')
  })

  test('should update existing address', async () => {
    const guestWithAddress = Guest.create({
      id: 'guest-123',
      propertyId: 'property-456',
      userId: null,
      name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
      contact: ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      }),
      address: Address.create({
        street: '123 Old St',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98101',
        country: 'USA',
      }),
      stripeCustomerId: null,
      notes: null,
    })

    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      address: {
        street: '456 New Ave',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      },
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(guestWithAddress)

    const result = await handler.execute(input)

    expect(result.address!.street).toBe('456 New Ave')
    expect(result.address!.city).toBe('Portland')
  })

  test('should remove address when set to null', async () => {
    const guestWithAddress = Guest.create({
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

    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      address: null,
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(guestWithAddress)

    const result = await handler.execute(input)

    expect(result.hasAddress()).toBe(false)
    expect(result.address).toBeNull()
  })

  test('should update notes', async () => {
    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      notes: 'VIP guest - prefers quiet sites',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    const result = await handler.execute(input)

    expect(result.notes).toBe('VIP guest - prefers quiet sites')
  })

  test('should update multiple fields at once', async () => {
    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      email: 'newemail@example.com',
      phone: '555-9999',
      address: {
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      },
      notes: 'Updated guest',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    const result = await handler.execute(input)

    expect(result.contact.email).toBe('newemail@example.com')
    expect(result.contact.phone).toBe('555-9999')
    expect(result.hasAddress()).toBe(true)
    expect(result.notes).toBe('Updated guest')
  })

  test('should preserve existing contact info when only updating address', async () => {
    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      address: {
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      },
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    const result = await handler.execute(input)

    // Contact info should remain unchanged
    expect(result.contact.email).toBe('john@example.com')
    expect(result.contact.phone).toBe('555-0100')
  })

  test('should clear domain events after publishing', async () => {
    const input: UpdateGuestInput = {
      guestId: 'guest-123',
      notes: 'Test note',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    await handler.execute(input)

    // Events should be cleared after publishing
    expect(existingGuest.getDomainEvents()).toHaveLength(0)
  })
})
