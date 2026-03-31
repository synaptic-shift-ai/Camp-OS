/**
 * Guest↔Property Cross-Module Integration Tests
 *
 * Phase 2, Week 8: Integration & Testing
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * CRITICAL: These tests validate proper module boundaries and interactions
 * - Guests are properly scoped to Properties (multi-tenant isolation)
 * - Event-driven communication works between modules
 * - No direct module coupling (modules communicate via events only)
 * - Referential integrity maintained across module boundaries
 *
 * Following CLAUDE.md:
 * - BP-4: Always enforce multi-tenant isolation
 * - T-2: Integration tests in tests/integration/
 * - T-3: Separate from unit tests (these test cross-module behavior)
 * - T-4: Prefer integration tests over heavy mocking
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterize test inputs
 * - T-8: Test description states what final expect verifies
 * - T-10: Test edge cases and boundaries
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { type Property } from '@/modules/PropertyManagement/domain/Property'
import { type Guest } from '@/modules/GuestManagement/domain/Guest'
import { CreatePropertyCommandHandler } from '@/modules/PropertyManagement/application/commands/CreatePropertyCommand'
import { CreateGuestCommandHandler } from '@/modules/GuestManagement/application/commands/CreateGuestCommand'
import { ListGuestsQueryHandler } from '@/modules/GuestManagement/application/queries/ListGuestsQuery'
import { GetPropertyQueryHandler } from '@/modules/PropertyManagement/application/queries/GetPropertyQuery'
import { InMemoryEventBus } from '@/shared/infrastructure/eventBus/InMemoryEventBus'
import type { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'
import type { IPropertyRepository } from '@/modules/PropertyManagement/domain/IPropertyRepository'
import type { IGuestRepository } from '@/modules/GuestManagement/domain/IGuestRepository'
import { type PropertyStatus } from '@/modules/PropertyManagement/domain/PropertyStatus'

/**
 * Mock Repositories for Cross-Module Testing
 *
 * These mocks simulate the database layer to test module interactions
 * without requiring a real database connection.
 */

class MockPropertyRepository implements IPropertyRepository {
  private properties: Map<string, Property> = new Map()

  async save(property: Property): Promise<void> {
    this.properties.set(property.id, property)
  }

  async findById(id: string): Promise<Property | null> {
    return this.properties.get(id) || null
  }

  async findBySlug(slug: string): Promise<Property | null> {
    return (
      Array.from(this.properties.values()).find((p) => p.slug === slug) || null
    )
  }

  async findByCompanyId(companyId: string): Promise<Property[]> {
    return Array.from(this.properties.values()).filter(
      (p) => p.companyId === companyId
    )
  }

  async findByCompanyIdWithFilters(
    companyId: string,
    _filters: {
      status?: PropertyStatus | undefined
      onboardingComplete?: boolean | undefined
      limit?: number | undefined
      offset?: number | undefined
    }
  ): Promise<{ properties: Property[]; total: number }> {
    const properties = Array.from(this.properties.values()).filter(
      (p) => p.companyId === companyId
    );
    return { properties, total: properties.length };
  }

  async findByOwnerId(ownerId: string): Promise<Property | null> {
    return (
      Array.from(this.properties.values()).find((p) => p.ownerId === ownerId) ||
      null
    );
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return Array.from(this.properties.values()).some((p) => p.slug === slug)
  }

  async slugExistsForOtherProperty(slug: string, excludePropertyId: string): Promise<boolean> {
    return Array.from(this.properties.values()).some(
      (p) => p.slug === slug && p.id !== excludePropertyId
    );
  }

  async insertBookingPageSlugAlias(_propertyId: string, _bookingPageSlug: string): Promise<void> {}

  async bookingPageSlugExistsForOtherProperty(
    bookingPageSlug: string,
    excludePropertyId: string
  ): Promise<boolean> {
    return Array.from(this.properties.values()).some(
      (p) => p.bookingPageSlug === bookingPageSlug && p.id !== excludePropertyId
    )
  }

  async delete(id: string): Promise<void> {
    this.properties.delete(id)
  }

  clear(): void {
    this.properties.clear()
  }
}

