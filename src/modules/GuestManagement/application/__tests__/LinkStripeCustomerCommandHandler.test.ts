/**
 * LinkStripeCustomerCommandHandler Tests
 *
 * Tests the LinkStripeCustomerCommand handler with mocked repository.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { LinkStripeCustomerCommandHandler, LinkStripeCustomerInput } from '../commands/LinkStripeCustomerCommand'
import { IGuestRepository } from '../../domain/IGuestRepository'
import { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'
import { Guest } from '../../domain/Guest'
import { PersonName } from '../../domain/value-objects/PersonName'
import { ContactInfo } from '../../domain/value-objects/ContactInfo'
import { StripeCustomerLinked } from '../../domain/events/StripeCustomerLinked'

describe('LinkStripeCustomerCommandHandler', () => {
  let handler: LinkStripeCustomerCommandHandler
  let mockRepository: IGuestRepository
  let mockEventBus: IEventBus
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
    }

    // Create mock event bus
    mockEventBus = {
      publish: vi.fn(),
      publishAll: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      clearSubscribers: vi.fn(),
      getSubscriberCount: vi.fn(),
    }

    // Create existing guest WITHOUT Stripe customer
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

    handler = new LinkStripeCustomerCommandHandler(mockRepository, mockEventBus)
  })

  test('should throw error when guest not found', async () => {
    const input: LinkStripeCustomerInput = {
      guestId: 'non-existent',
      stripeCustomerId: 'cus_123456',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(null)

    await expect(handler.execute(input)).rejects.toThrow('Guest not found: non-existent')
  })

  test('should link Stripe customer ID to guest', async () => {
    const input: LinkStripeCustomerInput = {
      guestId: 'guest-123',
      stripeCustomerId: 'cus_123456',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    await handler.execute(input)

    expect(existingGuest.stripeCustomerId).toBe('cus_123456')
    expect(existingGuest.hasStripeCustomer()).toBe(true)
    expect(mockRepository.save).toHaveBeenCalledWith(existingGuest)
  })

  test('should fire StripeCustomerLinked domain event', async () => {
    const input: LinkStripeCustomerInput = {
      guestId: 'guest-123',
      stripeCustomerId: 'cus_123456',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    await handler.execute(input)

    expect(mockEventBus.publishAll).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(StripeCustomerLinked)])
    )
  })

  test('should throw error when Stripe customer already linked', async () => {
    const guestWithStripe = Guest.create({
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

    const input: LinkStripeCustomerInput = {
      guestId: 'guest-123',
      stripeCustomerId: 'cus_new',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(guestWithStripe)

    await expect(handler.execute(input)).rejects.toThrow('Stripe customer already linked')
    expect(mockRepository.save).not.toHaveBeenCalled()
  })

  test('should clear domain events after publishing', async () => {
    const input: LinkStripeCustomerInput = {
      guestId: 'guest-123',
      stripeCustomerId: 'cus_123456',
    }

    vi.mocked(mockRepository.findById).mockResolvedValue(existingGuest)

    await handler.execute(input)

    // Events should be cleared after publishing
    expect(existingGuest.getDomainEvents()).toHaveLength(0)
  })
})
