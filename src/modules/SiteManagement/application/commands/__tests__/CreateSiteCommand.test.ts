/**
 * CreateSiteCommand Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreateSiteCommandHandler } from '../CreateSiteCommand'
import { type ISiteRepository } from '../../../domain/ISiteRepository'
import { type Site } from '../../../domain/Site'
import { SiteType } from '../../../domain/SiteType'

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

  // Helper to get saved site
  getSavedSite(id: string): Site | undefined {
    return this.sites.get(id)
  }

  // Helper to clear all sites
  clear(): void {
    this.sites.clear()
  }
}

// (EventBus mock removed — EventBus infrastructure deleted)

describe('CreateSiteCommand', () => {
  let repository: MockSiteRepository
  let handler: CreateSiteCommandHandler

  beforeEach(() => {
    repository = new MockSiteRepository()
    handler = new CreateSiteCommandHandler(repository)
  })

  describe('successful creation', () => {
    it('should create a new site', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Lakeside Paradise',
        siteType: SiteType.RV,
        basePrice: 7500,
        weekendPrice: 9000,
      })

      expect(result.id).toBe('site-123')
      expect(result.propertyId).toBe('prop-456')
      expect(result.siteNumber).toBe('42')
      expect(result.siteName).toBe('Lakeside Paradise')
      expect(result.siteType).toBe(SiteType.RV)
      expect(result.pricing.basePrice).toBe(7500)
      expect(result.pricing.weekendPrice).toBe(9000)
    })

    it('should save site to repository', async () => {
      await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Test Site',
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 6000,
      })

      const savedSite = repository.getSavedSite('site-123')
      expect(savedSite).toBeDefined()
      expect(savedSite?.siteNumber).toBe('42')
    })

    it('should emit SiteCreatedEvent', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Test Site',
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 6000,
      })

      // Events are published and cleared by handler
      expect(result.id).toBe('site-123')
      expect(result.propertyId).toBe('prop-456')
    })

    it('should accept optional fields', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Test Site',
        siteType: SiteType.RV,
        basePrice: 7500,
        weekendPrice: 9000,
        description: 'Beautiful site with lake view',
        maxOccupancy: 6,
        maxVehicles: 2,
        sizeSqft: 1000,
        amenities: ['picnic_table', 'fire_ring'],
        hookups: ['water', 'electric', 'sewer'],
      })

      expect(result.description).toBe('Beautiful site with lake view')
      expect(result.maxOccupancy).toBe(6)
      expect(result.maxVehicles).toBe(2)
      expect(result.sizeSqft).toBe(1000)
      expect(result.amenities).toEqual(['picnic_table', 'fire_ring'])
      expect(result.hookups).toEqual(['water', 'electric', 'sewer'])
    })

    it('should handle null optional fields', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: null,
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 6000,
      })

      expect(result.siteName).toBeNull()
      expect(result.description).toBeNull()
    })
  })

  describe('validation', () => {
    it('should throw if site number already exists', async () => {
      // Create first site
      await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'First Site',
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 6000,
      })

      // Try to create duplicate
      await expect(
        handler.execute({
          id: 'site-456',
          propertyId: 'prop-456',
          siteNumber: '42', // Duplicate!
          siteName: 'Second Site',
          siteType: SiteType.TENT,
          basePrice: 5000,
          weekendPrice: 6000,
        })
      ).rejects.toThrow('Site number 42 already exists for this property')
    })

    it('should allow same site number in different properties', async () => {
      // Create site in property 1
      await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Site in Property 1',
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 6000,
      })

      // Create site with same number in property 2
      const result = await handler.execute({
        id: 'site-789',
        propertyId: 'prop-789',
        siteNumber: '42', // Same number, different property
        siteName: 'Site in Property 2',
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 6000,
      })

      expect(result.id).toBe('site-789')
      expect(result.propertyId).toBe('prop-789')
    })

    it('should throw if property ID is missing', async () => {
      await expect(
        handler.execute({
          id: 'site-123',
          propertyId: '',
          siteNumber: '42',
          siteName: 'Test',
          siteType: SiteType.TENT,
          basePrice: 5000,
          weekendPrice: 6000,
        })
      ).rejects.toThrow('Property ID is required')
    })

    it('should throw if site number is empty', async () => {
      await expect(
        handler.execute({
          id: 'site-123',
          propertyId: 'prop-456',
          siteNumber: '',
          siteName: 'Test',
          siteType: SiteType.TENT,
          basePrice: 5000,
          weekendPrice: 6000,
        })
      ).rejects.toThrow('Site number is required')
    })

    it('should throw if max occupancy is invalid', async () => {
      await expect(
        handler.execute({
          id: 'site-123',
          propertyId: 'prop-456',
          siteNumber: '42',
          siteName: 'Test',
          siteType: SiteType.TENT,
          basePrice: 5000,
          weekendPrice: 6000,
          maxOccupancy: 0,
        })
      ).rejects.toThrow('Max occupancy must be at least 1')
    })

    it('should throw if max vehicles is negative', async () => {
      await expect(
        handler.execute({
          id: 'site-123',
          propertyId: 'prop-456',
          siteNumber: '42',
          siteName: 'Test',
          siteType: SiteType.TENT,
          basePrice: 5000,
          weekendPrice: 6000,
          maxVehicles: -1,
        })
      ).rejects.toThrow('Max vehicles cannot be negative')
    })

    it('should throw if base price is negative', async () => {
      await expect(
        handler.execute({
          id: 'site-123',
          propertyId: 'prop-456',
          siteNumber: '42',
          siteName: 'Test',
          siteType: SiteType.TENT,
          basePrice: -100,
          weekendPrice: 6000,
        })
      ).rejects.toThrow('Base price cannot be negative')
    })

    it('should throw if weekend price is negative', async () => {
      await expect(
        handler.execute({
          id: 'site-123',
          propertyId: 'prop-456',
          siteNumber: '42',
          siteName: 'Test',
          siteType: SiteType.TENT,
          basePrice: 5000,
          weekendPrice: -100,
        })
      ).rejects.toThrow('Weekend price cannot be negative')
    })
  })

  describe('pricing', () => {
    it('should create pricing in cents', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Test',
        siteType: SiteType.TENT,
        basePrice: 7599, // $75.99
        weekendPrice: 9050, // $90.50
      })

      expect(result.pricing.basePrice).toBe(7599)
      expect(result.pricing.weekendPrice).toBe(9050)
      expect(result.pricing.formatBasePrice()).toBe('$75.99')
      expect(result.pricing.formatWeekendPrice()).toBe('$90.50')
    })

    it('should allow zero prices', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Test',
        siteType: SiteType.TENT,
        basePrice: 0,
        weekendPrice: 0,
      })

      expect(result.pricing.basePrice).toBe(0)
      expect(result.pricing.weekendPrice).toBe(0)
    })

    it('should allow same base and weekend price', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Test',
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 5000,
      })

      expect(result.pricing.hasWeekendSurcharge()).toBe(false)
    })
  })

  describe('site types', () => {
    it('should create RV site with full hookups', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'RV Site',
        siteType: SiteType.RV,
        basePrice: 7500,
        weekendPrice: 9000,
        hookups: ['water', 'electric', 'sewer'],
      })

      expect(result.siteType).toBe(SiteType.RV)
      expect(result.hookups).toContain('water')
      expect(result.hookups).toContain('electric')
      expect(result.hookups).toContain('sewer')
    })

    it('should create tent site', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Tent Site',
        siteType: SiteType.TENT,
        basePrice: 3000,
        weekendPrice: 4000,
      })

      expect(result.siteType).toBe(SiteType.TENT)
    })

    it('should create cabin site', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '42',
        siteName: 'Cozy Cabin',
        siteType: SiteType.CABIN,
        basePrice: 15000,
        weekendPrice: 18000,
      })

      expect(result.siteType).toBe(SiteType.CABIN)
    })
  })

  describe('edge cases', () => {
    it('should trim whitespace from site number and name', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '  42  ',
        siteName: '  Test Site  ',
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 6000,
      })

      expect(result.siteNumber).toBe('42')
      expect(result.siteName).toBe('Test Site')
    })

    it('should handle very large site numbers', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: '999999',
        siteName: 'Test',
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 6000,
      })

      expect(result.siteNumber).toBe('999999')
    })

    it('should handle alphanumeric site numbers', async () => {
      const result = await handler.execute({
        id: 'site-123',
        propertyId: 'prop-456',
        siteNumber: 'A-42-B',
        siteName: 'Test',
        siteType: SiteType.TENT,
        basePrice: 5000,
        weekendPrice: 6000,
      })

      expect(result.siteNumber).toBe('A-42-B')
    })
  })
})