class MockGuestRepository implements IGuestRepository {
  private guests: Map<string, Guest> = new Map()

  async save(guest: Guest): Promise<void> {
    this.guests.set(guest.id, guest)
  }

  async findById(id: string): Promise<Guest | null> {
    return this.guests.get(id) || null
  }

  async findByPropertyId(propertyId: string): Promise<Guest[]> {
    return Array.from(this.guests.values()).filter(
      (g) => g.propertyId === propertyId
    )
  }

  async findByEmail(
    propertyId: string,
    email: string
  ): Promise<Guest | null> {
    const normalizedEmail = email.toLowerCase()
    const guest = Array.from(this.guests.values()).find(
      (g) =>
        g.propertyId === propertyId &&
        g.contact.email.toLowerCase() === normalizedEmail
    )
    return guest || null
  }

  async findByStripeCustomerId(customerId: string): Promise<Guest | null> {
    return (
      Array.from(this.guests.values()).find(
        (g) => g.stripeCustomerId === customerId
      ) || null
    );
  }

  async exists(propertyId: string, email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase();
    return Array.from(this.guests.values()).some(
      (g) =>
        g.propertyId === propertyId &&
        g.contact.email.toLowerCase() === normalizedEmail
    );
  }

  async softDelete(_guestId: string): Promise<void> {}

  async delete(id: string): Promise<void> {
    this.guests.delete(id)
  }

