/**
 * Hookups Value Object Tests
 */
import { describe, it, expect } from 'vitest'
import { Hookups, HOOKUP_LABELS } from '../Hookups'

describe('Hookups', () => {
  describe('create', () => {
    it('should create with hookup types', () => {
      const hookups = Hookups.create(['water', 'electric_30amp', 'sewer'])

      expect(hookups.all).toHaveLength(3)
      expect(hookups.has('water')).toBe(true)
      expect(hookups.has('electric_30amp')).toBe(true)
      expect(hookups.has('sewer')).toBe(true)
    })

    it('should remove duplicates', () => {
      const hookups = Hookups.create(['water', 'water', 'sewer'])

      expect(hookups.all).toHaveLength(2)
    })

    it('should throw for invalid hookup type', () => {
      expect(() => Hookups.create(['invalid_hookup' as any])).toThrow(
        'Invalid hookup types'
      )
    })
  })

  describe('factory methods', () => {
    it('none should create empty hookups', () => {
      const hookups = Hookups.none()

      expect(hookups.all).toHaveLength(0)
      expect(hookups.count).toBe(0)
    })

    it('fullHookups should create water, 50amp electric, and sewer', () => {
      const hookups = Hookups.fullHookups()

      expect(hookups.hasWater()).toBe(true)
      expect(hookups.getElectricAmperage()).toBe(50)
      expect(hookups.hasSewer()).toBe(true)
      expect(hookups.isFullHookup()).toBe(true)
    })
  })

  describe('utility methods', () => {
    it('hasWater should return correct value', () => {
      const withWater = Hookups.create(['water'])
      const withoutWater = Hookups.create(['sewer'])

      expect(withWater.hasWater()).toBe(true)
      expect(withoutWater.hasWater()).toBe(false)
    })

    it('hasElectric should return true for any electric type', () => {
      const with20 = Hookups.create(['electric_20amp'])
      const with30 = Hookups.create(['electric_30amp'])
      const with50 = Hookups.create(['electric_50amp'])
      const noElectric = Hookups.create(['water'])

      expect(with20.hasElectric()).toBe(true)
      expect(with30.hasElectric()).toBe(true)
      expect(with50.hasElectric()).toBe(true)
      expect(noElectric.hasElectric()).toBe(false)
    })

    it('getElectricAmperage should return highest available', () => {
      const with50 = Hookups.create(['electric_50amp', 'electric_30amp'])
      const with30only = Hookups.create(['electric_30amp'])
      const with20only = Hookups.create(['electric_20amp'])
      const noElectric = Hookups.create(['water'])

      expect(with50.getElectricAmperage()).toBe(50)
      expect(with30only.getElectricAmperage()).toBe(30)
      expect(with20only.getElectricAmperage()).toBe(20)
      expect(noElectric.getElectricAmperage()).toBeNull()
    })

    it('hasSewer should return correct value', () => {
      const withSewer = Hookups.create(['sewer'])
      const withoutSewer = Hookups.create(['water'])

      expect(withSewer.hasSewer()).toBe(true)
      expect(withoutSewer.hasSewer()).toBe(false)
    })

    it('isFullHookup should check water, electric, and sewer', () => {
      const full = Hookups.create(['water', 'electric_30amp', 'sewer'])
      const partial = Hookups.create(['water', 'electric_30amp'])

      expect(full.isFullHookup()).toBe(true)
      expect(partial.isFullHookup()).toBe(false)
    })
  })

  describe('labels', () => {
    it('should return human-readable labels', () => {
      const hookups = Hookups.create(['water', 'electric_50amp', 'sewer'])

      expect(hookups.labels).toContain('Water')
      expect(hookups.labels).toContain('50 Amp Electric')
      expect(hookups.labels).toContain('Sewer')
    })
  })

  describe('equals', () => {
    it('should return true for equal hookups', () => {
      const h1 = Hookups.create(['water', 'sewer'])
      const h2 = Hookups.create(['sewer', 'water'])

      expect(h1.equals(h2)).toBe(true)
    })

    it('should return false for different hookups', () => {
      const h1 = Hookups.create(['water'])
      const h2 = Hookups.create(['sewer'])

      expect(h1.equals(h2)).toBe(false)
    })
  })

  describe('fromPersistence', () => {
    it('should create from database JSON', () => {
      const hookups = Hookups.fromPersistence(['water', 'electric_30amp'])

      expect(hookups.all).toHaveLength(2)
    })

    it('should handle null', () => {
      const hookups = Hookups.fromPersistence(null)

      expect(hookups.all).toHaveLength(0)
    })

    it('should filter invalid values for backward compatibility', () => {
      const hookups = Hookups.fromPersistence(['water', 'invalid_type', 'sewer'])

      expect(hookups.all).toHaveLength(2)
      expect(hookups.has('water')).toBe(true)
      expect(hookups.has('sewer')).toBe(true)
    })
  })

  describe('toPersistence', () => {
    it('should convert to array', () => {
      const hookups = Hookups.create(['water', 'sewer'])
      const persistence = hookups.toPersistence()

      expect(persistence).toEqual(['water', 'sewer'])
    })

    it('should return null for empty hookups', () => {
      const hookups = Hookups.none()
      const persistence = hookups.toPersistence()

      expect(persistence).toBeNull()
    })
  })

  describe('HOOKUP_LABELS', () => {
    it('should have labels for all hookup types', () => {
      const expectedTypes = [
        'water',
        'electric_20amp',
        'electric_30amp',
        'electric_50amp',
        'sewer',
        'cable',
        'wifi',
        'phone',
        'natural_gas',
        'propane',
      ]

      expectedTypes.forEach((type) => {
        expect(HOOKUP_LABELS[type as keyof typeof HOOKUP_LABELS]).toBeDefined()
      })
    })
  })
})
