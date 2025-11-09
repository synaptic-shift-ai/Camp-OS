/**
 * CreateGuestCommandHandler Tests
 *
 * Tests the CreateGuestCommand handler with mocked repository.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { CreateGuestCommandHandler, CreateGuestInput } from '../commands/CreateGuestCommand'
import { IGuestRepository } from '../../domain/IGuestRepository'
import { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'
import { Guest } from '../../domain/Guest'
import { GuestCreated } from '../../domain/events/GuestCreated'

describe('CreateGuestCommandHandler', () => {
  let handler: CreateGuestCommandHandler
  let mockRepository: IGuestRepository
  let mockEventBus: IEventBus

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByPropertyId: vi.fn(),
      findByStripeCustomerId: vi.fn(),
      exists: vi.fn(),
    }

    // Create mock event bus
    mockEventBus = {
      publish: vi.fn(),
      publishAll: vi.fn(),
      subscribe: vi.fn(),
    }

    handler = new CreateGuestCommandHandler(mockRepository, mockEventBus)
  })

  test('should create new guest when email does not exist', async () => {
    const input: CreateGuestInput = {
      propertyId: 'property-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-0100',
    }

    // Mock: no existing guest
    vi.mocked(mockRepository.findByEmail).mockResolvedValue(null)

    const result = await handler.execute(input)

    expect(result).toBeInstanceOf(Guest)
    expect(result.name.firstName).toBe('John')
    expect(result.name.lastName).toBe('Doe')
    expect(result.contact.email).toBe('john@example.com')
    expect(result.propertyId).toBe('property-123')
    expect(mockRepository.save).toHaveBeenCalledWith(result)
    expect(mockEventBus.publishAll).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(GuestCreated)])
    )
  })

  test('should return existing guest when email already exists', async () => {
    const input: CreateGuestInput = {
      propertyId: 'property-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'existing@example.com',
      phone: '555-0100',
    }

    const existingGuest = Guest.create({
      id: 'existing-guest',
      propertyId: 'property-123',
      userId: null,
      name: { firstName: 'Jane', lastName: 'Smith', getFullName: () => 'Jane Smith' } as any,
      contact: { email: 'existing@example.com', phone: '555-0200' } as any,
      address: null,
      stripeCustomerId: null,
      notes: null,
    })

    // Mock: existing guest found
    vi.mocked(mockRepository.findByEmail).mockResolvedValue(existingGuest)

    const result = await handler.execute(input)

    expect(result).toBe(existingGuest)
    expect(mockRepository.save).not.toHaveBeenCalled()
    expect(mockEventBus.publishAll).not.toHaveBeenCalled()
  })

  test('should create guest with complete address', async () => {
    const input: CreateGuestInput = {
      propertyId: 'property-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-0100',
      address: {
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      },
    }

    vi.mocked(mockRepository.findByEmail).mockResolvedValue(null)

    const result = await handler.execute(input)

    expect(result.hasAddress()).toBe(true)
    expect(result.address!.street).toBe('123 Main St')
    expect(result.address!.city).toBe('Portland')
  })

  test('should create guest with emergency contact', async () => {
    const input: CreateGuestInput = {
      propertyId: 'property-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-0100',
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '555-0200',
    }

    vi.mocked(mockRepository.findByEmail).mockResolvedValue(null)

    const result = await handler.execute(input)

    expect(result.hasEmergencyContact()).toBe(true)
    expect(result.contact.emergencyContactName).toBe('Jane Doe')
    expect(result.contact.emergencyContactPhone).toBe('555-0200')
  })

  test('should create guest with userId when provided', async () => {
    const input: CreateGuestInput = {
      propertyId: 'property-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-0100',
      userId: 'user-789',
    }

    vi.mocked(mockRepository.findByEmail).mockResolvedValue(null)

    const result = await handler.execute(input)

    expect(result.userId).toBe('user-789')
  })

  test('should create guest with notes when provided', async () => {
    const input: CreateGuestInput = {
      propertyId: 'property-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-0100',
      notes: 'VIP guest',
    }

    vi.mocked(mockRepository.findByEmail).mockResolvedValue(null)

    const result = await handler.execute(input)

    expect(result.notes).toBe('VIP guest')
  })

  test('should normalize email to lowercase when checking for duplicates', async () => {
    const input: CreateGuestInput = {
      propertyId: 'property-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'John@EXAMPLE.COM',
      phone: '555-0100',
    }

    vi.mocked(mockRepository.findByEmail).mockResolvedValue(null)

    const result = await handler.execute(input)

    // Email normalization happens in ContactInfo.create()
    expect(result.contact.email).toBe('john@example.com')
    expect(mockRepository.findByEmail).toHaveBeenCalledWith(
      'property-123',
      'john@example.com' // ContactInfo normalizes before we pass to findByEmail
    )
  })

  test('should check for existing guest in correct property (tenant isolation)', async () => {
    const input: CreateGuestInput = {
      propertyId: 'property-456',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-0100',
    }

    vi.mocked(mockRepository.findByEmail).mockResolvedValue(null)

    await handler.execute(input)

    expect(mockRepository.findByEmail).toHaveBeenCalledWith(
      'property-456',
      expect.any(String)
    )
  })
})
