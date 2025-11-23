/**
 * Site Aggregate Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Site } from '../Site'
import { Pricing } from '../Pricing'
import { SiteType } from '../SiteType'
import { SiteStatus } from '../SiteStatus'
import {
  SiteCreatedEvent,
  SiteUpdatedEvent,
  SiteStatusChangedEvent,
  SitePricingUpdatedEvent,
} from '../events'

describe('Site Aggregate', () => {
  let pricing: Pricing

  beforeEach(() => {
    pricing = Pricing.create(7500, 9000, 'USD') // $75 base, $90 weekend
  })

  describe('create', () => {
    it('should create a new site', () => {
      const site = Site.create(
        'site-123',
        'prop-456',
        '42',
        'Lakeside Paradise',
        SiteType.RV,
        pricing
      )

      expect(site.id).toBe('site-123')
      expect(site.propertyId).toBe('prop-456')
      expect(site.siteNumber).toBe('42')
      expect(site.siteName).toBe('Lakeside Paradise')
      expect(site.siteType).toBe(SiteType.RV)
      expect(site.status).toBe(SiteStatus.AVAILABLE)
    })

    it('should emit SiteCreatedEvent', () => {
      const site = Site.create(
        'site-123',
        'prop-456',
        '42',
        'Test Site',
        SiteType.TENT,
        pricing
      )

      const events = site.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(SiteCreatedEvent)

      const event = events[0] as SiteCreatedEvent
      expect(event.siteId).toBe('site-123')
      expect(event.propertyId).toBe('prop-456')
      expect(event.siteNumber).toBe('42')
    })

    it('should trim site number and name', () => {
      const site = Site.create(
        'site-123',
        'prop-456',
        '  42  ',
        '  Test Site  ',
        SiteType.TENT,
        pricing
      )

      expect(site.siteNumber).toBe('42')
      expect(site.siteName).toBe('Test Site')
    })

    it('should throw if property ID is missing', () => {
      expect(() =>
        Site.create('site-123', '', '42', 'Test', SiteType.TENT, pricing)
      ).toThrow('Property ID is required')
    })

    it('should throw if site number is empty', () => {
      expect(() =>
        Site.create('site-123', 'prop-456', '', 'Test', SiteType.TENT, pricing)
      ).toThrow('Site number is required')
    })

    it('should throw if max occupancy is less than 1', () => {
      expect(() =>
        Site.create('site-123', 'prop-456', '42', 'Test', SiteType.TENT, pricing, {
          maxOccupancy: 0,
        })
      ).toThrow('Max occupancy must be at least 1')
    })

    it('should throw if max vehicles is negative', () => {
      expect(() =>
        Site.create('site-123', 'prop-456', '42', 'Test', SiteType.TENT, pricing, {
          maxVehicles: -1,
        })
      ).toThrow('Max vehicles cannot be negative')
    })

    it('should accept optional fields', () => {
      const site = Site.create('site-123', 'prop-456', '42', 'Test', SiteType.RV, pricing, {
        description: 'Beautiful site',
        maxOccupancy: 6,
        maxVehicles: 2,
        sizeSqft: 1000,
        amenities: ['picnic_table', 'fire_ring'],
        hookups: ['water', 'electric', 'sewer'],
      })

      expect(site.description).toBe('Beautiful site')
      expect(site.maxOccupancy).toBe(6)
      expect(site.maxVehicles).toBe(2)
      expect(site.sizeSqft).toBe(1000)
      expect(site.amenities).toEqual(['picnic_table', 'fire_ring'])
      expect(site.hookups).toEqual(['water', 'electric', 'sewer'])
    })
  })

  describe('updateDetails', () => {
    let site: Site

    beforeEach(() => {
      site = Site.create('site-123', 'prop-456', '42', 'Test Site', SiteType.TENT, pricing)
      site.clearDomainEvents()
    })

    it('should update site details', () => {
      site.updateDetails({
        siteName: 'New Name',
        description: 'New description',
        maxOccupancy: 8,
      })

      expect(site.siteName).toBe('New Name')
      expect(site.description).toBe('New description')
      expect(site.maxOccupancy).toBe(8)
    })

    it('should emit SiteUpdatedEvent', () => {
      site.updateDetails({ siteName: 'Updated' })

      const events = site.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(SiteUpdatedEvent)
    })

    it('should update timestamp', async () => {
      const originalUpdated = site.updatedAt
      await new Promise((resolve) => setTimeout(resolve, 10))

      site.updateDetails({ siteName: 'Updated' })

      expect(site.updatedAt.getTime()).toBeGreaterThan(originalUpdated.getTime())
    })

    it('should throw if max occupancy invalid', () => {
      expect(() => site.updateDetails({ maxOccupancy: 0 })).toThrow(
        'Max occupancy must be at least 1'
      )
    })
  })

  describe('updatePricing', () => {
    let site: Site

    beforeEach(() => {
      site = Site.create('site-123', 'prop-456', '42', 'Test', SiteType.TENT, pricing)
      site.clearDomainEvents()
    })

    it('should update pricing', () => {
      const newPricing = Pricing.create(8500, 10000, 'USD')
      site.updatePricing(newPricing)

      expect(site.pricing.basePrice).toBe(8500)
      expect(site.pricing.weekendPrice).toBe(10000)
    })

    it('should emit SitePricingUpdatedEvent', () => {
      const newPricing = Pricing.create(8500, 10000, 'USD')
      site.updatePricing(newPricing)

      const events = site.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(SitePricingUpdatedEvent)

      const event = events[0] as SitePricingUpdatedEvent
      expect(event.oldBasePrice).toBe(7500)
      expect(event.newBasePrice).toBe(8500)
    })
  })

  describe('status transitions', () => {
    let site: Site

    beforeEach(() => {
      site = Site.create('site-123', 'prop-456', '42', 'Test', SiteType.TENT, pricing)
      site.clearDomainEvents()
    })

    describe('markAsOccupied', () => {
      it('should mark available site as occupied', () => {
        site.markAsOccupied()

        expect(site.status).toBe(SiteStatus.OCCUPIED)
      })

      it('should emit SiteStatusChangedEvent', () => {
        site.markAsOccupied()

        const events = site.getDomainEvents()
        expect(events).toHaveLength(1)
        expect(events[0]).toBeInstanceOf(SiteStatusChangedEvent)

        const event = events[0] as SiteStatusChangedEvent
        expect(event.oldStatus).toBe(SiteStatus.AVAILABLE)
        expect(event.newStatus).toBe(SiteStatus.OCCUPIED)
      })

      it('should throw if site is not available', () => {
        site.markAsOccupied()
        site.clearDomainEvents()

        expect(() => site.markAsOccupied()).toThrow('Cannot occupy site')
      })
    })

    describe('markAsAvailable', () => {
      it('should mark site as available', () => {
        site.markAsOccupied()
        site.clearDomainEvents()

        site.markAsAvailable()

        expect(site.status).toBe(SiteStatus.AVAILABLE)
      })

      it('should not emit event if already available', () => {
        expect(site.status).toBe(SiteStatus.AVAILABLE)

        site.markAsAvailable()

        expect(site.getDomainEvents()).toHaveLength(0)
      })
    })

    describe('markAsNeedsHousekeeping', () => {
      it('should mark site as needing housekeeping', () => {
        site.markAsNeedsHousekeeping()

        expect(site.status).toBe(SiteStatus.NEEDS_HOUSEKEEPING)
      })

      it('should emit event', () => {
        site.markAsNeedsHousekeeping()

        const events = site.getDomainEvents()
        expect(events).toHaveLength(1)
        expect(events[0]).toBeInstanceOf(SiteStatusChangedEvent)
      })
    })

    describe('completeHousekeeping', () => {
      it('should mark site as available after housekeeping', () => {
        site.markAsNeedsHousekeeping()
        site.clearDomainEvents()

        site.completeHousekeeping()

        expect(site.status).toBe(SiteStatus.AVAILABLE)
      })

      it('should throw if not in housekeeping status', () => {
        expect(() => site.completeHousekeeping()).toThrow(
          'Cannot complete housekeeping'
        )
      })
    })

    describe('markAsOutOfService', () => {
      it('should mark site as out of service', () => {
        site.markAsOutOfService()

        expect(site.status).toBe(SiteStatus.OUT_OF_SERVICE)
      })
    })
  })

  describe('business logic', () => {
    let site: Site

    beforeEach(() => {
      site = Site.create('site-123', 'prop-456', '42', 'Test', SiteType.RV, pricing, {
        maxOccupancy: 6,
        maxVehicles: 2,
      })
    })

    describe('isAvailableForBooking', () => {
      it('should return true if status is available', () => {
        expect(site.isAvailableForBooking()).toBe(true)
      })

      it('should return false if occupied', () => {
        site.markAsOccupied()
        expect(site.isAvailableForBooking()).toBe(false)
      })

      it('should return false if out of service', () => {
        site.markAsOutOfService()
        expect(site.isAvailableForBooking()).toBe(false)
      })
    })

    describe('canAccommodate', () => {
      it('should return true if within capacity', () => {
        expect(site.canAccommodate(4, 1)).toBe(true)
      })

      it('should return false if occupancy exceeds max', () => {
        expect(site.canAccommodate(7, 1)).toBe(false)
      })

      it('should return false if vehicles exceed max', () => {
        expect(site.canAccommodate(4, 3)).toBe(false)
      })

      it('should return true if max occupancy is null', () => {
        const site2 = Site.create('site-456', 'prop-456', '43', 'Test', SiteType.TENT, pricing, {
          maxOccupancy: null,
        })

        expect(site2.canAccommodate(100, 0)).toBe(true)
      })
    })
  })

  describe('toPersistence', () => {
    it('should convert to database format', () => {
      const site = Site.create('site-123', 'prop-456', '42', 'Test Site', SiteType.RV, pricing, {
        description: 'Beautiful site',
        maxOccupancy: 6,
        maxVehicles: 2,
        sizeSqft: 1000,
      })

      const persistence = site.toPersistence()

      expect(persistence.id).toBe('site-123')
      expect(persistence.property_id).toBe('prop-456')
      expect(persistence.site_number).toBe('42')
      expect(persistence.site_name).toBe('Test Site')
      expect(persistence.site_type).toBe(SiteType.RV)
      expect(persistence.base_price).toBe(7500)
      expect(persistence.weekend_price).toBe(9000)
      expect(persistence.max_occupancy).toBe(6)
      expect(persistence.status).toBe(SiteStatus.AVAILABLE)
    })
  })

  describe('fromPersistence', () => {
    it('should reconstitute from database', () => {
      const createdAt = new Date('2025-01-01')
      const updatedAt = new Date('2025-01-02')

      const site = Site.fromPersistence(
        'site-123',
        'prop-456',
        '42',
        'Test Site',
        SiteType.RV,
        pricing,
        6,
        2,
        1000,
        SiteStatus.AVAILABLE,
        'Beautiful site',
        ['picnic_table'],
        ['water', 'electric'],
        ['img1.jpg'],
        { lat: 40.7, lng: -74.0 },
        createdAt,
        updatedAt
      )

      expect(site.id).toBe('site-123')
      expect(site.propertyId).toBe('prop-456')
      expect(site.siteNumber).toBe('42')
      expect(site.createdAt).toEqual(createdAt)
      expect(site.updatedAt).toEqual(updatedAt)
      expect(site.getDomainEvents()).toHaveLength(0) // No events when reconstituting
    })
  })
})
