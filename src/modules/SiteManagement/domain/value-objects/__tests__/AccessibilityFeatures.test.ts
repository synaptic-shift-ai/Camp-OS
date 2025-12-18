/**
 * AccessibilityFeatures Value Object Tests
 */
import { describe, it, expect } from 'vitest'
import { AccessibilityFeatures, ACCESSIBILITY_FEATURE_LABELS } from '../AccessibilityFeatures'

describe('AccessibilityFeatures', () => {
  describe('create', () => {
    it('should create with ADA accessible and features', () => {
      const accessibility = AccessibilityFeatures.create(true, [
        'wheelchair_accessible',
        'paved_path',
        'level_surface',
      ])

      expect(accessibility.adaAccessible).toBe(true)
      expect(accessibility.features).toHaveLength(3)
      expect(accessibility.hasFeature('wheelchair_accessible')).toBe(true)
    })

    it('should create non-accessible site', () => {
      const accessibility = AccessibilityFeatures.create(false, [])

      expect(accessibility.adaAccessible).toBe(false)
      expect(accessibility.features).toHaveLength(0)
    })

    it('should remove duplicate features', () => {
      const accessibility = AccessibilityFeatures.create(true, [
        'wheelchair_accessible',
        'wheelchair_accessible',
        'paved_path',
      ])

      expect(accessibility.features).toHaveLength(2)
    })

    it('should throw for invalid features', () => {
      expect(() =>
        AccessibilityFeatures.create(true, ['invalid_feature' as any])
      ).toThrow('Invalid accessibility features')
    })

    it('should trim notes', () => {
      const accessibility = AccessibilityFeatures.create(
        true,
        ['wheelchair_accessible'],
        '  Some notes  '
      )

      expect(accessibility.notes).toBe('Some notes')
    })
  })

  describe('factory methods', () => {
    it('notAccessible should create non-accessible instance', () => {
      const accessibility = AccessibilityFeatures.notAccessible()

      expect(accessibility.adaAccessible).toBe(false)
      expect(accessibility.features).toHaveLength(0)
    })
  })

  describe('hasFeature', () => {
    it('should return true for present feature', () => {
      const accessibility = AccessibilityFeatures.create(true, ['wheelchair_accessible'])

      expect(accessibility.hasFeature('wheelchair_accessible')).toBe(true)
    })

    it('should return false for missing feature', () => {
      const accessibility = AccessibilityFeatures.create(true, ['wheelchair_accessible'])

      expect(accessibility.hasFeature('ramp_access')).toBe(false)
    })
  })

  describe('featureLabels', () => {
    it('should return human-readable labels', () => {
      const accessibility = AccessibilityFeatures.create(true, [
        'wheelchair_accessible',
        'paved_path',
      ])

      expect(accessibility.featureLabels).toContain('Wheelchair Accessible')
      expect(accessibility.featureLabels).toContain('Paved Path to Site')
    })
  })

  describe('equals', () => {
    it('should return true for equal instances', () => {
      const a1 = AccessibilityFeatures.create(true, ['wheelchair_accessible', 'paved_path'])
      const a2 = AccessibilityFeatures.create(true, ['paved_path', 'wheelchair_accessible'])

      expect(a1.equals(a2)).toBe(true)
    })

    it('should return false for different adaAccessible', () => {
      const a1 = AccessibilityFeatures.create(true, [])
      const a2 = AccessibilityFeatures.create(false, [])

      expect(a1.equals(a2)).toBe(false)
    })

    it('should return false for different features', () => {
      const a1 = AccessibilityFeatures.create(true, ['wheelchair_accessible'])
      const a2 = AccessibilityFeatures.create(true, ['paved_path'])

      expect(a1.equals(a2)).toBe(false)
    })
  })

  describe('fromPersistence', () => {
    it('should create from database values', () => {
      const accessibility = AccessibilityFeatures.fromPersistence(true, [
        'wheelchair_accessible',
        'ramp_access',
      ])

      expect(accessibility.adaAccessible).toBe(true)
      expect(accessibility.features).toHaveLength(2)
    })

    it('should handle null features', () => {
      const accessibility = AccessibilityFeatures.fromPersistence(true, null)

      expect(accessibility.adaAccessible).toBe(true)
      expect(accessibility.features).toHaveLength(0)
    })
  })

  describe('toPersistence', () => {
    it('should convert to database format', () => {
      const accessibility = AccessibilityFeatures.create(true, [
        'wheelchair_accessible',
        'paved_path',
      ])
      const persistence = accessibility.toPersistence()

      expect(persistence.ada_accessible).toBe(true)
      expect(persistence.accessibility_features).toHaveLength(2)
    })

    it('should return null features when empty', () => {
      const accessibility = AccessibilityFeatures.create(true, [])
      const persistence = accessibility.toPersistence()

      expect(persistence.accessibility_features).toBeNull()
    })
  })

  describe('ACCESSIBILITY_FEATURE_LABELS', () => {
    it('should have labels for all features', () => {
      const expectedFeatures = [
        'wheelchair_accessible',
        'paved_path',
        'level_surface',
        'accessible_restroom_nearby',
        'accessible_parking',
        'ramp_access',
        'wide_entrance',
        'grab_bars',
        'roll_in_shower',
      ]

      expectedFeatures.forEach((feature) => {
        expect(ACCESSIBILITY_FEATURE_LABELS[feature as keyof typeof ACCESSIBILITY_FEATURE_LABELS]).toBeDefined()
      })
    })
  })
})
