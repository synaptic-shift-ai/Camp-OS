/**
 * ListSitesQuery Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ListSitesQueryHandler } from '../ListSitesQuery'
import { ISiteRepository } from '../../../domain/ISiteRepository'
import { Site } from '../../../domain/Site'
import { SiteType } from '../../../domain/SiteType'
import { SiteStatus } from '../../../domain/SiteStatus'
import { Pricing } from '../../../domain/Pricing'

// Mock repository with filter support
class MockSiteRepository implements ISiteRepository {
  private sites: Map<string, Site> = new Map()

  async findById(id: string): Promise<Site | null> {
    return this.sites.get(id) || null
  }

  async findBySiteNumber(propertyId: string, siteNumber: string): Promise<Site | null> {
    return (
      Array.from(this.sites.values()).find(
        (s) => s.propertyId === propertyId && s.siteNumber === siteNumber
      ) || null
    )
  }

  async findByPropertyId(propertyId: string): Promise<Site[]> {
    return Array.from(this.sites.values()).filter((s) => s.propertyId === propertyId)
  }

  async findByPropertyIdWithFilters(
    propertyId: string,
    filters: {
      status?: SiteStatus
      siteType?: string
      availableOnly?: boolean
      limit?: number
      offset?: number
    }
  ): Promise<{ sites: Site[]; total: number }> {
    let sites = Array.from(this.sites.values()).filter((s) => s.propertyId === propertyId)

    // Apply status filter
    if (filters.status) {
      sites = sites.filter((s) => s.status === filters.status)
    }

    // Apply site type filter
    if (filters.siteType) {
      sites = sites.filter((s) => s.siteType === filters.siteType)
    }

    // Apply availability filter
    if (filters.availableOnly) {
      sites = sites.filter((s) => s.isAvailableForBooking())
    }

    const total = sites.length

    // Apply pagination
    if (filters.offset !== undefined) {
      sites = sites.slice(filters.offset)
    }
    if (filters.limit !== undefined) {
      sites = sites.slice(0, filters.limit)
    }

    return { sites, total }
  }

  async save(site: Site): Promise<void> {
    this.sites.set(site.id, site)
  }

  async delete(id: string): Promise<void> {
    this.sites.delete(id)
  }

  async existsBySiteNumber(propertyId: string, siteNumber: string): Promise<boolean> {
    const site = await this.findBySiteNumber(propertyId, siteNumber)
    return site !== null
  }

  async findAvailableSites(propertyId: string): Promise<Site[]> {
    const allSites = await this.findByPropertyId(propertyId)
    return allSites.filter((s) => s.isAvailableForBooking())
  }

  seedSite(site: Site): void {
    this.sites.set(site.id, site)
  }

  clear(): void {
    this.sites.clear()
  }
}

describe('ListSitesQuery', () => {
  let repository: MockSiteRepository
  let handler: ListSitesQueryHandler
  const pricing = Pricing.create(7500, 9000, 'USD')

  beforeEach(() => {
    repository = new MockSiteRepository()
    handler = new ListSitesQueryHandler(repository)

    // Seed test data
    const site1 = Site.create('site-1', 'prop-1', '1', 'Tent Site 1', SiteType.TENT, pricing)
    const site2 = Site.create('site-2', 'prop-1', '2', 'RV Site 1', SiteType.RV, pricing)
    const site3 = Site.create('site-3', 'prop-1', '3', 'Cabin 1', SiteType.CABIN, pricing)
    const site4 = Site.create('site-4', 'prop-2', '4', 'Tent Site 2', SiteType.TENT, pricing)

    site2.markAsOccupied()
    site3.markAsOutOfService()

    repository.seedSite(site1)
    repository.seedSite(site2)
    repository.seedSite(site3)
    repository.seedSite(site4)
  })

  describe('list all sites', () => {
    it('should list all sites for a property', async () => {
      const result = await handler.execute({ propertyId: 'prop-1' })

      expect(result.sites).toHaveLength(3)
      expect(result.total).toBe(3)
    })

    it('should return empty array if property has no sites', async () => {
      const result = await handler.execute({ propertyId: 'prop-999' })

      expect(result.sites).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('should only return sites for specified property', async () => {
      const result = await handler.execute({ propertyId: 'prop-2' })

      expect(result.sites).toHaveLength(1)
      expect(result.sites[0]!.id).toBe('site-4')
    })
  })

  describe('filter by status', () => {
    it('should filter by AVAILABLE status', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        status: SiteStatus.AVAILABLE,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.sites[0]!.status).toBe(SiteStatus.AVAILABLE)
    })

    it('should filter by OCCUPIED status', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        status: SiteStatus.OCCUPIED,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.sites[0]!.status).toBe(SiteStatus.OCCUPIED)
      expect(result.sites[0]!.id).toBe('site-2')
    })

    it('should filter by OUT_OF_SERVICE status', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        status: SiteStatus.OUT_OF_SERVICE,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.sites[0]!.status).toBe(SiteStatus.OUT_OF_SERVICE)
      expect(result.sites[0]!.id).toBe('site-3')
    })

    it('should return empty array if no sites match status', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        status: SiteStatus.NEEDS_HOUSEKEEPING,
      })

      expect(result.sites).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  describe('filter by site type', () => {
    it('should filter by TENT type', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        siteType: SiteType.TENT,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.sites[0]!.siteType).toBe(SiteType.TENT)
    })

    it('should filter by RV_FULL_HOOKUP type', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        siteType: SiteType.RV,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.sites[0]!.siteType).toBe(SiteType.RV)
    })

    it('should filter by CABIN type', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        siteType: SiteType.CABIN,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.sites[0]!.siteType).toBe(SiteType.CABIN)
    })
  })

  describe('filter by availability', () => {
    it('should return only available sites', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        availableOnly: true,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.sites[0]?.isAvailableForBooking()).toBe(true)
    })

    it('should exclude occupied sites when availableOnly is true', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        availableOnly: true,
      })

      const occupiedSites = result.sites.filter((s) => s.status === SiteStatus.OCCUPIED)
      expect(occupiedSites).toHaveLength(0)
    })

    it('should exclude out of service sites when availableOnly is true', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        availableOnly: true,
      })

      const outOfServiceSites = result.sites.filter((s) => s.status === SiteStatus.OUT_OF_SERVICE)
      expect(outOfServiceSites).toHaveLength(0)
    })
  })

  describe('combined filters', () => {
    it('should filter by status and type together', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        status: SiteStatus.AVAILABLE,
        siteType: SiteType.TENT,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.sites[0]!.status).toBe(SiteStatus.AVAILABLE)
      expect(result.sites[0]!.siteType).toBe(SiteType.TENT)
    })

    it('should filter by type and availability', async () => {
      // Add more test data
      const newSite = Site.create('site-5', 'prop-1', '5', 'Tent Site 3', SiteType.TENT, pricing)
      repository.seedSite(newSite)

      const result = await handler.execute({
        propertyId: 'prop-1',
        siteType: SiteType.TENT,
        availableOnly: true,
      })

      expect(result.sites.length).toBeGreaterThan(0)
      result.sites.forEach((site) => {
        expect(site.siteType).toBe(SiteType.TENT)
        expect(site.isAvailableForBooking()).toBe(true)
      })
    })
  })

  describe('pagination', () => {
    beforeEach(() => {
      // Add more sites for pagination testing
      repository.clear()
      for (let i = 1; i <= 20; i++) {
        const site = Site.create(`site-${i}`, 'prop-1', `${i}`, `Site ${i}`, SiteType.TENT, pricing)
        repository.seedSite(site)
      }
    })

    it('should limit results', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        limit: 5,
      })

      expect(result.sites).toHaveLength(5)
      expect(result.total).toBe(20)
    })

    it('should offset results', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        offset: 10,
      })

      expect(result.sites).toHaveLength(10) // 20 - 10 offset
      expect(result.total).toBe(20)
    })

    it('should apply both limit and offset', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        limit: 5,
        offset: 10,
      })

      expect(result.sites).toHaveLength(5)
      expect(result.total).toBe(20)
    })

    it('should handle offset beyond total', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        offset: 100,
      })

      expect(result.sites).toHaveLength(0)
      expect(result.total).toBe(20)
    })

    it('should handle limit larger than total', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        limit: 100,
      })

      expect(result.sites).toHaveLength(20)
      expect(result.total).toBe(20)
    })

    it('should paginate through all results', async () => {
      const pageSize = 5
      const allSites: Site[] = []

      for (let page = 0; page < 4; page++) {
        const result = await handler.execute({
          propertyId: 'prop-1',
          limit: pageSize,
          offset: page * pageSize,
        })
        allSites.push(...result.sites)
      }

      expect(allSites).toHaveLength(20)
    })
  })

  describe('edge cases', () => {
    it('should handle property with no sites', async () => {
      const result = await handler.execute({ propertyId: 'non-existent' })

      expect(result.sites).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('should handle zero limit', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        limit: 0,
      })

      expect(result.sites).toHaveLength(0)
    })

    it('should handle negative offset gracefully', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        offset: -1,
      })

      // Should treat as 0 or handle gracefully
      expect(result.sites.length).toBeGreaterThan(0)
    })

    it('should return correct total even with filters', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        limit: 1,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.total).toBeGreaterThan(1) // Total should reflect all matching, not just returned
    })
  })

  describe('result structure', () => {
    it('should return sites array and total count', async () => {
      const result = await handler.execute({ propertyId: 'prop-1' })

      expect(result).toHaveProperty('sites')
      expect(result).toHaveProperty('total')
      expect(Array.isArray(result.sites)).toBe(true)
      expect(typeof result.total).toBe('number')
    })

    it('should return Site entities with full properties', async () => {
      const result = await handler.execute({ propertyId: 'prop-1' })

      const site = result.sites[0]
      expect(site).toHaveProperty('id')
      expect(site).toHaveProperty('propertyId')
      expect(site).toHaveProperty('siteNumber')
      expect(site).toHaveProperty('siteName')
      expect(site).toHaveProperty('siteType')
      expect(site).toHaveProperty('status')
      expect(site).toHaveProperty('pricing')
    })

    it('should return sites with business logic methods', async () => {
      const result = await handler.execute({ propertyId: 'prop-1' })

      const site = result.sites[0]
      expect(site).toBeDefined()
      expect(typeof site?.isAvailableForBooking).toBe('function')
      expect(typeof site?.canAccommodate).toBe('function')
    })
  })

  describe('real-world scenarios', () => {
    it('should get available RV sites for booking UI', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        siteType: SiteType.RV,
        availableOnly: true,
      })

      // Should return only available RV sites
      expect(result.sites.every((s) => s.siteType === SiteType.RV)).toBe(true)
      expect(result.sites.every((s) => s.isAvailableForBooking())).toBe(true)
    })

    it('should get sites needing housekeeping for staff dashboard', async () => {
      // Add site needing housekeeping
      const site = Site.create('site-hk', 'prop-1', 'HK-1', 'Housekeeping Site', SiteType.TENT, pricing)
      site.markAsNeedsHousekeeping()
      repository.seedSite(site)

      const result = await handler.execute({
        propertyId: 'prop-1',
        status: SiteStatus.NEEDS_HOUSEKEEPING,
      })

      expect(result.sites.length).toBeGreaterThan(0)
      expect(result.sites.every((s) => s.status === SiteStatus.NEEDS_HOUSEKEEPING)).toBe(true)
    })

    it('should paginate through all sites for admin panel', async () => {
      const result = await handler.execute({
        propertyId: 'prop-1',
        limit: 10,
        offset: 0,
      })

      expect(result.sites.length).toBeLessThanOrEqual(10)
      expect(result.total).toBeGreaterThanOrEqual(result.sites.length)
    })
  })
})
