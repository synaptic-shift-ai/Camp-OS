/**
 * GetSiteQuery Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { GetSiteQueryHandler } from '../GetSiteQuery'
import { ISiteRepository } from '../../../domain/ISiteRepository'
import { Site } from '../../../domain/Site'
import { SiteType } from '../../../domain/SiteType'
import { SiteStatus } from '../../../domain/SiteStatus'
import { Pricing } from '../../../domain/Pricing'

// Mock repository
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
    filters: any
  ): Promise<{ sites: Site[]; total: number }> {
    const sites = await this.findByPropertyId(propertyId)
    return { sites, total: sites.length }
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
}

describe('GetSiteQuery', () => {
  let repository: MockSiteRepository
  let handler: GetSiteQueryHandler

  beforeEach(() => {
    repository = new MockSiteRepository()
    handler = new GetSiteQueryHandler(repository)
  })

  describe('findById', () => {
    it('should return site when found', async () => {
      // Seed a site
      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Test Site', SiteType.RV_FULL_HOOKUP, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result).not.toBeNull()
      expect(result?.id).toBe('site-123')
      expect(result?.propertyId).toBe('prop-456')
      expect(result?.siteNumber).toBe('42')
      expect(result?.siteName).toBe('Test Site')
    })

    it('should return null when site not found', async () => {
      const result = await handler.execute({ siteId: 'non-existent' })

      expect(result).toBeNull()
    })

    it('should return site with all properties', async () => {
      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Full Site', SiteType.RV_FULL_HOOKUP, pricing, {
        description: 'Beautiful lakeside site',
        maxOccupancy: 6,
        maxVehicles: 2,
        sizeSqft: 1000,
        amenities: ['picnic_table', 'fire_ring'],
        hookups: ['water', 'electric', 'sewer'],
      })
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result).not.toBeNull()
      expect(result?.description).toBe('Beautiful lakeside site')
      expect(result?.maxOccupancy).toBe(6)
      expect(result?.maxVehicles).toBe(2)
      expect(result?.sizeSqft).toBe(1000)
      expect(result?.amenities).toEqual(['picnic_table', 'fire_ring'])
      expect(result?.hookups).toEqual(['water', 'electric', 'sewer'])
    })

    it('should return site with pricing information', async () => {
      const pricing = Pricing.create(7599, 9050, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Test Site', SiteType.TENT, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result).not.toBeNull()
      expect(result?.pricing.basePrice).toBe(7599)
      expect(result?.pricing.weekendPrice).toBe(9050)
      expect(result?.pricing.currency).toBe('USD')
      expect(result?.pricing.formatBasePrice()).toBe('$75.99')
    })

    it('should return site with correct status', async () => {
      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Test Site', SiteType.TENT, pricing)
      site.markAsOccupied()
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result).not.toBeNull()
      expect(result?.status).toBe(SiteStatus.OCCUPIED) // 'occupied'
    })
  })

  describe('multiple sites', () => {
    it('should return correct site among multiple', async () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      // Seed multiple sites
      const site1 = Site.create('site-1', 'prop-456', '1', 'Site 1', SiteType.TENT, pricing)
      const site2 = Site.create('site-2', 'prop-456', '2', 'Site 2', SiteType.RV_FULL_HOOKUP, pricing)
      const site3 = Site.create('site-3', 'prop-456', '3', 'Site 3', SiteType.CABIN, pricing)

      repository.seedSite(site1)
      repository.seedSite(site2)
      repository.seedSite(site3)

      // Query for site-2
      const result = await handler.execute({ siteId: 'site-2' })

      expect(result).not.toBeNull()
      expect(result?.id).toBe('site-2')
      expect(result?.siteName).toBe('Site 2')
      expect(result?.siteType).toBe(SiteType.RV_FULL_HOOKUP)
    })

    it('should return null for non-existent site among many', async () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      // Seed sites
      const site1 = Site.create('site-1', 'prop-456', '1', 'Site 1', SiteType.TENT, pricing)
      const site2 = Site.create('site-2', 'prop-456', '2', 'Site 2', SiteType.TENT, pricing)

      repository.seedSite(site1)
      repository.seedSite(site2)

      const result = await handler.execute({ siteId: 'site-99' })

      expect(result).toBeNull()
    })
  })

  describe('different site types', () => {
    it('should return tent site', async () => {
      const pricing = Pricing.create(3000, 4000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Tent Site', SiteType.TENT, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.siteType).toBe(SiteType.TENT)
    })

    it('should return RV site with full hookup', async () => {
      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'RV Site', SiteType.RV_FULL_HOOKUP, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.siteType).toBe(SiteType.RV_FULL_HOOKUP)
    })

    it('should return cabin site', async () => {
      const pricing = Pricing.create(15000, 18000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Cozy Cabin', SiteType.CABIN, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.siteType).toBe(SiteType.CABIN)
    })
  })

  describe('edge cases', () => {
    it('should handle site with null optional fields', async () => {
      const pricing = Pricing.create(5000, 6000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', null, SiteType.TENT, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result).not.toBeNull()
      expect(result?.siteName).toBeNull()
      expect(result?.description).toBeNull()
    })

    it('should handle site with empty arrays', async () => {
      const pricing = Pricing.create(5000, 6000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Test', SiteType.TENT, pricing, {
        amenities: [],
        hookups: [],
      })
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.amenities).toEqual([])
      expect(result?.hookups).toEqual([])
    })

    it('should handle site with zero prices', async () => {
      const pricing = Pricing.create(0, 0, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Free Site', SiteType.TENT, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.pricing.basePrice).toBe(0)
      expect(result?.pricing.weekendPrice).toBe(0)
    })

    it('should handle very long site names', async () => {
      const pricing = Pricing.create(5000, 6000, 'USD')
      const longName = 'A'.repeat(255)
      const site = Site.create('site-123', 'prop-456', '42', longName, SiteType.TENT, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.siteName).toBe(longName)
      expect(result?.siteName?.length).toBe(255)
    })

    it('should handle alphanumeric site numbers', async () => {
      const pricing = Pricing.create(5000, 6000, 'USD')
      const site = Site.create('site-123', 'prop-456', 'A-42-B', 'Test', SiteType.TENT, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.siteNumber).toBe('A-42-B')
    })
  })

  describe('business logic', () => {
    it('should return site with availability status', async () => {
      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Test', SiteType.RV_FULL_HOOKUP, pricing)
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.isAvailableForBooking()).toBe(true)
    })

    it('should return site that is not available for booking', async () => {
      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Test', SiteType.RV_FULL_HOOKUP, pricing)
      site.markAsOccupied()
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.isAvailableForBooking()).toBe(false)
    })

    it('should return site with capacity check capability', async () => {
      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Test', SiteType.RV_FULL_HOOKUP, pricing, {
        maxOccupancy: 6,
        maxVehicles: 2,
      })
      repository.seedSite(site)

      const result = await handler.execute({ siteId: 'site-123' })

      expect(result?.canAccommodate(4, 1)).toBe(true)
      expect(result?.canAccommodate(7, 1)).toBe(false)
      expect(result?.canAccommodate(4, 3)).toBe(false)
    })
  })
})
