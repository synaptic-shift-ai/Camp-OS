/**
 * Coordinates Value Object Tests
 */
import { describe, it, expect } from 'vitest'
import { Coordinates } from '../Coordinates'

describe('Coordinates', () => {
  describe('create', () => {
    it('should create valid coordinates', () => {
      const coords = Coordinates.create(37.7749, -122.4194)

      expect(coords.latitude).toBe(37.7749)
      expect(coords.longitude).toBe(-122.4194)
    })

    it('should expose lat/lng aliases', () => {
      const coords = Coordinates.create(40.7128, -74.006)

      expect(coords.lat).toBe(40.7128)
      expect(coords.lng).toBe(-74.006)
    })

    it('should throw for latitude below -90', () => {
      expect(() => Coordinates.create(-91, 0)).toThrow(
        'Latitude must be between -90 and 90'
      )
    })

    it('should throw for latitude above 90', () => {
      expect(() => Coordinates.create(91, 0)).toThrow(
        'Latitude must be between -90 and 90'
      )
    })

    it('should throw for longitude below -180', () => {
      expect(() => Coordinates.create(0, -181)).toThrow(
        'Longitude must be between -180 and 180'
      )
    })

    it('should throw for longitude above 180', () => {
      expect(() => Coordinates.create(0, 181)).toThrow(
        'Longitude must be between -180 and 180'
      )
    })

    it('should accept boundary values', () => {
      const northPole = Coordinates.create(90, 0)
      const southPole = Coordinates.create(-90, 0)
      const dateLine = Coordinates.create(0, 180)
      const antiDateLine = Coordinates.create(0, -180)

      expect(northPole.latitude).toBe(90)
      expect(southPole.latitude).toBe(-90)
      expect(dateLine.longitude).toBe(180)
      expect(antiDateLine.longitude).toBe(-180)
    })
  })

  describe('distanceTo', () => {
    it('should calculate distance between two points', () => {
      // San Francisco to Los Angeles (approximately 559 km)
      const sf = Coordinates.create(37.7749, -122.4194)
      const la = Coordinates.create(34.0522, -118.2437)

      const distance = sf.distanceTo(la)

      expect(distance).toBeGreaterThan(550)
      expect(distance).toBeLessThan(570)
    })

    it('should return 0 for same location', () => {
      const coords = Coordinates.create(37.7749, -122.4194)

      expect(coords.distanceTo(coords)).toBe(0)
    })

    it('should be symmetric', () => {
      const a = Coordinates.create(37.7749, -122.4194)
      const b = Coordinates.create(40.7128, -74.006)

      expect(a.distanceTo(b)).toBeCloseTo(b.distanceTo(a), 10)
    })
  })

  describe('distanceToInMiles', () => {
    it('should convert kilometers to miles', () => {
      // San Francisco to Los Angeles
      const sf = Coordinates.create(37.7749, -122.4194)
      const la = Coordinates.create(34.0522, -118.2437)

      const distanceKm = sf.distanceTo(la)
      const distanceMiles = sf.distanceToInMiles(la)

      expect(distanceMiles).toBeCloseTo(distanceKm * 0.621371, 2)
    })
  })

  describe('equals', () => {
    it('should return true for equal coordinates', () => {
      const c1 = Coordinates.create(37.7749, -122.4194)
      const c2 = Coordinates.create(37.7749, -122.4194)

      expect(c1.equals(c2)).toBe(true)
    })

    it('should return false for different coordinates', () => {
      const c1 = Coordinates.create(37.7749, -122.4194)
      const c2 = Coordinates.create(40.7128, -74.006)

      expect(c1.equals(c2)).toBe(false)
    })

    it('should handle floating point precision', () => {
      const c1 = Coordinates.create(37.7749000001, -122.4194)
      const c2 = Coordinates.create(37.7749, -122.4194)

      expect(c1.equals(c2)).toBe(true)
    })
  })

  describe('toString', () => {
    it('should format as comma-separated string', () => {
      const coords = Coordinates.create(37.7749, -122.4194)

      expect(coords.toString()).toBe('37.774900, -122.419400')
    })
  })

  describe('toGoogleMapsUrl', () => {
    it('should generate Google Maps URL', () => {
      const coords = Coordinates.create(37.7749, -122.4194)

      expect(coords.toGoogleMapsUrl()).toBe(
        'https://www.google.com/maps?q=37.7749,-122.4194'
      )
    })
  })

  describe('fromPersistence', () => {
    it('should create from lat/lng object', () => {
      const coords = Coordinates.fromPersistence({ lat: 37.7749, lng: -122.4194 })

      expect(coords).not.toBeNull()
      expect(coords!.latitude).toBe(37.7749)
      expect(coords!.longitude).toBe(-122.4194)
    })

    it('should create from latitude/longitude object', () => {
      const coords = Coordinates.fromPersistence({
        latitude: 37.7749,
        longitude: -122.4194,
      })

      expect(coords).not.toBeNull()
      expect(coords!.latitude).toBe(37.7749)
    })

    it('should return null for null input', () => {
      expect(Coordinates.fromPersistence(null)).toBeNull()
    })

    it('should return null for undefined input', () => {
      expect(Coordinates.fromPersistence(undefined)).toBeNull()
    })

    it('should return null for non-object input', () => {
      expect(Coordinates.fromPersistence('37.7749, -122.4194')).toBeNull()
    })

    it('should return null for missing coordinates', () => {
      expect(Coordinates.fromPersistence({ lat: 37.7749 })).toBeNull()
      expect(Coordinates.fromPersistence({ lng: -122.4194 })).toBeNull()
    })

    it('should return null for invalid coordinates', () => {
      expect(Coordinates.fromPersistence({ lat: 'invalid', lng: -122.4194 })).toBeNull()
    })

    it('should return null for out of range coordinates', () => {
      expect(Coordinates.fromPersistence({ lat: 100, lng: 0 })).toBeNull()
    })
  })

  describe('toPersistence', () => {
    it('should convert to lat/lng object', () => {
      const coords = Coordinates.create(37.7749, -122.4194)
      const persistence = coords.toPersistence()

      expect(persistence).toEqual({
        lat: 37.7749,
        lng: -122.4194,
      })
    })
  })
})
