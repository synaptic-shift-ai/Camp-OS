/**
 * Query Handlers Tests
 *
 * Tests GetGuestQuery and ListGuestsQuery handlers.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { GetGuestQueryHandler, GetGuestInput } from '../queries/GetGuestQuery'
import { ListGuestsQueryHandler, ListGuestsInput } from '../queries/ListGuestsQuery'
import { IGuestRepository } from '../../domain/IGuestRepository'
import { Guest } from '../../domain/Guest'
import { PersonName } from '../../domain/PersonName'
import { ContactInfo } from '../../domain/ContactInfo'
import { Address } from '../../domain/Address'
import { GuestDTO } from '../DTOs/GuestDTO'

describe('GetGuestQueryHandler', () => {
  let handler: GetGuestQueryHandler
  let mockRepository: IGuestRepository

  beforeEach(() => {
    mockRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByPropertyId: vi.fn(),
      findByStripeCustomerId: vi.fn(),
      exists: vi.fn(),
    }

    handler = new GetGuestQueryHandler(mockRepository)
  })

  test('should return guest DTO when guest exists', async () => {
    const guest = Guest.create({
      id: 'guest-123',
      propertyId: 'property-456',
      userId: 'user-789',
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
      stripeCustomerId: 'cus_123456',
      notes: 'VIP guest',
    })

    const input: GetGuestInput = {
      guestId: 'guest-123',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(guest)

    const result = await handler.execute(input)

    expect(result.id).toBe('guest-123')
    expect(result.propertyId).toBe('property-456')
    expect(result.userId).toBe('user-789')
    expect(result.firstName).toBe('John')
    expect(result.lastName).toBe('Doe')
    expect(result.fullName).toBe('John Doe')
    expect(result.email).toBe('john@example.com')
    expect(result.phone).toBe('555-0100')
    expect(result.hasStripeCustomer).toBe(true)
    expect(result.stripeCustomerId).toBe('cus_123456')
    expect(result.notes).toBe('VIP guest')
    expect(result.address).not.toBeNull()
    expect(result.address!.street).toBe('123 Main St')
  })

  test('should throw error when guest not found', async () => {
    const input: GetGuestInput = {
      guestId: 'non-existent',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(null)

    await expect(handler.execute(input)).rejects.toThrow('Guest not found: non-existent')
  })

  test('should return DTO with null address when guest has no address', async () => {
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

    const input: GetGuestInput = {
      guestId: 'guest-123',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(guest)

    const result = await handler.execute(input)

    expect(result.address).toBeNull()
    expect(result.hasStripeCustomer).toBe(false)
    expect(result.userId).toBeNull()
  })

  test('should return DTO with emergency contact when present', async () => {
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

    const input: GetGuestInput = {
      guestId: 'guest-123',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(guest)

    const result = await handler.execute(input)

    expect(result.emergencyContact).not.toBeNull()
    expect(result.emergencyContact!.name).toBe('Jane Doe')
    expect(result.emergencyContact!.phone).toBe('555-0200')
  })
})

describe('ListGuestsQueryHandler', () => {
  let handler: ListGuestsQueryHandler
  let mockRepository: IGuestRepository

  beforeEach(() => {
    mockRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByPropertyId: vi.fn(),
      findByStripeCustomerId: vi.fn(),
      exists: vi.fn(),
    }

    handler = new ListGuestsQueryHandler(mockRepository)
  })

  test('should return array of guest DTOs', async () => {
    const guest1 = Guest.create({
      id: 'guest-1',
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

    const guest2 = Guest.create({
      id: 'guest-2',
      propertyId: 'property-456',
      userId: null,
      name: PersonName.create({ firstName: 'Jane', lastName: 'Smith' }),
      contact: ContactInfo.create({
        email: 'jane@example.com',
        phone: '555-0200',
      }),
      address: null,
      stripeCustomerId: null,
      notes: null,
    })

    const input: ListGuestsInput = {
      propertyId: 'property-456',
    }

    vi.mocked(mockRepository.findByPropertyId).mockResolvedValue([guest1, guest2])

    const result = await handler.execute(input)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('guest-1')
    expect(result[0].firstName).toBe('John')
    expect(result[1].id).toBe('guest-2')
    expect(result[1].firstName).toBe('Jane')
  })

  test('should return empty array when no guests found', async () => {
    const input: ListGuestsInput = {
      propertyId: 'property-456',
    }

    vi.mocked(mockRepository.findByPropertyId).mockResolvedValue([])

    const result = await handler.execute(input)

    expect(result).toHaveLength(0)
    expect(result).toEqual([])
  })

  test('should enforce tenant isolation (property filter)', async () => {
    const input: ListGuestsInput = {
      propertyId: 'property-123',
    }

    vi.mocked(mockRepository.findByPropertyId).mockResolvedValue([])

    await handler.execute(input)

    expect(mockRepository.findByPropertyId).toHaveBeenCalledWith('property-123')
  })

  test('should map all guest fields to DTOs correctly', async () => {
    const guest = Guest.create({
      id: 'guest-1',
      propertyId: 'property-456',
      userId: 'user-789',
      name: PersonName.create({ firstName: 'John', lastName: 'Doe' }),
      contact: ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '555-0200',
      }),
      address: Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      }),
      stripeCustomerId: 'cus_123456',
      notes: 'VIP',
    })

    const input: ListGuestsInput = {
      propertyId: 'property-456',
    }

    vi.mocked(mockRepository.findByPropertyId).mockResolvedValue([guest])

    const result = await handler.execute(input)

    expect(result).toHaveLength(1)
    const dto = result[0]
    expect(dto.id).toBe('guest-1')
    expect(dto.fullName).toBe('John Doe')
    expect(dto.hasStripeCustomer).toBe(true)
    expect(dto.address).not.toBeNull()
    expect(dto.emergencyContact).not.toBeNull()
    expect(dto.notes).toBe('VIP')
  })
})
