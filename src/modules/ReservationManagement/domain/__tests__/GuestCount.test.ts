/**
 * GuestCount Value Object Tests
 *
 * Following CLAUDE.md testing best practices:
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterize test inputs
 * - T-8: Test description states what expect verifies
 * - T-10: Test edge cases and boundaries
 */

import { describe, test, expect } from 'vitest'
import { GuestCount } from '../GuestCount'

describe('GuestCount', () => {
  // Test data
  const adults = 2
  const children = 1
  const pets = 1
  const vehicles = 1

  describe('create', () => {
    test('should create guest count with adults only', () => {
      const guestCount = GuestCount.create(adults)

      expect(guestCount.adults).toBe(adults)
      expect(guestCount.children).toBe(0)
      expect(guestCount.pets).toBe(0)
      expect(guestCount.vehicles).toBe(0)
      expect(guestCount.totalGuests).toBe(adults)
    })

    test('should create guest count with all parameters', () => {
      const guestCount = GuestCount.create(adults, children, pets, vehicles)

      expect(guestCount.adults).toBe(adults)
      expect(guestCount.children).toBe(children)
      expect(guestCount.pets).toBe(pets)
      expect(guestCount.vehicles).toBe(vehicles)
      expect(guestCount.totalGuests).toBe(adults + children)
    })

    test('should create guest count with zero children, pets, and vehicles', () => {
      const guestCount = GuestCount.create(adults, 0, 0, 0)

      expect(guestCount.adults).toBe(adults)
      expect(guestCount.children).toBe(0)
      expect(guestCount.pets).toBe(0)
      expect(guestCount.vehicles).toBe(0)
    })

    test('should reject zero adults', () => {
      expect(() => GuestCount.create(0)).toThrow('At least 1 adult is required')
    })

    test('should reject negative adults', () => {
      expect(() => GuestCount.create(-1)).toThrow(
        'Adults must be a non-negative integer'
      )
    })

    test('should reject negative children', () => {
      expect(() => GuestCount.create(adults, -1)).toThrow(
        'Children must be a non-negative integer'
      )
    })

    test('should reject negative pets', () => {
      expect(() => GuestCount.create(adults, 0, -1)).toThrow(
        'Pets must be a non-negative integer'
      )
    })

    test('should reject negative vehicles', () => {
      expect(() => GuestCount.create(adults, 0, 0, -1)).toThrow(
        'Vehicles must be a non-negative integer'
      )
    })

    test('should reject non-integer adults', () => {
      expect(() => GuestCount.create(2.5)).toThrow(
        'Adults must be a non-negative integer'
      )
    })

    test('should reject non-integer children', () => {
      expect(() => GuestCount.create(adults, 1.5)).toThrow(
        'Children must be a non-negative integer'
      )
    })

    test('should reject more than 50 adults', () => {
      expect(() => GuestCount.create(51)).toThrow('Maximum 50 adults allowed')
    })

    test('should reject more than 50 children', () => {
      expect(() => GuestCount.create(adults, 51)).toThrow(
        'Maximum 50 children allowed'
      )
    })

    test('should reject more than 10 pets', () => {
      expect(() => GuestCount.create(adults, 0, 11)).toThrow(
        'Maximum 10 pets allowed'
      )
    })

    test('should reject more than 10 vehicles', () => {
      expect(() => GuestCount.create(adults, 0, 0, 11)).toThrow(
        'Maximum 10 vehicles allowed'
      )
    })

    test('should allow maximum valid counts', () => {
      const guestCount = GuestCount.create(50, 50, 10, 10)

      expect(guestCount.adults).toBe(50)
      expect(guestCount.children).toBe(50)
      expect(guestCount.pets).toBe(10)
      expect(guestCount.vehicles).toBe(10)
      expect(guestCount.totalGuests).toBe(100)
    })
  })

  describe('totalGuests', () => {
    test('should calculate total guests as adults only', () => {
      const guestCount = GuestCount.create(adults)

      expect(guestCount.totalGuests).toBe(adults)
    })

    test('should calculate total guests as adults plus children', () => {
      const guestCount = GuestCount.create(adults, children)

      expect(guestCount.totalGuests).toBe(adults + children)
    })

    test('should not include pets in total guests', () => {
      const guestCount = GuestCount.create(adults, children, pets)

      expect(guestCount.totalGuests).toBe(adults + children)
    })

    test('should not include vehicles in total guests', () => {
      const guestCount = GuestCount.create(adults, children, pets, vehicles)

      expect(guestCount.totalGuests).toBe(adults + children)
    })
  })

  describe('hasChildren', () => {
    test('should return true when children present', () => {
      const guestCount = GuestCount.create(adults, children)

      expect(guestCount.hasChildren()).toBe(true)
    })

    test('should return false when no children', () => {
      const guestCount = GuestCount.create(adults)

      expect(guestCount.hasChildren()).toBe(false)
    })
  })

  describe('hasPets', () => {
    test('should return true when pets present', () => {
      const guestCount = GuestCount.create(adults, 0, pets)

      expect(guestCount.hasPets()).toBe(true)
    })

    test('should return false when no pets', () => {
      const guestCount = GuestCount.create(adults)

      expect(guestCount.hasPets()).toBe(false)
    })
  })

  describe('hasVehicles', () => {
    test('should return true when vehicles present', () => {
      const guestCount = GuestCount.create(adults, 0, 0, vehicles)

      expect(guestCount.hasVehicles()).toBe(true)
    })

    test('should return false when no vehicles', () => {
      const guestCount = GuestCount.create(adults)

      expect(guestCount.hasVehicles()).toBe(false)
    })
  })

  describe('isAdultsOnly', () => {
    test('should return true when only adults', () => {
      const guestCount = GuestCount.create(adults)

      expect(guestCount.isAdultsOnly()).toBe(true)
    })

    test('should return false when children present', () => {
      const guestCount = GuestCount.create(adults, children)

      expect(guestCount.isAdultsOnly()).toBe(false)
    })
  })

  describe('exceedsCapacity', () => {
    test('should return true when total guests exceeds capacity', () => {
      const guestCount = GuestCount.create(adults, children) // 3 total

      expect(guestCount.exceedsCapacity(2)).toBe(true)
    })

    test('should return false when total guests equals capacity', () => {
      const guestCount = GuestCount.create(adults, children) // 3 total

      expect(guestCount.exceedsCapacity(3)).toBe(false)
    })

    test('should return false when total guests below capacity', () => {
      const guestCount = GuestCount.create(adults, children) // 3 total

      expect(guestCount.exceedsCapacity(5)).toBe(false)
    })
  })

  describe('updateAdults', () => {
    test('should update adult count', () => {
      const original = GuestCount.create(adults, children, pets, vehicles)
      const updated = original.updateAdults(5)

      expect(updated.adults).toBe(5)
      expect(updated.children).toBe(children)
      expect(updated.pets).toBe(pets)
      expect(updated.vehicles).toBe(vehicles)
    })

    test('should reject invalid adult count', () => {
      const guestCount = GuestCount.create(adults, children)

      expect(() => guestCount.updateAdults(0)).toThrow(
        'At least 1 adult is required'
      )
    })
  })

  describe('updateChildren', () => {
    test('should update children count', () => {
      const original = GuestCount.create(adults, children, pets, vehicles)
      const updated = original.updateChildren(3)

      expect(updated.adults).toBe(adults)
      expect(updated.children).toBe(3)
      expect(updated.pets).toBe(pets)
      expect(updated.vehicles).toBe(vehicles)
    })

    test('should allow removing all children', () => {
      const original = GuestCount.create(adults, children)
      const updated = original.updateChildren(0)

      expect(updated.children).toBe(0)
      expect(updated.isAdultsOnly()).toBe(true)
    })
  })

  describe('updatePets', () => {
    test('should update pets count', () => {
      const original = GuestCount.create(adults, children, pets, vehicles)
      const updated = original.updatePets(3)

      expect(updated.adults).toBe(adults)
      expect(updated.children).toBe(children)
      expect(updated.pets).toBe(3)
      expect(updated.vehicles).toBe(vehicles)
    })
  })

  describe('updateVehicles', () => {
    test('should update vehicles count', () => {
      const original = GuestCount.create(adults, children, pets, vehicles)
      const updated = original.updateVehicles(3)

      expect(updated.adults).toBe(adults)
      expect(updated.children).toBe(children)
      expect(updated.pets).toBe(pets)
      expect(updated.vehicles).toBe(3)
    })
  })

  describe('addGuests', () => {
    test('should add adults only', () => {
      const original = GuestCount.create(adults, children)
      const updated = original.addGuests(2, 0)

      expect(updated.adults).toBe(4)
      expect(updated.children).toBe(children)
    })

    test('should add children only', () => {
      const original = GuestCount.create(adults, children)
      const updated = original.addGuests(0, 2)

      expect(updated.adults).toBe(adults)
      expect(updated.children).toBe(3)
    })

    test('should add both adults and children', () => {
      const original = GuestCount.create(adults, children)
      const updated = original.addGuests(1, 2)

      expect(updated.adults).toBe(3)
      expect(updated.children).toBe(3)
      expect(updated.totalGuests).toBe(6)
    })

    test('should reject adding guests that exceed limits', () => {
      const original = GuestCount.create(48, 0)

      expect(() => original.addGuests(3, 0)).toThrow('Maximum 50 adults allowed')
    })
  })

  describe('removeGuests', () => {
    test('should remove adults', () => {
      const original = GuestCount.create(5, children)
      const updated = original.removeGuests(2, 0)

      expect(updated.adults).toBe(3)
      expect(updated.children).toBe(children)
    })

    test('should remove children', () => {
      const original = GuestCount.create(adults, 5)
      const updated = original.removeGuests(0, 2)

      expect(updated.adults).toBe(adults)
      expect(updated.children).toBe(3)
    })

    test('should reject removing all adults', () => {
      const original = GuestCount.create(adults, children)

      expect(() => original.removeGuests(2, 0)).toThrow(
        'At least 1 adult is required'
      )
    })

    test('should reject removing more guests than present', () => {
      const original = GuestCount.create(2, 1)

      expect(() => original.removeGuests(0, 2)).toThrow(
        'Children must be a non-negative integer'
      )
    })
  })

  describe('toString', () => {
    test('should format adults only', () => {
      const guestCount = GuestCount.create(1)

      expect(guestCount.toString()).toBe('1 adult')
    })

    test('should format multiple adults', () => {
      const guestCount = GuestCount.create(adults)

      expect(guestCount.toString()).toBe('2 adults')
    })

    test('should format adults and children', () => {
      const guestCount = GuestCount.create(adults, 1)

      expect(guestCount.toString()).toBe('2 adults, 1 child')
    })

    test('should format adults and multiple children', () => {
      const guestCount = GuestCount.create(adults, children)

      expect(guestCount.toString()).toBe('2 adults, 1 child')
    })

    test('should format adults, children, and pets', () => {
      const guestCount = GuestCount.create(adults, children, 1)

      expect(guestCount.toString()).toBe('2 adults, 1 child, 1 pet')
    })

    test('should format adults, children, pets, and vehicles', () => {
      const guestCount = GuestCount.create(adults, children, pets, vehicles)

      expect(guestCount.toString()).toBe('2 adults, 1 child, 1 pet, 1 vehicle')
    })

    test('should format with plural pets', () => {
      const guestCount = GuestCount.create(adults, 0, 2)

      expect(guestCount.toString()).toBe('2 adults, 2 pets')
    })

    test('should format with plural vehicles', () => {
      const guestCount = GuestCount.create(adults, 0, 0, 2)

      expect(guestCount.toString()).toBe('2 adults, 2 vehicles')
    })

    test('should format with plural children', () => {
      const guestCount = GuestCount.create(adults, 3)

      expect(guestCount.toString()).toBe('2 adults, 3 children')
    })
  })

  describe('equality', () => {
    test('should consider two guest counts with same values as equal', () => {
      const count1 = GuestCount.create(adults, children, pets, vehicles)
      const count2 = GuestCount.create(adults, children, pets, vehicles)

      expect(count1.equals(count2)).toBe(true)
    })

    test('should consider two guest counts with different adults as not equal', () => {
      const count1 = GuestCount.create(2, children, pets, vehicles)
      const count2 = GuestCount.create(3, children, pets, vehicles)

      expect(count1.equals(count2)).toBe(false)
    })

    test('should consider two guest counts with different children as not equal', () => {
      const count1 = GuestCount.create(adults, 1, pets, vehicles)
      const count2 = GuestCount.create(adults, 2, pets, vehicles)

      expect(count1.equals(count2)).toBe(false)
    })

    test('should consider two guest counts with different pets as not equal', () => {
      const count1 = GuestCount.create(adults, children, 1, vehicles)
      const count2 = GuestCount.create(adults, children, 2, vehicles)

      expect(count1.equals(count2)).toBe(false)
    })

    test('should consider two guest counts with different vehicles as not equal', () => {
      const count1 = GuestCount.create(adults, children, pets, 1)
      const count2 = GuestCount.create(adults, children, pets, 2)

      expect(count1.equals(count2)).toBe(false)
    })
  })
})
