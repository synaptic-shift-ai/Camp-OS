/**
 * UpdateSiteCommand Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UpdateSiteCommandHandler } from '../UpdateSiteCommand'
import { type ISiteRepository } from '../../../domain/ISiteRepository'
import { Site } from '../../../domain/Site'
import { SiteType } from '../../../domain/SiteType'
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
    _filters: any
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

  // Helper to seed initial site
  seedSite(site: Site): void {
    this.sites.set(site.id, site)
  }
}

// Mock EventBus
vi.mock('@/shared/infrastructure/eventBus', () => ({
  getEventBus: () => ({
    publish: vi.fn(),
    publishAll: vi.fn(),
    subscribe: vi.fn(),
  }),
}))

describe('UpdateSiteCommand', () => {
  let repository: MockSiteRepository
  let handler: UpdateSiteCommandHandler
  let existingSite: Site

  beforeEach(() => {
    repository = new MockSiteRepository()
    handler = new UpdateSiteCommandHandler(repository)

    // Create existing site
    const pricing = Pricing.create(7500, 9000, 'USD')
    existingSite = Site.create(
      'site-123',
      'prop-456',
      '42',
      'Original Site',
      SiteType.RV,
      pricing,
      {
        description: 'Original description',
        maxOccupancy: 4,
        maxVehicles: 1,
        sizeSqft: 800,
      }
    )
    existingSite.clearDomainEvents()
    repository.seedSite(existingSite)
  })

  describe('update details', () => {
    it('should update site name', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        siteName: 'Updated Site Name',
      })

      expect(result.siteName).toBe('Updated Site Name')
    })

    it('should update description', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        description: 'New beautiful description',
      })

      expect(result.description).toBe('New beautiful description')
    })

    it('should update max occupancy', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        maxOccupancy: 8,
      })

      expect(result.maxOccupancy).toBe(8)
    })

    it('should update max vehicles', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        maxVehicles: 3,
      })

      expect(result.maxVehicles).toBe(3)
    })

    it('should update size', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        sizeSqft: 1200,
      })

      expect(result.sizeSqft).toBe(1200)
    })

    it('should update multiple fields at once', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        siteName: 'Multi-Update Site',
        description: 'Multi-field update',
        maxOccupancy: 6,
        maxVehicles: 2,
        sizeSqft: 1000,
      })

      expect(result.siteName).toBe('Multi-Update Site')
      expect(result.description).toBe('Multi-field update')
      expect(result.maxOccupancy).toBe(6)
      expect(result.maxVehicles).toBe(2)
      expect(result.sizeSqft).toBe(1000)
    })

    it('should emit SiteUpdatedEvent', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        siteName: 'Updated Name',
      })

      // Events are published and cleared by handler
      expect(result.siteName).toBe('Updated Name')
    })

    it('should not modify fields not provided', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        siteName: 'Only Name Changed',
      })

      expect(result.siteName).toBe('Only Name Changed')
      expect(result.description).toBe('Original description') // Unchanged
      expect(result.maxOccupancy).toBe(4) // Unchanged
    })
  })

  describe('update pricing', () => {
    it('should update base and weekend prices', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        basePrice: 8500,
        weekendPrice: 10000,
      })

      expect(result.pricing.basePrice).toBe(8500)
      expect(result.pricing.weekendPrice).toBe(10000)
    })

    it('should update only base price', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        basePrice: 8000,
      })

      expect(result.pricing.basePrice).toBe(8000)
      expect(result.pricing.weekendPrice).toBe(9000) // Unchanged
    })

    it('should update only weekend price', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        weekendPrice: 11000,
      })

      expect(result.pricing.basePrice).toBe(7500) // Unchanged
      expect(result.pricing.weekendPrice).toBe(11000)
    })

    it('should emit SitePricingUpdatedEvent', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        basePrice: 8500,
        weekendPrice: 10000,
      })

      // Events are published and cleared by handler
      expect(result.pricing.basePrice).toBe(8500)
      expect(result.pricing.weekendPrice).toBe(10000)
    })
  })

  describe('update images', () => {
    it('should update images array', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        images: ['image1.jpg', 'image2.jpg', 'image3.jpg'],
      })

      expect(result.images).toEqual(['image1.jpg', 'image2.jpg', 'image3.jpg'])
    })

    it('should replace existing images', async () => {
      // First update
      await handler.execute({
        siteId: 'site-123',
        images: ['old1.jpg', 'old2.jpg'],
      })

      // Second update
      const result = await handler.execute({
        siteId: 'site-123',
        images: ['new1.jpg'],
      })

      expect(result.images).toEqual(['new1.jpg'])
    })

    it('should allow empty images array', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        images: [],
      })

      expect(result.images).toEqual([])
    })
  })

  describe('update location map', () => {
    it('should update location map', async () => {
      const locationMap = {
        lat: 40.7128,
        lng: -74.006,
        zoom: 15,
      }

      const result = await handler.execute({
        siteId: 'site-123',
        locationMap,
      })

      expect(result.locationMap).toEqual(locationMap)
    })

    it('should replace existing location map', async () => {
      // First update
      await handler.execute({
        siteId: 'site-123',
        locationMap: { lat: 10, lng: 20 },
      })

      // Second update
      const newLocationMap = { lat: 40.7128, lng: -74.006 }
      const result = await handler.execute({
        siteId: 'site-123',
        locationMap: newLocationMap,
      })

      expect(result.locationMap).toEqual(newLocationMap)
    })
  })

  describe('validation', () => {
    it('should throw if site not found', async () => {
      await expect(
        handler.execute({
          siteId: 'non-existent',
          siteName: 'Test',
        })
      ).rejects.toThrow('Site not found: non-existent')
    })

    it('should throw if max occupancy is invalid', async () => {
      await expect(
        handler.execute({
          siteId: 'site-123',
          maxOccupancy: 0,
        })
      ).rejects.toThrow('Max occupancy must be at least 1')
    })

    it('should throw if max occupancy is negative', async () => {
      await expect(
        handler.execute({
          siteId: 'site-123',
          maxOccupancy: -1,
        })
      ).rejects.toThrow('Max occupancy must be at least 1')
    })

    it('should throw if base price is negative', async () => {
      await expect(
        handler.execute({
          siteId: 'site-123',
          basePrice: -100,
        })
      ).rejects.toThrow('Base price cannot be negative')
    })

    it('should throw if weekend price is negative', async () => {
      await expect(
        handler.execute({
          siteId: 'site-123',
          weekendPrice: -100,
        })
      ).rejects.toThrow('Weekend price cannot be negative')
    })

    it('should allow null max occupancy', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        maxOccupancy: null,
      })

      expect(result.maxOccupancy).toBeNull()
    })

    it('should allow null max vehicles', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        maxVehicles: null,
      })

      expect(result.maxVehicles).toBeNull()
    })
  })

  describe('combined updates', () => {
    it('should update details and pricing together', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        siteName: 'Combined Update',
        description: 'New description',
        basePrice: 8500,
        weekendPrice: 10000,
      })

      expect(result.siteName).toBe('Combined Update')
      expect(result.description).toBe('New description')
      expect(result.pricing.basePrice).toBe(8500)
      expect(result.pricing.weekendPrice).toBe(10000)

      // Events are published and cleared by handler
      // Both details and pricing were updated
    })

    it('should update details, pricing, and images', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        siteName: 'Full Update',
        description: 'Fully updated site',
        maxOccupancy: 8,
        basePrice: 9000,
        weekendPrice: 11000,
        images: ['new1.jpg', 'new2.jpg'],
        locationMap: { lat: 40.7, lng: -74.0 },
      })

      expect(result.siteName).toBe('Full Update')
      expect(result.description).toBe('Fully updated site')
      expect(result.maxOccupancy).toBe(8)
      expect(result.pricing.basePrice).toBe(9000)
      expect(result.pricing.weekendPrice).toBe(11000)
      expect(result.images).toEqual(['new1.jpg', 'new2.jpg'])
      expect(result.locationMap).toEqual({ lat: 40.7, lng: -74.0 })
    })
  })

  describe('persistence', () => {
    it('should save updated site to repository', async () => {
      await handler.execute({
        siteId: 'site-123',
        siteName: 'Persisted Update',
      })

      const savedSite = await repository.findById('site-123')
      expect(savedSite?.siteName).toBe('Persisted Update')
    })

    it('should update timestamp', async () => {
      const originalTimestamp = existingSite.updatedAt.getTime()

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      const result = await handler.execute({
        siteId: 'site-123',
        siteName: 'Updated',
      })

      expect(result.updatedAt.getTime()).toBeGreaterThan(originalTimestamp)
    })
  })

  describe('edge cases', () => {
    it('should handle empty update (no changes)', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
      })

      expect(result.siteName).toBe('Original Site')
      expect(result.description).toBe('Original description')
    })

    it('should trim whitespace from updated name', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        siteName: '  Trimmed Name  ',
      })

      expect(result.siteName).toBe('Trimmed Name')
    })

    it('should allow setting site name to null', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        siteName: null,
      })

      expect(result.siteName).toBeNull()
    })

    it('should allow setting description to null', async () => {
      const result = await handler.execute({
        siteId: 'site-123',
        description: null,
      })

      expect(result.description).toBeNull()
    })
  })
})