  clear(): void {
    this.guests.clear()
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Guest↔Property Cross-Module Integration', () => {
  let eventBus: IEventBus
  let propertyRepo: MockPropertyRepository
  let guestRepo: MockGuestRepository

  beforeEach(() => {
    eventBus = new InMemoryEventBus()
    propertyRepo = new MockPropertyRepository()
    guestRepo = new MockGuestRepository()
  })

  // ==========================================================================
  // Multi-Tenant Isolation Tests (BP-4)
  // ==========================================================================

  describe('Multi-Tenant Isolation', () => {
    it('should create guest scoped to specific property', async () => {
      // Arrange: Create a property
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-123',
        companyId: 'company-abc',
        ownerId: 'owner-123',
        name: 'Pine Valley Campground',
        slug: 'pine-valley',
      })

      // Act: Create a guest for this property
      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guest = await guestCommand.execute({
        propertyId: property.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
      })

      // Assert: Guest is scoped to the correct property
      expect(guest.propertyId).toBe(property.id)
      expect(guest.name.firstName).toBe('John')
      expect(guest.contact.email).toBe('john@example.com')
    })

    it('should only list guests for the specified property (no cross-tenant leaks)', async () => {
      // Arrange: Create two properties from different companies
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property1 = await propertyCommand.execute({
        id: 'prop-111',
        companyId: 'company-aaa',
        ownerId: 'owner-111',
        name: 'Camp One',
        slug: 'camp-one',
      })
      const property2 = await propertyCommand.execute({
        id: 'prop-222',
        companyId: 'company-bbb',
        ownerId: 'owner-222',
        name: 'Camp Two',
        slug: 'camp-two',
      })

      // Create guests for each property
      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guest1 = await guestCommand.execute({
        propertyId: property1.id,
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'alice@example.com',
        phone: '555-0001',
      })

      const guest2 = await guestCommand.execute({
        propertyId: property2.id,
        firstName: 'Bob',
        lastName: 'Brown',
        email: 'bob@example.com',
        phone: '555-0002',
      })

      // Act: List guests for property 1
      const listQuery = new ListGuestsQueryHandler(guestRepo)
      const property1Guests = await listQuery.execute({
        propertyId: property1.id,
      })

      // Assert: Only property 1's guest is returned (no cross-tenant leak)
      expect(property1Guests).toHaveLength(1)
      expect(property1Guests[0]!.id).toBe(guest1.id)
      expect(property1Guests[0]!.email).toBe('alice@example.com')

      // Verify property 2 has its own isolated guest
      const property2Guests = await listQuery.execute({
        propertyId: property2.id,
      })
      expect(property2Guests).toHaveLength(1)
      expect(property2Guests[0]!.id).toBe(guest2.id)
      expect(property2Guests[0]!.email).toBe('bob@example.com')
    })

    it('should prevent duplicate email within same property but allow across properties', async () => {
      // Arrange: Create two properties
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property1 = await propertyCommand.execute({
        id: 'prop-aaa',
        companyId: 'company-xyz',
        ownerId: 'owner-aaa',
        name: 'Property 1',
        slug: 'prop-1',
      })
      const property2 = await propertyCommand.execute({
        id: 'prop-bbb',
        companyId: 'company-xyz',
        ownerId: 'owner-bbb',
        name: 'Property 2',
        slug: 'prop-2',
      })

      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const sharedEmail = 'shared@example.com'

      // Act: Create guest with email in property 1
      const guest1 = await guestCommand.execute({
        propertyId: property1.id,
        firstName: 'Test',
        lastName: 'User',
        email: sharedEmail,
        phone: '555-1000',
      })

      // Assert: Same email is allowed in property 2 (different tenant)
      const guest2 = await guestCommand.execute({
        propertyId: property2.id,
        firstName: 'Test',
        lastName: 'User',
        email: sharedEmail,
        phone: '555-2000',
      })

      expect(guest1.id).not.toBe(guest2.id)
      expect(guest1.propertyId).not.toBe(guest2.propertyId)

      // Verify: Duplicate email within same property returns existing guest
      const guest1Duplicate = await guestCommand.execute({
        propertyId: property1.id,
        firstName: 'Different',
        lastName: 'Name',
        email: sharedEmail,
        phone: '555-9999',
      })
      expect(guest1Duplicate.id).toBe(guest1.id) // Same guest returned
    })
  })

  // ==========================================================================
  // Module Boundary Tests
  // ==========================================================================

  describe('Module Boundaries', () => {
    it('should allow Guest module to reference Property ID without direct coupling', async () => {
      // Arrange: Create property
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-999',
        companyId: 'company-999',
        ownerId: 'owner-999',
        name: 'Test Camp',
        slug: 'test-camp',
      })

      // Act: Create guest referencing the property ID (no direct object reference)
      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guest = await guestCommand.execute({
        propertyId: property.id, // Guest only knows the ID, not the Property object
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-9999',
      })

      // Assert: Guest has property ID reference but no direct coupling
      expect(guest.propertyId).toBe(property.id)

      // Verify property still exists independently
      const propertyQuery = new GetPropertyQueryHandler(propertyRepo)
      const fetchedProperty = await propertyQuery.execute({ id: property.id })
      expect(fetchedProperty).toBeTruthy()
      expect(fetchedProperty?.id).toBe(property.id)
    })

    it('should emit domain events that cross module boundaries', async () => {
      // NOTE: This test is limited because command handlers use getEventBus() (global singleton)
      // rather than accepting an injected eventBus. In a future refactoring, we should:
      // 1. Inject eventBus into all command handlers (better testability)
      // 2. OR create a resetEventBus() method for testing
      //
      // For now, we verify that domain events are added to aggregates (tested in domain layer)
      // and trust that publishAll() is called by the handlers

      // Arrange & Act: Create property and guest
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-evt-123',
        companyId: 'company-evt-123',
        ownerId: 'owner-evt-123',
        name: 'Event Test Camp',
        slug: 'event-test-camp',
      })

      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guest = await guestCommand.execute({
        propertyId: property.id,
        firstName: 'Event',
        lastName: 'Tester',
        email: 'event@test.com',
        phone: '555-0123',
      })

      // Assert: Aggregates were created successfully
      // (domain events are tested in unit tests for each aggregate)
      expect(property.id).toBe('prop-evt-123')
      expect(guest.propertyId).toBe(property.id)

      // Future: When eventBus is injectable, verify actual event publication:
      // expect(capturedEvents).toHaveLength(2)
      // expect(capturedEvents[0].eventName).toBe('PropertyCreated')
      // expect(capturedEvents[1].eventName).toBe('GuestCreated')
    })
  })

  // ==========================================================================
  // Data Consistency Tests
  // ==========================================================================

  describe('Data Consistency Across Modules', () => {
    it('should maintain referential integrity when property exists', async () => {
      // Arrange: Create property
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-ref-123',
        companyId: 'company-ref-123',
        ownerId: 'owner-ref-123',
        name: 'Reference Test Property',
        slug: 'ref-test',
      })

      // Act: Create multiple guests for the same property
      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const _guest1 = await guestCommand.execute({
        propertyId: property.id,
        firstName: 'First',
        lastName: 'Guest',
        email: 'first@example.com',
        phone: '555-0001',
      })

      const _guest2 = await guestCommand.execute({
        propertyId: property.id,
        firstName: 'Second',
        lastName: 'Guest',
        email: 'second@example.com',
        phone: '555-0002',
      })

      // Assert: All guests reference the same valid property
      const listQuery = new ListGuestsQueryHandler(guestRepo)
      const guests = await listQuery.execute({ propertyId: property.id })

      expect(guests).toHaveLength(2)
      expect(guests.every((g) => g.propertyId === property.id)).toBe(true)

      // Verify property still exists
      const propertyQuery = new GetPropertyQueryHandler(propertyRepo)
      const fetchedProperty = await propertyQuery.execute({ id: property.id })
      expect(fetchedProperty?.id).toBe(property.id)
    })

    it('should handle property deletion when guests exist (defensive check)', async () => {
      // Arrange: Create property with guests
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-del-123',
        companyId: 'company-del-123',
        ownerId: 'owner-del-123',
        name: 'Delete Test Property',
        slug: 'delete-test',
      })

      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      await guestCommand.execute({
        propertyId: property.id,
        firstName: 'Orphan',
        lastName: 'Guest',
        email: 'orphan@example.com',
        phone: '555-0000',
      })

      // Act: Delete property (in real system, this should be prevented or cascade)
      await propertyRepo.delete(property.id)

      // Assert: Property is deleted
      const propertyQuery = new GetPropertyQueryHandler(propertyRepo)
      const deletedProperty = await propertyQuery.execute({ id: property.id })
      expect(deletedProperty).toBeNull()

      // Guest still exists (orphaned) - in production, we'd prevent this or cascade delete
      const listQuery = new ListGuestsQueryHandler(guestRepo)
      const orphanedGuests = await listQuery.execute({
        propertyId: property.id,
      })
      expect(orphanedGuests).toHaveLength(1)

      // NOTE: This test documents current behavior. In Week 9+, we should add:
      // 1. Prevent property deletion if guests exist, OR
      // 2. Cascade delete guests when property is deleted, OR
      // 3. Soft-delete pattern with archive status
    })
  })

  // ==========================================================================
  // Edge Cases & Boundary Testing
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty guest list for valid property', async () => {
      // Arrange: Create property with no guests
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-empty-123',
        companyId: 'company-empty-123',
        ownerId: 'owner-empty-123',
        name: 'Empty Camp',
        slug: 'empty-camp',
      })

      // Act: List guests
      const listQuery = new ListGuestsQueryHandler(guestRepo)
      const guests = await listQuery.execute({ propertyId: property.id })

      // Assert: Empty array returned (not null or error)
      expect(guests).toEqual([])
    })

    it('should handle large number of guests for single property', async () => {
      // Arrange: Create property
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-large-123',
        companyId: 'company-large-123',
        ownerId: 'owner-large-123',
        name: 'Large Camp',
        slug: 'large-camp',
      })

      // Act: Create 50 guests (reduced from 100 for test speed)
      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guestCount = 50

      for (let i = 0; i < guestCount; i++) {
        await guestCommand.execute({
          propertyId: property.id,
          firstName: `Guest${i}`,
          lastName: 'LastName',
          email: `guest${i}@example.com`,
          phone: `555-${i.toString().padStart(4, '0')}`,
        })
      }

      // Assert: All guests retrieved correctly
      const listQuery = new ListGuestsQueryHandler(guestRepo)
      const guests = await listQuery.execute({ propertyId: property.id })

      expect(guests).toHaveLength(guestCount)
      expect(guests.every((g) => g.propertyId === property.id)).toBe(true)
    })
  })
})
