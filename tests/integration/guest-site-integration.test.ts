/**
 * Guest↔Site Cross-Module Integration Tests
 *
 * Phase 2, Week 8: Integration & Testing
 * Parent: IMPLEMENTATION_PLAN.md
 *
 * CRITICAL: These tests validate proper module boundaries and interactions
 * - Guests and Sites can coexist within same Property (multi-tenant isolation)
 * - Module boundaries maintained (no direct coupling between Guest and Site)
 * - Both modules properly scoped to Properties
 * - Foundation for future Reservation module (Week 9-10)
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
import { Site } from '@/modules/SiteManagement/domain/Site'
import { SiteType } from '@/modules/SiteManagement/domain/SiteType'
import { SiteStatus } from '@/modules/SiteManagement/domain/SiteStatus'
import { Pricing } from '@/modules/SiteManagement/domain/Pricing'
import { type Guest } from '@/modules/GuestManagement/domain/Guest'
import { CreatePropertyCommandHandler } from '@/modules/PropertyManagement/application/commands/CreatePropertyCommand'
import { CreateGuestCommandHandler } from '@/modules/GuestManagement/application/commands/CreateGuestCommand'
import { ListSitesQueryHandler } from '@/modules/SiteManagement/application/queries/ListSitesQuery'
import { ListGuestsQueryHandler } from '@/modules/GuestManagement/application/queries/ListGuestsQuery'
import { InMemoryEventBus } from '@/shared/infrastructure/eventBus/InMemoryEventBus'
import type { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'
import type { IPropertyRepository } from '@/modules/PropertyManagement/domain/IPropertyRepository'
import type { IGuestRepository } from '@/modules/GuestManagement/domain/IGuestRepository'
import { type PropertyStatus } from '@/modules/PropertyManagement/domain/PropertyStatus'
import type { ISiteRepository } from '@/modules/SiteManagement/domain/ISiteRepository'

/**
 * Mock Repositories for Cross-Module Testing
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

  async delete(id: string): Promise<void> {
    this.guests.delete(id)
  }

  clear(): void {
    this.guests.clear()
  }
}

class MockSiteRepository implements ISiteRepository {
  private sites: Map<string, Site> = new Map()

  async save(site: Site): Promise<void> {
    this.sites.set(site.id, site)
  }

  async findById(id: string): Promise<Site | null> {
    return this.sites.get(id) || null
  }

  async findBySiteNumber(
    propertyId: string,
    siteNumber: string
  ): Promise<Site | null> {
    return (
      Array.from(this.sites.values()).find(
        (s) => s.propertyId === propertyId && s.siteNumber === siteNumber
      ) || null
    )
  }

  async findByPropertyId(propertyId: string): Promise<Site[]> {
    return Array.from(this.sites.values()).filter(
      (s) => s.propertyId === propertyId
    );
  }

  async findByPropertyIdWithFilters(
    propertyId: string,
    filters: {
      status?: SiteStatus | undefined
      siteType?: string | undefined
      availableOnly?: boolean | undefined
      limit?: number | undefined
      offset?: number | undefined
    }
  ): Promise<{ sites: Site[]; total: number }> {
    let sites = Array.from(this.sites.values()).filter(
      (s) => s.propertyId === propertyId
    )

    if (filters?.status) {
      sites = sites.filter((s) => s.status === filters.status)
    }

    if (filters?.siteType) {
      sites = sites.filter((s) => s.siteType === filters.siteType)
    }

    if (filters?.availableOnly) {
      sites = sites.filter((s) => s.status === SiteStatus.AVAILABLE)
    }

    const total = sites.length

    if (filters?.offset) {
      sites = sites.slice(filters.offset)
    }

    if (filters?.limit) {
      sites = sites.slice(0, filters.limit)
    }

    return { sites, total }
  }

  async findAvailableSites(propertyId: string): Promise<Site[]> {
    return Array.from(this.sites.values()).filter(
      (s) => s.propertyId === propertyId && s.status === SiteStatus.AVAILABLE
    );
  }

  async delete(id: string): Promise<void> {
    this.sites.delete(id)
  }

  async existsBySiteNumber(
    propertyId: string,
    siteNumber: string
  ): Promise<boolean> {
    return Array.from(this.sites.values()).some(
      (s) => s.propertyId === propertyId && s.siteNumber === siteNumber
    )
  }

  clear(): void {
    this.sites.clear()
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Guest↔Site Cross-Module Integration', () => {
  let eventBus: IEventBus
  let propertyRepo: MockPropertyRepository
  let guestRepo: MockGuestRepository
  let siteRepo: MockSiteRepository

  beforeEach(() => {
    eventBus = new InMemoryEventBus()
    propertyRepo = new MockPropertyRepository()
    guestRepo = new MockGuestRepository()
    siteRepo = new MockSiteRepository()
  })

  // ==========================================================================
  // Multi-Tenant Isolation Tests (BP-4)
  // ==========================================================================

  describe('Multi-Tenant Isolation', () => {
    it('should allow guests and sites to coexist within same property', async () => {
      // Arrange: Create a property
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-123',
        companyId: 'company-abc',
        ownerId: 'owner-123',
        name: 'Riverside Campground',
        slug: 'riverside-camp',
      })

      // Act: Create both a site and a guest for this property
      const site = Site.create(
        'site-001',
        property.id,
        'A1',
        'River View Site',
        SiteType.TENT,
        Pricing.create(50, 60, 'USD')
      )
      await siteRepo.save(site)

      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guest = await guestCommand.execute({
        propertyId: property.id,
        firstName: 'John',
        lastName: 'Camper',
        email: 'john@example.com',
        phone: '555-0100',
      })

      // Assert: Both belong to the same property
      expect(site.propertyId).toBe(property.id)
      expect(guest.propertyId).toBe(property.id)

      // Verify both can be queried independently
      const sitesQuery = new ListSitesQueryHandler(siteRepo)
      const sitesResult = await sitesQuery.execute({ propertyId: property.id })
      expect(sitesResult.sites).toHaveLength(1)

      const guestsQuery = new ListGuestsQueryHandler(guestRepo)
      const guests = await guestsQuery.execute({ propertyId: property.id })
      expect(guests).toHaveLength(1)
    })

    it('should isolate sites and guests across different properties', async () => {
      // Arrange: Create two properties
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property1 = await propertyCommand.execute({
        id: 'prop-111',
        companyId: 'company-aaa',
        ownerId: 'owner-111',
        name: 'Camp Alpha',
        slug: 'camp-alpha',
      })
      const property2 = await propertyCommand.execute({
        id: 'prop-222',
        companyId: 'company-bbb',
        ownerId: 'owner-222',
        name: 'Camp Beta',
        slug: 'camp-beta',
      })

      // Create sites and guests for each property
      const site1 = Site.create(
        'site-111',
        property1.id,
        'A1',
        'Alpha Site 1',
        SiteType.RV,
        Pricing.create(75, 90, 'USD')
      )
      await siteRepo.save(site1)

      const site2 = Site.create(
        'site-222',
        property2.id,
        'B1',
        'Beta Site 1',
        SiteType.CABIN,
        Pricing.create(100, 120, 'USD')
      )
      await siteRepo.save(site2)

      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guest1 = await guestCommand.execute({
        propertyId: property1.id,
        firstName: 'Alice',
        lastName: 'Alpha',
        email: 'alice@alpha.com',
        phone: '555-0001',
      })

      const guest2 = await guestCommand.execute({
        propertyId: property2.id,
        firstName: 'Bob',
        lastName: 'Beta',
        email: 'bob@beta.com',
        phone: '555-0002',
      })

      // Act: Query sites and guests for property 1
      const sitesQuery = new ListSitesQueryHandler(siteRepo)
      const property1Sites = await sitesQuery.execute({
        propertyId: property1.id,
      })

      const guestsQuery = new ListGuestsQueryHandler(guestRepo)
      const property1Guests = await guestsQuery.execute({
        propertyId: property1.id,
      })

      // Assert: Only property 1's data is returned (no cross-tenant leak)
      expect(property1Sites.sites).toHaveLength(1)
      expect(property1Sites.sites[0]!.id).toBe(site1.id)

      expect(property1Guests).toHaveLength(1)
      expect(property1Guests[0]!.id).toBe(guest1.id)

      // Verify property 2 isolation
      const property2Sites = await sitesQuery.execute({
        propertyId: property2.id,
      })
      const property2Guests = await guestsQuery.execute({
        propertyId: property2.id,
      })

      expect(property2Sites.sites).toHaveLength(1)
      expect(property2Sites.sites[0]!.id).toBe(site2.id)

      expect(property2Guests).toHaveLength(1)
      expect(property2Guests[0]!.id).toBe(guest2.id)
    })
  })

  // ==========================================================================
  // Module Independence Tests
  // ==========================================================================

  describe('Module Independence', () => {
    it('should allow sites to exist without guests', async () => {
      // Arrange: Create property with sites but no guests
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-sites-only',
        companyId: 'company-xyz',
        ownerId: 'owner-xyz',
        name: 'Sites Only Camp',
        slug: 'sites-only',
      })

      // Create multiple sites
      for (let i = 1; i <= 5; i++) {
        const site = Site.create(
          `site-${i}`,
          property.id,
          `A${i}`,
          `Site ${i}`,
          SiteType.TENT,
          Pricing.create(40 + i * 5, 50 + i * 5, 'USD')
        )
        await siteRepo.save(site)
      }

      // Act: Query sites and guests
      const sitesQuery = new ListSitesQueryHandler(siteRepo)
      const sites = await sitesQuery.execute({ propertyId: property.id })

      const guestsQuery = new ListGuestsQueryHandler(guestRepo)
      const guests = await guestsQuery.execute({ propertyId: property.id })

      // Assert: Sites exist, guests empty
      expect(sites.sites).toHaveLength(5)
      expect(guests).toHaveLength(0)
    })

    it('should allow guests to exist without sites (walk-in property)', async () => {
      // Arrange: Create property with guests but no sites
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-guests-only',
        companyId: 'company-abc',
        ownerId: 'owner-abc',
        name: 'Guest Registry Camp',
        slug: 'guest-registry',
      })

      // Create multiple guests
      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      for (let i = 1; i <= 3; i++) {
        await guestCommand.execute({
          propertyId: property.id,
          firstName: `Guest${i}`,
          lastName: 'LastName',
          email: `guest${i}@example.com`,
          phone: `555-000${i}`,
        })
      }

      // Act: Query sites and guests
      const sitesQuery = new ListSitesQueryHandler(siteRepo)
      const sites = await sitesQuery.execute({ propertyId: property.id })

      const guestsQuery = new ListGuestsQueryHandler(guestRepo)
      const guests = await guestsQuery.execute({ propertyId: property.id })

      // Assert: Guests exist, sites empty
      expect(sites.sites).toHaveLength(0)
      expect(guests).toHaveLength(3)
    })

    it('should not create direct coupling between Guest and Site modules', async () => {
      // This test validates that Guest and Site modules remain independent
      // They only share the propertyId reference, no direct object references

      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-independence',
        companyId: 'company-test',
        ownerId: 'owner-test',
        name: 'Independence Test',
        slug: 'independence-test',
      })

      const site = Site.create(
        'site-independent',
        property.id,
        'Z1',
        'Independent Site',
        SiteType.RV,
        Pricing.create(65, 75, 'USD')
      )
      await siteRepo.save(site)

      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guest = await guestCommand.execute({
        propertyId: property.id,
        firstName: 'Independent',
        lastName: 'Guest',
        email: 'independent@example.com',
        phone: '555-9999',
      })

      // Assert: Both modules only know about propertyId, not each other
      expect(site.propertyId).toBe(property.id)
      expect(guest.propertyId).toBe(property.id)

      // Site doesn't know about Guest (no guestId property)
      expect((site as any).guestId).toBeUndefined()

      // Guest doesn't know about Site (no siteId property)
      expect((guest as any).siteId).toBeUndefined()

      // NOTE: Future Reservation module (Week 9-10) will link these entities
      // Reservation will have BOTH guestId and siteId to connect them
    })
  })

  // ==========================================================================
  // Future Reservation Foundation Tests
  // ==========================================================================

  describe('Future Reservation Foundation', () => {
    it('should provide foundation for guest-site-property relationship through future Reservation module', async () => {
      // This test documents the architecture for the future Reservation module

      // Arrange: Create property, site, and guest
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-reservation-ready',
        companyId: 'company-res',
        ownerId: 'owner-res',
        name: 'Reservation Ready Camp',
        slug: 'reservation-ready',
      })

      const site = Site.create(
        'site-res-001',
        property.id,
        'R1',
        'Reservation Site 1',
        SiteType.RV,
        Pricing.create(80, 95, 'USD')
      )
      await siteRepo.save(site)

      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guest = await guestCommand.execute({
        propertyId: property.id,
        firstName: 'Future',
        lastName: 'Booker',
        email: 'future@booking.com',
        phone: '555-BOOK',
      })

      // Act: Verify all entities exist and are correctly scoped
      expect(property.id).toBe('prop-reservation-ready')
      expect(site.propertyId).toBe(property.id)
      expect(guest.propertyId).toBe(property.id)

      // Assert: Document future Reservation structure
      // Future Reservation aggregate will look like:
      const futureReservationStructure = {
        id: 'reservation-001',
        propertyId: property.id, // Multi-tenant isolation
        siteId: site.id, // Links to Site module
        guestId: guest.id, // Links to Guest module
        checkIn: '2025-12-01',
        checkOut: '2025-12-05',
        status: 'CONFIRMED',
        // ... other reservation fields
      }

      // Verify the structure makes sense
      expect(futureReservationStructure.propertyId).toBe(site.propertyId)
      expect(futureReservationStructure.propertyId).toBe(guest.propertyId)
      expect(futureReservationStructure.siteId).toBe(site.id)
      expect(futureReservationStructure.guestId).toBe(guest.id)
    })

    it('should support multiple guests booking multiple sites at same property', async () => {
      // Realistic scenario: Group camping trip

      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-group-camp',
        companyId: 'company-group',
        ownerId: 'owner-group',
        name: 'Group Camping Paradise',
        slug: 'group-camp',
      })

      // Create 3 sites
      const sites = []
      for (let i = 1; i <= 3; i++) {
        const site = Site.create(
          `site-group-${i}`,
          property.id,
          `G${i}`,
          `Group Site ${i}`,
          SiteType.TENT,
          Pricing.create(45, 55, 'USD')
        )
        await siteRepo.save(site)
        sites.push(site)
      }

      // Create 2 guests (family members)
      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      const guests = []
      guests.push(
        await guestCommand.execute({
          propertyId: property.id,
          firstName: 'Parent',
          lastName: 'Smith',
          email: 'parent@smith.com',
          phone: '555-0010',
        })
      )
      guests.push(
        await guestCommand.execute({
          propertyId: property.id,
          firstName: 'Adult',
          lastName: 'Smith',
          email: 'adult@smith.com',
          phone: '555-0011',
        })
      )

      // Assert: All entities exist and can be queried
      const sitesQuery = new ListSitesQueryHandler(siteRepo)
      const sitesResult = await sitesQuery.execute({ propertyId: property.id })
      expect(sitesResult.sites).toHaveLength(3)

      const guestsQuery = new ListGuestsQueryHandler(guestRepo)
      const guestsList = await guestsQuery.execute({ propertyId: property.id })
      expect(guestsList).toHaveLength(2)

      // All share same propertyId (multi-tenant boundary)
      expect(
        sitesResult.sites.every((s) => s.propertyId === property.id)
      ).toBe(true)
      expect(guestsList.every((g) => g.propertyId === property.id)).toBe(true)

      // Future: Reservation module would create 3 reservations:
      // - 2 reservations for Parent (2 sites)
      // - 1 reservation for Adult (1 site)
      // All scoped to same property for group trip
    })
  })

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle property with many sites and many guests', async () => {
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-large',
        companyId: 'company-large',
        ownerId: 'owner-large',
        name: 'Large Resort',
        slug: 'large-resort',
      })

      // Create 20 sites
      for (let i = 1; i <= 20; i++) {
        const site = Site.create(
          `site-large-${i}`,
          property.id,
          `L${i}`,
          `Large Site ${i}`,
          i % 2 === 0 ? SiteType.RV : SiteType.TENT,
          Pricing.create(50 + i, 60 + i, 'USD')
        )
        await siteRepo.save(site)
      }

      // Create 15 guests
      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      for (let i = 1; i <= 15; i++) {
        await guestCommand.execute({
          propertyId: property.id,
          firstName: `LargeGuest${i}`,
          lastName: 'LastName',
          email: `large${i}@example.com`,
          phone: `555-${i.toString().padStart(4, '0')}`,
        })
      }

      // Query all sites and guests
      const sitesQuery = new ListSitesQueryHandler(siteRepo)
      const sites = await sitesQuery.execute({ propertyId: property.id })

      const guestsQuery = new ListGuestsQueryHandler(guestRepo)
      const guests = await guestsQuery.execute({ propertyId: property.id })

      // Assert: All data retrieved correctly
      expect(sites.sites).toHaveLength(20)
      expect(guests).toHaveLength(15)
    })

    it('should allow site filtering without affecting guest queries', async () => {
      const propertyCommand = new CreatePropertyCommandHandler(propertyRepo)
      const property = await propertyCommand.execute({
        id: 'prop-filter',
        companyId: 'company-filter',
        ownerId: 'owner-filter',
        name: 'Filter Test Camp',
        slug: 'filter-test',
      })

      // Create sites with different statuses
      const availableSite = Site.create(
        'site-available',
        property.id,
        'A1',
        'Available Site',
        SiteType.TENT,
        Pricing.create(40, 50, 'USD'),
        { status: SiteStatus.AVAILABLE }
      )
      await siteRepo.save(availableSite)

      const occupiedSite = Site.create(
        'site-occupied',
        property.id,
        'A2',
        'Occupied Site',
        SiteType.RV,
        Pricing.create(70, 85, 'USD')
      )
      occupiedSite.markAsOccupied()
      await siteRepo.save(occupiedSite)

      // Create guests
      const guestCommand = new CreateGuestCommandHandler(guestRepo, eventBus)
      await guestCommand.execute({
        propertyId: property.id,
        firstName: 'Filter',
        lastName: 'Tester',
        email: 'filter@test.com',
        phone: '555-FILT',
      })

      // Query with filter
      const sitesQuery = new ListSitesQueryHandler(siteRepo)
      const availableSites = await sitesQuery.execute({
        propertyId: property.id,
        availableOnly: true,
      })

      const guestsQuery = new ListGuestsQueryHandler(guestRepo)
      const guests = await guestsQuery.execute({ propertyId: property.id })

      // Assert: Site filter works, guest query unaffected
      expect(availableSites.sites).toHaveLength(1)
      expect(availableSites.sites[0]!.status).toBe(SiteStatus.AVAILABLE)
      expect(guests).toHaveLength(1) // All guests returned regardless of site filters
    })
  })
})
